"""Background worker tasks and supervisor loops for Telethon bot."""
from __future__ import annotations

import asyncio
import logging
import sys
import time

import aiohttp

from api_cooldown import is_cooling_down, record_rate_limit
from bot_helpers.constants import (
    AUTO_CANCEL_SECONDS,
    P_CASH,
    P_FLAG,
    P_GIFT,
    P_NO,
    P_PHONE,
    P_SHIELD,
    P_TIME,
    P_YES,
    UPI_MID,
)
from bot_helpers.ui_helpers import p_btn
from database import connect as managed_connect

logger = logging.getLogger("bot.tasks")


def get_bot():
    bot_mod = sys.modules.get("bot")
    if bot_mod and hasattr(bot_mod, "bot"):
        return bot_mod.bot
    return None


def get_bot_attr(attr_name, default=None):
    bot_mod = sys.modules.get("bot")
    if bot_mod and hasattr(bot_mod, attr_name):
        return getattr(bot_mod, attr_name)
    return default


async def auto_otp_task(phone):
    """Background loop polling OTP arrival for Server 1 and Server 2 orders."""
    bot = get_bot()
    active_orders = get_bot_attr("active_orders", {})
    if phone not in active_orders:
        return
    order = active_orders[phone]
    is_lzt = str(phone).startswith("LZT_")
    start_time, uid, msg_id = order["start_time"], order["uid"], order["msg_id"]

    get_user_lock = get_bot_attr("get_user_lock")
    get_verified_lzt_otp = get_bot_attr("get_verified_lzt_otp")
    normalize_lzt_phone = get_bot_attr("normalize_lzt_phone")
    get_latest_telegram_login_otp = get_bot_attr("get_latest_telegram_login_otp")
    update_balance = get_bot_attr("update_balance")

    if is_lzt:
        item_id = phone.split("_")[1]
        while time.time() - start_time < AUTO_CANCEL_SECONDS:
            if phone not in active_orders:
                return
            try:
                code, verified, res = await get_verified_lzt_otp(item_id, attempts=2, delay=1)
                if code and not order.get("otp_sent"):
                    order["otp_sent"] = True
                    display_phone = order.get("phone_num") or normalize_lzt_phone(None, item_id)
                    with managed_connect() as conn:
                        conn.execute(
                            "UPDATE orders SET otp=? WHERE phone=? AND user_id=? AND server='Server 1'",
                            (code, display_phone, uid),
                        )
                        conn.commit()

                    msg_text = (
                        f"{P_YES} <b>Latest OTP Fetched (Server 1)!</b>\n\n"
                        f"{P_PHONE} <b>Phone:</b> <code>{display_phone}</code>\n"
                        f"{P_TIME} <b>OTP:</b> <code>{code}</code>\n"
                        f"{P_SHIELD} <b>Server 1 double-check:</b> {'Verified' if verified else 'Best latest code'}"
                    )
                    try:
                        await bot.edit_message(uid, msg_id, msg_text, buttons=[[p_btn("Back to Menu", "menu_main")]])
                    except Exception:
                        pass
                    return
            except Exception:
                pass
            await asyncio.sleep(10)
    else:
        client = order["client"]
        seller_id = order.get("seller_id")
        while time.time() - start_time < AUTO_CANCEL_SECONDS:
            if phone not in active_orders:
                return
            try:
                code = await get_latest_telegram_login_otp(client, start_time)
                if code and not order["paid"]:
                    order["paid"] = True
                    price = order["price"]
                    with managed_connect() as conn:
                        conn.execute(
                            "INSERT INTO orders (user_id, country, year, price, phone, otp) VALUES (?,?,?,?,?,?)",
                            (uid, order["country"], order["year"], price, phone, code),
                        )
                        conn.execute("DELETE FROM stock WHERE phone=?", (phone,))
                        conn.commit()

                    if seller_id and update_balance:
                        seller_cut = int(price * 0.90)
                        update_balance(seller_id, seller_cut, "sales_balance")
                        try:
                            await bot.send_message(
                                seller_id,
                                f"{P_GIFT} <b>Account Sold!</b>\nYour uploaded number +{phone} was just sold. {P_CASH}{seller_cut} has been added to your Sales Balance!",
                            )
                        except Exception:
                            pass

                    twofa_text = (
                        f"{P_SHIELD} <b>2FA:</b> <code>{order['twofa']}</code>"
                        if order["twofa"] != "None"
                        else "🔓 <b>2FA:</b> <code>Disabled</code>"
                    )
                    display_phone = f"+{phone.lstrip('+')}"
                    msg_text = (
                        f"{P_YES} <b>Latest OTP Fetched!</b>\n\n"
                        f"{P_PHONE} <b>Phone:</b> <code>{display_phone}</code>\n"
                        f"{P_FLAG} <b>Country:</b> {order['c_icon']} {order['country']}\n"
                        f"{P_TIME} <b>OTP:</b> <code>{code}</code>\n"
                        f"{twofa_text}"
                    )
                    try:
                        await bot.edit_message(
                            uid,
                            msg_id,
                            msg_text,
                            buttons=[
                                [p_btn("🔄 Get OTP Again", f"get_otp_again|{phone}")],
                                [p_btn("📱 Manage Active Devices", f"s2_devs|{phone}")],
                                [p_btn("🚪 Finish & Logout", f"logout_bot|{phone}")],
                            ],
                        )
                    except Exception:
                        pass
                    return
            except Exception:
                pass
            await asyncio.sleep(6)

    # Order timed out -> automatic refund
    if phone in active_orders and not active_orders[phone]["paid"]:
        order = active_orders.pop(phone)
        if not is_lzt:
            try:
                await order["client"].disconnect()
            except Exception:
                pass
            with managed_connect() as conn:
                conn.execute("UPDATE users SET balance = balance + ? WHERE user_id=?", (order["price"], uid))
                conn.execute(
                    "UPDATE stock SET available=1 WHERE phone=? AND EXISTS (SELECT 1 FROM stock WHERE phone=?)",
                    (phone, phone),
                )
                conn.commit()
        else:
            if update_balance:
                update_balance(uid, order["price"])

        try:
            await bot.edit_message(
                uid,
                msg_id,
                f"{P_TIME} <b>Order Expired!</b>\nThe limit ran out. Your money (₹{order['price']}) has been refunded.",
            )
        except Exception:
            pass


