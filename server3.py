"""DGOTP Server 3 API client, catalogue synchronizer, and response parser.

This module intentionally contains all provider-specific behavior.  The bot UI
only consumes normalized models, so endpoint or response changes stay isolated.
"""
from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass
from typing import Any

import aiohttp

from database import connect, transaction, utcnow
from secrets_manager import decrypt_secret
from api_cooldown import check_cooldown, is_cooling_down, record_rate_limit, get_cooldown_remaining

DEFAULT_ENDPOINT = "https://dgotp.in/stubs/handler_api.php"

# Human-friendly labels and search keywords for common provider codes. Unknown
# codes remain available under their exact DGOTP service code.
SERVICE_CATALOG = {
    "tg": ("Telegram", "telegram tg otp account"),
    "wa": ("WhatsApp", "whatsapp wa otp account"),
    "wb": ("WhatsApp", "whatsapp wa wb otp account"),
    "go": ("Google / Gmail", "google gmail go email"),
    "fb": ("Facebook", "facebook fb meta"),
    "ig": ("Instagram", "instagram ig meta"),
    "tw": ("Twitter / X", "twitter x tw"),
    "tk": ("TikTok", "tiktok tik tok tk"),
    "hn": ("Hinge", "hinge hn dating"),
    "1688": ("1688", "1688 alibaba shopping"),
}


def service_metadata(code: str, supplied_name: str | None = None) -> tuple[str, str]:
    known_name, keywords = SERVICE_CATALOG.get(str(code).casefold(), (str(code), str(code)))
    name = str(supplied_name or "").strip()
    if not name or name.casefold() == str(code).casefold():
        name = known_name
    return name, f"{keywords} {name} {code}".casefold()


class DGOTPError(RuntimeError):
    FRIENDLY = {
        "BAD_KEY": "The Server 3 API key is invalid.", "ERROR_SQL": "The provider database returned an error.",
        "NO_NUMBERS": "No numbers are currently available.", "NO_BALANCE": "The provider balance is insufficient.",
        "BAD_SERVICE": "The service is unavailable.", "BAD_SERVER": "The provider server is unavailable.",
        "NO_ACTIVATION": "This activation no longer exists.", "BAD_ID": "The provider order ID is invalid.",
        "BAD_STATUS": "The requested provider status is invalid.", "STATUS_CANCEL": "The activation was cancelled.",
        "HTTP_429": "Provider rate limit exceeded. Pausing requests for 10 seconds.",
        "TOO_MANY_REQUESTS": "Provider rate limit exceeded. Pausing requests for 10 seconds.",
        "RATE_LIMIT_COOLDOWN": "Provider is cooling down due to rate limit. Please wait 10 seconds.",
    }

    def __init__(self, code: str):
        self.code = code.strip()
        super().__init__(self.FRIENDLY.get(self.code, self.code))


@dataclass(frozen=True)
class Activation:
    order_id: str
    phone: str


