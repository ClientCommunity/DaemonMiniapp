"""Pure LZT Market pricing, OTP candidate collection, URL masking, and response parsing helpers."""
from __future__ import annotations

import re
import urllib.parse
from datetime import datetime, timezone
from bot_helpers.constants import COUNTRY_CODES, LZT_PRICE_CURRENCY
from bot_helpers.utils import as_boolish, find_country_matches

OTP_REGEX = r"\b\d{5}\b"


def lzt_item_matches_filters(item: dict, flt: dict) -> bool:
    """Filter candidate LZT market items based on customer spam, geo, mail, or premium preferences."""
    spam_pref = flt.get("spam", "any")
    if spam_pref != "any":
        spam_value = item.get("telegram_spam_block", item.get("spam", -1))
        has_spam = str(spam_value) not in ("-1", "0", "False", "false", "None", "")
        if spam_pref == "no" and has_spam:
            return False
        if spam_pref == "yes" and not has_spam:
            return False

    premium_pref = flt.get("premium", "any")
    if premium_pref != "any":
        has_premium = as_boolish(item.get("telegram_premium", item.get("premium")))
        if premium_pref == "yes" and not has_premium:
            return False
        if premium_pref == "no" and has_premium:
            return False

    geo_pref = flt.get("geoblock", "any")
    if geo_pref != "any":
        geo_value = item.get("telegram_geo_block", item.get("geo_block", item.get("geoblock")))
        has_geo = as_boolish(geo_value)
        if geo_pref == "no" and has_geo:
            return False
        if geo_pref == "yes" and not has_geo:
            return False

    mail_pref = flt.get("login_mail", "any")
    if mail_pref != "any":
        mail_value = item.get("login_mail", item.get("email", item.get("has_email", item.get("telegram_email"))))
        has_mail = as_boolish(mail_value)
        if mail_pref == "yes" and not has_mail:
            return False
        if mail_pref == "no" and has_mail:
            return False

    return True


def filter_lzt_items(items: list[dict], flt: dict) -> list[dict]:
    """Filter list of items against user preference dictionary."""
    return [item for item in items if lzt_item_matches_filters(item, flt)]


def lzt_price_currency(item: dict, default_currency: str = LZT_PRICE_CURRENCY) -> str:
    """Extract currency code from LZT listing payload."""
    if isinstance(item, dict):
        for key in ("currency", "price_currency", "priceCurrency", "currency_code", "currencyCode"):
            value = item.get(key)
            if value:
                return str(value).strip().lower()
        price_data = item.get("price_data") or item.get("priceData")
        if isinstance(price_data, dict):
            for key in ("currency", "currency_code", "currencyCode"):
                value = price_data.get(key)
                if value:
                    return str(value).strip().lower()
    return default_currency.lower()


def lzt_currency_params(extra: dict | None = None, default_currency: str = LZT_PRICE_CURRENCY) -> dict:
    params = dict(extra or {})
    params.setdefault("currency", default_currency)
    return params


def lzt_candidate_timestamp(container) -> int:
    if not isinstance(container, dict):
        return 0
    for key in ("date", "time", "created_at", "createdDate", "timestamp"):
        value = container.get(key)
        try:
            return int(float(value))
        except (TypeError, ValueError):
            continue
    return 0


def collect_lzt_otp_candidates(value, parent_key: str = "", candidates: list | None = None, depth: int = 0) -> list:
    """Collect OTP candidates from LZT response without matching phones/dates.

    LZT can return codes as top-level fields, nested data/result dictionaries, or
    as a `codes` list like: {"codes": [{"code": "48492", "date": ...}]}.
    This walker only scans trusted OTP/message fields, so large item payloads do
    not accidentally turn phone numbers, Telegram IDs, or dates into OTPs.
    """
    if candidates is None:
        candidates = []
    if value is None or depth > 8:
        return candidates

    trusted_keys = {"code", "otp", "login_code", "telegram_login_code", "telegramLoginCode"}
    text_keys = {"message", "text", "sms", "telegram_message"}
    container_keys = {"data", "item", "telegram", "response", "result", "codes"}
    key_name = str(parent_key or "")

    if isinstance(value, dict):
        ts = lzt_candidate_timestamp(value)
        for key, nested in value.items():
            key_str = str(key)
            if key_str in trusted_keys or key_str in text_keys:
                before = len(candidates)
                collect_lzt_otp_candidates(nested, key_str, candidates, depth + 1)
                if ts:
                    for pos in range(before, len(candidates)):
                        code_ts, priority, code = candidates[pos]
                        if code_ts == 0:
                            candidates[pos] = (ts, priority, code)
            elif key_str in container_keys:
                collect_lzt_otp_candidates(nested, key_str, candidates, depth + 1)
        return candidates

    if isinstance(value, (list, tuple)):
        if key_name in container_keys or key_name in trusted_keys or key_name in text_keys:
            for index, item in enumerate(value):
                before = len(candidates)
                collect_lzt_otp_candidates(item, key_name, candidates, depth + 1)
                for pos in range(before, len(candidates)):
                    ts, priority, code = candidates[pos]
                    if ts == 0:
                        candidates[pos] = (index + 1, priority, code)
        return candidates

    if key_name not in trusted_keys and key_name not in text_keys and key_name != "codes":
        return candidates

    text_val = str(value)
    if "login detected" in text_val.lower():
        return candidates
    match = re.search(OTP_REGEX, text_val)
    if match:
        priority = 100 if key_name in trusted_keys else 50
        candidates.append((0, priority, match.group(0)))
    return candidates


