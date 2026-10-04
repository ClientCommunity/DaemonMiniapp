"""TemporaSMS provider implementation for independently managed Server 4."""
from __future__ import annotations

import asyncio
import json
import os
import os
import re
from dataclasses import dataclass

import aiohttp

from database import connect, transaction, utcnow
from secrets_manager import decrypt_secret
from api_cooldown import check_cooldown, is_cooling_down, record_rate_limit, get_cooldown_remaining

ENDPOINT = "https://api.temporasms.com/stubs/handler_api.php"


class TemporaError(RuntimeError):
    MESSAGES = {
        "BAD_ACTION": "Invalid provider action", "BAD_SERVICE": "Service unavailable",
        "NO_BALANCE": "Provider balance is insufficient", "BAD_OPERATOR": "Invalid operator",
        "BAD_COUNTRY": "Invalid country", "WRONG_MAX_PRICE": "Invalid maximum price",
        "BAD_KEY": "Invalid API key", "SERVICE_BANNED": "Service temporarily blocked",
        "USER_BANNED": "Provider account banned", "ERROR": "Provider server error",
        "TOO_MANY_REQUESTS": "Provider rate limit exceeded", "UNDER_DEVELOPMENT": "Feature under development",
        "NO_ACTIVATION": "Activation not found", "BAD_STATUS": "Invalid activation status",
        "NO_NUMBERS": "No numbers currently available",
        "HTTP_429": "Provider rate limit exceeded",
        "RATE_LIMIT_COOLDOWN": "Provider rate limit cooldown active",
    }

    def __init__(self, code: str):
        self.code = code.strip()
        super().__init__(self.MESSAGES.get(self.code, self.code))


@dataclass(frozen=True)
class TemporaActivation:
    order_id: str
    phone: str