async def sell_hold_task(phone):
    """Holding countdown before finalizing Server 2 seller session."""
    await asyncio.sleep(600)
    selling_accounts = get_bot_attr("selling_accounts", {})
    if phone not in selling_accounts:
        return
    st = selling_accounts[phone]
    client = st["client"]
    uid = st["uid"]
    bot = get_bot()

    if st.get("cancelled"):
        return

    try:
        from telethon.tl.functions.account import GetAuthorizationsRequest
        auths = await client(GetAuthorizationsRequest())
        if len(auths.authorizations) > 1:
            msg = (
                f"{P_NO} <b>Sell Rejected!</b>\nNumber: {phone}\n"
                f"Reason: You did not delete your other active sessions.\n"
                f"Click below to retrieve your account."
            )
            try:
                await bot.edit_message(uid, st["msg_id"], msg, buttons=[[p_btn("Get Login Info", f"sell_get|{phone}")]])
            except Exception:
                pass
        else:
            base_val = st["p_s"] if st["is_spam"] else st["p_n"]
            with managed_connect() as conn:
                conn.execute(
                    "INSERT OR REPLACE INTO stock (phone, session_file, country_name, country_icon, account_year, category, price, available, twofa, seller_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (
                        phone,
                        f"sessions/{phone}.session",
                        st["c_name"],
                        st["c_icon"],
                        st["year"],
                        "Good",
                        base_val,
                        1,
                        st["new_pass"],
                        uid,
                    ),
                )
                conn.commit()

            admin_cut = int(base_val * 0.10)
            user_payout = base_val - admin_cut

            me = await bot.get_me()
            promo_link = f"https://t.me/{me.username}?start=buy_{phone}"

            msg = (
                f"{P_YES} <b>Upload Completed!</b>\n"
                f"Number: {phone} passed all checks and is live on Server 2.\n"
                f"💰 List Price: {P_CASH}{base_val}\n"
                f"🔗 Promo Link: <code>{promo_link}</code>\n\n"
                f"<i>You will receive {P_CASH}{user_payout} in your Sales Balance when it sells.</i>"
            )
            try:
                await bot.edit_message(uid, st["msg_id"], msg)
            except Exception:
                try:
                    await bot.send_message(uid, msg)
                except Exception:
                    pass

            await client.disconnect()
            selling_accounts.pop(phone, None)
    except Exception as e:
        try:
            await bot.send_message(uid, f"{P_NO} Error finalizing sale for {phone}: {e}")
        except Exception:
            pass
        selling_accounts.pop(phone, None)
        try:
            await client.disconnect()
        except Exception:
            pass