def extract_lzt_otp(res) -> str | None:
    """Extract freshest verified verification code from LZT response."""
    candidates = collect_lzt_otp_candidates(res)
    if not candidates:
        return None
    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return candidates[0][2]


def lzt_purchase_has_error(res) -> bool:
    if not res:
        return True
    if not isinstance(res, dict):
        return False
    for key in ("error", "errors", "error_description"):
        value = res.get(key)
        if value:
            return True
    return False


def lzt_purchase_item_id(res, fallback_item_id: str) -> str:
    if isinstance(res, dict):
        item = res.get("item") or res.get("account") or res.get("telegram")
        if isinstance(item, dict):
            return str(item.get("item_id") or item.get("id") or fallback_item_id)
        for key in ("item_id", "id"):
            if res.get(key):
                return str(res.get(key))
    return str(fallback_item_id)


def normalize_lzt_phone(raw_phone, fallback_item_id: str) -> str:
    phone = str(raw_phone or "").strip()
    if not phone or phone.startswith("LZT_"):
        return f"Hidden-{fallback_item_id}"
    return phone


def lzt_market_price(item: dict) -> float | None:
    if not isinstance(item, dict):
        return None
    raw_price = item.get("price_with_fee") or item.get("priceWithSellerFee") or item.get("price")
    try:
        price = float(raw_price)
    except (TypeError, ValueError):
        return None
    return price if price > 0 else None


def lzt_item_requires_password(item: dict) -> bool:
    if not isinstance(item, dict):
        return False
    password_keys = (
        "password", "login_password", "telegram_password", "telegram_login_password",
        "has_password", "hasPassword", "twofa", "two_fa", "2fa"
    )
    for key in password_keys:
        value = item.get(key)
        if value in (None, "", 0, "0", False, "None", "none", "no", "NO"):
            continue
        return True
    return False


def lzt_error_text(res) -> str:
    if not isinstance(res, dict):
        return str(res or "")
    parts = []
    for key in ("error", "errors", "error_description", "message", "detail"):
        value = res.get(key)
        if value:
            parts.append(str(value))
    return " | ".join(parts)


def lzt_updated_market_price_from_error(res) -> float | None:
    text = lzt_error_text(res)
    match = re.search(r"costs now\s+([0-9]+(?:\.[0-9]+)?)", text, re.IGNORECASE)
    if match:
        try:
            return float(match.group(1))
        except (TypeError, ValueError):
            return None
    return None


def lzt_should_retry_purchase(res) -> bool:
    text = lzt_error_text(res).lower()
    return "retry_request" in text or "retry request" in text


def parse_lzt_retry_after(headers) -> float | None:
    if not headers:
        return None
    raw_value = None
    try:
        raw_value = headers.get("Retry-After")
    except Exception:
        raw_value = None
    if not raw_value:
        return None
    try:
        return max(0.0, float(raw_value))
    except (TypeError, ValueError):
        pass
    try:
        retry_at = datetime.strptime(str(raw_value), "%a, %d %b %Y %H:%M:%S GMT").replace(tzinfo=timezone.utc)
        return max(0.0, (retry_at - datetime.now(timezone.utc)).total_seconds())
    except Exception:
        return None


def clean_lzt_params(params: dict | None) -> dict | None:
    if not params:
        return None
    clean_params = {}
    for key, value in params.items():
        if key is None or value is None:
            continue
        if isinstance(value, (list, tuple)):
            clean_list = [str(item) for item in value if item is not None]
            if clean_list:
                clean_params[str(key)] = clean_list
        else:
            clean_params[str(key)] = str(value)
    return clean_params or None


def lzt_masked_url(endpoint: str, params: dict | None = None) -> str:
    query = urllib.parse.urlencode(params or {}, doseq=True)
    return f"{endpoint}?{query}" if query else endpoint


def lzt_response_summary(res) -> str:
    if not isinstance(res, dict):
        return type(res).__name__
    parts = []
    if "items" in res and isinstance(res.get("items"), list):
        parts.append(f"items={len(res.get('items') or [])}")
    for key in ("totalItems", "total", "count", "item_id", "id", "http_status"):
        if key in res:
            parts.append(f"{key}={res.get(key)}")
    if not parts and "item" in res:
        parts.append("item=yes")
    if not parts and any(k in res for k in ("error", "errors", "message")):
        parts.append("error=yes")
    return ", ".join(parts) if parts else "ok"
