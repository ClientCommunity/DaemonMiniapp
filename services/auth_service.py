"""Telegram WebApp authentication and session verification service.

Validates Telegram initData cryptographic HMAC signatures against bot token
per official Telegram WebApp specifications.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
from urllib.parse import parse_qsl
from typing import Any

from config import BOT_TOKEN
from database import connect, get_user_balances

logger = logging.getLogger("services.auth")


def validate_telegram_init_data(init_data_raw: str, bot_token: str | None = None) -> dict[str, Any] | None:
    """Validate Telegram WebApp initData string using HMAC-SHA256 signature.
    
    Formula:
    secret_key = HMAC_SHA256("WebAppData", bot_token)
    data_check_string = sorted key=value pairs separated by \n (excluding 'hash')
    signature = HMAC_SHA256(secret_key, data_check_string).hexdigest()
    """
    if not init_data_raw or not isinstance(init_data_raw, str):
        return None

    token = bot_token or BOT_TOKEN
    if not token:
        logger.error("Telegram bot token not configured for initData validation.")
        return None

    try:
        parsed = dict(parse_qsl(init_data_raw, keep_blank_values=True))
        received_hash = parsed.pop("hash", None)
        if not received_hash:
            return None

        # Build data_check_string from sorted pairs
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))

        # Secret key is HMAC-SHA256 of bot token with key "WebAppData"
        secret_key = hmac.new(b"WebAppData", token.encode("utf-8"), hashlib.sha256).digest()
        computed_hash = hmac.new(
            secret_key, data_check_string.encode("utf-8"), hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(computed_hash, received_hash):
            logger.debug("initData HMAC verification failed: mismatch")
            return None

        user_json = parsed.get("user")
        if user_json:
            user_data = json.loads(user_json)
            # Combine parsed query parameters with parsed user payload
            result = dict(parsed)
            result["user"] = user_data
            result["id"] = user_data.get("id")
            return result

        return parsed
    except Exception as ex:
        logger.debug("initData validation exception: %s", ex)
        return None


def get_current_user_id(request_obj) -> int | None:
    """Extract authenticated user_id from Telegram initData header or fallback."""
    # 1. Primary: Telegram WebApp Init Data
    init_data = (
        request_obj.headers.get("X-Telegram-Init-Data")
        or request_obj.args.get("initData")
    )
    if not init_data and request_obj.is_json:
        try:
            body = request_obj.get_json(silent=True) or {}
            init_data = body.get("initData")
        except Exception:
            pass

    if init_data:
        validated = validate_telegram_init_data(init_data)
        if validated:
            if "id" in validated and validated["id"]:
                return int(validated["id"])
            if isinstance(validated.get("user"), dict) and "id" in validated["user"]:
                return int(validated["user"]["id"])

    # 2. Development / Testing / Internal fallback
    user_header = request_obj.headers.get("X-User-Id") or request_obj.args.get("user_id")
    if not user_header and request_obj.is_json:
        try:
            body = request_obj.get_json(silent=True) or {}
            user_header = body.get("user_id")
        except Exception:
            pass

    if user_header and str(user_header).isdigit():
        return int(user_header)

    return None


def get_or_create_user(user_id: int) -> dict[str, Any]:
    """Ensure user exists in database and return comprehensive balance & profile."""
    uid = int(user_id)
    with connect() as conn:
        conn.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (uid,))
        row = conn.execute(
            "SELECT pref_curr, referred_by, total_deposited, reseller_token FROM users WHERE user_id = ?",
            (uid,)
        ).fetchone()

    balances = get_user_balances(uid)
    pref_curr = row["pref_curr"] if row and row["pref_curr"] else "INR"

    return {
        "id": uid,
        "balance": balances["balance"],
        "promo_balance": balances["promo_balance"],
        "transferable_balance": balances["transferable_balance"],
        "sales_balance": balances["sales_balance"],
        "pref_curr": pref_curr,
        "referred_by": row["referred_by"] if row else None,
        "total_deposited": int(row["total_deposited"] or 0) if row else 0,
        "reseller_token": row["reseller_token"] if row else None,
    }
