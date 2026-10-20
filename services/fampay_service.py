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


def check_imap_for_utr(gmail: str, app_password: str, utr_to_find: str, expected_amt: int) -> bool:
    """Connect to Gmail over IMAP SSL, search for exact UTR, and verify amount."""
    import imaplib
    import email
    import re
    clean_utr = str(utr_to_find).strip()
    if not clean_utr or len(clean_utr) < 6:
        return False

    mail = None
    try:
        clean_pw = app_password.replace(" ", "")
        mail = imaplib.IMAP4_SSL("imap.gmail.com", 993)
        mail.login(gmail, clean_pw)
        mail.select("INBOX", readonly=True)

        status, messages = mail.search(None, f'(TEXT "{clean_utr}")')
        if status != "OK" or not messages or not messages[0]:
            status, all_msg = mail.search(None, "ALL")
            if status == "OK" and all_msg and all_msg[0]:
                msg_ids = all_msg[0].split()[-15:]
            else:
                msg_ids = []
        else:
            msg_ids = messages[0].split()[-10:]

        for mid in reversed(msg_ids):
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

            clean_text = re.sub(r"<[^>]+>", " ", body)
            if clean_utr in clean_text:
                if expected_amt <= 0:
                    return True
                amt_str = str(expected_amt)
                amt_pattern = rf"(?:received|credited|rs\.?|inr|₹|\?)\s*{expected_amt}(?:\.0+)?\b"
                if re.search(amt_pattern, clean_text, re.IGNORECASE) or amt_str in clean_text:
                    return True
    except Exception as exc:
        logger.warning("Gmail IMAP UTR check error for %s: %s", gmail, exc)
    finally:
        if mail:
            try:
                mail.close()
                mail.logout()
            except Exception:
                pass
    return False


def notify_admins_auto_verified(order_db_id: int, user_id: int, amount: int, utr: str) -> None:
    """Send immediate notification to Telegram admins that payment was auto-verified by UTR."""
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
        f"⚡ <b>INSTANT AUTO-VERIFIED BY UTR (Mini App / Web)</b>\n\n"
        f"User: <code>{user_id}</code>\n"
        f"Amount Credited: <b>₹{amount}</b>\n"
        f"UTR / Ref: <code>{html.escape(utr)}</code>\n"
        f"Status: <b>Verified via Gmail IMAP & Credited ✅</b>\n"
        f"Transaction Key: <code>{order_key}</code>"
    )

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
    """Submit a manual deposit UTR with instant Gmail IMAP auto-verification and admin fallback."""
    uid = int(user_id)
    clean_utr = str(utr).strip()
    if not clean_utr:
        return {"success": False, "error": "Transaction UTR / Reference ID is required."}

    amt = max(0, int(amount))
    method_label = f"Manual #{method_id} (UTR: {clean_utr})"

    # 1. Anti-Replay / Duplicate UTR check
    with connect() as conn:
        already_credited = conn.execute("""
            SELECT id FROM deposits
            WHERE status IN ('success', 'approved')
              AND method_name LIKE ?
        """, (f"%{clean_utr}%",)).fetchone()
        if already_credited:
            return {
                "success": False,
                "error": "This transaction reference / UTR has already been verified and credited."
            }

        # Anti-Duplication: check if already submitted and pending review
        already_pending = conn.execute("""
            SELECT id FROM deposits
            WHERE status = 'pending'
              AND method_name LIKE ?
        """, (f"%{clean_utr}%",)).fetchone()
        if already_pending:
            logger.info("Duplicate pending deposit submission suppressed for user %s: %s", uid, clean_utr)
            return {
                "success": True,
                "auto_verified": False,
                "status": "pending",
                "message": "Deposit reference already received and pending admin review.",
                "deposit_id": already_pending["id"]
            }

    # 2. Check enabled UPI Gateway with Gmail credentials
    verified_via_imap = False
    with connect() as conn:
        gw = conn.execute("""
            SELECT gmail, app_password
            FROM fampay_gateways
            WHERE enabled = 1 AND gmail IS NOT NULL AND app_password IS NOT NULL
            LIMIT 1
        """).fetchone()

    if gw and gw["gmail"] and gw["app_password"]:
        try:
            from secrets_manager import decrypt_secret
            raw_pw = gw["app_password"]
            clean_pw = decrypt_secret(raw_pw[4:]) if raw_pw.startswith("enc:") else raw_pw
            verified_via_imap = check_imap_for_utr(gw["gmail"], clean_pw, clean_utr, amt)
        except Exception as ex:
            logger.warning("IMAP UTR verification failed: %s", ex)

    # 3. If verified via IMAP: credit instantly!
    if verified_via_imap:
        order_db_id = 0
        with transaction(immediate=True) as conn:
            conn.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (uid,))
            conn.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (amt, uid))
            cur = conn.execute("""
                INSERT INTO deposits (user_id, amount, method_name, status, date)
                VALUES (?, ?, ?, 'success', ?)
            """, (uid, amt, f"UPI Auto-Verified (UTR: {clean_utr})", utcnow()))
            order_db_id = cur.lastrowid

        if order_db_id:
            notify_admins_auto_verified(order_db_id, uid, amt, clean_utr)

        return {
            "success": True,
            "auto_verified": True,
            "status": "approved",
            "message": f"Payment of ₹{amt} verified automatically via UTR! Your balance has been credited.",
        }

    # 4. Fallback: Queue for manual admin approval
    order_db_id = 0
    with transaction(immediate=True) as conn:
        conn.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (uid,))
        cur = conn.execute("""
            INSERT INTO deposits (user_id, amount, method_name, status, date)
            VALUES (?, ?, ?, 'pending', ?)
        """, (uid, amt, method_label, utcnow()))
        order_db_id = cur.lastrowid

    if order_db_id:
        notify_admins_manual_deposit(order_db_id, uid, amt, method_id, clean_utr)

    return {
        "success": True,
        "auto_verified": False,
        "status": "pending",
        "message": "Deposit submitted successfully. Balance will be updated after verification.",
    }