async def check_upi_expiry_loop(order_id, uid, qr_msg_id):
    """Timer to expire pending Redox UPI sessions after 5 minutes."""
    await asyncio.sleep(300)
    bot = get_bot()
    with managed_connect() as conn:
        row = conn.execute("SELECT status FROM upi_orders WHERE order_id=?", (order_id,)).fetchone()
        if row and row[0] == "pending":
            conn.execute("UPDATE upi_orders SET status='expired' WHERE order_id=?", (order_id,))
            conn.commit()
            if bot:
                try:
                    await bot.delete_messages(uid, [qr_msg_id])
                    await bot.send_message(
                        uid,
                        f"{P_TIME} <b>Payment Session Expired!</b>\nTransaction window closed. Request a new QR to deposit.",
                    )
                except Exception:
                    pass


async def query_upi_payment_success(order_id: str) -> bool:
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
                    data.get("success") is True
                    or str(data.get("status", "")).lower() == "success"
                    or status_str in ("TXN_SUCCESS", "SUCCESS", "COMPLETED")
                )
    except Exception:
        return False


async def complete_upi_order(order_id, uid, amount, qr_msg_id, edit_event=None):
    bot = get_bot()
    update_balance = get_bot_attr("update_balance")
    format_price = get_bot_attr("format_price", lambda u, p: f"₹{p}")
    log_primary_deposit = get_bot_attr("log_primary_deposit")

    with managed_connect() as conn:
        row = conn.execute("SELECT status FROM upi_orders WHERE order_id=?", (order_id,)).fetchone()
        if not row:
            return False
        current_status = row[0]
        if current_status != "pending":
            return current_status == "success"

        user_old_bal_row = conn.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()
        user_old_bal = user_old_bal_row[0] if user_old_bal_row else 0

        conn.execute("UPDATE upi_orders SET status='success' WHERE order_id=?", (order_id,))
        if update_balance:
            update_balance(uid, amount)
        else:
            conn.execute("UPDATE users SET balance = balance + ? WHERE user_id=?", (amount, uid))
        conn.execute("UPDATE users SET total_deposited = total_deposited + ? WHERE user_id=?", (amount, uid))
        conn.commit()

    user_new_bal = user_old_bal + amount
    succ_msg = (
        f"{P_YES} <b>PAYMENT VERIFICATION SUCCESSFUL</b>\n\n"
        f"🪙 Added: <b>₹{amount}</b>\n"
        f"Old Balance: {format_price(uid, user_old_bal)}\n"
        f"New Balance: {format_price(uid, user_new_bal)}"
    )
    if bot:
        try:
            await bot.delete_messages(uid, [qr_msg_id])
        except Exception:
            pass
        try:
            await bot.send_message(uid, succ_msg, parse_mode="html")
        except Exception:
            pass

    if log_primary_deposit:
        await log_primary_deposit(uid, amount, "UPI (Automated)")

    if edit_event:
        try:
            await edit_event.edit(
                f"✅ Payment auto-verified. ₹{amount} added to your wallet.",
                buttons=[[p_btn("Back to Menu", "menu_main")]],
            )
        except Exception:
            pass
    return True


async def auto_verify_upi_loop(order_id, uid, qr_msg_id):
    """Background poller checking pending Redox payment for up to 5 minutes."""
    for _ in range(30):
        with managed_connect() as conn:
            row = conn.execute("SELECT user_id, amount, status, qr_msg_id FROM upi_orders WHERE order_id=?", (order_id,)).fetchone()
        if not row or row[2] != "pending":
            return
        try:
            if await query_upi_payment_success(order_id):
                await complete_upi_order(order_id, uid, row[1], qr_msg_id)
                return
        except Exception:
            pass
        await asyncio.sleep(10)


