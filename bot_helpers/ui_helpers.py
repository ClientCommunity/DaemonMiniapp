"""UI and inline keyboard button helpers for Telethon bot."""
from __future__ import annotations

import aiohttp
import asyncio
import os
from telethon import Button
from telethon.tl import types as tl_types
from api_cooldown import is_cooling_down, record_rate_limit
from bot_helpers.constants import PREMIUM_EMOJI_IDS


def p_btn(text, data=None, url=None, style=None, icon_custom_emoji_id=None):
    """Construct a Telethon button with optional modern styles and custom emoji."""
    kwargs = {}
    if style:
        kwargs["style"] = style
    if icon_custom_emoji_id:
        kwargs["icon_custom_emoji_id"] = icon_custom_emoji_id
    if url:
        try:
            return Button.url(text, url, **kwargs)
        except TypeError:
            return Button.url(text, url)
    try:
        return Button.inline(text, data, **kwargs)
    except TypeError:
        return Button.inline(text, data)


def p_copy_btn(text, value):
    """Create a native Telegram copy button with a safe legacy fallback."""
    clean = str(value or "").strip()
    copy_type = getattr(tl_types, "KeyboardButtonCopy", None)
    if copy_type:
        try:
            return copy_type(text=text, copy_text=clean)
        except TypeError:
            try:
                return copy_type(text, clean)
            except TypeError:
                pass
    # Older Telethon releases do not know Telegram's copy-text button. The
    # callback still presents the exact value in a copyable alert.
    return p_btn(text, f"copy_phone|{clean}", style="primary")


def premium_emoji_id(name, emoji_map=None):
    """Resolve Telegram custom emoji ID from mapping dictionary or default."""
    if emoji_map is None:
        emoji_map = PREMIUM_EMOJI_IDS
    value = emoji_map.get(name, "")
    return int(value) if str(value).isdigit() else None


def premium_button(text, data=None, url=None, style=None, emoji_name=None, emoji_map=None):
    """Create button with custom emoji icon."""
    return p_btn(
        text,
        data=data,
        url=url,
        style=style,
        icon_custom_emoji_id=premium_emoji_id(emoji_name or "", emoji_map=emoji_map),
    )


def apply_custom_emoji_entities(text, markers, emoji_map=None):
    """Replace marker tokens with fallback emoji and return UTF-16 based entities."""
    entities = []
    rendered = text
    custom_emoji_entity = getattr(tl_types, "MessageEntityCustomEmoji", None)
    for marker, fallback, emoji_name in markers:
        custom_id = premium_emoji_id(emoji_name, emoji_map=emoji_map)
        search_from = 0
        while marker in rendered[search_from:]:
            idx = rendered.index(marker, search_from)
            before = rendered[:idx]
            rendered = rendered[:idx] + fallback + rendered[idx + len(marker):]
            if custom_id and custom_emoji_entity:
                offset = len(before.encode("utf-16-le")) // 2
                length = len(fallback.encode("utf-16-le")) // 2
                entities.append(custom_emoji_entity(offset=offset, length=length, document_id=custom_id))
            search_from = idx + len(fallback)
    return rendered, entities


async def bot_api_edit_text(event, text, keyboard, bot_token=None):
    """Use Telegram's official HTTP Bot API for expandable blockquotes and HTML."""
    if bot_token is None:
        bot_token = os.getenv("BOT_TOKEN", "").strip()

    message_id = getattr(event, "message_id", None) or getattr(event, "id", None)
    chat_id = getattr(event, "chat_id", None)
    if not message_id or not chat_id:
        return False
    payload = {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": text,
        "parse_mode": "HTML",
        "reply_markup": {"inline_keyboard": keyboard},
    }
    tg_url = f"https://api.telegram.org/bot{bot_token}/editMessageText"
    if is_cooling_down(tg_url):
        return False
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as session:
            async with session.post(tg_url, json=payload) as response:
                if response.status == 429:
                    record_rate_limit(tg_url, 10.0, reason="Telegram HTTP 429")
                    return False
                result = await response.json(content_type=None)
                if isinstance(result, dict) and result.get("error_code") == 429:
                    retry_sec = (
                        result.get("parameters", {}).get("retry_after")
                        if isinstance(result.get("parameters"), dict)
                        else None
                    ) or 10.0
                    record_rate_limit(tg_url, float(retry_sec), reason="Telegram error_code 429")
                    return False
        return bool(result.get("ok"))
    except (aiohttp.ClientError, asyncio.TimeoutError, ValueError):
        return False
