"""Automatic OTP polling, timeout cancellation, and exactly-once refunds."""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

from database import connect, transaction, utcnow
from api_cooldown import is_cooling_down
from server3 import DEFAULT_ENDPOINT as SERVER3_DEFAULT_ENDPOINT, DGOTPError, client as server3_client
from server4 import ENDPOINT as SERVER4_DEFAULT_ENDPOINT, TemporaError, client as server4_client

logger = logging.getLogger(__name__)
ACTIVATION_TTL = max(300, int(os.getenv("PROVIDER_ACTIVATION_TTL", "1200")))
CANCEL_DELAY = max(0, int(os.getenv("PROVIDER_CANCEL_DELAY", "120")))


def expiry_timestamp(created: datetime | None = None) -> str:
    return ((created or datetime.now(timezone.utc)) + timedelta(seconds=ACTIVATION_TTL)).isoformat()


def cancellation_wait(created_at: str, now: datetime | None = None) -> int:
    """Return seconds before a user may request cancellation.

    Many activation providers reject an immediate cancellation.  Keeping this
    configurable avoids repeatedly calling the upstream API while still making
    the remaining wait explicit to the customer.
    """
    created = datetime.fromisoformat(created_at)
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    elapsed = ((now or datetime.now(timezone.utc)) - created).total_seconds()
    return max(0, int(CANCEL_DELAY - elapsed + 0.999))


def complete_order(table: str, order_id: str, code: str) -> dict | None:
    with transaction(immediate=True) as conn:
        row = conn.execute(f"SELECT user_id FROM {table} WHERE provider_order_id=? AND status='waiting'", (order_id,)).fetchone()
        if not row:
            return None
        conn.execute(f"UPDATE {table} SET status='completed',sms_code=?,updated_at=? WHERE provider_order_id=? AND status='waiting'",
                     (code, utcnow(), order_id))
        return {"user_id": row["user_id"], "order_id": order_id, "code": code}


def cancel_and_refund(table: str, order_id: str, reason: str) -> dict | None:
    """Refund only once after the provider confirms cancellation."""
    with transaction(immediate=True) as conn:
        row = conn.execute(f"SELECT user_id,charged_price,refunded FROM {table} WHERE provider_order_id=?", (order_id,)).fetchone()
        if not row:
            return None
        changed = conn.execute(f"""UPDATE {table} SET status='cancelled',refunded=1,updated_at=?
          WHERE provider_order_id=? AND status='waiting' AND refunded=0""", (utcnow(), order_id)).rowcount
        if not changed:
            return None
        conn.execute("UPDATE users SET balance=balance+? WHERE user_id=?", (row["charged_price"], row["user_id"]))
        return {"user_id": row["user_id"], "order_id": order_id, "amount": row["charged_price"], "reason": reason}


class ProviderOrderManager:
    def __init__(self, notify=None, interval: float = 5):
        self.notify, self.interval = notify, interval
        self._task = None

    def start(self):
        if not self._task:
            self._task = asyncio.create_task(self._loop(), name="provider-order-manager")

    async def _emit(self, event: str, payload: dict | None):
        if payload and self.notify:
            await self.notify(event, payload)

    async def _poll_server3(self, rows):
        if not rows:
            return
        cfg = server3_client._config()
        endpoint = cfg["api_url"] or SERVER3_DEFAULT_ENDPOINT
        if is_cooling_down(endpoint):
            return
        for row in rows:
            try:
                status, code = await server3_client.get_status(row["provider_order_id"])
                if code:
                    await self._emit("completed", complete_order("server3_orders", row["provider_order_id"], code))
                elif status == "cancelled":
                    await self._emit("refunded", cancel_and_refund("server3_orders", row["provider_order_id"], "provider_cancelled"))
            except DGOTPError:
                if is_cooling_down(endpoint):
                    break
                continue

    async def _poll_server4(self, rows):
        if not rows:
            return
        cfg = server4_client.config()
        endpoint = cfg["api_url"] or SERVER4_DEFAULT_ENDPOINT
        if is_cooling_down(endpoint):
            return
        ids = [row["provider_order_id"] for row in rows]
        try:
            statuses = await server4_client.get_status_batch(ids)
        except TemporaError:
            statuses = {}
        for row in rows:
            raw = statuses.get(row["provider_order_id"], "")
            if raw.startswith("STATUS_OK:"):
                await self._emit("completed", complete_order("server4_orders", row["provider_order_id"], raw.split(":", 1)[1]))
            elif raw == "STATUS_CANCEL":
                await self._emit("refunded", cancel_and_refund("server4_orders", row["provider_order_id"], "provider_cancelled"))

    async def _expire(self, table: str, rows, cancel):
        now = datetime.now(timezone.utc)
        for row in rows:
            with connect() as conn:
                current = conn.execute(f"SELECT status FROM {table} WHERE provider_order_id=?", (row["provider_order_id"],)).fetchone()
            if not current or current["status"] != "waiting":
                continue
            expires = datetime.fromisoformat(row["expires_at"]) if row["expires_at"] else datetime.fromisoformat(row["created_at"]) + timedelta(seconds=ACTIVATION_TTL)
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            if expires > now:
                continue
            try:
                response = await cancel(row["provider_order_id"], 8)
                if response in ("ACCESS_CANCEL", "ACCESS_CANCEL_ALREADY", "STATUS_CANCEL"):
                    await self._emit("refunded", cancel_and_refund(table, row["provider_order_id"], "otp_timeout"))
            except (DGOTPError, TemporaError):
                logger.warning("Provider cancellation retry pending: %s %s", table, row["provider_order_id"])

    async def _loop(self):
        while True:
            try:
                with connect() as conn:
                    s3 = conn.execute("SELECT * FROM server3_orders WHERE status='waiting'").fetchall()
                    s4 = conn.execute("SELECT * FROM server4_orders WHERE status='waiting'").fetchall()
                await asyncio.gather(self._poll_server3(s3), self._poll_server4(s4))
                await self._expire("server3_orders", s3, server3_client.set_status)
                await self._expire("server4_orders", s4, server4_client.set_status)
            except Exception:
                logger.exception("Provider order supervisor recovered from an error")
            await asyncio.sleep(self.interval)
