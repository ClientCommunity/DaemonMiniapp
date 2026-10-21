"""Pure utility functions: currency formatters, date parsers, slug generators, and phone masking."""
from __future__ import annotations

import os
import re
import secrets
import string
import unicodedata
from datetime import datetime, timezone

from bot_helpers.constants import COUNTRY_CODES, CALLING_CODES


def as_boolish(value) -> bool:
    """Normalize truthy/falsy values from API responses and strings."""
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value > 0
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "on", "enable", "enabled")
    return bool(value)


def country_slug(name: str) -> str:
    """Derive a URL/callback-safe ASCII slug from a country name."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def get_country_button_code(name: str) -> str:
    """Return a short 3-letter uppercase identifier for keyboard buttons."""
    special = {"India": "IND"}
    if name in special:
        return special[name]
    return COUNTRY_CODES.get(name, ("", ""))[0] or name[:3].upper()


def country_button_label(name: str, price_text: str | None = None, include_phone: bool = True) -> str:
    """Generate localized button text with flag, code, dial prefix, and optional price."""
    iso_code, flag = COUNTRY_CODES.get(name, ("", "🌍"))
    short_name = get_country_button_code(name)
    calling = CALLING_CODES.get(name, "")
    parts = [flag, short_name]
    if include_phone and calling:
        parts.append(f"+{calling}")
    label = " ".join(parts)
    if price_text is not None:
        label = f"{label} | {price_text}"
    return label


def find_country_matches(query: str) -> list[str]:
    """Fuzzy-find countries by name, ISO-2, or calling dial code."""
    q = query.strip().lower().replace("+", "")
    if not q:
        return []
    exact, partial = [], []
    for name, (iso, flag) in COUNTRY_CODES.items():
        calling = CALLING_CODES.get(name, "")
        tokens = {name.lower(), iso.lower(), calling.lower()}
        if q in tokens or (q.isdigit() and calling.startswith(q)):
            exact.append(name)
        elif q in name.lower() or iso.lower().startswith(q) or (q.isdigit() and q in calling):
            partial.append(name)
    return sorted(dict.fromkeys(exact + partial))


def find_country_by_slug(slug: str) -> str | None:
    """Resolve an incoming callback slug back to its official country name."""
    normalized = slug.strip().lower().replace("_", "-")
    for name in COUNTRY_CODES:
        if country_slug(name) == normalized:
            return name
    matches = find_country_matches(normalized.replace("-", " "))
    return matches[0] if matches else None


def mask_phone_number(phone: str) -> str:
    """Mask central phone digits for privacy in receipts and dual logs."""
    raw = str(phone or "").strip()
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return "Hidden"
    if len(digits) <= 4:
        return "+" + "*" * len(digits)
    if len(digits) <= 8:
        return "+" + digits[:2] + "**" + digits[-2:]
    return "+" + digits[:4] + "**" + digits[-3:]


def is_private_event(e) -> bool:
    """Check if a Telethon event originates from a private 1-on-1 chat."""
    chat_id = getattr(e, "chat_id", None)
    sender_id = getattr(e, "sender_id", None)
    if chat_id is None or sender_id is None:
        return True
    return int(chat_id) == int(sender_id)


def is_admin_callback_data(data: str) -> bool:
    """Check if callback query payload belongs to the administrative panel."""
    admin_prefixes = (
        "dep_act|", "kp_adm|", "wd_act|", "adm_", "adm",
        "apset|", "sp|", "price|", "pay_", "toggle_"
    )
    return str(data or "").startswith(admin_prefixes)


def format_inr_amount(inr_amt) -> str:
    """Format rupee amount with clean integer or 2-decimal presentation."""
    try:
        amount = float(inr_amt)
    except (TypeError, ValueError):
        amount = 0.0
    return f"₹{amount:.0f}" if amount.is_integer() else f"₹{amount:.2f}"


def parse_db_datetime(value) -> datetime | None:
    """Parse UTC timestamps across SQLite ISO and space-separated formats."""
    if not value:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f"):
        try:
            return datetime.strptime(str(value), fmt)
        except (TypeError, ValueError):
            continue
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except (TypeError, ValueError):
        return None


def format_purchase_datetime(value) -> str:
    """Render customer-friendly order timestamps."""
    parsed = parse_db_datetime(value)
    if not parsed:
        return str(value)
    if parsed.date() == datetime.now(timezone.utc).date():
        return f"Today {parsed.strftime('%H:%M:%S')} UTC"
    return parsed.strftime("%a %b %d %H:%M:%S %Y")


def generate_random_password(length: int = 12) -> str:
    """Generate secure alphanumeric password for fresh accounts."""
    chars = string.ascii_letters + string.digits + "@#$"
    return "".join(secrets.choice(chars) for _ in range(max(8, length)))


def extract_otp_from_message_text(message_text: str) -> str | None:
    """Scan incoming SMS text for 5-digit verification code, ignoring login notices."""
    if not message_text or "Login detected" in message_text:
        return None
    match = re.search(r"\b\d{5}\b", message_text)
    return match.group(0) if match else None


def delete_session_files(session_path: str) -> None:
    """Safely remove SQLite and WAL files associated with a Telethon session."""
    base = session_path if not session_path.endswith(".session") else session_path[:-8]
    for ext in [".session", ".session-wal", ".session-shm", ".session-journal"]:
        try:
            full_path = base + ext
            if os.path.exists(full_path):
                os.remove(full_path)
        except Exception:
            pass