class TemporaClient:
    def config(self):
        with connect() as conn:
            return conn.execute("SELECT * FROM service_servers WHERE server_no=4").fetchone()

    async def request(self, action: str, **params) -> str:
        cfg = self.config()
        if not cfg["api_enabled"] or not cfg["api_key"]:
            raise TemporaError("BAD_KEY")
        target_url = cfg["api_url"] or ENDPOINT
        if is_cooling_down(target_url):
            raise TemporaError("TOO_MANY_REQUESTS")
        stored = cfg["api_key"]
        key = decrypt_secret(stored[4:]) if stored.startswith("enc:") else stored
        query = {"api_key": key, "action": action, **params}
        timeout = aiohttp.ClientTimeout(total=max(1, cfg["timeout_seconds"]))
        last_error = None
        for attempt in range(max(0, cfg["retry_count"]) + 1):
            if is_cooling_down(target_url):
                raise TemporaError("TOO_MANY_REQUESTS")
            try:
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.get(target_url, params=query) as response:
                        body = (await response.text()).strip()
                        if response.status == 429:
                            record_rate_limit(target_url, 10.0, reason="HTTP 429")
                            raise TemporaError("TOO_MANY_REQUESTS")
                        if response.status >= 400:
                            raise TemporaError(f"HTTP_{response.status}")
                        if body in TemporaError.MESSAGES:
                            if body == "TOO_MANY_REQUESTS":
                                record_rate_limit(target_url, 10.0, reason="body TOO_MANY_REQUESTS")
                                if attempt < cfg["retry_count"]:
                                    await asyncio.sleep(10.0)
                                    continue
                            raise TemporaError(body)
                        return body
            except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                last_error = exc
                if attempt < cfg["retry_count"]:
                    await asyncio.sleep(min(2 ** attempt, 5))
        raise TemporaError(type(last_error).__name__ if last_error else "NETWORK_ERROR")

    async def get_balance(self) -> float:
        body = await self.request("getBalance")
        match = re.fullmatch(r"ACCESS_BALANCE:([0-9]+(?:\.[0-9]+)?)", body)
        if not match:
            raise TemporaError(body)
        return float(match.group(1))

    async def get_operators(self) -> dict[str, str]:
        """Fetch operators when supported, with a documented-config fallback."""
        try:
            value = json.loads(await self.request("getOperators"))
            if isinstance(value, dict) and value:
                operators = {}
                for left, right in value.items():
                    # The documented response is {"Operator 1":"1"}; tolerate
                    # installations returning the more conventional reverse.
                    if str(right).strip().isdigit() and not str(left).strip().isdigit():
                        operators[str(right).strip()] = str(left).strip()
                    else:
                        operators[str(left).strip()] = str(right).strip()
                return operators
        except TemporaError as exc:
            # Fall back only when discovery itself is unsupported. Credential,
            # ban, and rate-limit errors must remain visible to the admin.
            if exc.code not in ("BAD_ACTION", "UNDER_DEVELOPMENT"):
                raise
        except json.JSONDecodeError:
            pass
        # Tempora's public examples use operator 1 and 2 but some deployments do
        # not expose getOperators. Operators can be overridden without code.
        codes = [item.strip() for item in os.getenv("TEMPORASMS_OPERATORS", "1,2").split(",") if item.strip()]
        return {code: f"Operator {code}" for code in codes}

    async def get_countries(self, operator: str | None = None) -> dict[str, str]:
        params = {"operator": operator} if operator else {}
        value = json.loads(await self.request("getCountries", **params))
        return {str(code): str(name) for code, name in value.items()}

    async def get_services(self, operator: str | None = None) -> dict[str, str]:
        params = {"operator": operator} if operator else {}
        value = json.loads(await self.request("getServices", **params))
        return {str(code): str(name) for code, name in value.items()}

    async def get_prices(self, operator: str, country: str, service: str | None = None):
        params = {"operator": operator, "country": country}
        if service:
            params["service"] = service
        value = json.loads(await self.request("getPricesV3", **params))
        return value

    @staticmethod
    def parse_stock(value, country: str) -> list[tuple[str, float, int]]:
        """Normalize documented V3 stock into service/price/count rows."""
        root = value.get(str(country), value) if isinstance(value, dict) else {}
        if not isinstance(root, dict):
            return []
        rows = []
        for service, details in root.items():
            if not isinstance(details, dict):
                continue
            try:
                count = int(details.get("count", 0))
            except (TypeError, ValueError):
                count = 0
            prices = []
            direct = details.get("price")
            for item in direct if isinstance(direct, list) else [direct]:
                try:
                    if float(item) > 0: prices.append(float(item))
                except (TypeError, ValueError): pass
            providers = details.get("providers", {})
            if isinstance(providers, dict):
                for provider in providers.values():
                    if not isinstance(provider, dict): continue
                    try:
                        provider_count = int(provider.get("count", 0))
                    except (TypeError, ValueError):
                        provider_count = 0
                    if provider_count <= 0: continue
                    offered = provider.get("price", [])
                    for item in offered if isinstance(offered, list) else [offered]:
                        try:
                            if float(item) > 0: prices.append(float(item))
                        except (TypeError, ValueError): pass
            if count > 0 and prices:
                rows.append((str(service), min(prices), count))
        return rows

    async def minimum_price(self, operator: str, country: str, service: str) -> float:
        value = await self.get_prices(operator, country, service)
        service_data = value
        if isinstance(service_data, dict) and country in service_data:
            service_data = service_data[country]
        if isinstance(service_data, dict) and service in service_data:
            service_data = service_data[service]
        if isinstance(service_data, dict):
            try:
                if "count" in service_data and int(service_data["count"]) <= 0:
                    raise TemporaError("NO_NUMBERS")
            except (TypeError, ValueError):
                pass
        prices = []
        def walk(node):
            if isinstance(node, dict):
                for key, child in node.items():
                    if str(key).casefold() in ("price", "cost"):
                        if isinstance(child, list):
                            for price in child:
                                try: prices.append(float(price))
                                except (TypeError, ValueError): pass
                        else:
                            try: prices.append(float(child))
                            except (TypeError, ValueError): pass
                    walk(child)
            elif isinstance(node, list):
                for child in node: walk(child)
        walk(service_data)
        if not prices:
            raise TemporaError("BAD_SERVICE")
        return min(price for price in prices if price > 0)

    async def get_number(self, service: str, country: str, operator: str, max_price: float | None = None):
        params = {"service": service, "country": country, "operator": operator}
        if max_price is not None:
            params["maxPrice"] = max_price
        body = await self.request("getNumber", **params)
        match = re.fullmatch(r"ACCESS_NUMBER:([^:]+):(.+)", body)
        if not match:
            raise TemporaError(body)
        return TemporaActivation(match.group(1), match.group(2))

    async def get_number_v2(self, service: str, country: str, operator: str, max_price: float | None = None):
        params = {"service": service, "country": country, "operator": operator}
        if max_price is not None:
            params["maxPrice"] = max_price
        try:
            value = json.loads(await self.request("getNumberV2", **params))
            return TemporaActivation(str(value["activationId"]), str(value["phoneNumber"])), float(value["activationCost"])
        except TemporaError as exc:
            if exc.code not in ("BAD_ACTION", "UNDER_DEVELOPMENT"):
                raise
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            pass
        activation = await self.get_number(service, country, operator, max_price)
        return activation, float(max_price or 0)

    async def get_status(self, order_id: str):
        body = await self.request("getStatus", id=order_id)
        if body.startswith("STATUS_OK:"):
            return "completed", body.split(":", 1)[1]
        if body.startswith("STATUS_WAIT"):
            return "waiting", None
        if body == "STATUS_CANCEL":
            return "cancelled", None
        raise TemporaError(body)

    async def get_status_batch(self, order_ids: list[str]) -> dict[str, str]:
        if not order_ids:
            return {}
        value = json.loads(await self.request("getStatusV2", id=",".join(order_ids)))
        if not isinstance(value, dict):
            raise TemporaError("ERROR")
        return {str(order_id): str(status) for order_id, status in value.items()}

    async def set_status(self, order_id: str, status: int):
        if status not in (3, 8):
            raise ValueError("status must be 3 or 8")
        return await self.request("setStatus", status=status, id=order_id)

    async def sync_operator(self, operator: str, countries=None, services=None) -> tuple[int, int]:
        if countries is None or services is None:
            # Some Tempora deployments expose global catalogues while others
            # require the operator on both endpoints.
            countries, services = await asyncio.gather(
                self.get_countries(operator), self.get_services(operator))
        stock_rows = []
        successful_price_calls = 0
        last_price_error = None
        for country_code in countries:
            try:
                value = await self.get_prices(operator, country_code)
                successful_price_calls += 1
                stock_rows.extend((country_code, *row) for row in self.parse_stock(value, country_code))
            except TemporaError as exc:
                last_price_error = exc
                continue
        stamp = utcnow()
        with transaction(immediate=True) as conn:
            for code, name in countries.items():
                conn.execute("""INSERT INTO server4_countries(operator_code,country_code,name,updated_at)
                  VALUES(?,?,?,?) ON CONFLICT(operator_code,country_code) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at""",
                  (operator, code, name, stamp))
            for code, name in services.items():
                conn.execute("""INSERT INTO server4_services(operator_code,service_code,name,updated_at)
                  VALUES(?,?,?,?) ON CONFLICT(operator_code,service_code) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at""",
                  (operator, code, name, stamp))
            if successful_price_calls:
                conn.execute("DELETE FROM server4_stock WHERE operator_code=?", (operator,))
                conn.execute("UPDATE server4_countries SET in_stock=0 WHERE operator_code=?", (operator,))
                conn.execute("UPDATE server4_services SET in_stock=0 WHERE operator_code=?", (operator,))
                for country_code, service_code, price, count in stock_rows:
                    conn.execute("""INSERT INTO server4_stock(operator_code,country_code,service_code,min_price,available_count,updated_at)
                      VALUES(?,?,?,?,?,?)""", (operator, country_code, service_code, price, count, stamp))
                    conn.execute("UPDATE server4_countries SET in_stock=1 WHERE operator_code=? AND country_code=?", (operator, country_code))
                    conn.execute("UPDATE server4_services SET in_stock=1 WHERE operator_code=? AND service_code=?", (operator, service_code))
        if countries and not successful_price_calls and last_price_error:
            raise last_price_error
        return len(countries), len(services)

    async def sync_all(self) -> tuple[int, int, int]:
        operators = await self.get_operators()
        countries_catalogue = services_catalogue = None
        try:
            countries_catalogue, services_catalogue = await asyncio.gather(
                self.get_countries(), self.get_services())
        except TemporaError as exc:
            if exc.code != "BAD_OPERATOR":
                raise
            # Provider requires operator-scoped catalogue calls. Each enabled
            # operator is fetched independently below.
        stamp = utcnow()
        with transaction(immediate=True) as conn:
            for code, name in operators.items():
                conn.execute("""INSERT INTO server4_operators(code,name,updated_at) VALUES(?,?,?)
                  ON CONFLICT(code) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at""",
                  (code, name, stamp))
            enabled = [row[0] for row in conn.execute("SELECT code FROM server4_operators WHERE enabled=1")]
        countries = services = 0
        for code in enabled:
            try:
                country_count, service_count = await self.sync_operator(code, countries_catalogue, services_catalogue)
                countries += country_count
                services += service_count
            except TemporaError as exc:
                if exc.code in ("BAD_OPERATOR", "UNDER_DEVELOPMENT"):
                    with transaction(immediate=True) as conn:
                        conn.execute("DELETE FROM server4_stock WHERE operator_code=?", (code,))
                        conn.execute("UPDATE server4_countries SET in_stock=0 WHERE operator_code=?", (code,))
                        conn.execute("UPDATE server4_services SET in_stock=0 WHERE operator_code=?", (code,))
                        if exc.code == "BAD_OPERATOR":
                            conn.execute("UPDATE server4_operators SET enabled=0,updated_at=? WHERE code=?", (utcnow(), code))
                    continue
                raise
        with transaction() as conn:
            conn.execute("UPDATE service_servers SET last_health=?,last_health_at=? WHERE server_no=4",
                         (f"catalogue_ok operators={len(operators)} countries={countries} services={services}", utcnow()))
        return len(operators), countries, services

    async def catalogue_loop(self, interval: float = 60) -> None:
        while True:
            cfg = self.config()
            target_url = cfg["api_url"] or ENDPOINT
            if cfg["service_enabled"] and cfg["api_enabled"] and cfg["api_key"] and not is_cooling_down(target_url):
                try:
                    await self.sync_all()
                except (TemporaError, aiohttp.ClientError, asyncio.TimeoutError, json.JSONDecodeError) as exc:
                    with transaction() as conn:
                        conn.execute("UPDATE service_servers SET last_health=?,last_health_at=? WHERE server_no=4",
                                     (f"catalogue_error {type(exc).__name__}: {exc}", utcnow()))
            await asyncio.sleep(max(30, interval))

client = TemporaClient()
