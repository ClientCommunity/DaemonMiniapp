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

        raw_status = row["status"]
        amount = int(row["amount"])
        uid = int(row["user_id"])

        user_row = conn.execute("SELECT balance FROM users WHERE user_id = ?", (uid,)).fetchone()
        new_bal = int(user_row["balance"] or 0) if user_row else 0

    is_verified = raw_status in ("success", "approved", "verified")
    return {
        "reference": ref,
        "status": "approved" if raw_status == "success" else raw_status,
        "raw_status": raw_status,
        "verified": is_verified,
        "amount": amount,
        "new_balance": new_bal,
    }


def get_manual_methods() -> dict[str, Any]:
    """Return enabled manual deposit methods and active merchant UPI."""
    with connect() as conn:
        rows = conn.execute("SELECT id, name, caption, qr_file_id FROM custom_payments ORDER BY id ASC").fetchall()
        gw = conn.execute("SELECT upi_id FROM fampay_gateways WHERE enabled = 1 LIMIT 1").fetchone()
        setting_upi = conn.execute("SELECT value FROM settings WHERE key = 'fampay_upi_id'").fetchone()

    merchant_upi = ""
    if gw and gw["upi_id"]:
        merchant_upi = str(gw["upi_id"]).strip()
    elif setting_upi and setting_upi["value"]:
        merchant_upi = str(setting_upi["value"]).strip()

    return {
        "methods": [
            {
                "id": r["id"],
                "name": r["name"],
                "caption": r["caption"],
                "qr_url": r["qr_file_id"] or ""
            }
            for r in rows
        ],
        "merchant_upi": merchant_upi,
    }


def notify_admins_manual_deposit(order_db_id: int, user_id: int, amount: int, method_id: int | str, utr: str) -> None:
    """Send immediate notification to Telegram admins and log channel with inline Accept/Reject buttons."""
    import html
    import json
    import os
    import urllib.request
    import config

    bot_token = config.BOT_TOKEN
    if not bot_token:
        return

    order_key = f"M{order_db_id}"
    caption = (
        f"📥 <b>NEW MANUAL PROOF RECEIVED (Mini App / Web)</b>\n\n"
        f"User: <code>{user_id}</code>\n"
        f"Amount Requested: <b>₹{amount}</b>\n"
        f"UTR / Ref: <code>{html.escape(utr)}</code>\n"
        f"Method: <b>Manual #{method_id}</b>\n"
        f"Transaction Key: <code>{order_key}</code>"
    )

    reply_markup = {
        "inline_keyboard": [
            [
                {"text": "✅ Accept", "callback_data": f"dep_act|man|app|{order_key}|{user_id}|{amount}"},
                {"text": "❌ Reject", "callback_data": f"dep_act|man|rej|{order_key}|{user_id}|{amount}"}
            ],
            [
                {"text": "✏️ Custom Amount", "callback_data": f"dep_act|man|custom|{order_key}|{user_id}|{amount}"}
            ]
        ]
    }

    target_chats = list(config.MASTER_ADMIN_IDS)
    try:
        admin_log_channel = int(os.getenv("ADMIN_LOG_CHANNEL_ID", "-1003970256704"))
        target_chats.append(admin_log_channel)
    except Exception:
        pass

    for chat_id in set(target_chats):
        try:
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": caption,
                "parse_mode": "HTML",
                "reply_markup": reply_markup,
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            urllib.request.urlopen(req, timeout=5)
        except Exception as exc:
            logger.warning("Failed to notify Telegram admin %s: %s", chat_id, exc)


def submit_manual_deposit(user_id: int, method_id: int | str, utr: str, amount: int = 0) -> dict[str, Any]:
    """Submit a manual deposit UTR for administrator review."""
    uid = int(user_id)
    clean_utr = str(utr).strip()
    if not clean_utr:
        return {"success": False, "error": "Transaction UTR / Reference ID is required."}

    amt = max(0, int(amount))
    method_label = f"Manual #{method_id} (UTR: {clean_utr})"

    order_db_id = 0
    with transaction(immediate=True) as conn:
        conn.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (uid,))
        cur = conn.execute("""
            INSERT INTO deposits (user_id, amount, method_name, status, date)
            VALUES (?, ?, ?, 'pending', ?)
        """, (uid, amt, method_label, utcnow()))
        order_db_id = cur.lastrowid

    # Dispatch Telegram notification to admins and log channel
    if order_db_id:
        notify_admins_manual_deposit(order_db_id, uid, amt, method_id, clean_utr)

    return {
        "success": True,
        "message": "Deposit submitted successfully. Balance will be updated after verification.",
    }
