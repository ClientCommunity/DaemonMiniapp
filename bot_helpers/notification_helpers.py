"""Notification and channel logging helpers for Telegram admin and public proof channels."""
from __future__ import annotations

import html
import logging
import sys
import time
from typing import Any

from config import MASTER_ADMIN_IDS
from database import get_admin_log_channel_id, get_public_log_channel_id
from bot_helpers.utils import mask_phone_number

logger = logging.getLogger("bot.notifications")
error_cooldowns: dict[str, float] = {}


def get_bot():
    """Retrieve running Telethon client dynamically to prevent circular imports."""
    bot_mod = sys.modules.get("bot")
    if bot_mod and hasattr(bot_mod, "bot"):
        return bot_mod.bot
    return None


async def get_user_log_label(uid: int) -> str:
    """Format user entity as HTML string for admin logs."""
    bot = get_bot()
    if not bot:
        return f"<code>{uid}</code>"
    try:
        ent = await bot.get_entity(uid)
        username = f"@{ent.username}" if getattr(ent, "username", None) else "No username"
        name = html.escape((getattr(ent, "first_name", None) or str(uid)).strip())
        return f"{name} ({username}) | <code>{uid}</code>"
    except Exception:
        return f"<code>{uid}</code>"


async def send_log_message(text: str, channel_id: int | str | None = None, label: str = "Log"):
    """Send HTML message to specified channel."""
    bot = get_bot()
    if not bot:
        return
    target_channel = channel_id if channel_id is not None else get_public_log_channel_id()
    if not target_channel:
        return
    try:
        await bot.send_message(target_channel, text, parse_mode="html")
    except Exception as log_ex:
        logger.warning("%s channel send failed (channel %s): %s", label, target_channel, log_ex)


async def send_dual_log(admin_text: str, public_text: str):
    """Send separate formatted receipts to private admin log and public community channel."""
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


async def bot_public_handle() -> str:
    """Return bot's @username for public proof receipts."""
    bot = get_bot()
    if not bot:
        return "this bot"
    try:
        me = await bot.get_me()
        return f"@{me.username}" if getattr(me, "username", None) else "this bot"
    except Exception:
        return "this bot"


async def log_primary_deposit(uid: int, amount: int | float, method: str):
    """Log deposit receipt to admin and public proof channels, then trigger referral bonus."""
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

    # Trigger referral bonus
    try:
        bot_mod = sys.modules.get("bot")
        if bot_mod and hasattr(bot_mod, "process_referral_bonus"):
            await bot_mod.process_referral_bonus(uid, int(amount))
    except Exception as ref_ex:
        logger.warning("Referral bonus processing error: %s", ref_ex)


async def log_primary_purchase(uid: int, country: str, price: int | float, paid: int | float, year: Any, qty: int, phone: str = None, server: str = None, order_id: Any = None):
    """Log purchase proof to channels and trigger reseller commission."""
    logger.info("Purchase completed: user=%s country=%s price=%s paid=%s year=%s qty=%s phone=%s server=%s", uid, country, price, paid, year, qty, phone, server)
    user_label = await get_user_log_label(uid)
    handle = await bot_public_handle()
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
        bot_mod = sys.modules.get("bot")
        if bot_mod and hasattr(bot_mod, "process_reseller_commission"):
            await bot_mod.process_reseller_commission(uid, paid or price, f"{server or 'Store'} Purchase")
    except Exception as ex:
        logger.warning("Reseller commission trigger error: %s", ex)


async def log_smm_purchase(uid: int, link: str, price: int | float, service: str, order_id: Any):
    """Log Server 5 SMM purchase receipt."""
    bot_mod = sys.modules.get("bot")
    format_money = getattr(bot_mod, "format_smm_money", lambda v: f"{float(v):.2f}")
    user_label = await get_user_log_label(uid)
    handle = await bot_public_handle()
    public_text = (
        "📅 <b>New Order Success</b>\n\n<b>Link:</b> hidden\n"
        f"<b>Price:</b> ₹{format_money(price)}\n<b>Service:</b> {html.escape(str(service))}\n"
        f"<b>Order ID:</b> <code>{html.escape(str(order_id))}</code>\n<b>Server:</b> Server 5\n\n"
        f"Thanks for Purchase {html.escape(handle)} 🔄"
    )
    admin_text = (
        "📅 <b>New Order Success</b>\n\n"
        f"<b>User:</b> {user_label}\n<b>Link:</b> <code>{html.escape(str(link))}</code>\n"
        f"<b>Price:</b> ₹{format_money(price)}\n<b>Service:</b> {html.escape(str(service))}\n"
        f"<b>Order ID:</b> <code>{html.escape(str(order_id))}</code>\n<b>Server:</b> Server 5"
    )
    await send_dual_log(admin_text, public_text)

    try:
        if bot_mod and hasattr(bot_mod, "process_reseller_commission"):
            await bot_mod.process_reseller_commission(uid, int(price), f"Server 5: {service}")
    except Exception as ex:
        logger.warning("Reseller commission trigger error for SMM: %s", ex)


async def send_admin_error(error_msg: str, trace: str = ""):
    """Send throttled exception alerts to administrators."""
    global error_cooldowns
    bot = get_bot()
    if not bot:
        return
    try:
        sig = f"{error_msg}_{trace[:100]}"
        now = time.time()
        if sig in error_cooldowns:
            if now - error_cooldowns[sig] < 600:
                return
        error_cooldowns[sig] = now

        clean_trace = trace[:1500]
        alert = (
            f"🚨 <b>SYSTEM EXCEPTION ENCOUNTERED</b>\n\n"
            f"<b>Error:</b> {html.escape(error_msg)}\n"
            f"<b>Trace:</b>\n<pre>{html.escape(clean_trace)}</pre>"
        )
        for aid in MASTER_ADMIN_IDS:
            try:
                await bot.send_message(aid, alert, parse_mode="html")
            except Exception:
                pass
    except Exception as ex:
        logger.error("Error logging admin message: %s", ex)
