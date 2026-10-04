"""Central configuration management for DeamonOTPBot backend.

Loads environment variables from .env if present and provides typed settings
for Flask application, reverse proxy security, database, bot, and providers.
"""
from __future__ import annotations

import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"

# Zero-dependency .env loader
if ENV_FILE.exists():
    try:
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass

# Reverse Proxy Security
# Reverse proxy sends X-Proxy-Secret: deamon_proxy_secret_2026 or PROXY_SECRET env var
DEFAULT_PROXY_SECRET = "deamon_proxy_secret_2026"
CONFIGURED_PROXY_SECRET = os.getenv("PROXY_SECRET", DEFAULT_PROXY_SECRET).strip()
ACCEPTED_PROXY_SECRETS = {
    s for s in [CONFIGURED_PROXY_SECRET, DEFAULT_PROXY_SECRET] if s
}

# Require proxy secret enforcement
# In production or when PROXY_SECRET_REQUIRED / REQUIRE_PROXY_SECRET is true, reject non-matching requests
REQUIRE_PROXY_SECRET = os.getenv(
    "REQUIRE_PROXY_SECRET",
    os.getenv("PROXY_SECRET_REQUIRED", "0")
).lower() in ("1", "true", "yes")

# Telegram Bot Credentials
BOT_TOKEN = os.getenv(
    "TELEGRAM_BOT_TOKEN",
    os.getenv("BOT_TOKEN", "8273842990:AAF5PA9ikw0ABRqES1lCIPoczOdUZVCs1yU")
).strip()
API_ID = int(os.getenv("TELEGRAM_API_ID", "26663221"))
API_HASH = os.getenv("TELEGRAM_API_HASH", "d3557c9b05a08892562b2777035e1cdb").strip()

# Admin IDs
_raw_admin_ids = os.getenv("TELEGRAM_ADMIN_ID", "7507183871,1928631932")
ADMIN_IDS = {int(x.strip()) for x in _raw_admin_ids.split(",") if x.strip().isdigit()}
MASTER_ADMIN_IDS = {7507183871, 1928631932} | ADMIN_IDS

# Database
_env_db = os.getenv("BOT_DATABASE")
DB_PATH = Path(_env_db) if _env_db else (BASE_DIR / "otp_bot_final.db")

# Server / Networking
FLASK_HOST = os.getenv("FLASK_HOST", "0.0.0.0")
FLASK_PORT = int(os.getenv("FLASK_PORT", os.getenv("PORT", os.getenv("SERVER_PORT", "6357"))))
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "deamon_webhook_secret_key_2026").strip()

# Sessions directory for downloaded / purchased .session files
SESSIONS_DIR = BASE_DIR / "sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

# Reseller Limits
RESELLER_MIN_MARGIN = int(os.getenv("RESELLER_MIN_MARGIN", "5"))
RESELLER_MAX_MARGIN = int(os.getenv("RESELLER_MAX_MARGIN", "100"))

# Provider Sanitization Names (Zero upstream vendor leaks to client)
SERVER_NAMES = {
    1: {"name": "Global 2FA Accounts", "subtitle": "Instant 2FA Telegram sessions", "icon": "🌐"},
    2: {"name": "Fresh Session Accounts", "subtitle": "Good & Cheap quality tiers", "icon": "📱"},
    3: {"name": "Instant Virtual OTP", "subtitle": "Fast virtual SMS activations", "icon": "⚡"},
    4: {"name": "Fresh Carrier Numbers", "subtitle": "Real carrier virtual numbers", "icon": "📶"},
    5: {"name": "SMM Hub", "subtitle": "Social media boost & growth", "icon": "🚀"},
}
