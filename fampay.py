"""Safe FamPay-purpose deposit verification and exactly-once wallet crediting."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl

import aiohttp

from database import connect, transaction, utcnow

VERIFY_URL = os.getenv("FAMPAY_VERIFY_URL", "https://growfan.in/api/api.php/").strip()
VERIFY_TIMEOUT = max(3, float(os.getenv("FAMPAY_VERIFY_TIMEOUT", "15")))
ORDER_TTL = max(120, int(os.getenv("FAMPAY_ORDER_TTL", "300")))


class FamPayError(RuntimeError):
    pass


@dataclass(frozen=True)
class Verification:
    verified: bool
    amount: int | None
    transaction_id: str | None
    raw: str


def expiry_timestamp() -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=ORDER_TTL)).isoformat()


def _verification_url(reference: str) -> str:
    parts = urlsplit(VERIFY_URL)
    if parts.scheme != "https" or not parts.netloc:
        raise FamPayError("FAMPAY_VERIFY_URL must be a valid HTTPS URL")
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["purpose"] = reference
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def _parse_response(payload) -> Verification:
    if not isinstance(payload, dict):
        raise FamPayError("verification gateway returned invalid JSON")
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    status = str(payload.get("status", data.get("status", ""))).strip().casefold()
    verified = status in {"verified", "success", "paid", "completed"}
    amount = None
    if verified:
        try:
            value = Decimal(str(data.get("amount", payload.get("amount"))))
            if value != value.to_integral_value() or value <= 0:
                raise InvalidOperation
            amount = int(value)
        except (InvalidOperation, TypeError, ValueError):
            raise FamPayError("verified response has an invalid amount")
    transaction_id = next((str(data.get(key)).strip() for key in
                           ("transaction_id", "txn_id", "utr", "id")
                           if data.get(key)), None)
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))[:4000]
    return Verification(verified, amount, transaction_id, raw)


async def verify(reference: str) -> Verification:
    timeout = aiohttp.ClientTimeout(total=VERIFY_TIMEOUT)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(_verification_url(reference), headers={"Accept": "application/json"}) as response:
                text = await response.text()
                if response.status != 200:
                    raise FamPayError(f"verification gateway HTTP {response.status}")
    except (aiohttp.ClientError, TimeoutError) as exc:
        raise FamPayError("verification gateway unavailable") from exc
    try:
        return _parse_response(json.loads(text))
    except json.JSONDecodeError as exc:
        raise FamPayError("verification gateway returned invalid JSON") from exc


def credit(reference: str, verification: Verification) -> dict | None:
    """Atomically credit a matching pending order once."""
    if not verification.verified:
        return None
    with transaction(immediate=True) as conn:
        row = conn.execute("""SELECT user_id,amount,status,expires_at FROM fampay_orders
          WHERE reference=?""", (reference,)).fetchone()
        if not row or row["status"] != "pending":
            return None
        expires = datetime.fromisoformat(row["expires_at"])
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires <= datetime.now(timezone.utc):
            conn.execute("UPDATE fampay_orders SET status='expired',updated_at=? WHERE reference=? AND status='pending'",
                         (utcnow(), reference))
            return None
        if verification.amount != row["amount"]:
            conn.execute("UPDATE fampay_orders SET last_response=?,last_checked_at=?,updated_at=? WHERE reference=?",
                         (verification.raw, utcnow(), utcnow(), reference))
            raise FamPayError("verified amount does not match the reserved amount")
        if verification.transaction_id:
            duplicate = conn.execute("SELECT 1 FROM fampay_orders WHERE transaction_id=? AND reference<>?",
                                     (verification.transaction_id, reference)).fetchone()
            if duplicate:
                raise FamPayError("transaction identifier was already processed")
        changed = conn.execute("""UPDATE fampay_orders SET status='success',transaction_id=?,
          last_response=?,last_checked_at=?,updated_at=? WHERE reference=? AND status='pending'""",
          (verification.transaction_id, verification.raw, utcnow(), utcnow(), reference)).rowcount
        if changed != 1:
            return None
        conn.execute("INSERT OR IGNORE INTO users(user_id) VALUES(?)", (row["user_id"],))
        conn.execute("UPDATE users SET balance=balance+?,total_deposited=total_deposited+? WHERE user_id=?",
                     (row["amount"], row["amount"], row["user_id"]))
        conn.execute("INSERT INTO deposits(user_id,amount,method_name,status) VALUES(?,?,?,'success')",
                     (row["user_id"], row["amount"], "FamPay Automatic"))
        return {"user_id": row["user_id"], "amount": row["amount"], "reference": reference,
                "transaction_id": verification.transaction_id}


def expire_pending() -> list[dict]:
    now = datetime.now(timezone.utc).isoformat()
    with transaction(immediate=True) as conn:
        rows = conn.execute("SELECT reference,user_id,check_count,qr_msg_id FROM fampay_orders WHERE status='pending' AND expires_at<=?", (now,)).fetchall()
        conn.execute("UPDATE fampay_orders SET status='expired',updated_at=? WHERE status='pending' AND expires_at<=?", (utcnow(), now))
        return [dict(row) for row in rows]


def approve_review(reference: str, admin_id: int) -> dict | None:
    """Approve one expired-payment appeal and credit it exactly once."""
    with transaction(immediate=True) as conn:
        row = conn.execute("""SELECT user_id,amount,review_utr FROM fampay_orders
          WHERE reference=? AND status='expired' AND review_status='pending'""", (reference,)).fetchone()
        if not row:
            return None
        if row["review_utr"]:
            duplicate = conn.execute("SELECT 1 FROM fampay_orders WHERE transaction_id=? AND reference<>?",
                                     (row["review_utr"], reference)).fetchone()
            if duplicate:
                raise FamPayError("review UTR/transaction ID is already used")
        changed = conn.execute("""UPDATE fampay_orders SET status='success',review_status='approved',
          transaction_id=review_utr,reviewed_by=?,reviewed_at=?,updated_at=?
          WHERE reference=? AND status='expired' AND review_status='pending'""",
          (admin_id, utcnow(), utcnow(), reference)).rowcount
        if changed != 1:
            return None
        conn.execute("UPDATE users SET balance=balance+?,total_deposited=total_deposited+? WHERE user_id=?",
                     (row["amount"], row["amount"], row["user_id"]))
        conn.execute("INSERT INTO deposits(user_id,amount,method_name,status) VALUES(?,?,?,'success')",
                     (row["user_id"], row["amount"], "FamPay Manual Review"))
        return {"user_id": row["user_id"], "amount": row["amount"], "reference": reference}


def reject_review(reference: str, admin_id: int) -> dict | None:
    with transaction(immediate=True) as conn:
        row = conn.execute("SELECT user_id FROM fampay_orders WHERE reference=? AND review_status='pending'", (reference,)).fetchone()
        if not row:
            return None
        conn.execute("""UPDATE fampay_orders SET review_status='rejected',reviewed_by=?,reviewed_at=?,updated_at=?
          WHERE reference=? AND review_status='pending'""", (admin_id, utcnow(), utcnow(), reference))
        return {"user_id": row["user_id"], "reference": reference}
