"""Force-join channel configuration and verification service.

Dynamically loads force-join configuration from the SQLite settings table,
validates channel membership via Telegram Bot API, and enforces membership
checks consistently across both the Telegram Bot and the Mini App REST API.
"""
from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from database import managed_connect
from config import BOT_TOKEN, ADMIN_IDS

logger = logging.getLogger("services.force_join")

# Fallback default channels if not configured in the database
DEFAULT_CHECK_CHANNELS = ["-1003186256877", "-1003350590878"]
DEFAULT_JOIN_URLS = [
    "https://t.me/PIRO_BUYERS_KP",
    "https://t.me/+NBm-7FSGyitlMzVl",
]

# Membership cache: { (user_id, channel_id): (is_member, expire_timestamp) }
_MEMBERSHIP_CACHE: dict[tuple[int, str], tuple[bool, float]] = {}
CACHE_TTL_SECONDS = 60.0


def is_force_join_enabled() -> bool:
    """Check if force-join is globally enabled in settings."""
    try:
        with managed_connect() as conn:
            row = conn.execute("SELECT value FROM settings WHERE key='force_join_status'").fetchone()
            if row and row['value']:
                return row['value'].strip().lower() != "off"
    except Exception as ex:
        logger.debug("Failed to read force_join_status: %s", ex)
    return True


def get_force_join_channels() -> list[dict[str, str]]:
    """Return the active list of required channels from settings, falling back to defaults."""
    raw = None
    try:
        with managed_connect() as conn:
            row = conn.execute("SELECT value FROM settings WHERE key='force_join_channels'").fetchone()
            if row and row['value']:
                raw = row['value']
    except Exception as ex:
        logger.debug("Failed to read force_join_channels: %s", ex)

    channels: list[dict[str, str]] = []
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, dict):
                        ch_id = str(item.get("id") or item.get("channel_id") or "").strip()
                        ch_url = str(item.get("url") or item.get("link") or "").strip()
                        ch_name = str(item.get("name") or "").strip()
                        if ch_id or ch_url:
                            channels.append({
                                "id": ch_id or ch_url,
                                "url": ch_url or (f"https://t.me/{ch_id.lstrip('@')}" if not ch_id.startswith("-") else ""),
                                "name": ch_name or f"Channel {len(channels) + 1}",
                            })
                    elif isinstance(item, str) and item.strip():
                        s = item.strip()
                        url = s if s.startswith("http") else (f"https://t.me/{s.lstrip('@')}" if not s.startswith("-") else "")
                        channels.append({
                            "id": s,
                            "url": url,
                            "name": f"Channel {len(channels) + 1}",
                        })
        except Exception as ex:
            logger.debug("Failed to parse force_join_channels JSON: %s", ex)

    if not channels:
        for i, ch_id in enumerate(DEFAULT_CHECK_CHANNELS):
            url = DEFAULT_JOIN_URLS[i] if i < len(DEFAULT_JOIN_URLS) else (DEFAULT_JOIN_URLS[0] if DEFAULT_JOIN_URLS else "")
            channels.append({
                "id": ch_id,
                "url": url,
                "name": f"Channel {i + 1}",
            })

    return channels


def is_user_admin(user_id: int) -> bool:
    """Check if a user is an administrator exempt from force-join."""
    if user_id in ADMIN_IDS:
        return True
    try:
        with managed_connect() as conn:
            row = conn.execute("SELECT user_id FROM admins WHERE user_id=?", (user_id,)).fetchone()
            if row:
                return True
    except Exception:
        pass
    return False


def check_channel_member_http(user_id: int, channel_id: str) -> bool:
    """Check if user is a member of the given channel via Telegram Bot API HTTP."""
    now = time.time()
    cache_key = (user_id, channel_id)
    if cache_key in _MEMBERSHIP_CACHE:
        val, exp = _MEMBERSHIP_CACHE[cache_key]
        if now < exp:
            return val

    # Normalize channel identifier
    clean_id = channel_id.strip()
    if clean_id.startswith("https://t.me/"):
        clean_id = "@" + clean_id.split("https://t.me/")[-1].split("/")[0].strip()

    if not BOT_TOKEN:
        logger.warning("BOT_TOKEN not configured; bypassing membership check")
        return True

    try:
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/getChatMember"
        params = urllib.parse.urlencode({
            "chat_id": clean_id,
            "user_id": user_id,
        })
        req = urllib.request.Request(f"{url}?{params}", headers={"User-Agent": "DeamonOTPBot/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("ok"):
                status = data.get("result", {}).get("status", "")
                is_member = status in ("creator", "administrator", "member", "restricted")
                _MEMBERSHIP_CACHE[cache_key] = (is_member, now + CACHE_TTL_SECONDS)
                return is_member
    except urllib.error.HTTPError as he:
        try:
            err_body = json.loads(he.read().decode("utf-8"))
            desc = err_body.get("description", "").lower()
            if "user not found" in desc or "not a member" in desc or "participant" in desc:
                _MEMBERSHIP_CACHE[cache_key] = (False, now + 15.0)
                return False
        except Exception:
            pass
        logger.debug("getChatMember HTTP error for %s on %s: %s", user_id, clean_id, he)
        # Fail-safe bypass on bot misconfiguration / network error
        return True
    except Exception as ex:
        logger.debug("getChatMember exception for %s on %s: %s", user_id, clean_id, ex)
        return True

    return True


def check_user_force_join(user_id: int) -> tuple[bool, list[dict[str, str]]]:
    """Check if user has satisfied all force-join channel requirements.

    Returns:
        (is_joined: bool, missing_channels: list[dict])
    """
    if not is_force_join_enabled():
        return True, []

    # Admins and Google web users (>= 9B) are exempt
    if is_user_admin(user_id) or user_id >= 9000000000:
        return True, []

    channels = get_force_join_channels()
    missing: list[dict[str, str]] = []

    for ch in channels:
        ch_id = ch.get("id") or ch.get("url")
        if not ch_id:
            continue
        if not check_channel_member_http(user_id, ch_id):
            missing.append(ch)

    return len(missing) == 0, missing


def clear_user_membership_cache(user_id: int) -> None:
    """Clear cached membership checks for a user when they re-verify."""
    keys_to_del = [k for k in _MEMBERSHIP_CACHE if k[0] == user_id]
    for k in keys_to_del:
        _MEMBERSHIP_CACHE.pop(k, None)
