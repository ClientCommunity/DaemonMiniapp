"""Telegram WebApp and Google OAuth authentication service.

Validates Telegram initData cryptographic HMAC signatures against bot token
and Google ID tokens against Google OAuth 2.0 API.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
import urllib.parse
import urllib.request
from urllib.parse import parse_qsl
from typing import Any

from config import BOT_TOKEN, GOOGLE_CLIENT_ID, ADMIN_PANEL_SECRET
from database import connect, get_user_balances

logger = logging.getLogger("services.auth")


def validate_telegram_init_data(init_data_raw: str, bot_token: str | None = None) -> dict[str, Any] | None:
    """Validate Telegram WebApp initData string using HMAC-SHA256 signature."""
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
            result = dict(parsed)
            result["user"] = user_data
            result["id"] = user_data.get("id")
            return result

        return parsed
    except Exception as ex:
        logger.debug("initData validation exception: %s", ex)
        return None


def verify_google_id_token(id_token: str) -> dict[str, Any] | None:
    """Verify Google OAuth 2.0 ID token using Google's tokeninfo endpoint.
    Zero external dependencies required.
    """
    if not id_token or not isinstance(id_token, str):
        return None

    try:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={urllib.parse.quote(id_token)}"
        req = urllib.request.Request(url, headers={"User-Agent": "DeamonOTPBot/1.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status != 200:
                return None
            data = json.loads(response.read().decode("utf-8"))

        # Verify audience matches our GOOGLE_CLIENT_ID if configured
        aud = data.get("aud")
        if GOOGLE_CLIENT_ID and aud != GOOGLE_CLIENT_ID:
            logger.warning("Google token audience mismatch: %s != %s", aud, GOOGLE_CLIENT_ID)
            return None

        # Verify issuer
        iss = data.get("iss")
        if iss not in ("accounts.google.com", "https://accounts.google.com"):
            logger.warning("Google token issuer mismatch: %s", iss)
            return None

        # Check expiration
        exp = int(data.get("exp", 0))
        if exp < int(time.time()):
            logger.warning("Google token has expired")
            return None

        return {
            "sub": str(data.get("sub", "")),
            "email": str(data.get("email", "")),
            "name": str(data.get("name", "")),
            "picture": str(data.get("picture", "")),
        }
    except Exception as exc:
        logger.error("Failed to verify Google ID token: %s", exc)
        return None


def get_current_user_id(request_obj) -> int | None:
    """Extract authenticated user_id from Telegram initData, Web JWT Bearer, or fallback."""
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

    # 2. Web User Session JWT (Bearer Token for Website Users)
    auth_header = request_obj.headers.get("Authorization", "").strip()
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        try:
            from api.admin import decode_jwt
            payload = decode_jwt(token, ADMIN_PANEL_SECRET)
            if payload and "user_id" in payload:
                return int(payload["user_id"])
        except Exception:
            pass

    # 3. Development / Testing / Internal fallback
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


def get_or_create_google_user(google_info: dict[str, Any]) -> dict[str, Any]:
    """Find existing user by google_id or email, or create new web user with 9B+ numeric user_id."""
    google_id = google_info["sub"]
    email = (google_info.get("email") or "").strip().lower()
    name = (google_info.get("name") or "").strip()
    avatar_url = (google_info.get("picture") or "").strip()

    with connect() as conn:
        # Check if user exists by google_id
        row = conn.execute(
            "SELECT user_id, email, name, avatar_url FROM users WHERE google_id = ?",
            (google_id,),
        ).fetchone()

        # Fallback to email match
        if not row and email:
            row = conn.execute(
                "SELECT user_id, email, name, avatar_url FROM users WHERE email = ?",
                (email,),
            ).fetchone()
            if row:
                conn.execute(
                    "UPDATE users SET google_id = ?, auth_provider = 'google', avatar_url = COALESCE(avatar_url, ?) WHERE user_id = ?",
                    (google_id, avatar_url, row["user_id"]),
                )

        if row:
            uid = row["user_id"]
            if avatar_url and not row["avatar_url"]:
                conn.execute("UPDATE users SET avatar_url = ? WHERE user_id = ?", (avatar_url, uid))
            if name and not row["name"]:
                conn.execute("UPDATE users SET name = ? WHERE user_id = ?", (name, uid))
        else:
            # Allocate next web user ID starting at 9,000,000,001 (above all Telegram IDs)
            max_row = conn.execute("SELECT MAX(user_id) FROM users WHERE user_id >= 9000000000").fetchone()
            uid = (int(max_row[0]) + 1) if (max_row and max_row[0]) else 9000000001

            conn.execute(
                "INSERT INTO users (user_id, email, google_id, auth_provider, name, avatar_url) VALUES (?, ?, ?, 'google', ?, ?)",
                (uid, email, google_id, name, avatar_url),
            )

    return get_or_create_user(uid)


def get_or_create_user(user_id: int) -> dict[str, Any]:
    """Ensure user exists in database and return comprehensive balance & profile."""
    uid = int(user_id)
    with connect() as conn:
        conn.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (uid,))
        row = conn.execute(
            "SELECT pref_curr, referred_by, total_deposited, reseller_token, email, name, avatar_url, auth_provider FROM users WHERE user_id = ?",
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
        "email": row["email"] if row and "email" in row.keys() else None,
        "name": row["name"] if row and "name" in row.keys() else None,
        "avatar_url": row["avatar_url"] if row and "avatar_url" in row.keys() else None,
        "auth_provider": row["auth_provider"] if row and "auth_provider" in row.keys() else "telegram",
    }

