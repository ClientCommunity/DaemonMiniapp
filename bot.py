import os
import sqlite3
import re
import asyncio
import time
import logging
import socket
import json
import urllib.error
import urllib.parse
import urllib.request
import aiohttp
import zipfile
import shutil
import html
import random
import string
import unicodedata
import secrets
import io
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify
import threading
from datetime import datetime

from telethon import TelegramClient, events, Button
from telethon.errors import (
    SessionPasswordNeededError, MessageNotModifiedError, UserNotParticipantError
)
from telethon.errors.rpcerrorlist import QueryIdInvalidError
from telethon.tl import types as tl_types
from telethon.tl.types import KeyboardButtonCallback, KeyboardButtonUrl
from telethon.tl.functions.channels import GetParticipantRequest
from telethon.tl.functions.account import GetPasswordRequest, UpdatePasswordSettingsRequest, GetAuthorizationsRequest

from database import connect as managed_connect, migrate as migrate_managed_services
from server import server3, server4
from server3 import DGOTPError, SERVICE_CATALOG, client as server3_client
from server4 import TemporaError, client as server4_client
from server5 import (Client as SMMClient, SMMError, add_provider as smm_add_provider, place_order as smm_place_order,
                     normalize_api_url as smm_normalize_api_url,
                     quote as smm_quote, refresh_order as smm_refresh_order, refund_order as smm_refund_order,
                     service_rows as smm_service_rows, sync_loop as smm_sync_loop,
                     order_loop as smm_order_loop, sync_provider as smm_sync_provider,
                     test_provider as smm_test_provider, update_provider_token as smm_update_provider_token,
                     delete_service as smm_delete_service)
from secrets_manager import encrypt_secret
from provider_order_manager import (ACTIVATION_TTL, ProviderOrderManager,
                                    cancel_and_refund, cancellation_wait,
                                    complete_order, expiry_timestamp)
from fampay import (FamPayError, ORDER_TTL as FAMPAY_ORDER_TTL,
                    approve_review as approve_fampay_review,
                    credit as credit_fampay_order, expire_pending as expire_fampay_orders,
                    expiry_timestamp as fampay_expiry_timestamp,
                    reject_review as reject_fampay_review, verify as verify_fampay)

# ================= INITIALIZE LOGGING =================
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

# ================= BASE CONFIGURATIONS =================
API_ID = int(os.getenv("TELEGRAM_API_ID", "26663221"))
API_HASH = os.getenv("TELEGRAM_API_HASH", "d3557c9b05a08892562b2777035e1cdb")
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8273842990:AAF5PA9ikw0ABRqES1lCIPoczOdUZVCs1yU")
DEFAULT_ADMIN_IDS = [7507183871, 1928631932]
ADMIN_IDS = list(DEFAULT_ADMIN_IDS)
env_admin = os.getenv("TELEGRAM_ADMIN_ID", "")
if env_admin:
    for x in env_admin.replace(" ", "").split(","):
        if x.isdigit() and int(x) not in ADMIN_IDS:
            ADMIN_IDS.append(int(x))
ADMIN_ID = ADMIN_IDS[0]

ADMIN_LOG_CHANNEL_ID = -1003970256704
PUBLIC_LOG_CHANNEL_ID = -1003186256877
LOG_CHANNEL_ID = -1003186256877
CHECK_CHANNELS = ["-1003186256877","-1003350590878"]
JOIN_URLS = ["https://t.me/PIRO_BUYERS_KP","https://t.me/+NBm-7FSGyitlMzVl","https://t.me/+EAqH5HyfN2dlNzI1"]

TERMS_URL = "http://t.me/DeamonOTPBot/terms"
CWALLET_QR = "https://t.me/photo_s_1998/193"
CWALLET_ID = "61286356"

UPI_MID = "hAsqwQ85709194299740"
UPI_ID = "paytm.s2znl0o@pty"

# ================= FLASK WEBHOOK CONFIGURATION =================
FLASK_HOST = "0.0.0.0"
FLASK_PORT = 5073
WEBHOOK_SECRET = "YOUR_SECRETE_CODE"  # CHANGE THIS!

# Initialize Flask app
flask_app = Flask(__name__)

# ================= FLASK WEBHOOK ROUTES =================

@flask_app.route('/webhook/add_balance', methods=['POST'])
def webhook_add_balance():
    """Add balance to a user via webhook"""
    try:
        data = request.get_json()

        if not data:
            return jsonify({"success": False, "error": "No JSON data provided"}), 400

        # Verify secret
        if data.get('secret') != WEBHOOK_SECRET:
            return jsonify({"success": False, "error": "Invalid secret"}), 401

        user_id = data.get('user_id')
        amount = data.get('amount')
        reason = data.get('reason', 'Webhook deposit')

        if not user_id or not amount:
            return jsonify({"success": False, "error": "Missing user_id or amount"}), 400

        try:
            amount = int(amount)
            if amount <= 0:
                return jsonify({"success": False, "error": "Amount must be positive"}), 400
        except ValueError:
            return jsonify({"success": False, "error": "Amount must be an integer"}), 400

        # Ensure user exists
        cur.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (user_id,))

        # Get old balance
        cur.execute("SELECT balance FROM users WHERE user_id=?", (user_id,))
        old_balance = cur.fetchone()
        old_balance = old_balance[0] if old_balance else 0

        # Update balance
        update_balance(user_id, amount)

        # Log deposit
        cur.execute("""
            INSERT INTO deposits (user_id, amount, method_name, status)
            VALUES (?, ?, ?, 'success')
        """, (user_id, amount, "Webhook API"))

        cur.execute("UPDATE users SET total_deposited = total_deposited + ? WHERE user_id=?", (amount, user_id))
        db.commit()

        new_balance = old_balance + amount

        # Send notification to user - FIXED VERSION
        def send_notification_sync():
            """Send notification in a synchronous way"""
            try:
                # Use the bot's existing event loop
                if 'bot' in globals() and bot is not None:
                    # Get the running event loop
                    try:
                        loop = asyncio.get_running_loop()
                        # If we're already in an event loop, use asyncio.create_task
                        asyncio.create_task(
                            bot.send_message(
                                int(user_id),
                                f"✅ <b>Balance Added!</b>\n\n"
                                f"💰 <b>Amount Added:</b> ₹{amount}\n"
                                f"📉 <b>Previous Balance:</b> ₹{old_balance}\n"
                                f"📈 <b>New Balance:</b> ₹{new_balance}\n"
                                f"📝 <b>Reason:</b> {reason}"
                            )
                        )
                        print(f"✅ Notification sent to user {user_id}")
                    except RuntimeError:
                        # No running event loop, create one
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                        try:
                            loop.run_until_complete(
                                bot.send_message(
                                    int(user_id),
                                    f"✅ <b>Balance Added!</b>\n\n"
                                    f"💰 <b>Amount Added:</b> ₹{amount}\n"
                                    f"📉 <b>Previous Balance:</b> ₹{old_balance}\n"
                                    f"📈 <b>New Balance:</b> ₹{new_balance}\n"
                                    f"📝 <b>Reason:</b> {reason}"
                                )
                            )
                            print(f"✅ Notification sent to user {user_id}")
                        finally:
                            loop.close()
            except Exception as e:
                print(f"Failed to send notification: {e}")

        # Run notification in a separate thread
        notification_thread = threading.Thread(target=send_notification_sync, daemon=True)
        notification_thread.start()

        return jsonify({
            "success": True,
            "message": f"Added {amount} to user {user_id}",
            "user_id": user_id,
            "amount_added": amount,
            "old_balance": old_balance,
            "new_balance": new_balance
        }), 200

    except Exception as e:
        print(f"Webhook error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@flask_app.route('/webhook/health', methods=['GET'])
def webhook_health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }), 200

# ================= FLASK SERVER STARTER =================

def run_flask():
    """Run Flask in a separate thread"""
    flask_app.run(host=FLASK_HOST, port=FLASK_PORT, debug=False, use_reloader=False)

def start_webhook():
    """Start Flask webhook server in background thread"""
    webhook_thread = threading.Thread(target=run_flask, daemon=True)
    webhook_thread.start()
    print(f"✅ Flask Webhook server started on http://{FLASK_HOST}:{FLASK_PORT}")
    print(f"   - POST /webhook/add_balance")
    print(f"   - GET /webhook/health")

LZT_TOKEN = os.getenv("LZT_TOKEN", "").strip()
LZT_BASE_URL = os.getenv("LZT_BASE_URL", "https://prod-api.lzt.market").rstrip("/")
LZT_REQUEST_TIMEOUT = float(os.getenv("LZT_REQUEST_TIMEOUT", "8"))
LZT_STOCK_TIMEOUT = float(os.getenv("LZT_STOCK_TIMEOUT", "12"))
LZT_MAX_RETRIES = int(os.getenv("LZT_MAX_RETRIES", "2"))
LZT_STOCK_RETRIES = int(os.getenv("LZT_STOCK_RETRIES", "1"))
LZT_CACHE_CONCURRENCY = int(os.getenv("LZT_CACHE_CONCURRENCY", "1"))
LZT_CACHE_REFRESH_SECONDS = float(os.getenv("LZT_CACHE_REFRESH_SECONDS", "300"))
LZT_FORCE_IPV4 = os.getenv("LZT_FORCE_IPV4", "1").strip().lower() not in ("0", "false", "no", "off")
LZT_HTTP_FALLBACK = os.getenv("LZT_HTTP_FALLBACK", "1").strip().lower() not in ("0", "false", "no", "off")
LZT_PROXY = os.getenv("LZT_PROXY", "").strip()
LZT_REQUEST_DEBUG = os.getenv("LZT_REQUEST_DEBUG", "1").strip().lower() not in ("0", "false", "no", "off")
LZT_FAST_BUY_RETRIES = int(os.getenv("LZT_FAST_BUY_RETRIES", "5"))
LZT_PRICE_CURRENCY = os.getenv("LZT_PRICE_CURRENCY", "rub").strip().lower() or "rub"
LZT_MIN_REQUEST_INTERVAL = max(0.2, float(os.getenv("LZT_MIN_REQUEST_INTERVAL", "0.25")))
LZT_RATE_LIMIT_COOLDOWN = float(os.getenv("LZT_RATE_LIMIT_COOLDOWN", "30"))
AUTO_CANCEL_SECONDS = 600

# Optional Telegram custom emoji IDs. Set env vars to Telegram custom emoji
# document IDs to enable premium emoji icons on the homepage without changing
# code. Plain Unicode emoji remain as fallbacks when IDs are not configured.
PREMIUM_EMOJI_IDS = {
    "store": os.getenv("PREMIUM_EMOJI_STORE", "").strip(),
    "account": os.getenv("PREMIUM_EMOJI_ACCOUNT", "").strip(),
    "balance": os.getenv("PREMIUM_EMOJI_BALANCE", "").strip(),
    "help": os.getenv("PREMIUM_EMOJI_HELP", "").strip(),
    "buy": os.getenv("PREMIUM_EMOJI_BUY", "").strip(),
    "sell": os.getenv("PREMIUM_EMOJI_SELL", "").strip(),
    "topup": os.getenv("PREMIUM_EMOJI_TOPUP", "").strip(),
    "history": os.getenv("PREMIUM_EMOJI_HISTORY", "").strip(),
    "sales": os.getenv("PREMIUM_EMOJI_SALES", "").strip(),
    "admin": os.getenv("PREMIUM_EMOJI_ADMIN", "").strip(),
}

OTP_REGEX = r'\b\d{5}\b'


# ================= UI ICONS & COUNTRY CATALOG =================
P_STORE = "<tg-emoji emoji-id='5920332557466997677'>🏪</tg-emoji>"
P_DOC = "<tg-emoji emoji-id='6039630677182254664'>📂</tg-emoji>"
P_ACC = "<tg-emoji emoji-id='5884366771913233289'>👤</tg-emoji>"
P_CART = "🛍️"
P_CASH = "<tg-emoji emoji-id='5904359114531675993'>💰</tg-emoji>"
P_CARD = "💳"
P_FLAG = "<tg-emoji emoji-id='6041923781696426657'>🏳️</tg-emoji>"
P_CAL = "<tg-emoji emoji-id='5891100675042974129'>📅</tg-emoji>"
P_WARN = "⚠️"
P_OFF = "⛔"
P_YES = "<tg-emoji emoji-id='5938252440926163756'>✅</tg-emoji>"
P_NO = "❌"
P_PHONE = "<tg-emoji emoji-id='6039605143601680423'>📞</tg-emoji>"
P_TIME = "<tg-emoji emoji-id='5983150113483134607'>⏰️</tg-emoji>"
P_GIFT = "<tg-emoji emoji-id='6032644646587338669'>🎁</tg-emoji>"
P_SHIELD = "<tg-emoji emoji-id='6030537007350944596'>🛡</tg-emoji>"
P_BANK = "🏦"
P_ID = "🆔"
P_TADA = "<tg-emoji emoji-id='6041731551845159060'>🎉</tg-emoji>"
P_INR = "₹"
P_SHOP = "<tg-emoji emoji-id='5920332557466997677'>🏪</tg-emoji>"
P_HELP = "<tg-emoji emoji-id='6035305550625902723'>💬</tg-emoji>"


# Country name -> (ISO-2 code, flag). Keep names stable because they are used in
# callback payloads, markup settings, and cache keys.
COUNTRY_CODES = {
    "Argentina": ("AR", "🇦🇷"), "Australia": ("AU", "🇦🇺"), "Austria": ("AT", "🇦🇹"),
    "Bangladesh": ("BD", "🇧🇩"), "Belgium": ("BE", "🇧🇪"), "Brazil": ("BR", "🇧🇷"),
    "Canada": ("CA", "🇨🇦"), "Chile": ("CL", "🇨🇱"), "China": ("CN", "🇨🇳"),
    "Colombia": ("CO", "🇨🇴"), "Egypt": ("EG", "🇪🇬"), "France": ("FR", "🇫🇷"),
    "Germany": ("DE", "🇩🇪"), "Hong Kong": ("HK", "🇭🇰"), "India": ("IN", "🇮🇳"),
    "Indonesia": ("ID", "🇮🇩"), "Iran": ("IR", "🇮🇷"), "Iraq": ("IQ", "🇮🇶"),
    "Italy": ("IT", "🇮🇹"), "Japan": ("JP", "🇯🇵"), "Kazakhstan": ("KZ", "🇰🇿"),
    "Kenya": ("KE", "🇰🇪"), "Malaysia": ("MY", "🇲🇾"), "Mexico": ("MX", "🇲🇽"),
    "Morocco": ("MA", "🇲🇦"), "Nepal": ("NP", "🇳🇵"), "Netherlands": ("NL", "🇳🇱"),
    "Nigeria": ("NG", "🇳🇬"), "Pakistan": ("PK", "🇵🇰"), "Peru": ("PE", "🇵🇪"),
    "Philippines": ("PH", "🇵🇭"), "Poland": ("PL", "🇵🇱"), "Portugal": ("PT", "🇵🇹"),
    "Romania": ("RO", "🇷🇴"), "Russia": ("RU", "🇷🇺"), "Saudi Arabia": ("SA", "🇸🇦"),
    "Singapore": ("SG", "🇸🇬"), "South Africa": ("ZA", "🇿🇦"), "South Korea": ("KR", "🇰🇷"),
    "Spain": ("ES", "🇪🇸"), "Sri Lanka": ("LK", "🇱🇰"), "Thailand": ("TH", "🇹🇭"),
    "Turkey": ("TR", "🇹🇷"), "Ukraine": ("UA", "🇺🇦"), "United Arab Emirates": ("AE", "🇦🇪"),
    "United Kingdom": ("GB", "🇬🇧"), "United States": ("US", "🇺🇸"), "Uzbekistan": ("UZ", "🇺🇿"),
    "Vietnam": ("VN", "🇻🇳"),
}

CALLING_CODES = {
    "Argentina": "54", "Australia": "61", "Austria": "43", "Bangladesh": "880", "Belgium": "32",
    "Brazil": "55", "Canada": "1", "Chile": "56", "China": "86", "Colombia": "57", "Egypt": "20",
    "France": "33", "Germany": "49", "Hong Kong": "852", "India": "91", "Indonesia": "62",
    "Iran": "98", "Iraq": "964", "Italy": "39", "Japan": "81", "Kazakhstan": "7", "Kenya": "254",
    "Malaysia": "60", "Mexico": "52", "Morocco": "212", "Nepal": "977", "Netherlands": "31",
    "Nigeria": "234", "Pakistan": "92", "Peru": "51", "Philippines": "63", "Poland": "48",
    "Portugal": "351", "Romania": "40", "Russia": "7", "Saudi Arabia": "966", "Singapore": "65",
    "South Africa": "27", "South Korea": "82", "Spain": "34", "Sri Lanka": "94", "Thailand": "66",
    "Turkey": "90", "Ukraine": "380", "United Arab Emirates": "971", "United Kingdom": "44",
    "United States": "1", "Uzbekistan": "998", "Vietnam": "84",
}

ADDITIONAL_COUNTRY_DATA = {
    "Afghanistan": ("AF", "🇦🇫", "93"), "Albania": ("AL", "🇦🇱", "355"),
    "Algeria": ("DZ", "🇩🇿", "213"), "Angola": ("AO", "🇦🇴", "244"),
    "Armenia": ("AM", "🇦🇲", "374"), "Azerbaijan": ("AZ", "🇦🇿", "994"),
    "Bahamas": ("BS", "🇧🇸", "1"), "Bahrain": ("BH", "🇧🇭", "973"),
    "Belize": ("BZ", "🇧🇿", "501"), "Botswana": ("BW", "🇧🇼", "267"),
    "Cape Verde": ("CV", "🇨🇻", "238"), "Central African Republic": ("CF", "🇨🇫", "236"),
    "Chad": ("TD", "🇹🇩", "235"), "Comoros": ("KM", "🇰🇲", "269"),
    "Congo": ("CG", "🇨🇬", "242"), "Costa Rica": ("CR", "🇨🇷", "506"),
    "Cuba": ("CU", "🇨🇺", "53"), "Czech Republic": ("CZ", "🇨🇿", "420"),
    "Denmark": ("DK", "🇩🇰", "45"), "Djibouti": ("DJ", "🇩🇯", "253"),
    "Dominica": ("DM", "🇩🇲", "1"), "Dominican Republic": ("DO", "🇩🇴", "1"),
    "Ecuador": ("EC", "🇪🇨", "593"), "El Salvador": ("SV", "🇸🇻", "503"),
    "Estonia": ("EE", "🇪🇪", "372"), "Fiji": ("FJ", "🇫🇯", "679"),
    "Finland": ("FI", "🇫🇮", "358"), "Gabon": ("GA", "🇬🇦", "241"),
    "Georgia": ("GE", "🇬🇪", "995"), "Ghana": ("GH", "🇬🇭", "233"),
    "Greece": ("GR", "🇬🇷", "30"), "Greenland": ("GL", "🇬🇱", "299"),
    "Grenada": ("GD", "🇬🇩", "1"), "Guadeloupe": ("GP", "🇬🇵", "590"),
    "Guam": ("GU", "🇬🇺", "1"), "Guatemala": ("GT", "🇬🇹", "502"),
    "Guyana": ("GY", "🇬🇾", "592"), "Haiti": ("HT", "🇭🇹", "509"),
    "Honduras": ("HN", "🇭🇳", "504"), "Hungary": ("HU", "🇭🇺", "36"),
    "Iceland": ("IS", "🇮🇸", "354"), "Ireland": ("IE", "🇮🇪", "353"),
    "Israel": ("IL", "🇮🇱", "972"), "Ivory Coast": ("CI", "🇨🇮", "225"),
    "Jamaica": ("JM", "🇯🇲", "1"), "Jordan": ("JO", "🇯🇴", "962"),
    "Kiribati": ("KI", "🇰🇮", "686"), "Kuwait": ("KW", "🇰🇼", "965"),
    "Kyrgyzstan": ("KG", "🇰🇬", "996"), "Laos": ("LA", "🇱🇦", "856"),
    "Latvia": ("LV", "🇱🇻", "371"), "Lebanon": ("LB", "🇱🇧", "961"),
    "Lesotho": ("LS", "🇱🇸", "266"), "Libya": ("LY", "🇱🇾", "218"),
    "Lithuania": ("LT", "🇱🇹", "370"), "Luxembourg": ("LU", "🇱🇺", "352"),
    "Macau": ("MO", "🇲🇴", "853"), "Madagascar": ("MG", "🇲🇬", "261"),
    "Malawi": ("MW", "🇲🇼", "265"), "Maldives": ("MV", "🇲🇻", "960"),
    "Malta": ("MT", "🇲🇹", "356"), "Mauritania": ("MR", "🇲🇷", "222"),
    "Mauritius": ("MU", "🇲🇺", "230"), "Moldova": ("MD", "🇲🇩", "373"),
    "Mozambique": ("MZ", "🇲🇿", "258"), "Myanmar": ("MM", "🇲🇲", "95"),
    "New Zealand": ("NZ", "🇳🇿", "64"), "Nicaragua": ("NI", "🇳🇮", "505"),
    "Niger": ("NE", "🇳🇪", "227"), "Norway": ("NO", "🇳🇴", "47"),
    "Oman": ("OM", "🇴🇲", "968"), "Palau": ("PW", "🇵🇼", "680"),
    "Palestine": ("PS", "🇵🇸", "970"), "Panama": ("PA", "🇵🇦", "507"),
    "Papua New Guinea": ("PG", "🇵🇬", "675"), "Paraguay": ("PY", "🇵🇾", "595"),
    "Puerto Rico": ("PR", "🇵🇷", "1787"), "Qatar": ("QA", "🇶🇦", "974"),
    "Samoa": ("WS", "🇼🇸", "685"), "Senegal": ("SN", "🇸🇳", "221"),
    "Serbia": ("RS", "🇷🇸", "381"), "Seychelles": ("SC", "🇸🇨", "248"),
    "Sierra Leone": ("SL", "🇸🇱", "232"), "Slovenia": ("SI", "🇸🇮", "386"),
    "Solomon Islands": ("SB", "🇸🇧", "677"), "Somalia": ("SO", "🇸🇴", "252"),
    "South Sudan": ("SS", "🇸🇸", "211"), "Sudan": ("SD", "🇸🇩", "249"),
    "Suriname": ("SR", "🇸🇷", "597"), "Swaziland": ("SZ", "🇸🇿", "268"),
    "Sweden": ("SE", "🇸🇪", "46"), "Switzerland": ("CH", "🇨🇭", "41"),
    "Syria": ("SY", "🇸🇾", "963"), "Taiwan": ("TW", "🇹🇼", "886"),
    "Tajikistan": ("TJ", "🇹🇯", "992"), "Timor-Leste": ("TL", "🇹🇱", "670"),
    "Togo": ("TG", "🇹🇬", "228"), "Tonga": ("TO", "🇹🇴", "676"),
    "Trinidad and Tobago": ("TT", "🇹🇹", "1"), "Tunisia": ("TN", "🇹🇳", "216"),
    "Turkmenistan": ("TM", "🇹🇲", "993"), "Uganda": ("UG", "🇺🇬", "256"),
    "Uruguay": ("UY", "🇺🇾", "598"), "Vanuatu": ("VU", "🇻🇺", "678"),
    "Yemen": ("YE", "🇾🇪", "967"), "Zambia": ("ZM", "🇿🇲", "260"),
}
for _country_name, (_iso, _flag, _calling) in ADDITIONAL_COUNTRY_DATA.items():
    COUNTRY_CODES.setdefault(_country_name, (_iso, _flag))
    CALLING_CODES.setdefault(_country_name, _calling)

# Extra Server 1 country catalog entries. The third value is a stable button/API
# code used by callbacks; if the market rejects it, lookups fall back to the
# country name automatically.
MORE_SERVER1_COUNTRIES = """
Åland Islands|ALA|🇦🇽|358
American Samoa|ASM|🇦🇸|1
Andorra|AND|🇦🇩|376
Anguilla|AIA|🇦🇮|1
Antarctica|ATA|🇦🇶|672
Antigua and Barbuda|ATG|🇦🇬|1
Aruba|ABW|🇦🇼|297
Bahamas|BHS|🇧🇸|1
Barbados|BRB|🇧🇧|1
Belarus|BLR|🇧🇾|375
Benin|BEN|🇧🇯|229
Bermuda|BMU|🇧🇲|1
Bhutan|BTN|🇧🇹|975
Bolivia|BOL|🇧🇴|591
Bosnia and Herzegovina|BIH|🇧🇦|387
Bouvet Island|BVT|🇧🇻|47
British Indian Ocean Territory|IOT|🇮🇴|246
British Virgin Islands|VGB|🇻🇬|1
Brunei|BRN|🇧🇳|673
Bulgaria|BGR|🇧🇬|359
Burkina Faso|BFA|🇧🇫|226
Burundi|BDI|🇧🇮|257
Cambodia|KHM|🇰🇭|855
Cameroon|CMR|🇨🇲|237
Canary Islands|CNR|🇮🇨|34
Caribbean Netherlands|BES|🇧🇶|599
Cayman Islands|CYM|🇰🇾|1
Congo (DRC)|COD|🇨🇩|243
Cook Islands|COK|🇨🇰|682
Côte d’Ivoire|CIV|🇨🇮|225
Croatia|HRV|🇭🇷|385
Curaçao|CUW|🇨🇼|599
Cyprus|CYP|🇨🇾|357
Czechia|CZE|🇨🇿|420
Equatorial Guinea|GNQ|🇬🇶|240
Eritrea|ERI|🇪🇷|291
Eswatini|SWZ|🇸🇿|268
Ethiopia|ETH|🇪🇹|251
Falkland Islands|FLK|🇫🇰|500
Faroe Islands|FRO|🇫🇴|298
French Guiana|GUF|🇬🇫|594
French Polynesia|PYF|🇵🇫|689
French Southern Territories|ATF|🇹🇫|262
Gambia|GMB|🇬🇲|220
Gibraltar|GIB|🇬🇮|350
Guernsey|GGY|🇬🇬|44
Guinea|GIN|🇬🇳|224
Guinea-Bissau|GNB|🇬🇼|245
Heard Island and McDonald Islands|HMD|🇭🇲|672
Isle of Man|IMN|🇮🇲|44
Jersey|JEY|🇯🇪|44
Kosovo|XKX|🇽🇰|383
Liberia|LBR|🇱🇷|231
Liechtenstein|LIE|🇱🇮|423
Mali|MLI|🇲🇱|223
Marshall Islands|MHL|🇲🇭|692
Martinique|MTQ|🇲🇶|596
Mayotte|MYT|🇾🇹|262
Micronesia|FSM|🇫🇲|691
Monaco|MCO|🇲🇨|377
Mongolia|MNG|🇲🇳|976
Montenegro|MNE|🇲🇪|382
Montserrat|MSR|🇲🇸|1
Namibia|NAM|🇳🇦|264
Nauru|NRU|🇳🇷|674
New Caledonia|NCL|🇳🇨|687
Niue|NIU|🇳🇺|683
Norfolk Island|NFK|🇳🇫|672
North Korea|PRK|🇰🇵|850
North Macedonia|MKD|🇲🇰|389
Northern Mariana Islands|MNP|🇲🇵|1
Pitcairn Islands|PCN|🇵🇳|64
Réunion|REU|🇷🇪|262
Rwanda|RWA|🇷🇼|250
Saint Barthélemy|BLM|🇧🇱|590
Saint Helena|SHN|🇸🇭|290
Saint Kitts and Nevis|KNA|🇰🇳|1
Saint Lucia|LCA|🇱🇨|1
Saint Martin|MAF|🇲🇫|590
Saint Pierre and Miquelon|SPM|🇵🇲|508
Saint Vincent and the Grenadines|VCT|🇻🇨|1
San Marino|SMR|🇸🇲|378
São Tomé and Príncipe|STP|🇸🇹|239
Sint Maarten|SXM|🇸🇽|1
Slovakia|SVK|🇸🇰|421
South Georgia and South Sandwich Islands|SGS|🇬🇸|500
Svalbard and Jan Mayen|SJM|🇸🇯|47
Tanzania|TZA|🇹🇿|255
Tokelau|TKL|🇹🇰|690
Turks and Caicos Islands|TCA|🇹🇨|1
Tuvalu|TUV|🇹🇻|688
Vatican City|VAT|🇻🇦|379
Venezuela|VEN|🇻🇪|58
U.S. Virgin Islands|VIR|🇻🇮|1
Wallis and Futuna|WLF|🇼🇫|681
Western Sahara|ESH|🇪🇭|212
Zimbabwe|ZWE|🇿🇼|263
"""
for _line in MORE_SERVER1_COUNTRIES.strip().splitlines():
    _name, _code, _flag, _calling = _line.split("|")
    COUNTRY_CODES.setdefault(_name, (_code, _flag))
    CALLING_CODES.setdefault(_name, _calling)

class ConversationCancelled(Exception):
    pass

# ================= TELETHON CLIENT & DB INSTANTIATION =================
session_name = f"bot_session_{BOT_TOKEN.split(':')[0]}"
bot = TelegramClient(session_name, API_ID, API_HASH)
bot.parse_mode = 'html'

BOT_DATABASE = os.getenv("BOT_DATABASE", "otp_bot_final.db")
db = sqlite3.connect(BOT_DATABASE, check_same_thread=False, timeout=20)
db.execute("PRAGMA journal_mode=WAL;")
cur = db.cursor()

# ================= GLOBAL TRACKING DICTIONARIES =================
active_orders = {}
deposit_input = {}
admin_dep_state = {}
user_spam_cooldown = {}
session_buy_state = {}
transfer_state = {}
reseller_state = {}
admin_upload_tier = {}
sell_state = {}
user_locks = {}
user_filters = {}
manual_dep_state = {}
fampay_deposit_state = set()
fampay_gateway_selection = {}
fampay_check_locks = {}
fampay_error_cooldowns = {}
fampay_review_state = {}
deposit_media_messages = {}
promo_state = {}
payment_admin_state = {}
selling_accounts = {}
cached_lzt_stock = {}
active_filter_keys = {"no_no_any_any_any"}
active_fights = {}
active_giveaways = {}
error_cooldowns = {}
lzt_search_state = {}
server3_search_state = set()
server4_search_state = {}
server4_country_search_state = {}
provider_sort_state = {}
server3_purchase_state = {}
server4_purchase_state = {}
smm_state = {}
smm_search_results = {}
active_lzt_purchases = {}
restore_state = {}
giveaway_ticket_state = {}
_lzt_missing_logged = False
_lzt_session = None
_lzt_rate_lock = asyncio.Lock()
_lzt_last_request_at = 0.0
_lzt_blocked_until = 0.0

# ================= STABLE CORE HELPER FUNCTIONS =================
def p_btn(text, data=None, url=None, style=None, icon_custom_emoji_id=None):
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

async def bot_api_edit_text(event,text,keyboard):
    """Use Telegram's HTML parser for expandable blockquotes."""
    message_id=getattr(event,"message_id",None) or getattr(event,"id",None);chat_id=getattr(event,"chat_id",None)
    if not message_id or not chat_id:return False
    payload={"chat_id":chat_id,"message_id":message_id,"text":text,"parse_mode":"HTML",
             "reply_markup":{"inline_keyboard":keyboard}}
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as session:
            async with session.post(f"https://api.telegram.org/bot{BOT_TOKEN}/editMessageText",json=payload) as response:
                result=await response.json(content_type=None)
        return bool(result.get("ok"))
    except (aiohttp.ClientError,asyncio.TimeoutError,ValueError):
        return False

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

def premium_emoji_id(name):
    value = PREMIUM_EMOJI_IDS.get(name, "")
    return int(value) if str(value).isdigit() else None

def premium_button(text, data=None, url=None, style=None, emoji_name=None):
    return p_btn(text, data=data, url=url, style=style, icon_custom_emoji_id=premium_emoji_id(emoji_name or ""))

def apply_custom_emoji_entities(text, markers):
    """Replace marker tokens with fallback emoji and return UTF-16 based entities."""
    entities = []
    rendered = text
    custom_emoji_entity = getattr(tl_types, "MessageEntityCustomEmoji", None)
    for marker, fallback, emoji_name in markers:
        custom_id = premium_emoji_id(emoji_name)
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

async def safe_show_rich_message(e, text, buttons=None, entities=None, link_preview=False):
    if not entities:
        return await safe_show_message(e, text, buttons=buttons, link_preview=link_preview)
    if is_callback_event(e) and hasattr(e, "edit"):
        try:
            return await e.edit(text, buttons=buttons, formatting_entities=entities, link_preview=link_preview)
        except TypeError:
            return await safe_show_message(e, text, buttons=buttons, link_preview=link_preview)
        except MessageNotModifiedError:
            return None
    try:
        return await e.respond(text, buttons=buttons, formatting_entities=entities, link_preview=link_preview)
    except TypeError:
        return await safe_show_message(e, text, buttons=buttons, link_preview=link_preview)

def get_user_lock(uid):
    if uid not in user_locks:
        user_locks[uid] = asyncio.Lock()
    return user_locks[uid]

def get_user_filters(uid):
    default = {"spam": "no", "geoblock": "no", "offline": "any", "login_mail": "any", "premium": "any", "sort": "az"}
    if uid not in user_filters:
        user_filters[uid] = default.copy()
    else:
        for key, value in default.items():
            user_filters[uid].setdefault(key, value)
    return user_filters[uid]

def get_filter_key(flt):
    return "_".join(str(flt.get(k, "any")) for k in ("spam", "geoblock", "offline", "login_mail", "premium"))

def as_boolish(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return value not in (0, -1)
    return str(value).strip().lower() in ("1", "true", "yes", "y", "on")

def lzt_item_matches_filters(item, flt):
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

def filter_lzt_items(items, flt):
    return [item for item in items if lzt_item_matches_filters(item, flt)]

def lzt_price_currency(item):
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
    return LZT_PRICE_CURRENCY

def lzt_currency_to_inr_rate(currency):
    currency = str(currency or LZT_PRICE_CURRENCY).strip().lower()
    if currency == "usd":
        return get_usdt_rate()
    rate_defaults = {
        "rub": 1.05,
        "eur": 100.0,
        "gbp": 118.0,
        "cny": 13.0,
        "uah": 2.3,
        "kzt": 0.2,
        "byn": 29.0,
        "try": 2.9,
        "jpy": 0.62,
        "brl": 17.0,
    }
    return get_rate(f"{currency}_inr_rate", rate_defaults.get(currency, 1.05))

def lzt_currency_params(extra=None):
    params = dict(extra or {})
    params.setdefault("currency", LZT_PRICE_CURRENCY)
    return params

def lzt_price_breakdown(item, markup_percent):
    raw_price = item.get("price_with_fee") or item.get("priceWithSellerFee") or item.get("price") or 0
    try:
        market_price = float(raw_price)
    except (TypeError, ValueError):
        market_price = 0.0
    currency = lzt_price_currency(item)
    inr_base = market_price * lzt_currency_to_inr_rate(currency)
    try:
        markup_percent = int(float(markup_percent))
    except (TypeError, ValueError):
        markup_percent = 20
    markup_amount = max(0, int(round(inr_base * (markup_percent / 100))))
    base_price = max(0, int(round(inr_base)))
    final_price = max(1, base_price + markup_amount)
    return {
        "market_price": market_price,
        "currency": currency.upper(),
        "base_inr": base_price,
        "markup_percent": markup_percent,
        "markup_inr": markup_amount,
        "final_inr": final_price,
    }

def lzt_final_inr_price(item, markup_percent):
    return lzt_price_breakdown(item, markup_percent)["final_inr"]

def get_lzt_markup(country_name):
    candidates = [country_name]
    if country_name in COUNTRY_CODES:
        iso = COUNTRY_CODES[country_name][0]
        candidates.extend([iso, iso.upper(), get_country_button_code(country_name)])
    row = None
    for candidate in dict.fromkeys(candidates):
        row = cur.execute("SELECT markup_percent FROM lzt_settings WHERE LOWER(country)=LOWER(?)", (candidate,)).fetchone()
        if row:
            break
    if not row:
        row = cur.execute("SELECT value FROM settings WHERE key='lzt_global_markup'").fetchone()
    try:
        return int(float(row[0])) if row else 20
    except (TypeError, ValueError):
        return 20

def clear_lzt_cache():
    cached_lzt_stock.clear()

def build_country_markup_buttons(page=1, per_page=20):
    countries = sorted(COUNTRY_CODES.keys())
    total_pages = max(1, (len(countries) + per_page - 1) // per_page)
    page = min(max(1, int(page)), total_pages)
    start = (page - 1) * per_page
    buttons, row = [], []
    for name in countries[start:start + per_page]:
        markup = get_lzt_markup(name)
        row.append(p_btn(f"{country_button_label(name, include_phone=False)} {markup}%", f"adm_cmark|{COUNTRY_CODES[name][0]}"))
        if len(row) == 2:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)
    nav = []
    if page > 1:
        nav.append(p_btn("⬅ Prev", f"adm_cmarkpg|{page-1}"))
    if page < total_pages:
        nav.append(p_btn("Next ➡", f"adm_cmarkpg|{page+1}"))
    if nav:
        buttons.append(nav)
    buttons.append([p_btn("Back", "adm_lztset")])
    return buttons, page, total_pages

def lzt_candidate_timestamp(container):
    if not isinstance(container, dict):
        return 0
    for key in ("date", "time", "created_at", "createdDate", "timestamp"):
        value = container.get(key)
        try:
            return int(float(value))
        except (TypeError, ValueError):
            continue
    return 0

def collect_lzt_otp_candidates(value, parent_key="", candidates=None, depth=0):
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
                # Preserve API order as a weak freshness signal if no date exists.
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

def extract_lzt_otp(res):
    candidates = collect_lzt_otp_candidates(res)
    if not candidates:
        return None
    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return candidates[0][2]

async def get_verified_lzt_otp(item_id, attempts=3, delay=1.5):
    """Fetch Server 1 OTP more than once and always return a found code.

    A code seen twice is marked verified. If the market only returns it once
    before a transient error/rate-limit, the bot still returns that latest code
    instead of hiding it from the buyer.
    """
    seen = []
    last_response = None
    for _ in range(max(1, attempts)):
        res = await lzt_request('GET', f"/{item_id}/telegram-login-code")
        last_response = res
        code = extract_lzt_otp(res)
        if code:
            seen.append(code)
            if seen.count(code) >= 2 or attempts == 1:
                return code, True, res
        await asyncio.sleep(delay)
    return (seen[-1], False, last_response) if seen else (None, False, last_response)


def lzt_purchase_has_error(res):
    if not res:
        return True
    if not isinstance(res, dict):
        return False
    for key in ("error", "errors", "error_description"):
        value = res.get(key)
        if value:
            return True
    return False

def lzt_purchase_item_id(res, fallback_item_id):
    if isinstance(res, dict):
        item = res.get("item") or res.get("account") or res.get("telegram")
        if isinstance(item, dict):
            return str(item.get("item_id") or item.get("id") or fallback_item_id)
        for key in ("item_id", "id"):
            if res.get(key):
                return str(res.get(key))
    return str(fallback_item_id)

def normalize_lzt_phone(raw_phone, fallback_item_id):
    phone = str(raw_phone or "").strip()
    if not phone or phone.startswith("LZT_"):
        return f"Hidden-{fallback_item_id}"
    compact = phone.replace(" ", "")
    return f"+{compact.lstrip('+')}" if compact.lstrip("+").isdigit() else phone

async def try_lzt_reset_authorizations(item_id):
    try:
        res = await lzt_request('POST', f"/{item_id}/telegram-reset-authorizations")
        if isinstance(res, dict) and res.get('errors'):
            logger.info("Server 1 authorization reset skipped for item %s: %s", item_id, res.get('errors'))
            return False
        return bool(res)
    except Exception as ex:
        logger.info("Server 1 authorization reset failed for item %s: %s", item_id, ex)
        return False

def lzt_market_price(item):
    if not isinstance(item, dict):
        return None
    raw_price = item.get("price_with_fee") or item.get("priceWithSellerFee") or item.get("price")
    try:
        price = float(raw_price)
    except (TypeError, ValueError):
        return None
    return price if price > 0 else None

def lzt_item_requires_password(item):
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

def lzt_item_country_name(item, fallback=None):
    if isinstance(item, dict):
        for key in ("country", "telegram_country", "country_name", "countryName"):
            value = item.get(key)
            if value:
                value = str(value).strip()
                for name, (iso, _flag) in COUNTRY_CODES.items():
                    if value.lower() in (name.lower(), iso.lower()):
                        return name
                matches = find_country_matches(value)
                if matches:
                    return matches[0]
        phone = item.get("phone") or item.get("telegram_phone") or item.get("login")
        if phone:
            return get_country_info(str(phone))[0]
    return fallback or "Unknown"

def lzt_updated_market_price_from_error(res):
    text = lzt_error_text(res)
    match = re.search(r"costs now\s+([0-9]+(?:\.[0-9]+)?)", text, re.IGNORECASE)
    if match:
        try:
            return float(match.group(1))
        except (TypeError, ValueError):
            return None
    return None

def lzt_error_text(res):
    if not isinstance(res, dict):
        return str(res or "")
    parts = []
    for key in ("error", "errors", "error_description", "message", "detail"):
        value = res.get(key)
        if value:
            parts.append(str(value))
    return " | ".join(parts)

def lzt_should_retry_purchase(res):
    text = lzt_error_text(res).lower()
    return "retry_request" in text or "retry request" in text

async def lzt_fast_buy_item(item_id, market_price):
    current_price = market_price
    last_res = None
    for attempt in range(1, max(1, LZT_FAST_BUY_RETRIES) + 1):
        body = {"price": current_price} if current_price is not None else None
        last_res = await lzt_request('POST', f"/{item_id}/fast-buy", params=lzt_currency_params(), data=body, return_error=True)
        if last_res and not lzt_purchase_has_error(last_res):
            return last_res

        updated_price = lzt_updated_market_price_from_error(last_res)
        if updated_price and updated_price > 0:
            current_price = updated_price
            await asyncio.sleep(0.5)
            continue

        if not lzt_should_retry_purchase(last_res):
            return last_res
        await asyncio.sleep(min(3, 0.5 + (attempt * 0.1)))
    return last_res

def is_private_event(e):
    chat_id = getattr(e, "chat_id", None)
    sender_id = getattr(e, "sender_id", None)
    if chat_id is None or sender_id is None:
        return True
    return int(chat_id) == int(sender_id)

def is_admin_callback_data(data):
    admin_prefixes = (
        "dep_act|", "kp_adm|", "wd_act|", "adm_", "adm",
        "apset|", "sp|", "price|", "pay_", "toggle_"
    )
    return str(data or "").startswith(admin_prefixes)

def callback_allowed_in_chat(uid, data, e):
    if is_private_event(e):
        return True
    # Administrators may operate every bot menu from configured groups/channels.
    return is_admin(uid)

def mask_phone_number(phone):
    raw = str(phone or "").strip()
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return "Hidden"
    if len(digits) <= 4:
        return "+" + "*" * len(digits)
    if len(digits) <= 8:
        return "+" + digits[:2] + "**" + digits[-2:]
    return "+" + digits[:4] + "**" + digits[-3:]

async def get_user_log_label(uid):
    try:
        ent = await bot.get_entity(uid)
        username = f"@{ent.username}" if getattr(ent, "username", None) else "No username"
        name = html.escape((getattr(ent, "first_name", None) or str(uid)).strip())
        return f"{name} ({username}) | <code>{uid}</code>"
    except Exception:
        return f"<code>{uid}</code>"

async def send_log_message(text, channel_id=PUBLIC_LOG_CHANNEL_ID, label="Log"):
    try:
        await bot.send_message(channel_id, text)
    except Exception as log_ex:
        await send_admin_error(f"{label} channel send failed", str(log_ex))

async def send_dual_log(admin_text, public_text):
    await send_log_message(admin_text, ADMIN_LOG_CHANNEL_ID, "Admin log")
    await send_log_message(public_text, PUBLIC_LOG_CHANNEL_ID, "Public log")

async def log_primary_deposit(uid, amount, method):
    logger.info("Deposit credited: user=%s amount=%s method=%s", uid, amount, method)
    user_label = await get_user_log_label(uid)
    public_text = (
        "🚀 <b>New Deposit Success</b>\n\n"
        f"<b>Amount:</b> ₹{amount}\n"
        f"<b>Payment Method:</b> {html.escape(str(method))}\n\n"
        "Thanks For Deposit"
    )
    admin_text = (
        "🚀 <b>New Deposit Success</b>\n\n"
        f"<b>User:</b> {user_label}\n"
        f"<b>Amount:</b> ₹{amount}\n"
        f"<b>Payment Method:</b> {html.escape(str(method))}\n\n"
        "Thanks For Deposit"
    )
    await send_dual_log(admin_text, public_text)
    await process_referral_bonus(uid, int(amount))

async def bot_public_handle():
    try:
        me=await bot.get_me()
        return f"@{me.username}" if getattr(me,"username",None) else "this bot"
    except Exception:
        return "this bot"

async def log_primary_purchase(uid, country, price, paid, year, qty, phone=None, server=None, order_id=None):
    logger.info("Purchase completed: user=%s country=%s price=%s paid=%s year=%s qty=%s phone=%s server=%s", uid, country, price, paid, year, qty, phone, server)
    user_label = await get_user_log_label(uid)
    handle=await bot_public_handle()
    public_text = (
        "📅 <b>New Purchase Success</b>\n\n"
        f"<b>Amount:</b> {qty}\n"
        f"<b>Price:</b> ₹{price}\n"
        f"<b>Country:</b> {html.escape(str(country or 'Unknown'))}\n"
        f"<b>Number:</b> <code>{mask_phone_number(phone)}</code>\n"
        f"<b>Server:</b> {html.escape(str(server or 'Unknown'))}\n"
        f"<b>Order ID:</b> <code>{html.escape(str(order_id or 'N/A'))}</code>\n\n"
        f"Thanks for Purchase {html.escape(handle)} 🔄"
    )
    admin_text = (
        "📅 <b>New Purchase Success</b>\n\n"
        f"<b>User:</b> {user_label}\n"
        f"<b>Amount:</b> {qty}\n"
        f"<b>Price:</b> ₹{price}\n"
        f"<b>Country:</b> {html.escape(str(country or 'Unknown'))}\n"
        f"<b>Number:</b> <code>{mask_phone_number(phone)}</code>\n"
        f"<b>Server:</b> {html.escape(str(server or 'Unknown'))}\n"
        f"<b>Order ID:</b> <code>{html.escape(str(order_id or 'N/A'))}</code>\n\n"
        "Thanks for Purchase"
    )
    await send_dual_log(admin_text, public_text)
    try:
        await process_reseller_commission(uid, paid or price, f"{server or 'Store'} Purchase")
    except Exception as ex:
        logger.warning("Reseller commission trigger error: %s", ex)

async def log_smm_purchase(uid, link, price, service, order_id):
    user_label=await get_user_log_label(uid);handle=await bot_public_handle()
    public_text=("📅 <b>New Order Success</b>\n\n<b>Link:</b> hidden\n"
                 f"<b>Price:</b> ₹{format_smm_money(price)}\n<b>Service:</b> {html.escape(str(service))}\n"
                 f"<b>Order ID:</b> <code>{html.escape(str(order_id))}</code>\n<b>Server:</b> Server 5\n\n"
                 f"Thanks for Purchase {html.escape(handle)} 🔄")
    admin_text=("📅 <b>New Order Success</b>\n\n"
                f"<b>User:</b> {user_label}\n<b>Link:</b> <code>{html.escape(str(link))}</code>\n"
                f"<b>Price:</b> ₹{format_smm_money(price)}\n<b>Service:</b> {html.escape(str(service))}\n"
                f"<b>Order ID:</b> <code>{html.escape(str(order_id))}</code>\n<b>Server:</b> Server 5")
    await send_dual_log(admin_text,public_text)
    try:
        await process_reseller_commission(uid, int(price), f"Server 5: {service}")
    except Exception as ex:
        logger.warning("Reseller commission trigger error for SMM: %s", ex)

async def send_main_menu(e, uid):
    ensure_user(uid)
    bal_row = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()
    bal = bal_row[0] if bal_row else 0
    support_handle = "@patelkrish_99Bot"
    msg_template = ("{store} TG-Store - Buy and Sell Accounts {store}\n\n"
                    "{account} Your account ID | " + str(uid) + "\n"
                    "{balance} Total balance | " + format_price(uid, bal) + "\n"
                    "{help_icon} Help | " + support_handle)
    msg, entities = apply_custom_emoji_entities(msg_template, [
        ("{store}", P_STORE, "store"),
        ("{account}", P_ACC, "account"),
        ("{balance}", P_CASH, "balance"),
        ("{help_icon}", "✆", "help"),
    ])
    btns = [
        [premium_button("Shop Now", "menu_buy", style="success", emoji_name="buy")],
        [premium_button("TopUp Balance ( Deposit )", "menu_deposit", style="danger", emoji_name="topup")],
        [premium_button("Account", "menu_account", style="primary", emoji_name="account"), premium_button("History", "menu_history", style="primary", emoji_name="history")],
        [premium_button("⫶☰ Sales", url="https://t.me/PIRO_BUYERS_KP", style="primary", emoji_name="sales"), premium_button("✆ Help", url="https://t.me/Patelkrish_99Bot", style="primary", emoji_name="help")],
    ]
    if is_admin(uid):
        btns.append([premium_button("Admin Dashboard", "adm_adminmain", emoji_name="admin")])
    return await safe_show_rich_message(e, msg, buttons=btns, entities=entities)

async def send_terms_or_main_menu(e, uid):
    row = cur.execute("SELECT terms_accepted FROM users WHERE user_id=?", (uid,)).fetchone()
    if not row or not row[0]:
        btns = [
            [p_btn("📜 Read Terms", url=TERMS_URL)],
            [p_btn("✅ Accept", "tc_accept", style="success"), p_btn("❌ Reject", "tc_reject", style="danger")]
        ]
        text = f"{P_DOC} <b>TERMS & CONDITIONS</b>\nPlease read and accept our Terms."
        return await safe_show_message(e, text, buttons=btns)
    return await send_main_menu(e, uid)


def country_slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")

def find_country_by_slug(slug):
    normalized = slug.strip().lower().replace("_", "-")
    for name in COUNTRY_CODES:
        if country_slug(name) == normalized:
            return name
    matches = find_country_matches(normalized.replace("-", " "))
    return matches[0] if matches else None

def get_country_button_code(name):
    special = {"India": "IND"}
    if name in special:
        return special[name]
    return COUNTRY_CODES.get(name, ("", ""))[0] or name[:3].upper()

def country_button_label(name, price_text=None, include_phone=True):
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

def find_country_matches(query):
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

async def render_server1_country_page(e, uid, page):
    if not resolve_lzt_token():
        if is_admin(uid):
            await bot.send_message(uid, f"{P_WARN} <b>Server 1 token missing.</b>\nPlease set token first.", buttons=[[p_btn("Set Token", "adm_setlzttoken")]])
        return await safe_answer_cb(e, "Server 1 credentials missing. Please notify admin.", alert=True)
    if not is_server1_online():
        return await safe_answer_cb(e, "Server 1 is under maintenance!", alert=True)

    limit = 20
    flt = get_user_filters(uid)
    fkey = get_filter_key(flt)
    active_filter_keys.add(fkey)
    stock_dict = cached_lzt_stock.get(fkey, cached_lzt_stock.get("no_no_any_any_any", {}))

    sorted_countries = sorted(COUNTRY_CODES.keys())
    sort_mode = flt.get("sort", "az")
    if sort_mode == "stock_high":
        sorted_countries.sort(key=lambda n: (stock_dict.get(n, (0, 0))[0], n), reverse=True)
    elif sort_mode == "stock_low":
        sorted_countries.sort(key=lambda n: (stock_dict.get(n, (0, 0))[0], n))
    elif sort_mode == "price_low":
        sorted_countries.sort(key=lambda n: (stock_dict.get(n, (0, 0))[1] or 10**9, n))
    elif sort_mode == "price_high":
        sorted_countries.sort(key=lambda n: (stock_dict.get(n, (0, 0))[1], n), reverse=True)

    total = len(sorted_countries)
    total_pages = max(1, (total + limit - 1) // limit)
    page = min(max(1, page), total_pages)
    offset = (page - 1) * limit
    page_countries = sorted_countries[offset:offset + limit]
    total_bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]

    me = await bot.get_me()
    all_link = f"https://t.me/{me.username}?start=AllServer1"
    msg = (f"<b>Click country to view price and stock:</b>\n"
           f"––––––––––––————––•\n"
           f"✅ Total balance: {format_price(uid, total_bal)} \n"
           f"✅ Server: Server (1)\n"
           f"✅ Page {page} of {total_pages}\n"
           f'✅ View all <a href="{all_link}">countries</a>\n'
           f"➖➖➖➖➖➖➖➖➖➖")

    sort_labels = {"az": "A-Z", "stock_high": "Stock High-Low", "stock_low": "Stock Low-High", "price_low": "Price Low-High", "price_high": "Price High-Low"}
    btns, row = [[p_btn("⚙️ Filters", "lzt_toggle_filters", style="primary"), p_btn(f"↕️ {sort_labels.get(sort_mode, 'A-Z')}", "lzt_sort_menu", style="primary")]], []
    for name in page_countries:
        iso_code, flag = COUNTRY_CODES[name]
        ccode = CALLING_CODES.get(name, "")
        count, min_p = stock_dict.get(name, (0, 0.0))
        price_part = format_price(uid, min_p) if count else "0"
        label = country_button_label(name, price_part)
        row.append(p_btn(label, f"lzt_chk|{iso_code}|1"))
        if len(row) == 2:
            btns.append(row)
            row = []
    if row:
        btns.append(row)

    page_row = []
    window_start = max(1, min(page - 2, total_pages - 4))
    window_end = min(total_pages, window_start + 4)
    for pg in range(window_start, window_end + 1):
        text = f"[{pg}]" if pg != page else f"·{pg}·"
        page_row.append(p_btn(text, f"srv_1_pg|{pg}"))
    if page_row:
        btns.append(page_row)

    btns.append([p_btn("⛶ Show All", "lzt_all_countries", style="danger"), p_btn("ᯤ Search", "lzt_search_country", style="danger")])
    btns.append([p_btn("Back", "menu_buy")])
    await safe_show_message(e, msg, buttons=btns)

def is_bot_online():
    row = cur.execute("SELECT value FROM settings WHERE key='bot_status'").fetchone()
    return row[0] == 'on' if row else True

def is_server1_online():
    row = cur.execute("SELECT value FROM settings WHERE key='server1_status'").fetchone()
    return row[0] == 'on' if row else True

def is_method_on(key, default='on'):
    row = cur.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return (row[0] if row and row[0] else default) == 'on'

def is_force_join_enabled():
    return is_method_on("force_join_status", default="on")

def is_admin(uid):
    return uid in ADMIN_IDS or bool(cur.execute("SELECT user_id FROM admins WHERE user_id=?", (uid,)).fetchone())

def has_perm(uid, perm):
    if uid in ADMIN_IDS: return True
    row = cur.execute(f"SELECT {perm} FROM admins WHERE user_id=?", (uid,)).fetchone()
    return bool(row and row[0] == 1)

def is_user_banned(uid):
    row = cur.execute("SELECT banned FROM users WHERE user_id=?", (uid,)).fetchone()
    return bool(row and row[0] == 1)

def ensure_user(uid):
    cur.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (uid,))
    db.commit()

def get_usdt_rate():
    try: return float(cur.execute("SELECT value FROM settings WHERE key='usdt_rate'").fetchone()[0])
    except: return 94.0

def get_rate(key, default):
    try:
        row = cur.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return float(row[0]) if row and row[0] else float(default)
    except:
        return float(default)

def get_currency_pref(uid):
    row = cur.execute("SELECT pref_curr FROM users WHERE user_id=?", (uid,)).fetchone()
    pref = (row[0] if row and row[0] else "INR").upper()
    if pref == "USD":
        pref = "USDT"
    return pref if pref in ("INR", "USDT") else "INR"

def format_inr_amount(inr_amt):
    try:
        amount = float(inr_amt)
    except (TypeError, ValueError):
        amount = 0.0
    return f"₹{amount:.0f}" if amount.is_integer() else f"₹{amount:.2f}"

def format_usdt_amount(inr_amt, suffix=" USDT"):
    try:
        usdt = float(inr_amt) / get_usdt_rate()
    except (TypeError, ValueError):
        usdt = 0.0
    return f"{usdt:.2f}{suffix}"

def format_compact_usdt(inr_amt):
    try:
        usdt = float(inr_amt) / get_usdt_rate()
    except (TypeError, ValueError):
        usdt = 0.0
    formatted = f"{usdt:.2f}".rstrip("0").rstrip(".")
    if not formatted:
        formatted = "0"
    return f"{formatted} USDT"

def format_usd_amount(inr_amt, suffix=" USDT"):
    return format_usdt_amount(inr_amt, suffix)

def format_compact_usd(inr_amt):
    return format_compact_usdt(inr_amt)

def format_price(uid, inr_amt):
    pref = get_currency_pref(uid)
    if pref == "USDT":
        return format_compact_usdt(inr_amt)
    return format_inr_amount(inr_amt)

def parse_db_datetime(value):
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

def format_purchase_datetime(value):
    parsed = parse_db_datetime(value)
    if not parsed:
        return str(value)
    if parsed.date() == datetime.now(timezone.utc).date():
        return f"Today {parsed.strftime('%H:%M:%S')} UTC"
    return parsed.strftime("%a %b %d %H:%M:%S %Y")

def update_balance(uid, amount, bal_type="balance"):
    cur.execute(f"UPDATE users SET {bal_type} = {bal_type} + ? WHERE user_id=?", (amount, uid))
    db.commit()

def get_support_url():
    res = cur.execute("SELECT value FROM settings WHERE key='support_url'").fetchone()
    url = res[0] if res and res[0] else "https://t.me/patelkrish_99Bot"
    url = url.strip()
    if not url.startswith("http://") and not url.startswith("https://"):
        if url.startswith("@"):
            url = "https://t.me/" + url[1:]
        elif "t.me/" in url:
            url = "https://" + url.lstrip("/")
        else:
            url = "https://t.me/" + url
    return url

def generate_random_password(length=12):
    return ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(length))

def delete_session_files(session_path):
    base = session_path if not session_path.endswith('.session') else session_path[:-8]
    for ext in ['.session', '.session-wal', '.session-shm', '.session-journal']:
        try:
            if os.path.exists(base + ext): os.remove(base + ext)
        except: pass


async def remove_invalid_server2_session(phone, session_file, reason):
    """Remove a dead Server 2 session without leaking credentials."""
    safe_phone = str(phone or "").lstrip("+")
    cur.execute("DELETE FROM stock WHERE phone=?", (safe_phone,))
    db.commit()
    delete_session_files(session_file)
    await send_admin_error("Server 2 invalid session removed", f"Phone: +{safe_phone}\nReason: {html.escape(str(reason))[:300]}")

async def check_channel_joined(uid):
    if not is_force_join_enabled(): return True
    if is_admin(uid): return True
    for ch in CHECK_CHANNELS:
        try:
            entity = await bot.get_entity(int(ch) if ch.lstrip('-').isdigit() else ch)
            await bot(GetParticipantRequest(channel=entity, participant=uid))
        except UserNotParticipantError:
            return False
        except Exception as ex:
            logger.debug(f"Channel join check fail-safe bypass: {ex}")
            return True
    return True

def get_flag_by_country_name(name):
    if name in COUNTRY_CODES:
        return COUNTRY_CODES[name][1]
    try:
        row = cur.execute("SELECT flag FROM custom_countries WHERE name=?", (name,)).fetchone()
        if row: return row[0]
    except: pass
    return "🌍"

def managed_server_name(number):
    managed = server3 if number == 3 else server4
    return managed.config().display_name or f"Server {number}"

def provider_country_display(name):
    """Add a flag when a provider server embeds a country in its label."""
    clean = " ".join(str(name or "").split())
    folded = clean.casefold()
    aliases = {
        "indian": "India", "india": "India", "usa": "United States",
        "uk": "United Kingdom", "philippine": "Philippines",
        "south africa": "South Africa", "sri lanka": "Sri Lanka",
    }
    alias_matches = [country for alias, country in aliases.items()
                     if re.search(rf"(?<![a-z]){re.escape(alias)}(?:s)?(?![a-z])", folded)]
    matches = [country for country in COUNTRY_CODES
               if re.search(rf"(?<![a-z]){re.escape(country.casefold())}(?![a-z])", folded)]
    country = max(alias_matches + matches, key=len) if alias_matches or matches else clean
    return f"{get_flag_by_country_name(country)} {clean}"

def provider_phone_details(phone):
    """Normalize an allocated number and derive flag, full, and local forms."""
    digits = re.sub(r"\D", "", str(phone or ""))
    if digits.startswith("00"):
        digits = digits[2:]
    country, flag, calling_code = get_country_info(digits)
    local = digits[len(calling_code):] if calling_code != "0" and digits.startswith(calling_code) else digits
    return {"country": country, "flag": flag, "full": f"+{digits}", "local": local or digits}

def provider_sort(uid, number):
    return provider_sort_state.get((uid, number), "az")

def normalize_smm_target(value):
    """Keep provider-specific targets intact while removing copy controls."""
    target=html.unescape(unicodedata.normalize("NFKC",str(value or ""))).strip()
    target="".join(ch for ch in target if unicodedata.category(ch) not in ("Cf","Cc","Cs"))
    anchor=re.search(r'<a\s+[^>]*href=["\']([^"\']+)["\']',target,re.IGNORECASE)
    if anchor:target=anchor.group(1).strip()
    target=re.sub(r'</?a(?:\s+[^>]*)?>','',target,flags=re.IGNORECASE).strip()
    if not target:raise ValueError("empty target")
    if len(target)>2000:raise ValueError("target too long")
    return target



def user_server_discount(uid, server_no):
    row = cur.execute("SELECT discount_percent FROM user_server_discounts WHERE user_id=? AND server_no=?", (uid, server_no)).fetchone()
    if row:
        return max(0, min(100, int(row[0] or 0)))
    if server_no == 1:
        legacy = cur.execute("SELECT discount FROM users WHERE user_id=?", (uid,)).fetchone()
        return max(0, min(100, int(legacy[0] or 0))) if legacy else 0
    return 0

def apply_server_discount(uid, server_no, amount):
    discount = user_server_discount(uid, server_no)
    amount = float(amount)
    if discount <= 0:
        return int(amount) if float(amount).is_integer() else round(amount, 6)
    discounted = max(1 if server_no != 5 else 0.01, amount * (100 - discount) / 100)
    return int(round(discounted)) if server_no != 5 else round(discounted, 6)

def discount_label(uid, server_no):
    discount = user_server_discount(uid, server_no)
    return f"\n🎁 <b>Discount:</b> {discount}% applied" if discount else ""

def format_smm_money(value):
    """Keep micro-priced SMM rates visible without noisy trailing zeroes."""
    amount=float(value)
    return f"{amount:.2f}" if abs(amount)>=1 else f"{amount:.6f}".rstrip("0").rstrip(".")

async def render_smm_services(e, uid, page=1, query="", sort="price_low",category_name=""):
    rows=smm_service_rows(query=query,category_name=category_name or None,limit=500);items=[]
    for row in rows:
        try:q=smm_quote(row['id'],1000,enforce_limits=False)
        except Exception:continue
        items.append((row,q))
    keys={"price_low":lambda x:x[1].charge,"price_high":lambda x:-x[1].charge,
          "az":lambda x:x[0]['name'].casefold(),"popular":lambda x:-x[0]['order_count']}
    items.sort(key=keys.get(sort,keys['price_low']));limit=10;pages=max(1,(len(items)+limit-1)//limit);page=max(1,min(page,pages))
    buttons=[]
    for row,q in items[(page-1)*limit:page*limit]:
        # Provider name is intentionally never exposed to customers.
        buttons.append([p_btn(f"{row['emoji']} {row['name']} | ₹{format_smm_money(q.charge)}/1K",f"smm_view|{row['id']}",style="success")])
    nav=[]
    if page>1:nav.append(p_btn("◀ Prev",f"smm_page|{page-1}|{sort}"))
    nav.append(p_btn("🔃 Sort",f"smm_sort|{page}"))
    if page<pages:nav.append(p_btn("Next ▶",f"smm_page|{page+1}|{sort}"))
    if nav:buttons.append(nav)
    buttons.extend([[p_btn("🔍 Search Again","smm_search",style="primary"),p_btn("📦 My Orders","smm_orders|1")]])
    if category_name:buttons.append([p_btn("↩ Back to Categories","smm_cats|1")])
    buttons.append([p_btn("🏠 Home","menu_buy")])
    caption=(f"🔎 <b>{'Search Results' if query else 'Available Services'}</b>\n\n"
             f"Query : <code>{html.escape(query or 'All services')}</code>\nResults Found : <b>{len(items)}</b>\n"
             f"Sort : <b>{sort.replace('_',' ').title()}</b>\nShowing : <b>{(page-1)*limit+1 if items else 0}–{min(page*limit,len(items))} of {len(items)}</b>\n\nSelect a service below.")
    smm_search_results[uid]={"query":query,"sort":sort,"category_name":category_name}
    return await e.edit(caption,buttons=buttons)

SMM_BRANDS=("telegram","instagram","whatsapp","youtube","snapchat")

async def render_smm_categories(e,page=1,brand=""):
    limit=10;offset=(max(1,page)-1)*limit
    pattern=f"%{brand.casefold()}%"
    with managed_connect() as conn:
        rows=conn.execute("""SELECT MIN(id) id,display_name,COUNT(*) provider_count FROM smm_categories
          WHERE visible=1 AND LOWER(display_name) LIKE ? GROUP BY LOWER(display_name),display_name
          ORDER BY LOWER(display_name) LIMIT ? OFFSET ?""",(pattern,limit+1,offset)).fetchall()
    buttons=[[p_btn("🔍 Search Categories & Services","smm_search",style="success")]]
    buttons.append([p_btn(name.title(),f"smm_brand|{name}|1",style="danger") for name in SMM_BRANDS[:3]])
    buttons.append([p_btn(name.title(),f"smm_brand|{name}|1",style="danger") for name in SMM_BRANDS[3:]])
    buttons += [[p_btn(r['display_name'],f"smm_cat|{r['id']}|1",style="primary")] for r in rows[:limit]]
    nav=[]
    suffix=f"|{brand}" if brand else ""
    if page>1:nav.append(p_btn("◀ Previous",f"smm_cats|{page-1}{suffix}"))
    if len(rows)>limit:nav.append(p_btn("Next ▶",f"smm_cats|{page+1}{suffix}"))
    if nav:buttons.append(nav)
    buttons.append([p_btn("📦 My Orders","smm_orders|1"),p_btn("🏠 Home","menu_buy")])
    caption=f"📂 <b>{html.escape(brand.title())+' ' if brand else ''}Categories</b>\n\nSorted A → Z · Page {page}\nSelect a category to view its services."
    await e.edit(caption,buttons=buttons)

async def render_smm_search(e,uid,query,page=1):
    limit=8;offset=(max(1,page)-1)*limit;pattern=f"%{query.casefold()}%"
    with managed_connect() as conn:
        categories=conn.execute("""SELECT MIN(id) id,display_name FROM smm_categories WHERE visible=1
          AND LOWER(display_name) LIKE ? GROUP BY LOWER(display_name),display_name ORDER BY LOWER(display_name) LIMIT 20""",(pattern,)).fetchall()
        services=conn.execute("""SELECT s.id,s.name,s.emoji FROM smm_services s JOIN smm_categories c ON c.id=s.category_id
          JOIN smm_providers p ON p.id=s.provider_id WHERE s.enabled=1 AND s.visible=1 AND c.visible=1 AND p.enabled=1
          AND (LOWER(s.name) LIKE ? OR s.remote_service_id=?) ORDER BY LOWER(s.name) LIMIT ? OFFSET ?""",(pattern,query,limit+1,offset)).fetchall()
    buttons=[]
    if page==1:
        buttons += [[p_btn(f"📂 {r['display_name']}",f"smm_cat|{r['id']}|1",style="primary")] for r in categories]
    buttons += [[p_btn(f"{r['emoji']} {r['name']}",f"smm_view|{r['id']}",style="success")] for r in services[:limit]]
    nav=[]
    if page>1:nav.append(p_btn("◀ Previous",f"smm_searchpage|{page-1}"))
    if len(services)>limit:nav.append(p_btn("Next ▶",f"smm_searchpage|{page+1}"))
    if nav:buttons.append(nav)
    buttons += [[p_btn("🔍 Search Again","smm_search"),p_btn("📂 Categories","smm_cats|1")]]
    smm_search_results[uid]={"query":query,"search_page":page}
    await e.edit(f"🔎 <b>Search Results</b>\n\nQuery: <code>{html.escape(query)}</code>\nCategories: {len(categories)}\nServices on this page: {len(services[:limit])}\nPage: {page}\n\nChoose a category or service.",buttons=buttons)


async def render_admin_smm_orders(e,page=1):
    limit=10;page=max(1,int(page));offset=(page-1)*limit
    with managed_connect() as conn:
        rows=conn.execute("""SELECT o.id,o.user_id,o.charge,o.profit,o.status,o.refunded,o.created_at,s.name service_name,p.name provider_name
          FROM smm_orders o JOIN smm_services s ON s.id=o.service_id JOIN smm_providers p ON p.id=o.provider_id
          ORDER BY o.id DESC LIMIT ? OFFSET ?""",(limit+1,offset)).fetchall()
    lines=[]
    for r in rows[:limit]:
        lines.append(f"#{r['id']} · user {r['user_id']} · {r['status']} · ₹{format_smm_money(r['charge'])} · profit ₹{format_smm_money(r['profit'])} · {'refunded' if r['refunded'] else 'paid'} · {r['created_at']} · {r['service_name'][:45]}")
    buttons=[];nav=[]
    if page>1:nav.append(p_btn("◀ Prev",f"adm_smm_orders|{page-1}"))
    if len(rows)>limit:nav.append(p_btn("Next ▶",f"adm_smm_orders|{page+1}"))
    if nav:buttons.append(nav)
    buttons.append([p_btn("Back","adm_server5")])
    text=f"<b>Orders</b> · Page {page}\n\n"+html.escape('\n'.join(lines) or 'No records.')
    await e.edit(text[:3900],buttons=buttons)

async def render_admin_smm_categories(e,page=1,query=""):
    limit=12;offset=(max(1,page)-1)*limit;pattern=f"%{query.casefold()}%"
    with managed_connect() as conn:
        rows=conn.execute("""SELECT c.id,c.display_name,c.visible,p.name provider_name,
          (SELECT COUNT(*) FROM smm_services s WHERE s.category_id=c.id AND s.deleted_at IS NULL) service_count
          FROM smm_categories c JOIN smm_providers p ON p.id=c.provider_id
          WHERE p.deleted_at IS NULL AND LOWER(c.display_name) LIKE ? ORDER BY LOWER(c.display_name),p.priority LIMIT ? OFFSET ?""",(pattern,limit+1,offset)).fetchall()
    buttons=[[p_btn("🔍 Search","adm_smm_catsearch",style="success")]]
    buttons += [[p_btn(f"{'✅' if r['visible'] else '❌'} {r['display_name']} · {r['service_count']}",f"adm_smm_cat|{r['id']}|1")] for r in rows[:limit]]
    nav=[]
    if page>1:nav.append(p_btn("◀ Previous",f"adm_smm_catpage|{page-1}"))
    if len(rows)>limit:nav.append(p_btn("Next ▶",f"adm_smm_catpage|{page+1}"))
    if nav:buttons.append(nav)
    buttons.append([p_btn("Choose Provider / Sync","adm_smm_syncproviders")]);buttons.append([p_btn("Back","adm_server5")])
    await e.edit(f"📂 <b>Categories Management</b>\n\nResults: {offset+len(rows[:limit])} · Page {page}",buttons=buttons)

async def render_admin_smm_services(e,category_id,page=1):
    limit=12;offset=(max(1,page)-1)*limit
    with managed_connect() as conn:
        cat=conn.execute("SELECT display_name FROM smm_categories WHERE id=?",(category_id,)).fetchone()
        rows=conn.execute("SELECT id,name,enabled,visible FROM smm_services WHERE category_id=? AND deleted_at IS NULL ORDER BY LOWER(name) LIMIT ? OFFSET ?",(category_id,limit+1,offset)).fetchall()
    if not cat:return await e.edit("Category no longer exists.",buttons=[[p_btn("Back","adm_smm_categories")]])
    buttons=[[p_btn(f"{'✅' if r['enabled'] and r['visible'] else '❌'} {r['name']}",f"adm_smm_service|{r['id']}|{category_id}")] for r in rows[:limit]]
    nav=[]
    if page>1:nav.append(p_btn("◀ Previous",f"adm_smm_cat|{category_id}|{page-1}"))
    if len(rows)>limit:nav.append(p_btn("Next ▶",f"adm_smm_cat|{category_id}|{page+1}"))
    if nav:buttons.append(nav)
    buttons.append([p_btn("Back","adm_smm_categories")]);await e.edit(f"🛒 <b>{html.escape(cat['display_name'])} Services</b>\n\nSorted A → Z",buttons=buttons)

def get_country_info(phone):
    phone = str(phone).replace(' ', '').replace('+', '')
    if not phone: return "Unknown", "🌍", "0"
    try:
        customs = cur.execute("SELECT code, name, flag FROM custom_countries").fetchall()
        customs.sort(key=lambda x: len(str(x[0])), reverse=True)
        for code, name, flag in customs:
            if phone.startswith(str(code)): return name, flag, str(code)
    except: pass
    known = sorted(CALLING_CODES.items(), key=lambda x: len(x[1]), reverse=True)
    for name, code in known:
        if phone.startswith(code):
            return name, COUNTRY_CODES.get(name, ("", "🌍"))[1], code
    return "Unknown", "🌍", "0"

async def detect_account_year(client):
    try:
        await client.send_message('TGDNAbot', '/start')
        me = await client.get_me()
        await asyncio.sleep(1)
        await client.send_message('TGDNAbot', str(me.id))
        for _ in range(8):
            await asyncio.sleep(1.5)
            msgs = await client.get_messages('TGDNAbot', limit=3)
            for m in msgs:
                if m.text and 'Created:' in m.text: return int(re.search(r'Created:[^\d]*(\d{4})', m.text, re.IGNORECASE).group(1))
    except: pass
    return 2024

async def send_admin_error(error_msg: str, trace: str = ""):
    global error_cooldowns
    try:
        sig = f"{error_msg}_{trace[:100]}"
        now = time.time()
        if sig in error_cooldowns:
            if now - error_cooldowns[sig] < 600:
                return
        error_cooldowns[sig] = now

        clean_trace = trace[:1500]
        alert = (f"🚨 <b>SYSTEM EXCEPTION ENCOUNTERED</b>\n\n"
                 f"<b>Error:</b> {html.escape(error_msg)}\n"
                 f"<b>Trace:</b>\n<pre>{html.escape(clean_trace)}</pre>")
        for aid in ADMIN_IDS:
            try: await bot.send_message(aid, alert)
            except Exception: pass
    except Exception as ex:
        logger.error(f"Error logging admin message: {ex}")

async def safe_answer_cb(e, text=None, alert=False):
    try:
        await e.answer(text, alert=alert)
    except QueryIdInvalidError:
        pass
    except Exception as ex:
        logger.debug(f"Redundant cb exception: {ex}")

def is_callback_event(e):
    return getattr(e, "data", None) is not None

async def safe_show_message(e, text, buttons=None, link_preview=False):
    """Edit callback messages, but respond to normal /start messages.

    Telethon new-message events also expose an edit() method for the user's
    command message; editing that incoming message raises EditMessageRequest
    errors. This helper keeps /start flows on respond() and callback flows on
    edit().
    """
    if is_callback_event(e) and hasattr(e, "edit"):
        try:
            return await e.edit(text, buttons=buttons, link_preview=link_preview)
        except TypeError:
            return await e.edit(text, buttons=buttons)
        except MessageNotModifiedError:
            return None
    try:
        return await e.respond(text, buttons=buttons, link_preview=link_preview)
    except TypeError:
        return await e.respond(text, buttons=buttons)

# ================= RANDOMIZED API ROTATION POOL =================
def get_random_api_credentials():
    """Always return a usable API pair; never implicitly return ``None``."""
    try:
        row = cur.execute("SELECT api_id, api_hash FROM api_credentials WHERE active=1 ORDER BY RANDOM() LIMIT 1").fetchone()
        if row and row[0] and row[1]:
            api_id, api_hash = row
            return int(api_id), str(api_hash)
    except Exception as exc:
        logger.warning("API credential pool lookup failed: %s", type(exc).__name__)

    try:
        row_id = cur.execute("SELECT value FROM settings WHERE key='api_id'").fetchone()
        row_hash = cur.execute("SELECT value FROM settings WHERE key='api_hash'").fetchone()
        if row_id and row_id[0] and row_hash and row_hash[0]:
            return int(row_id[0]), str(row_hash[0])
    except Exception as exc:
        logger.warning("Legacy API credential lookup failed: %s", type(exc).__name__)

    if int(API_ID) > 0 and str(API_HASH).strip():
        return int(API_ID), str(API_HASH).strip()
    raise RuntimeError("No Telegram API ID/hash is configured")


async def report_server3_user_error(event, error, context: str) -> None:
    """Keep provider internals private while giving admins actionable detail."""
    code = getattr(error, "code", type(error).__name__)
    logger.warning("Server 3 %s failed: %s", context, error)
    await send_admin_error(f"Server 3 {context} failed", f"Code: {code}\nDetail: {error}")
    await event.answer("Server 3 could not complete this request. The administrator has been notified.", alert=True)

def get_api_credentials():
    return get_random_api_credentials()

async def inspect_and_add_server2_session(uid, message):
    """Validate a sent/forwarded .session file and add it to Server 2 stock."""
    if not is_admin(uid) or not has_perm(uid, 'p_add_stock'):
        return None
    file_obj = getattr(message, "file", None)
    file_name = getattr(file_obj, "name", "") or ""
    if not file_name.casefold().endswith(".session"):
        return None

    os.makedirs("sessions", exist_ok=True)
    tmp_base = f"upload_{uid}_{int(time.time())}_{random.randint(1000, 9999)}"
    tmp_path = await bot.download_media(message, f"{tmp_base}.session")
    if not tmp_path:
        return "❌ Could not download the session file."

    clean_path = tmp_path[:-8] if tmp_path.endswith(".session") else tmp_path
    client = None
    try:
        dyn_id, dyn_hash = get_random_api_credentials()
        client = TelegramClient(clean_path, dyn_id, dyn_hash)
        await client.connect()
        if not await client.is_user_authorized():
            return "❌ Session is not authorized, so it was not added."

        me = await client.get_me()
        phone = str(getattr(me, "phone", "") or "").replace("+", "").replace(" ", "")
        if not phone:
            return "❌ Could not detect phone number from this session."

        c_name, c_icon, _ = get_country_info(phone)
        year = await detect_account_year(client)
        pwd = await client(GetPasswordRequest())
        has_2fa = bool(getattr(pwd, "has_password", False))
        twofa_pass = "Unknown" if has_2fa else "None"

        auto_row = cur.execute("SELECT price FROM auto_prices WHERE country=? AND year=?", (c_name, str(year))).fetchone()
        if not auto_row:
            auto_row = cur.execute("SELECT price FROM auto_prices WHERE country=? AND year='Common'", (c_name,)).fetchone()
        if auto_row:
            price = int(auto_row[0])
        else:
            existing_price = cur.execute("SELECT price FROM stock WHERE country_name=? ORDER BY added_date DESC LIMIT 1", (c_name,)).fetchone()
            price = int(existing_price[0]) if existing_price else 0
        if price <= 0:
            return f"⚠️ Session checked for +{phone}, but no auto/existing price was found. Set an auto price first or use Add Stock (Single)."

        perm_base = f"sessions/{phone}"
        await client.disconnect()
        client = None
        for ext in ['.session', '.session-wal', '.session-shm', '.session-journal']:
            src = clean_path + ext
            if os.path.exists(src):
                shutil.move(src, perm_base + ext)
        cur.execute(
            "INSERT OR REPLACE INTO stock (phone, session_file, country_name, country_icon, account_year, category, price, available, twofa, seller_id) VALUES (?,?,?,?,?,?,?,?,?,NULL)",
            (phone, perm_base + ".session", c_name, c_icon, year, 'Good', price, 1, twofa_pass)
        )
        db.commit()
        return f"✅ <b>Session uploaded to Server 2!</b>\nPhone: <code>+{phone}</code>\nCountry: {c_icon} {c_name}\nYear: <b>{year}</b>\nPrice: <b>₹{price}</b>"
    except Exception as ex:
        await send_admin_error("Direct session upload failed", str(ex))
        return "❌ Session check failed. The file was not added."
    finally:
        try:
            if client:
                await client.disconnect()
        except:
            pass
        if os.path.exists(tmp_path):
            delete_session_files(tmp_path)

# ================= API REQUESTS & MARKUP LOGIC =================
async def wait_lzt_rate_limit():
    """Throttle all LZT requests so one VPS/IP never exceeds market limits."""
    global _lzt_last_request_at
    async with _lzt_rate_lock:
        now = time.monotonic()
        blocked_wait = max(0.0, _lzt_blocked_until - now)
        spacing_wait = max(0.0, LZT_MIN_REQUEST_INTERVAL - (now - _lzt_last_request_at))
        wait_for = max(blocked_wait, spacing_wait)
        if wait_for > 0:
            await asyncio.sleep(wait_for)
        _lzt_last_request_at = time.monotonic()

def parse_lzt_retry_after(headers):
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

async def apply_lzt_rate_limit_cooldown(retry_after=None):
    global _lzt_blocked_until
    wait_for = max(float(retry_after or 0), LZT_RATE_LIMIT_COOLDOWN)
    _lzt_blocked_until = max(_lzt_blocked_until, time.monotonic() + wait_for)
    logger.warning("LZT API rate limited; pausing market requests for %.1fs", wait_for)
    return wait_for

async def get_lzt_session():
    global _lzt_session
    current_loop = asyncio.get_running_loop()
    session_loop = getattr(_lzt_session, "_loop", None) if _lzt_session is not None else None
    if _lzt_session is None or _lzt_session.closed or session_loop is not current_loop:
        if _lzt_session is not None and not _lzt_session.closed:
            await close_lzt_session()
        connector_kwargs = {
            "limit": 5,
            "ttl_dns_cache": 300,
            "keepalive_timeout": 30,
            "enable_cleanup_closed": True,
        }
        if LZT_FORCE_IPV4:
            connector_kwargs["family"] = socket.AF_INET
        connector = aiohttp.TCPConnector(**connector_kwargs)
        _lzt_session = aiohttp.ClientSession(connector=connector, trust_env=True)
    return _lzt_session

async def close_lzt_session():
    global _lzt_session
    if _lzt_session is not None and not _lzt_session.closed:
        await _lzt_session.close()
    _lzt_session = None

def clean_lzt_params(params):
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

def lzt_masked_url(endpoint, params=None):
    query = urllib.parse.urlencode(params or {}, doseq=True)
    return f"{endpoint}?{query}" if query else endpoint

def lzt_response_summary(res):
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

def lzt_sync_request(method, url, headers, params=None, data=None, timeout_total=None, return_error=False, proxy=None):
    method = str(method or "GET").upper()
    timeout_total = float(timeout_total or LZT_REQUEST_TIMEOUT)
    request_url = url
    if params:
        request_url = f"{url}?{urllib.parse.urlencode(params, doseq=True)}"
    body = None
    if method != "GET" and data is not None:
        body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(request_url, data=body, headers=headers, method=method)
    opener = None
    if proxy:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({"http": proxy, "https": proxy}))
    try:
        open_call = opener.open if opener else urllib.request.urlopen
        with open_call(req, timeout=timeout_total) as response:
            text = response.read().decode("utf-8", errors="replace")
            return json.loads(text) if text else {}
    except urllib.error.HTTPError as ex:
        text = ex.read().decode("utf-8", errors="replace")
        if return_error:
            try:
                err = json.loads(text) if text else {}
            except Exception:
                err = {"error": text}
            if not isinstance(err, dict):
                err = {"error": str(err)}
            err["http_status"] = ex.code
            return err
        raise

async def lzt_fallback_request(method, url, headers, params=None, data=None, timeout_total=None, return_error=False):
    await wait_lzt_rate_limit()
    try:
        return await asyncio.to_thread(
            lzt_sync_request, method, url, headers, params, data, timeout_total, return_error, LZT_PROXY or None
        )
    except urllib.error.HTTPError as ex:
        if ex.code == 429:
            wait_for = await apply_lzt_rate_limit_cooldown(parse_lzt_retry_after(ex.headers))
            if return_error:
                return {"error": "rate limited", "http_status": 429, "retry_after": wait_for}
            return None
        raise

async def lzt_request(method, endpoint, params=None, data=None, return_error=False, timeout_total=None, max_retries=None, notify_errors=True):
    global _lzt_missing_logged
    token_resolved = resolve_lzt_token()
    if not token_resolved:
        if not _lzt_missing_logged:
            _lzt_missing_logged = True
            logger.error("LZT API request blocked: token is missing for %s %s", method, endpoint)
            try:
                await send_admin_error("LZT token missing", f"Server 1 cannot submit {method} {endpoint} because no token is configured.")
            except Exception:
                pass
        return None
    token = token_resolved.replace("Bearer ", "").strip()
    method = str(method or "GET").upper()
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "TgsellBot/1.0 (+https://t.me)"
    }
    if not endpoint.startswith("/"):
        endpoint = "/" + endpoint
    url = f"{LZT_BASE_URL}{endpoint}"

    params = clean_lzt_params(params)

    is_stock_request = method == 'GET' and endpoint == '/telegram'
    timeout_total = timeout_total if timeout_total is not None else (LZT_STOCK_TIMEOUT if is_stock_request else LZT_REQUEST_TIMEOUT)
    max_retries = max(1, int(max_retries if max_retries is not None else (LZT_STOCK_RETRIES if is_stock_request else LZT_MAX_RETRIES)))
    timeout = aiohttp.ClientTimeout(total=float(timeout_total), connect=min(2.0, float(timeout_total)), sock_connect=min(2.0, float(timeout_total)), sock_read=float(timeout_total))
    last_detail = ""
    masked_url = lzt_masked_url(endpoint, params)
    if LZT_REQUEST_DEBUG:
        logger.info("LZT API submit: %s %s via aiohttp timeout=%ss retries=%s", method, masked_url, timeout_total, max_retries)

    try:
        session = await get_lzt_session()
        for attempt in range(1, max_retries + 1):
            try:
                request_kwargs = {"headers": headers, "params": params, "timeout": timeout}
                if LZT_PROXY:
                    request_kwargs["proxy"] = LZT_PROXY
                if method == 'POST':
                    request_kwargs["json"] = data
                    request_ctx = session.post(url, **request_kwargs)
                elif method == 'GET':
                    request_ctx = session.get(url, **request_kwargs)
                else:
                    return None

                await wait_lzt_rate_limit()
                async with request_ctx as r:
                    try:
                        text = await r.text()
                    except (aiohttp.ClientPayloadError, asyncio.TimeoutError) as ex:
                        last_detail = f"{type(ex).__name__}: {ex!r}"
                        if attempt < max_retries:
                            await asyncio.sleep(0.15 * attempt)
                            continue
                        break
                    if r.status >= 500 and attempt < max_retries:
                        await asyncio.sleep(0.25 * attempt)
                        continue
                    if r.status == 429:
                        retry_after = parse_lzt_retry_after(r.headers)
                        wait_for = await apply_lzt_rate_limit_cooldown(retry_after)
                        if LZT_REQUEST_DEBUG:
                            logger.warning("LZT API HTTP 429: %s %s retry_after=%s body=%s", method, masked_url, wait_for, text[:500])
                        if attempt < max_retries:
                            await asyncio.sleep(wait_for)
                            continue
                        if return_error:
                            try:
                                err = await r.json(content_type=None)
                            except Exception:
                                err = {"error": text or "rate limited"}
                            if not isinstance(err, dict):
                                err = {"error": str(err)}
                            err["http_status"] = r.status
                            err["retry_after"] = wait_for
                            return err
                        return None
                    if r.status >= 400:
                        if LZT_REQUEST_DEBUG:
                            logger.warning("LZT API HTTP error: %s %s status=%s body=%s", method, masked_url, r.status, text[:500])
                        if notify_errors:
                            await send_admin_error(f"Market HTTP {r.status} {method} {endpoint}", text[:2000])
                        if return_error:
                            try:
                                err = await r.json(content_type=None)
                            except Exception:
                                err = {"error": text}
                            if not isinstance(err, dict):
                                err = {"error": str(err)}
                            err["http_status"] = r.status
                            return err
                        return None
                    try:
                        parsed = await r.json(content_type=None)
                        if LZT_REQUEST_DEBUG:
                            logger.info("LZT API success: %s %s status=%s %s", method, masked_url, r.status, lzt_response_summary(parsed))
                        return parsed
                    except Exception as ex:
                        last_detail = f"{type(ex).__name__}: {ex!r}"
                        if notify_errors:
                            await send_admin_error(f"Market {method} {endpoint} JSON Parse Fail", f"{last_detail}\n\n{text[:2000]}")
                        return None
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                last_detail = f"{type(e).__name__}: {e!r}"
                if isinstance(e, (aiohttp.ClientConnectorError, aiohttp.ServerDisconnectedError, aiohttp.ClientOSError)):
                    await close_lzt_session()
                    session = await get_lzt_session()
                if attempt < max_retries:
                    await asyncio.sleep(0.15 * attempt)
                    continue
        detail = last_detail or f"Timeout after {timeout_total}s"
        if LZT_HTTP_FALLBACK:
            try:
                if LZT_REQUEST_DEBUG:
                    logger.info("LZT API fallback submit: %s %s via urllib timeout=%ss", method, masked_url, timeout_total)
                fallback_res = await lzt_fallback_request(method, url, headers, params=params, data=data, timeout_total=timeout_total, return_error=return_error)
                if isinstance(fallback_res, dict) and fallback_res.get("http_status") == 429:
                    await apply_lzt_rate_limit_cooldown(fallback_res.get("retry_after"))
                if LZT_REQUEST_DEBUG:
                    logger.info("LZT API fallback success: %s %s %s", method, masked_url, lzt_response_summary(fallback_res))
                return fallback_res
            except Exception as fallback_ex:
                detail = f"{detail} | fallback {type(fallback_ex).__name__}: {fallback_ex!r}"
        if LZT_REQUEST_DEBUG:
            logger.warning("LZT API failed: %s %s %s", method, masked_url, detail)
        if notify_errors:
            await send_admin_error(f"Market Client/Timeout Error: {method} {endpoint}", detail)
        if return_error:
            return {"error": detail, "exception": detail.split(':', 1)[0]}
        return None
    except Exception as e:
        detail = f"{type(e).__name__}: {e!r}"
        if LZT_HTTP_FALLBACK:
            try:
                if LZT_REQUEST_DEBUG:
                    logger.info("LZT API fallback submit after general fail: %s %s via urllib timeout=%ss", method, masked_url, timeout_total)
                fallback_res = await lzt_fallback_request(method, url, headers, params=params, data=data, timeout_total=timeout_total, return_error=return_error)
                if isinstance(fallback_res, dict) and fallback_res.get("http_status") == 429:
                    await apply_lzt_rate_limit_cooldown(fallback_res.get("retry_after"))
                if LZT_REQUEST_DEBUG:
                    logger.info("LZT API fallback success: %s %s %s", method, masked_url, lzt_response_summary(fallback_res))
                return fallback_res
            except Exception as fallback_ex:
                detail = f"{detail} | fallback {type(fallback_ex).__name__}: {fallback_ex!r}"
        if LZT_REQUEST_DEBUG:
            logger.warning("LZT API failed: %s %s %s", method, masked_url, detail)
        if notify_errors:
            await send_admin_error(f"Market Request General Fail: {method} {endpoint}", detail)
        if return_error:
            return {"error": detail, "exception": type(e).__name__}
        return None

async def fetch_lzt_country_data_with_filters(country_name, spam, geoblock, offline, login_mail, premium):
    iso_code = COUNTRY_CODES.get(country_name, ("US", "🇺🇸"))[0]
    params = {
        "country[]": iso_code,
        "spam": spam if spam != "any" else None,
        "nsb": 1,
        "pmin": 0.01,
        "pmax": 1000,
        "page": 1,
        "per_page": 40,
        "password": "no",
        "currency": LZT_PRICE_CURRENCY
    }
    if offline != "any":
        params["daybreak"] = int(offline)
    if premium != "any":
        params["premium"] = premium

    res = await lzt_request('GET', '/telegram', params=params, timeout_total=LZT_STOCK_TIMEOUT, max_retries=LZT_STOCK_RETRIES, notify_errors=False)
    if isinstance(res, dict) and 'items' in res and not res.get('items') and iso_code:
        params["country[]"] = country_name
        res = await lzt_request('GET', '/telegram', params=params, timeout_total=LZT_STOCK_TIMEOUT, max_retries=1, notify_errors=False)

    if not res or 'items' not in res:
        return None
    if len(res.get('items') or []) == 0:
        return (country_name, 0, 0.0)

    flt = {"spam": spam, "geoblock": geoblock, "offline": offline, "login_mail": login_mail, "premium": premium}
    filtered_items = filter_lzt_items(res['items'], flt)
    if not filtered_items:
        return (country_name, 0, 0.0)
    count = res.get('totalItems', len(filtered_items)) if len(filtered_items) == len(res['items']) else len(filtered_items)
    parsed_items = sorted(filtered_items, key=lambda x: float(x.get('price') or x.get('priceWithSellerFee') or x.get('price_with_fee') or 99999))
    item0 = parsed_items[0]

    markup = get_lzt_markup(country_name)
    final_price = lzt_final_inr_price(item0, markup)
    return (country_name, count, final_price)

async def cache_lzt_stock_loop():
    global cached_lzt_stock
    sem = asyncio.Semaphore(max(1, LZT_CACHE_CONCURRENCY))

    async def fetch_and_cache(country_name, fkey):
        async with sem:
            try:
                parts = fkey.split("_")
                spam, geoblock, offline, login_mail, premium = parts[0], parts[1], parts[2], parts[3], parts[4]
                data = await fetch_lzt_country_data_with_filters(country_name, spam, geoblock, offline, login_mail, premium)

                if fkey not in cached_lzt_stock:
                    cached_lzt_stock[fkey] = {}

                if data is not None:
                    cached_lzt_stock[fkey][country_name] = (data[1], data[2])
            except Exception as ex:
                if fkey not in cached_lzt_stock:
                    cached_lzt_stock[fkey] = {}

    while True:
        try:
            keys_to_update = list(active_filter_keys)
            tasks = []
            for fkey in keys_to_update:
                for country in COUNTRY_CODES.keys():
                    tasks.append(fetch_and_cache(country, fkey))
            await asyncio.gather(*tasks)
        except Exception as e:
            logger.error(f"Background LZT cache index failed: {e}")
        await asyncio.sleep(max(30, LZT_CACHE_REFRESH_SECONDS))

def resolve_lzt_token():
    env_token = (LZT_TOKEN or "").strip()
    if env_token:
        return env_token
    try:
        row = cur.execute("SELECT value FROM settings WHERE key='lzt_token'").fetchone()
        if row and str(row[0]).strip():
            return str(row[0]).strip()
    except Exception:
        pass
    return ""

async def process_referral_bonus(uid, amount):
    """Pay the configured fixed referral reward exactly once after a qualifying top-up."""
    minimum = int(fampay_setting("ref_topup_min", "0") or 0)
    reward = int(fampay_setting("ref_reward", "0") or 0)
    if amount < minimum or reward <= 0:
        return
    row = cur.execute("SELECT referred_by FROM users WHERE user_id=?", (uid,)).fetchone()
    ref = row[0] if row else None
    if not ref or ref == uid:
        return
    # The unique user_id prevents a referral from earning repeatedly on later deposits.
    try:
        cur.execute("INSERT INTO referral_rewards(referred_user_id, referrer_id, reward) VALUES (?,?,?)", (uid, ref, reward))
    except sqlite3.IntegrityError:
        return
    cur.execute("UPDATE users SET sales_balance=sales_balance+? WHERE user_id=?", (reward, ref))
    db.commit()
    try:
        await bot.send_message(ref, f"{P_GIFT} <b>Referral reward received!</b>\nYour referral <code>{uid}</code> completed a qualifying top-up of ₹{amount}.\nReward: <b>₹{reward}</b> added to your referral balance.")
    except Exception:
        pass

async def process_reseller_commission(customer_uid, purchase_amount, description="Purchase"):
    """Credit margin commission to the reseller if customer joined via custom margin link."""
    try:
        user_row = cur.execute("SELECT referred_by, reseller_token FROM users WHERE user_id=?", (customer_uid,)).fetchone()
        if not user_row or not user_row[0] or not user_row[1]:
            return
        reseller_uid, token = user_row[0], user_row[1]
        link_row = cur.execute("SELECT margin_percent FROM reseller_links WHERE token=? AND user_id=?", (token, reseller_uid)).fetchone()
        if not link_row or link_row[0] <= 0:
            return
        margin_pct = link_row[0]
        commission = max(1, int(round((purchase_amount * margin_pct) / 100.0)))
        async with get_user_lock(reseller_uid):
            cur.execute("UPDATE users SET sales_balance = sales_balance + ? WHERE user_id=?", (commission, reseller_uid))
            cur.execute(
                "INSERT INTO reseller_earnings (reseller_id, customer_id, token, amount, commission, description) VALUES (?,?,?,?,?,?)",
                (reseller_uid, customer_uid, token, purchase_amount, commission, description)
            )
            db.commit()

        try:
            await bot.send_message(
                reseller_uid,
                f"💼 <b>Reseller Commission Earned!</b>\n\n"
                f"Your customer <code>{customer_uid}</code> made a purchase of <b>₹{purchase_amount}</b> ({description}).\n"
                f"💰 Margin ({margin_pct}%): <b>₹{commission}</b> added to your Sales Balance!",
                buttons=[[p_btn("View Account", "menu_account")]]
            )
        except Exception:
            pass
    except Exception as ex:
        logger.warning("Error processing reseller commission for %s: %s", customer_uid, ex)

# ================= DATABASE SETUP & MIGRATIONS =================
def setup_db():
    cur.executescript("""
    CREATE TABLE IF NOT EXISTS users (user_id INTEGER PRIMARY KEY, balance INTEGER DEFAULT 0, sales_balance INTEGER DEFAULT 0, referred_by INTEGER, total_deposited INTEGER DEFAULT 0, joined_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, banned INTEGER DEFAULT 0, discount INTEGER DEFAULT 0, terms_accepted INTEGER DEFAULT 0, pref_curr TEXT DEFAULT 'INR');
    CREATE TABLE IF NOT EXISTS user_server_discounts (user_id INTEGER NOT NULL, server_no INTEGER NOT NULL CHECK(server_no BETWEEN 1 AND 5), discount_percent INTEGER NOT NULL DEFAULT 0 CHECK(discount_percent BETWEEN 0 AND 100), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, server_no));
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS stock (phone TEXT PRIMARY KEY, session_file TEXT, country_name TEXT, country_icon TEXT DEFAULT '🌍', account_year INTEGER, category TEXT DEFAULT 'Good', price INTEGER, available INTEGER DEFAULT 1, twofa TEXT DEFAULT 'None', added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, seller_id INTEGER DEFAULT NULL);
    CREATE TABLE IF NOT EXISTS auto_prices (country TEXT, year TEXT, price INTEGER, PRIMARY KEY (country, year));
    CREATE TABLE IF NOT EXISTS deposits (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, amount INTEGER, method_name TEXT, status TEXT, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS fampay_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      transaction_id TEXT UNIQUE, qr_msg_id INTEGER DEFAULT 0, last_response TEXT,
      last_checked_at TEXT, expires_at TEXT NOT NULL, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, check_count INTEGER NOT NULL DEFAULT 0,
      review_status TEXT, review_screenshot_msg_id INTEGER, review_utr TEXT,
      reviewed_by INTEGER, reviewed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS fampay_pending_expiry ON fampay_orders(status,expires_at);
    CREATE TABLE IF NOT EXISTS upi_orders (order_id TEXT PRIMARY KEY, user_id INTEGER, amount INTEGER, status TEXT, qr_msg_id INTEGER, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, country TEXT, year INTEGER, price INTEGER, phone TEXT, otp TEXT, server TEXT DEFAULT 'Local', date TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS custom_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, caption TEXT, qr_file_id TEXT);
    CREATE TABLE IF NOT EXISTS admins (user_id INTEGER PRIMARY KEY, p_add_stock INTEGER DEFAULT 0, p_manage_stock INTEGER DEFAULT 0, p_stats INTEGER DEFAULT 0, p_bal INTEGER DEFAULT 0, p_settings INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS api_credentials (id INTEGER PRIMARY KEY AUTOINCREMENT, api_id INTEGER NOT NULL, api_hash TEXT NOT NULL, label TEXT DEFAULT 'API', active INTEGER DEFAULT 1, added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS custom_countries (code TEXT PRIMARY KEY, name TEXT, flag TEXT);
    CREATE TABLE IF NOT EXISTS lzt_settings (country TEXT PRIMARY KEY, markup_percent INTEGER DEFAULT 20);
    CREATE TABLE IF NOT EXISTS sell_prices (country_code TEXT, year TEXT, price_good INTEGER DEFAULT 20, price_spam INTEGER DEFAULT 5, PRIMARY KEY(country_code, year));
    CREATE TABLE IF NOT EXISTS withdrawals (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, amount INTEGER, method TEXT, details TEXT, status TEXT, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS referral_rewards (referred_user_id INTEGER PRIMARY KEY, referrer_id INTEGER NOT NULL, reward INTEGER NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS fampay_gateways (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, upi_id TEXT NOT NULL, payment_name TEXT NOT NULL DEFAULT 'Payment', min_deposit INTEGER NOT NULL DEFAULT 1, max_deposit INTEGER NOT NULL DEFAULT 50000, gmail TEXT NOT NULL DEFAULT '', app_password TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS blacklisted_phones (phone TEXT PRIMARY KEY, removed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS promo_codes (code TEXT PRIMARY KEY, value INTEGER, max_uses INTEGER DEFAULT 1, used_count INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS promo_logs (code TEXT, user_id INTEGER, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS giveaways (id TEXT PRIMARY KEY, prize_name TEXT, ticket_price INTEGER, min_participants INTEGER, winners_count INTEGER, status TEXT DEFAULT 'open', created_by INTEGER, message_id INTEGER DEFAULT NULL, date TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS giveaway_tickets (giveaway_id TEXT, user_id INTEGER, tickets INTEGER DEFAULT 0, PRIMARY KEY(giveaway_id, user_id));
    """)
    migrate_managed_services()

    def ensure_column(table, column, definition):
        existing = [row[1] for row in cur.execute(f"PRAGMA table_info({table})").fetchall()]
        if column not in existing:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

    ensure_column("users", "pref_curr", "TEXT DEFAULT 'INR'")
    ensure_column("users", "promo_balance", "INTEGER DEFAULT 0")
    ensure_column("stock", "quality_tier", "TEXT DEFAULT 'good'")
    ensure_column("orders", "server", "TEXT DEFAULT 'Server 2'")
    ensure_column("fampay_orders", "check_count", "INTEGER NOT NULL DEFAULT 0")
    ensure_column("fampay_orders", "review_status", "TEXT")
    ensure_column("fampay_orders", "review_screenshot_msg_id", "INTEGER")
    ensure_column("fampay_orders", "review_utr", "TEXT")
    ensure_column("fampay_orders", "reviewed_by", "INTEGER")
    ensure_column("fampay_orders", "reviewed_at", "TEXT")
    ensure_column("fampay_orders", "gateway_id", "INTEGER")

    cur.execute("CREATE INDEX IF NOT EXISTS idx_stock_quality ON stock(quality_tier, country_name, available)")
    cur.execute("""
    CREATE TABLE IF NOT EXISTS balance_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        recipient_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS reseller_links (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        margin_percent INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS reseller_earnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reseller_id INTEGER NOT NULL,
        customer_id INTEGER NOT NULL,
        token TEXT,
        amount INTEGER NOT NULL,
        commission INTEGER NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    ensure_column("users", "reseller_token", "TEXT")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('reseller_min_margin', '5')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('reseller_max_margin', '50')")

    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('lzt_global_markup', '20')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('bot_status', 'on')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('server1_status', 'on')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('upi_status', 'on')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('cwallet_status', 'on')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('usdt_rate', '94.0')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('rub_inr_rate', '1.05')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('eur_inr_rate', '100.0')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('gbp_inr_rate', '118.0')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('cny_inr_rate', '13.0')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('uah_inr_rate', '2.3')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('kzt_inr_rate', '0.2')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('byn_inr_rate', '29.0')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('try_inr_rate', '2.9')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('jpy_inr_rate', '0.62')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('brl_inr_rate', '17.0')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('ref_percent', '3')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('ref_topup_min', '0')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('ref_reward', '0')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('ref_withdraw_min', '50')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('support_url', 'https://t.me/patelkrish_99bot')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('min_upi_dep', '10')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('min_cw_dep', '10')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('fampay_status', 'off')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('fampay_min_dep', '50')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('fampay_max_dep', '50000')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('fampay_upi_id', '')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('fampay_payment_name', 'Payment')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('fight_game_status', 'on')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('api_id', '')")
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('api_hash', '')")
    cur.execute("UPDATE users SET pref_curr='USDT' WHERE UPPER(COALESCE(pref_curr, ''))='USD'")
    cur.execute("""
        DELETE FROM custom_payments
        WHERE LOWER(name)='cwallet'
          AND id NOT IN (SELECT MIN(id) FROM custom_payments WHERE LOWER(name)='cwallet')
    """)
    if not cur.execute("SELECT 1 FROM custom_payments WHERE LOWER(name)='cwallet' LIMIT 1").fetchone():
        cur.execute(
            "INSERT INTO custom_payments (name, caption, qr_file_id) VALUES (?,?,?)",
            ('Cwallet', 'Pay directly to Cwallet ID: <code>55164887</code>', 'https://i.ibb.co/Z6fmy9ry/x.jpg')
        )
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('force_join_status', 'on')")
    for admin_uid in ADMIN_IDS:
        cur.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (admin_uid,))
        cur.execute("INSERT OR IGNORE INTO admins (user_id, p_add_stock, p_manage_stock, p_stats, p_bal, p_settings) VALUES (?, 1, 1, 1, 1, 1)", (admin_uid,))
        cur.execute("UPDATE admins SET p_add_stock=1, p_manage_stock=1, p_stats=1, p_bal=1, p_settings=1 WHERE user_id=?", (admin_uid,))
    db.commit()

# ================= VIEW ALL COUNTRIES LIST BUILDER =================
async def send_all_countries_list(uid):
    fkey = get_filter_key(get_user_filters(uid))
    stock_dict = cached_lzt_stock.get(fkey, cached_lzt_stock.get("no_no_any_any_any", {}))
    me = await bot.get_me()
    bot_username = me.username or ""

    rows = []
    for name, (iso, flag) in COUNTRY_CODES.items():
        ccode = CALLING_CODES.get(name, "")
        if not ccode:
            continue
        count, min_p = stock_dict.get(name, (0, 0.0))
        slug = country_slug(name)
        rows.append((count, name, iso, flag, ccode, min_p, slug))

    rows.sort(key=lambda item: (-item[0], item[1]))
    lines = ["All Server 1 countries [tap a country link to open]"]
    for count, name, iso, flag, ccode, min_p, slug in rows:
        label = f"{flag} +{ccode} {get_country_button_code(name)} ({iso}) {format_price(uid, min_p)} → {count}"
        if bot_username:
            lines.append(f'<a href="https://t.me/{bot_username}?start=server1-{slug}">{html.escape(label)}</a>')
        else:
            lines.append(html.escape(label))

    chunks, current = [], []
    for line in lines:
        projected = "\n".join(current + [line])
        if len(projected) > 3500 and current:
            chunks.append("\n".join(current))
            current = [line]
        else:
            current.append(line)
    if current:
        chunks.append("\n".join(current))

    for idx, chunk in enumerate(chunks, start=1):
        title = f"<b>Server 1 countries P{idx}/{len(chunks)}</b>"
        text = f"{title}\n<blockquote expandable>{chunk}</blockquote>"
        await bot.send_message(uid, text, link_preview=False)


def extract_otp_from_message_text(message_text):
    if not message_text or "Login detected" in message_text:
        return None
    match = re.search(OTP_REGEX, message_text)
    return match.group(0) if match else None

async def get_latest_telegram_login_otp(client, start_time, limit=12):
    msgs = await client.get_messages(777000, limit=limit)
    candidates = []
    for msg in msgs:
        msg_time = msg.date.timestamp() if getattr(msg, "date", None) else 0
        if msg_time < start_time:
            continue
        code = extract_otp_from_message_text(getattr(msg, "message", None))
        if code:
            candidates.append((msg_time, code))
    if not candidates:
        return None
    candidates.sort(reverse=True)
    return candidates[0][1]

# ================= BACKGROUND TASKS =================
async def auto_otp_task(phone):
    if phone not in active_orders: return
    order = active_orders[phone]
    is_lzt = str(phone).startswith("LZT_")
    start_time, uid, msg_id = order['start_time'], order['uid'], order['msg_id']

    if is_lzt:
        item_id = phone.split("_")[1]
        while time.time() - start_time < AUTO_CANCEL_SECONDS:
            if phone not in active_orders: return
            try:
                code, verified, res = await get_verified_lzt_otp(item_id, attempts=2, delay=1)
                if code and not order.get('otp_sent'):
                    order['otp_sent'] = True
                    async with get_user_lock(uid):
                        cur.execute("UPDATE orders SET otp=? WHERE phone=? AND user_id=? AND server='Server 1'", (code, order.get('phone_num') or normalize_lzt_phone(None, item_id), uid))
                        db.commit()

                    display_phone = order.get('phone_num') or normalize_lzt_phone(None, item_id)
                    msg_text = (f"{P_YES} <b>Latest OTP Fetched (Server 1)!</b>\n\n"
                                f"{P_PHONE} <b>Phone:</b> <code>{display_phone}</code>\n"
                                f"{P_TIME} <b>OTP:</b> <code>{code}</code>\n"
                                f"{P_SHIELD} <b>Server 1 double-check:</b> {'Verified' if verified else 'Best latest code'}")
                    try: await bot.edit_message(uid, msg_id, msg_text, buttons=[[p_btn("Back to Menu", "menu_main")]])
                    except: pass
                    return
            except: pass
            await asyncio.sleep(10)
    else:
        client = order['client']
        seller_id = order.get('seller_id')
        while time.time() - start_time < AUTO_CANCEL_SECONDS:
            if phone not in active_orders: return
            try:
                code = await get_latest_telegram_login_otp(client, start_time)
                if code and not order['paid']:
                    order['paid'] = True
                    price = order['price']
                    async with get_user_lock(uid):
                        cur.execute("INSERT INTO orders (user_id, country, year, price, phone, otp) VALUES (?,?,?,?,?,?)", (uid, order['country'], order['year'], price, phone, code))
                        cur.execute("DELETE FROM stock WHERE phone=?", (phone,))
                        db.commit()

                    if seller_id:
                        seller_cut = int(price * 0.90)
                        update_balance(seller_id, seller_cut, "sales_balance")
                        try: await bot.send_message(seller_id, f"{P_GIFT} <b>Account Sold!</b>\nYour uploaded number +{phone} was just sold. {P_CASH}{seller_cut} has been added to your Sales Balance!")
                        except: pass

                    twofa_text = f"{P_SHIELD} <b>2FA:</b> <code>{order['twofa']}</code>" if order['twofa'] != "None" else f"🔓 <b>2FA:</b> <code>Disabled</code>"
                    display_phone = f"+{phone.lstrip('+')}"
                    msg_text = f"{P_YES} <b>Latest OTP Fetched!</b>\n\n{P_PHONE} <b>Phone:</b> <code>{display_phone}</code>\n{P_FLAG} <b>Country:</b> {order['c_icon']} {order['country']}\n{P_TIME} <b>OTP:</b> <code>{code}</code>\n{twofa_text}"
                    try: await bot.edit_message(uid, msg_id, msg_text, buttons=[[p_btn("🔄 Get OTP Again", f"get_otp_again|{phone}")], [p_btn("🚪 Finish & Logout", f"logout_bot|{phone}")]])
                    except: pass
                    return
            except: pass
            await asyncio.sleep(6)

    if phone in active_orders and not active_orders[phone]['paid']:
        order = active_orders.pop(phone)
        if not is_lzt:
            try: await order['client'].disconnect()
            except: pass
            async with get_user_lock(uid):
                cur.execute("UPDATE users SET balance = balance + ? WHERE user_id=?", (order['price'], uid))
                cur.execute("UPDATE stock SET available=1 WHERE phone=? AND EXISTS (SELECT 1 FROM stock WHERE phone=?)", (phone, phone))
                db.commit()
        else:
            async with get_user_lock(uid):
                update_balance(uid, order['price'])
        try: await bot.edit_message(uid, msg_id, f"{P_TIME} <b>Order Expired!</b>\nThe limit ran out. Your money (₹{order['price']}) has been refunded.")
        except: pass

async def sell_hold_task(phone):
    await asyncio.sleep(600)
    if phone not in selling_accounts: return

    st = selling_accounts[phone]
    client = st['client']
    uid = st['uid']

    if st.get('cancelled'): return

    try:
        auths = await client(GetAuthorizationsRequest())
        if len(auths.authorizations) > 1:
            msg = f"{P_NO} <b>Sell Rejected!</b>\nNumber: {phone}\nReason: You did not delete your other active sessions.\nClick below to retrieve your account."
            try: await bot.edit_message(uid, st['msg_id'], msg, buttons=[[p_btn("Get Login Info", f"sell_get|{phone}")]])
            except: pass
        else:
            base_val = st['p_s'] if st['is_spam'] else st['p_n']
            cur.execute("INSERT OR REPLACE INTO stock (phone, session_file, country_name, country_icon, account_year, category, price, available, twofa, seller_id) VALUES (?,?,?,?,?,?,?,?,?)",
                        (phone, f"sessions/{phone}.session", st['c_name'], st['c_icon'], st['year'], 'Good', base_val, 1, st['new_pass'], uid))
            db.commit()

            admin_cut = int(base_val * 0.10)
            user_payout = base_val - admin_cut

            me = await bot.get_me()
            promo_link = f"https://t.me/{me.username}?start=buy_{phone}"

            msg = f"{P_YES} <b>Upload Completed!</b>\nNumber: {phone} passed all checks and is live on Server 2.\n💰 List Price: {P_CASH}{base_val}\n🔗 Promo Link: <code>{promo_link}</code>\n\n<i>You will receive {P_CASH}{user_payout} in your Sales Balance when it sells.</i>"
            try: await bot.edit_message(uid, st['msg_id'], msg)
            except: await bot.send_message(uid, msg)

            await client.disconnect()
            selling_accounts.pop(phone, None)
    except Exception as e:
        try: await bot.send_message(uid, f"{P_NO} Error finalizing sale for {phone}: {e}")
        except: pass
        selling_accounts.pop(phone, None)
        try: client.disconnect()
        except: pass

# ================= AUTOMATIC PAYMENT TASKS =================
async def check_upi_expiry_loop(order_id, uid, qr_msg_id):
    await asyncio.sleep(300)
    row = cur.execute("SELECT status FROM upi_orders WHERE order_id=?", (order_id,)).fetchone()
    if row and row[0] == "pending":
        cur.execute("UPDATE upi_orders SET status='expired' WHERE order_id=?", (order_id,))
        db.commit()
        try:
            await bot.delete_messages(uid, [qr_msg_id])
            await bot.send_message(uid, f"{P_TIME} <b>Payment Session Expired!</b>\nTransaction window closed. Request a new QR to deposit.")
        except:
            pass


async def query_upi_payment_success(order_id):
    verify_url = f"https://redoxng.in/api/verify.php?orderId={order_id}&mid={UPI_MID}"
    async with aiohttp.ClientSession() as session:
        async with session.get(verify_url, timeout=15) as resp:
            data = await resp.json()
            status_str = str(data.get("status", "")).upper()
            return (
                data.get("success") is True or
                str(data.get("status", "")).lower() == "success" or
                status_str in ("TXN_SUCCESS", "SUCCESS", "COMPLETED")
            )

async def complete_upi_order(order_id, uid, amount, qr_msg_id, edit_event=None):
    async with get_user_lock(uid):
        current_status = cur.execute("SELECT status FROM upi_orders WHERE order_id=?", (order_id,)).fetchone()[0]
        if current_status != "pending":
            return current_status == "success"
        user_old_bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
        cur.execute("UPDATE upi_orders SET status='success' WHERE order_id=?", (order_id,))
        update_balance(uid, amount)
        cur.execute("UPDATE users SET total_deposited = total_deposited + ? WHERE user_id=?", (amount, uid))
        db.commit()

    user_new_bal = user_old_bal + amount
    succ_msg = (f"{P_YES} <b>PAYMENT VERIFICATION SUCCESSFUL</b>\n\n"
                f"<tg-emoji emoji-id='5890848474563352982'>🪙</tg-emoji> Added: <b>₹{amount}</b>\n"
                f"<tg-emoji emoji-id='6048407885233263063'>♾</tg-emoji> Old Balance: {format_price(uid, user_old_bal)}\n"
                f" <tg-emoji emoji-id='6035305550625902723'>💬</tg-emoji> New Balance: {format_price(uid, user_new_bal)}")
    try:
        await bot.delete_messages(uid, [qr_msg_id])
    except Exception:
        pass
    await log_primary_deposit(uid, amount, "UPI (Automated)")
    try:
        await bot.send_message(uid, succ_msg)
    except Exception:
        pass
    if edit_event:
        try:
            await edit_event.edit(f"✅ Payment auto-verified. ₹{amount} added to your wallet.", buttons=[[p_btn("Back to Menu", "menu_main")]])
        except Exception:
            pass
    return True

async def auto_verify_upi_loop(order_id, uid, qr_msg_id):
    for _ in range(30):
        row = cur.execute("SELECT user_id, amount, status, qr_msg_id FROM upi_orders WHERE order_id=?", (order_id,)).fetchone()
        if not row or row[2] != "pending":
            return
        try:
            if await query_upi_payment_success(order_id):
                await complete_upi_order(order_id, uid, row[1], qr_msg_id)
                return
        except Exception as err:
            logger.info("UPI auto verify pending for %s: %s", order_id, err)
        await asyncio.sleep(10)

    row = cur.execute("SELECT status FROM upi_orders WHERE order_id=?", (order_id,)).fetchone()
    if row and row[0] == "pending":
        cur.execute("UPDATE upi_orders SET status='expired' WHERE order_id=?", (order_id,))
        db.commit()
        try:
            await bot.delete_messages(uid, [qr_msg_id])
            await bot.send_message(uid, f"{P_TIME} <b>Payment Session Expired!</b>\nTransaction window closed. Request a new QR to deposit.")
        except Exception:
            pass

# ================= DEPOSIT HELPERS =================
async def cleanup_deposit_media(uid):
    msg_ids = deposit_media_messages.pop(uid, [])
    if not isinstance(msg_ids, list):
        msg_ids = [msg_ids]
    for msg_id in msg_ids:
        try:
            await bot.delete_messages(uid, [msg_id])
        except Exception:
            pass
    return msg_ids

def callback_message_id(e):
    for attr in ("message_id", "msg_id", "id"):
        value = getattr(e, attr, None)
        if value:
            return value
    query = getattr(e, "query", None)
    for attr in ("msg_id", "message_id"):
        value = getattr(query, attr, None)
        if value:
            return value
    return None

def build_deposit_menu_buttons():
    btns = []
    if is_method_on("fampay_status"):
        btns.append([p_btn("⚡ UPI Automatic", "fampay_start", style="success")])
    if is_method_on("upi_status"):
        btns.append([p_btn("🟢 UPI ", "dep_upi", style="success")])
    if is_method_on("cwallet_status"):
        btns.append([p_btn("👛 CWallet", "depm_Cwallet", style="danger")])
    for c in cur.execute("SELECT MIN(name) FROM custom_payments WHERE LOWER(name)!='cwallet' GROUP BY LOWER(name) ORDER BY MIN(id)").fetchall():
        btns.append([p_btn(f"🟡 {c[0]}", f"depm_{c[0]}",style="danger")])
    btns.append([p_btn("Back", "menu_main")])
    return btns

async def init_upi_keypad(e):
    uid = e.sender_id
    deposit_input[uid] = ""
    min_row = cur.execute("SELECT value FROM settings WHERE key='min_upi_dep'").fetchone()
    min_dep = int(min_row[0]) if min_row else 10
    msg = (f"{P_BANK} <b>UPI Auto Deposit</b>\n\n"
           f"Enter amount using keypad.\n"
           f"Min: {P_CASH}{min_dep} | Max: {P_CASH}50000\n\n"
           f"Current: <code>0</code>")
    btns = [
        [p_btn("1", "kp_1"), p_btn("2", "kp_2"), p_btn("3", "kp_3")],
        [p_btn("4", "kp_4"), p_btn("5", "kp_5"), p_btn("6", "kp_6")],
        [p_btn("7", "kp_7"), p_btn("8", "kp_8"), p_btn("9", "kp_9")],
        [p_btn("⌫", "kp_del"), p_btn("0", "kp_0"), p_btn("✅ Continue", "kp_ok")],
        [p_btn("Cancel", "menu_deposit")]
    ]
    await e.edit(msg, buttons=btns)

async def keypad_logic(e):
    uid = e.sender_id
    action = e.data.decode().replace("kp_", "")
    cur_val = deposit_input.get(uid, "")
    min_row = cur.execute("SELECT value FROM settings WHERE key='min_upi_dep'").fetchone()
    min_dep = int(min_row[0]) if min_row else 10

    if action.isdigit():
        if len(cur_val) < 6:
            cur_val += action
    elif action == "del":
        cur_val = cur_val[:-1]
    elif action == "ok":
        if not cur_val.isdigit():
            return await e.answer("Enter valid amount", alert=True)
        amt = int(cur_val)
        if amt < min_dep or amt > 50000:
            return await e.answer(f"Amount must be between ₹{min_dep} and ₹50000", alert=True)

        order_id = f"UPI{uid}{int(time.time())}"
        gen_url = f"https://redoxng.in/api/genqr.php?upi={UPI_ID}&amount={amt}&name=Deamon&orderId={order_id}"
        await e.edit(f"{P_TIME} Generating secure QR code...")

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(gen_url, timeout=15) as resp:
                    data = await resp.json()
                    if not data.get("success"):
                        raise Exception(f"Redox QR error: {data.get('message', 'Unknown api failure')}")
                    qr_image_url = data.get("url") or data.get("qr_image") or data.get("data", {}).get("qr_image") or data.get("data", {}).get("url")
        except Exception as err:
            await send_admin_error("Redox QR Generation Failed", f"{err}")
            return await e.edit(f"{P_NO} System was unable to process QR creation. Please try again later.", buttons=[[p_btn("Back", "menu_main")]])

        cur.execute("INSERT INTO upi_orders (order_id, user_id, amount, status, qr_msg_id) VALUES (?,?,?,?,?)", (order_id, uid, amt, "pending", 0))
        db.commit()

        msg = (f"{P_CARD} <b>Secure UPI Checkout (5-Minute Expiry)</b>\n\n"
               f"{P_CASH} Amount: <b>₹{amt}</b>\n"
               f"{P_ID} Order ID: <code>{order_id}</code>\n\n"
               f"1) Scan the QR below with your payment application.\n"
               f"2) Process exact transaction values.\n"
               f"3) Bot will verify automatically and credit your wallet.\n\n"
               f"<i>QR will be removed after checkout or timeout.</i>")

        deposit_input.pop(uid, None)
        qr_msg = await bot.send_file(uid, qr_image_url, caption=msg, parse_mode='html')

        cur.execute("UPDATE upi_orders SET qr_msg_id=? WHERE order_id=?", (qr_msg.id, order_id))
        db.commit()

        await e.edit(f"{P_YES} QR generated. Payment will be verified automatically within 5 minutes.", buttons=[[p_btn("Back", "menu_main")]])
        asyncio.create_task(auto_verify_upi_loop(order_id, uid, qr_msg.id))
        return

    deposit_input[uid] = cur_val
    amount_text = cur_val if cur_val else "0"
    msg = (f"{P_BANK} <b>UPI Auto Deposit</b>\n\n"
           f"Enter amount using keypad.\n"
           f"Min: {P_CASH}{min_dep} | Max: {P_CASH}50000\n\n"
           f"Current: <code>{amount_text}</code>")
    btns = [
        [p_btn("1", "kp_1"), p_btn("2", "kp_2"), p_btn("3", "kp_3")],
        [p_btn("4", "kp_4"), p_btn("5", "kp_5"), p_btn("6", "kp_6")],
        [p_btn("7", "kp_7"), p_btn("8", "kp_8"), p_btn("9", "kp_9")],
        [p_btn("⌫", "kp_del"), p_btn("0", "kp_0"), p_btn("✅ Continue", "kp_ok")],
        [p_btn("Cancel", "menu_deposit")]
    ]
    await e.edit(msg, buttons=btns)

async def verify_upi_payment(e, order_id):
    uid = e.sender_id
    row = cur.execute("SELECT user_id, amount, status, qr_msg_id FROM upi_orders WHERE order_id=?", (order_id,)).fetchone()
    if not row or row[0] != uid:
        return await safe_answer_cb(e, "Invalid checkout reference.", alert=True)
    if row[2] == "success":
        return await safe_answer_cb(e, "Transaction verified already.", alert=True)
    if row[2] == "expired":
        return await safe_answer_cb(e, "This checkout context expired.", alert=True)

    try:
        is_success = await query_upi_payment_success(order_id)
    except Exception as err:
        await send_admin_error("Redox Transaction Check Error", f"{err}")
        return await safe_answer_cb(e, "Network verification gateway busy. Auto-check is still running.", alert=True)

    if is_success:
        await complete_upi_order(order_id, uid, row[1], row[3], edit_event=e)
        return

    await safe_answer_cb(e, "Payment not found yet. Auto-check is running; no need to press again.", alert=True)

def fampay_setting(key, default=""):
    row = cur.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return str(row[0]) if row and row[0] is not None else str(default)

async def create_fampay_checkout(uid, amount, old_reference=None, gateway_id=None):
    if gateway_id:
        gateway = cur.execute("SELECT id,name,upi_id,payment_name FROM fampay_gateways WHERE id=? AND enabled=1", (gateway_id,)).fetchone()
    else:
        # Multi-account rotation: automatically pick an active enabled gateway
        gateway = cur.execute("SELECT id,name,upi_id,payment_name FROM fampay_gateways WHERE enabled=1 ORDER BY RANDOM() LIMIT 1").fetchone()
    if gateway_id and not gateway:
        raise FamPayError("selected UPI gateway is unavailable")
    upi_id = (gateway[2] if gateway else fampay_setting("fampay_upi_id")).strip()
    payment_name = (gateway[3] if gateway else fampay_setting("fampay_payment_name", "Payment")).strip() or "Payment"
    if not upi_id:
        raise FamPayError("FamPay UPI ID is not configured")
    reference = secrets.token_hex(6).upper()
    now = datetime.now(timezone.utc).isoformat()
    if old_reference:
        cur.execute("UPDATE fampay_orders SET status='expired',updated_at=? WHERE reference=? AND user_id=? AND status='pending'",
                    (now, old_reference, uid))
    cur.execute("""INSERT INTO fampay_orders(reference,user_id,amount,status,expires_at,created_at,updated_at,gateway_id)
      VALUES(?,?,?,'pending',?,?,?,?)""", (reference, uid, amount, fampay_expiry_timestamp(), now, now, gateway[0] if gateway else None))
    db.commit()
    upi_query = urllib.parse.urlencode({"pa": upi_id, "pn": payment_name, "am": str(amount), "tn": reference})
    upi_uri = f"upi://pay?{upi_query}"
    qr_url = "https://quickchart.io/qr?" + urllib.parse.urlencode({"text": upi_uri, "size": "700"})
    caption = (f"📥 <b>Automatic Deposit Request</b>\n\n"
               f"Amount: <b>₹{amount}</b>\nReference: <code>{reference}</code>\n"
               f"Gateway: <b>{html.escape(gateway[1]) if gateway else 'FamPay'}</b>\nUPI: <code>{html.escape(upi_id)}</code>\n\n"
               f"Pay the exact amount within {FAMPAY_ORDER_TTL // 60} minutes. Verification runs automatically, or press Check Payment.")
    try:
        timeout=aiohttp.ClientTimeout(total=15)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(qr_url) as response:
                if response.status!=200 or not response.headers.get("Content-Type","").casefold().startswith("image/"):
                    raise FamPayError(f"QR service returned HTTP {response.status} or non-image content")
                image_data=await response.read()
        if not image_data or len(image_data)>5*1024*1024:
            raise FamPayError("QR image is empty or too large")
        qr_image=io.BytesIO(image_data);qr_image.name=f"fampay-{reference}.png"
        sent = await bot.send_file(uid, qr_image, caption=caption, parse_mode="html", force_document=False, buttons=[
            [p_btn("✅ Check Payment", f"fampay_check|{reference}", style="success")],
            [p_btn("♻️ Regenerate QR", f"fampay_regen|{reference}", style="primary")],
            [p_btn("Cancel Deposit", f"fampay_cancel|{reference}", style="danger")],
        ])
    except Exception:
        cur.execute("UPDATE fampay_orders SET status='expired',updated_at=? WHERE reference=? AND status='pending'",(datetime.now(timezone.utc).isoformat(),reference));db.commit()
        raise
    cur.execute("UPDATE fampay_orders SET qr_msg_id=? WHERE reference=?", (sent.id, reference))
    db.commit()
    deposit_media_messages.setdefault(uid,[]).append(sent.id)
    return reference

async def check_fampay_order(reference, uid=None, user_initiated=False):
    lock = fampay_check_locks.setdefault(reference, asyncio.Lock())
    async with lock:
        row = cur.execute("SELECT user_id,amount,status,expires_at FROM fampay_orders WHERE reference=?", (reference,)).fetchone()
        if not row or (uid is not None and row[0] != uid):
            raise FamPayError("deposit request not found")
        if row[2] == "success":
            return "credited", None
        if row[2] != "pending" or datetime.fromisoformat(row[3]).replace(tzinfo=datetime.fromisoformat(row[3]).tzinfo or timezone.utc) <= datetime.now(timezone.utc):
            return "expired", None
        if user_initiated:
            cur.execute("UPDATE fampay_orders SET check_count=check_count+1,last_checked_at=?,updated_at=? WHERE reference=? AND status='pending'",
                        (datetime.now(timezone.utc).isoformat(),datetime.now(timezone.utc).isoformat(),reference));db.commit()
        verification = await verify_fampay(reference)
        if not verification.verified:
            return "waiting", None
        result = credit_fampay_order(reference, verification)
        if result:
            return "credited", result
        latest=cur.execute("SELECT status FROM fampay_orders WHERE reference=?",(reference,)).fetchone()
        return ("credited",None) if latest and latest[0]=="success" else ("closed",None)

async def fampay_supervisor_loop():
    while True:
        try:
            for expired in expire_fampay_orders():
                fampay_check_locks.pop(expired["reference"],None);fampay_error_cooldowns.pop(expired["reference"],None)
                if expired.get("qr_msg_id"):
                    try:await bot.delete_messages(expired["user_id"],expired["qr_msg_id"])
                    except Exception:pass
                buttons=[[p_btn("I Paid — Submit Review",f"fampay_review|{expired['reference']}",style="primary")]] if expired.get("check_count",0)>0 else None
                try: await bot.send_message(expired["user_id"], f"⌛ Automatic deposit <code>{expired['reference']}</code> expired. No payment was found and no balance was credited.",buttons=buttons)
                except Exception: pass
            if is_method_on("fampay_status"):
                rows = cur.execute("SELECT reference,user_id,qr_msg_id FROM fampay_orders WHERE status='pending' ORDER BY id LIMIT 100").fetchall()
                for reference, user_id, qr_msg_id in rows:
                    try:
                        status, result = await check_fampay_order(reference, user_id)
                        if status == "credited" and result:
                            fampay_check_locks.pop(reference,None);fampay_error_cooldowns.pop(reference,None)
                            if qr_msg_id:
                                try: await bot.delete_messages(user_id, qr_msg_id)
                                except Exception: pass
                            await bot.send_message(user_id, f"✅ <b>Payment Successful!</b>\n\nAmount: ₹{result['amount']}\nReference: <code>{reference}</code>\nYour balance was updated exactly once.")
                            await log_primary_deposit(user_id, result["amount"], "FamPay Automatic")
                    except FamPayError as exc:
                        logger.warning("FamPay auto-check failed for %s: %s", reference, exc)
                        last=fampay_error_cooldowns.get(reference,0)
                        if time.monotonic()-last>=300:
                            fampay_error_cooldowns[reference]=time.monotonic()
                            await send_admin_error("FamPay automatic verification failed",f"Reference: {reference}\nUser: {user_id}\n{exc}")
                    await asyncio.sleep(0.2)
        except Exception:
            logger.exception("FamPay supervisor recovered from an error")
        await asyncio.sleep(10)

async def manual_deposit_init(e, method_name):
    uid = e.sender_id
    await cleanup_deposit_media(uid)
    min_row = cur.execute("SELECT value FROM settings WHERE key='min_cw_dep'").fetchone()
    min_dep = int(min_row[0]) if min_row else 10

    manual_dep_state[uid] = {"method": method_name, "step": "wait_amount"}

    msg = (f"📥 <b>{html.escape(method_name)} Deposit Initiation</b>\n\n"
           f"Please reply with the exact amount you wish to deposit in INR (Min {P_CASH}{min_dep}):")
    await e.edit(msg, buttons=[[p_btn("Cancel", "menu_deposit")]])


async def render_giveaway(event, gid):
    row = cur.execute("SELECT prize_name, ticket_price, min_participants, winners_count, status FROM giveaways WHERE id=?", (gid,)).fetchone()
    if not row:
        return await safe_show_message(event, "❌ Giveaway not found.", buttons=[[p_btn("Main Menu", "menu_main")]])
    prize, ticket_price, min_participants, winners_count, status = row
    stats = cur.execute("SELECT COUNT(*), COALESCE(SUM(tickets),0) FROM giveaway_tickets WHERE giveaway_id=?", (gid,)).fetchone()
    users_count, tickets_count = stats if stats else (0, 0)
    text = (f"🎁 <b>Giveaway: {html.escape(prize)}</b>\n\n"
            f"🎟 Ticket price: <b>₹{ticket_price}</b>\n"
            f"👥 Participants: <b>{users_count}/{min_participants}</b>\n"
            f"🎫 Total tickets: <b>{tickets_count}</b>\n"
            f"🏆 Winners: <b>{winners_count}</b>\n"
            f"📌 Status: <b>{status.upper()}</b>\n\n"
            f"Buy more tickets to increase your winning chance.")
    btns = []
    if status == "open":
        btns.append([p_btn("🎟 Buy 1 Ticket", f"g_buy|{gid}|1"), p_btn("🎟 Buy 5", f"g_buy|{gid}|5")])
        btns.append([p_btn("🎟 Buy 10", f"g_buy|{gid}|10"), p_btn("✍️ Custom Tickets", f"g_custom|{gid}")])
    btns.append([p_btn("Main Menu", "menu_main")])
    return await safe_show_message(event, text, buttons=btns)

async def maybe_finish_giveaway(gid):
    row = cur.execute("SELECT prize_name, ticket_price, min_participants, winners_count, status, created_by FROM giveaways WHERE id=?", (gid,)).fetchone()
    if not row or row[4] != "open":
        return
    prize, ticket_price, min_participants, winners_count, status, created_by = row
    participants = cur.execute("SELECT user_id, tickets FROM giveaway_tickets WHERE giveaway_id=? AND tickets>0", (gid,)).fetchall()
    if len(participants) < min_participants:
        return
    weighted = []
    for user_id, tickets in participants:
        weighted.extend([user_id] * max(1, int(tickets)))
    winners = []
    while weighted and len(winners) < min(winners_count, len(participants)):
        winner = random.choice(weighted)
        if winner not in winners:
            winners.append(winner)
        weighted = [x for x in weighted if x != winner]
    cur.execute("UPDATE giveaways SET status='closed' WHERE id=?", (gid,))
    db.commit()
    winner_lines = []
    for wid in winners:
        try:
            ent = await bot.get_entity(wid)
            uname = f"@{ent.username}" if getattr(ent, 'username', None) else "No username"
            name = html.escape(ent.first_name or str(wid))
        except Exception:
            uname, name = "No username", str(wid)
        winner_lines.append(f"🏆 <code>{wid}</code> {name} {uname} tg://user?id={wid}")
    announce = (f"🎉 <b>Giveaway Ended!</b>\n\nPrize: <b>{html.escape(prize)}</b>\n"
                f"Participants: <b>{len(participants)}</b>\nTickets: <b>{sum(t for _, t in participants)}</b>\n\n"
                f"<b>Winner(s):</b>\n" + "\n".join(winner_lines) + "\n\nAdmin will deliver prize manually.")
    for user_id, _ in participants:
        try:
            await bot.send_message(user_id, announce)
        except Exception:
            pass
    try:
        await bot.send_message(created_by or ADMIN_ID, announce)
    except Exception:
        pass

# ================= DYNAMIC ADMIN REVIEW KEYPAD =================
async def render_admin_review_keypad(event, target_uid, order_id, d_type, current_val=""):
    display_text = current_val if current_val else "0"
    method_label = "UPI Automatic" if d_type == "upi" else "Manual"
    if d_type == "man":
        row = cur.execute("SELECT method_name FROM deposits WHERE id=?", (str(order_id).replace("M", ""),)).fetchone()
        if row and row[0]:
            method_label = row[0]
    msg = (f"✏️ <b>Console Keypad Review Mode</b>\n\n"
           f"Payment Type: <b>{html.escape(method_label)}</b>\n"
           f"User ID: <code>{target_uid}</code>\n"
           f"Transaction ID: <code>{order_id}</code>\n"
           f"Pending Credit Value: <b>₹{display_text}</b>\n\n"
           f"Update final deposit values to credit:")

    cb_pref = f"kp_adm|{target_uid}|{order_id}|{d_type}|"
    btns = [
        [
            p_btn("1", f"{cb_pref}1|{current_val}"),
            p_btn("2", f"{cb_pref}2|{current_val}"),
            p_btn("3", f"{cb_pref}3|{current_val}")
        ],
        [
            p_btn("4", f"{cb_pref}4|{current_val}"),
            p_btn("5", f"{cb_pref}5|{current_val}"),
            p_btn("6", f"{cb_pref}6|{current_val}")
        ],
        [
            p_btn("7", f"{cb_pref}7|{current_val}"),
            p_btn("8", f"{cb_pref}8|{current_val}"),
            p_btn("9", f"{cb_pref}9|{current_val}")
        ],
        [
            p_btn("⌫", f"{cb_pref}del|{current_val}"),
            p_btn("0", f"{cb_pref}0|{current_val}"),
            p_btn("✅ Confirm", f"{cb_pref}confirm|{current_val}"),
        ],
        [p_btn("❌ Reject / Cancel", f"dep_act|{d_type}|rej|{order_id}|{target_uid}|0")]
    ]
    await event.edit(msg, buttons=btns)

# ================= DYNAMIC SUB-ADMIN PERMISSIONS RENDERER =================
async def edit_admin_menu(event, admin_id):
    row = cur.execute("SELECT p_add_stock, p_manage_stock, p_stats, p_bal, p_settings FROM admins WHERE user_id=?", (admin_id,)).fetchone()
    if not row:
        cur.execute("INSERT INTO admins (user_id) VALUES (?)", (admin_id,))
        db.commit()
        row = (0, 0, 0, 0, 0)

    p_add, p_manage, p_stats, p_bal, p_settings = row

    msg = (f"👤 <b>Manage Admin Permissions</b>\n\n"
           f"Admin ID: <code>{admin_id}</code>\n\n"
           f"➕ Add Stock: {'✅ Enabled' if p_add else '❌ Disabled'}\n"
           f"⚙️ Manage Stock: {'✅ Enabled' if p_manage else '❌ Disabled'}\n"
           f"📊 View Stats: {'✅ Enabled' if p_stats else '❌ Disabled'}\n"
           f"💰 Manage Balances: {'✅ Enabled' if p_bal else '❌ Disabled'}\n"
           f"🛠️ Settings Access: {'✅ Enabled' if p_settings else '❌ Disabled'}")

    btns = [
        [p_btn(f"Toggle Add Stock", f"adm_perm|{admin_id}|p_add_stock|{p_add}")],
        [p_btn(f"Toggle Manage Stock", f"adm_perm|{admin_id}|p_manage_stock|{p_manage}")],
        [p_btn(f"Toggle Stats", f"adm_perm|{admin_id}|p_stats|{p_stats}")],
        [p_btn(f"Toggle Balance", f"adm_perm|{admin_id}|p_bal|{p_bal}")],
        [p_btn(f"Toggle Settings", f"adm_perm|{admin_id}|p_settings|{p_settings}")],
        [p_btn(f"🗑️ Delete Admin", f"adm_perm|{admin_id}|delete|0")],
        [p_btn("Back to Dashboard", "adm_adminmain")]
    ]

    if hasattr(event, 'edit'):
        await event.edit(msg, buttons=btns)
    else:
        for aid in ADMIN_IDS:
            try: await bot.send_message(aid, msg, buttons=btns)
            except Exception: pass


async def render_lzt_product(e, uid, item_id, country=None):
    res = await lzt_request('GET', f"/{item_id}", params=lzt_currency_params())
    if not res or 'item' not in res:
        return await safe_show_message(e, "❌ Unable to load Server 1 product. It may be sold or unavailable.", buttons=[[p_btn("Server 1", "srv_1_pg|1")]])
    item = res['item']
    country = country or lzt_item_country_name(item, "Unknown")
    price_info = lzt_price_breakdown(item, get_lzt_markup(country))
    final_price = apply_server_discount(uid, 1, price_info["final_inr"])
    spam = item.get("telegram_spam_block", -1)
    premium = item.get("telegram_premium", 0)
    contacts = item.get("telegram_contacts_count", 0)
    chats = item.get("telegram_chats_count", 0)
    channels = item.get("telegram_channels_count", 0)
    conv = item.get("telegram_conversations_count", 0)
    bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
    diff = final_price - bal
    password_required = lzt_item_requires_password(item)
    msg = (f"{P_STORE} <b>Confirm Server 1 Purchase</b>\n\n"
           f"{P_CASH} <b>Price:</b> {format_price(uid, final_price)}\n"
           f"{P_CARD} <b>Your Balance:</b> {format_price(uid, bal)}\n"
           f"<tg-emoji emoji-id='5778613750688911681'>🪙</tg-emoji> <b>Country:</b> {html.escape(country)}\n"
           f"<tg-emoji emoji-id='6035191085452497972'>👤</tg-emoji> <b>ID:</b> <code>{item_id}</code>\n\n"
           f" <tg-emoji emoji-id='6037175527846975726'>🎁</tg-emoji> Premium: <b>{'YES' if premium else 'NO'}</b>\n"
           f"<tg-emoji emoji-id='6037254263187443802'>💬</tg-emoji> SpamBlock: <b>{'NO' if spam == -1 else 'YES'}</b>\n"
           f" <tg-emoji emoji-id='5767388406984216738'>💬</tg-emoji> Chats: <b>{chats}</b>\n"
           f"<tg-emoji emoji-id='6039422865189638057'>📣</tg-emoji> Channels: <b>{channels}</b>\n"
           f"<tg-emoji emoji-id='6032594876506312598'>👥</tg-emoji> Contacts: <b>{contacts}</b>\n"
           f" <tg-emoji emoji-id='5776233299424843260'>🌐</tg-emoji> Conversations: <b>{conv}</b>\n\n"
           f"<tg-emoji emoji-id='5920332557466997677'>🏪</tg-emoji> <b>Mass Buy:</b> tries this ID first, then same-price IDs until one succeeds or all fail.")
    btns = []
    iso_code = COUNTRY_CODES.get(country, ("US", "🇺🇸"))[0]
    if password_required:
        btns.append([p_btn("🔐 Password Account - Cannot Buy", "noop")])
    elif diff > 0:
        btns.append([p_btn("Need Recharge", "menu_deposit")])
    else:
        btns.append([p_btn("✅ Purchase", f"lzt_buy|{item_id}|{final_price}|{country}")])
        btns.append([p_btn("🛒 Mass Buy Same Price", f"lzt_mass_buy|{item_id}|{final_price}|{country}")])
    btns.extend([
        [p_btn("⬅ Back to Stocks", f"lzt_chk|{iso_code}|1")],
        [p_btn("Back to Menu", "menu_main")]
    ])
    return await safe_show_message(e, msg, buttons=btns)


async def get_lzt_candidate_items(uid, country, target_final_price, preferred_item_id=None, max_pages=2):
    # Use safe default market filters and exact displayed INR price for mass-buy candidates.
    iso_code = COUNTRY_CODES.get(country, ("US", "🇺🇸"))[0]
    seen = set()
    candidates = []

    async def add_candidate(item):
        if not isinstance(item, dict):
            return
        item_id = str(item.get('item_id') or item.get('id') or '')
        if not item_id or item_id in seen:
            return
        seen.add(item_id)
        candidates.append(item)

    if preferred_item_id:
        res = await lzt_request('GET', f"/{preferred_item_id}", params=lzt_currency_params())
        if isinstance(res, dict) and isinstance(res.get('item'), dict):
            await add_candidate(res['item'])

    params_base = {
        "country[]": iso_code,
        "nsb": 1,
        "pmin": 0.01,
        "pmax": 1000,
        "per_page": 40,
        "password": "no",
        "currency": LZT_PRICE_CURRENCY,
    }
    for page in range(1, max_pages + 1):
        params = dict(params_base, page=page)
        res = await lzt_request('GET', '/telegram', params=params, timeout_total=LZT_STOCK_TIMEOUT, max_retries=LZT_STOCK_RETRIES, notify_errors=False)
        if isinstance(res, dict) and 'items' in res and not res.get('items') and params["country[]"] != country:
            params["country[]"] = country
            res = await lzt_request('GET', '/telegram', params=params, timeout_total=LZT_STOCK_TIMEOUT, max_retries=1, notify_errors=False)
        for item in (res or {}).get('items', [])[:40]:
            if apply_server_discount(uid, 1, lzt_final_inr_price(item, get_lzt_markup(country))) == int(target_final_price):
                await add_candidate(item)
    return candidates

async def finish_lzt_purchase_success(uid, item_id, country, final_price):
    res = await lzt_request('GET', f"/{item_id}", params=lzt_currency_params())
    phone_num = f"LZT_{item_id}"
    if res and 'item' in res:
        item = res['item']
        phone_num = item.get('phone') or item.get('telegram_phone') or item.get('login') or f"LZT_{item_id}"
    display_phone = normalize_lzt_phone(phone_num, item_id)
    phone = f"LZT_{item_id}"
    cur.execute(
        "INSERT INTO orders (user_id, country, year, price, phone, otp, server) VALUES (?,?,?,?,?,?,?)",
        (uid, country, 2024, final_price, display_phone, None, "Server 1")
    )
    local_order_id=cur.lastrowid
    db.commit()
    await log_primary_purchase(uid, country, final_price, final_price, 2024, 1, display_phone, "Server 1",local_order_id)
    await try_lzt_reset_authorizations(item_id)
    return phone, display_phone

# ================= CORE EVENT CALLBACKS =================
@bot.on(events.CallbackQuery)
async def handle_callbacks(e):
    global cached_lzt_stock, active_filter_keys
    uid = e.sender_id
    data = e.data.decode()
    if not callback_allowed_in_chat(uid, data, e):
        return await safe_answer_cb(e, "User menus work in private chat only. Admin review buttons are allowed for admins in log chats.", alert=True)
    if not is_bot_online() and not is_admin(uid): return await e.answer("Maintenance.", alert=True)
    ensure_user(uid)
    if is_user_banned(uid): return await e.answer("BANNED", alert=True)

    try:
        if data == "noop":
            return await safe_answer_cb(e, "Not available.", alert=True)

        # Permission Handling Callback
        if data.startswith("adm_perm|") and uid in ADMIN_IDS:
            _, admin_id, perm, val = data.split("|")
            admin_id, val = int(admin_id), int(val)
            if perm == "delete":
                if admin_id in ADMIN_IDS:
                    return await safe_answer_cb(e, "❌ Super Admins cannot be deleted.", alert=True)
                cur.execute("DELETE FROM admins WHERE user_id=?", (admin_id,))
                db.commit()
                await e.answer("Admin deleted successfully", alert=True)
                class FakeEvent:
                    async def edit(self, text, buttons): await e.edit(text, buttons=buttons)
                await handle_callbacks(FakeEvent())
                return
            else:
                new_val = 1 if val == 0 else 0
                cur.execute(f"UPDATE admins SET {perm}=? WHERE user_id=?", (new_val, admin_id))
                db.commit()
                await e.answer("Permission toggled", alert=False)
                class FakeEvent:
                    async def edit(self, text, buttons): await e.edit(text, buttons=buttons)
                await edit_admin_menu(FakeEvent(), admin_id)
                return

        # Giveaway Join Callback
        elif data.startswith("join_gwy|"):
            _, gwy_id, amt_str = data.split("|")
            amt = int(amt_str)

            if gwy_id not in active_giveaways:
                return await safe_answer_cb(e, "❌ This giveaway pool has already expired or ended.", alert=True)

            pool = active_giveaways[gwy_id]
            if uid in pool["participants"]:
                return await safe_answer_cb(e, "❌ You have already participated in this pool!", alert=True)

            pool["participants"].append(uid)
            count = len(pool["participants"])

            current_users = []
            for u in pool["participants"]:
                try:
                    user_ent = await bot.get_entity(u)
                    current_users.append(html.escape(user_ent.first_name or "Participant"))
                except:
                    current_users.append(f"User_{u}")

            list_text = "\n".join([f"• {u}" for u in current_users])

            if count >= 10:
                winner_id = random.choice(pool["participants"])
                winner_ent = await bot.get_entity(winner_id)
                winner_name = html.escape(winner_ent.first_name or "Participant")

                update_balance(winner_id, amt)
                active_giveaways.pop(gwy_id, None)

                complete_text = (f"{P_TADA} <b>GIVEAWAY POOL COMPLETED!</b>\n\n"
                                 f"🎁 Prize Value: <b>₹{amt}</b>\n"
                                 f"👥 Participants: {count}/10\n\n"
                                 f"🏆 <b>Winner Chosen:</b> {winner_name} (₹{amt} added directly to balance!)")
                await e.edit(complete_text, buttons=None)
                return

            updated_text = (f"{P_GIFT} <b>ACTIVE GIVEAWAY DISBURSEMENT STARTED!</b>\n\n"
                            f"Pool Prize: <b>₹{amt}</b>\n"
                            f"Active slots: <b>{count} / 10 Joined</b>\n\n"
                            f"<b>Joined users:</b>\n{list_text}\n\n"
                            f"Click join below to participate:")

            btns = [[p_btn(f"🙋 Join Giveaway ({count}/10)", f"join_gwy|{gwy_id}|{amt}")]]
            await e.edit(updated_text, buttons=btns)
            return

        elif data.startswith("gwy_cf|"):
            if not is_admin(uid): return await e.answer("Admins only.", alert=True)
            amt = int(data.split("|")[1])
            gwy_id = f"GWY_{int(time.time())}"

            active_giveaways[gwy_id] = {
                "amount": amt,
                "participants": []
            }

            start_text = (f"{P_GIFT} <b>ACTIVE GIVEAWAY DISBURSEMENT STARTED!</b>\n\n"
                          f"Pool Prize: <b>₹{amt}</b>\n"
                          f"Active slots: <b>0 / 10 Joined</b>\n\n"
                          f"Click join below to participate:")
            btns = [[p_btn("🙋 Join Giveaway (0/10)", f"join_gwy|{gwy_id}|{amt}")]]
            await e.edit(start_text, buttons=btns)
            return

        elif data == "gwy_cancel":
            if not is_admin(uid): return await e.answer("Admins only.", alert=True)
            await e.edit("❌ Giveaway disbursement cancelled.")
            return

        # Group Join Fight Button Callback
        elif data.startswith("join_fight|"):
            _, fight_id, initiator_id, amount_str = data.split("|")
            initiator_id = int(initiator_id)
            amount = int(amount_str)

            if fight_id not in active_fights:
                return await safe_answer_cb(e, "❌ This battle has expired or was already finished.", alert=True)

            fight = active_fights[fight_id]
            if uid == fight["initiator_id"]:
                return await safe_answer_cb(e, "❌ You cannot join your own fight!", alert=True)

            ensure_user(uid)
            challenger_bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
            if challenger_bal < amount:
                return await safe_answer_cb(e, f"❌ Insufficient balance! (Need ₹{amount}, Current: ₹{challenger_bal})", alert=True)

            async with get_user_lock(uid):
                challenger_bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
                if challenger_bal < amount:
                    return await safe_answer_cb(e, f"❌ Insufficient balance! (Need ₹{amount}, Current: ₹{challenger_bal})", alert=True)
                cur.execute("UPDATE users SET balance = balance - ? WHERE user_id=? AND balance >= ?", (amount, uid, amount))
                if cur.rowcount == 0:
                    return await safe_answer_cb(e, "❌ Balance changed. Try again.", alert=True)
                if not fight.get("initiator_paid"):
                    init_bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (fight["initiator_id"],)).fetchone()[0]
                    if init_bal < amount:
                        cur.execute("UPDATE users SET balance = balance + ? WHERE user_id=?", (amount, uid))
                        db.commit()
                        active_fights.pop(fight_id, None)
                        return await e.edit("❌ Fight cancelled. Initiator no longer has enough balance.")
                    cur.execute("UPDATE users SET balance = balance - ? WHERE user_id=? AND balance >= ?", (amount, fight["initiator_id"], amount))
                    fight["initiator_paid"] = True
                    fight["reward"] = amount * 2
                db.commit()

            challenger_entity = await bot.get_entity(uid)
            challenger_name = html.escape(challenger_entity.first_name or "Challenger")

            combatants = [
                {"id": fight["initiator_id"], "name": fight["initiator_name"]},
                {"id": uid, "name": challenger_name}
            ]
            winner = random.choice(combatants)

            reward = fight["reward"]
            update_balance(winner["id"], reward)

            active_fights.pop(fight_id, None)

            success_text = (f"{P_TADA} <b>BATTLE COMPLETED!</b>\n\n"
                            f"🤺 Initiator: {fight['initiator_name']}\n"
                            f"🛡 Challenger: {challenger_name}\n"
                            f"💰 Total Pool: <b>₹{reward}</b>\n\n"
                            f"🏆 <b>Winner:</b> {winner['name']} (₹{reward} added to balance!)")

            await e.edit(success_text)
            return


        elif data.startswith("g_open|"):
            gid = data.split("|", 1)[1]
            await render_giveaway(e, gid)
            return

        elif data.startswith("g_custom|"):
            gid = data.split("|", 1)[1]
            row = cur.execute("SELECT ticket_price, status FROM giveaways WHERE id=?", (gid,)).fetchone()
            if not row or row[1] != "open":
                return await safe_answer_cb(e, "❌ Giveaway is closed or missing.", alert=True)
            giveaway_ticket_state[uid] = gid
            await e.edit(f"🎟 <b>Custom Tickets</b>\n\n1 ticket costs ₹{row[0]}. Reply with how many tickets you want to buy.", buttons=[[p_btn("Back", f"g_open|{gid}")]])
            return

        elif data.startswith("g_buy|"):
            _, gid, qty_str = data.split("|")
            qty = int(qty_str)
            row = cur.execute("SELECT prize_name, ticket_price, status FROM giveaways WHERE id=?", (gid,)).fetchone()
            if not row or row[2] != "open":
                return await safe_answer_cb(e, "❌ Giveaway is closed or missing.", alert=True)
            prize, ticket_price, _ = row
            total_cost = ticket_price * qty
            async with get_user_lock(uid):
                bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
                if bal < total_cost:
                    return await safe_answer_cb(e, f"❌ Need ₹{total_cost}. Current balance ₹{bal}.", alert=True)
                cur.execute("UPDATE users SET balance = balance - ? WHERE user_id=? AND balance >= ?", (total_cost, uid, total_cost))
                if cur.rowcount == 0:
                    return await safe_answer_cb(e, "❌ Balance changed. Try again.", alert=True)
                cur.execute("INSERT INTO giveaway_tickets (giveaway_id, user_id, tickets) VALUES (?,?,?) ON CONFLICT(giveaway_id,user_id) DO UPDATE SET tickets=tickets+excluded.tickets", (gid, uid, qty))
                db.commit()
            await safe_answer_cb(e, f"✅ Bought {qty} ticket(s) for ₹{total_cost}.", alert=True)
            await render_giveaway(e, gid)
            await maybe_finish_giveaway(gid)
            return

        elif data == "verify_join":
            if not await check_channel_joined(uid): return await e.answer("⚠️ Join channels first!", alert=True)
            await send_terms_or_main_menu(e, uid)
        elif data == "menu_main" or data == "cancel_action":
            transfer_state.pop(uid, None); sell_state.pop(uid, None); deposit_input.pop(uid, None); manual_dep_state.pop(uid, None); lzt_search_state.pop(uid, None); server3_search_state.discard(uid); server4_search_state.pop(uid,None); server4_country_search_state.pop(uid,None); restore_state.pop(uid, None); giveaway_ticket_state.pop(uid, None)
            await cleanup_deposit_media(uid)
            await send_main_menu(e, uid)
        elif data == "tc_accept":
            cur.execute("UPDATE users SET terms_accepted=1 WHERE user_id=?", (uid,))
            db.commit()
            await send_main_menu(e, uid)
        elif data == "tc_reject":
            await e.edit("❌ You must accept the terms.")

        elif data.startswith("sort_provider|"):
            _,number_text,mode,target=data.split("|",3)
            if mode not in ("az","price_low","price_high"):
                return await e.answer("Invalid sorting mode.",alert=True)
            provider_sort_state[(uid,int(number_text))]=mode
            class SortEvent:
                sender_id=uid;chat_id=getattr(e,"chat_id",uid);data=target.encode()
                async def edit(self,text,buttons=None,**kwargs):return await e.edit(text,buttons=buttons,**kwargs)
                async def answer(self,text=None,alert=False):return await e.answer(text,alert=alert)
            return await handle_callbacks(SortEvent())

        elif data.startswith("copy_phone|"):
            value=data.split("|",1)[1]
            if not re.fullmatch(r"\+?\d{3,20}",value):
                return await e.answer("Invalid number.",alert=True)
            return await e.answer(f"Copy number:\n{value}",alert=True)

        # --- BUY MENU ---
        elif data == "menu_buy":
            total_bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
            msg = ("● <b>Buy Best Telegram Accounts:</b>\n"
                   "––––––—————––––——–––•\n"
                   "• Choose Server Based Need\n"
                   "• Server 1 [Cheap Quality ]\n"
                   "• Server 2 [ High Quality ] \n"
                   "• Server 3 [ New Accounts ] \n"
                   "• Server 4 [ New Accounts ] \n"
                   "• Social Media Services [ SMM Service ] \n"
                   f"• Total balance = <code>{format_price(uid, total_bal)}</code>")
            btns = [
                [p_btn("Server (1)", "srv_1_pg|1", style="primary")],
                [p_btn("Server (2)", "srv_2_pg|1", style="primary")],
            ]
            if server3.config().service_enabled:
                btns.append([p_btn(managed_server_name(3), "srv3_servers|1", style="primary")])
            if server4.config().service_enabled:
                btns.append([p_btn(managed_server_name(4), "srv4_operators", style="primary")])
            with managed_connect() as conn:
                smm_enabled=conn.execute("SELECT value FROM smm_settings WHERE key='enabled'").fetchone()[0]=='1'
            if smm_enabled:btns.append([p_btn("Social Media Services","smm_cats|1",style="success")])
            btns.append([p_btn("● Back ●", "menu_main")])
            await e.edit(msg, buttons=btns)

        elif data.startswith("smm_cats|"):
            parts=data.split('|');await render_smm_categories(e,max(1,int(parts[1])),parts[2] if len(parts)>2 else '')
        elif data.startswith("smm_brand|"):
            _,brand,page=data.split('|');await render_smm_categories(e,int(page),brand)
        elif data.startswith("smm_cat|"):
            _,cid,page=data.split('|')
            with managed_connect() as conn:cat=conn.execute("SELECT display_name FROM smm_categories WHERE id=? AND visible=1",(int(cid),)).fetchone()
            if not cat:return await e.answer("Category unavailable.",alert=True)
            await render_smm_services(e,uid,int(page),'','az',cat['display_name'])
        elif data.startswith("smm_page|"):
            _,page,sort=data.split("|");state=smm_search_results.get(uid,{})
            await render_smm_services(e,uid,int(page),state.get('query',''),sort,state.get('category_name',''))
        elif data=="smm_search":
            smm_state[uid]={"step":"search"};await e.edit("🔍 <b>Search Services</b>\n\nSend a service name or Service ID.",buttons=[[p_btn("Back","smm_cats|1")]])
        elif data.startswith("smm_searchpage|"):
            state=smm_search_results.get(uid)
            if not state:return await e.answer("Search expired.",alert=True)
            await render_smm_search(e,uid,state['query'],int(data.split('|')[1]))
        elif data.startswith("smm_sort|"):
            page=data.split('|')[1];await e.edit("🔃 <b>Sort Services</b>",buttons=[[p_btn("💰 Price Low → High",f"smm_page|{page}|price_low")],[p_btn("💰 Price High → Low",f"smm_page|{page}|price_high")],[p_btn("🔤 A → Z",f"smm_page|{page}|az")],[p_btn("🔥 Popular",f"smm_page|{page}|popular")]])
        elif data.startswith("smm_view|"):
            sid=int(data.split('|')[1]);rows=[r for r in smm_service_rows(limit=100000) if r['id']==sid]
            if not rows:return await e.answer("Service unavailable.",alert=True)
            r=rows[0];q=smm_quote(sid,1000,enforce_limits=False);smm_state[uid]={"step":"link","service_id":sid,"category_name":r['category_name']}
            raw_description=' '.join(str(r['description'] or '').split());description=raw_description[:700]
            description_block=(f"<blockquote expandable>{html.escape(description)}{'…' if len(raw_description)>700 else ''}</blockquote>\n\n" if description else "")
            detail_text=(f"{r['emoji']} <b>{html.escape(r['name'])}</b>\n\n{description_block}"
              f"Price: <b>₹{format_smm_money(q.charge)} per 1000</b>\nMinimum: <b>{r['minimum']}</b>\nMaximum: <b>{r['maximum']}</b>\n"
              f"Average time: <b>{html.escape(r['average_time'] or 'Not specified')}</b>\nRefill: {'✅' if r['refill'] else '❌'} · Cancel: {'✅' if r['cancellable'] else '❌'}\n\nSend the target link.")
            if not await bot_api_edit_text(e,detail_text,[[{"text":"↩ Back to Services","callback_data":"smm_back_services","style":"danger"}]]):
                # Older endpoints may not understand expandable blockquotes;
                # keep ordering functional without sending an oversized description.
                await e.edit(f"{r['emoji']} <b>{html.escape(r['name'])}</b>\n\nPrice: <b>₹{format_smm_money(q.charge)} per 1000</b>\nMinimum: <b>{r['minimum']}</b>\nMaximum: <b>{r['maximum']}</b>\nAverage time: <b>{html.escape(r['average_time'] or 'Not specified')}</b>\n\nSend the target link.",buttons=[[p_btn("↩ Back to Services","smm_back_services",style="danger")]])
        elif data=="smm_back_services":
            state=smm_state.pop(uid,None);category=state.get('category_name','') if state else ''
            if category:await render_smm_services(e,uid,1,'','az',category)
            else:await render_smm_categories(e,1)
        elif data.startswith("smm_confirm|"):
            parts=data.split('|');sid,qty=parts[1],parts[2];request_id=parts[3] if len(parts)>3 else None;state=smm_state.get(uid)
            if not state or state.get('step')!='confirm' or state.get('service_id')!=int(sid) or state.get('quantity')!=int(qty) or (request_id and state.get('request_id')!=request_id):return await e.answer("Confirmation expired.",alert=True)
            smm_state.pop(uid,None)
            try:
                entity=await e.get_sender();oid,porder,q=await smm_place_order(uid,getattr(entity,'username',None),int(sid),int(qty),state['link'],request_id or state.get('request_id'),user_server_discount(uid,5))
            except SMMError as exc:
                await send_admin_error(f"Server 5 order failed for user {uid}",exc.detail);return await e.edit("❌ Order could not be placed. No successful order was charged. Support has been notified.",buttons=[[p_btn("Services","smm_page|1|price_low")]])
            with managed_connect() as conn:service_row=conn.execute("SELECT name FROM smm_services WHERE id=?",(int(sid),)).fetchone()
            await log_smm_purchase(uid,state['link'],q.charge,service_row['name'] if service_row else sid,oid)
            await e.edit(f"✅ <b>Order Placed</b>\n\nOrder: <code>#{oid}</code>\nQuantity: {qty}\nCharge: ₹{format_smm_money(q.charge)}\nStatus: Pending",buttons=[[p_btn("📦 View Order",f"smm_order|{oid}",style="success")],[p_btn("Services","smm_page|1|price_low")]])
        elif data.startswith("smm_orders|"):
            page=int(data.split('|')[1]);limit=10
            with managed_connect() as conn:rows=conn.execute("SELECT o.id,o.status,o.charge,o.quantity,s.name FROM smm_orders o JOIN smm_services s ON s.id=o.service_id WHERE o.user_id=? ORDER BY o.id DESC LIMIT ? OFFSET ?",(uid,limit+1,(page-1)*limit)).fetchall()
            buttons=[[p_btn(f"#{r['id']} · {r['name']} · {r['status'].title()} · ₹{r['charge']:.2f}",f"smm_order|{r['id']}")] for r in rows[:limit]];nav=[]
            if page>1:nav.append(p_btn("Prev",f"smm_orders|{page-1}"))
            if len(rows)>limit:nav.append(p_btn("Next",f"smm_orders|{page+1}"))
            if nav:buttons.append(nav)
            buttons.append([p_btn("Services","smm_page|1|price_low")]);await e.edit("📦 <b>My Orders</b>\n\nTrack status or order again.",buttons=buttons)
        elif data.startswith("smm_order|"):
            oid=int(data.split('|')[1])
            with managed_connect() as conn:o=conn.execute("SELECT o.*,s.name,s.refill,s.cancellable FROM smm_orders o JOIN smm_services s ON s.id=o.service_id WHERE o.id=? AND o.user_id=?",(oid,uid)).fetchone()
            if not o:return await e.answer("Order not found.",alert=True)
            buttons=[[p_btn("🔄 Refresh",f"smm_refresh|{oid}",style="primary")],[p_btn("🔁 Order Again",f"smm_view|{o['service_id']}")],[p_btn("Back","smm_orders|1")]]
            await e.edit(f"📦 <b>Order #{oid}</b>\n\nService: {html.escape(o['name'])}\nQuantity: {o['quantity']}\nCharge: ₹{o['charge']:.2f}\nStatus: <b>{o['status'].title()}</b>\nStart Count: {o['start_count'] or '-'}\nRemains: {o['remains'] if o['remains'] is not None else '-'}\nCreated: {o['created_at']}",buttons=buttons)
        elif data.startswith("smm_refresh|"):
            oid=int(data.split('|')[1])
            try:
                status,_,refund=await smm_refresh_order(oid)
                notice=f"Status: {status.title()}"
                if refund: notice+=f" · ₹{format_smm_money(refund['amount'])} refunded"
                await e.answer(notice,alert=True)
            except SMMError as exc:await send_admin_error(f"Order {oid} refresh failed",exc.detail);await e.answer("Could not refresh now.",alert=True)

        elif data.startswith("srv3_servers|"):
            page = max(1, int(data.split("|")[1]))
            limit, offset = 12, (page - 1) * 12
            with managed_connect() as conn:
                rows = conn.execute("""SELECT v.code,v.name,v.in_stock,COUNT(s.service_code) variants
                  FROM server3_servers v LEFT JOIN server3_services s ON s.server_code=v.code
                  AND s.enabled=1 AND s.in_stock=1 WHERE v.enabled=1 GROUP BY v.code,v.name,v.in_stock
                  ORDER BY v.name LIMIT ? OFFSET ?""", (limit + 1, offset)).fetchall()
            buttons = [[p_btn(f"{provider_country_display(r['name'])} · {r['variants']} service(s)", f"srv3_server|{r['code']}|1", style="primary")] for r in rows[:limit]]
            buttons.insert(0, [p_btn("🔎 Search Services", "srv3_search", style="success")])
            nav = []
            if page > 1: nav.append(p_btn("Prev", f"srv3_servers|{page-1}"))
            if len(rows) > limit: nav.append(p_btn("Next", f"srv3_servers|{page+1}"))
            if nav: buttons.append(nav)
            buttons.append([p_btn("Back", "menu_buy")])
            await e.edit(f"🖥 <b>{html.escape(managed_server_name(3))}</b>\n\nChoose an available server." if rows else "📭 Stock is updating. Please try again shortly.", buttons=buttons)

        elif data == "srv3_search":
            server3_search_state.add(uid)
            await e.edit(f"🔎 <b>Search {html.escape(managed_server_name(3))}</b>\n\nSend a service name or code.\n\nPopular: <code>telegram</code>, <code>whatsapp</code>, <code>gmail</code>, <code>facebook</code>, <code>instagram</code>, <code>tiktok</code>.", buttons=[[p_btn("Cancel", "srv3_servers|1")]])

        elif data.startswith("srv3_server|"):
            _, server_code, page_text = data.split("|")
            page, limit = max(1, int(page_text)), 12
            cfg = server3.config()
            with managed_connect() as conn:
                server_row = conn.execute("SELECT name FROM server3_servers WHERE code=? AND enabled=1", (server_code,)).fetchone()
                rows = conn.execute("""SELECT service_code,name,provider_price FROM server3_services
                  WHERE server_code=? AND enabled=1 AND in_stock=1""",(server_code,)).fetchall()
            if not server_row: return await e.answer("This server is disabled.", alert=True)
            prepared=[(row,max(cfg.minimum_price,row[2]*(1+cfg.percent_markup/100)+cfg.fixed_markup)) for row in rows]
            mode=provider_sort(uid,3)
            prepared.sort(key=(lambda item:item[1]) if mode=="price_low" else (lambda item:-item[1]) if mode=="price_high" else (lambda item:item[0][1].casefold()))
            visible=prepared[(page-1)*limit:page*limit+1]
            buttons=[[p_btn("A-Z",f"sort_provider|3|az|srv3_server|{server_code}|1",style="primary"),p_btn("Price ↑",f"sort_provider|3|price_low|srv3_server|{server_code}|1",style="primary"),p_btn("Price ↓",f"sort_provider|3|price_high|srv3_server|{server_code}|1",style="primary")]]
            for row,final in visible[:limit]:
                if not cfg.maximum_price or final <= cfg.maximum_price:
                    buttons.append([p_btn(f"{row[1]} ({row[0]}) · ₹{int(round(final))}", f"srv3_buy|{row[0]}|{server_code}",style="success")])
            nav=[]
            if page>1: nav.append(p_btn("Prev",f"srv3_server|{server_code}|{page-1}"))
            if len(visible)>limit: nav.append(p_btn("Next",f"srv3_server|{server_code}|{page+1}"))
            if nav: buttons.append(nav)
            buttons.append([p_btn("All Servers","srv3_servers|1")])
            message=f"📲 <b>{html.escape(server_row['name'])}</b>\n\nChoose an available service." if rows else f"?? <b>{html.escape(server_row['name'])}</b> currently has no available services."
            await e.edit(message,buttons=buttons)

        elif data.startswith("srv3_variants|"):
            _, service_code, page_text = data.split("|")
            page, limit = max(1, int(page_text)), 12
            cfg = server3.config()
            with managed_connect() as conn:
                rows = conn.execute("""SELECT s.server_code,v.name,s.provider_price FROM server3_services s
                  JOIN server3_servers v ON v.code=s.server_code WHERE s.service_code=? AND s.enabled=1
                  AND s.in_stock=1 AND v.enabled=1 AND v.in_stock=1 ORDER BY s.provider_price LIMIT ? OFFSET ?""",
                  (service_code, limit + 1, (page - 1) * limit)).fetchall()
            buttons = []
            for row in rows[:limit]:
                final = max(cfg.minimum_price, row[2] * (1 + cfg.percent_markup / 100) + cfg.fixed_markup)
                if cfg.maximum_price > 0 and final > cfg.maximum_price: continue
                buttons.append([p_btn(f"{provider_country_display(row[1])} · ₹{int(round(final))}", f"srv3_buy|{service_code}|{row[0]}",style="success")])
            nav = []
            if page > 1: nav.append(p_btn("Prev", f"srv3_variants|{service_code}|{page-1}"))
            if len(rows) > limit: nav.append(p_btn("Next", f"srv3_variants|{service_code}|{page+1}"))
            if nav: buttons.append(nav)
            buttons.append([p_btn("Back", "srv3_servers|1")])
            await e.edit(f"📡 <b>{html.escape(managed_server_name(3))}</b>\nService: <code>{html.escape(service_code)}</code>", buttons=buttons)

        elif data.startswith("srv3_buy|"):
            _, service_code, server_code = data.split("|")
            cfg = server3.config()
            with managed_connect() as conn:
                item = conn.execute("""SELECT s.provider_price,s.name,v.name server_name FROM server3_services s
                  JOIN server3_servers v ON v.code=s.server_code WHERE s.service_code=? AND s.server_code=?
                  AND s.enabled=1 AND s.in_stock=1 AND v.enabled=1""", (service_code, server_code)).fetchone()
            if not item: return await e.answer("This stock is no longer available.", alert=True)
            charge = apply_server_discount(uid, 3, int(round(max(cfg.minimum_price, item[0] * (1 + cfg.percent_markup / 100) + cfg.fixed_markup))))
            if cfg.maximum_price > 0 and charge > cfg.maximum_price: return await e.answer("This stock exceeds the configured maximum price.", alert=True)
            balance = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
            if balance < charge: return await e.answer(f"Insufficient balance. Need ₹{charge}.", alert=True)
            server3_purchase_state[uid]=(service_code,server_code,charge,time.monotonic()+120)
            await e.edit(
                f"📲 <b>Confirm Number Purchase</b>\n\n"
                f"Country / Server: <b>{html.escape(provider_country_display(item['server_name']))}</b>\n"
                f"Service: <b>{html.escape(item['name'])}</b> (<code>{html.escape(service_code)}</code>)\n"
                f"Price: <b>₹{charge}</b>\nBalance: <b>₹{balance}</b>\n\n"
                f"One OTP is included. If no OTP arrives, cancellation becomes available after the displayed waiting period and the order auto-expires after {ACTIVATION_TTL // 60} minutes.",
                buttons=[[p_btn("✅ Confirm Purchase",f"srv3_confirm|{service_code}|{server_code}",style="success")],
                         [p_btn("❌ Cancel",f"srv3_server|{server_code}|1",style="danger")]],
            )

        elif data.startswith("srv3_confirm|"):
            _, service_code, server_code = data.split("|")
            confirmation=server3_purchase_state.pop(uid,None)
            if not confirmation or confirmation[:2]!=(service_code,server_code) or confirmation[3]<time.monotonic():
                return await e.answer("This confirmation expired or was already used. Please select the service again.",alert=True)
            cfg = server3.config()
            with managed_connect() as conn:
                item = conn.execute("""SELECT s.provider_price,v.name server_name FROM server3_services s
                  JOIN server3_servers v ON v.code=s.server_code WHERE s.service_code=? AND s.server_code=?
                  AND s.enabled=1 AND s.in_stock=1""", (service_code, server_code)).fetchone()
            if not item: return await e.answer("This stock is no longer available.", alert=True)
            charge = apply_server_discount(uid, 3, int(round(max(cfg.minimum_price, item[0] * (1 + cfg.percent_markup / 100) + cfg.fixed_markup))))
            if cfg.maximum_price > 0 and charge > cfg.maximum_price: return await e.answer("This stock exceeds the configured maximum price.", alert=True)
            balance = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
            if balance < charge: return await e.answer(f"Insufficient balance. Need ₹{charge}.", alert=True)
            activation = None
            try:
                activation = await server3_client.get_number(service_code, server_code)
                cur.execute("UPDATE users SET balance=balance-? WHERE user_id=? AND balance>=?", (charge, uid, charge))
                if cur.rowcount != 1:
                    await server3_client.set_status(activation.order_id, 8)
                    return await e.answer("Balance changed; provider activation was cancelled.", alert=True)
                created=datetime.now(timezone.utc)
                cur.execute("""INSERT INTO server3_orders(provider_order_id,user_id,service_code,server_code,phone,provider_price,charged_price,status,expires_at,created_at,updated_at)
                  VALUES(?,?,?,?,?,?,?,'waiting',?,?,?)""", (activation.order_id, uid, service_code, server_code, activation.phone, item[0], charge, expiry_timestamp(created), created.isoformat(), created.isoformat()))
                db.commit()
                wait=cancellation_wait(created.isoformat())
                phone=provider_phone_details(activation.phone)
                await log_primary_purchase(uid,item['server_name'],charge,charge,2024,1,activation.phone,"Server 3",activation.order_id)
                await e.edit(f"✅ <b>Number allocated</b>\n\nNumber: {phone['flag']} <code>{html.escape(phone['full'])}</code>\nPrice: ₹{charge}\nOrder: <code>{html.escape(activation.order_id)}</code>\n\nWaiting for one OTP…\nCancellation available in: <b>{wait // 60:02d}:{wait % 60:02d}</b>", buttons=[[p_copy_btn("📋 Copy Number",phone['full']),p_copy_btn("📋 Copy Without Code",phone['local'])],[p_btn("🔄 Check OTP", f"srv3_status|{activation.order_id}",style="primary")], [p_btn("❌ Cancel / Refund", f"srv3_cancel|{activation.order_id}",style="danger")]])
            except DGOTPError as exc:
                if exc.code == "NO_NUMBERS":
                    with managed_connect() as conn:
                        conn.execute("UPDATE server3_services SET in_stock=0 WHERE service_code=? AND server_code=?", (service_code, server_code)); conn.commit()
                await report_server3_user_error(e, exc, "number allocation")
            except Exception as exc:
                db.rollback()
                logger.exception("Server 3 order persistence failed: %s", exc)
                if activation:
                    try: await server3_client.set_status(activation.order_id, 8)
                    except Exception: pass
                await e.answer("The order could not be saved and was cancelled. Your wallet was not charged.", alert=True)

        elif data.startswith("srv3_status|"):
            order_id = data.split("|", 1)[1]
            with managed_connect() as conn:
                owned = conn.execute("SELECT status FROM server3_orders WHERE provider_order_id=? AND user_id=?", (order_id, uid)).fetchone()
            if not owned: return await e.answer("Order not found.", alert=True)
            if owned['status'] != 'waiting': return await e.answer("This order is already closed. OTPs are delivered only once.", alert=True)
            try:
                status, code = await server3_client.get_status(order_id)
                if code:
                    completed=complete_order("server3_orders",order_id,code)
                    if not completed:return await e.answer("This order is already closed.",alert=True)
                    await e.edit(f"✅ <b>OTP received</b>\n\nCode: <code>{html.escape(code)}</code>\nOrder: <code>{html.escape(order_id)}</code>\n\nCompleted successfully. This OTP will not be delivered again.", buttons=[[p_btn("Back", "srv3_servers|1",style="primary")]])
                elif status=="cancelled":
                    refund=cancel_and_refund("server3_orders",order_id,"provider_cancelled")
                    await e.answer(f"Activation cancelled. ₹{refund['amount']} refunded." if refund else "Activation cancelled.",alert=True)
                else: await e.answer("Still waiting for SMS.", alert=True)
            except DGOTPError as exc: await report_server3_user_error(e, exc, "SMS status")

        elif data.startswith("srv3_cancel|"):
            action_name, order_id = data.split("|", 1)
            with managed_connect() as conn:
                owned = conn.execute("SELECT status,charged_price,created_at FROM server3_orders WHERE provider_order_id=? AND user_id=?", (order_id, uid)).fetchone()
            if not owned: return await e.answer("Order not found.", alert=True)
            if owned['status'] != 'waiting': return await e.answer("This order is already closed and cannot be refunded again.",alert=True)
            remaining=cancellation_wait(owned['created_at'])
            if remaining:return await e.answer(f"Please wait {remaining // 60:02d}:{remaining % 60:02d} before cancelling. OTP checking continues automatically.",alert=True)
            try:
                response=await server3_client.set_status(order_id,8)
                if response not in ("ACCESS_CANCEL","ACCESS_CANCEL_ALREADY","STATUS_CANCEL"):
                    return await e.answer("Cancellation is awaiting confirmation. No refund is issued until cancellation succeeds.",alert=True)
                refund=cancel_and_refund("server3_orders",order_id,"user_cancelled")
                return await e.edit(f"↩️ <b>Order cancelled</b>\n\nRefund: ₹{refund['amount']}" if refund else "This order was already closed.",buttons=[[p_btn("Back","srv3_servers|1",style="primary")]])
            except DGOTPError as exc: await report_server3_user_error(e, exc, "activation update")

        # --- SERVER 4 (TEMPORASMS) ---
        elif data == "srv4_operators":
            with managed_connect() as conn:
                rows=conn.execute("""SELECT code,name FROM server4_operators o WHERE enabled=1
                  AND EXISTS(SELECT 1 FROM server4_stock s WHERE s.operator_code=o.code AND s.available_count>0)
                  ORDER BY name""").fetchall()
            buttons=[[p_btn(f"📡 {r['name']}",f"srv4_countries|{r['code']}|1",style="primary")] for r in rows]
            buttons.append([p_btn("Back","menu_buy")])
            await e.edit(f"🌐 <b>{html.escape(managed_server_name(4))}</b>\nChoose a network." if rows else "Stock is updating. Please try again shortly.",buttons=buttons)

        elif data.startswith("srv4_countries|"):
            _,operator,page_text=data.split("|");page=int(page_text);limit=15
            with managed_connect() as conn:
                rows=conn.execute("""SELECT c.country_code,c.name,COUNT(DISTINCT s.service_code) service_count,SUM(s.available_count) total_stock FROM server4_countries c
                  JOIN server4_stock s ON s.operator_code=c.operator_code AND s.country_code=c.country_code
                  WHERE c.operator_code=? AND c.enabled=1 AND c.in_stock=1
                  AND EXISTS(SELECT 1 FROM server4_stock s WHERE s.operator_code=c.operator_code AND s.country_code=c.country_code AND s.available_count>0)
                  GROUP BY c.country_code,c.name ORDER BY c.name LIMIT ? OFFSET ?""",(operator,limit+1,(page-1)*limit)).fetchall()
            buttons=[[p_btn(f"{get_flag_by_country_name(r['name'])} {r['name']} · {r['service_count']} services",f"srv4_services|{operator}|{r['country_code']}|1",style="primary")] for r in rows[:limit]]
            buttons.insert(0,[p_btn("🔎 Search Countries",f"srv4_country_search|{operator}",style="primary"),p_btn("🔎 Search Services",f"srv4_search|{operator}",style="success")])
            nav=[]
            if page>1:nav.append(p_btn("Prev",f"srv4_countries|{operator}|{page-1}"))
            if len(rows)>limit:nav.append(p_btn("Next",f"srv4_countries|{operator}|{page+1}"))
            if nav:buttons.append(nav)
            buttons.append([p_btn("Back","srv4_operators")]);await e.edit("🏳️ <b>Choose Country</b>",buttons=buttons)

        elif data.startswith("srv4_search|"):
            operator=data.split("|",1)[1];server4_search_state[uid]=operator
            await e.edit(f"🔎 <b>Search {html.escape(managed_server_name(4))}</b>\n\nSend a service name or code, for example <code>WhatsApp</code>, <code>Telegram</code>, <code>wa</code>, or <code>tg</code>.",buttons=[[p_btn("Cancel",f"srv4_countries|{operator}|1")]])

        elif data.startswith("srv4_country_search|"):
            operator=data.split("|",1)[1];server4_country_search_state[uid]=operator
            await e.edit(f"🔎 <b>Search Countries</b>\n\nSend a country name or country code, for example <code>India</code>, <code>22</code>, <code>United States</code>, or <code>US</code>.",buttons=[[p_btn("Cancel",f"srv4_countries|{operator}|1")]])

        elif data.startswith("srv4_services|"):
            _,operator,country,page_text=data.split("|");page=int(page_text);limit=15
            with managed_connect() as conn:
                rows=conn.execute("""SELECT v.service_code,v.name,s.min_price,s.available_count FROM server4_services v
                  JOIN server4_stock s ON s.operator_code=v.operator_code AND s.service_code=v.service_code
                  WHERE v.operator_code=? AND s.country_code=? AND v.enabled=1 AND v.in_stock=1 AND s.available_count>0
                  """,(operator,country)).fetchall()
            cfg=server4.config()
            prepared=[(r,max(cfg.minimum_price,r['min_price']*(1+cfg.percent_markup/100)+cfg.fixed_markup)) for r in rows]
            mode=provider_sort(uid,4)
            prepared.sort(key=(lambda item:item[1]) if mode=="price_low" else (lambda item:-item[1]) if mode=="price_high" else (lambda item:item[0]['name'].casefold()))
            visible=prepared[(page-1)*limit:page*limit+1]
            buttons=[[p_btn("A-Z",f"sort_provider|4|az|srv4_services|{operator}|{country}|1"),p_btn("Price ↑",f"sort_provider|4|price_low|srv4_services|{operator}|{country}|1"),p_btn("Price ↓",f"sort_provider|4|price_high|srv4_services|{operator}|{country}|1")]]
            for r,final in visible[:limit]:
                if not cfg.maximum_price or final<=cfg.maximum_price:
                    buttons.append([p_btn(f"{r['name']} · ₹{int(round(final))} · {r['available_count']} available",f"srv4_quote|{operator}|{country}|{r['service_code']}")])
            nav=[]
            if page>1:nav.append(p_btn("Prev",f"srv4_services|{operator}|{country}|{page-1}"))
            if len(visible)>limit:nav.append(p_btn("Next",f"srv4_services|{operator}|{country}|{page+1}"))
            if nav:buttons.append(nav)
            buttons.append([p_btn("Back",f"srv4_countries|{operator}|1")]);await e.edit("📲 <b>Choose Service</b>",buttons=buttons)

        elif data.startswith("srv4_quote|"):
            _,operator,country,service=data.split("|")
            try:
                provider_price=await server4_client.minimum_price(operator,country,service)
                cfg=server4.config();charge=int(round(max(cfg.minimum_price,provider_price*(1+cfg.percent_markup/100)+cfg.fixed_markup)))
                if cfg.maximum_price and charge>cfg.maximum_price:return await e.answer("Service exceeds the configured maximum price.",alert=True)
                server4_purchase_state[uid]=(operator,country,service,provider_price,charge,time.monotonic()+120)
                await e.edit(f"📲 <b>Confirm {html.escape(managed_server_name(4))} Number</b>\n\nPrice: ₹{charge}\nNetwork: <code>{operator}</code>\nCountry: <code>{country}</code>\nService: <code>{service}</code>",buttons=[[p_btn("Buy",f"srv4_buy|{operator}|{country}|{service}|{provider_price}|{charge}",style="success")],[p_btn("Back",f"srv4_services|{operator}|{country}|1")]])
            except TemporaError as exc:
                await send_admin_error("Server 4 quote failed",str(exc));await e.answer("Server 4 is temporarily unavailable. Admin notified.",alert=True)

        elif data.startswith("srv4_buy|"):
            _,operator,country,service,provider_text,charge_text=data.split("|");provider_price=float(provider_text);charge=int(charge_text)
            confirmation=server4_purchase_state.pop(uid,None)
            if not confirmation or confirmation[:3]!=(operator,country,service) or confirmation[5]<time.monotonic():
                return await e.answer("This confirmation expired or was already used. Please select the service again.",alert=True)
            provider_price,charge=confirmation[3],apply_server_discount(uid, 4, confirmation[4])
            balance=cur.execute("SELECT balance FROM users WHERE user_id=?",(uid,)).fetchone()[0]
            if balance<charge:return await e.answer(f"Insufficient balance. Need ₹{charge}.",alert=True)
            activation=None
            try:
                activation,actual_provider_cost=await server4_client.get_number_v2(service,country,operator,provider_price)
                cur.execute("UPDATE users SET balance=balance-? WHERE user_id=? AND balance>=?",(charge,uid,charge))
                if cur.rowcount!=1:
                    await server4_client.set_status(activation.order_id,8);return await e.answer("Balance changed; activation cancelled.",alert=True)
                created=datetime.now(timezone.utc);now=created.isoformat();cur.execute("""INSERT INTO server4_orders(provider_order_id,user_id,operator_code,country_code,service_code,phone,provider_price,charged_price,status,expires_at,created_at,updated_at)
                  VALUES(?,?,?,?,?,?,?,?, 'waiting',?,?,?)""",(activation.order_id,uid,operator,country,service,activation.phone,actual_provider_cost,charge,expiry_timestamp(created),now,now));db.commit()
                wait=cancellation_wait(now)
                phone=provider_phone_details(activation.phone)
                with managed_connect() as conn:country_row=conn.execute("SELECT name FROM server4_countries WHERE operator_code=? AND country_code=?",(operator,country)).fetchone()
                await log_primary_purchase(uid,country_row['name'] if country_row else country,charge,charge,2024,1,activation.phone,"Server 4",activation.order_id)
                await e.edit(f"✅ <b>{html.escape(managed_server_name(4))} Number</b>\n\nNumber: {phone['flag']} <code>{html.escape(phone['full'])}</code>\nOrder: <code>{activation.order_id}</code>\n\nWaiting for one OTP…\nCancellation available in: <b>{wait // 60:02d}:{wait % 60:02d}</b>",buttons=[[p_copy_btn("📋 Copy Number",phone['full']),p_copy_btn("📋 Copy Without Code",phone['local'])],[p_btn("🔄 Check OTP",f"srv4_status|{activation.order_id}",style="primary")],[p_btn("❌ Cancel / Refund",f"srv4_set|8|{activation.order_id}",style="danger")]])
            except TemporaError as exc:
                db.rollback();await send_admin_error("Server 4 allocation failed",str(exc));await e.answer("Server 4 could not complete the request. Admin notified.",alert=True)
            except Exception as exc:
                db.rollback()
                if activation:
                    try: await server4_client.set_status(activation.order_id,8)
                    except Exception: pass
                await send_admin_error("Server 4 order persistence failed",str(exc))
                await e.answer("The order could not be saved. Your wallet was not charged and support was notified.",alert=True)

        elif data.startswith("srv4_status|"):
            order_id=data.split("|",1)[1]
            with managed_connect() as conn: owned=conn.execute("SELECT status FROM server4_orders WHERE provider_order_id=? AND user_id=?",(order_id,uid)).fetchone()
            if not owned:return await e.answer("Order not found.",alert=True)
            if owned['status']!='waiting':return await e.answer("This order is already closed. OTPs are delivered only once.",alert=True)
            try:
                status,code=await server4_client.get_status(order_id)
                if code:
                    completed=complete_order("server4_orders",order_id,code)
                    if not completed:return await e.answer("This order is already closed.",alert=True)
                    return await e.edit(f"✅ <b>OTP received</b>\n\nCode: <code>{html.escape(code)}</code>\n\nCompleted successfully. This OTP will not be delivered again.",buttons=[[p_btn("Back","srv4_operators",style="primary")]])
                if status=="cancelled":
                    refund=cancel_and_refund("server4_orders",order_id,"provider_cancelled")
                    return await e.answer(f"Activation cancelled. ₹{refund['amount']} refunded." if refund else "Activation cancelled.",alert=True)
                await e.answer("Waiting for SMS.",alert=True)
            except TemporaError as exc:await send_admin_error("Server 4 status failed",str(exc));await e.answer("Status unavailable. Admin notified.",alert=True)

        elif data.startswith("srv4_set|"):
            _,status_text,order_id=data.split("|")
            with managed_connect() as conn: owned=conn.execute("SELECT charged_price,status,created_at FROM server4_orders WHERE provider_order_id=? AND user_id=?",(order_id,uid)).fetchone()
            if not owned:return await e.answer("Order not found.",alert=True)
            if status_text!="8":return await e.answer("Only one OTP is supported for each order.",alert=True)
            if owned['status']!='waiting':return await e.answer("This order is already closed and cannot be refunded again.",alert=True)
            remaining=cancellation_wait(owned['created_at'])
            if remaining:return await e.answer(f"Please wait {remaining // 60:02d}:{remaining % 60:02d} before cancelling. OTP checking continues automatically.",alert=True)
            try:
                response=await server4_client.set_status(order_id,int(status_text))
                if response not in ("ACCESS_CANCEL","ACCESS_CANCEL_ALREADY","STATUS_CANCEL"):
                    return await e.answer("Cancellation is awaiting confirmation. No refund is issued until cancellation succeeds.",alert=True)
                refund=cancel_and_refund("server4_orders",order_id,"user_cancelled")
                return await e.edit(f"↩️ <b>Order cancelled</b>\n\nRefund: ₹{refund['amount']}" if refund else "This order was already closed.",buttons=[[p_btn("Back","srv4_operators",style="primary")]])
            except TemporaError as exc:await send_admin_error("Server 4 status update failed",str(exc));await e.answer("Request failed. Admin notified.",alert=True)

        # --- SERVER 1 (AUTOMATED GLOBAL MARKET) ---
        elif data.startswith("srv_1_pg|"):
            page = int(data.split("|")[1])
            await render_server1_country_page(e, uid, page)

        elif data == "lzt_all_countries":
            await e.answer("Sending Server 1 country list...", alert=False)
            await send_all_countries_list(uid)

        elif data == "lzt_search_country":
            lzt_search_state[uid] = True
            await e.edit(
                "<tg-emoji emoji-id='6032850693348399258'>🔎</tg-emoji> <b>Search Server 1 Country</b>\n\n"
                "Send a country key now. Examples: <code>+91</code>, <code>Ind</code>, <code>US</code>",
                buttons=[[p_btn("Back", "srv_1_pg|1")]]
            )

        elif data == "lzt_refresh_cache":
            await e.answer("Recalculating and synchronizing server stocks... Please wait.", alert=True)
            flt = get_user_filters(uid)
            fkey = get_filter_key(flt)
            active_filter_keys.add(fkey)

            sem = asyncio.Semaphore(max(1, LZT_CACHE_CONCURRENCY))
            async def quick_fetch(country_name):
                async with sem:
                    try:
                        d = await fetch_lzt_country_data_with_filters(
                            country_name, flt["spam"], flt["geoblock"], flt["offline"], flt["login_mail"], flt["premium"]
                        )
                        if fkey not in cached_lzt_stock:
                            cached_lzt_stock[fkey] = {}
                        if d is not None:
                            cached_lzt_stock[fkey][country_name] = (d[1], d[2])
                    except:
                        if fkey not in cached_lzt_stock:
                            cached_lzt_stock[fkey] = {}
            tasks = [quick_fetch(c) for c in COUNTRY_CODES.keys()]
            await asyncio.gather(*tasks)

            class FakeEv:
                data = b"srv_1_pg|1"
                sender_id = uid
                async def edit(self, text, buttons): await e.edit(text, buttons=buttons)
                async def answer(self, text, alert=False): pass
            await handle_callbacks(FakeEv())

        elif data == "lzt_toggle_filters":
            flt = get_user_filters(uid)
            msg = (f"⚙️ <b>Server 1 Search Filter Configurations</b>\n\n"
                   f"Select search properties to apply on catalog lookups:")

            spam_st = "🟢 NO SPAM" if flt["spam"] == "no" else ("🔴 ALLOW SPAM" if flt["spam"] == "yes" else "🔵 ANY")
            geo_st = "🟢 NO GEO-BLOCK" if flt["geoblock"] == "no" else ("🔴 BLOCKED" if flt["geoblock"] == "yes" else "🔵 ANY")
            mail_st = "🟢 MAIL INCLUDED" if flt["login_mail"] == "yes" else ("🔴 NO MAIL" if flt["login_mail"] == "no" else "🔵 ANY")
            offline_st = f"🔵 ≥{flt['offline']} Days" if flt['offline'] != "any" else "🔵 ANY"
            prem_st = "🟢 PREMIUM ONLY" if flt["premium"] == "yes" else ("🔴 NON-PREMIUM ONLY" if flt["premium"] == "no" else "🔵 ANY")

            btns = [
                [p_btn(f"Spam filter: {spam_st}", "flt_chg|spam")],
                [p_btn(f"Geo-block filter: {geo_st}", "flt_chg|geoblock")],
                [p_btn(f"Login Mail: {mail_st}", "flt_chg|login_mail")],
                [p_btn(f"Premium filter: {prem_st}", "flt_chg|premium")],
                [p_btn(f"Offline filter: {offline_st}", "flt_chg|offline")],
                [p_btn("✅ Apply Filters and Back", "srv_1_pg|1"), p_btn("🔄 Refresh", "lzt_refresh_cache")]
            ]
            await e.edit(msg, buttons=btns)


        elif data == "lzt_sort_menu":
            flt = get_user_filters(uid)
            current = flt.get("sort", "az")
            labels = {"az": "A-Z", "price_low": "Price Low To High", "price_high": "Price High To Low", "stock_low": "Stock Low To High", "stock_high": "Stock High To Low"}
            def mark(mode):
                return "✅ " if current == mode else ""
            btns = [
                [p_btn(f"{mark('az')}A-Z", "lzt_sort|az")],
                [p_btn(f"{mark('price_low')}Price Low To High", "lzt_sort|price_low")],
                [p_btn(f"{mark('price_high')}Price High To Low", "lzt_sort|price_high")],
                [p_btn(f"{mark('stock_low')}Stock Low To High", "lzt_sort|stock_low")],
                [p_btn(f"{mark('stock_high')}Stock High To Low", "lzt_sort|stock_high")],
                [p_btn("Back", "srv_1_pg|1")]
            ]
            await e.edit("↕️ <b>Choose Server 1 Sorting</b>\n\nThis changes the country list order only.", buttons=btns)

        elif data.startswith("lzt_sort|"):
            mode = data.split("|", 1)[1]
            if mode not in ("az", "price_low", "price_high", "stock_low", "stock_high"):
                return await safe_answer_cb(e, "Invalid sorting option.", alert=True)
            get_user_filters(uid)["sort"] = mode
            await render_server1_country_page(e, uid, 1)

        elif data.startswith("flt_chg|"):
            attrib = data.split("|")[1]
            flt = get_user_filters(uid)

            if attrib == "spam":
                flt["spam"] = "yes" if flt["spam"] == "no" else ("any" if flt["spam"] == "yes" else "no")
            elif attrib == "geoblock":
                flt["geoblock"] = "yes" if flt["geoblock"] == "no" else ("any" if flt["geoblock"] == "yes" else "no")
            elif attrib == "login_mail":
                flt["login_mail"] = "no" if flt["login_mail"] == "yes" else ("any" if flt["login_mail"] == "no" else "yes")
            elif attrib == "premium":
                flt["premium"] = "no" if flt["premium"] == "yes" else ("any" if flt["premium"] == "no" else "yes")
            elif attrib == "offline":
                flt["offline"] = "7" if flt["offline"] == "1" else ("14" if flt["offline"] == "7" else ("30" if flt["offline"] == "14" else ("any" if flt["offline"] == "30" else "1")))
            elif attrib == "sort":
                order = ["az", "stock_high", "stock_low", "price_low", "price_high"]
                flt["sort"] = order[(order.index(flt.get("sort", "az")) + 1) % len(order)] if flt.get("sort", "az") in order else "az"

            fkey = get_filter_key(flt)
            active_filter_keys.add(fkey)

            flt = get_user_filters(uid)
            msg = (f"⚙️ <b>Server 1 Search Filter Configurations</b>\n\n"
                   f"Select search properties to apply on catalog lookups:")

            spam_st = "🟢 NO SPAM" if flt["spam"] == "no" else ("🔴 ALLOW SPAM" if flt["spam"] == "yes" else "🔵 ANY")
            geo_st = "🟢 NO GEO-BLOCK" if flt["geoblock"] == "no" else ("🔴 BLOCKED" if flt["geoblock"] == "yes" else "🔵 ANY")
            mail_st = "🟢 MAIL INCLUDED" if flt["login_mail"] == "yes" else ("🔴 NO MAIL" if flt["login_mail"] == "no" else "🔵 ANY")
            offline_st = f"🔵 ≥{flt['offline']} Days" if flt['offline'] != "any" else "🔵 ANY"
            prem_st = "🟢 PREMIUM ONLY" if flt["premium"] == "yes" else ("🔴 NON-PREMIUM ONLY" if flt["premium"] == "no" else "🔵 ANY")

            btns = [
                [p_btn(f"Spam filter: {spam_st}", "flt_chg|spam")],
                [p_btn(f"Geo-block filter: {geo_st}", "flt_chg|geoblock")],
                [p_btn(f"Login Mail: {mail_st}", "flt_chg|login_mail")],
                [p_btn(f"Premium filter: {prem_st}", "flt_chg|premium")],
                [p_btn(f"Offline filter: {offline_st}", "flt_chg|offline")],
                [p_btn("✅ Apply Filters and Back", "srv_1_pg|1"), p_btn("🔄 Refresh", "lzt_refresh_cache")]
            ]
            await e.edit(msg, buttons=btns)

        elif data.startswith("lzt_chk|"):
            parts = data.split("|")
            iso_code = parts[1]
            page = int(parts[2]) if len(parts) > 2 else 1

            await e.answer("Loading interactive catalog...", alert=False)

            country = next((k for k, v in COUNTRY_CODES.items() if v[0] == iso_code), "United States")
            flag = COUNTRY_CODES.get(country, ("US", "🇺🇸"))[1]

            flt = get_user_filters(uid)
            params = {
                "country[]": iso_code,
                "spam": flt["spam"] if flt["spam"] != "any" else None,
                "nsb": 1,
                "pmin": 0.01,
                "pmax": 1000,
                "page": page,
                "per_page": 40,
                "password": "no",
                "currency": LZT_PRICE_CURRENCY
            }
            if flt["offline"] != "any":
                params["daybreak"] = int(flt["offline"])
            if flt["premium"] != "any":
                params["premium"] = flt["premium"]

            res = await lzt_request('GET', '/telegram', params=params, timeout_total=LZT_STOCK_TIMEOUT, max_retries=LZT_STOCK_RETRIES, notify_errors=False)
            if isinstance(res, dict) and 'items' in res and len(res['items']) == 0 and params["country[]"] != country:
                params["country[]"] = country
                res = await lzt_request('GET', '/telegram', params=params, timeout_total=LZT_STOCK_TIMEOUT, max_retries=1, notify_errors=False)

            if not res or 'items' not in res or len(res['items']) == 0:
                empty_msg = (f"❌ <b>Stock Empty!</b>\n\n"
                             f"There are currently no active listings for <b>{country} {flag}</b> on Server 1.\n"
                             f"Please choose another country or check back soon.")
                btns = [
                    [p_btn("🔄 Refresh Catalog Info", f"lzt_chk|{iso_code}|1")],
                    [p_btn("Change Country", "srv_1_pg|1")]
                ]
                await e.edit(empty_msg, buttons=btns)
                return

            matched_items = filter_lzt_items(res.get('items', []), flt)
            if not matched_items:
                empty_msg = (f"❌ <b>Stock Empty!</b>\n\n"
                             f"No listings matched your active filters for <b>{country} {flag}</b>.\n"
                             f"Try changing filters or choose another country.")
                btns = [
                    [p_btn("⚙️ Change Filters", "lzt_toggle_filters")],
                    [p_btn("🔄 Refresh Catalog Info", f"lzt_chk|{iso_code}|1")],
                    [p_btn("Change Country", "srv_1_pg|1")]
                ]
                await e.edit(empty_msg, buttons=btns)
                return
            items = sorted(matched_items, key=lambda x: float(x.get('price_with_fee') or x.get('priceWithSellerFee') or x.get('price') or 99999))[:40]
            total_items = res.get('totalItems', len(items)) if len(matched_items) == len(res.get('items', [])) else len(matched_items)
            total_pages = max(1, (total_items + 39) // 40)

            markup = get_lzt_markup(country)
            starting_price = lzt_final_inr_price(items[0], markup) if items else 0

            msg = (f"📦 Found: {total_items} | Page {page}/{total_pages}\n"
                   f"💰 Starting Price: {format_price(uid, starting_price)}\n"
                   f"🔽 Filters: {country} {flag} | ⚡ Cheap | 📊 Cheapest | "
                   f"Spam: {flt['spam']} | Geo: {flt['geoblock']} | Mail: {flt['login_mail']} | "
                   f"Premium: {flt['premium']} | Offline: {flt['offline']}\n\n"
                   f"Tap an account to view details & buy:\n")

            grid_buttons = [[p_btn("⚙️ Change Filters", "lzt_toggle_filters")]]
            grid_row = []

            for index, item in enumerate(items, start=1):
                final_price = lzt_final_inr_price(item, markup)
                global_index = (page - 1) * 40 + index

                item_id = int(item.get('item_id'))
                btn_lbl = f"[{country_button_label(country, include_phone=False)} #{global_index}] - {format_price(uid, final_price)}"
                grid_row.append(p_btn(btn_lbl, f"lzt_view|{item_id}|{country}|{final_price}"))
                if len(grid_row) == 2:
                    grid_buttons.append(grid_row)
                    grid_row = []
            if grid_row:
                grid_buttons.append(grid_row)

            nav = []
            if page > 1: nav.append(p_btn("⬅️ Prev Page", f"lzt_chk|{iso_code}|{page-1}"))
            if total_items > (page * 40): nav.append(p_btn("Next Page ➡️", f"lzt_chk|{iso_code}|{page+1}"))
            if nav: grid_buttons.append(nav)

            grid_buttons.append([p_btn("Change Country", "srv_1_pg|1")])
            await e.edit(msg, buttons=grid_buttons)

        elif data.startswith("lzt_view|"):
            _, item_id, country, _price_hint = data.split("|")
            await render_lzt_product(e, uid, item_id, country)


        elif data.startswith("lzt_mass_buy|"):
            _, first_item_id, price_str, country = data.split("|", 3)
            if uid in active_lzt_purchases:
                return await safe_answer_cb(e, "⏳ Please wait. Your previous Server 1 purchase is still processing.", alert=True)
            active_lzt_purchases[uid] = time.time()
            iso_code = COUNTRY_CODES.get(country, ("US", "🇺🇸"))[0]
            target_price = int(float(price_str))
            reserve_done = False
            tried = 0
            skipped = 0
            last_error = "No matching accounts found."
            try:
                async with get_user_lock(uid):
                    bal_row = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()
                    current_bal = bal_row[0] if bal_row else 0
                    if current_bal < target_price:
                        return await safe_answer_cb(e, f"❌ Insufficient Balance! Need {P_INR}{target_price}", alert=True)
                    cur.execute("UPDATE users SET balance = balance - ? WHERE user_id=? AND balance >= ?", (target_price, uid, target_price))
                    if cur.rowcount == 0:
                        return await safe_answer_cb(e, f"❌ Insufficient Balance! Need {P_INR}{target_price}", alert=True)
                    db.commit()
                    reserve_done = True

                await e.edit(
                    f"{P_TIME} <b>Mass Buy Started (Server 1)</b>\n\n"
                    f"Target price: {format_price(uid, target_price)}\n"
                    f"How it works: bot tries selected ID first, then other same-price IDs from this country until one purchase succeeds or all fail. Your balance is reserved now and refunded if all fail."
                )

                candidates = await get_lzt_candidate_items(uid, country, target_price, preferred_item_id=first_item_id, max_pages=3)
                if not candidates:
                    last_error = "No same-price Server 1 accounts were found."

                for item in candidates:
                    candidate_id = str(item.get('item_id') or item.get('id') or '')
                    if not candidate_id:
                        skipped += 1
                        continue
                    latest_res = await lzt_request('GET', f"/{candidate_id}", params=lzt_currency_params())
                    latest_item = latest_res.get('item') if isinstance(latest_res, dict) else item
                    if not latest_item or lzt_item_requires_password(latest_item):
                        skipped += 1
                        last_error = "Skipped password-required account."
                        continue
                    candidate_price = apply_server_discount(uid, 1, lzt_final_inr_price(latest_item, get_lzt_markup(country)))
                    if candidate_price != target_price:
                        skipped += 1
                        last_error = "Skipped account because price changed."
                        continue
                    market_price = lzt_market_price(latest_item)
                    if market_price is None:
                        skipped += 1
                        last_error = "Skipped account because market price was unavailable."
                        continue

                    tried += 1
                    try:
                        await e.edit(
                            f"{P_TIME} <b>Mass Buy Running...</b>\n\n"
                            f"Trying ID: <code>{candidate_id}</code>\n"
                            f"Tried: <b>{tried}</b> | Skipped: <b>{skipped}</b>\n"
                            f"Target price: {format_price(uid, target_price)}"
                        )
                    except MessageNotModifiedError:
                        pass

                    buy_res = await lzt_fast_buy_item(candidate_id, market_price)
                    if buy_res and not lzt_purchase_has_error(buy_res):
                        purchased_id = lzt_purchase_item_id(buy_res, candidate_id)
                        phone, display_phone = await finish_lzt_purchase_success(uid, purchased_id, country, target_price)
                        reserve_done = False
                        msg = (f"{P_YES} <b>Mass Buy Success (Server 1)!</b>\n\n"
                               f"{P_PHONE} <b>Phone:</b> <code>{display_phone}</code>\n"
                               f"<tg-emoji emoji-id='5776233299424843260'>🌐</tg-emoji> <b>Country:</b> {country}\n"
                               f"<tg-emoji emoji-id='6028435952299413210'>ℹ</tg-emoji> <b>Purchased ID:</b> <code>{purchased_id}</code>\n"
                               f" <tg-emoji emoji-id='6030657343744644592'>🔁</tg-emoji> <b>Attempts:</b> {tried} tried, {skipped} skipped\n\n"
                               f"<i>Click Get OTP when you need the latest login code.</i>")
                        btns = [
                            [p_btn("🔄 Get OTP", f"lzt_get_otp|{phone}")],
                            [p_btn("⬅ Back", f"lzt_chk|{iso_code}|1"), p_btn("Back to Menu", "menu_main")]
                        ]
                        sent_msg = await e.edit(msg, buttons=btns)
                        active_orders[phone] = {
                            'uid': uid, 'start_time': time.time(), 'paid': True, 'otp_sent': False,
                            'price': target_price, 'country': country, 'year': 2024,
                            'msg_id': sent_msg.id, 'phone_num': display_phone
                        }
                        return

                    last_error = lzt_error_text(buy_res) or "Purchase failed for this ID."

                if reserve_done:
                    async with get_user_lock(uid):
                        cur.execute("UPDATE users SET balance = balance + ? WHERE user_id=?", (target_price, uid))
                        db.commit()
                    reserve_done = False
                return await e.edit(
                    f"{P_NO} <b>Mass Buy Failed</b>\n\n"
                    f"Tried: <b>{tried}</b> | Skipped: <b>{skipped}</b>\n"
                    f"Reason: <code>{html.escape(str(last_error)[:500])}</code>\n\n"
                    f"Your reserved balance was refunded.",
                    buttons=[[p_btn("Back", f"lzt_chk|{iso_code}|1")], [p_btn("Change Country", "srv_1_pg|1")]]
                )
            finally:
                if reserve_done:
                    async with get_user_lock(uid):
                        cur.execute("UPDATE users SET balance = balance + ? WHERE user_id=?", (target_price, uid))
                        db.commit()
                active_lzt_purchases.pop(uid, None)

        elif data.startswith("lzt_buy|"):
            _, item_id, price_str, country = data.split("|")
            if uid in active_lzt_purchases:
                return await safe_answer_cb(e, "⏳ Please wait. Your previous Server 1 purchase is still processing.", alert=True)
            active_lzt_purchases[uid] = time.time()
            final_price = float(price_str)
            iso_code = COUNTRY_CODES.get(country, ("US", "🇺🇸"))[0]
            try:
                latest_res = await lzt_request('GET', f"/{item_id}", params=lzt_currency_params())
                latest_item = latest_res.get('item') if isinstance(latest_res, dict) else None
                market_price = lzt_market_price(latest_item)
                if not latest_item or market_price is None:
                    return await e.edit(f"{P_WARN} <b>Unable to load latest Server 1 price.</b>\nPlease refresh the stock and try again.", buttons=[[p_btn("Back", f"lzt_chk|{iso_code}|1")]])
                if lzt_item_requires_password(latest_item):
                    return await e.edit(
                        f"{P_WARN} <b>Cannot buy this Server 1 account.</b>\nThis listing requires a seller login password, so the bot skipped it before charging your wallet.",
                        buttons=[[p_btn("Back", f"lzt_chk|{iso_code}|1")], [p_btn("Change Country", "srv_1_pg|1")]]
                    )
                final_price = apply_server_discount(uid, 1, lzt_final_inr_price(latest_item, get_lzt_markup(country)))

                async with get_user_lock(uid):
                    bal_row = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()
                    current_bal = bal_row[0] if bal_row else 0
                    if current_bal < final_price:
                        return await safe_answer_cb(e, f"❌ Insufficient Balance! Need {P_INR}{final_price}", alert=True)
                    cur.execute("UPDATE users SET balance = balance - ? WHERE user_id=? AND balance >= ?", (final_price, uid, final_price))
                    if cur.rowcount == 0:
                        return await safe_answer_cb(e, f"❌ Insufficient Balance! Need {P_INR}{final_price}", alert=True)
                    db.commit()

                await e.edit(f"{P_TIME} <b>Purchasing from Server 1...</b>\n\nPlease wait for this purchase to finish before buying another account.")

                buy_res = await lzt_fast_buy_item(item_id, market_price)

                if lzt_purchase_has_error(buy_res):
                    async with get_user_lock(uid):
                        cur.execute("UPDATE users SET balance = balance + ? WHERE user_id=?", (final_price, uid))
                        db.commit()
                    err_text = lzt_error_text(buy_res)
                    if "password" in err_text.lower():
                        return await e.edit(f"{P_WARN} <b>Purchase skipped and refunded.</b>\nServer 1 says this account requires a seller login password, so it cannot be bought safely by the bot.", buttons=[[p_btn("Back", f"lzt_chk|{iso_code}|1")], [p_btn("Change Country", "srv_1_pg|1")]])
                    if "balance" in err_text.lower() or "средств" in err_text.lower() or "not enough" in err_text.lower():
                        return await e.edit(f"{P_WARN} <b>Server 1 Maintenance.</b>\nBalance refunded. Market balance is not enough; please notify admin or use Server 2.", buttons=[[p_btn("Back", "menu_buy")]])
                    if "timeout" in err_text.lower():
                        return await e.edit(f"{P_WARN} <b>Server 1 is slow right now.</b>\nMoney refunded. Please try again in a minute.", buttons=[[p_btn("Back", f"lzt_chk|{iso_code}|1")]])
                    return await e.edit(f"{P_NO} <b>Purchase Failed!</b> Account was sold or API busy. Money refunded.", buttons=[[p_btn("Back", f"lzt_chk|{iso_code}|1")]])

                item_id = lzt_purchase_item_id(buy_res, item_id)
                res = await lzt_request('GET', f"/{item_id}", params=lzt_currency_params())
                phone_num = f"LZT_{item_id}"
                if res and 'item' in res:
                    item = res['item']
                    phone_num = item.get('phone') or item.get('telegram_phone') or item.get('login') or f"LZT_{item_id}"

                display_phone = normalize_lzt_phone(phone_num, item_id)
                phone = f"LZT_{item_id}"

                async with get_user_lock(uid):
                    cur.execute(
                        "INSERT INTO orders (user_id, country, year, price, phone, otp, server) VALUES (?,?,?,?,?,?,?)",
                        (uid, country, 2024, final_price, display_phone, None, "Server 1")
                    )
                    local_order_id=cur.lastrowid
                    db.commit()
                await log_primary_purchase(uid, country, final_price, final_price, 2024, 1, display_phone, "Server 1",local_order_id or item_id)
                await try_lzt_reset_authorizations(item_id)

                msg = (f"{P_YES} <b>Account Purchased (Server 1)!</b>\n\n"
                       f"{P_PHONE} <b>Phone:</b> <code>{display_phone}</code>\n"
                       f"🏳️ <b>Country:</b> {country}\n\n"
                       f"<i>Click Get OTP when you need the latest login code.</i>")

                btns = [
                    [p_btn("🔄 Get OTP", f"lzt_get_otp|{phone}")],
                    [p_btn("⬅ Back", f"lzt_chk|{iso_code}|1"), p_btn("Back to Menu", "menu_main")]
                ]
                sent_msg = await e.edit(msg, buttons=btns)
                active_orders[phone] = {
                    'uid': uid,
                    'start_time': time.time(),
                    'paid': True,
                    'otp_sent': False,
                    'price': final_price,
                    'country': country,
                    'year': 2024,
                    'msg_id': sent_msg.id,
                    'phone_num': display_phone
                }
            finally:
                active_lzt_purchases.pop(uid, None)

        elif data.startswith("lzt_get_otp|"):
            phone = data.split("|")[1]
            if phone not in active_orders: return await safe_answer_cb(e, "Session Expired.", alert=True)
            order = active_orders[phone]
            item_id = phone.split("_")[1]
            country = order['country']
            iso_code = COUNTRY_CODES.get(country, ("US", "🇺🇸"))[0]

            await e.answer("Fetching OTP from Server 1...", alert=False)
            code, verified, res = await get_verified_lzt_otp(item_id, attempts=3, delay=1.5)

            display_phone = order.get('phone_num') or normalize_lzt_phone(None, item_id)

            if code:
                async with get_user_lock(uid):
                    cur.execute("UPDATE orders SET otp=? WHERE phone=? AND user_id=? AND server='Server 1'", (code, display_phone, uid))
                    db.commit()
                msg = (f"{P_YES} <b>Latest OTP Fetched!</b>\n\n"
                       f"{P_PHONE} <b>Phone:</b> <code>{display_phone}</code>\n"
                       f"🏳️ <b>Country:</b> {country}\n"
                       f"{P_TIME} <b>OTP:</b> <code>{code}</code>\n\n"
                       f"{P_SHIELD} <b>Server 1 double-check:</b> {'Verified' if verified else 'Best latest code'}\n\n"
                       f"<i>Use this code to login.</i>")
                btns = [
                    [p_btn("🔄 Get OTP Again", f"lzt_get_otp|{phone}")],
                    [p_btn("⬅ Back", f"lzt_chk|{iso_code}|1"), p_btn("Back to Menu", "menu_main")]
                ]
                try: await e.edit(msg, buttons=btns)
                except MessageNotModifiedError: pass
            else:
                await e.answer("⏳ OTP not available yet. Wait and retry.", alert=True)

        elif data.startswith("lzt_logout|"):
            phone = data.split("|")[1]
            if phone in active_orders:
                order = active_orders.pop(phone)
                item_id = phone.split("_")[1]
                reset_res = await lzt_request('POST', f"/{item_id}/telegram-reset-authorizations")
                reset_errors = reset_res.get('errors', []) if isinstance(reset_res, dict) else []
                if reset_errors:
                    err_txt = str(reset_errors[0])
                    if "24 hour" in err_txt.lower() or "24 hours" in err_txt.lower() or "too new authorization" in err_txt.lower():
                        return await e.edit("⚠️ <b>Logout scheduled later.</b>\nTelegram limits reset for ~24h after new authorization.\n\nYou can come back later and press logout again.", buttons=[[p_btn("Back to Menu", "menu_main")]])
            await e.edit(f"{P_YES} <b>Session Closed from Server 1 successfully.</b>", buttons=[[p_btn("Back to Menu", "menu_main")]])

        # --- SERVER 2 (LOCAL) ---
        elif data.startswith("srv_2_pg|"):
            total_bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
            good_count = cur.execute("SELECT COUNT(*) FROM stock WHERE available=1 AND COALESCE(quality_tier, 'good')='good'").fetchone()[0]
            cheap_count = cur.execute("SELECT COUNT(*) FROM stock WHERE available=1 AND quality_tier='cheap'").fetchone()[0]
            return await e.edit(
                f"{P_STORE} <b>Server 2 (Local Accounts & Sessions)</b>\n\n"
                f"Choose Quality Tier:\n\n"
                f"🟢 <b>Good Quality</b> ({good_count} accounts)\n"
                f"<i>High trust, aged accounts with maximum longevity.</i>\n\n"
                f"🟡 <b>Cheap Quality</b> ({cheap_count} accounts)\n"
                f"<i>Budget accounts suitable for mass usage.</i>\n\n"
                f"💳 <b>Your Balance:</b> {format_price(uid, total_bal)}",
                buttons=[
                    [p_btn(f"🟢 Good Quality ({good_count})", "s2_tier|good|1", style="success")],
                    [p_btn(f"🟡 Cheap Quality ({cheap_count})", "s2_tier|cheap|1", style="primary")],
                    [p_btn("Back to Servers", "menu_buy")],
                ],
            )

        elif data.startswith("s2_tier|"):
            parts = data.split("|")
            tier = parts[1]
            page = int(parts[2]) if len(parts) > 2 else 1
            tier_name = "Good Quality" if tier == "good" else "Cheap Quality"
            tier_icon = "🟢" if tier == "good" else "🟡"
            total_bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
            return await e.edit(
                f"{P_STORE} <b>Server 2 ({tier_icon} {tier_name})</b>\n\n"
                "Choose what you want to receive:\n\n"
                "👤 <b>Telegram Account</b> — receive the phone number, then use the bot to read the login OTP.\n"
                "📂 <b>Telegram Session</b> — receive the ready-to-use <code>.session</code> file.\n\n"
                f"💰 <b>Balance:</b> {format_price(uid, total_bal)}",
                buttons=[
                    [p_btn(f"👤 Buy {tier_name} Account", f"s2_countries|{tier}|account|1", style="success")],
                    [p_btn(f"📂 Buy {tier_name} Session (.session)", f"s2_countries|{tier}|session|1", style="primary")],
                    [p_btn("Back to Quality Selection", "srv_2_pg|1")],
                ],
            )

        elif data.startswith("s2_countries|"):
            parts = data.split("|")
            if len(parts) == 4:
                _, tier, purchase_type, page_text = parts
            else:
                _, purchase_type, page_text = parts
                tier = "good"
            if purchase_type not in ("account", "session"):
                return await e.answer("Invalid purchase option.", alert=True)
            page = max(1, int(page_text))
            limit, offset = 10, (page - 1) * 10
            total_row = cur.execute(
                "SELECT COUNT(DISTINCT country_name) FROM stock WHERE available=1 AND COALESCE(quality_tier, 'good')=?",
                (tier,)
            ).fetchone()
            total = total_row[0] if total_row else 0

            rows = cur.execute(
                "SELECT country_icon, country_name, COUNT(*) FROM stock WHERE available=1 AND COALESCE(quality_tier, 'good')=? GROUP BY country_name ORDER BY country_name ASC LIMIT ? OFFSET ?",
                (tier, limit, offset)
            ).fetchall()
            tier_label = "Good Quality" if tier == "good" else "Cheap Quality"
            tier_icon = "🟢" if tier == "good" else "🟡"
            if not rows and page == 1:
                return await e.edit(f"❌ <b>No stock currently in Server 2 ({tier_label}).</b>", buttons=[[p_btn("Back", "srv_2_pg|1")]])

            total_bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
            msg = (f"<b>Click country to view price and stock:</b>\n"
                   f"─────────────────────\n"
                   f"✅ Total balance: {format_price(uid, total_bal)}\n"
                   f"✅ Quality: {tier_icon} {tier_label}\n"
                   f"✅ Server: Server (2)\n"
                   f"✅ Page {page} of {max(1, ((total + limit - 1) // limit))}\n")

            label = "Telegram Account" if purchase_type == "account" else "Telegram Session (.session)"
            msg = f"{P_STORE} <b>Buy {label} ({tier_label})</b>\n\n" + msg
            year_callback = "s2_accyr" if purchase_type == "account" else "s2_yr"
            btns = [[p_btn(f"{i} {n} ({c})", f"{year_callback}|{tier}|{n[:20]}")] for (i, n, c) in rows]
            nav = []
            if page > 1: nav.append(p_btn("Prev", f"s2_countries|{tier}|{purchase_type}|{page-1}"))
            if offset + limit < total: nav.append(p_btn("Next", f"s2_countries|{tier}|{purchase_type}|{page+1}"))
            if nav: btns.append(nav)
            btns.append([p_btn("Back to Purchase Options", f"s2_tier|{tier}|1")])
            await e.edit(msg, buttons=btns)

        elif data == "s2_buy_session":
            rows = cur.execute(
                "SELECT country_icon, country_name, COUNT(*) FROM stock WHERE available=1 AND COALESCE(quality_tier, 'good')='good' GROUP BY country_name ORDER BY country_name ASC LIMIT 50"
            ).fetchall()
            if not rows:
                return await e.edit("❌ <b>Server 2 Empty.</b>", buttons=[[p_btn("Back", "menu_buy")]])
            msg = (f"{P_STORE} <b>Server 2 Buy Session</b>\n\n"
                   "Choose a country, then choose year and send how many accounts you need to buy.\n"
                   "After confirmation, the bot validates and sends the original authorized session file(s).")
            btns = [[p_btn(f"{i} {n} ({c})", f"s2_yr|good|{n[:20]}")] for (i, n, c) in rows]
            btns.append([p_btn("Back", "srv_2_pg|1")])
            await e.edit(msg, buttons=btns)

        elif data.startswith("s2_yr|"):
            parts = data.split("|")
            if len(parts) == 3:
                tier, country = parts[1], parts[2]
            else:
                tier, country = "good", parts[1]
            rows = cur.execute(
                "SELECT account_year, price, COUNT(*) FROM stock WHERE available=1 AND COALESCE(quality_tier, 'good')=? AND country_name LIKE ? GROUP BY account_year, price ORDER BY account_year DESC",
                (tier, f"{country}%")
            ).fetchall()
            if not rows: return await e.answer("❌ Out of stock.", alert=True)
            tier_icon = "🟢" if tier == "good" else "🟡"
            tier_label = "Good" if tier == "good" else "Cheap"
            msg = f"{P_CAL} <b>Select Year ({tier_icon} {tier_label})</b>\n🏳️ Country: <b>{country}</b>\n\n"
            btns = [[p_btn(f"{y} | {format_price(uid, p)} | {c}", f"s2_cf|{tier}|{country}|{y}|{p}")] for (y, p, c) in rows]
            btns.append([p_btn("Back", f"s2_countries|{tier}|session|1")])
            await e.edit(msg, buttons=btns)

        elif data.startswith("s2_accyr|"):
            parts = data.split("|")
            if len(parts) == 3:
                tier, country = parts[1], parts[2]
            else:
                tier, country = "good", parts[1]
            rows = cur.execute(
                "SELECT account_year, price, COUNT(*) FROM stock WHERE available=1 AND COALESCE(quality_tier, 'good')=? AND country_name LIKE ? GROUP BY account_year, price ORDER BY account_year DESC",
                (tier, f"{country}%")
            ).fetchall()
            if not rows:
                return await e.answer("❌ Out of stock.", alert=True)
            tier_icon = "🟢" if tier == "good" else "🟡"
            tier_label = "Good" if tier == "good" else "Cheap"
            msg = f"{P_CAL} <b>Select Account Year ({tier_icon} {tier_label})</b>\n🏳️ Country: <b>{country}</b>\n\nYou will receive the full OTP-assisted account purchase."
            btns = [[p_btn(f"{y} | {format_price(uid, p)} | {c} in stock", f"s2_cf_old|{tier}|{country}|{y}|{p}")] for y, p, c in rows]
            btns.append([p_btn("Back", f"s2_countries|{tier}|account|1")])
            await e.edit(msg, buttons=btns)

        elif data.startswith("s2_cf|"):
            parts = data.split("|")
            if len(parts) == 5:
                tier, country, year, base_price = parts[1], parts[2], parts[3], parts[4]
            else:
                tier, country, year, base_price = "good", parts[1], parts[2], parts[3]
            stock_count = cur.execute(
                "SELECT COUNT(*) FROM stock WHERE available=1 AND COALESCE(quality_tier, 'good')=? AND country_name LIKE ? AND account_year=? AND price=?",
                (tier, f"{country}%", int(year), int(base_price))
            ).fetchone()[0]
            session_buy_state[uid] = {"country": country, "year": int(year), "price": int(base_price), "tier": tier, "final_price": apply_server_discount(uid, 2, int(base_price)), "stock": stock_count}
            tier_label = "🟢 Good Quality" if tier == "good" else "🟡 Cheap Quality"
            return await e.edit(
                f"{P_CART} <b>How many sessions do you want?</b>\n\n"
                f"🏷️ <b>Quality:</b> {tier_label}\n"
                f"🏳️ <b>Country:</b> {country}\n"
                f"{P_CAL} <b>Year:</b> {year}\n"
                f"{P_CASH} <b>Each:</b> {format_price(uid, apply_server_discount(uid, 2, int(base_price)))}{discount_label(uid,2)}\n"
                f"📦 <b>Available:</b> {stock_count}\n\n"
                "Send quantity as a number.",
                buttons=[[p_btn("Cancel", "s2_qty_cancel")]]
            )

        elif data.startswith("s2_qty_confirm|"):
            parts = data.split("|")
            if len(parts) == 7:
                _, tier, country, year_str, base_price_str, final_price_str, qty_str = parts
            elif len(parts) == 6:
                _, country, year_str, base_price_str, final_price_str, qty_str = parts
                tier = "good"
            else:
                _, country, year_str, base_price_str, qty_str = parts
                tier = "good"
                final_price_str = str(apply_server_discount(uid, 2, int(base_price_str)))
            base_price, final_price, qty = int(base_price_str), int(final_price_str), int(qty_str)
            total_price = final_price * qty

            # 1. Atomic balance check & upfront deduction
            async with get_user_lock(uid):
                bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
                initial_count = cur.execute(
                    "SELECT COUNT(*) FROM stock WHERE country_name LIKE ? AND account_year=? AND price=? AND COALESCE(quality_tier, 'good')=? AND available=1",
                    (f"{country}%", int(year_str), base_price, tier)
                ).fetchone()[0]
                if initial_count < qty:
                    return await e.edit("❌ <b>Not enough stock available now.</b>", buttons=[[p_btn("Back", f"s2_yr|{tier}|{country}")]])
                if bal < total_price:
                    return await e.edit(f"❌ <b>Insufficient balance.</b>\nNeed {format_price(uid, total_price)}.", buttons=[[p_btn("Recharge", "menu_deposit"), p_btn("Cancel", "srv_2_pg|1")]])
                cur.execute("UPDATE users SET balance = balance - ? WHERE user_id=? AND balance >= ?", (total_price, uid, total_price))
                if cur.rowcount == 0:
                    return await e.edit("❌ <b>Balance changed. Try again.</b>", buttons=[[p_btn("Back", f"s2_yr|{tier}|{country}")]])
                db.commit()

            await e.edit(f"🔄 <b>Verifying {qty} Server 2 session(s)...</b>\n<i>Testing live account health and filtering dead accounts...</i>")

            valid_sessions = []
            dead_phones = []

            # 2. Collect up to 'qty' verified live sessions from stock
            while len(valid_sessions) < qty:
                async with get_user_lock(uid):
                    candidate = cur.execute(
                        "SELECT phone, session_file, country_icon, account_year, twofa, seller_id FROM stock WHERE country_name LIKE ? AND account_year=? AND price=? AND COALESCE(quality_tier, 'good')=? AND available=1 LIMIT 1",
                        (f"{country}%", int(year_str), base_price, tier)
                    ).fetchone()
                    if not candidate:
                        break
                    cand_phone, cand_sess, cand_icon, cand_year, cand_twofa, cand_seller = candidate
                    cur.execute("UPDATE stock SET available=0 WHERE phone=?", (cand_phone,))
                    db.commit()

                clean_sess = cand_sess[:-8] if cand_sess.endswith(".session") else cand_sess
                dyn_id, dyn_hash = get_api_credentials()
                test_client = None
                is_authorized = False
                try:
                    test_client = TelegramClient(clean_sess, dyn_id, dyn_hash)
                    await test_client.connect()
                    if await test_client.is_user_authorized():
                        is_authorized = True
                except Exception as ex:
                    logger.warning("Session verification failed for +%s: %s", cand_phone, ex)
                    is_authorized = False
                finally:
                    if test_client and test_client.is_connected():
                        try: await test_client.disconnect()
                        except Exception: pass

                if is_authorized:
                    valid_sessions.append({
                        'phone': str(cand_phone),
                        'sess': cand_sess,
                        'c_icon': cand_icon,
                        'year': cand_year,
                        'twofa': cand_twofa or "None",
                        'seller_id': cand_seller
                    })
                else:
                    dead_phones.append(str(cand_phone))
                    await remove_invalid_server2_session(cand_phone, cand_sess, "Dead/unauthorized session auto-filtered during bulk verification")

            delivered_count = len(valid_sessions)
            refund_count = qty - delivered_count
            refund_amount = refund_count * final_price

            # 3. Auto-refund any shortfall directly back to user's wallet
            if refund_amount > 0:
                async with get_user_lock(uid):
                    cur.execute("UPDATE users SET balance = balance + ? WHERE user_id=?", (refund_amount, uid))
                    db.commit()

            # 4. Handle 0 valid accounts case
            if delivered_count == 0:
                return await e.edit(
                    f"❌ <b>Stock Verification Failed</b>\n\n"
                    f"None of the requested sessions could be verified as active.\n"
                    f"💰 Full refund of <b>{format_price(uid, total_price)}</b> has been credited back to your balance.",
                    buttons=[[p_btn("Back to Menu", "menu_main")]]
                )

            # 5. Build .ZIP archive containing only valid accounts & accounts_info.txt
            os.makedirs("sessions", exist_ok=True)
            zip_filename = f"bulk_sessions_{uid}_{int(time.time())}.zip"
            zip_filepath = os.path.join("sessions", zip_filename)

            try:
                with zipfile.ZipFile(zip_filepath, 'w', compression=zipfile.ZIP_DEFLATED) as zipf:
                    summary_lines = [
                        "==================================================",
                        "          SERVER 2 BULK ACCOUNT DELIVERY          ",
                        "==================================================",
                        f"Country: {country}",
                        f"Year: {year_str}",
                        f"Delivered Accounts: {delivered_count}",
                        f"Delivery Date: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
                        "==================================================\n",
                    ]
                    for idx, acc in enumerate(valid_sessions, start=1):
                        sess_file = acc['sess']
                        clean_num = str(acc['phone']).lstrip('+')
                        if os.path.exists(sess_file):
                            zipf.write(sess_file, arcname=f"+{clean_num}.session")
                        summary_lines.append(f"{idx}. Phone: +{clean_num} | 2FA: {acc['twofa']} | Year: {acc['year']}")

                    summary_lines.append("\n==================================================")
                    summary_lines.append("Instructions: Use .session files in Telethon, Pyrogram, or automation software.")
                    zipf.writestr("accounts_info.txt", "\n".join(summary_lines))

                # 6. Record completed orders and pay sellers
                order_ids = []
                for acc in valid_sessions:
                    cur.execute(
                        "INSERT INTO orders (user_id, country, year, price, phone, otp, server) VALUES (?,?,?,?,?,?,?)",
                        (uid, country, acc['year'], final_price, acc['phone'], None, "Server 2")
                    )
                    order_ids.append(str(cur.lastrowid))
                    cur.execute("DELETE FROM stock WHERE phone=?", (acc['phone'],))

                    if acc['seller_id']:
                        seller_cut = int(final_price * 0.90)
                        update_balance(acc['seller_id'], seller_cut, "sales_balance")
                        try:
                            await bot.send_message(
                                acc['seller_id'],
                                f"{P_GIFT} <b>Account Sold!</b>\nYour uploaded number +{acc['phone']} was sold.\n{P_CASH}{seller_cut} added to Sales Balance."
                            )
                        except Exception:
                            pass
                db.commit()

                # 7. Deliver .ZIP file to the user
                new_bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
                actual_charged = delivered_count * final_price

                caption_lines = [
                    f"{P_YES} <b>Server 2 Bulk Sessions Delivered (.ZIP)</b>\n",
                    f"🏳️ <b>Country:</b> {country}",
                    f"📅 <b>Year:</b> {year_str}",
                    f"📦 <b>Delivered Accounts:</b> <b>{delivered_count}/{qty}</b>",
                    f"💳 <b>Amount Charged:</b> <b>{format_price(uid, actual_charged)}</b>",
                ]
                if refund_amount > 0:
                    caption_lines.append(f"↩️ <b>Auto-Refunded ({refund_count} dead/out-of-stock):</b> <b>{format_price(uid, refund_amount)}</b>")
                caption_lines.append(f"💰 <b>Current Balance:</b> {format_price(uid, new_bal)}\n")
                caption_lines.append("<i>📁 All verified session files & 2FA passwords are packaged inside the attached .ZIP archive.</i>")

                caption = "\n".join(caption_lines)
                await bot.send_file(uid, zip_filepath, caption=caption, parse_mode="html")

                await log_primary_purchase(
                    uid, country, final_price, actual_charged, int(year_str),
                    delivered_count, valid_sessions[0]['phone'] if valid_sessions else None,
                    "Server 2", ",".join(order_ids)
                )

                await e.edit(
                    f"{P_YES} <b>Bulk Purchase Complete!</b>\n"
                    f"Delivered: <b>{delivered_count}/{qty}</b> accounts (.zip attached above).\n"
                    f"Charged: <b>{format_price(uid, actual_charged)}</b>"
                    f"{f' (Refunded: ₹{refund_amount})' if refund_amount > 0 else ''}",
                    buttons=[[p_btn("Buy More", "menu_buy"), p_btn("Main Menu", "menu_main")]]
                )

            finally:
                if os.path.exists(zip_filepath):
                    try: os.remove(zip_filepath)
                    except Exception: pass
                for acc in valid_sessions:
                    delete_session_files(acc['sess'])

        elif data == "s2_qty_cancel":
            session_buy_state.pop(uid, None)
            await e.edit("❌ <b>Server 2 purchase cancelled.</b>", buttons=[[p_btn("Back", "srv_2_pg|1")]])

        elif data.startswith("s2_cf_old|"):
            parts = data.split("|")
            if len(parts) == 5:
                tier, country, year, base_price = parts[1], parts[2], parts[3], parts[4]
            else:
                tier, country, year, base_price = "good", parts[1], parts[2], parts[3]
            bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
            final_price = apply_server_discount(uid, 2, int(base_price))
            diff = final_price - bal
            tier_label = "Good Quality" if tier == "good" else "Cheap Quality"
            tier_icon = "🟢" if tier == "good" else "🟡"
            msg = (f"{P_STORE} <b>Confirm Purchase</b>\n\n"
                   f"🏷️ <b>Quality:</b> {tier_icon} {tier_label}\n"
                   f"{P_CASH} <b>Price:</b> {format_price(uid, final_price)}\n"
                   f"💳 <b>Balance:</b> {format_price(uid, bal)}\n\n"
                   f"🏳️ <b>Country:</b> {country}\n"
                   f"🌍 <b>Region:</b> Server 2 (Local)")
            btns = [[p_btn("Need Recharge", "menu_deposit")] if diff > 0 else [p_btn("✅ Purchase", f"s2_buy|{tier}|{country}|{year}|{base_price}")]]
            btns.append([p_btn("Back", f"s2_accyr|{tier}|{country}")])
            await e.edit(msg, buttons=btns)

        elif data.startswith("s2_buy|"):
            parts = data.split("|")
            if len(parts) >= 6:
                tier, country, year_str, price_str, specific_phone = parts[1], parts[2], parts[3], parts[4], parts[5]
            elif len(parts) == 5:
                tier, country, year_str, price_str = parts[1], parts[2], parts[3], parts[4]
                specific_phone = None
            else:
                tier = "good"
                country, year_str, price_str = parts[1], parts[2], parts[3]
                specific_phone = parts[4] if len(parts) > 4 else None
            base_price = int(price_str)
            final_price = apply_server_discount(uid, 2, base_price)

            async with get_user_lock(uid):
                if specific_phone:
                    row = cur.execute("SELECT phone, session_file, country_icon, account_year, twofa, seller_id FROM stock WHERE phone=? AND available=1", (specific_phone,)).fetchone()
                else:
                    row = cur.execute("SELECT phone, session_file, country_icon, account_year, twofa, seller_id FROM stock WHERE country_name LIKE ? AND account_year=? AND price=? AND COALESCE(quality_tier, 'good')=? AND available=1 LIMIT 1", (f"{country}%", int(year_str), base_price, tier)).fetchone()

                if not row: return await e.answer("❌ Sold out!", alert=True)
                phone, sess, c_icon, actual_year, twofa_pass, seller_id = row

                cur.execute("UPDATE users SET balance = balance - ? WHERE user_id=? AND balance >= ?", (final_price, uid, final_price))
                if cur.rowcount == 0: return await e.answer("❌ Insufficient Balance!", alert=True)
                cur.execute("UPDATE stock SET available=0 WHERE phone=?", (phone,))
                db.commit()

            await e.edit(f"🔄 <b>Fetching Number (+{phone})...</b>")
            clean_sess = sess if not sess.endswith(".session") else sess[:-8]

            dyn_id, dyn_hash = get_api_credentials()
            client = TelegramClient(clean_sess, dyn_id, dyn_hash)
            try:
                await client.connect()
                if not await client.is_user_authorized(): raise Exception("Session dead")
            except Exception:
                async with get_user_lock(uid):
                    update_balance(uid, final_price)
                    db.commit()
                await client.disconnect()
                await remove_invalid_server2_session(phone, sess, "authorization check failed during single purchase")
                return await e.edit("❌ <b>Account Invalid.</b> Money refunded.", buttons=[[p_btn("Back", "srv_2_pg|1")]])

            await log_primary_purchase(uid, country, final_price, final_price, actual_year, 1, phone, "Server 2",phone)

            display_phone = f"+{phone.lstrip('+')}"
            msg = (f"{P_YES} <b>Account Purchased (Server 2)!</b>\n\n{P_PHONE} <b>Phone:</b> <code>{display_phone}</code>\n🏳️ <b>Country:</b> {c_icon} {country}\n\n"
                   f"🔻 <b>INSTRUCTIONS:</b>\n1. Add Account in Telegram\n2. Enter number\n3. {P_TIME} Listening for OTP automatically...\n\n"
                   f"<i>Note: Auto-cancels in 10 mins if no OTP arrives.</i>")

            sent_msg = await e.edit(msg)
            active_orders[phone] = {'uid': uid, 'client': client, 'sess': sess, 'start_time': time.time(), 'paid': False, 'price': final_price, 'country': country, 'year': actual_year, 'c_icon': c_icon, 'twofa': twofa_pass, 'seller_id': seller_id, 'msg_id': sent_msg.id}
            asyncio.create_task(auto_otp_task(phone))

        elif data.startswith("s2_get_otp|") or data.startswith("get_otp_again|"):
            phone = data.split("|")[1]
            if phone not in active_orders:
                return await safe_answer_cb(e, "⚠️ Session already logged out or expired.", alert=True)

            order = active_orders[phone]
            client = order['client']
            start_time = order['start_time']

            await e.answer("🔄 Fetching latest OTP...", alert=False)
            try:
                latest_code = await get_latest_telegram_login_otp(client, start_time)

                if latest_code:
                    twofa_text = f"{P_SHIELD} <b>2FA:</b> <code>{order['twofa']}</code>" if order['twofa'] != "None" else f"🔓 <b>2FA:</b> <code>Disabled</code>"
                    display_phone = f"+{phone.lstrip('+')}"
                    msg = (f"{P_YES} <b>Latest OTP Fetched!</b>\n\n"
                           f"{P_PHONE} <b>Phone:</b> <code>{display_phone}</code>\n"
                           f"🏳️ <b>Country:</b> {order['c_icon']} {order['country']}\n"
                           f"{P_TIME} <b>OTP:</b> <code>{latest_code}</code>\n"
                           f"{twofa_text}")
                    btns = [
                        [p_btn("🔄 Get OTP Again", f"get_otp_again|{phone}")],
                        [p_btn("🚪 Finish & Logout", f"logout_bot|{phone}")],
                        [p_btn("Buy Another", f"s2_yr|{order['country']}")]
                    ]
                    try: await e.edit(msg, buttons=btns)
                    except MessageNotModifiedError: pass
                else:
                    await e.answer("⏳ No new OTP found yet. Try again in a few seconds.", alert=True)
            except Exception as ex:
                await e.answer("❌ Error fetching OTP.", alert=True)

        elif data.startswith("logout_bot|"):
            phone = data.split("|")[1]
            if phone in active_orders:
                order = active_orders.pop(phone)
                try: await order['client'].log_out()
                except: pass
                try: await order['client'].disconnect()
                except: pass
                delete_session_files(order['sess'])
                await e.edit(f"{P_YES} <b>Session Finished & Logged out successfully.</b>", buttons=[[p_btn("Back to Menu", "menu_main")]])
            else:
                await e.answer("⚠️ No active order found or already logged out.", alert=True)

        # --- MENU EXTRAS ---
        elif data == "menu_account":
            r = cur.execute("SELECT balance, sales_balance, total_deposited, joined_date, COALESCE(promo_balance, 0) FROM users WHERE user_id=?", (uid,)).fetchone()
            bal, s_bal, dep, date, promo_bal = r
            transferable = max(0, bal - promo_bal)
            me = await bot.get_me()
            o = cur.execute("SELECT COUNT(*), SUM(price) FROM orders WHERE user_id=?", (uid,)).fetchone()
            msg = (f"{P_ACC} <b>USER PROFILE</b>\n\n"
                   f"{P_ID} ID: <code>{uid}</code>\n"
                   f"{P_CASH} Total Balance: {format_price(uid, bal)}\n"
                   f"💸 Transferable: <b>{format_price(uid, transferable)}</b>\n"
                   f"🔒 Promo Balance (Locked): <b>{format_price(uid, promo_bal)}</b>\n"
                   f"🤝 Sales Balance: {format_price(uid, s_bal)}\n"
                   f"💳 Deposited: {format_price(uid, dep)}\n"
                   f"🛒 Total Spent: {format_price(uid, o[1] or 0)} ({o[0]} Accs)\n"
                   f"{P_CAL} Joined: {date[:10]}\n\n"
                   f"👥 Referral Link:\n<code>https://t.me/{me.username}?start=ref_{uid}</code>")

            c_pref = get_currency_pref(uid)
            c_btn = "💱 Switch to USDT" if c_pref == "INR" else "💱 Switch to INR"

            btns = [
                [p_btn("💸 Transfer Balance", "menu_transfer"), p_btn("💼 Reseller Link", "menu_reseller")],
                [p_btn("Manage Uploads", "menu_uploads"), p_btn("Claim Promo Code", "claim_promo")],
                [p_btn(c_btn, "tgl_curr"), p_btn("Back", "menu_main")]
            ]
            if s_bal > 0:
                btns.insert(2, [p_btn(f"🔄 Convert Sales ({format_price(uid, s_bal)}) to Balance", "wd_to_main")])
            await e.edit(msg, buttons=btns)

        elif data == "menu_reseller":
            me = await bot.get_me()
            r_link = cur.execute("SELECT token, margin_percent FROM reseller_links WHERE user_id=? ORDER BY created_at DESC LIMIT 1", (uid,)).fetchone()
            min_m_row = cur.execute("SELECT value FROM settings WHERE key='reseller_min_margin'").fetchone()
            max_m_row = cur.execute("SELECT value FROM settings WHERE key='reseller_max_margin'").fetchone()
            min_m = int(min_m_row[0]) if min_m_row else 5
            max_m = int(max_m_row[0]) if max_m_row else 50
            earnings_row = cur.execute("SELECT COUNT(*), COALESCE(SUM(commission), 0) FROM reseller_earnings WHERE reseller_id=?", (uid,)).fetchone()
            total_orders, total_earned = earnings_row[0] or 0, earnings_row[1] or 0
            cust_count = cur.execute("SELECT COUNT(*) FROM users WHERE referred_by=? AND reseller_token IS NOT NULL", (uid,)).fetchone()[0]

            if r_link:
                token, margin = r_link
                link_url = f"https://t.me/{me.username}?start=resell_{token}"
                msg = (
                    f"💼 <b>Your Reseller Dashboard</b>\n\n"
                    f"🔗 <b>Your Reseller Link:</b>\n<code>{link_url}</code>\n\n"
                    f"📈 <b>Current Margin:</b> <b>+{margin}%</b>\n"
                    f"👥 <b>Customers Linked:</b> <b>{cust_count}</b>\n"
                    f"🛒 <b>Customer Orders:</b> <b>{total_orders}</b>\n"
                    f"💰 <b>Total Margin Earned:</b> <b>{format_price(uid, total_earned)}</b>\n\n"
                    f"<i>Every time a user joins via your link and purchases, your +{margin}% margin is instantly credited to your Sales Balance!</i>\n\n"
                    f"⚙️ <i>Allowed margin range: {min_m}% to {max_m}%.</i>"
                )
                btns = [
                    [p_btn("✏️ Change Margin %", "reseller_set_margin")],
                    [p_btn("Back to Profile", "menu_account")]
                ]
            else:
                msg = (
                    f"💼 <b>Create Your Reseller Link</b>\n\n"
                    f"Earn automated profits on every purchase made by your customers!\n\n"
                    f"• Set your custom profit margin ({min_m}% to {max_m}%).\n"
                    f"• Share your unique reseller link.\n"
                    f"• Every purchase made by your customers instantly credits your profit margin to your balance!\n\n"
                    f"👉 Tap the button below to set your margin:"
                )
                btns = [
                    [p_btn("➕ Create Reseller Link", "reseller_set_margin")],
                    [p_btn("Back to Profile", "menu_account")]
                ]
            await e.edit(msg, buttons=btns)

        elif data == "reseller_set_margin":
            min_m_row = cur.execute("SELECT value FROM settings WHERE key='reseller_min_margin'").fetchone()
            max_m_row = cur.execute("SELECT value FROM settings WHERE key='reseller_max_margin'").fetchone()
            min_m = int(min_m_row[0]) if min_m_row else 5
            max_m = int(max_m_row[0]) if max_m_row else 50
            reseller_state[uid] = "wait_margin"
            msg = (
                f"📈 <b>Set Reseller Margin Percentage</b>\n\n"
                f"Please reply with your desired profit margin percentage (between <b>{min_m}%</b> and <b>{max_m}%</b>).\n\n"
                f"<i>Example: reply <code>15</code> for 15% profit on all purchases.</i>"
            )
            await e.edit(msg, buttons=[[p_btn("Cancel", "menu_reseller")]])

        elif data == "menu_transfer":
            row = cur.execute("SELECT balance, COALESCE(promo_balance, 0) FROM users WHERE user_id=?", (uid,)).fetchone()
            bal = row[0] if row else 0
            promo_bal = row[1] if row else 0
            transferable = max(0, bal - promo_bal)
            if transferable <= 0:
                return await safe_answer_cb(e, "❌ You have no transferable balance. (Promo code balance cannot be transferred).", alert=True)
            transfer_state[uid] = {"step": "wait_target"}
            msg = (f"💸 <b>Transfer Balance to Another User</b>\n\n"
                   f"💰 Total Balance: <b>{format_price(uid, bal)}</b>\n"
                   f"🔒 Promo Balance (Locked): <b>{format_price(uid, promo_bal)}</b>\n"
                   f"✅ Transferable Balance: <b>{format_price(uid, transferable)}</b>\n\n"
                   f"👉 <b>Please send the recipient's numerical Telegram User ID or @username:</b>")
            await e.edit(msg, buttons=[[p_btn("Cancel", "menu_account")]])

        elif data.startswith("xfer_do|"):
            parts = data.split("|")
            target_uid = int(parts[1])
            amount = int(parts[2])
            st = transfer_state.pop(uid, None)

            if target_uid == uid:
                return await safe_answer_cb(e, "❌ Cannot transfer balance to yourself.", alert=True)
            if amount <= 0:
                return await safe_answer_cb(e, "❌ Invalid transfer amount.", alert=True)

            first_uid, second_uid = (uid, target_uid) if uid < target_uid else (target_uid, uid)
            async with get_user_lock(first_uid):
                async with get_user_lock(second_uid):
                    row = cur.execute("SELECT balance, COALESCE(promo_balance, 0) FROM users WHERE user_id=?", (uid,)).fetchone()
                    if not row:
                        return await e.edit("❌ User record not found.", buttons=[[p_btn("Back", "menu_account")]])
                    bal, promo_bal = row[0], row[1]
                    transferable = max(0, bal - promo_bal)
                    if amount > transferable:
                        return await e.edit(
                            f"❌ <b>Transfer Failed</b>\n\n"
                            f"Insufficient transferable balance (Available: ₹{transferable}).\n"
                            f"<i>Promo balance ({format_price(uid, promo_bal)}) cannot be transferred.</i>",
                            buttons=[[p_btn("Back to Profile", "menu_account")]]
                        )

                    cur.execute(
                        "UPDATE users SET balance = balance - ? WHERE user_id = ? AND (balance - COALESCE(promo_balance, 0)) >= ?",
                        (amount, uid, amount)
                    )
                    if cur.rowcount == 0:
                        return await e.edit("❌ Transfer failed. Balance changed. Try again.", buttons=[[p_btn("Back", "menu_account")]])

                    cur.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (target_uid,))
                    cur.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (amount, target_uid))
                    cur.execute(
                        "INSERT INTO balance_transfers (sender_id, recipient_id, amount) VALUES (?,?,?)",
                        (uid, target_uid, amount)
                    )
                    db.commit()

            new_bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
            await e.edit(
                f"✅ <b>Transfer Successful!</b>\n\n"
                f"💸 Transferred: <b>₹{amount}</b>\n"
                f"👤 Recipient: <code>{target_uid}</code>\n"
                f"💰 Your Remaining Balance: <b>{format_price(uid, new_bal)}</b>",
                buttons=[[p_btn("Back to Profile", "menu_account"), p_btn("Main Menu", "menu_main")]]
            )

            try:
                rec_bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (target_uid,)).fetchone()[0]
                sender_label = await get_user_log_label(uid)
                await bot.send_message(
                    target_uid,
                    f"🎁 <b>Balance Received!</b>\n\n"
                    f"You have received <b>₹{amount}</b> from {sender_label}.\n"
                    f"💳 Your New Balance: <b>{format_price(target_uid, rec_bal)}</b>",
                    buttons=[[p_btn("View Account", "menu_account"), p_btn("Shop Now", "menu_buy")]]
                )
            except Exception as ex:
                logger.info("Could not notify transfer recipient %s: %s", target_uid, ex)

        elif data == "claim_promo":
            promo_state[uid] = "wait_code"
            await e.edit(f"{P_GIFT} <b>Claim Promo Code</b>\n\nPlease enter or reply with your promo code below:", buttons=[[p_btn("Cancel", "menu_account")]])

        elif data == "tgl_curr":
            c_pref = get_currency_pref(uid)
            ns = "USDT" if c_pref == "INR" else "INR"
            cur.execute("UPDATE users SET pref_curr=? WHERE user_id=?", (ns, uid))
            db.commit()
            await e.answer(f"Currency updated to {ns}", alert=False)
            class FakeEv:
                sender_id = uid; data = b"menu_account"
                async def edit(self, text, buttons): await e.edit(text, buttons=buttons)
                async def answer(self, t, alert): pass
            await handle_callbacks(FakeEv())

        elif data == "menu_deposit":
            manual_dep_state.pop(uid, None)
            deposit_input.pop(uid, None)
            fampay_deposit_state.discard(uid)
            current_msg_id = callback_message_id(e)
            deleted_msg_ids = await cleanup_deposit_media(uid)
            msg = f"💳 <b>Select Payment Method:</b>\n\n🟢 Choose Automatic for instant credit.\n⏳ Choose Manual for other methods."
            btns = build_deposit_menu_buttons()
            if current_msg_id and current_msg_id in deleted_msg_ids:
                await bot.send_message(uid, msg, buttons=btns)
            else:
                try:
                    await e.edit(msg, buttons=btns)
                except Exception:
                    await bot.send_message(uid, msg, buttons=btns)

        elif data == "fampay_start":
            if not is_method_on("fampay_status"):
                return await e.answer("Automatic deposits are currently disabled.", alert=True)
            gateways=cur.execute("SELECT id,name,min_deposit,max_deposit FROM fampay_gateways WHERE enabled=1 ORDER BY id").fetchall()
            if gateways:
                buttons=[[p_btn(f"Gateway {i+1}: {row[1]}",f"fampay_gateway|{row[0]}",style="success")] for i,row in enumerate(gateways)] + [[p_btn("Cancel","menu_deposit",style="danger")]]
                await e.edit("⚡ <b>Automatic UPI Deposit</b>\n\nChoose a payment gateway:",buttons=buttons)
            else:
                minimum=int(fampay_setting("fampay_min_dep","50"));maximum=int(fampay_setting("fampay_max_dep","50000"))
                fampay_gateway_selection.pop(uid,None);fampay_deposit_state.add(uid)
                await e.edit(f"⚡ <b>FamPay Automatic Deposit</b>\n\nSend an amount from ₹{minimum} to ₹{maximum}.",buttons=[[p_btn("Cancel","menu_deposit",style="danger")]])

        elif data.startswith("fampay_gateway|"):
            gateway_id=int(data.split("|",1)[1]); row=cur.execute("SELECT name,min_deposit,max_deposit FROM fampay_gateways WHERE id=? AND enabled=1",(gateway_id,)).fetchone()
            if not row:return await e.answer("This gateway is unavailable.",alert=True)
            fampay_gateway_selection[uid]=gateway_id;fampay_deposit_state.add(uid)
            await e.edit(f"⚡ <b>{html.escape(row[0])}</b>\n\nSend an amount from ₹{row[1]} to ₹{row[2]}.",buttons=[[p_btn("Cancel","menu_deposit",style="danger")]])

        elif data.startswith("fampay_check|"):
            reference=data.split("|",1)[1]
            await e.answer("Checking payment…",alert=False)
            try:
                status,result=await check_fampay_order(reference,uid,user_initiated=True)
                if status=="credited" and result:
                    fampay_check_locks.pop(reference,None);fampay_error_cooldowns.pop(reference,None)
                    try:await e.delete()
                    except Exception:pass
                    await bot.send_message(uid,f"✅ <b>Payment Successful!</b>\n\nAmount: ₹{result['amount']}\nReference: <code>{reference}</code>\nYour balance was updated exactly once.",buttons=[[p_btn("Back","menu_main",style="primary")]])
                    await log_primary_deposit(uid,result["amount"],"FamPay Automatic")
                elif status=="credited":
                    await e.answer("This payment was already credited.",alert=True)
                elif status=="expired":
                    row=cur.execute("SELECT check_count,review_status FROM fampay_orders WHERE reference=? AND user_id=?",(reference,uid)).fetchone()
                    buttons=[[p_btn("I Paid — Submit Review",f"fampay_review|{reference}",style="primary")]] if row and row[0]>0 and not row[1] else []
                    buttons.append([p_btn("Generate New Deposit","fampay_start",style="success")])
                    await e.edit(f"⌛ <b>Deposit expired</b>\n\nReference: <code>{reference}</code>\nNo payment was found and no balance was credited.\n\nIf you paid this request, submit proof for administrator review.",buttons=buttons)
                else:
                    await e.answer("Payment not found yet. Pay the exact amount, then press Check again before expiry.",alert=True)
            except FamPayError as exc:
                await send_admin_error("FamPay payment check failed",f"Reference: {reference}\nUser: {uid}\n{exc}")
                await e.answer("Payment verification is temporarily unavailable. Admin was notified.",alert=True)

        elif data.startswith("fampay_regen|"):
            reference=data.split("|",1)[1]
            row=cur.execute("SELECT amount,status FROM fampay_orders WHERE reference=? AND user_id=?",(reference,uid)).fetchone()
            if not row:return await e.answer("Deposit request not found.",alert=True)
            if row[1]=="success":return await e.answer("This payment was already credited.",alert=True)
            try:
                await e.delete()
                await create_fampay_checkout(uid,row[0],reference)
            except Exception as exc:
                await send_admin_error("FamPay QR regeneration failed",str(exc));await bot.send_message(uid,"Automatic deposit QR could not be generated. Admin was notified.")

        elif data.startswith("fampay_cancel|"):
            reference=data.split("|",1)[1]
            changed=cur.execute("UPDATE fampay_orders SET status='cancelled',updated_at=? WHERE reference=? AND user_id=? AND status='pending'",(datetime.now(timezone.utc).isoformat(),reference,uid)).rowcount;db.commit()
            if not changed:return await e.answer("This deposit is already closed.",alert=True)
            fampay_check_locks.pop(reference,None);fampay_error_cooldowns.pop(reference,None)
            try:await e.delete()
            except Exception:pass
            await bot.send_message(uid,"❌ Deposit cancelled. The QR was deleted and no balance was credited.",buttons=[[p_btn("New Deposit","menu_deposit",style="primary")]])

        elif data.startswith("fampay_review|"):
            reference=data.split("|",1)[1]
            row=cur.execute("SELECT status,check_count,review_status FROM fampay_orders WHERE reference=? AND user_id=?",(reference,uid)).fetchone()
            if not row:return await e.answer("Deposit request not found.",alert=True)
            if row[0]=="success":return await e.answer("This payment was already credited.",alert=True)
            if row[0]!="expired" or row[1]<1:return await e.answer("Review is available only for an expired request that you checked before expiry.",alert=True)
            if row[2] in ("pending","approved","rejected"):return await e.answer(f"Review status: {row[2]}.",alert=True)
            fampay_review_state[uid]={"reference":reference,"step":"screenshot"}
            await e.edit(f"🧾 <b>Payment Review</b>\n\nReference: <code>{reference}</code>\n\nSend the payment-success screenshot now.",buttons=[[p_btn("Cancel Review",f"fampay_review_cancel|{reference}",style="danger")]])

        elif data.startswith("fampay_review_cancel|"):
            reference=data.split("|",1)[1];fampay_review_state.pop(uid,None)
            cur.execute("UPDATE fampay_orders SET review_status=NULL,review_screenshot_msg_id=NULL,review_utr=NULL WHERE reference=? AND user_id=? AND review_status='draft'",(reference,uid));db.commit()
            await e.edit("Review submission cancelled.",buttons=[[p_btn("Back","menu_deposit")]])

        elif data.startswith("fampay_review_submit|"):
            reference=data.split("|",1)[1]
            row=cur.execute("""SELECT amount,status,check_count,review_status,review_screenshot_msg_id,review_utr
              FROM fampay_orders WHERE reference=? AND user_id=?""",(reference,uid)).fetchone()
            if not row or row[1]!="expired" or row[2]<1 or row[3]!="draft" or not row[4] or not row[5]:
                return await e.answer("Review information is incomplete or already submitted.",alert=True)
            cur.execute("UPDATE fampay_orders SET review_status='pending',updated_at=? WHERE reference=? AND user_id=? AND review_status='draft'",(datetime.now(timezone.utc).isoformat(),reference,uid));db.commit();fampay_review_state.pop(uid,None)
            try:
                for aid in ADMIN_IDS:
                    try:
                        await bot.forward_messages(aid, row[4], uid)
                        await bot.send_message(aid, f"🧾 <b>FamPay Deposit Review</b>\n\nUser: <code>{uid}</code>\nReference: <code>{reference}</code>\nExpected amount: <b>₹{row[0]}</b>\nUTR / TXN: <code>{html.escape(row[5])}</code>\n\nApprove only after confirming the screenshot and transaction.", buttons=[[p_btn("✅ Approve",f"fampay_review_action|approve|{reference}",style="success"),p_btn("❌ Reject",f"fampay_review_action|reject|{reference}",style="danger")]])
                    except Exception: pass
            except Exception as exc:
                cur.execute("UPDATE fampay_orders SET review_status='draft' WHERE reference=? AND review_status='pending'",(reference,));db.commit();await send_admin_error("FamPay review delivery failed",str(exc));return await e.answer("Could not submit review. Admin was notified; please try again.",alert=True)
            await e.edit("✅ <b>Review submitted</b>\n\nAn administrator will verify your screenshot and transaction ID. Balance is credited only after approval.",buttons=[[p_btn("Back","menu_main")]])

        elif data.startswith("fampay_review_action|") and is_admin(uid):
            _,decision,reference=data.split("|",2)
            try:
                result=approve_fampay_review(reference,uid) if decision=="approve" else reject_fampay_review(reference,uid)
            except FamPayError as exc:
                await send_admin_error("FamPay review action failed",str(exc));return await e.answer(str(exc),alert=True)
            if not result:return await e.answer("Review was already processed or is unavailable.",alert=True)
            if decision=="approve":
                await e.edit(f"✅ Review approved. ₹{result['amount']} credited exactly once to <code>{result['user_id']}</code>.")
                try:await bot.send_message(result["user_id"],f"✅ <b>Payment review approved</b>\n\nReference: <code>{reference}</code>\nAmount credited: ₹{result['amount']}")
                except Exception:pass
                await log_primary_deposit(result["user_id"],result["amount"],"FamPay Manual Review")
            else:
                await e.edit("❌ Review rejected. No balance was credited.")
                try:await bot.send_message(result["user_id"],f"❌ Payment review for <code>{reference}</code> was rejected. No balance was credited.")
                except Exception:pass

        elif data == "wd_sales":
            s_bal = cur.execute("SELECT sales_balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
            if s_bal <= 0: return await e.answer("❌ Sales Balance is 0.", alert=True)
            btns = [
                [p_btn(f"🔄 Move {format_price(uid, s_bal)} to Main Balance", "wd_to_main")],
                [p_btn("Back", "menu_account")]
            ]
            await e.edit(
                f"🤝 <b>Referral Earnings</b>\n\n"
                f"Available: <b>{format_price(uid, s_bal)}</b>\n\n"
                f"External withdrawals are disabled. You can move your referral earnings to your Main Balance to buy accounts or transfer to other users:",
                buttons=btns
            )

        elif data == "wd_to_main":
            async with get_user_lock(uid):
                s_bal = cur.execute("SELECT sales_balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
                if s_bal <= 0: return await e.answer("❌ Sales balance is empty.", alert=True)
                cur.execute("UPDATE users SET sales_balance = 0, balance = balance + ? WHERE user_id=?", (s_bal, uid))
                db.commit()
            await e.edit(f"{P_YES} <b>Successfully transferred {format_price(uid, s_bal)} to Main Balance!</b>", buttons=[[p_btn("Back to Profile", "menu_account")]])

        elif data in ("wd_to_upi", "wd_to_usdt") or data.startswith("wd_usdt_net|"):
            return await e.answer("❌ External withdrawals are disabled. Move earnings to Main Balance to transfer to other users.", alert=True)

        elif data == "menu_sell":
            rows = cur.execute("SELECT country_code, year, price_good, price_spam FROM sell_prices").fetchall()
            if not rows: return await e.answer("Selling is disabled by Admin.", alert=True)
            msg = f"🤝 <b>Sell Your Accounts to Us!</b>\n\n<b>Allowed Countries:</b>\n"
            for r in rows: msg += f"• +{r[0]} ({r[1]}) | Good: ₹{r[2]} | Spam: ₹{r[3]}\n"
            msg += f"\n<i>Note: We charge a 10% admin fee on all sales.</i>\n\n👇 <b>Reply to this message with the phone number you want to sell (e.g., +919999999999):</b>"
            sell_state[uid] = {'step': 'wait_num'}
            await e.edit(msg, buttons=[[p_btn("Cancel", "menu_main")]])

        elif data == "menu_uploads":
            rows = cur.execute("SELECT phone, country_icon, country_name, price FROM stock WHERE seller_id=? AND available=1", (uid,)).fetchall()
            if not rows: return await e.edit("⚠️ You have no active uploads in the market.", buttons=[[p_btn("Back", "menu_account")]])
            msg = f"🤝 <b>Your Active Uploads</b>\nSelect an account to manage:"
            btns = []
            for r in rows: btns.append([p_btn(f"{r[1]} {r[2]} (+{r[0]}) - ₹{r[3]}", f"up_manage|{r[0]}")])
            btns.append([p_btn("Back", "menu_account")])
            await e.edit(msg, buttons=btns)

        elif data.startswith("up_manage|"):
            phone = data.split("|")[1]
            msg = f"📱 <b>Manage Account:</b> <code>+{phone}</code>\nWhat would you like to do?\n\n<i>You can only retrieve OTPs after removing the account from the marketplace.</i>"
            btns = [
                [p_btn("Remove Account & Get Login", f"up_rm|{phone}")],
                [p_btn("Back", "menu_uploads")]
            ]
            await e.edit(msg, buttons=btns)

        elif data.startswith("up_rm|"):
            phone = data.split("|")[1]
            cur.execute("DELETE FROM stock WHERE phone=?", (phone,))
            cur.execute("INSERT OR REPLACE INTO blacklisted_phones (phone) VALUES (?)", (phone,))
            db.commit()
            await e.edit("✅ Account removed from market successfully.\n<i>Note: You cannot re-upload this specific number for 90 days.</i>\n\nClick below to securely access the account and OTP.", buttons=[[p_btn("Get Login / OTP", f"sell_get|{phone}")], [p_btn("Back", "menu_uploads")]])

        elif data.startswith("sell_get|"):
            phone = data.split("|")[1]
            sp = f"sessions/{phone}"

            dyn_id, dyn_hash = get_api_credentials()
            client = TelegramClient(sp, dyn_id, dyn_hash)
            await e.answer("🔄 Fetching latest OTP...", alert=False)
            try:
                await client.connect()
                msgs = await client.get_messages(777000, limit=3)
                code = next((re.search(OTP_REGEX, m.message).group() for m in msgs if m.message and re.search(OTP_REGEX, m.message)), "Not Found")
                await client.disconnect()

                msg = (f"{P_YES} <b>Account Retrieval Info</b>\n\n"
                       f"{P_PHONE} <b>Phone:</b> <code>{phone}</code>\n"
                       f"{P_TIME} <b>OTP:</b> <code>{code}</code>\n"
                       f"<i>Use this code to login and secure your account.</i>")
                btns = [[p_btn("🔄 Refresh OTP", f"sell_get|{phone}")], [p_btn("🚪 Delete Session", f"sell_rm_final|{phone}")]]
                try: await e.edit(msg, buttons=btns)
                except MessageNotModifiedError: pass
            except Exception as ex: await e.answer(f"Error: {ex}", alert=True)

        elif data.startswith("sell_rm_final|"):
            phone = data.split("|")[1]
            try:
                sp = f"sessions/{phone}"
                dyn_id, dyn_hash = get_api_credentials()
                client = TelegramClient(sp, dyn_id, dyn_hash)
                await client.connect()
                await client.log_out()
                await client.disconnect()
            except: pass
            delete_session_files(f"sessions/{phone}")
            await e.edit(f"{P_YES} <b>Session Deleted & Bot Logged Out successfully.</b>", buttons=[[p_btn("Back to Menu", "menu_main")]])

        elif data == "menu_history":
            page = 1
            limit, offset = 5, 0
            t_row = cur.execute("SELECT COUNT(*) FROM orders WHERE user_id=?", (uid,)).fetchone()
            today_row = cur.execute("SELECT COUNT(*) FROM orders WHERE user_id=? AND date(date)=date('now')", (uid,)).fetchone()
            total = t_row[0] if t_row else 0
            today_total = today_row[0] if today_row else 0
            rows = cur.execute("SELECT phone, date, country, price, server FROM orders WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?", (uid, limit, offset)).fetchall()
            msg = f"{P_DOC} <b>Purchase History (Page {page})</b>\n🗓 <b>Today:</b> {today_total} purchase(s)\n\n"
            if not rows: msg += "No purchases found."
            else:
                for ph, d, country, price, server in rows:
                    if str(ph).startswith("LZT_"):
                        display_ph = "Server 1 number"
                    else:
                        display_ph = f"+{str(ph).lstrip('+')}" if str(ph).lstrip('+').isdigit() else ph
                    msg += f"📱 {display_ph}\n🏳️ {country or 'Unknown'} | {server or 'Server'} | {format_price(uid, price or 0)}\n📅 {format_purchase_datetime(d)}\n────────────────\n"
            nav = [p_btn("Back", "menu_main")]
            if offset + limit < total: nav.append(p_btn("Next", "page_purchases_2"))
            await e.edit(msg, buttons=[nav])

        elif data.startswith("page_purchases_"):
            page = int(data.split("_")[2])
            limit, offset = 5, (page - 1) * 5
            t_row = cur.execute("SELECT COUNT(*) FROM orders WHERE user_id=?", (uid,)).fetchone()
            today_row = cur.execute("SELECT COUNT(*) FROM orders WHERE user_id=? AND date(date)=date('now')", (uid,)).fetchone()
            total = t_row[0] if t_row else 0
            today_total = today_row[0] if today_row else 0
            rows = cur.execute("SELECT phone, date, country, price, server FROM orders WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?", (uid, limit, offset)).fetchall()
            msg = f"{P_DOC} <b>Purchase History (Page {page})</b>\n🗓 <b>Today:</b> {today_total} purchase(s)\n\n"
            if not rows: msg += "No purchases found."
            else:
                for ph, d, country, price, server in rows:
                    if str(ph).startswith("LZT_"):
                        display_ph = "Server 1 number"
                    else:
                        display_ph = f"+{str(ph).lstrip('+')}" if str(ph).lstrip('+').isdigit() else ph
                    msg += f"📱 {display_ph}\n🏳️ {country or 'Unknown'} | {server or 'Server'} | {format_price(uid, price or 0)}\n📅 {format_purchase_datetime(d)}\n────────────────\n"
            nav = []
            if page > 1: nav.append(p_btn("Prev", f"page_purchases_{page-1}"))
            nav.append(p_btn("Back", "menu_main"))
            if offset + limit < total: nav.append(p_btn("Next", f"page_purchases_{page+1}"))
            await e.edit(msg, buttons=[nav])

        elif data == "menu_help":
            btns = [
                [p_btn("📢 Updates Channel", url="https://t.me/PIRO_BUYERS_KP")],
                [p_btn("📜 Terms And Conditions", url=TERMS_URL)],
                [p_btn("💬 Contact For Support", url=get_support_url())],
                [p_btn("Back", "menu_main")]
            ]
            await e.edit(f"⛔️ <b>Help & Support</b>\n\nHow can we help you today? Please use the navigation links below:", buttons=btns)

        elif data.startswith("dep_upi"):
            if not is_method_on("upi_status"):
                return await e.answer("UPI deposits are currently disabled.", alert=True)
            await init_upi_keypad(e)
        elif data.startswith("depm_"): await manual_deposit_init(e, data.replace("depm_", ""))
        elif data.startswith("kp_"): await keypad_logic(e)
        elif data.startswith("check_upi_"): await verify_upi_payment(e, data.replace("check_upi_", ""))

        # --- KEYPAD DYNAMIC LOGIC FOR ADMINS ---
        elif data.startswith("kp_adm|"):
            parts = data.split("|")
            t_uid, order_id, d_type, action, cur_val = int(parts[1]), parts[2], parts[3], parts[4], parts[5]

            if action == "del":
                cur_val = cur_val[:-1]
            elif action == "confirm":
                final_amt = int(cur_val) if cur_val.isdigit() else 0
                if final_amt <= 0:
                    return await e.answer("❌ Console value must be larger than zero to confirm.", alert=True)

                update_balance(t_uid, final_amt)
                cur.execute("UPDATE users SET total_deposited = total_deposited + ? WHERE user_id=?", (final_amt, t_uid))

                if d_type == "upi":
                    cur.execute("UPDATE upi_orders SET status='success' WHERE order_id=?", (order_id,))
                elif d_type == "man":
                    cur.execute("UPDATE deposits SET status='success' WHERE id=?", (order_id.replace("M", ""),))

                method_label = "UPI Automatic" if d_type == "upi" else "Manual"
                if d_type == "man":
                    method_row = cur.execute("SELECT method_name FROM deposits WHERE id=?", (order_id.replace("M", ""),)).fetchone()
                    if method_row and method_row[0]:
                        method_label = method_row[0]

                db.commit()
                await log_primary_deposit(t_uid, final_amt, f"CONSOLE_{method_label}")
                try:
                    await bot.send_message(t_uid, f"✅ Your {html.escape(method_label)} payment of ₹{final_amt} has been approved and credited.")
                except:
                    pass
                await e.edit(f"✅ Approved <b>{html.escape(method_label)}</b> and credited ₹{final_amt} to user <code>{t_uid}</code>!")
                return
            else:
                if len(cur_val) < 6:
                    cur_val += action

            await render_admin_review_keypad(e, t_uid, order_id, d_type, cur_val)
            return

        # --- ADMIN DASHBOARD INTERACTIONS ---
        elif data.startswith("adm_") and is_admin(uid):
            action = data[4:]

            if action == "adminmain":
                btns = [
                    [p_btn("Sell Settings", "adm_sellset"), p_btn("Server 1 Settings", "adm_lztset")],
                    [p_btn("Server 3 Management", "adm_server3"), p_btn("Server 4 Management", "adm_server4")],
                    [p_btn("Server 5 Management", "adm_server5", style="primary")],
                    [p_btn("Manage Stock", "adm_managestock"), p_btn("Add Stock (Single)", "adm_addstock")],
                    [p_btn("Bulk Upload (ZIP)", "adm_addzip"), p_btn("Statistics", "adm_stats")],
                    [p_btn("Payments", "adm_payments"), p_btn("Withdrawals", "adm_wdlist")],
                    [p_btn("Toggle Server 1", "adm_tgl_s1"), p_btn("Change Balance", "adm_bal")],
                    [p_btn("Ban User", "adm_ban"), p_btn("User Info", "adm_userinfo")],
                    [p_btn("Broadcast", "adm_bcast"), p_btn("Discount", "adm_discount")],
                    [p_btn("Create Promo Code", "adm_createpromo"), p_btn("Create Giveaway", "adm_creategiveaway")],
                    [p_btn("Referral Settings", "adm_refsettings"), p_btn("Min Deposit configuration", "adm_min_dep")],
                    [p_btn("Game: Fight settings", "adm_tgl_fight"), p_btn(f"Force Join: {'🟢 ON' if is_force_join_enabled() else '🔴 OFF'}", "adm_tgl_forcejoin")],
                    [p_btn("Bulk Upload Warnings", "adm_bulkwarn"), p_btn("Toggle Bot Status", "adm_togglebot")],
                    [p_btn("Manage API ID/Hash", "adm_apis"), p_btn("Auto Price Setup", "adm_autoprice")],
                    [p_btn("Backup Bot Data", "adm_backup"), p_btn("Restore Bot Data", "adm_restore")],
                    [p_btn("🏆 Top 10 Richest Users", "adm_richest"), p_btn("Manage Admins", "adm_manageadmins")],
                    [p_btn("Back to Bot", "menu_main")]
                ]
                await e.edit(f"💻 <b>Admin Dashboard</b>", buttons=btns)

            elif action == "server5":
                with managed_connect() as conn:
                    enabled=conn.execute("SELECT value FROM smm_settings WHERE key='enabled'").fetchone()[0]=='1'
                    p=conn.execute("SELECT COUNT(*),COALESCE(SUM(enabled),0),COALESCE(SUM(balance),0) FROM smm_providers").fetchone()
                    c=conn.execute("SELECT COUNT(*) FROM smm_categories").fetchone()[0];s=conn.execute("SELECT COUNT(*) FROM smm_services").fetchone()[0];o=conn.execute("SELECT COUNT(*) FROM smm_orders").fetchone()[0]
                await e.edit(f"📊 <b>Server 5</b>\n\nServer Status: {'✅' if enabled else '❌'}\nProviders: {p[0]} ({p[1]} enabled)\nCategories: {c}\nServices: {s}\nOrders: {o}\nProvider Balance Total: {p[2]:.2f}",buttons=[
                  [p_btn("Server Status","adm_smm_toggle",style="success" if not enabled else "danger")],
                  [p_btn("🌐 Providers","adm_smm_providers"),p_btn("📂 Categories","adm_smm_categories")],
                  [p_btn("🛒 Services","adm_smm_services"),p_btn("📦 Orders","adm_smm_orders")],
                  [p_btn("💰 Pricing Engine","adm_smm_pricing"),p_btn("💳 Balance","adm_smm_balance")],
                  [p_btn("🔄 Auto Sync","adm_smm_sync"),p_btn("📝 Logs","adm_smm_logs")],
                  [p_btn("⚙ Settings","adm_smm_settings")],[p_btn("Back","adm_adminmain")]])
            elif action == "smm_toggle":
                with managed_connect() as conn:conn.execute("UPDATE smm_settings SET value=CASE value WHEN '1' THEN '0' ELSE '1' END WHERE key='enabled'");conn.commit()
                await e.edit("Server status updated.",buttons=[[p_btn("Back","adm_server5")]])
            elif action == "smm_providers":
                with managed_connect() as conn:rows=conn.execute("SELECT id,name,enabled,currency,balance,priority,auto_sync,last_sync FROM smm_providers WHERE deleted_at IS NULL ORDER BY priority,name").fetchall()
                buttons=[[p_btn(f"{'✅' if r['enabled'] else '❌'} {r['name']} · {r['currency']} {r['balance']:.2f}",f"adm_smm_provider|{r['id']}")] for r in rows]
                buttons += [[p_btn("➕ Add Provider","adm_smm_add",style="success")],[p_btn("🔄 Sync All","adm_smm_syncall"),p_btn("💰 Refresh Balance","adm_smm_balance")],[p_btn("Back","adm_server5")]]
                await e.edit("🌐 <b>Providers</b>\n\nUnlimited providers with independent API, currency, priority, auto sync/order/retry, markup, and balance.",buttons=buttons)
            elif action == "smm_add":
                payment_admin_state[uid]={"step":"smm_name"};await e.edit("Send provider name.",buttons=[[p_btn("Cancel","adm_server5")]])
            elif action.startswith("smm_provider|"):
                pid=int(action.split('|')[1])
                with managed_connect() as conn:r=conn.execute("SELECT * FROM smm_providers WHERE id=? AND deleted_at IS NULL",(pid,)).fetchone();counts=conn.execute("SELECT (SELECT COUNT(*) FROM smm_categories WHERE provider_id=?),(SELECT COUNT(*) FROM smm_services WHERE provider_id=?)",(pid,pid)).fetchone()
                if not r:return await e.answer("Provider missing.",alert=True)
                await e.edit(f"🌐 <b>{html.escape(r['name'])}</b>\n\nStatus: {'✅' if r['enabled'] else '❌'}\nBalance: {r['currency']} {r['balance']:.2f}\nPriority: {r['priority']}\nMarkup: {r['percent_markup']}% + ₹{r['fixed_markup']}\nExchange Rate: {r['exchange_rate']}\nAuto Sync: {'✅' if r['auto_sync'] else '❌'}\nAuto Order: {'✅' if r['auto_order'] else '❌'}\nAuto Retry: {'✅' if r['auto_retry'] else '❌'}\nCategories: {counts[0]}\nServices: {counts[1]}\nLast Sync: {r['last_sync'] or 'Never'}\nLast Error: {html.escape(r['last_error'] or 'None')}",buttons=[[p_btn("Enable / Disable",f"adm_smm_ptoggle|{pid}",style="danger")],[p_btn("💰 Set Markup",f"adm_smm_pmarkup|{pid}",style="primary"),p_btn("🔐 Change API Token",f"adm_smm_ptoken|{pid}")],[p_btn("🔄 Sync",f"adm_smm_psync|{pid}"),p_btn("💳 Balance",f"adm_smm_pbalance|{pid}")],[p_btn("📂 Categories",f"adm_smm_pcats|{pid}")],[p_btn("🗑 Remove Provider",f"adm_smm_pdelete|{pid}",style="danger")],[p_btn("Back","adm_smm_providers")]])
            elif action.startswith("smm_pdelete|"):
                pid=int(action.split('|')[1])
                await e.edit("⚠️ <b>Remove this provider?</b>\n\nProviders with order history are archived so past orders remain readable. Providers without orders are deleted with their cached catalogue.",buttons=[[p_btn("Confirm Remove",f"adm_smm_pdelete_confirm|{pid}",style="danger")],[p_btn("Cancel",f"adm_smm_provider|{pid}")]])
            elif action.startswith("smm_pdelete_confirm|"):
                pid=int(action.split('|')[1])
                with managed_connect() as conn:
                    exists=conn.execute("SELECT name FROM smm_providers WHERE id=? AND deleted_at IS NULL",(pid,)).fetchone()
                    if not exists:return await e.answer("Provider already removed.",alert=True)
                    has_orders=conn.execute("SELECT 1 FROM smm_orders WHERE provider_id=? LIMIT 1",(pid,)).fetchone()
                    if has_orders:
                        conn.execute("UPDATE smm_providers SET enabled=0,auto_sync=0,auto_order=0,deleted_at=?,updated_at=? WHERE id=?",(datetime.now(timezone.utc).isoformat(),datetime.now(timezone.utc).isoformat(),pid))
                        conn.execute("UPDATE smm_services SET enabled=0,visible=0,deleted_at=COALESCE(deleted_at,?) WHERE provider_id=?",(datetime.now(timezone.utc).isoformat(),pid))
                        conn.execute("UPDATE smm_categories SET visible=0 WHERE provider_id=?",(pid,))
                        result="Provider archived and removed from all provider/category/service buttons because order history exists."
                    else:
                        conn.execute("DELETE FROM smm_services WHERE provider_id=?",(pid,));conn.execute("DELETE FROM smm_categories WHERE provider_id=?",(pid,));conn.execute("DELETE FROM smm_providers WHERE id=?",(pid,))
                        result="Provider and cached catalogue deleted."
                    conn.commit()
                await e.edit(f"✅ {result}",buttons=[[p_btn("Providers","adm_smm_providers")]])
            elif action.startswith("smm_ptoken|"):
                pid=int(action.split('|')[1]);payment_admin_state[uid]={"step":"smm_token","provider_id":pid}
                await e.edit("🔐 <b>Change Provider API Token</b>\n\nSend the new API token. It will be encrypted and never shown in logs.",buttons=[[p_btn("Cancel",f"adm_smm_provider|{pid}")]])
            elif action.startswith("smm_pmarkup|"):
                pid=int(action.split('|')[1]);payment_admin_state[uid]={"step":"smm_markup","provider_id":pid}
                await e.edit("💰 <b>Provider Pricing</b>\n\nSend the profit markup percentage only.\n\nExample: <code>40</code>",buttons=[[p_btn("Cancel",f"adm_smm_provider|{pid}")]])
            elif action.startswith("smm_pcats|"):
                pid=int(action.split('|')[1])
                with managed_connect() as conn:rows=conn.execute("SELECT id,display_name,visible FROM smm_categories WHERE provider_id=? ORDER BY sort_position,display_name LIMIT 80",(pid,)).fetchall()
                buttons=[[p_btn(f"{'✅' if r['visible'] else '❌'} {r['display_name']}",f"adm_smm_ctoggle|{r['id']}|{pid}")] for r in rows]
                buttons.append([p_btn("Back",f"adm_smm_provider|{pid}")]);await e.edit("📂 <b>Manage Categories</b>\n\nTap a category to hide or show it.",buttons=buttons)
            elif action.startswith("smm_ctoggle|"):
                _,cid,pid=action.split('|')
                with managed_connect() as conn:conn.execute("UPDATE smm_categories SET visible=1-visible WHERE id=?",(int(cid),));conn.commit()
                await e.edit("Category visibility updated.",buttons=[[p_btn("Back",f"adm_smm_pcats|{pid}")]])
            elif action.startswith("smm_ptoggle|"):
                pid=int(action.split('|')[1])
                with managed_connect() as conn:conn.execute("UPDATE smm_providers SET enabled=1-enabled,updated_at=? WHERE id=?",(datetime.now(timezone.utc).isoformat(),pid));conn.commit()
                await e.edit("Provider status updated.",buttons=[[p_btn("Back",f"adm_smm_provider|{pid}")]])
            elif action.startswith("smm_psync|"):
                pid=int(action.split('|')[1])
                try:cats,services=await smm_sync_provider(pid);await e.edit(f"Sync completed: {cats} categories, {services} services.",buttons=[[p_btn("Back",f"adm_smm_provider|{pid}")]])
                except Exception as exc:await send_admin_error(f"Server 5 provider {pid} sync failed",getattr(exc,'detail',str(exc)));await e.edit("Sync failed. Details sent to admin logs.",buttons=[[p_btn("Back",f"adm_smm_provider|{pid}")]])
            elif action.startswith("smm_pbalance|"):
                pid=int(action.split('|')[1])
                try:
                    balance,currency=await SMMClient(pid).balance()
                    with managed_connect() as conn:conn.execute("UPDATE smm_providers SET balance=?,currency=? WHERE id=?",(balance,currency,pid));conn.commit()
                    await e.answer(f"{currency} {balance:.2f}",alert=True)
                except Exception as exc:await send_admin_error(f"Server 5 balance failed {pid}",getattr(exc,'detail',str(exc)));await e.answer("Balance refresh failed.",alert=True)
            elif action == "smm_syncall":
                with managed_connect() as conn:ids=[r[0] for r in conn.execute("SELECT id FROM smm_providers WHERE enabled=1 AND deleted_at IS NULL")]
                ok=fail=0
                for pid in ids:
                    try:await smm_sync_provider(pid);ok+=1
                    except Exception as exc:fail+=1;await send_admin_error(f"Server 5 provider {pid} sync failed",getattr(exc,'detail',str(exc)))
                await e.edit(f"Sync finished. Successful: {ok} · Failed: {fail}",buttons=[[p_btn("Back","adm_server5")]])
            elif action == "smm_categories" or action.startswith("smm_catpage|"):
                page=int(action.split('|')[1]) if '|' in action else 1;await render_admin_smm_categories(e,page)
            elif action == "smm_catsearch":
                payment_admin_state[uid]={"step":"smm_catsearch"};await e.edit("🔍 Send the category name.",buttons=[[p_btn("Cancel","adm_smm_categories")]])
            elif action.startswith("smm_cat|"):
                _,cid,page=action.split('|');await render_admin_smm_services(e,int(cid),int(page))
            elif action == "smm_services":
                await render_admin_smm_categories(e,1)
            elif action.startswith("smm_service|"):
                _,sid,cid=action.split('|')
                with managed_connect() as conn:r=conn.execute("""SELECT s.*,p.name provider_name,c.display_name category_name FROM smm_services s
                  JOIN smm_providers p ON p.id=s.provider_id JOIN smm_categories c ON c.id=s.category_id WHERE s.id=?""",(int(sid),)).fetchone()
                if not r:return await e.answer("Service missing.",alert=True)
                await e.edit(f"🛒 <b>Service Information</b>\n\nProvider: <b>{html.escape(r['provider_name'])}</b>\nCategory: {html.escape(r['category_name'])}\nService ID: <code>{html.escape(r['remote_service_id'])}</code>\nName: {html.escape(r['name'])}\nStatus: {'✅ Enabled' if r['enabled'] else '❌ Disabled'}\nVisible: {'✅' if r['visible'] else '❌'}\nRate: {r['rate']}\nLimits: {r['minimum']}–{r['maximum']}\nMarkup: {r['markup_type'] or 'Global'} {r['markup_value'] or ''}",buttons=[
                  [p_btn("Enable / Disable",f"adm_smm_stoggle|{sid}|{cid}",style="danger")],[p_btn("Custom Markup",f"adm_smm_sedit|markup|{sid}|{cid}")],
                  [p_btn("Minimum Order",f"adm_smm_sedit|min|{sid}|{cid}"),p_btn("Maximum Order",f"adm_smm_sedit|max|{sid}|{cid}")],
                  [p_btn("Set Emoji",f"adm_smm_sedit|emoji|{sid}|{cid}"),p_btn("Change Name",f"adm_smm_sedit|name|{sid}|{cid}")],
                  [p_btn("Change Description",f"adm_smm_sedit|description|{sid}|{cid}")],[p_btn("Sync Provider Data",f"adm_smm_psync|{r['provider_id']}")],
                  [p_btn("Delete Service",f"adm_smm_sdelete|{sid}|{cid}",style="danger")],[p_btn("Back",f"adm_smm_cat|{cid}|1")]])
            elif action.startswith("smm_stoggle|"):
                _,sid,cid=action.split('|')
                with managed_connect() as conn:conn.execute("UPDATE smm_services SET enabled=1-enabled WHERE id=?",(int(sid),));conn.commit()
                await e.edit("Service status updated.",buttons=[[p_btn("Back",f"adm_smm_service|{sid}|{cid}")]])
            elif action.startswith("smm_sedit|"):
                _,field,sid,cid=action.split('|');payment_admin_state[uid]={"step":"smm_service_edit","field":field,"service_id":int(sid),"category_id":int(cid)}
                prompts={"markup":"Send <code>global</code> or <code>percentage|40</code>, <code>fixed|5</code>, <code>multiplier|1.5</code>.","min":"Send minimum order quantity.","max":"Send maximum order quantity.","emoji":"Send one emoji.","name":"Send the customer-facing service name.","description":"Send the service description."}
                await e.edit(prompts[field],buttons=[[p_btn("Cancel",f"adm_smm_service|{sid}|{cid}")]])
            elif action.startswith("smm_sdelete|"):
                _,sid,cid=action.split('|')
                with managed_connect() as conn:
                    smm_delete_service(int(sid),uid)
                await e.edit("Service removed from the catalogue.",buttons=[[p_btn("Back",f"adm_smm_cat|{cid}|1")]])
            elif action == "smm_syncproviders":
                with managed_connect() as conn:rows=conn.execute("SELECT id,name,enabled,last_sync FROM smm_providers WHERE deleted_at IS NULL ORDER BY priority,name").fetchall()
                buttons=[[p_btn(f"{'✅' if r['enabled'] else '❌'} {r['name']}",f"adm_smm_psync|{r['id']}")] for r in rows];buttons.append([p_btn("Back","adm_smm_categories")])
                await e.edit("🌐 <b>Choose Provider</b>\n\nSelecting a provider fetches and caches all categories and services.",buttons=buttons)
            elif action == "smm_orders" or action.startswith("smm_orders|"):
                page=int(action.split("|")[1]) if "|" in action else 1
                await render_admin_smm_orders(e,page)
            elif action in ("smm_logs","smm_settings","smm_pricing","smm_sync","smm_balance"):
                with managed_connect() as conn:
                    if action=='smm_categories':rows=conn.execute("SELECT p.name,c.display_name,c.visible FROM smm_categories c JOIN smm_providers p ON p.id=c.provider_id ORDER BY c.sort_position,c.display_name LIMIT 50").fetchall();lines=[f"{'✅' if r[2] else '❌'} {r[0]} · {r[1]}" for r in rows]
                    elif action=='smm_services':rows=conn.execute("SELECT s.id,s.name,s.rate,s.minimum,s.maximum,s.enabled FROM smm_services s ORDER BY s.id DESC LIMIT 50").fetchall();lines=[f"#{r[0]} {'✅' if r[5] else '❌'} {r[1]} · {r[2]}/1K · {r[3]}–{r[4]}" for r in rows]
                    elif action=='smm_orders':rows=conn.execute("SELECT id,user_id,charge,profit,status,created_at FROM smm_orders ORDER BY id DESC LIMIT 50").fetchall();lines=[f"#{r[0]} · user {r[1]} · ₹{r[2]} · profit ₹{r[3]} · {r[4]} · {r[5]}" for r in rows]
                    elif action=='smm_logs':rows=conn.execute("SELECT created_at,level,action,detail FROM smm_logs ORDER BY id DESC LIMIT 40").fetchall();lines=[f"{r[0]} [{r[1]}] {r[2]} · {r[3][:100]}" for r in rows]
                    elif action=='smm_balance':rows=conn.execute("SELECT name,currency,balance,last_error FROM smm_providers WHERE deleted_at IS NULL ORDER BY priority").fetchall();lines=[f"{r[0]} · {r[1]} {r[2]}" for r in rows]
                    elif action=='smm_pricing':rows=conn.execute("SELECT name,percent_markup,fixed_markup,exchange_rate,minimum_profit,maximum_profit,round_to FROM smm_providers WHERE deleted_at IS NULL").fetchall();lines=[f"{r[0]} · {r[1]}% + {r[2]} · FX {r[3]} · profit {r[4]}–{r[5]} · round {r[6]}" for r in rows]
                    else:rows=conn.execute("SELECT key,value FROM smm_settings ORDER BY key").fetchall();lines=[f"{r[0]} = {r[1]}" for r in rows]
                await e.edit(f"<b>{action[4:].replace('_',' ').title()}</b>\n\n"+html.escape('\n'.join(lines) or 'No records.'),buttons=[[p_btn("Back","adm_server5")]])

            elif action in ("server3", "server4"):
                managed = server3 if action == "server3" else server4
                cfg = managed.config()
                msg = (f"🖥 <b>Server {cfg.server_no} Management</b>\n\nService: {'✅' if cfg.service_enabled else '❌'}\nAPI: {'✅' if cfg.api_enabled else '❌'}\n"
                       f"Markup: {cfg.percent_markup}% + ₹{cfg.fixed_markup}\nPriority: {cfg.priority}\nPrice: ₹{cfg.minimum_price}–₹{cfg.maximum_price}\nRetries: {cfg.retry_count}\nTimeout: {cfg.timeout_seconds}s")
                edit_callback = "adm_srv3_pricing" if cfg.server_no == 3 else "adm_srv4_pricing"
                buttons = [[p_btn("Toggle Service", f"adm_srv_toggle_service|{cfg.server_no}"), p_btn("Toggle API", f"adm_srv_toggle_api|{cfg.server_no}")], [p_btn("Edit Pricing / Limits", edit_callback)]]
                buttons.append([p_btn(f"Rename {cfg.display_name}",f"adm_srv_rename|{cfg.server_no}")])
                if cfg.server_no == 3:
                    try:
                        balance = await server3_client.get_balance() if cfg.api_enabled and cfg.api_key else None
                    except DGOTPError:
                        balance = None
                    with managed_connect() as conn:
                        counts = conn.execute("SELECT COUNT(*),SUM(in_stock) FROM server3_servers").fetchone()
                        services = conn.execute("SELECT COUNT(*) FROM server3_services WHERE in_stock=1").fetchone()[0]
                    msg += f"\nProvider Balance: {'₹'+str(balance) if balance is not None else 'Unavailable'}\nCached Servers: {counts[0]} ({counts[1] or 0} stocked)\nLive Service Variants: {services}"
                    buttons.extend([[p_btn("Set API Key", "adm_srv3_api_key"), p_btn("Refresh Balance", "adm_srv3_balance")],
                                    [p_btn("Set % Markup", "adm_srv3_percent"), p_btn("Set +₹ Markup", "adm_srv3_fixed")],
                                    [p_btn("Sync Servers & Services", "adm_srv3_sync")],
                                    [p_btn("Manage Provider Servers", "adm_srv3_servers|1"), p_btn("Manage Services", "adm_srv3_services|1")]])
                else:
                    try:
                        balance = await server4_client.get_balance() if cfg.api_enabled and cfg.api_key else None
                    except TemporaError:
                        balance = None
                    # Bootstrap an empty installation automatically. Subsequent
                    # refreshes are handled by the Server 4 background loop.
                    if cfg.api_enabled and cfg.api_key:
                        with managed_connect() as conn:
                            empty_catalogue = conn.execute("SELECT NOT EXISTS(SELECT 1 FROM server4_operators)").fetchone()[0]
                        if empty_catalogue:
                            try:
                                await server4_client.sync_all()
                            except TemporaError as exc:
                                logger.warning("Initial Server 4 catalogue fetch failed: %s", exc)
                    with managed_connect() as conn:
                        operators = conn.execute("SELECT COUNT(DISTINCT operator_code) FROM server4_stock WHERE available_count>0").fetchone()[0]
                        countries = conn.execute("SELECT COUNT(DISTINCT operator_code||':'||country_code) FROM server4_stock WHERE available_count>0").fetchone()[0]
                        services = conn.execute("SELECT COUNT(*) FROM server4_stock WHERE available_count>0").fetchone()[0]
                        sync_info = conn.execute("SELECT last_health,last_health_at FROM service_servers WHERE server_no=4").fetchone()
                    msg += f"\nProvider Balance: {'₹'+str(balance) if balance is not None else 'Unavailable'}\nStocked Operators: {operators}\nStocked Countries: {countries}\nAvailable Service Variants: {services}\nLast Catalogue: {sync_info['last_health'] or 'Never'}\nLast Update: {sync_info['last_health_at'] or 'Never'}"
                    buttons.extend([[p_btn("Set API Key", "adm_srv4_api_key"), p_btn("Refresh Balance", "adm_srv4_balance")],
                                    [p_btn("Set % Markup", "adm_srv4_percent"), p_btn("Set +₹ Markup", "adm_srv4_fixed")],
                                    [p_btn("Add Operator", "adm_srv4_add_operator"), p_btn("Fetch All Catalogue", "adm_srv4_sync")],
                                    [p_btn("Manage Operators", "adm_srv4_operators")]])
                buttons.extend([[p_btn("Health / API Test", f"adm_srv_health|{cfg.server_no}")], [p_btn("Back", "adm_adminmain")]])
                await e.edit(msg, buttons=buttons)

            elif action == "srv3_api_key":
                payment_admin_state[uid] = {"step": "server3_api_key"}
                await e.edit("🔑 Send the DGOTP API key. The message will be deleted and the key will never be displayed.", buttons=[[p_btn("Cancel", "adm_server3")]])

            elif action == "srv4_api_key":
                payment_admin_state[uid] = {"step": "server4_api_key"}
                await e.edit("🔑 Send the TemporaSMS API key. It will be encrypted and the message deleted.", buttons=[[p_btn("Cancel", "adm_server4")]])

            elif action.startswith("srv_rename|"):
                number=int(action.split("|")[1]);payment_admin_state[uid]={"step":"server_rename","server_no":number}
                await e.edit(f"Send the new customer-facing name for Server {number}. Provider names are never shown to users.",buttons=[[p_btn("Cancel",f"adm_server{number}")]])

            elif action == "srv4_add_operator":
                payment_admin_state[uid] = {"step": "server4_operator"}
                await e.edit("Send operator as <code>code | display name</code>, for example <code>1 | Operator 1</code>.", buttons=[[p_btn("Cancel", "adm_server4")]])

            elif action == "srv4_percent":
                payment_admin_state[uid] = {"step": "server4_percent"}
                await e.edit("Send percentage markup, for example <code>50</code> adds 50% to every Server 4 provider price.", buttons=[[p_btn("Cancel", "adm_server4")]])

            elif action == "srv3_percent":
                payment_admin_state[uid] = {"step": "server3_percent"}
                await e.edit("Send percentage markup, for example <code>50</code> adds 50% to every Server 3 provider price.", buttons=[[p_btn("Cancel", "adm_server3")]])

            elif action == "srv4_fixed":
                payment_admin_state[uid] = {"step": "server4_fixed"}
                await e.edit("Send fixed markup, for example <code>5</code> adds ₹5 after percentage markup to every Server 4 price.", buttons=[[p_btn("Cancel", "adm_server4")]])

            elif action == "srv3_fixed":
                payment_admin_state[uid] = {"step": "server3_fixed"}
                await e.edit("Send fixed markup, for example <code>5</code> adds ₹5 after percentage markup to every Server 3 price.", buttons=[[p_btn("Cancel", "adm_server3")]])

            elif action == "srv4_balance":
                try: await e.answer(f"TemporaSMS Balance: ₹{await server4_client.get_balance():.2f}", alert=True)
                except TemporaError as exc: await e.answer(str(exc), alert=True)

            elif action == "srv4_sync":
                try:
                    operator_count,country_count,service_count = await server4_client.sync_all()
                    await e.answer(f"Fetched {operator_count} operators, {country_count} countries and {service_count} services.", alert=True)
                except TemporaError as exc: await e.answer(str(exc), alert=True)

            elif action == "srv4_operators":
                with managed_connect() as conn:
                    rows = conn.execute("SELECT code,name,enabled FROM server4_operators ORDER BY name").fetchall()
                buttons=[[p_btn(f"{'✅' if r['enabled'] else '❌'} {r['name']} ({r['code']})", f"adm_srv4_toggle_operator|{r['code']}")] for r in rows]
                buttons.append([p_btn("Back", "adm_server4")])
                await e.edit("⚙️ <b>TemporaSMS Operators</b>\nTap to enable or disable.", buttons=buttons)

            elif action.startswith("srv4_toggle_operator|"):
                code=action.split("|",1)[1]
                with managed_connect() as conn: conn.execute("UPDATE server4_operators SET enabled=1-enabled WHERE code=?",(code,)); conn.commit()
                await e.answer("Operator updated",alert=True)

            elif action == "srv3_pricing":
                payment_admin_state[uid] = {"step": "server3_pricing"}
                await e.edit("Send Server 3 settings separated by <code>|</code>:\n<code>Percent Markup | Fixed Markup | Priority | Minimum Price | Maximum Price | Retry Count | Timeout Seconds</code>", buttons=[[p_btn("Cancel", "adm_server3")]])

            elif action == "srv4_pricing":
                payment_admin_state[uid] = {"step": "server4_pricing"}
                await e.edit("Send Server 4 settings separated by <code>|</code>:\n<code>Percent Markup | Fixed Markup | Priority | Minimum Price | Maximum Price | Retry Count | Timeout Seconds</code>", buttons=[[p_btn("Cancel", "adm_server4")]])

            elif action == "srv3_balance":
                try: await e.answer(f"DGOTP Balance: ₹{await server3_client.get_balance():.2f}", alert=True)
                except DGOTPError as exc: await e.answer(str(exc), alert=True)

            elif action == "srv3_sync":
                try:
                    server_count, service_count = await server3_client.sync_catalogue()
                    await e.answer(f"Synced {server_count} servers and {service_count} stocked variants.", alert=True)
                except DGOTPError as exc: await e.answer(str(exc), alert=True)

            elif action.startswith(("srv3_servers|", "srv3_services|")):
                kind, page_text = action.split("|")
                page, limit = max(1, int(page_text)), 15
                with managed_connect() as conn:
                    if kind == "srv3_servers":
                        rows = conn.execute("SELECT code,name,enabled,in_stock FROM server3_servers ORDER BY in_stock DESC,name LIMIT ? OFFSET ?", (limit + 1, (page-1)*limit)).fetchall()
                        buttons = [[p_btn(f"{'✅' if r['enabled'] else '❌'} {'📦' if r['in_stock'] else '∅'} {r['name']}", f"adm_srv3_toggle_server|{r['code']}|{page}")] for r in rows[:limit]]
                    else:
                        rows = conn.execute("SELECT service_code,server_code,name,enabled,in_stock,provider_price FROM server3_services ORDER BY in_stock DESC,name LIMIT ? OFFSET ?", (limit + 1, (page-1)*limit)).fetchall()
                        buttons = [[p_btn(f"{'✅' if r['enabled'] else '❌'} {r['name']} / {r['server_code']} · ₹{r['provider_price']}", f"adm_srv3_toggle_service|{r['service_code']}|{r['server_code']}|{page}")] for r in rows[:limit]]
                nav=[]
                if page > 1: nav.append(p_btn("Prev", f"adm_{kind}|{page-1}"))
                if len(rows)>limit: nav.append(p_btn("Next", f"adm_{kind}|{page+1}"))
                if nav: buttons.append(nav)
                buttons.append([p_btn("Back", "adm_server3")])
                await e.edit(f"⚙️ <b>Server 3 {'Servers' if kind == 'srv3_servers' else 'Services'}</b>\n\n✅ enabled · ❌ disabled · 📦 stock · ∅ empty", buttons=buttons)

            elif action.startswith("srv3_toggle_server|"):
                _, code, page = action.split("|")
                with managed_connect() as conn: conn.execute("UPDATE server3_servers SET enabled=1-enabled WHERE code=?", (code,)); conn.commit()
                await e.answer("Server visibility updated", alert=False)
                await e.edit("Updated.", buttons=[[p_btn("Back", f"adm_srv3_servers|{page}")]])

            elif action.startswith("srv3_toggle_service|"):
                _, service_code, server_code, page = action.split("|")
                with managed_connect() as conn: conn.execute("UPDATE server3_services SET enabled=1-enabled WHERE service_code=? AND server_code=?", (service_code,server_code)); conn.commit()
                await e.answer("Service visibility updated", alert=False)
                await e.edit("Updated.", buttons=[[p_btn("Back", f"adm_srv3_services|{page}")]])

            elif action.startswith("srv_edit|"):
                number = int(action.split("|")[1])
                payment_admin_state[uid] = {"step": "server_config", "server_no": number}
                await e.edit("Send settings on one line separated by <code>|</code>:\n<code>API URL | API Key | Percent Markup | Fixed Markup | Priority | Minimum Price | Maximum Price | Retry Count | Timeout Seconds</code>", buttons=[[p_btn("Cancel", f"adm_server{number}")]])

            elif action.startswith("srv_toggle_"):
                kind, number = action.rsplit("|", 1)
                managed = server3 if number == "3" else server4
                cfg = managed.config()
                managed.update(**{("service_enabled" if kind.endswith("service") else "api_enabled"): not (cfg.service_enabled if kind.endswith("service") else cfg.api_enabled)})
                await e.answer("Updated", alert=True)

            elif action.startswith("srv_health|"):
                if action.endswith("|3"):
                    try:
                        detail, ok = f"Balance ₹{await server3_client.get_balance():.2f}", True
                    except DGOTPError as exc:
                        detail, ok = str(exc), False
                else:
                    try:
                        detail, ok = f"Balance ₹{await server4_client.get_balance():.2f}", True
                    except TemporaError as exc:
                        detail, ok = str(exc), False
                await e.answer(("Healthy: " if ok else "Failed: ") + detail, alert=True)

            elif action == "tgl_fight":
                curr = cur.execute("SELECT value FROM settings WHERE key='fight_game_status'").fetchone()[0]
                ns = 'off' if curr == 'on' else 'on'
                cur.execute("UPDATE settings SET value=? WHERE key='fight_game_status'", (ns,))
                db.commit()
                await e.answer(f"Fight game matches are now: {ns.upper()}", alert=True)

            elif action == "togglebot" and has_perm(uid, 'p_settings'):
                new_status = 'off' if is_bot_online() else 'on'
                cur.execute("UPDATE settings SET value=? WHERE key='bot_status'", (new_status,))
                db.commit()
                await e.answer(f"Bot turned {new_status.upper()}", alert=True)

            elif action == "tgl_forcejoin" and has_perm(uid, 'p_settings'):
                new_status = 'off' if is_force_join_enabled() else 'on'
                cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('force_join_status', ?)", (new_status,))
                db.commit()
                await e.answer(f"Force Join turned {new_status.upper()}", alert=True)
                class FakeEv:
                    data = b"adm_adminmain"
                    sender_id = uid
                    async def edit(self, text, buttons): await e.edit(text, buttons=buttons)
                    async def answer(self, text, alert=False): pass
                await handle_callbacks(FakeEv())

            elif action == "tgl_s1" and has_perm(uid, 'p_settings'):
                curr = cur.execute("SELECT value FROM settings WHERE key='server1_status'").fetchone()[0]
                ns = 'off' if curr == 'on' else 'on'
                cur.execute("UPDATE settings SET value=? WHERE key='server1_status'", (ns,))
                db.commit()
                await e.answer(f"Server 1 turned {ns.upper()}", alert=True)

            elif action == "stats":
                u_row = cur.execute("SELECT COUNT(*) FROM users").fetchone()
                u = u_row[0] if u_row else 0
                s_row = cur.execute("SELECT COUNT(*) FROM stock WHERE available=1").fetchone()
                s = s_row[0] if s_row else 0
                r_row = cur.execute("SELECT value FROM settings WHERE key='upi_revenue'").fetchone()
                r = r_row[0] if r_row else "0"
                bal_row = cur.execute("SELECT SUM(balance) FROM users").fetchone()
                total_bal = bal_row[0] if bal_row and bal_row[0] else 0
                o_row = cur.execute("SELECT COUNT(*), SUM(price) FROM orders").fetchone()
                total_orders = o_row[0] if o_row else 0
                total_spent = o_row[1] if o_row and o_row[1] else 0

                msg = (f"📊 <b>ADVANCED STATS</b>\n\n👥 <b>Total Users:</b> {u}\n📦 <b>Accounts in Stock:</b> {s}\n"
                       f"💰 <b>Total UPI Revenue:</b> ₹{r}\n\n💳 <b>Overall Users Balance:</b> ₹{total_bal}\n"
                       f"🛒 <b>Total Accounts Sold:</b> {total_orders}\n💲 <b>Overall Sales Amount:</b> ₹{total_spent}")
                return await e.edit(msg, buttons=[[p_btn("Back", "adm_adminmain")]])

            elif action == "richest" and has_perm(uid, 'p_stats'):
                rows = cur.execute(
                    "SELECT user_id, balance FROM users ORDER BY balance DESC, user_id ASC LIMIT 10"
                ).fetchall()
                msg = "🏆 <b>Top 10 Richest Users</b>\n\n"
                if not rows:
                    msg += "No users found."
                else:
                    medals = ("🥇", "🥈", "🥉")
                    for rank, (user_id, balance) in enumerate(rows, 1):
                        marker = medals[rank - 1] if rank <= 3 else f"{rank}."
                        msg += f"{marker} <code>{user_id}</code> — ₹{int(balance or 0):,}\n"
                return await e.edit(msg, buttons=[[p_btn("Back", "adm_adminmain")]])

            elif action == "autoprice" and has_perm(uid, 'p_manage_stock'):
                rows = cur.execute("SELECT country, year, price FROM auto_prices ORDER BY country, year LIMIT 30").fetchall()
                msg = "🤖 <b>Auto Price Setup</b>\n\nAuto prices are used during single and ZIP session upload.\n\n"
                msg += "<i>No auto prices set yet.</i>" if not rows else "".join([f"• {html.escape(str(c))} ({y}) = ₹{p}\n" for c, y, p in rows])
                btns = [[p_btn("➕ Set Auto Price", "adm_autoprice_set")], [p_btn("Back", "adm_adminmain")]]
                return await e.edit(msg, buttons=btns)

            elif action == "backup" and has_perm(uid, 'p_settings'):
                try:
                    backup_path = f"otp_bot_backup_{int(time.time())}.db"
                    dst = sqlite3.connect(backup_path)
                    db.backup(dst)
                    dst.close()
                    await bot.send_file(uid, backup_path, caption="✅ Bot data backup")
                    os.remove(backup_path)
                except Exception as ex:
                    await send_admin_error("Backup failed", str(ex))
                    await e.answer("Backup failed", alert=True)
                return

            elif action == "restore" and has_perm(uid, 'p_settings'):
                restore_state[uid] = True
                return await e.edit("♻️ <b>Restore Bot Data</b>\n\nSend the backup .db file as a document in this chat. Type /cancel to abort.", buttons=[[p_btn("Cancel", "adm_adminmain")]])

            elif action == "sellset":
                rows = cur.execute("SELECT * FROM sell_prices").fetchall()
                msg = f"🤝 <b>Manage Allowed Sell Countries</b>\n\n"
                for r in rows: msg += f"+{r[0]} ({r[1]}) | Good: ₹{r[2]} | Spam: ₹{r[3]}\n"
                btns = [[p_btn("Add/Edit Country", "adm_addsell")], [p_btn("Remove Country", "adm_rmsell")], [p_btn("Back", "adm_adminmain")]]
                await e.edit(msg, buttons=btns)

            elif action == "lztset":
                g = cur.execute("SELECT value FROM settings WHERE key='lzt_global_markup'").fetchone()[0]
                s1_status = "ON" if cur.execute("SELECT value FROM settings WHERE key='server1_status'").fetchone()[0] == 'on' else "OFF"

                lzt_bal = "Error"
                try:
                    me_res = await lzt_request('GET', '/me')
                    if me_res and 'user' in me_res:
                        lzt_bal = me_res['user'].get('balance', 'Error')
                except: pass

                msg = f"🌍 <b>Server 1 Settings</b>\nServer 1 Status: {s1_status}\nMarket Balance: {lzt_bal} RUB\nGlobal Markup: {g}%\n\nCustom Country Markups:\n"
                rows = cur.execute("SELECT * FROM lzt_settings").fetchall()
                for r in rows: msg += f"{r[0]}: {r[1]}%\n"

                btns = [
                    [p_btn("Set Global Markup", "adm_setgmarkup")],
                    [p_btn("Set Custom Country Markup", "adm_setcmarkup")],
                    [p_btn("Set Market Token", "adm_setlzttoken")],
                    [p_btn("Back", "adm_adminmain")]
                ]
                await e.edit(msg, buttons=btns)

            elif action == "wdlist":
                rows = cur.execute("SELECT id, user_id, amount, method, details FROM withdrawals WHERE status='pending' LIMIT 10").fetchall()
                if not rows: return await e.edit("No pending withdrawals.", buttons=[[p_btn("Back", "adm_adminmain")]])
                msg = f"💳 <b>Pending Withdrawals</b>\n\n"
                btns = []
                for r in rows:
                    msg += f"ID: {r[0]} | User: {r[1]} | ₹{r[2]} | {r[3]}: {r[4]}\n"
                    btns.append([p_btn(f"✅ App #{r[0]}", f"wd_act|app|{r[0]}"), p_btn(f"❌ Rej #{r[0]}", f"wd_act|rej|{r[0]}")])
                btns.append([p_btn("Back", "adm_adminmain")])
                await e.edit(msg, buttons=btns)

            elif action == "payments" and has_perm(uid, 'p_settings'):
                upi_st = "ON" if is_method_on("upi_status") else "OFF"
                cw_st = "ON" if is_method_on("cwallet_status") else "OFF"
                fampay_st = "ON" if is_method_on("fampay_status") else "OFF"
                fampay_min = fampay_setting("fampay_min_dep", "50")
                fampay_upi = fampay_setting("fampay_upi_id") or "Not configured"
                fp_counts={row[0]:row[1] for row in cur.execute("SELECT status,COUNT(*) FROM fampay_orders GROUP BY status").fetchall()}
                btns = [
                    [p_btn(f"UPI: {upi_st}", "adm_tgl_upi"), p_btn(f"Cwallet: {cw_st}", "adm_tgl_cw")],
                    [p_btn(f"FamPay Automatic: {fampay_st}", "adm_tgl_fampay", style="success" if fampay_st=="ON" else "danger")],
                    [p_btn(f"FamPay Minimum: ₹{fampay_min}", "adm_fampay_min"), p_btn("Set FamPay UPI", "adm_fampay_upi")],
                    [p_btn("UPI Gateways", "adm_fampay_gateways"),p_btn("FamPay Orders", "adm_fampay_orders|1")],
                    [p_btn("Set $ Rate", "adm_usdtrate")],
                    [p_btn("Add Payment Method", "adm_addpay")],
                    [p_btn("Remove Payment Method", "adm_delpay")],
                    [p_btn("Back", "adm_adminmain")]
                ]
                await e.edit(f"💳 <b>Manage Payment Methods</b>\n\nFamPay UPI: <code>{html.escape(fampay_upi)}</code>\nPending: {fp_counts.get('pending',0)} | Successful: {fp_counts.get('success',0)} | Expired: {fp_counts.get('expired',0)}", buttons=btns)
            elif action.startswith("fampay_orders|") and has_perm(uid,'p_settings'):
                page=max(1,int(action.split("|")[1]));limit=10
                rows=cur.execute("SELECT reference,user_id,amount,status,transaction_id,created_at,review_status FROM fampay_orders ORDER BY id DESC LIMIT ? OFFSET ?",(limit+1,(page-1)*limit)).fetchall()
                text="📊 <b>FamPay Automatic Orders</b>\n\n"
                for row in rows[:limit]:
                    text+=f"<code>{row[0]}</code> · User <code>{row[1]}</code> · ₹{row[2]} · <b>{html.escape(row[3])}</b>"
                    if row[4]:text+=f" · TXN <code>{html.escape(row[4])}</code>"
                    if row[6]:text+=f" · Review <b>{html.escape(row[6])}</b>"
                    text+="\n"
                buttons=[];nav=[]
                if page>1:nav.append(p_btn("Prev",f"adm_fampay_orders|{page-1}"))
                if len(rows)>limit:nav.append(p_btn("Next",f"adm_fampay_orders|{page+1}"))
                if nav:buttons.append(nav)
                buttons.append([p_btn("Back","adm_payments")])
                await e.edit(text if rows else "No FamPay automatic orders yet.",buttons=buttons)
            elif action == "fampay_gateways" and has_perm(uid, 'p_settings'):
                rows=cur.execute("SELECT id,name,enabled FROM fampay_gateways ORDER BY id").fetchall()
                buttons=[[p_btn(f"{'✅' if r[2] else '❌'} Gateway {i+1}: {r[1]}",f"adm_fampay_gateway|{r[0]}")] for i,r in enumerate(rows)] + [[p_btn("➕ Add Gateway","adm_fampay_gateway_add",style="success")],[p_btn("Back","adm_payments")]]
                await e.edit("⚡ <b>Automatic UPI Gateways</b>\n\nEach gateway can have its own UPI ID, limits, Gmail, and app password.",buttons=buttons)
            elif action == "fampay_gateway_add" and has_perm(uid, 'p_settings'):
                payment_admin_state[uid]={"step":"fpg_name"};await e.edit("Send gateway name.",buttons=[[p_btn("Cancel","adm_fampay_gateways")]])
            elif action.startswith("fampay_gateway|") and has_perm(uid, 'p_settings'):
                gid=int(action.split("|",1)[1]);r=cur.execute("SELECT name,upi_id,min_deposit,max_deposit,gmail,app_password,enabled FROM fampay_gateways WHERE id=?",(gid,)).fetchone()
                if not r:return await e.answer("Gateway not found.",alert=True)
                await e.edit(f"⚡ <b>{html.escape(r[0])}</b>\n\nUPI: <code>{html.escape(r[1])}</code>\nLimits: ₹{r[2]}–₹{r[3]}\nGmail: <code>{html.escape(r[4] or 'Not set')}</code>\nApp password: <b>{'Set' if r[5] else 'Not set'}</b>",buttons=[[p_btn("Toggle",f"adm_fampay_gateway_toggle|{gid}"),p_btn("Edit UPI",f"adm_fampay_gateway_edit|{gid}|upi")],[p_btn("Limits",f"adm_fampay_gateway_edit|{gid}|limits"),p_btn("Gmail",f"adm_fampay_gateway_edit|{gid}|gmail")],[p_btn("App Password",f"adm_fampay_gateway_edit|{gid}|password")],[p_btn("Back","adm_fampay_gateways")]])
            elif action.startswith("fampay_gateway_toggle|") and has_perm(uid, 'p_settings'):
                gid=int(action.rsplit("|",1)[1]);cur.execute("UPDATE fampay_gateways SET enabled=1-enabled WHERE id=?",(gid,));db.commit();await e.edit("Gateway updated.",buttons=[[p_btn("Back",f"adm_fampay_gateway|{gid}")]])
            elif action.startswith("fampay_gateway_edit|") and has_perm(uid, 'p_settings'):
                _,gid,field=action.split("|",2);payment_admin_state[uid]={"step":f"fpg_edit_{field}","gateway_id":int(gid)};await e.edit(f"Send new {field} value.",buttons=[[p_btn("Cancel",f"adm_fampay_gateway|{gid}")]])
            elif action == "tgl_upi" and has_perm(uid, 'p_settings'):
                ns = 'off' if is_method_on("upi_status") else 'on'
                cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('upi_status', ?)", (ns,))
                db.commit()
                await e.answer(f"UPI {ns.upper()}", alert=True)
            elif action == "tgl_cw" and has_perm(uid, 'p_settings'):
                ns = 'off' if is_method_on("cwallet_status") else 'on'
                cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('cwallet_status', ?)", (ns,))
                db.commit()
                await e.answer(f"Cwallet {ns.upper()}", alert=True)
            elif action == "tgl_fampay" and has_perm(uid, 'p_settings'):
                ns='off' if is_method_on("fampay_status") else 'on'
                has_gateway=cur.execute("SELECT 1 FROM fampay_gateways WHERE enabled=1 LIMIT 1").fetchone()
                if ns=='on' and not fampay_setting("fampay_upi_id").strip() and not has_gateway:
                    return await e.answer("Set a FamPay UPI ID or add an enabled UPI gateway before enabling automatic deposits.",alert=True)
                cur.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('fampay_status',?)",(ns,));db.commit()
                await e.answer(f"FamPay Automatic {ns.upper()}",alert=True)
                return await e.edit("Setting updated.",buttons=[[p_btn("Back","adm_payments")]])
            elif action in ("fampay_min","fampay_upi","fampay_name") and has_perm(uid,'p_settings'):
                payment_admin_state[uid]={"step":action}
                prompts={"fampay_min":"Send the minimum automatic deposit amount (₹1–₹50000).","fampay_upi":"Send the FamPay UPI ID, for example name@fam.","fampay_name":"Send the payment recipient name (2–50 characters)."}
                await e.edit(prompts[action],buttons=[[p_btn("Cancel","adm_payments")]])

            elif action == "manageadmins" and uid in ADMIN_IDS:
                rows = cur.execute("SELECT user_id FROM admins").fetchall()
                msg = f"👥 <b>Manage Sub-Admins</b>\n\n"
                for r in rows: msg += f"👤 <code>{r[0]}</code>\n"
                btns = [[p_btn("Add Admin", "adm_addadmin"), p_btn("Edit Admin", "adm_editadminreq")], [p_btn("Back", "adm_adminmain")] ]
                await e.edit(msg, buttons=btns)

            elif action == "managestock" and has_perm(uid, 'p_manage_stock'):
                rows = cur.execute("SELECT DISTINCT country_name FROM stock ORDER BY country_name LIMIT 10 OFFSET 0").fetchall()
                btns = [[p_btn(f"{get_flag_by_country_name(c[0])} {c[0]}", f"adm_msc|{c[0]}")] for c in rows]
                btns.append([p_btn("🤖 Auto Price Setup", "adm_autoprice")])
                btns.append([p_btn("Next", "adm_mspg|2"), p_btn("Back", "adm_adminmain")])
                await e.edit(f"📜 <b>Manage Stock</b> (Page 1)", buttons=btns)

            elif action.startswith("mspg|") and has_perm(uid, 'p_manage_stock'):
                page = int(action.split("|")[1])
                limit, offset = 10, (page - 1) * 10
                rows = cur.execute("SELECT DISTINCT country_name FROM stock ORDER BY country_name LIMIT ? OFFSET ?", (limit, offset)).fetchall()
                total = cur.execute("SELECT COUNT(DISTINCT country_name) FROM stock").fetchone()[0]
                btns = [[p_btn(f"{get_flag_by_country_name(c[0])} {c[0]}", f"adm_msc|{c[0]}")] for c in rows]
                nav = []
                if page > 1: nav.append(p_btn("Prev", f"adm_mspg|{page-1}"))
                if offset + limit < total: nav.append(p_btn("Next", f"adm_mspg|{page+1}"))
                if nav: btns.append(nav)
                btns.append([p_btn("Back", "adm_adminmain")])
                await e.edit(f"📜 <b>Manage Stock</b> (Page {page})", buttons=btns)

            elif action.startswith("msc|") and has_perm(uid, 'p_manage_stock'):
                c_name = action.split("|")[1]
                years = cur.execute("SELECT DISTINCT account_year FROM stock WHERE country_name=? ORDER BY account_year DESC", (c_name,)).fetchall()
                btns = [[p_btn("Edit Country Name", f"adm_msedit|name|{c_name}"), p_btn("Edit Flag", f"adm_msedit|flag|{c_name}")], [p_btn("Edit Common Price", f"adm_msedit|cprice|{c_name}")] ]
                y_btns = []
                for (y,) in years:
                    count = cur.execute("SELECT COUNT(*) FROM stock WHERE country_name=? AND account_year=?", (c_name, y)).fetchone()[0]
                    y_btns.append(p_btn(f"{y} ({count})", f"adm_msy|{c_name}|{y}|1"))
                for i in range(0, len(y_btns), 3): btns.append(y_btns[i:i+3])
                btns.append([p_btn("Back", "adm_mspg|1")])
                await e.edit(f"{get_flag_by_country_name(c_name)} <b>Managing: {c_name}</b>\n\nSelect a year to see every stock number and its delete button.", buttons=btns)

            elif action.startswith("msy|") and has_perm(uid, 'p_manage_stock'):
                _, c_name, year, page_text = action.split("|", 3)
                page, limit = max(1, int(page_text)), 10
                offset = (page - 1) * limit
                total = cur.execute("SELECT COUNT(*) FROM stock WHERE country_name=? AND account_year=?", (c_name, year)).fetchone()[0]
                rows = cur.execute(
                    "SELECT phone, price, available FROM stock WHERE country_name=? AND account_year=? ORDER BY added_date, phone LIMIT ? OFFSET ?",
                    (c_name, year, limit, offset),
                ).fetchall()
                msg = f"📦 <b>{html.escape(c_name)} — {html.escape(str(year))}</b>\nTotal stock: <b>{total}</b>\n\n"
                btns = []
                for phone, price, available in rows:
                    status = "Available" if available else "Reserved"
                    msg += f"<code>+{str(phone).lstrip('+')}</code> — ₹{price} — {status}\n"
                    btns.append([p_btn(f"🗑 Delete +{str(phone).lstrip('+')}", f"adm_msdel|{phone}")])
                nav = []
                if page > 1: nav.append(p_btn("Prev", f"adm_msy|{c_name}|{year}|{page-1}"))
                if offset + limit < total: nav.append(p_btn("Next", f"adm_msy|{c_name}|{year}|{page+1}"))
                if nav: btns.append(nav)
                btns.append([p_btn("Back to Years", f"adm_msc|{c_name}")])
                return await e.edit(msg, buttons=btns)

            elif action.startswith("msdel|") and has_perm(uid, 'p_manage_stock'):
                phone = action.split("|", 1)[1]
                row = cur.execute("SELECT session_file, country_name, account_year FROM stock WHERE phone=?", (phone,)).fetchone()
                if not row:
                    return await e.answer("Stock item was already deleted.", alert=True)
                session_file, c_name, year = row
                cur.execute("DELETE FROM stock WHERE phone=?", (phone,))
                db.commit()
                delete_session_files(session_file)
                await e.answer(f"Deleted +{str(phone).lstrip('+')}", alert=True)
                remaining = cur.execute("SELECT COUNT(*) FROM stock WHERE country_name=? AND account_year=?", (c_name, year)).fetchone()[0]
                return await e.edit(
                    f"✅ <b>Stock deleted</b>\n\nNumber: <code>+{str(phone).lstrip('+')}</code>\nRemaining in {html.escape(c_name)} ({year}): <b>{remaining}</b>",
                    buttons=[[p_btn("Back to Stock", f"adm_msy|{c_name}|{year}|1")], [p_btn("Manage Stock", "adm_managestock")]],
                )

            # ADMIN CONVERSATIONS
            else:
                async def get_reply(txt):
                    prompt_text = txt + "\n<i>(Reply to this message. Type /cancel to abort)</i>"
                    async with bot.conversation(uid, timeout=600) as conv:
                        m = await conv.send_message(prompt_text)
                        while True:
                            resp = await conv.get_response()
                            msg_text = (resp.text or "").strip()
                            if msg_text.lower() == "/cancel":
                                raise ConversationCancelled("Cancelled")
                            is_reply = getattr(resp, "reply_to_msg_id", None) == m.id
                            if not is_reply:
                                continue
                            return resp

                try:
                    if action == "addsell":
                        c = (await get_reply("Enter Country Code (e.g., 91):")).text.replace("+", "")
                        y = (await get_reply("Enter Year (e.g., 2024 or 'Common'):")).text
                        pg = int((await get_reply("Enter Price for Good Account (₹):")).text)
                        ps = int((await get_reply("Enter Price for Spam Account (₹):")).text)
                        cur.execute("INSERT OR REPLACE INTO sell_prices (country_code, year, price_good, price_spam) VALUES (?,?,?,?)", (c, y, pg, ps))
                        db.commit()
                        await bot.send_message(uid, f"✅ Saved Sell Settings for +{c} ({y})!")

                    elif action == "min_dep":
                        cur_upi = cur.execute("SELECT value FROM settings WHERE key='min_upi_dep'").fetchone()[0]
                        cur_cw = cur.execute("SELECT value FROM settings WHERE key='min_cw_dep'").fetchone()[0]
                        upi_val = int((await get_reply(f"💵 <b>Current UPI Minimum: ₹{cur_upi}</b>\n\nEnter new minimum limit:")).text)
                        cw_val = int((await get_reply(f"💵 <b>Current Cwallet Minimum: ₹{cur_cw}</b>\n\nEnter new minimum limit:")).text)
                        cur.execute("UPDATE settings SET value=? WHERE key='min_upi_dep'", (str(upi_val),))
                        cur.execute("UPDATE settings SET value=? WHERE key='min_cw_dep'", (str(cw_val),))
                        db.commit()
                        await bot.send_message(uid, f"✅ Wallet minimum configurations updated successfully!")

                    elif action == "rmsell":
                        c = (await get_reply("Enter Country Code to remove:")).text.replace("+", "")
                        y = (await get_reply("Enter Year to remove (or type 'All'):")).text
                        if y.lower() == 'all': cur.execute("DELETE FROM sell_prices WHERE country_code=?", (c,))
                        else: cur.execute("DELETE FROM sell_prices WHERE country_code=? AND year=?", (c, y))
                        db.commit()
                        await bot.send_message(uid, f"✅ Removed settings for +{c}.")

                    elif action == "setgmarkup":
                        m = int((await get_reply("Enter Global Markup %:")).text)
                        cur.execute("UPDATE settings SET value=? WHERE key='lzt_global_markup'", (str(m),))
                        db.commit()
                        clear_lzt_cache()
                        await bot.send_message(uid, f"✅ Global markup set to {m}%. Server 1 stock cache refreshed.")

                    elif action == "setcmarkup":
                        buttons, page, total_pages = build_country_markup_buttons(1)
                        await e.edit(
                            f"🌍 <b>Select country for custom Server 1 markup</b>\n\n"
                            f"Page {page}/{total_pages}. Button values show the currently effective markup.\n"
                            f"After selecting a country, send the custom markup percent. Send <code>0</code> to remove its custom markup and use global markup.",
                            buttons=buttons
                        )

                    elif action.startswith("cmarkpg|"):
                        page = int(action.split("|")[1])
                        buttons, page, total_pages = build_country_markup_buttons(page)
                        await e.edit(
                            f"🌍 <b>Select country for custom Server 1 markup</b>\n\nPage {page}/{total_pages}.",
                            buttons=buttons
                        )

                    elif action.startswith("cmark|"):
                        iso = action.split("|")[1]
                        country = next((name for name, data in COUNTRY_CODES.items() if data[0] == iso), None)
                        if not country:
                            return await e.answer("Country not found.", alert=True)
                        current_markup = get_lzt_markup(country)
                        m = int((await get_reply(
                            f"💹 <b>{COUNTRY_CODES[country][1]} {country}</b> current effective markup: <b>{current_markup}%</b>\n\n"
                            f"Enter custom markup % for this country. Send <code>0</code> to remove custom markup and use global markup."
                        )).text)
                        if m == 0:
                            cur.execute("DELETE FROM lzt_settings WHERE LOWER(country)=LOWER(?) OR LOWER(country)=LOWER(?)", (country, iso))
                            result = f"✅ Removed custom markup for {country}. It now uses global markup."
                        else:
                            cur.execute("INSERT OR REPLACE INTO lzt_settings (country, markup_percent) VALUES (?,?)", (country, m))
                            result = f"✅ Custom markup for {country} set to {m}%."
                        db.commit()
                        clear_lzt_cache()
                        await bot.send_message(uid, result)

                    elif action == "setlzttoken":
                        token_input = (await get_reply("Enter API token (or type 'remove' to clear):")).text.strip()
                        global _lzt_missing_logged
                        if token_input.lower() == "remove":
                            cur.execute("DELETE FROM settings WHERE key='lzt_token'")
                            db.commit()
                            _lzt_missing_logged = False
                            await bot.send_message(uid, f"✅ Token removed.")
                        else:
                            clean_token = token_input.replace("Bearer ", "").strip()
                            cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('lzt_token', ?)", (clean_token,))
                            db.commit()
                            _lzt_missing_logged = False
                            await bot.send_message(uid, f"✅ Token saved.")

                    elif action == "apis" and has_perm(uid, 'p_settings'):
                        rows = cur.execute("SELECT id, api_id, label, active, added_date FROM api_credentials ORDER BY id DESC LIMIT 30").fetchall()
                        msg = "🔐 <b>Telegram API Pool</b>\n\n"
                        if rows:
                            for api_pk, api_id_val, label, active, added in rows:
                                status = "✅ ON" if active else "⛔ OFF"
                                msg += f"ID <code>{api_pk}</code> | <code>{api_id_val}</code> | {html.escape(label or 'API')} | {status}\n"
                        else:
                            msg += "No custom API credentials added yet. Bot is using fallback/default credentials.\n"
                        msg += "\nAdd multiple API ID/HASH pairs to rotate Server 2 session logins and reduce repeated API reuse."
                        btns = [
                            [p_btn("➕ Add API", "adm_addapi"), p_btn("🗑 Delete API", "adm_delapi")],
                            [p_btn("🔁 Toggle API", "adm_tglapi")],
                            [p_btn("Back", "adm_adminmain")]
                        ]
                        await e.edit(msg, buttons=btns)

                    elif action == "addapi" and has_perm(uid, 'p_settings'):
                        new_api_id = (await get_reply("Enter Telegram API ID (numeric):")).text.strip()
                        if not new_api_id.isdigit():
                            return await bot.send_message(uid, "❌ API ID must be numeric.")
                        new_api_hash = (await get_reply("Enter Telegram API HASH:")).text.strip()
                        if not new_api_hash:
                            return await bot.send_message(uid, "❌ API HASH cannot be empty.")
                        label = (await get_reply("Enter a short label/name for this API:")).text.strip() or f"API {new_api_id}"
                        cur.execute("INSERT INTO api_credentials (api_id, api_hash, label, active) VALUES (?,?,?,1)", (int(new_api_id), new_api_hash, label[:60]))
                        db.commit()
                        await bot.send_message(uid, f"✅ API added to rotation. ID: <code>{new_api_id}</code> Label: <b>{html.escape(label[:60])}</b>")

                    elif action == "delapi" and has_perm(uid, 'p_settings'):
                        api_pk = (await get_reply("Send API row ID to delete. Open Manage API ID/Hash to see IDs.")).text.strip()
                        if not api_pk.isdigit():
                            return await bot.send_message(uid, "❌ Row ID must be numeric.")
                        cur.execute("DELETE FROM api_credentials WHERE id=?", (int(api_pk),))
                        db.commit()
                        await bot.send_message(uid, "✅ API row deleted." if cur.rowcount else "❌ API row not found.")

                    elif action == "tglapi" and has_perm(uid, 'p_settings'):
                        api_pk = (await get_reply("Send API row ID to toggle ON/OFF. Open Manage API ID/Hash to see IDs.")).text.strip()
                        if not api_pk.isdigit():
                            return await bot.send_message(uid, "❌ Row ID must be numeric.")
                        row = cur.execute("SELECT active FROM api_credentials WHERE id=?", (int(api_pk),)).fetchone()
                        if not row:
                            return await bot.send_message(uid, "❌ API row not found.")
                        new_active = 0 if row[0] else 1
                        cur.execute("UPDATE api_credentials SET active=? WHERE id=?", (new_active, int(api_pk)))
                        db.commit()
                        await bot.send_message(uid, f"✅ API row is now {'ON' if new_active else 'OFF'}.")

                    elif action == "setapi" and has_perm(uid, 'p_settings'):
                        new_api_id = (await get_reply("Enter your Telegram API ID (numeric):")).text.strip()
                        if not new_api_id.isdigit():
                            return await bot.send_message(uid, "❌ API ID must be numeric.")
                        new_api_hash = (await get_reply("Enter your Telegram API HASH:")).text.strip()
                        if not new_api_hash:
                            return await bot.send_message(uid, "❌ API HASH cannot be empty.")

                        cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('api_id', ?)", (new_api_id,))
                        cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('api_hash', ?)", (new_api_hash,))
                        cur.execute("INSERT INTO api_credentials (api_id, api_hash, label, active) VALUES (?,?,?,1)", (int(new_api_id), new_api_hash, f"Legacy {new_api_id}"))
                        db.commit()
                        await bot.send_message(uid, f"✅ API credentials saved and added to rotation. API ID: {new_api_id}")

                    elif action == "bulkwarn":
                        warning_text = (
                            f"⚠️ <b>BULK SESSION UPLOAD SAFEGUARDS & WARNINGS</b>\n\n"
                            f"Uploading bulk accounts simultaneously carries high risks of account freezes or bans if proper parameters are not maintained:\n\n"
                            f"1️⃣ <b>IP Address Consistency</b>: If sessions are created on different IP ranges and suddenly logged in from the bot's server IP simultaneously, Telegram may flag them as suspicious and freeze them.\n"
                            f"2️⃣ <b>API ID & Hash Matches</b>: Ensure the API ID and API Hash matched in the session matches what the bot currently uses. Mismatched API details during requests trigger quick terminations.\n"
                            f"3️⃣ <b>Lack of Delays</b>: Accessing bulk sessions consecutively without sufficient delays flags automated scraping activity.\n\n"
                            f"<i>💡 Recommendation: Always test with 1-2 accounts before performing major bulk uploads.</i>"
                        )
                        await bot.send_message(uid, warning_text, buttons=[[p_btn("Back", "adm_adminmain")]])

                    elif action == "ap_add_country" and has_perm(uid, 'p_manage_stock'):
                        code = (await get_reply(f"📱 <b>Enter Country Calling Code (without +):</b>\n<i>Example: 91</i>")).text.replace("+", "").strip()
                        flag = html.escape((await get_reply(f"🏳️ <b>Enter Country Flag Emoji:</b>\n<i>Example: 🇮🇳</i>")).text.strip())
                        name = html.escape((await get_reply(f"🌍 <b>Enter Country Name:</b>\n<i>Example: India</i>")).text.strip())
                        cur.execute("INSERT OR REPLACE INTO custom_countries (code, name, flag) VALUES (?,?,?)", (code, name, flag))
                        db.commit()
                        await bot.send_message(uid, f"✅ <b>Custom Country Added Successfully!</b>\n{flag} {name} (+{code})")

                    elif action == "userinfo" and has_perm(uid, 'p_stats'):
                        t_uid = int((await get_reply(f"👤 <b>Enter User ID:</b>")).text)
                        u_row = cur.execute("SELECT balance, total_deposited, joined_date, banned, discount FROM users WHERE user_id=?", (t_uid,)).fetchone()
                        if not u_row: return await bot.send_message(uid, f"❌ User not found.")

                        o_row = cur.execute("SELECT COUNT(*), SUM(price) FROM orders WHERE user_id=?", (t_uid,)).fetchone()
                        up_row = cur.execute("SELECT SUM(amount) FROM upi_orders WHERE user_id=? AND status='success'", (t_uid,)).fetchone()

                        bal, dep, joined, is_banned, disc = u_row
                        o_count = o_row[0] if o_row else 0
                        o_spent = o_row[1] if o_row and o_row[1] else 0
                        u_upi = up_row[0] if up_row and up_row[0] else 0

                        msg = (f"👤 <b>USER INFO:</b> <code>{t_uid}</code>\n\n"
                               f"💰 Balance: ₹{bal}\n"
                               f"💳 Total Deposited: ₹{dep}\n"
                               f"🏦 UPI Deposited: ₹{u_upi}\n"
                               f"🛒 Total Orders: {o_count}\n"
                               f"💲 Total Spent: ₹{o_spent}\n"
                               f"🎁 Discount: {disc}%\n"
                               f"📅 Joined: {joined}\n"
                               f"🚫 Banned: {'Yes' if is_banned else 'No'}")
                        ban_label = "✅ Unban User" if is_banned else "🚫 Ban User"
                        await bot.send_message(uid, msg, buttons=[[p_btn(ban_label, "adm_ban")]])

                    elif action == "addadmin" and uid in ADMIN_IDS:
                        new_ad = int((await get_reply(f"👤 <b>Enter User ID for new Admin:</b>")).text)
                        cur.execute("INSERT OR IGNORE INTO admins (user_id) VALUES (?)", (new_ad,))
                        db.commit()
                        await bot.send_message(uid, f"✅ Admin added!")
                        class FakeEvent:
                            async def edit(self, text, buttons): await bot.send_message(uid, text, buttons=buttons)
                            async def answer(self, txt, alert): pass
                        await edit_admin_menu(FakeEvent(), new_ad)

                    elif action == "editadminreq" and uid in ADMIN_IDS:
                        t_id = int((await get_reply(f"👤 <b>Enter User ID to edit:</b>")).text)
                        class FakeEvent:
                            async def edit(self, text, buttons): await bot.send_message(uid, text, buttons=buttons)
                            async def answer(self, txt, alert): pass
                        await edit_admin_menu(FakeEvent(), t_id)

                    elif action.startswith("msedit|") and has_perm(uid, 'p_manage_stock'):
                        parts = action.split("|")
                        m_act, c_name = parts[1], parts[2]
                        if m_act == "name":
                            new_name = html.escape((await get_reply(f"📜 <b>Enter NEW Name for {c_name}:</b>")).text)
                            cur.execute("UPDATE stock SET country_name=? WHERE country_name=?", (new_name, c_name))
                            cur.execute("UPDATE auto_prices SET country=? WHERE country=?", (new_name, c_name))
                            db.commit()
                            await bot.send_message(uid, f"✅ Country '{c_name}' successfully renamed to '{new_name}'!")
                        elif m_act == "flag":
                            new_flag = html.escape((await get_reply(f"🏳️ <b>Enter NEW Flag Emoji for {c_name}:</b>")).text)
                            cur.execute("UPDATE stock SET country_icon=? WHERE country_name=?", (new_flag, c_name))
                            db.commit()
                            await bot.send_message(uid, f"✅ Flag updated to {new_flag} for '{c_name}'!")
                        elif m_act == "cprice":
                            new_p = int((await get_reply(f"💰 <b>Enter NEW Common Price for all {c_name} accounts:</b>")).text)
                            cur.execute("UPDATE stock SET price=? WHERE country_name=?", (new_p, c_name))
                            db.commit()
                            await bot.send_message(uid, f"✅ All existing '{c_name}' accounts updated to ₹{new_p}!")
                        elif m_act == "yprice":
                            year = parts[3]
                            new_p = int((await get_reply(f"💰 <b>Enter NEW Price for {c_name} ({year}):</b>")).text)
                            cur.execute("UPDATE stock SET price=? WHERE country_name=? AND account_year=?", (new_p, c_name, year))
                            db.commit()
                            await bot.send_message(uid, f"✅ All existing '{c_name}' ({year}) accounts updated to ₹{new_p}!")

                    elif action.startswith("apset|") and has_perm(uid, 'p_manage_stock'):
                        parts = action.split("|")
                        c_name, year = parts[1], parts[2]
                        new_p = int((await get_reply(f"🤖 <b>Enter Auto-Price for {c_name} ({year}):</b>\n<i>(Enter 0 to remove this auto-price)</i>")).text)
                        if new_p == 0:
                            cur.execute("DELETE FROM auto_prices WHERE country=? AND year=?", (c_name, year))
                            await bot.send_message(uid, f"✅ Auto-Price for {c_name} ({year}) removed!")
                        else:
                            cur.execute("INSERT OR REPLACE INTO auto_prices (country, year, price) VALUES (?,?,?)", (c_name, year, new_p))
                            await bot.send_message(uid, f"✅ Auto-Price for {c_name} ({year}) set to ₹{new_p}! Incoming accounts will use this price automatically.")
                        db.commit()

                    elif action == "addpay" and has_perm(uid, 'p_settings'):
                        name = html.escape((await get_reply(f"💳 <b>Enter Payment Method Name:</b>")).text)
                        qr_msg = await get_reply(f"📸 <b>Send QR Code Image (Or type 'skip'):</b>")
                        qr_path = ""
                        if qr_msg.photo:
                            qr_path = f"qr_{int(time.time())}.jpg"
                            await bot.download_media(qr_msg, qr_path)
                        cap_msg = (await get_reply(f"📜 <b>Enter Payment Caption:</b>")).text
                        cap_msg = html.escape(cap_msg).replace("&lt;code&gt;", "<code>").replace("&lt;/code&gt;", "</code>")
                        cur.execute("INSERT INTO custom_payments (name, caption, qr_file_id) VALUES (?,?,?)", (name, cap_msg, qr_path))
                        db.commit()
                        await bot.send_message(uid, f"✅ Payment Method '{name}' added successfully!")

                    elif action == "delpay" and has_perm(uid, 'p_settings'):
                        rows = cur.execute("SELECT id, name FROM custom_payments").fetchall()
                        if not rows: return await bot.send_message(uid, f"❌ No custom payment methods.")
                        msg = f"📜 <b>Reply with the ID of the method to delete:</b>\n\n"
                        for r in rows: msg += f"ID: {r[0]} - {r[1]}\n"
                        del_id = int((await get_reply(msg)).text)
                        file_path = cur.execute("SELECT qr_file_id FROM custom_payments WHERE id=?", (del_id,)).fetchone()
                        if file_path and file_path[0] and os.path.exists(file_path[0]): os.remove(file_path[0])
                        cur.execute("DELETE FROM custom_payments WHERE id=?", (del_id,))
                        db.commit()
                        await bot.send_message(uid, f"✅ Deleted!")

                    elif action == "addzip" and has_perm(uid, 'p_add_stock'):
                        tier_prompt = (
                            "🏷️ <b>Select Quality Tier for this ZIP upload:</b>\n\n"
                            "1️⃣ Reply <b>1</b> or <b>good</b> for 🟢 Good Quality\n"
                            "2️⃣ Reply <b>2</b> or <b>cheap</b> for 🟡 Cheap Quality\n\n"
                            "<i>(Default is Good Quality)</i>"
                        )
                        tier_reply = (await get_reply(tier_prompt)).text.strip().lower()
                        upload_tier = "cheap" if tier_reply in ("2", "cheap", "c") else "good"
                        tier_badge = "🟡 Cheap Quality" if upload_tier == "cheap" else "🟢 Good Quality"
                        await bot.send_message(uid, f"Selected Quality Tier: <b>{tier_badge}</b>")

                        resp = await get_reply(f"📦 <b>Send the ZIP file containing <code>.session</code> files:</b>")
                        if not resp.file or not (resp.file.name or "").lower().endswith('.zip'):
                            return await bot.send_message(uid, f"❌ Invalid file.")

                        await bot.send_message(uid, f"⏳ <b>Extracting & Scanning Accounts...</b>")
                        os.makedirs("sessions", exist_ok=True)
                        zip_path = await bot.download_media(resp, "temp_sessions.zip")
                        if not zip_path or not os.path.exists(zip_path):
                            return await bot.send_message(uid, f"❌ Could not download ZIP file.")

                        extracted_dir = f"temp_extracted_{int(time.time())}"
                        os.makedirs(extracted_dir, exist_ok=True)
                        try:
                            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                                for member in zip_ref.infolist():
                                    target = os.path.abspath(os.path.join(extracted_dir, member.filename))
                                    if not target.startswith(os.path.abspath(extracted_dir) + os.sep):
                                        raise ValueError("Unsafe ZIP path detected")
                                zip_ref.extractall(extracted_dir)

                            groups = {};scan_failures=[];seen_phones=set()
                            for root, _, files in os.walk(extracted_dir):
                                for file in files:
                                    if not file.casefold().endswith(".session"):
                                        continue
                                    sess_path = os.path.join(root, file)
                                    if not sess_path.endswith(".session"):
                                        normalized_path=sess_path[:-8]+".session"
                                        os.replace(sess_path,normalized_path);sess_path=normalized_path
                                    clean_path = sess_path[:-8]
                                    client = None
                                    try:
                                        dyn_id, dyn_hash = get_random_api_credentials()
                                        client = TelegramClient(clean_path, dyn_id, dyn_hash)
                                        await client.connect()
                                        if not await client.is_user_authorized():
                                            scan_failures.append(f"{file}: unauthorized/dead session")
                                            continue
                                        me = await client.get_me()
                                        phone = getattr(me, 'phone', None)
                                        if not phone:
                                            scan_failures.append(f"{file}: account has no phone")
                                            continue
                                        phone=str(phone).lstrip('+')
                                        if phone in seen_phones:
                                            scan_failures.append(f"{file}: duplicate +{phone}")
                                            continue
                                        seen_phones.add(phone)

                                        c_name, c_icon, _ = get_country_info(phone)
                                        pwd = await client(GetPasswordRequest())
                                        has_2fa = pwd.has_password
                                        year = await detect_account_year(client)

                                        key = (c_name, year, has_2fa)
                                        if key not in groups:
                                            groups[key] = []
                                        groups[key].append({"phone": phone, "path": clean_path, "c_icon": c_icon})
                                    except Exception as ex:
                                        logger.error("Session scan failed for %s: %s: %s", file, type(ex).__name__, ex)
                                        detail=" ".join(str(ex).split())[:120]
                                        scan_failures.append(f"{file}: {type(ex).__name__}{': '+detail if detail else ''}")
                                    finally:
                                        if client and client.is_connected():
                                            await client.disconnect()

                            for key in list(groups.keys()):
                                if key[0] == "Unknown":
                                    sample_phone = groups[key][0]["phone"]
                                    await bot.send_message(uid, f"⚠️ <b>Country not recognized for +{sample_phone}!</b>")
                                    new_icon = html.escape((await get_reply(f"🏳️ <b>Enter Country Flag Emoji:</b>")).text)
                                    new_name = html.escape((await get_reply(f"🌍 <b>Enter Country Name:</b>")).text)
                                    new_key = (new_name, key[1], key[2])
                                    groups[new_key] = groups.pop(key)
                                    for acc in groups[new_key]:
                                        acc["c_icon"] = new_icon

                            success = 0
                            for (c_name, year, has_2fa), accs in groups.items():
                                c_icon = accs[0]["c_icon"]
                                twofa_pass = "None"
                                if has_2fa:
                                    twofa_pass = html.escape((await get_reply(f"🔐 <b>Enter 2FA Password for {len(accs)}x {c_name} accounts:</b>")).text)
                                auto_row = cur.execute("SELECT price FROM auto_prices WHERE country=? AND year=?", (c_name, str(year))).fetchone()
                                if not auto_row:
                                    auto_row = cur.execute("SELECT price FROM auto_prices WHERE country=? AND year='Common'", (c_name,)).fetchone()
                                if auto_row:
                                    price = auto_row[0]
                                    await bot.send_message(uid, f"⚡ <b>Auto-Price Applied:</b> {len(accs)}x {c_name} ({year}) at ₹{price}.")
                                else:
                                    existing_price = cur.execute("SELECT price FROM stock WHERE country_name=? LIMIT 1", (c_name,)).fetchone()
                                    if existing_price:
                                        price = existing_price[0]
                                        await bot.send_message(uid, f"⚡ <b>Auto-Added:</b> {len(accs)}x {c_name} at ₹{price} (Copied from DB).")
                                    else:
                                        price = int((await get_reply(f"📌 Found {len(accs)}x {c_name} ({year}).\n💰 Enter Price (₹):")).text)

                                for acc in accs:
                                    perm_base = os.path.join("sessions", str(acc['phone']))
                                    for ext in ['.session', '.session-wal', '.session-shm', '.session-journal']:
                                        source_path = acc['path'] + ext
                                        if os.path.exists(source_path):
                                            os.replace(source_path, perm_base + ext)
                                    cur.execute("INSERT OR REPLACE INTO stock (phone, session_file, country_name, country_icon, account_year, category, price, available, twofa, quality_tier) VALUES (?,?,?,?,?,?,?,?,?,?)",
                                                (acc['phone'], perm_base + ".session", c_name, c_icon, year, 'Good', price, 1, twofa_pass, upload_tier))
                                    success += 1
                            db.commit()
                            summary=f"✅ <b>Bulk Interactive Upload Complete!</b>\n🟢 Added: {success} ({tier_badge})\n🔴 Skipped: {len(scan_failures)}"
                            if scan_failures:summary += "\n\n<pre>"+html.escape("\n".join(scan_failures[:20]))+"</pre>"
                            await bot.send_message(uid,summary)
                        finally:
                            if os.path.exists(zip_path):
                                os.remove(zip_path)
                            if os.path.isdir(extracted_dir):
                                shutil.rmtree(extracted_dir)

                    elif action == "addstock" and has_perm(uid, 'p_add_stock'):
                        tier_prompt = (
                            "🏷️ <b>Select Quality Tier for this account:</b>\n\n"
                            "1️⃣ Reply <b>1</b> or <b>good</b> for 🟢 Good Quality\n"
                            "2️⃣ Reply <b>2</b> or <b>cheap</b> for 🟡 Cheap Quality\n\n"
                            "<i>(Default is Good Quality)</i>"
                        )
                        tier_reply = (await get_reply(tier_prompt)).text.strip().lower()
                        upload_tier = "cheap" if tier_reply in ("2", "cheap", "c") else "good"
                        tier_badge = "🟡 Cheap Quality" if upload_tier == "cheap" else "🟢 Good Quality"
                        await bot.send_message(uid, f"Selected Quality Tier: <b>{tier_badge}</b>")

                        os.makedirs("sessions", exist_ok=True)
                        phone = (await get_reply(f"📱 Enter Phone (+919999...):")).text.replace(" ", "").replace("+", "")
                        sp = f"sessions/{phone}"

                        dyn_id, dyn_hash = get_random_api_credentials()
                        client = TelegramClient(sp, dyn_id, dyn_hash)
                        await client.connect()
                        sreq = await client.send_code_request(phone)
                        twofa_pass = "None"
                        try:
                            await client.sign_in(phone, (await get_reply(f"🔢 OTP:")).text, phone_code_hash=sreq.phone_code_hash)
                        except SessionPasswordNeededError:
                            twofa_pass = html.escape((await get_reply(f"🔐 2FA Pass required. Enter it now:")).text)
                            await client.sign_in(password=twofa_pass)

                        c_name, c_icon, _ = get_country_info(phone)
                        if c_name == "Unknown":
                            await bot.send_message(uid, f"⚠️ <b>Country not recognized for +{phone}!</b>")
                            c_icon = html.escape((await get_reply(f"🏳️ <b>Enter Country Flag Emoji:</b>")).text)
                            c_name = html.escape((await get_reply(f"🌍 <b>Enter Country Name:</b>")).text)

                        auto_year = await detect_account_year(client)
                        await client.disconnect()

                        year = int((await get_reply(f"📅 Detected Year: <b>{auto_year}</b>\nReply with Year to confirm or change:")).text)
                        auto_row = cur.execute("SELECT price FROM auto_prices WHERE country=? AND year=?", (c_name, str(year))).fetchone()
                        if not auto_row: auto_row = cur.execute("SELECT price FROM auto_prices WHERE country=? AND year='Common'", (c_name,)).fetchone()

                        if auto_row:
                            price = auto_row[0]
                            await bot.send_message(uid, f"⚡ <b>Auto-Price Applied:</b> ₹{price} for {c_name} ({year})")
                        else:
                            existing_price = cur.execute("SELECT price FROM stock WHERE country_name=? LIMIT 1", (c_name,)).fetchone()
                            if existing_price:
                                price = existing_price[0]
                                await bot.send_message(uid, f"⚡ <b>Auto-detected Price:</b> ₹{price} for {c_name}")
                            else: price = int((await get_reply(f"💰 Price (₹):")).text)

                        cur.execute("INSERT OR REPLACE INTO stock (phone, session_file, country_name, country_icon, account_year, category, price, available, twofa, quality_tier) VALUES (?,?,?,?,?,?,?,?,?,?)",
                                    (phone, sp + ".session", c_name, c_icon, year, 'Good', price, 1, twofa_pass, upload_tier))
                        db.commit()
                        await bot.send_message(uid, f"✅ Added to {tier_badge}!")

                    elif action == "supporturl" and has_perm(uid, 'p_settings'):
                        url = (await get_reply("🔗 Enter new Support URL:")).text
                        if not url.startswith("http"): url = "https://" + url.replace("@", "t.me/")
                        cur.execute("UPDATE settings SET value=? WHERE key='support_url'", (url,))
                        db.commit()
                        await bot.send_message(uid, f"✅ Support URL updated.")

                    elif action == "bcast" and has_perm(uid, 'p_stats'):
                        msg_obj = await get_reply(f"📜 <b>Send Message/Media for Broadcast:</b>")
                        txt = msg_obj.text or ""
                        media = msg_obj.media
                        btn_name = (await get_reply("🔘 <b>Button Name (or 'skip'):</b>")).text
                        url = (await get_reply("🔗 <b>URL:</b>")).text if btn_name.lower() != 'skip' else None
                        b_btns = [[p_btn(btn_name, url=url)]] if url else None
                        users = cur.execute("SELECT user_id FROM users").fetchall()
                        s, f = 0, 0
                        await bot.send_message(uid, f"✈️ Broadcasting...")
                        for (u_id,) in users:
                            try:
                                await bot.send_message(int(u_id), txt, file=media, buttons=b_btns, parse_mode='html')
                                s += 1
                            except: f += 1
                            await asyncio.sleep(0.1)
                        await bot.send_message(uid, f"✅ Done! Sent: {s} | Failed: {f}")

                    elif action == "bal" and has_perm(uid, 'p_bal'):
                        t_uid = int((await get_reply(f"👤 <b>User ID:</b>")).text)
                        amt = int((await get_reply(f"💰 <b>Amount (Negative to deduct):</b>")).text)
                        update_balance(t_uid, amt)
                        await bot.send_message(uid, f"✅ Added ₹{amt} to {t_uid}.")

                    elif action == "discount" and has_perm(uid, 'p_settings'):
                        t_uid = int((await get_reply(f"👤 <b>User ID:</b>")).text)
                        server_no = int((await get_reply("🖥 <b>Server number:</b> send 1, 2, 3, 4, or 5.")).text)
                        if server_no not in (1, 2, 3, 4, 5):
                            raise ValueError("Server number must be 1–5")
                        pct = max(0, min(100, int((await get_reply(f"🎁 <b>Discount % (0 to remove):</b>")).text)))
                        if pct:
                            cur.execute("INSERT OR REPLACE INTO user_server_discounts(user_id,server_no,discount_percent,updated_at) VALUES(?,?,?,?)", (t_uid, server_no, pct, datetime.now(timezone.utc).isoformat()))
                        else:
                            cur.execute("DELETE FROM user_server_discounts WHERE user_id=? AND server_no=?", (t_uid, server_no))
                        if server_no == 1:
                            cur.execute("UPDATE users SET discount=? WHERE user_id=?", (pct, t_uid))
                        db.commit()
                        await bot.send_message(uid, f"✅ User {t_uid} has {pct}% discount on Server {server_no}.")

                    elif action == "createpromo" and has_perm(uid, 'p_settings'):
                        amount = int((await get_reply(f"🎁 <b>Promo amount:</b>\nEnter how much balance each redeem should add.")).text)
                        if amount <= 0:
                            raise ValueError("Promo amount must be greater than zero")
                        max_uses = int((await get_reply(f"🔢 <b>Max redeems:</b>\nEnter how many users can redeem this promo code.")).text)
                        if max_uses <= 0:
                            raise ValueError("Max redeems must be greater than zero")
                        code = "PROMO" + ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(8))
                        while cur.execute("SELECT 1 FROM promo_codes WHERE code=?", (code,)).fetchone():
                            code = "PROMO" + ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(8))
                        cur.execute("INSERT INTO promo_codes (code, value, max_uses, used_count) VALUES (?,?,?,0)", (code, amount, max_uses))
                        db.commit()
                        await bot.send_message(uid, f"✅ <b>Promo code created!</b>\n\nCode: <code>{code}</code>\nAmount: ₹{amount}\nMax redeems: {max_uses}")

                    elif action == "ban" and has_perm(uid, 'p_bal'):
                        t_uid = int((await get_reply("🚫 <b>User ID to ban/unban:</b>")).text)
                        ensure_user(t_uid)
                        row = cur.execute("SELECT banned FROM users WHERE user_id=?", (t_uid,)).fetchone()
                        new_status = 0 if row and row[0] else 1
                        cur.execute("UPDATE users SET banned=? WHERE user_id=?", (new_status, t_uid))
                        db.commit()
                        await bot.send_message(uid, f"✅ User <code>{t_uid}</code> is now {'BANNED' if new_status else 'UNBANNED'}.")

                    elif action == "autoprice_set" and has_perm(uid, 'p_manage_stock'):
                        country = html.escape((await get_reply("🌍 <b>Country name:</b>\nUse exact country name, e.g. India")).text.strip())
                        year = html.escape((await get_reply("📅 <b>Year:</b>\nSend a year like 2024 or Common")).text.strip())
                        price = int((await get_reply("💰 <b>Auto price:</b> Send 0 to remove")).text)
                        if price <= 0:
                            cur.execute("DELETE FROM auto_prices WHERE country=? AND year=?", (country, year))
                            msg = f"✅ Removed auto price for {country} ({year})."
                        else:
                            cur.execute("INSERT OR REPLACE INTO auto_prices (country, year, price) VALUES (?,?,?)", (country, year, price))
                            msg = f"✅ Auto price set: {country} ({year}) = ₹{price}."
                        db.commit()
                        await bot.send_message(uid, msg)

                    elif action == "creategiveaway" and has_perm(uid, 'p_settings'):
                        prize = html.escape((await get_reply("🎁 <b>Prize name:</b>")).text.strip())
                        ticket_price = int((await get_reply("💸 <b>Ticket price:</b>")).text)
                        min_participants = int((await get_reply("👥 <b>Minimum participants needed:</b>")).text)
                        winners_count = int((await get_reply("🏆 <b>Number of winners:</b>")).text)
                        if ticket_price <= 0 or min_participants <= 0 or winners_count <= 0:
                            raise ValueError("Ticket price, participants, and winners must be greater than zero")
                        gid = f"Giv_{random.randint(1000, 9999)}"
                        while cur.execute("SELECT 1 FROM giveaways WHERE id=?", (gid,)).fetchone():
                            gid = f"Giv_{random.randint(1000, 9999)}"
                        cur.execute("INSERT INTO giveaways (id, prize_name, ticket_price, min_participants, winners_count, status, created_by) VALUES (?,?,?,?,?,'open',?)", (gid, prize, ticket_price, min_participants, winners_count, uid))
                        db.commit()
                        me = await bot.get_me()
                        link = f"https://t.me/{me.username}?start={gid}"
                        await bot.send_message(uid, f"✅ <b>Giveaway created</b>\n\nPrize: <b>{prize}</b>\nTicket: ₹{ticket_price}\nNeed participants: {min_participants}\nWinners: {winners_count}\nLink: <code>{link}</code>", buttons=[[p_btn("Open Giveaway", url=link)]])

                    elif action == "refsettings" and has_perm(uid, 'p_settings'):
                        minimum=fampay_setting("ref_topup_min", "0"); reward=fampay_setting("ref_reward", "0")
                        min_m=fampay_setting("reseller_min_margin", "5"); max_m=fampay_setting("reseller_max_margin", "50")
                        msg = (f"👥 <b>Referral & Reseller Settings</b>\n\n"
                               f"🎁 Qualifying top-up: ₹{minimum}\n"
                               f"💵 Fixed reward: ₹{reward}\n\n"
                               f"💼 <b>Reseller Custom Margin Limits:</b>\n"
                               f"• Minimum allowed margin: <b>{min_m}%</b>\n"
                               f"• Maximum allowed margin: <b>{max_m}%</b>")
                        buttons=[
                            [p_btn("Set Top-up Needed", "adm_ref_topup"), p_btn("Set Reward on Deposit", "adm_ref_reward")],
                            [p_btn("Set Min Reseller %", "adm_resell_min"), p_btn("Set Max Reseller %", "adm_resell_max")],
                            [p_btn("Back", "adm_adminmain")]
                        ]
                        await e.edit(msg, buttons=buttons)
                    elif action in ("ref_topup", "ref_reward", "ref_withdraw", "resell_min", "resell_max") and has_perm(uid, 'p_settings'):
                        payment_admin_state[uid]={"step": action}
                        labels={
                            "ref_topup":"minimum top-up required for a referral reward in ₹",
                            "ref_reward":"fixed referral reward in ₹",
                            "ref_withdraw":"minimum referral withdrawal in ₹",
                            "resell_min":"minimum reseller margin percentage (e.g. 5)",
                            "resell_max":"maximum reseller margin percentage (e.g. 50)"
                        }
                        await e.edit(f"Send the {labels[action]} (whole number).",buttons=[[p_btn("Cancel","adm_refsettings")]])

                    elif action == "usdtrate" and has_perm(uid, 'p_settings'):
                        r = float((await get_reply(f"💲 <b>Enter 1$ = how much INR?</b>")).text)
                        cur.execute("UPDATE settings SET value=? WHERE key='usdt_rate'", (str(r),))
                        db.commit()
                        await bot.send_message(uid, f"✅ Rate set to {r}.")

                except ConversationCancelled:
                    await bot.send_message(uid, f"❌ Cancelled.")
                except asyncio.TimeoutError:
                    await bot.send_message(uid, f"⏰ Timed out. Please click the button again and reply within 10 minutes.")
                except ValueError as ve:
                    await bot.send_message(uid, f"⚠️ Invalid input: <code>{html.escape(str(ve))}</code>")
                except Exception as ex:
                    await send_admin_error(f"Internal Conversation Error (Action: {action})", str(ex))
                    await bot.send_message(uid, f"❌ System was unable to process this request.")

        elif data.startswith("wd_act|") and is_admin(uid):
            _, action, wd_id = data.split("|")
            wd_id = int(wd_id)
            row = cur.execute("SELECT user_id, amount, status FROM withdrawals WHERE id=?", (wd_id,)).fetchone()
            if not row or row[2] != 'pending': return await e.edit("⚠️ Already processed.")

            t_uid, amt = row[0], row[1]
            if action == "app":
                cur.execute("UPDATE withdrawals SET status='approved' WHERE id=?", (wd_id,))
                db.commit()
                await e.edit(f"✅ Approved Withdrawal #{wd_id} for ₹{amt}.")
                try: await bot.send_message(t_uid, f"✅ Your manual payment of ₹{amt} has been approved and credited.")
                except: pass
            else:
                cur.execute("UPDATE users SET sales_balance = sales_balance + ? WHERE user_id=?", (amt, t_uid))
                cur.execute("UPDATE withdrawals SET status='rejected' WHERE id=?", (wd_id,))
                db.commit()
                await e.edit(f"❌ Rejected Withdrawal #{wd_id} for ₹{amt}. Refunded back to profile.")
                try: await bot.send_message(t_uid, f"❌ Your deposit transaction was rejected by admin review.")
                except: pass

        # --- ADMIN DEPOSIT ACTION HANDLER ---
        elif data.startswith("dep_act|") and is_admin(uid):
            _, d_type, action, order_id, t_uid, amt = data.split("|")
            t_uid, amt = int(t_uid), int(float(amt))

            if action == "custom":
                await render_admin_review_keypad(e, t_uid, order_id, d_type, str(amt) if amt else "")
                return

            if d_type == "man":
                if action == "app":
                    req_row = cur.execute("SELECT amount FROM deposits WHERE id=?", (order_id.replace("M", ""),)).fetchone()
                    real_amt = req_row[0] if req_row else 0
                    update_balance(t_uid, real_amt)
                    cur.execute("UPDATE users SET total_deposited = total_deposited + ? WHERE user_id=?", (real_amt, t_uid))
                    cur.execute("UPDATE deposits SET status='success' WHERE id=?", (order_id.replace("M", ""),))
                    db.commit()
                    await log_primary_deposit(t_uid, real_amt, "MANUAL (Approved)")
                    await bot.send_message(t_uid, f"✅ Your manual payment of ₹{real_amt} has been approved and credited.")
                    await e.edit(f"✅ Approved and credited ₹{real_amt} to user <code>{t_uid}</code>!")
                else:
                    cur.execute("UPDATE deposits SET status='rejected' WHERE id=?", (order_id.replace("M", ""),))
                    db.commit()
                    await bot.send_message(t_uid, f"❌ Your deposit transaction was rejected by admin review.")
                    await e.edit(f"❌ Rejected deposit proof for user <code>{t_uid}</code>.")

    except Exception as ex:
        await send_admin_error("Global Callback Handler Failure", f"User: {uid}\nData: {data}\n\n{ex}")
        await safe_answer_cb(e, "An error occurred. The support team has been notified.", alert=True)


@bot.on(events.NewMessage(pattern=r"(?i)^/fight(?:\s+(\d+))?"))
async def handle_fight_command(e):
    uid = e.sender_id
    if not is_private_event(e) and not is_admin(uid):
        return await e.reply("Please use this bot in private chat only.")
    if not is_method_on("fight_game_status"):
        return await e.reply("❌ Fight game is disabled.")
    match = e.pattern_match
    if not match or not match.group(1):
        return await e.reply("Usage: <code>/fight 10</code>")
    amount = int(match.group(1))
    if amount <= 0:
        return await e.reply("❌ Amount must be greater than zero.")
    ensure_user(uid)
    async with get_user_lock(uid):
        bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
        if bal < amount:
            return await e.reply(f"❌ Insufficient balance. Need ₹{amount}, current ₹{bal}.")
        cur.execute("UPDATE users SET balance = balance - ? WHERE user_id=? AND balance >= ?", (amount, uid, amount))
        if cur.rowcount == 0:
            return await e.reply("❌ Balance changed. Try again.")
        db.commit()
    try:
        ent = await bot.get_entity(uid)
        name = html.escape(ent.first_name or "Player")
    except Exception:
        name = f"User_{uid}"
    fight_id = f"FGT_{uid}_{int(time.time())}"
    active_fights[fight_id] = {"initiator_id": uid, "initiator_name": name, "amount": amount, "reward": amount * 2, "initiator_paid": True}
    await e.reply(
        f"⚔️ <b>Fight Started!</b>\n\n{name} paid ₹{amount}.\nWinner gets ₹{amount * 2}.\nClick below to join.",
        buttons=[[p_btn(f"Join Fight ₹{amount}", f"join_fight|{fight_id}|{uid}|{amount}")]]
    )

@bot.on(events.NewMessage(pattern=r"(?i)^/giveaway(?:\s+(\d+))?(?:\s+(\d+))?"))
async def handle_giveaway_command(e):
    uid = e.sender_id
    if not is_private_event(e) and not is_admin(uid):
        return await e.reply("Please use this bot in private chat only.")
    if not is_admin(uid):
        return await e.reply("Admins only.")
    match = e.pattern_match
    if not match or not match.group(1) or not match.group(2):
        return await e.reply("Usage: <code>/giveaway &lt;ticket_price&gt; &lt;participants&gt;</code>")
    ticket_price = int(match.group(1))
    min_participants = int(match.group(2))
    if ticket_price <= 0 or min_participants <= 0:
        return await e.reply("❌ Values must be greater than zero.")
    gid = f"Giv_{random.randint(1000, 9999)}"
    while cur.execute("SELECT 1 FROM giveaways WHERE id=?", (gid,)).fetchone():
        gid = f"Giv_{random.randint(1000, 9999)}"
    cur.execute("INSERT INTO giveaways (id, prize_name, ticket_price, min_participants, winners_count, status, created_by) VALUES (?,?,?,?,1,'open',?)", (gid, "Giveaway Prize", ticket_price, min_participants, uid))
    db.commit()
    me = await bot.get_me()
    link = f"https://t.me/{me.username}?start={gid}"
    await e.reply(f"🎁 <b>Giveaway Created</b>\n\nTicket: ₹{ticket_price}\nNeed participants: {min_participants}\nLink: <code>{link}</code>", buttons=[[p_btn("Open Giveaway", url=link)]])

@bot.on(events.NewMessage())
async def handle_text_inputs(e):
    uid = e.sender_id
    if not is_private_event(e) and not is_admin(uid):
        return
    if getattr(e, 'text', None) and e.text.startswith('/'): return
    text = e.text or ""

    if uid in smm_state:
        state=smm_state[uid]
        if state['step']=='search':
            query=' '.join(text.strip().split())
            if not query:return await e.reply("Send a service name or ID.")
            class ReplyEvent:
                async def edit(self,message,buttons=None,**kwargs):return await e.reply(message,buttons=buttons,**kwargs)
            smm_state.pop(uid,None);return await render_smm_search(ReplyEvent(),uid,query,1)
        if state['step']=='link':
            # Providers accept many target formats. Do not reject valid links
            # locally; only remove invisible Telegram copy/paste controls.
            try:link=normalize_smm_target(text)
            except ValueError:return await e.reply("❌ Send a non-empty target under 2,000 characters.")
            state.update(step='quantity',link=link)
            row=[r for r in smm_service_rows(limit=100000) if r['id']==state['service_id']][0]
            return await e.reply(f"Send quantity ({row['minimum']}–{row['maximum']}).")
        if state['step']=='quantity':
            if not text.strip().isdigit():return await e.reply("❌ Quantity must be a whole number.")
            quantity=int(text);sid=state['service_id']
            try:q=smm_quote(sid,quantity)
            except (ValueError,SMMError) as exc:return await e.reply(f"❌ {html.escape(str(exc))}")
            q_charge=apply_server_discount(uid,5,q.charge)
            row=[r for r in smm_service_rows(limit=100000) if r['id']==sid][0];per_thousand=apply_server_discount(uid,5,smm_quote(sid,1000,enforce_limits=False).charge);balance=cur.execute("SELECT balance FROM users WHERE user_id=?",(uid,)).fetchone()[0]
            request_id=secrets.token_urlsafe(18);state.update(step='confirm',quantity=quantity,request_id=request_id)
            return await e.reply(f"🛒 <b>Confirm Order</b>\n\nService: {html.escape(row['name'])}\nRate: <b>₹{format_smm_money(per_thousand)} per 1000</b>\nQuantity: {quantity}\nTarget: <code>{html.escape(state['link'])}</code>\nFinal Charge: <b>₹{format_smm_money(q_charge)}</b>{discount_label(uid,5)}\nBalance: ₹{balance}\n\nConfirm to place this order.",buttons=[[p_btn("✅ Confirm Order",f"smm_confirm|{sid}|{quantity}|{request_id}",style="success")],[p_btn("❌ Cancel","smm_back_services",style="danger")]])

    if uid in fampay_review_state:
        state=fampay_review_state[uid];reference=state["reference"]
        if state["step"]=="screenshot":
            if not getattr(e,"photo",None):
                return await e.reply("❌ Send a clear payment-success screenshot as a photo.",buttons=[[p_btn("Cancel Review",f"fampay_review_cancel|{reference}")]])
            cur.execute("""UPDATE fampay_orders SET review_status='draft',review_screenshot_msg_id=?,updated_at=?
              WHERE reference=? AND user_id=? AND status='expired' AND check_count>0""",(e.id,datetime.now(timezone.utc).isoformat(),reference,uid));db.commit()
            if cur.rowcount!=1:fampay_review_state.pop(uid,None);return await e.reply("This deposit is no longer eligible for review.")
            state["step"]="utr"
            return await e.reply("✅ Screenshot saved.\n\nNow send the UTR or transaction ID shown in your payment app.",buttons=[[p_btn("Cancel Review",f"fampay_review_cancel|{reference}")]])
        if state["step"]=="confirm":
            return await e.reply("Use Submit Review or Cancel on the confirmation message.")
        utr=re.sub(r"\s+","",text).upper()
        if not re.fullmatch(r"[A-Z0-9_-]{6,64}",utr):
            return await e.reply("❌ Send a valid 6–64 character UTR or transaction ID.")
        duplicate=cur.execute("SELECT 1 FROM fampay_orders WHERE reference<>? AND (transaction_id=? OR (review_utr=? AND review_status IN ('draft','pending','approved')))",(reference,utr,utr)).fetchone()
        if duplicate:return await e.reply("❌ This UTR or transaction ID is already attached to another deposit.")
        cur.execute("UPDATE fampay_orders SET review_utr=?,updated_at=? WHERE reference=? AND user_id=? AND review_status='draft'",(utr,datetime.now(timezone.utc).isoformat(),reference,uid));db.commit()
        if cur.rowcount!=1:fampay_review_state.pop(uid,None);return await e.reply("This review is no longer available.")
        state["step"]="confirm"
        row=cur.execute("SELECT amount FROM fampay_orders WHERE reference=?",(reference,)).fetchone()
        return await e.reply(f"🧾 <b>Confirm Review Submission</b>\n\nReference: <code>{reference}</code>\nAmount: ₹{row[0]}\nUTR / TXN: <code>{html.escape(utr)}</code>\nScreenshot: ✅ Attached\n\nSubmit this payment for administrator review?",buttons=[[p_btn("✅ Submit Review",f"fampay_review_submit|{reference}",style="success")],[p_btn("❌ Cancel",f"fampay_review_cancel|{reference}",style="danger")]])

    direct_upload_result = await inspect_and_add_server2_session(uid, e)
    if direct_upload_result:
        return await e.reply(direct_upload_result)

    if uid in session_buy_state:
        st = session_buy_state.pop(uid, None)
        qty_text = text.strip()
        tier = st.get("tier", "good")
        if not qty_text.isdigit() or int(qty_text) <= 0:
            return await e.reply("❌ Send a valid quantity.", buttons=[[p_btn("Back", f"s2_yr|{tier}|{st['country']}")]])
        qty = int(qty_text)
        country, year, price = st["country"], int(st["year"]), int(st["price"])
        final_price = int(st.get("final_price", apply_server_discount(uid, 2, price)))
        available = cur.execute(
            "SELECT COUNT(*) FROM stock WHERE available=1 AND COALESCE(quality_tier, 'good')=? AND country_name LIKE ? AND account_year=? AND price=?",
            (tier, f"{country}%", year, price)
        ).fetchone()[0]
        if qty > available:
            return await e.reply(
                f"❌ Only <b>{available}</b> account(s) are available for this selection.",
                buttons=[[p_btn("Choose Again", f"s2_yr|{tier}|{country}"), p_btn("Cancel", "s2_qty_cancel")]]
            )
        bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
        total = qty * final_price
        tier_label = "🟢 Good Quality" if tier == "good" else "🟡 Cheap Quality"
        msg = (f"{P_STORE} <b>Confirm Server 2 Buy Session</b>\n\n"
               f"🏷️ <b>Quality:</b> {tier_label}\n"
               f"🏳️ <b>Country:</b> {country}\n"
               f"{P_CAL} <b>Year:</b> {year}\n"
               f"📦 <b>Quantity:</b> {qty}\n"
               f"{P_CASH} <b>Each:</b> {format_price(uid, final_price)}{discount_label(uid,2)}\n"
               f"💳 <b>Total:</b> {format_price(uid, total)}\n"
               f"💰 <b>Balance:</b> {format_price(uid, bal)}")
        if bal < total:
            return await e.reply(msg + "\n\n❌ <b>Insufficient balance.</b>", buttons=[[p_btn("Recharge", "menu_deposit"), p_btn("Cancel", "s2_qty_cancel")]])
        return await e.reply(msg, buttons=[[p_btn("✅ Confirm Buy", f"s2_qty_confirm|{tier}|{country}|{year}|{price}|{final_price}|{qty}")], [p_btn("❌ Cancel", "s2_qty_cancel")]])

    if uid in reseller_state and reseller_state[uid] == "wait_margin":
        reseller_state.pop(uid, None)
        val = text.strip().replace("%", "")
        min_m_row = cur.execute("SELECT value FROM settings WHERE key='reseller_min_margin'").fetchone()
        max_m_row = cur.execute("SELECT value FROM settings WHERE key='reseller_max_margin'").fetchone()
        min_m = int(min_m_row[0]) if min_m_row else 5
        max_m = int(max_m_row[0]) if max_m_row else 50
        if not val.isdigit() or not (min_m <= int(val) <= max_m):
            return await e.reply(
                f"❌ Please enter a valid whole percentage between <b>{min_m}%</b> and <b>{max_m}%</b>.",
                buttons=[[p_btn("Try Again", "reseller_set_margin"), p_btn("Back", "menu_reseller")]]
            )
        margin_pct = int(val)
        existing = cur.execute("SELECT token FROM reseller_links WHERE user_id=?", (uid,)).fetchone()
        if existing:
            token = existing[0]
            cur.execute("UPDATE reseller_links SET margin_percent=? WHERE token=?", (margin_pct, token))
        else:
            token = secrets.token_hex(4).lower()
            cur.execute("INSERT INTO reseller_links (token, user_id, margin_percent) VALUES (?,?,?)", (token, uid, margin_pct))
        db.commit()
        me = await bot.get_me()
        link_url = f"https://t.me/{me.username}?start=resell_{token}"
        return await e.reply(
            f"✅ <b>Reseller Link Updated!</b>\n\n"
            f"📈 Your Profit Margin: <b>+{margin_pct}%</b>\n"
            f"🔗 Reseller Link:\n<code>{link_url}</code>\n\n"
            f"Share this link with your customers. You will automatically receive your +{margin_pct}% profit on every purchase they make!",
            buttons=[[p_btn("Reseller Dashboard", "menu_reseller"), p_btn("Main Menu", "menu_main")]]
        )

    if uid in giveaway_ticket_state:
        gid = giveaway_ticket_state.pop(uid, None)
        if not text.strip().isdigit() or int(text.strip()) <= 0:
            return await e.reply("❌ Send a valid ticket count.", buttons=[[p_btn("Back", f"g_open|{gid}")]])
        qty = int(text.strip())
        row = cur.execute("SELECT prize_name, ticket_price, status FROM giveaways WHERE id=?", (gid,)).fetchone()
        if not row or row[2] != "open":
            return await e.reply("❌ Giveaway is closed or missing.")
        total_cost = row[1] * qty
        async with get_user_lock(uid):
            bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
            if bal < total_cost:
                return await e.reply(f"❌ Need ₹{total_cost}. Current balance ₹{bal}.", buttons=[[p_btn("Back", f"g_open|{gid}")]])
            cur.execute("UPDATE users SET balance = balance - ? WHERE user_id=? AND balance >= ?", (total_cost, uid, total_cost))
            if cur.rowcount == 0:
                return await e.reply("❌ Balance changed. Try again.")
            cur.execute("INSERT INTO giveaway_tickets (giveaway_id, user_id, tickets) VALUES (?,?,?) ON CONFLICT(giveaway_id,user_id) DO UPDATE SET tickets=tickets+excluded.tickets", (gid, uid, qty))
            db.commit()
        await e.reply(f"✅ Bought {qty} ticket(s) for ₹{total_cost}.", buttons=[[p_btn("Open Giveaway", f"g_open|{gid}")]])
        await maybe_finish_giveaway(gid)
        return

    if uid in restore_state:
        if text.strip().lower() == "/cancel":
            restore_state.pop(uid, None)
            return await e.reply("❌ Restore cancelled.")
        if not is_admin(uid):
            restore_state.pop(uid, None)
            return
        if not getattr(e, "file", None):
            return await e.reply("❌ Send the backup .db file as a document.")
        restore_state.pop(uid, None)
        backup_current = f"otp_bot_pre_restore_{int(time.time())}.db"
        try:
            db.commit()
            shutil.copyfile("otp_bot_final.db", backup_current)
            incoming = await bot.download_media(e, f"restore_upload_{int(time.time())}.db")
            test = sqlite3.connect(incoming)
            test.execute("SELECT name FROM sqlite_master LIMIT 1").fetchone()
            test.close()
            shutil.copyfile(incoming, "otp_bot_final.db")
            os.remove(incoming)
            return await e.reply(f"✅ Restore file saved. Restart the bot process to load restored DB. Safety backup: <code>{backup_current}</code>")
        except Exception as ex:
            await send_admin_error("Restore failed", str(ex))
            return await e.reply("❌ Restore failed. Current DB was not replaced.")

    # SERVER 1 COUNTRY SEARCH
    if uid in lzt_search_state:
        lzt_search_state.pop(uid, None)
        matches = find_country_matches(text)
        if not matches:
            return await e.reply(
                "❌ No country matched that key. Try examples like <code>+91</code>, <code>Ind</code>, or <code>US</code>.",
                buttons=[[p_btn("Back", "srv_1_pg|1"), p_btn("Search Again", "lzt_search_country")]]
            )
        if len(matches) == 1:
            name = matches[0]
            iso_code = COUNTRY_CODES[name][0]
            return await e.reply(
                f"✅ Found <b>{COUNTRY_CODES[name][1]} {name}</b>. Opening Server 1 stock...",
                buttons=[[p_btn(f"Open {country_button_label(name, include_phone=False)}", f"lzt_chk|{iso_code}|1")], [p_btn("Back", "srv_1_pg|1")]]
            )
        btns, row = [], []
        for name in matches[:10]:
            iso_code, flag = COUNTRY_CODES[name]
            row.append(p_btn(country_button_label(name), f"lzt_chk|{iso_code}|1"))
            if len(row) == 2:
                btns.append(row)
                row = []
        if row:
            btns.append(row)
        btns.append([p_btn("Back", "srv_1_pg|1"), p_btn("Search Again", "lzt_search_country")])
        return await e.reply(f"🔎 Found {len(matches)} country matches. Choose one:", buttons=btns)

    # SERVER 3 SERVICE SEARCH
    if uid in server3_search_state:
        server3_search_state.discard(uid)
        query = " ".join(text.casefold().strip().split())
        if not query:
            server3_search_state.add(uid)
            return await e.reply("❌ Send a service name or code.")
        pattern = f"%{query}%"
        alias_codes = [code for code, (name, keywords) in SERVICE_CATALOG.items()
                       if query in f"{name} {keywords} {code}".casefold()]
        alias_pattern = f"%{alias_codes[0]}%" if alias_codes else pattern
        with managed_connect() as conn:
            rows = conn.execute("""SELECT s.service_code,s.name,MIN(s.provider_price) min_price,
              COUNT(DISTINCT s.server_code) server_count FROM server3_services s
              JOIN server3_servers v ON v.code=s.server_code
              WHERE s.enabled=1 AND s.in_stock=1 AND v.enabled=1
              AND (LOWER(s.service_code) LIKE ? OR LOWER(s.service_code) LIKE ? OR LOWER(s.name) LIKE ? OR LOWER(s.keywords) LIKE ?)
              GROUP BY s.service_code,s.name ORDER BY s.name LIMIT 30""", (pattern, alias_pattern, pattern, pattern)).fetchall()
        if not rows:
            return await e.reply("No available Server 3 service matched that search.", buttons=[[p_btn("Search Again", "srv3_search")], [p_btn("All Servers", "srv3_servers|1")]])
        cfg = server3.config()
        buttons=[]
        for row in rows:
            price=max(cfg.minimum_price,row["min_price"]*(1+cfg.percent_markup/100)+cfg.fixed_markup)
            buttons.append([p_btn(f"{row['name']} ({row['service_code']}) · {row['server_count']} server(s) · from ₹{int(round(price))}", f"srv3_variants|{row['service_code']}|1")])
        buttons.extend([[p_btn("Search Again", "srv3_search")], [p_btn("All Servers", "srv3_servers|1")]])
        return await e.reply(f"🔎 <b>{html.escape(managed_server_name(3))} Search</b>\n\nKeyword: <code>{html.escape(query)}</code>\nChoose a service to view available options.", buttons=buttons)

    # SERVER 4 COUNTRY SEARCH
    if uid in server4_country_search_state:
        operator=server4_country_search_state.pop(uid)
        query=" ".join(text.casefold().strip().split())
        if not query:
            server4_country_search_state[uid]=operator
            return await e.reply("❌ Send a country name or country code.")
        aliases=[name.casefold() for name,(iso,_flag) in COUNTRY_CODES.items() if iso.casefold()==query]
        patterns=[f"%{query}%"]+[f"%{alias}%" for alias in aliases]
        clauses=" OR ".join(["LOWER(c.name) LIKE ?"]*len(patterns)+["LOWER(c.country_code) LIKE ?"])
        params=[*patterns,f"%{query}%",operator]
        with managed_connect() as conn:
            rows=conn.execute(f"""SELECT c.country_code,c.name,COUNT(DISTINCT s.service_code) service_count,
              SUM(s.available_count) total_stock FROM server4_countries c JOIN server4_stock s
              ON s.operator_code=c.operator_code AND s.country_code=c.country_code
              WHERE ({clauses}) AND c.operator_code=? AND c.enabled=1 AND c.in_stock=1 AND s.available_count>0
              GROUP BY c.country_code,c.name ORDER BY c.name LIMIT 30""",params).fetchall()
        buttons=[[p_btn(f"{get_flag_by_country_name(row['name'])} {row['name']} · {row['service_count']} services · {row['total_stock']} available",f"srv4_services|{operator}|{row['country_code']}|1",style="success")] for row in rows]
        buttons.extend([[p_btn("Search Again",f"srv4_country_search|{operator}")],[p_btn("All Countries",f"srv4_countries|{operator}|1")]])
        return await e.reply(f"🔎 <b>Country Search</b>\nKeyword: <code>{html.escape(query)}</code>\n\nChoose a stocked country." if rows else "No stocked country matched that search.",buttons=buttons)

    # SERVER 4 SERVICE SEARCH
    if uid in server4_search_state:
        operator=server4_search_state.pop(uid)
        query=" ".join(text.casefold().strip().split())
        if not query:
            server4_search_state[uid]=operator
            return await e.reply("❌ Send a service name or code.")
        pattern=f"%{query}%";cfg=server4.config()
        with managed_connect() as conn:
            rows=conn.execute("""SELECT s.country_code,c.name country_name,s.service_code,v.name service_name,
              s.min_price,s.available_count FROM server4_stock s
              JOIN server4_countries c ON c.operator_code=s.operator_code AND c.country_code=s.country_code
              JOIN server4_services v ON v.operator_code=s.operator_code AND v.service_code=s.service_code
              WHERE s.operator_code=? AND s.available_count>0 AND c.enabled=1 AND v.enabled=1
              AND (LOWER(v.name) LIKE ? OR LOWER(v.service_code) LIKE ?)
              ORDER BY v.name,c.name LIMIT 40""",(operator,pattern,pattern)).fetchall()
        buttons=[]
        for row in rows:
            final=max(cfg.minimum_price,row['min_price']*(1+cfg.percent_markup/100)+cfg.fixed_markup)
            if not cfg.maximum_price or final<=cfg.maximum_price:
                buttons.append([p_btn(f"{get_flag_by_country_name(row['country_name'])} {row['country_name']} · {row['service_name']} · ₹{int(round(final))} · {row['available_count']}",f"srv4_quote|{operator}|{row['country_code']}|{row['service_code']}",style="success")])
        buttons.extend([[p_btn("Search Again",f"srv4_search|{operator}")],[p_btn("Countries",f"srv4_countries|{operator}|1")]])
        return await e.reply(f"🔎 <b>{html.escape(managed_server_name(4))} Search</b>\nKeyword: <code>{html.escape(query)}</code>" if rows else "No available service matched that search.",buttons=buttons)

    # MANAGED PROVIDER ADMIN INPUTS
    if uid in payment_admin_state and is_admin(uid):
        state = payment_admin_state[uid]
        step = state["step"]
        if step.startswith("smm_"):
            value=' '.join(text.strip().split())
            if step=='smm_catsearch':
                payment_admin_state.pop(uid,None)
                class AdminReply:
                    async def edit(self,message,buttons=None,**kwargs):return await e.reply(message,buttons=buttons,**kwargs)
                return await render_admin_smm_categories(AdminReply(),1,value)
            if step=='smm_service_edit':
                field=state['field'];sid=state['service_id'];cid=state['category_id'];updates={}
                try:
                    if field=='markup':
                        if value.casefold()=='global':updates={'custom_markup':0,'markup_type':None,'markup_value':None}
                        else:
                            kind,amount=[x.strip() for x in value.split('|',1)];amount=float(amount)
                            if kind not in ('percentage','fixed','multiplier') or amount<0:raise ValueError
                            updates={'custom_markup':1,'markup_type':kind,'markup_value':amount}
                    elif field in ('min','max'):
                        amount=int(value)
                        if amount<1:raise ValueError
                        updates={'minimum' if field=='min' else 'maximum':amount}
                    elif field=='emoji':
                        if not value or len(value)>16:raise ValueError
                        updates={'emoji':value}
                    elif field=='name':
                        if not 2<=len(value)<=120:raise ValueError
                        updates={'name':value}
                    else:
                        if not 1<=len(text.strip())<=1000:raise ValueError
                        updates={'description':text.strip()}
                    with managed_connect() as conn:
                        row=conn.execute("SELECT minimum,maximum FROM smm_services WHERE id=?",(sid,)).fetchone()
                        new_min=updates.get('minimum',row['minimum']);new_max=updates.get('maximum',row['maximum'])
                        if new_max<new_min:raise ValueError
                        assignments=','.join(f"{key}=?" for key in updates);conn.execute(f"UPDATE smm_services SET {assignments} WHERE id=?",(*updates.values(),sid));conn.commit()
                except (ValueError,TypeError):return await e.reply("❌ Invalid value or limits. Please send the value again.")
                payment_admin_state.pop(uid,None);return await e.reply("✅ Service updated. Custom settings will be preserved during provider sync.",buttons=[[p_btn("Service",f"adm_smm_service|{sid}|{cid}")]])
            if step=='smm_token':
                pid=state['provider_id']
                try:
                    await smm_test_provider(SMMClient(pid).config()['api_url'],text.strip());smm_update_provider_token(pid,text.strip(),uid)
                except Exception as exc:
                    await send_admin_error(f"Server 5 token change failed for provider {pid}",getattr(exc,'detail',str(exc)))
                    return await e.reply("❌ Token test failed. The existing token was kept.")
                payment_admin_state.pop(uid,None);return await e.reply("✅ Provider API token updated securely.",buttons=[[p_btn("Provider",f"adm_smm_provider|{pid}")]])
            if step=='smm_markup':
                try:
                    percent=float(value)
                    if percent<0:raise ValueError
                except ValueError:return await e.reply("❌ Send one valid percentage, for example <code>40</code>.")
                pid=state['provider_id']
                with managed_connect() as conn:conn.execute("UPDATE smm_providers SET percent_markup=?,fixed_markup=0,minimum_profit=0,maximum_profit=0,round_to=0,updated_at=? WHERE id=?",(percent,datetime.now(timezone.utc).isoformat(),pid));conn.commit()
                payment_admin_state.pop(uid,None);return await e.reply(f"✅ Pricing updated.\n\nProfit markup: {percent}%",buttons=[[p_btn("Provider",f"adm_smm_provider|{pid}")]])
            if step=='smm_name':
                if not 2<=len(value)<=64:return await e.reply("Name must be 2–64 characters.")
                state.update(step='smm_url',name=value);return await e.reply("Send HTTPS API URL.")
            if step=='smm_url':
                try:url=smm_normalize_api_url(text)
                except ValueError as exc:return await e.reply(f"❌ Could not read that API URL: {html.escape(str(exc))}\n\nSend it again, for example <code>https://panel.example/api/v2</code>.")
                warning="\n⚠️ HTTP is accepted, but HTTPS is strongly recommended." if url.startswith('http://') else ""
                state.update(step='smm_key',url=url);return await e.reply(f"✅ API URL accepted:\n<code>{html.escape(url)}</code>{warning}\n\nNow send the API key. It will be encrypted.")
            if step=='smm_key':
                try:
                    balance,currency=await smm_test_provider(state['url'],value);pid=smm_add_provider(state['name'],state['url'],value,currency);cats,services=await smm_sync_provider(pid)
                except Exception as exc:
                    await send_admin_error("Server 5 provider setup failed",getattr(exc,'detail',str(exc)));payment_admin_state.pop(uid,None)
                    return await e.reply("❌ Provider test failed. Technical details were sent only to the administrator.",buttons=[[p_btn("Try Again","adm_smm_add")]])
                payment_admin_state.pop(uid,None);return await e.reply(f"✅ Provider added.\nBalance: {currency} {balance:.2f}\nCategories: {cats}\nServices: {services}",buttons=[[p_btn("Server 5","adm_server5")]])
        if step == "fpg_name":
            name=" ".join(text.strip().split())
            if not 2<=len(name)<=50:return await e.reply("❌ Gateway name must be 2–50 characters.")
            payment_admin_state[uid]={"step":"fpg_upi","name":name};return await e.reply("Send gateway UPI ID (example name@fam).")
        if step == "fpg_upi":
            upi=text.strip()
            if not re.fullmatch(r"[A-Za-z0-9._-]{2,128}@[A-Za-z]{2,32}",upi):return await e.reply("❌ Enter a valid UPI ID.")
            state["upi_id"]=upi;state["step"]="fpg_limits";return await e.reply("Send limits as <code>minimum | maximum</code>.")
        if step == "fpg_limits":
            try: minimum,maximum=[int(x.strip()) for x in text.split("|",1)]; assert 1<=minimum<=maximum<=50000
            except (ValueError,AssertionError):return await e.reply("❌ Use valid values: <code>minimum | maximum</code>.")
            cur.execute("INSERT INTO fampay_gateways(name,upi_id,min_deposit,max_deposit) VALUES(?,?,?,?)",(state["name"],state["upi_id"],minimum,maximum));db.commit();payment_admin_state.pop(uid,None);return await e.reply("✅ Gateway added. Configure Gmail and app password from its settings.",buttons=[[p_btn("UPI Gateways","adm_fampay_gateways")]])
        if step.startswith("fpg_edit_"):
            field=step.removeprefix("fpg_edit_");gid=state["gateway_id"];value=text.strip()
            try:
                if field=="upi":
                    if not re.fullmatch(r"[A-Za-z0-9._-]{2,128}@[A-Za-z]{2,32}",value):raise ValueError
                    cur.execute("UPDATE fampay_gateways SET upi_id=? WHERE id=?",(value,gid))
                elif field=="limits":
                    minimum,maximum=[int(x.strip()) for x in value.split("|",1)];assert 1<=minimum<=maximum<=50000;cur.execute("UPDATE fampay_gateways SET min_deposit=?,max_deposit=? WHERE id=?",(minimum,maximum,gid))
                elif field=="gmail":
                    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+",value):raise ValueError
                    cur.execute("UPDATE fampay_gateways SET gmail=? WHERE id=?",(value,gid))
                else:
                    if len(value.replace(" ",""))<8:raise ValueError
                    cur.execute("UPDATE fampay_gateways SET app_password=? WHERE id=?",("enc:"+encrypt_secret(value.replace(" ","")),gid))
            except (ValueError,AssertionError):return await e.reply("❌ Invalid value. Please try again.")
            db.commit();payment_admin_state.pop(uid,None);return await e.reply("✅ Gateway setting saved.",buttons=[[p_btn("Gateway",f"adm_fampay_gateway|{gid}")]])
        if step in ("ref_topup", "ref_reward", "ref_withdraw", "resell_min", "resell_max"):
            value=text.strip()
            if not value.isdigit() or int(value)<0:return await e.reply("❌ Send a valid whole-number amount.")
            keys={"ref_topup":"ref_topup_min","ref_reward":"ref_reward","ref_withdraw":"ref_withdraw_min","resell_min":"reseller_min_margin","resell_max":"reseller_max_margin"}
            cur.execute("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)",(keys[step],value));db.commit();payment_admin_state.pop(uid,None)
            return await e.reply("✅ Referral / Reseller setting saved.",buttons=[[p_btn("Referral Settings","adm_refsettings")]])
        if step in ("fampay_min","fampay_upi","fampay_name"):
            value=" ".join(text.strip().split())
            if step=="fampay_min":
                if not value.isdigit() or not 1<=int(value)<=50000:return await e.reply("❌ Minimum must be from ₹1 to ₹50000.")
                key="fampay_min_dep"
            elif step=="fampay_upi":
                if not re.fullmatch(r"[A-Za-z0-9._-]{2,128}@[A-Za-z]{2,32}",value):return await e.reply("❌ Enter a valid UPI ID, for example name@fam.")
                key="fampay_upi_id"
            else:
                if not 2<=len(value)<=50:return await e.reply("❌ Payment name must be 2–50 characters.")
                key="fampay_payment_name"
            cur.execute("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)",(key,value));db.commit();payment_admin_state.pop(uid,None)
            return await e.reply("✅ FamPay automatic deposit setting saved.",buttons=[[p_btn("Back","adm_payments")]])
        if step in ("server3_api_key", "server4_api_key"):
            key = re.sub(r"\s+", "", text)
            if not re.fullmatch(r"[A-Za-z0-9_-]{16,128}", key):
                return await e.reply("❌ Invalid API key format.")
            try: await e.delete()
            except Exception: pass
            managed = server3 if step == "server3_api_key" else server4
            endpoint = "https://dgotp.in/stubs/handler_api.php" if step == "server3_api_key" else "https://api.temporasms.com/stubs/handler_api.php"
            managed.update(api_url=endpoint, api_key="enc:" + encrypt_secret(key))
            payment_admin_state.pop(uid, None)
            number = 3 if step == "server3_api_key" else 4
            if number == 4:
                if server4.config().api_enabled:
                    try:
                        operators, countries, services = await server4_client.sync_all()
                        detail = f" Automatically fetched {operators} operators, {countries} countries and {services} services."
                    except TemporaError as exc:
                        logger.warning("Server 4 post-key catalogue fetch failed: %s", exc)
                        detail = " Key saved; automatic catalogue fetch will retry in the background."
                else:
                    detail = " Enable the API to start automatic catalogue fetching."
            else:
                detail = ""
            return await bot.send_message(uid, f"✅ Server {number} API key encrypted and saved.{detail}", buttons=[[p_btn("Back", f"adm_server{number}")]])
        if step=="server_rename":
            name=" ".join(text.strip().split())
            if not 2<=len(name)<=32:return await e.reply("❌ Name must be 2-32 characters.")
            number=state["server_no"]
            (server3 if number==3 else server4).update(display_name=name)
            payment_admin_state.pop(uid,None)
            return await e.reply(f"✅ Server {number} is now shown to users as <b>{html.escape(name)}</b>.",buttons=[[p_btn("Back",f"adm_server{number}")]])
        if step == "server4_operator":
            parts=[part.strip() for part in text.split("|",1)]
            if len(parts)!=2 or not parts[0]: return await e.reply("❌ Use: <code>operator code | display name</code>")
            with managed_connect() as conn:
                conn.execute("""INSERT INTO server4_operators(code,name,updated_at) VALUES(?,?,?)
                  ON CONFLICT(code) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at""",(parts[0],parts[1],datetime.now(timezone.utc).isoformat()));conn.commit()
            payment_admin_state.pop(uid,None)
            return await e.reply("✅ Operator saved. Run Sync Catalogue now.",buttons=[[p_btn("Server 4","adm_server4")]])
        if step in ("server3_percent", "server3_fixed", "server4_percent", "server4_fixed"):
            try:
                value=float(text.strip())
                if value < 0 or value > 10000: raise ValueError
            except ValueError:
                return await e.reply("❌ Send a number from 0 to 10000.")
            field="percent_markup" if step.endswith("percent") else "fixed_markup"
            managed=server3 if step.startswith("server3") else server4
            managed.update(**{field:value})
            payment_admin_state.pop(uid,None)
            label=f"{value:g}%" if field=="percent_markup" else f"₹{value:g}"
            number=3 if step.startswith("server3") else 4
            return await e.reply(f"✅ Server {number} {field.replace('_',' ')} set to {label}.\nFinal price = provider price + percentage + fixed markup.",buttons=[[p_btn("Back",f"adm_server{number}")]])
        if step in ("server3_pricing", "server4_pricing"):
            values=[part.strip() for part in text.split("|")]
            if len(values)!=7: return await e.reply("❌ Send seven values separated by |.")
            try:
                parsed=dict(percent_markup=max(0,float(values[0])),fixed_markup=max(0,float(values[1])),priority=int(values[2]),minimum_price=max(0,float(values[3])),maximum_price=max(0,float(values[4])),retry_count=min(10,max(0,int(values[5]))),timeout_seconds=min(120,max(1,float(values[6]))))
            except ValueError: return await e.reply("❌ One or more values are invalid.")
            (server3 if step=="server3_pricing" else server4).update(**parsed)
            payment_admin_state.pop(uid,None)
            return await e.reply("✅ Provider pricing and limits saved.")

    # PROMO CODE CLAIM
    if uid in promo_state:
        promo_state.pop(uid)
        code = text.strip()

        row = cur.execute("SELECT value, max_uses, used_count FROM promo_codes WHERE code=?", (code,)).fetchone()
        if not row:
            return await e.reply("❌ Invalid promo code! Please verify spelling.", buttons=[[p_btn("Back to Menu", "menu_main")]])

        val, max_uses, used_count = row
        if used_count >= max_uses:
            return await e.reply("❌ This promo code has reached its maximum usage limit.", buttons=[[p_btn("Back to Menu", "menu_main")]])

        log = cur.execute("SELECT user_id FROM promo_logs WHERE code=? AND user_id=?", (code, uid)).fetchone()
        if log:
            return await e.reply("❌ You have already claimed this promo code!", buttons=[[p_btn("Back to Menu", "menu_main")]])

        async with get_user_lock(uid):
            cur.execute("UPDATE users SET balance = balance + ?, promo_balance = COALESCE(promo_balance, 0) + ? WHERE user_id=?", (val, val, uid))
            cur.execute("UPDATE promo_codes SET used_count = used_count + 1 WHERE code=?", (code,))
            cur.execute("INSERT INTO promo_logs (code, user_id) VALUES (?,?)", (code, uid))
            db.commit()

        await e.reply(
            f"🎁 <b>Promo Code Claimed!</b>\n\n"
            f"₹{val} has been added to your balance.\n"
            f"<i>(Note: Promo balance can be used to purchase numbers and accounts, but cannot be transferred).</i>",
            buttons=[[p_btn("Back to Menu", "menu_main")]]
        )
        return

    # FAMPAY AUTOMATIC DEPOSIT AMOUNT INPUT
    if uid in fampay_deposit_state:
        value=text.strip()
        if not value.isdigit():return await e.reply("❌ Send a valid whole-number amount.")
        amount=int(value); gateway_id=fampay_gateway_selection.pop(uid,None); gateway=cur.execute("SELECT min_deposit,max_deposit FROM fampay_gateways WHERE id=? AND enabled=1",(gateway_id,)).fetchone() if gateway_id else None; minimum=int(gateway[0]) if gateway else int(fampay_setting("fampay_min_dep","50")); maximum=int(gateway[1]) if gateway else int(fampay_setting("fampay_max_dep","50000"))
        if not minimum<=amount<=maximum:return await e.reply(f"❌ Amount must be from ₹{minimum} to ₹{maximum}.")
        fampay_deposit_state.discard(uid)
        try:
            await create_fampay_checkout(uid,amount,gateway_id=gateway_id)
        except Exception as exc:
            await send_admin_error("FamPay checkout creation failed",str(exc))
            return await e.reply("❌ Automatic deposit is temporarily unavailable. Admin was notified.",buttons=[[p_btn("Back","menu_deposit")]])
        return

    # MANUAL DEPOSIT AMOUNT INPUT
    if uid in manual_dep_state and manual_dep_state[uid].get("step") == "wait_amount":
        if not text.isdigit():
            return await e.reply("❌ Please enter a valid numerical amount.")

        amt = int(text)
        min_row = cur.execute("SELECT value FROM settings WHERE key='min_cw_dep'").fetchone()
        min_dep = int(min_row[0]) if min_row else 10

        if amt < min_dep:
            return await e.reply(f"❌ Minimum deposit amount is ₹{min_dep}.")

        st = manual_dep_state[uid]
        st["step"] = "wait_proof"
        st["amount"] = amt

        method = st.get("method")
        pay_row = cur.execute("SELECT caption, qr_file_id FROM custom_payments WHERE name=?", (method,)).fetchone()

        usdt_val = round(amt / get_usdt_rate(), 2)
        instructions = (f"📥 <b>Deposit Request Registered</b>\n\n"
                        f"Method: <b>{method}</b>\n"
                        f"Amount in INR: <b>₹{amt}</b>\n"
                        f"Equivalent USD/USDT: <b>${usdt_val}</b>\n\n"
                        f"Please pay the exact amount and reply with your screenshot receipt.")

        if pay_row:
            custom_caption, qr_path = pay_row
            formatted_caption = str(custom_caption).replace("{amount}", str(amt)).replace("{usdt}", str(usdt_val))
            instructions = (f"📥 <b>Deposit Request Registered</b>\n\n"
                            f"Method: <b>{method}</b>\n"
                            f"Amount in INR: <b>₹{amt}</b>\n"
                            f"Equivalent USD/USDT: <b>${usdt_val}</b>\n\n"
                            f"{formatted_caption}\n\n"
                            f"👉 <b>Reply to this message with your screenshot receipt:</b>")

            if qr_path and (qr_path.startswith("http") or os.path.exists(qr_path)):
                qr_msg = await bot.send_file(uid, qr_path, caption=instructions, buttons=[[p_btn("Back", "menu_deposit")]])
                deposit_media_messages.setdefault(uid, []).append(qr_msg.id)
                return

        info_msg = await e.reply(instructions, buttons=[[p_btn("Back", "menu_deposit")]])
        deposit_media_messages.setdefault(uid, []).append(info_msg.id)
        return

    # MANUAL DEPOSIT PROOF SCREENSHOT INPUT
    if uid in manual_dep_state and manual_dep_state[uid].get("step") == "wait_proof":
        st = manual_dep_state[uid]
        method = st.get("method", "Manual")
        amt = st.get("amount", 0)

        if not getattr(e, "photo", None):
            return await e.reply("❌ Please upload a valid payment screenshot proof.")

        manual_dep_state.pop(uid, None)
        await cleanup_deposit_media(uid)
        cur.execute("INSERT INTO deposits (user_id, amount, method_name, status) VALUES (?,?,?,?)", (uid, amt, method, "pending"))
        db.commit()
        order_db_id = cur.lastrowid
        order_key = f"M{order_db_id}"

        caption = (f"📥 <b>NEW MANUAL PROOF RECEIVED</b>\n\n"
                   f"User: <code>{uid}</code>\n"
                   f"Method: <b>{html.escape(method)}</b>\n"
                   f"Amount Requested: <b>₹{amt}</b>\n"
                   f"Transaction Key: <code>{order_key}</code>")

        for aid in ADMIN_IDS:
            try:
                await bot.send_file(aid, e.media, caption=caption, parse_mode='html')
            except Exception:
                pass

        try:
            btns = [[
                p_btn("✅ Accept", f"dep_act|man|app|{order_key}|{uid}|{amt}"),
                p_btn("❌ Reject", f"dep_act|man|rej|{order_key}|{uid}|{amt}")
            ], [p_btn("✏️ Custom Amount", f"dep_act|man|custom|{order_key}|{uid}|{amt}")]]
            await bot.send_file(ADMIN_LOG_CHANNEL_ID, e.media, caption=caption, parse_mode='html', buttons=btns)
        except Exception:
            pass

        return await e.reply("✅ Proof screenshot received. Admins will verify and credit shortly.", buttons=[[p_btn("Back to Menu", "menu_main")]])

    # BALANCE TRANSFER INPUT
    if uid in transfer_state:
        st = transfer_state[uid]
        step = st.get("step")

        if step == "wait_target":
            target_str = text.strip()
            target_uid = None
            if target_str.startswith("@"):
                target_username = target_str.lstrip("@").lower()
                try:
                    entity = await bot.get_entity(target_str)
                    if entity and hasattr(entity, "id"):
                        target_uid = entity.id
                except Exception:
                    pass
            elif target_str.isdigit():
                target_uid = int(target_str)
            else:
                return await e.reply("❌ Invalid format. Please enter a valid numerical Telegram ID or @username.")

            if not target_uid:
                return await e.reply("❌ Could not find a Telegram user with that ID or username. Please check and try again.")

            if target_uid == uid:
                return await e.reply("❌ You cannot transfer balance to yourself! Please enter a different recipient.")

            ensure_user(target_uid)

            row = cur.execute("SELECT balance, COALESCE(promo_balance, 0) FROM users WHERE user_id=?", (uid,)).fetchone()
            bal = row[0] if row else 0
            promo_bal = row[1] if row else 0
            transferable = max(0, bal - promo_bal)
            if transferable <= 0:
                transfer_state.pop(uid, None)
                return await e.reply("❌ You have no transferable balance. (Promo code balance cannot be transferred).", buttons=[[p_btn("Back to Profile", "menu_account")]])

            recip_label = f"<code>{target_uid}</code>"
            try:
                rec_entity = await bot.get_entity(target_uid)
                rec_name = getattr(rec_entity, 'first_name', '') or ''
                rec_username = f"@{rec_entity.username}" if getattr(rec_entity, 'username', None) else ''
                recip_label = f"<b>{html.escape(rec_name)}</b> ({rec_username or target_uid})"
            except Exception:
                pass

            st["step"] = "wait_amount"
            st["target_uid"] = target_uid
            st["recip_label"] = recip_label

            await e.reply(
                f"💸 <b>Transfer Balance</b>\n\n"
                f"👤 Recipient: {recip_label}\n"
                f"🆔 Recipient ID: <code>{target_uid}</code>\n"
                f"💰 Available Transferable: <b>{format_price(uid, transferable)}</b>\n\n"
                f"👉 <b>Enter the amount in INR (₹) you want to transfer:</b>",
                buttons=[[p_btn("Cancel", "menu_account")]]
            )
            return

        elif step == "wait_amount":
            amt_str = text.strip()
            if not amt_str.isdigit() or int(amt_str) <= 0:
                return await e.reply("❌ Please enter a valid whole number amount greater than 0.")

            amount = int(amt_str)
            row = cur.execute("SELECT balance, COALESCE(promo_balance, 0) FROM users WHERE user_id=?", (uid,)).fetchone()
            bal = row[0] if row else 0
            promo_bal = row[1] if row else 0
            transferable = max(0, bal - promo_bal)

            if amount > transferable:
                return await e.reply(
                    f"❌ Amount exceeds your transferable balance!\n"
                    f"💰 Available: <b>{format_price(uid, transferable)}</b>\n"
                    f"<i>(Note: Promo balance of ₹{promo_bal} is locked and cannot be transferred.)</i>\n\n"
                    f"👉 Enter a smaller amount:",
                    buttons=[[p_btn("Cancel", "menu_account")]]
                )

            target_uid = st["target_uid"]
            recip_label = st.get("recip_label", f"<code>{target_uid}</code>")

            msg = (
                f"⚠️ <b>Confirm Balance Transfer</b>\n\n"
                f"👤 Recipient: {recip_label}\n"
                f"🆔 Recipient ID: <code>{target_uid}</code>\n"
                f"💸 Transfer Amount: <b>₹{amount}</b>\n"
                f"💰 Your Remaining Balance: <b>{format_price(uid, bal - amount)}</b>\n\n"
                f"Are you sure you want to transfer this balance? This action is irreversible!"
            )
            btns = [
                [p_btn(f"✅ Confirm Transfer (₹{amount})", f"xfer_do|{target_uid}|{amount}")],
                [p_btn("❌ Cancel", "menu_account")]
            ]
            await e.reply(msg, buttons=btns)
            return

    if uid in sell_state:
        st = sell_state[uid]
        step = st['step']

        if step == 'wait_num':
            phone = text.replace(" ", "").replace("+", "")
            if not phone.isdigit(): return await e.reply("❌ Invalid format. Send numbers only.")

            bl_row = cur.execute("SELECT removed_date FROM blacklisted_phones WHERE phone=?", (phone,)).fetchone()
            if bl_row:
                removed_date = datetime.strptime(bl_row[0], '%Y-%m-%d %H:%M:%S')
                if (datetime.now() - removed_date).days < 90:
                    sell_state.pop(uid)
                    return await e.reply("❌ <b>This number was removed recently.</b>\nYou must wait 90 days before listing it again.", buttons=[[p_btn("Back", "menu_main")]])
                else:
                    cur.execute("DELETE FROM blacklisted_phones WHERE phone=?", (phone,))
                    db.commit()

            c_code = None
            rows = cur.execute("SELECT DISTINCT country_code FROM sell_prices").fetchall()
            valid_codes = [r[0] for r in rows]
            for length in (3, 2, 1):
                prefix = phone[:length]
                if prefix in valid_codes:
                    c_code = prefix
                    break

            if not c_code:
                sell_state.pop(uid)
                return await e.reply("❌ Selling is not allowed for this country code currently.", buttons=[[p_btn("Back", "menu_main")]])

            await e.reply("🔄 Checking number and requesting OTP...")
            sp = f"sessions/{phone}"

            dyn_id, dyn_hash = get_random_api_credentials()
            client = TelegramClient(sp, dyn_id, dyn_hash)
            try:
                await client.connect()
                sreq = await client.send_code_request(phone)
                sell_state[uid] = {
                    'step': 'wait_otp', 'phone': phone, 'client': client,
                    'hash': sreq.phone_code_hash, 'c_code': c_code,
                    'c_name': get_country_info(phone)[0], 'c_icon': get_country_info(phone)[1]
                }
                await e.reply("📩 <b>Please enter the OTP code you received:</b>", buttons=[[p_btn("Cancel", "menu_main")]])
            except Exception as ex:
                sell_state.pop(uid)
                await e.reply(f"❌ Error: {ex}", buttons=[[p_btn("Back", "menu_main")]])
            return

        elif step == 'wait_otp':
            client = st['client']
            phone = st['phone']
            try:
                await client.sign_in(phone, text, phone_code_hash=st['hash'])
            except SessionPasswordNeededError:
                await client.disconnect()
                sell_state.pop(uid)
                return await e.reply("❌ Account has 2FA Password! Remove it first then try again.", buttons=[[p_btn("Back", "menu_main")]])
            except Exception as ex:
                return await e.reply(f"❌ Error: {ex}")

            new_pass = generate_random_password()
            try: await client(UpdatePasswordSettingsRequest(password=GetPasswordRequest(), new_settings={"new_password": new_pass}))
            except: pass

            is_spam = False
            try:
                await client.send_message("spambot", "/start")
                await asyncio.sleep(2)
                msgs = await client.get_messages("spambot", limit=1)
                if msgs and "Good news" not in msgs[0].message: is_spam = True
            except: pass

            year = await detect_account_year(client)

            row = cur.execute("SELECT price_good, price_spam FROM sell_prices WHERE country_code=? AND year=?", (st['c_code'], str(year))).fetchone()
            if not row:
                row = cur.execute("SELECT price_good, price_spam FROM sell_prices WHERE country_code=? AND year='Common'", (st['c_code'],)).fetchone()

            if not row:
                await client.disconnect()
                sell_state.pop(uid)
                return await e.reply("❌ Admin has not set a purchase price for this country/year. Sale rejected.", buttons=[[p_btn("Back", "menu_main")]])

            p_good, p_spam = row[0], row[1]

            msg = await e.reply("✅ <b>Logged in!</b>\n10 Minute Hold Started.\n⚠️ Please remove ALL other active sessions from your Telegram App.",
                                buttons=[[p_btn("Check Active Sessions", f"sell_chk|{phone}")], [p_btn("Cancel & Get Account Back", f"sell_get|{phone}")]])

            selling_accounts[phone] = {
                'uid': uid, 'client': client, 'msg_id': msg.id, 'c_name': st['c_name'],
                'c_icon': st['c_icon'], 'year': year, 'is_spam': is_spam, 'new_pass': new_pass,
                'p_n': p_good, 'p_s': p_spam
            }
            asyncio.create_task(sell_hold_task(phone))
            sell_state.pop(uid)
            return

# ================= START / INITIALIZATION EVENT HANDLERS =================
@bot.on(events.NewMessage(pattern=r"(?i)^/start"))
async def handle_start(e):
    try:
        uid = e.sender_id
        if not uid: return
        if not is_private_event(e) and not is_admin(uid):
            return await e.respond("Please use this bot in private chat only.")
        ensure_user(uid)
        if is_user_banned(uid): return
        if not is_bot_online() and not is_admin(uid): return await e.respond(f"{P_OFF} Bot is under maintenance.")

        text = e.text or ''
        if len(text.split()) > 1:
            start_param = text.split(maxsplit=1)[1].strip()

            route = start_param.lower()
            if route in ("account", "sell", "history"):
                if not await check_channel_joined(uid):
                    btns = [[p_btn(f"📢 Join Channel {i+1}", url=link)] for i, link in enumerate(JOIN_URLS)]
                    btns.append([p_btn("✅ Verify Joined", "verify_join")])
                    return await e.respond(f"{P_WARN} <b>You must join our channels first!</b>", buttons=btns)
                target = {"account": "menu_account", "sell": "menu_sell", "history": "menu_history"}[route]
                label = {"account": "Account", "sell": "Sell", "history": "History"}[route]
                return await e.respond(f"Open <b>{label}</b> from the button below.", buttons=[[p_btn(f"Open {label}", target)], [p_btn("Main Menu", "menu_main")]])

            if start_param.startswith("Giv_"):
                await render_giveaway(e, start_param)
                return

            # View all countries list routing
            if start_param in ("all_server1", "AllServer1"):
                await send_all_countries_list(uid)
                return

            if start_param.lower().startswith("server1-"):
                country = find_country_by_slug(start_param.split("-", 1)[1])
                if country:
                    iso_code = COUNTRY_CODES[country][0]
                    await e.respond(
                        f"✅ Opening Server 1 stock for <b>{COUNTRY_CODES[country][1]} {html.escape(country)}</b>.",
                        buttons=[[p_btn(f"View {country_button_label(country, include_phone=False)}", f"lzt_chk|{iso_code}|1")], [p_btn("All Server 1 Countries", "srv_1_pg|1")]]
                    )
                    return
                await e.respond("❌ Country link was not found. Please choose from Server 1 countries.", buttons=[[p_btn("Server 1 Countries", "srv_1_pg|1")]])
                return

            if start_param.startswith("buy_"):
                target = start_param.replace("buy_", "").strip()
                if target.isdigit() and len(target) >= 6:
                    local_row = cur.execute("SELECT country_name, account_year, price FROM stock WHERE phone=? AND available=1", (target,)).fetchone()
                    if not local_row:
                        return await render_lzt_product(e, uid, target)
                phone = target
                row = cur.execute("SELECT country_name, account_year, price FROM stock WHERE phone=? AND available=1", (phone,)).fetchone()
                if row:
                    c_name, yr, pr = row
                    bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
                    disc_row = cur.execute("SELECT discount FROM users WHERE user_id=?", (uid,)).fetchone()
                    discount = disc_row[0] if disc_row else 0
                    final_price = pr if discount == 0 else int(pr * (100 - discount) / 100)

                    msg = (f"{P_CART} <b>Confirm Your Purchase</b>\n\n"
                           f"{P_CASH} <b>Final Price:</b> {format_price(uid, final_price)}\n"
                           f"{P_CARD} <b>Your Balance:</b> {format_price(uid, bal)}\n\n"
                           f"{P_FLAG} <b>Country:</b> {c_name}\n"
                           f"{P_CAL} <b>Year:</b> {yr}")

                    cb_data = f"s2_buy|{c_name}|{yr}|{pr}|{phone}"
                    btns = []
                    if final_price > bal: btns.append([p_btn("Need Recharge", "menu_deposit")])
                    else: btns.append([p_btn("✅ Purchase", cb_data)])
                    btns.append([p_btn("Cancel", "menu_main")])
                    return await e.respond(msg, buttons=btns)
                else:
                    return await e.respond(f"❌ This account is no longer available.")

            if ("+" in start_param or re.search(r"\s+\d{4}$", start_param)) and not start_param.startswith("ref_"):
                if "+" in start_param:
                    country_key, year_key = start_param.rsplit("+", 1)
                else:
                    country_key, year_key = start_param.rsplit(None, 1)
                country_key = country_key.replace("_", " ").strip()
                year_key = year_key.strip()
                matches = find_country_matches(country_key)
                country = matches[0] if matches else country_key.title()
                if year_key.isdigit():
                    rows = cur.execute("SELECT account_year, price, COUNT(*) FROM stock WHERE available=1 AND country_name LIKE ? AND account_year=? GROUP BY account_year, price ORDER BY price ASC", (f"{country}%", int(year_key))).fetchall()
                    if rows:
                        bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
                        btns = []
                        for y, p, c in rows:
                            label = f"{country} {y} | {format_price(uid, p)} | Stock {c}"
                            btns.append([p_btn(label, f"s2_cf|{country}|{y}|{p}")])
                        btns.append([p_btn("Server 2 Countries", "srv_2_pg|1")])
                        return await e.respond(f"{P_STORE} <b>Server 2 Stock Link</b>\n\n🏳️ <b>Country:</b> {html.escape(country)}\n📅 <b>Year:</b> {year_key}\n💳 <b>Your Balance:</b> {format_price(uid, bal)}", buttons=btns)
                return await e.respond("❌ Server 2 stock link not found. Use format: <code>/start India+2024</code>", buttons=[[p_btn("Server 2 Countries", "srv_2_pg|1")]])

            if start_param.startswith("ref_"):
                ref = start_param.replace("ref_", "")
                if ref.isdigit() and int(ref) != uid:
                    cur.execute("UPDATE users SET referred_by=? WHERE user_id=? AND referred_by IS NULL", (int(ref), uid))
                    db.commit()

            if start_param.startswith("resell_"):
                token = start_param.replace("resell_", "").strip()
                rlink = cur.execute("SELECT user_id, margin_percent FROM reseller_links WHERE token=?", (token,)).fetchone()
                if rlink and rlink[0] != uid:
                    reseller_uid, margin_pct = rlink[0], rlink[1]
                    cur.execute("UPDATE users SET referred_by=?, reseller_token=? WHERE user_id=? AND referred_by IS NULL", (reseller_uid, token, uid))
                    db.commit()

        if not await check_channel_joined(uid):
            btns = [[p_btn(f"📢 Join Channel {i+1}", url=link)] for i, link in enumerate(JOIN_URLS)]
            btns.append([p_btn("✅ Verify Joined", "verify_join")])
            return await e.respond(f"{P_WARN} <b>You must join our channels first!</b>", buttons=btns)

        await send_terms_or_main_menu(e, uid)
    except Exception as ex:
        logger.error(f"Start Error: {ex}")

async def main():
    setup_db()
    print("✅ SERVER 1 COMPLETED STABLY")

    # Start Flask webhook server in background
    start_webhook()

    async def notify_provider_order(event, payload):
        try:
            if event == "completed":
                await bot.send_message(payload["user_id"], f"✅ <b>OTP Received</b>\n\nOrder: <code>{html.escape(payload['order_id'])}</code>\nCode: <code>{html.escape(payload['code'])}</code>")
            elif event == "refunded":
                await bot.send_message(payload["user_id"], f"↩️ <b>Activation Refunded</b>\n\nOrder: <code>{html.escape(payload['order_id'])}</code>\nRefund: ₹{payload['amount']}\nReason: {html.escape(payload['reason'].replace('_',' ').title())}")
        except Exception as exc:
            logger.warning("Provider order notification failed: %s", exc)

    provider_orders = ProviderOrderManager(notify_provider_order)
    provider_orders.start()

    asyncio.create_task(server3_client.catalogue_loop(), name="server3-catalogue")
    asyncio.create_task(server4_client.catalogue_loop(), name="server4-catalogue")
    asyncio.create_task(smm_sync_loop(), name="server5-catalogue")
    asyncio.create_task(smm_order_loop(), name="server5-orders")
    asyncio.create_task(fampay_supervisor_loop(), name="fampay-deposit-supervisor")
    asyncio.create_task(cache_lzt_stock_loop())
    await bot.run_until_disconnected()

if __name__ == '__main__':
    setup_db()
    loop = asyncio.get_event_loop()
    try:
        bot.start(bot_token=BOT_TOKEN)
        loop.run_until_complete(main())
    except KeyboardInterrupt:
        logger.info("Shutdown requested; disconnecting Telegram client.")
    finally:
        if bot.is_connected():
            loop.run_until_complete(bot.disconnect())
