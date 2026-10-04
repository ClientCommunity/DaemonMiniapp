"""Safe FamPay-purpose deposit verification and exactly-once wallet crediting."""
from __future__ import annotations

import asyncio
import email
from email.header import decode_header
import imaplib
import json
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl

import aiohttp

from database import connect, transaction, utcnow
from api_cooldown import is_cooling_down, record_rate_limit

logger = logging.getLogger(__name__)

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


def _check_imap_sync(gmail: str, app_password: str, reference: str, expected_amount: int) -> Verification:
    """Connect via IMAP SSL to Gmail, search for FamPay/UPI credit emails matching reference and amount."""
    mail = None
    try:
        clean_pw = app_password.replace(" ", "")
        mail = imaplib.IMAP4_SSL("imap.gmail.com", 993)
        mail.login(gmail, clean_pw)
        mail.select("INBOX", readonly=True)

        ref_upper = reference.upper()
        # Search directly for reference string
        status, messages = mail.search(None, f'(TEXT "{ref_upper}")')
        msg_ids = messages[0].split() if (status == "OK" and messages and messages[0]) else []

        if not msg_ids:
            # Fallback: scan recent 25 messages
            status, all_messages = mail.search(None, 'ALL')
            if status == "OK" and all_messages and all_messages[0]:
                msg_ids = all_messages[0].split()[-25:]

        for mid in reversed(msg_ids[-25:]):
            res, data = mail.fetch(mid, "(RFC822)")
            if res != "OK" or not data or not data[0]:
                continue
            raw_email = data[0][1]
            if not isinstance(raw_email, (bytes, bytearray)):
                continue
            msg = email.message_from_bytes(raw_email)

            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    ctype = part.get_content_type()
                    cdispo = str(part.get("Content-Disposition"))
                    if ctype in ("text/plain", "text/html") and "attachment" not in cdispo:
                        payload = part.get_payload(decode=True)
                        if payload:
                            body += payload.decode(errors="ignore") + " "
            else:
                payload = msg.get_payload(decode=True)
                if payload:
                    body = payload.decode(errors="ignore")

            subject = ""
            raw_subj = msg.get("Subject", "")
            for decoded_str, charset in decode_header(raw_subj):
                if isinstance(decoded_str, bytes):
                    subject += decoded_str.decode(charset or "utf-8", errors="ignore")
                else:
                    subject += str(decoded_str)

            full_text = f"{subject}\n{body}"

            if ref_upper in full_text.upper():
                amt_str = str(expected_amount)
                if amt_str in full_text:
                    # Extract 12-digit UTR if present
                    utr_match = re.search(r"\b([0-9]{12})\b", full_text)
                    utr = utr_match.group(1) if utr_match else None
                    if not utr:
                        alt_match = re.search(r"\b(?:utr|txn|ref(?:erence)?)\s*(?:id|no\.?|num)?[:\s]+([A-Za-z0-9_-]{8,32})\b", full_text, re.IGNORECASE)
                        utr = alt_match.group(1) if alt_match else None

                    try:
                        mail.close()
                        mail.logout()
                    except Exception:
                        pass

                    return Verification(
                        verified=True,
                        amount=expected_amount,
                        transaction_id=utr or f"IMAP_{reference}",
                        raw=json.dumps({"subject": subject, "utr": utr, "matched_ref": reference})
                    )
    except Exception as exc:
        logger.warning("FamPay Gmail IMAP check error for %s: %s", gmail, exc)
        return Verification(verified=False, amount=None, transaction_id=None, raw=str(exc))
    finally:
        if mail:
            try:
                mail.close()
                mail.logout()
            except Exception:
                pass

    return Verification(verified=False, amount=None, transaction_id=None, raw="no_matching_email_found")


async def verify(reference: str) -> Verification:
    # 1. Primary: Verify via Gmail IMAP SSL using gateway credentials
    try:
        with connect() as conn:
            order = conn.execute("SELECT gateway_id, amount FROM fampay_orders WHERE reference=?", (reference,)).fetchone()
            if order:
                gid = order["gateway_id"]
                gw = None
                if gid:
                    gw = conn.execute("SELECT gmail, app_password FROM fampay_gateways WHERE id=?", (gid,)).fetchone()
                if not gw or not gw["gmail"] or not gw["app_password"]:
                    gw = conn.execute("SELECT gmail, app_password FROM fampay_gateways WHERE enabled=1 AND gmail IS NOT NULL AND app_password IS NOT NULL LIMIT 1").fetchone()

                if gw and gw["gmail"] and gw["app_password"]:
                    from secrets_manager import decrypt_secret
                    stored_pw = gw["app_password"]
                    app_pw = decrypt_secret(stored_pw[4:]) if stored_pw.startswith("enc:") else stored_pw
                    imap_verif = await asyncio.to_thread(_check_imap_sync, gw["gmail"], app_pw, reference, int(order["amount"]))
                    if imap_verif.verified:
                        return imap_verif
    except Exception as exc:
        logger.warning("FamPay IMAP verification attempt failed for %s: %s", reference, exc)

    # 2. Secondary fallback: HTTP verification if configured and not default growfan stub
    if VERIFY_URL and "growfan.in" not in VERIFY_URL:
        if is_cooling_down(VERIFY_URL):
            return Verification(verified=False, amount=None, transaction_id=None, raw="cooldown_rate_limited")
        timeout = aiohttp.ClientTimeout(total=VERIFY_TIMEOUT)
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(_verification_url(reference), headers={"Accept": "application/json"}) as response:
                    if response.status == 429:
                        record_rate_limit(VERIFY_URL, 10.0, reason="HTTP 429")
                        return Verification(verified=False, amount=None, transaction_id=None, raw="rate_limited")
                    text = await response.text()
                    if response.status == 200:
                        return _parse_response(json.loads(text))
        except Exception as exc:
            logger.warning("FamPay HTTP fallback failed for %s: %s", reference, exc)

    return Verification(verified=False, amount=None, transaction_id=None, raw="pending")


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