class Server3Client:
    def _config(self):
        with connect() as conn:
            return conn.execute("SELECT * FROM service_servers WHERE server_no=3").fetchone()

    async def request(self, action: str, **params: Any) -> str:
        cfg = self._config()
        if not cfg["api_enabled"]:
            raise DGOTPError("API_DISABLED")
        if not cfg["api_key"]:
            raise DGOTPError("BAD_KEY")
        target_url = cfg["api_url"] or DEFAULT_ENDPOINT
        if is_cooling_down(target_url):
            raise DGOTPError("RATE_LIMIT_COOLDOWN")
        stored_key = cfg["api_key"]
        api_key = decrypt_secret(stored_key[4:]) if stored_key.startswith("enc:") else stored_key
        query = {"api_key": api_key, "action": action, **params}
        timeout = aiohttp.ClientTimeout(total=max(1, cfg["timeout_seconds"]))
        error: Exception | None = None
        for attempt in range(max(0, cfg["retry_count"]) + 1):
            if is_cooling_down(target_url):
                raise DGOTPError("RATE_LIMIT_COOLDOWN")
            try:
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.get(target_url, params=query) as response:
                        body = (await response.text()).strip()
                        if response.status == 429:
                            record_rate_limit(target_url, 10.0, reason="HTTP 429")
                            raise DGOTPError("HTTP_429")
                        if response.status >= 400:
                            raise DGOTPError(f"HTTP_{response.status}")
                        if body in ("TOO_MANY_REQUESTS", "RATE_LIMIT") or "rate limit" in body.lower():
                            record_rate_limit(target_url, 10.0, reason=body)
                            raise DGOTPError("TOO_MANY_REQUESTS")
                        if body in DGOTPError.FRIENDLY or body.startswith(("BAD_", "ERROR_", "NO_")):
                            raise DGOTPError(body)
                        return body
            except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                error = exc
                if attempt < cfg["retry_count"]:
                    await asyncio.sleep(min(2 ** attempt, 5))
        raise DGOTPError(type(error).__name__ if error else "NETWORK_ERROR")

    async def get_balance(self) -> float:
        body = await self.request("getBalance")
        match = re.fullmatch(r"ACCESS_BALANCE:([0-9]+(?:\.[0-9]+)?)", body)
        if not match:
            raise DGOTPError("INVALID_BALANCE_RESPONSE")
        return float(match.group(1))

    async def get_servers(self) -> dict[str, str]:
        body = await self.request("getServers")
        try:
            value = json.loads(body)
            if isinstance(value, dict):
                return {str(k): str(v) for k, v in value.items()}
            if isinstance(value, list):
                return {str(item.get("server_code") or item.get("id")): str(item.get("name")) for item in value}
        except json.JSONDecodeError:
            pass
        return {code: name.strip() for code, name in re.findall(r"(?m)^\s*([\w-]+)\s*:\s*([^\r\n]+)", body)}

    async def get_services(self) -> list[dict]:
        body = await self.request("getServices")
        try:
            value = json.loads(body)
        except json.JSONDecodeError as exc:
            raise DGOTPError("INVALID_SERVICES_RESPONSE") from exc
        if isinstance(value, dict):
            if "services" in value or "data" in value:
                value = value.get("services", value.get("data", []))
            else:
                # DGOTP currently returns {"service-code": [{variant}, ...]}.
                # Preserve the dictionary key when a variant omits its code.
                flattened = []
                for code, variants in value.items():
                    if isinstance(variants, dict):
                        variants = [variants]
                    if not isinstance(variants, list):
                        continue
                    for variant in variants:
                        if isinstance(variant, dict):
                            item = dict(variant)
                            item.setdefault("service_code", str(code))
                            item.setdefault("service_name", str(code))
                            flattened.append(item)
                value = flattened
        if not isinstance(value, list):
            raise DGOTPError("INVALID_SERVICES_RESPONSE")
        clean = []
        for item in value:
            try:
                price = float(item["price"])
                service = str(item["service_code"]).strip()
                server = str(item["server_code"]).strip()
            except (KeyError, TypeError, ValueError):
                continue
            if service and server and price > 0:
                name, keywords = service_metadata(service, item.get("service_name") or item.get("name"))
                clean.append({"service_code": service, "server_code": server, "price": price,
                              "name": name, "keywords": keywords})
        return clean

    async def get_number(self, service: str, server: str) -> Activation:
        body = await self.request("getNumber", service=service, server=server)
        match = re.fullmatch(r"ACCESS_NUMBER:([^:]+):(.+)", body)
        if not match:
            raise DGOTPError("INVALID_NUMBER_RESPONSE")
        return Activation(match.group(1), match.group(2))

    async def get_status(self, order_id: str) -> tuple[str, str | None]:
        body = await self.request("getStatus", id=order_id)
        if body.startswith("STATUS_OK:"):
            return "completed", body.split(":", 1)[1]
        if body in ("STATUS_WAIT_CODE", "STATUS_WAIT_RETRY", "STATUS_WAIT_RESEND"):
            return "waiting", None
        if body == "STATUS_CANCEL":
            return "cancelled", None
        raise DGOTPError(body)

    async def set_status(self, order_id: str, status: int) -> str:
        if status not in (3, 8):
            raise ValueError("status must be 3 (next SMS) or 8 (cancel)")
        try:
            return await self.request("setStatus", status=status, id=order_id)
        except DGOTPError as exc:
            # Some deployments return STATUS_CANCEL as a terminal state rather
            # than ACCESS_CANCEL.  It still confirms that refunding is safe.
            if status == 8 and exc.code == "STATUS_CANCEL":
                return "STATUS_CANCEL"
            raise

    async def sync_catalogue(self) -> tuple[int, int]:
        servers, services = await asyncio.gather(self.get_servers(), self.get_services())
        stamp = utcnow()
        stocked_servers = {item["server_code"] for item in services}
        with transaction(immediate=True) as conn:
            conn.execute("UPDATE server3_servers SET in_stock=0")
            conn.execute("UPDATE server3_services SET in_stock=0")
            for code, name in servers.items():
                conn.execute("""INSERT INTO server3_servers(code,name,in_stock,updated_at) VALUES(?,?,?,?)
                  ON CONFLICT(code) DO UPDATE SET name=excluded.name,in_stock=excluded.in_stock,updated_at=excluded.updated_at""",
                  (code, name, int(code in stocked_servers), stamp))
            for item in services:
                conn.execute("""INSERT INTO server3_services(service_code,server_code,name,keywords,provider_price,in_stock,updated_at)
                  VALUES(?,?,?,?,?,1,?) ON CONFLICT(service_code,server_code) DO UPDATE SET
                  name=excluded.name,keywords=excluded.keywords,provider_price=excluded.provider_price,
                  in_stock=1,updated_at=excluded.updated_at""",
                  (item["service_code"], item["server_code"], item["name"], item["keywords"], item["price"], stamp))
        return len(servers), len(services)

    async def catalogue_loop(self, interval: float = 60) -> None:
        """Continuously refresh stock without ever stopping the bot."""
        while True:
            cfg = self._config()
            target_url = cfg["api_url"] or DEFAULT_ENDPOINT
            if cfg["service_enabled"] and cfg["api_enabled"] and cfg["api_key"] and not is_cooling_down(target_url):
                try:
                    await self.sync_catalogue()
                except (DGOTPError, aiohttp.ClientError, asyncio.TimeoutError):
                    pass
            await asyncio.sleep(max(15, interval))


client = Server3Client()
