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
import qrcode
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify
import threading
from datetime import datetime
from api_cooldown import check_cooldown, is_cooling_down, record_rate_limit, get_cooldown_remaining

from telethon import TelegramClient, events, Button
from telethon.errors import (
    SessionPasswordNeededError, MessageNotModifiedError, UserNotParticipantError,
    FreshResetAuthorisationForbiddenError
)
from telethon.errors.rpcerrorlist import QueryIdInvalidError
from telethon.tl import types as tl_types
from telethon.tl.types import KeyboardButtonCallback, KeyboardButtonUrl
from telethon.tl.functions.channels import GetParticipantRequest
from telethon.tl.functions.account import (
    GetPasswordRequest, UpdatePasswordSettingsRequest, GetAuthorizationsRequest, ResetAuthorizationRequest
)

from database import (
    connect as managed_connect,
    migrate as migrate_managed_services,
    get_admin_log_channel_id,
    get_public_log_channel_id,
)
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
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8273842990:AAGpVv9_myYpDyW3dsUZc386Zyw_bvSWGLU")
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
    if os.getenv("DISABLE_BOT_WEBHOOK", "0") == "1":
        print("Flask webhook disabled in bot (managed by app.py)")
        return
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
LZT_MIN_REQUEST_INTERVAL = max(0.5, float(os.getenv("LZT_MIN_REQUEST_INTERVAL", "0.75")))
LZT_RATE_LIMIT_COOLDOWN = float(os.getenv("LZT_RATE_LIMIT_COOLDOWN", "10"))
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


# ================= UI ICONS, COUNTRY CATALOG & REUSABLE HELPERS =================
from bot_helpers import *
from bot_handlers import handle_server_callbacks, handle_deposit_callback, handle_admin_callback, handle_user_callbacks, handle_text_input

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

def callback_allowed_in_chat(uid, data, e):
    if is_private_event(e):
        return True
    # Administrators may operate every bot menu from configured groups/channels.
    return is_admin(uid)

async def get_user_log_label(uid):
    try:
        ent = await bot.get_entity(uid)
        username = f"@{ent.username}" if getattr(ent, "username", None) else "No username"
        name = html.escape((getattr(ent, "first_name", None) or str(uid)).strip())
        return f"{name} ({username}) | <code>{uid}</code>"
    except Exception:
        return f"<code>{uid}</code>"

async def send_log_message(text, channel_id=None, label="Log"):
    target_channel = channel_id if channel_id is not None else get_public_log_channel_id()
    if not target_channel:
        return
    try:
        await bot.send_message(target_channel, text)
    except Exception as log_ex:
        logger.warning("%s channel send failed (channel %s): %s", label, target_channel, log_ex)

async def send_dual_log(admin_text, public_text):
    admin_ch = get_admin_log_channel_id()
    public_ch = get_public_log_channel_id()
    try:
        if admin_ch:
            await send_log_message(admin_text, admin_ch, "Admin log")
    except Exception as ex:
        logger.warning("Admin log channel error: %s", ex)
    try:
        if public_ch:
            await send_log_message(public_text, public_ch, "Public log")
    except Exception as ex:
        logger.warning("Public proof channel error: %s", ex)

async def log_primary_deposit(uid, amount, method):
    try:
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
    except Exception as ex:
        logger.warning("Proof channel logging error in log_primary_deposit: %s", ex)
    try:
        await process_referral_bonus(uid, int(amount))
    except Exception as ref_ex:
        logger.warning("Referral bonus processing error: %s", ref_ex)

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
        cooldown_rem = get_cooldown_remaining(LZT_BASE_URL)
        blocked_wait = max(0.0, _lzt_blocked_until - now)
        spacing_wait = max(0.0, LZT_MIN_REQUEST_INTERVAL - (now - _lzt_last_request_at))
        wait_for = max(blocked_wait, spacing_wait, cooldown_rem)
        if wait_for > 0:
            await asyncio.sleep(wait_for)
        _lzt_last_request_at = time.monotonic()

