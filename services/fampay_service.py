"""Payment and deposit management service (FamPay UPI & Manual methods).

Supports multi-gateway load-balancing, dynamic UPI QR generation,
and pending payment verification.
"""
from __future__ import annotations

import logging
import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Any

from database import connect, transaction, utcnow

logger = logging.getLogger("services.fampay")


def create_fampay_checkout(user_id: int, amount: int) -> dict[str, Any]:
    """Create a new FamPay UPI checkout order with dynamic QR and deep link."""
    uid = int(user_id)
    deposit_amt = int(amount)
    if deposit_amt < 10:
        return {"success": False, "error": "Minimum deposit is ₹10."}

    reference = secrets.token_hex(6).upper()
    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()
    expires_iso = (now_dt + timedelta(minutes=15)).isoformat()

    with transaction(immediate=True) as conn:
        gw = conn.execute("""
            SELECT id, upi_id, name
            FROM fampay_gateways
            WHERE enabled = 1
            ORDER BY RANDOM()
            LIMIT 1
        """).fetchone()

        if not gw:
            return {
                "success": False,
                "code": "GATEWAY_OFFLINE",
                "error": "FamPay QR gateway is currently offline or unconfigured. Please use Manual UPI Deposit.",
            }

        upi_id = gw["upi_id"]
        payment_name = gw["name"] or "FamPay"
        gateway_id = gw["id"]

        conn.execute("""
            INSERT INTO fampay_orders (
                reference, user_id, amount, status, gateway_id,
                expires_at, created_at, updated_at
            ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)
        """, (reference, uid, deposit_amt, gateway_id, expires_iso, now_iso, now_iso))

    upi_query = urllib.parse.urlencode({
        "pa": upi_id,
        "pn": payment_name,
        "am": str(deposit_amt),
        "tn": reference,
        "cu": "INR",
    })
    upi_uri = f"upi://pay?{upi_query}"
    qr_url = "https://quickchart.io/qr?" + urllib.parse.urlencode({"text": upi_uri, "size": "400"})

    return {
        "success": True,
        "reference": reference,
        "amount": deposit_amt,
        "upi_id": upi_id,
        "upi_uri": upi_uri,
        "qr_url": qr_url,
        "expires_at": expires_iso,
    }


def check_fampay_order(reference: str) -> dict[str, Any]:
    """Check payment status for a FamPay reference order."""
    ref = (reference or "").strip().upper()
    if not ref:
        return {"status": "unknown"}

    with connect() as conn:
        row = conn.execute("""
            SELECT status, amount, user_id, expires_at
            FROM fampay_orders
            WHERE reference = ?
        """, (ref,)).fetchone()

        if not row:
            return {"status": "not_found"}

        status = row["status"]
        amount = int(row["amount"])
        uid = int(row["user_id"])

        user_row = conn.execute("SELECT balance FROM users WHERE user_id = ?", (uid,)).fetchone()
        new_bal = int(user_row["balance"] or 0) if user_row else 0

    return {
        "reference": ref,
        "status": status,
        "amount": amount,
        "new_balance": new_bal,
    }


def get_manual_methods() -> list[dict[str, Any]]:
    """Return enabled manual deposit methods."""
    with connect() as conn:
        rows = conn.execute("SELECT id, name, caption FROM custom_payments ORDER BY id ASC").fetchall()

    return [{"id": r["id"], "name": r["name"], "caption": r["caption"]} for r in rows]


def submit_manual_deposit(user_id: int, method_id: int | str, utr: str, amount: int = 0) -> dict[str, Any]:
    """Submit a manual deposit UTR for administrator review."""
    uid = int(user_id)
    clean_utr = str(utr).strip()
    if not clean_utr:
        return {"success": False, "error": "Transaction UTR / Reference ID is required."}

    amt = max(0, int(amount))
    method_label = f"Manual #{method_id} (UTR: {clean_utr})"

    with transaction(immediate=True) as conn:
        conn.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (uid,))
        conn.execute("""
            INSERT INTO deposits (user_id, amount, method_name, status, date)
            VALUES (?, ?, ?, 'pending', ?)
        """, (uid, amt, method_label, utcnow()))

    return {
        "success": True,
        "message": "Deposit submitted successfully. Balance will be updated after verification.",
    }
