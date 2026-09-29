"""Reusable management/client layer for independently configured Server 3/4."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass

import aiohttp

from database import connect, transaction, utcnow


@dataclass
class ServerConfig:
    server_no: int
    display_name: str
    service_enabled: bool
    api_enabled: bool
    api_url: str
    api_key: str
    percent_markup: float
    fixed_markup: float
    priority: int
    minimum_price: float
    maximum_price: float
    retry_count: int
    timeout_seconds: float


class ManagedServer:
    def __init__(self, server_no: int):
        if server_no not in (3, 4):
            raise ValueError("server number must be 3 or 4")
        self.server_no = server_no

    def config(self) -> ServerConfig:
        with connect() as conn:
            row = conn.execute("SELECT * FROM service_servers WHERE server_no=?", (self.server_no,)).fetchone()
        return ServerConfig(**{name: row[name] for name in ServerConfig.__annotations__})

    def update(self, **values) -> None:
        allowed = set(ServerConfig.__annotations__) - {"server_no"}
        if not values or set(values) - allowed:
            raise ValueError("invalid server setting")
        assignments = ",".join(f"{key}=?" for key in values)
        with transaction() as conn:
            conn.execute(f"UPDATE service_servers SET {assignments} WHERE server_no=?", (*values.values(), self.server_no))

    async def health_check(self) -> tuple[bool, str]:
        config = self.config()
        if not config.api_enabled or not config.api_url:
            return False, "API disabled or URL missing"
        headers = {"Authorization": f"Bearer {config.api_key}"} if config.api_key else {}
        error = "unknown"
        for attempt in range(config.retry_count + 1):
            try:
                timeout = aiohttp.ClientTimeout(total=config.timeout_seconds)
                async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
                    async with session.get(config.api_url) as response:
                        ok, error = response.status < 400, f"HTTP {response.status}"
                        if ok:
                            break
            except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                ok, error = False, type(exc).__name__
            if attempt < config.retry_count:
                await asyncio.sleep(min(2 ** attempt, 5))
        with transaction() as conn:
            conn.execute("""UPDATE service_servers SET last_health=?,last_health_at=?,requests=requests+1,
              successes=successes+?,failures=failures+? WHERE server_no=?""",
              ("healthy" if ok else error, utcnow(), int(ok), int(not ok), self.server_no))
        return ok, error


server3 = ManagedServer(3)
server4 = ManagedServer(4)