async def apply_lzt_rate_limit_cooldown(retry_after=None):
    global _lzt_blocked_until
    wait_for = max(float(retry_after or 0), LZT_RATE_LIMIT_COOLDOWN)
    _lzt_blocked_until = max(_lzt_blocked_until, time.monotonic() + wait_for)
    record_rate_limit(LZT_BASE_URL, wait_for, reason="LZT 429 rate limit")
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
                    is_rate_limited = (r.status == 429) or (r.status == 403 and "exceeded" in (text or "").lower())
                    if is_rate_limited:
                        retry_after = parse_lzt_retry_after(r.headers) or 60.0
                        wait_for = await apply_lzt_rate_limit_cooldown(retry_after)
                        if LZT_REQUEST_DEBUG:
                            logger.warning("LZT API rate limited (%s): %s %s retry_after=%.1fs body=%s", r.status, method, masked_url, wait_for, text[:500])
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
                    try:
                        iso, flag = COUNTRY_CODES.get(country_name, ("GL", "🌐"))
                        cur.execute("""
                            INSERT OR REPLACE INTO lzt_stock_cache (country, iso_code, flag, stock_count, price, updated_at)
                            VALUES (?, ?, ?, ?, ?, datetime('now'))
                        """, (country_name, iso, flag, int(data[1]), float(data[2])))
                        db.commit()
                    except Exception:
                        pass
            except Exception as ex:
                if fkey not in cached_lzt_stock:
                    cached_lzt_stock[fkey] = {}

    while True:
        try:
            keys_to_update = list(active_filter_keys)
            for fkey in keys_to_update:
                for country in COUNTRY_CODES.keys():
                    await fetch_and_cache(country, fkey)
                    await asyncio.sleep(0.5)
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
    cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('reseller_max_margin', '100')")

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
                    try: await bot.edit_message(uid, msg_id, msg_text, buttons=[[p_btn("🔄 Get OTP Again", f"get_otp_again|{phone}")], [p_btn("📱 Manage Active Devices", f"s2_devs|{phone}")], [p_btn("🚪 Finish & Logout", f"logout_bot|{phone}")]])
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
    if is_cooling_down(verify_url):
        return False
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(verify_url, timeout=15) as resp:
                if resp.status == 429:
                    record_rate_limit(verify_url, 10.0, reason="Redox verify 429")
                    return False
                data = await resp.json()
                status_str = str(data.get("status", "")).upper()
                return (
                    data.get("success") is True or
                    str(data.get("status", "")).lower() == "success" or
                    status_str in ("TXN_SUCCESS", "SUCCESS", "COMPLETED")
                )
    except Exception:
        return False

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
        if is_cooling_down(gen_url):
            return await e.edit(f"{P_NO} Payment gateway is cooling down due to rate limits. Please try again in 10 seconds.", buttons=[[p_btn("Back", "menu_main")]])
        await e.edit(f"{P_TIME} Generating secure QR code...")

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(gen_url, timeout=15) as resp:
                    if resp.status == 429:
                        record_rate_limit(gen_url, 10.0, reason="Redox genqr 429")
                        raise Exception("Redox QR rate limit (HTTP 429)")
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

def _generate_qr_sync(text: str, filename: str) -> io.BytesIO:
    """CPU-bound QR matrix computation & PNG compression in RAM."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(text)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    buf.name = filename
    return buf

async def generate_qr_image_async(text_or_url: str, filename: str = "qr.png") -> io.BytesIO:
    """Non-blocking async QR generator for Telethon. Runs in a thread to keep the event loop fast."""
    return await asyncio.to_thread(_generate_qr_sync, text_or_url, filename)

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
    caption = (f"📥 <b>Automatic Deposit Request</b>\n\n"
               f"Amount: <b>₹{amount}</b>\nReference: <code>{reference}</code>\n"
               f"Gateway: <b>{html.escape(gateway[1]) if gateway else 'FamPay'}</b>\nUPI: <code>{html.escape(upi_id)}</code>\n\n"
               f"Pay the exact amount within {FAMPAY_ORDER_TTL // 60} minutes. Verification runs automatically, or press Check Payment.")
    try:
        qr_image = await generate_qr_image_async(upi_uri, filename=f"fampay-{reference}.png")
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

        if await handle_admin_callback(e, uid, data):
            return
        if await handle_server_callbacks(e, uid, data):
            return
        if await handle_deposit_callback(e, uid, data):
            return
        if await handle_user_callbacks(e, uid, data):
            return

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
    raw_text = getattr(e, 'raw_text', None)
    if raw_text and raw_text.startswith('/'): return
    if getattr(e, 'text', None) and e.text.startswith('/'): return
    text = (raw_text if raw_text is not None else (e.text or "")) or ""

    try:
        if await handle_text_input(e, uid, text, raw_text):
            return
    except Exception as ex:
        await send_admin_error("Global Text Handler Failure", f"User: {uid}\nText: {text}\n\n{ex}")


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
    print("[+] SERVER 1 COMPLETED STABLY")

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
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    try:
        try:
            bot.start(bot_token=BOT_TOKEN)
        except Exception as auth_err:
            logger.error("Initial bot authorization failed (%s); resetting session file...", auth_err)
            import glob
            for s_file in glob.glob(f"{session_name}.session*"):
                try:
                    os.remove(s_file)
                except Exception:
                    pass
            bot = TelegramClient(session_name, API_ID, API_HASH)
            bot.parse_mode = 'html'
            bot.start(bot_token=BOT_TOKEN)
        loop.run_until_complete(main())
    except KeyboardInterrupt:
        logger.info("Shutdown requested; disconnecting Telegram client.")
    finally:
        if bot.is_connected():
            loop.run_until_complete(bot.disconnect())