async def fampay_supervisor_loop():
    """Supervisor worker checking pending FamPay checkouts and expiring old ones."""
    fampay_mod = sys.modules.get("fampay")
    bot = get_bot()
    is_method_on = get_bot_attr("is_method_on", lambda k: False)
    check_fampay_order = get_bot_attr("check_fampay_order")
    log_primary_deposit = get_bot_attr("log_primary_deposit")
    send_admin_error = get_bot_attr("send_admin_error")
    fampay_check_locks = get_bot_attr("fampay_check_locks", {})
    fampay_error_cooldowns = get_bot_attr("fampay_error_cooldowns", {})

    while True:
        try:
            if fampay_mod and hasattr(fampay_mod, "expire_fampay_orders"):
                for expired in fampay_mod.expire_fampay_orders():
                    fampay_check_locks.pop(expired["reference"], None)
                    fampay_error_cooldowns.pop(expired["reference"], None)
                    if expired.get("qr_msg_id") and bot:
                        try:
                            await bot.delete_messages(expired["user_id"], expired["qr_msg_id"])
                        except Exception:
                            pass
                    buttons = (
                        [[p_btn("I Paid — Submit Review", f"fampay_review|{expired['reference']}", style="primary")]]
                        if expired.get("check_count", 0) > 0
                        else None
                    )
                    if bot:
                        try:
                            await bot.send_message(
                                expired["user_id"],
                                f"⌛ Automatic deposit <code>{expired['reference']}</code> expired. No payment was found and no balance was credited.",
                                buttons=buttons,
                            )
                        except Exception:
                            pass

            if is_method_on("fampay_status") and check_fampay_order:
                with managed_connect() as conn:
                    rows = conn.execute(
                        "SELECT reference, user_id, qr_msg_id FROM fampay_orders WHERE status='pending' ORDER BY id LIMIT 100"
                    ).fetchall()
                for reference, user_id, qr_msg_id in rows:
                    try:
                        status, result = await check_fampay_order(reference, user_id)
                        if status == "credited" and result:
                            fampay_check_locks.pop(reference, None)
                            fampay_error_cooldowns.pop(reference, None)
                            if qr_msg_id and bot:
                                try:
                                    await bot.delete_messages(user_id, qr_msg_id)
                                except Exception:
                                    pass
                            if bot:
                                await bot.send_message(
                                    user_id,
                                    f"✅ <b>Payment Successful!</b>\n\nAmount: ₹{result['amount']}\nReference: <code>{reference}</code>\nYour balance was updated exactly once.",
                                )
                            if log_primary_deposit:
                                await log_primary_deposit(user_id, result["amount"], "FamPay Automatic")
                    except Exception as exc:
                        logger.warning("FamPay auto-check failed for %s: %s", reference, exc)
                    await asyncio.sleep(0.2)
        except Exception:
            logger.exception("FamPay supervisor recovered from an error")
        await asyncio.sleep(10)


async def cache_lzt_stock_loop():
    """Background worker caching live LZT Market stock to SQLite lzt_stock_cache table."""
    fetch_lzt = get_bot_attr("fetch_lzt_country_data_with_filters")
    from database import utcnow
    while True:
        try:
            if fetch_lzt:
                data = await fetch_lzt(country="all", max_pages=1)
                if data and isinstance(data, list):
                    with managed_connect() as conn:
                        for row in data:
                            conn.execute(
                                "INSERT OR REPLACE INTO lzt_stock_cache (country, iso_code, flag, stock_count, price, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                                (
                                    row.get("country", ""),
                                    row.get("iso_code", ""),
                                    row.get("flag", "🌐"),
                                    int(row.get("stock_count", 0)),
                                    float(row.get("price", 80)),
                                    utcnow(),
                                ),
                            )
                        conn.commit()
        except Exception as ex:
            logger.debug("LZT cache loop note: %s", ex)
        await asyncio.sleep(60)
