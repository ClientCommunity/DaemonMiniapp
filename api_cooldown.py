"""Unified rate-limit cooldown manager for external API endpoints.

Enforces a 10-second (configurable) freeze per endpoint/URL whenever any external
provider returns HTTP 429 or a rate-limit indicator, preventing spamming and IP bans.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import threading
import time
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Default cooldown duration in seconds (per user requirement: 10s)
DEFAULT_COOLDOWN_SECONDS: float = max(1.0, float(os.getenv("API_RATE_LIMIT_COOLDOWN", "10.0")))

_lock = threading.Lock()
_cooldowns: dict[str, float] = {}  # endpoint_key -> monotonic timestamp until which requests are blocked


class RateLimitCooldownError(RuntimeError):
    """Raised when an API request is attempted while the target endpoint is in cooldown."""

    def __init__(self, endpoint: str, remaining: float, reason: str = ""):
        self.endpoint = endpoint
        self.remaining = max(0.0, remaining)
        self.reason = reason
        detail = f" ({reason})" if reason else ""
        super().__init__(
            f"Endpoint '{endpoint}' is in cooldown for {self.remaining:.1f}s due to rate limit{detail}."
        )


def normalize_endpoint(url: str) -> str:
    """Normalize a URL to its scheme + host + path (stripping query parameters and fragments).

    Also scrubs Telegram bot tokens to prevent exposing secrets while grouping bot API calls.
    Examples:
      'https://dgotp.in/stubs/handler_api.php?action=getStatus&id=123' -> 'https://dgotp.in/stubs/handler_api.php'
      'https://api.temporasms.com/stubs/handler_api.php?api_key=xxx' -> 'https://api.temporasms.com/stubs/handler_api.php'
      'https://api.telegram.org/bot1234:ABC/editMessageText' -> 'https://api.telegram.org/bot/editMessageText'
    """
    if not url:
        return ""
    try:
        raw = str(url).strip()
        parsed = urlparse(raw)
        if parsed.scheme and parsed.netloc:
            path = parsed.path or ""
            path = re.sub(r"/bot[^/]+", "/bot", path)
            return f"{parsed.scheme}://{parsed.netloc}{path}".rstrip("/")
        clean = raw.split("?")[0].split("#")[0].strip().rstrip("/")
        return re.sub(r"/bot[^/]+", "/bot", clean)
    except Exception:
        return str(url).split("?")[0].strip().rstrip("/")


def record_rate_limit(url: str, cooldown_seconds: float = DEFAULT_COOLDOWN_SECONDS, reason: str = "") -> float:
    """Record that an endpoint hit a rate limit and enforce a cooldown for that endpoint.

    Returns the seconds remaining until cooldown expiration.
    """
    key = normalize_endpoint(url)
    if not key:
        return 0.0
    duration = max(1.0, float(cooldown_seconds))
    expires_at = time.monotonic() + duration
    with _lock:
        current = _cooldowns.get(key, 0.0)
        _cooldowns[key] = max(current, expires_at)
        remaining = _cooldowns[key] - time.monotonic()

    logger.warning(
        "Rate limit cooldown enforced on endpoint '%s' for %.1fs%s",
        key,
        remaining,
        f" [reason: {reason}]" if reason else "",
    )
    return remaining


def get_cooldown_remaining(url: str) -> float:
    """Return remaining cooldown seconds for an endpoint, or 0.0 if not in cooldown."""
    key = normalize_endpoint(url)
    if not key:
        return 0.0
    with _lock:
        expires_at = _cooldowns.get(key, 0.0)
        now = time.monotonic()
        if now >= expires_at:
            if key in _cooldowns:
                del _cooldowns[key]
            return 0.0
        return max(0.0, expires_at - now)


def is_cooling_down(url: str) -> bool:
    """Check if an endpoint is currently cooling down due to a prior rate limit."""
    return get_cooldown_remaining(url) > 0.0


async def wait_cooldown(url: str, max_wait: float = 10.0) -> bool:
    """Wait for cooldown to expire if remaining time is within max_wait.

    Returns True if clear (or waited successfully), False if remaining cooldown exceeds max_wait.
    """
    rem = get_cooldown_remaining(url)
    if rem <= 0.0:
        return True
    if rem > max_wait:
        return False
    await asyncio.sleep(rem)
    return True


def check_cooldown(url: str, reason: str = "") -> None:
    """Raise RateLimitCooldownError if the endpoint is in an active cooldown."""
    rem = get_cooldown_remaining(url)
    if rem > 0.0:
        key = normalize_endpoint(url)
        raise RateLimitCooldownError(key, rem, reason)


def reset_cooldowns() -> None:
    """Reset all active cooldowns (useful for tests)."""
    with _lock:
        _cooldowns.clear()
