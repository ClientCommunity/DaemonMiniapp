"""Server 2 (Local Sessions & Accounts) callback queries handler."""
from __future__ import annotations

import asyncio
import html
import os
import time
import zipfile
from datetime import datetime, timezone
from telethon import TelegramClient
from telethon.errors import FreshResetAuthorisationForbiddenError, MessageNotModifiedError
from telethon.tl.functions.account import GetAuthorizationsRequest, ResetAuthorizationRequest
from bot_helpers import (
    P_CAL,
    P_CART,
    P_CASH,
    P_GIFT,
    P_NO,
    P_PHONE,
    P_SHIELD,
    P_STORE,
    P_TIME,
    P_YES,
    delete_session_files,
    p_btn,
)


async def handle_server2_callback(e, uid: int, data: str) -> bool:
    """Handle all Server 2 session and account callback events. Returns True if handled, False otherwise."""
    is_s2 = (
        data.startswith("srv_2_pg|")
        or data.startswith("s2_")
        or data == "s2_buy_session"
        or data == "s2_qty_cancel"
        or data.startswith("get_otp_again|")
        or data.startswith("logout_bot|")
    )
    if not is_s2:
        return False

    import bot
    cur = bot.cur
    db = bot.db
    logger = bot.logger
    bot_client = bot.bot
    session_buy_state = bot.session_buy_state
    active_orders = bot.active_orders
    get_user_lock = bot.get_user_lock
    apply_server_discount = bot.apply_server_discount
    discount_label = bot.discount_label
    get_api_credentials = bot.get_api_credentials
    remove_invalid_server2_session = bot.remove_invalid_server2_session
    update_balance = bot.update_balance
    log_primary_purchase = bot.log_primary_purchase
    auto_otp_task = bot.auto_otp_task
    get_latest_telegram_login_otp = bot.get_latest_telegram_login_otp
    safe_answer_cb = bot.safe_answer_cb
    send_admin_error = bot.send_admin_error
    format_price = bot.format_price

    if data.startswith("srv_2_pg|"):
        total_bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
        good_count = cur.execute("SELECT COUNT(*) FROM stock WHERE available=1 AND COALESCE(quality_tier, 'good')='good'").fetchone()[0]
        cheap_count = cur.execute("SELECT COUNT(*) FROM stock WHERE available=1 AND quality_tier='cheap'").fetchone()[0]
        await e.edit(
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
        return True

    elif data.startswith("s2_tier|"):
        parts = data.split("|")
        tier = parts[1]
        tier_name = "Good Quality" if tier == "good" else "Cheap Quality"
        tier_icon = "🟢" if tier == "good" else "🟡"
        total_bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
        await e.edit(
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
        return True

    elif data.startswith("s2_countries|"):
        parts = data.split("|")
        if len(parts) == 4:
            _, tier, purchase_type, page_text = parts
        else:
            _, purchase_type, page_text = parts
            tier = "good"
        if purchase_type not in ("account", "session"):
            await e.answer("Invalid purchase option.", alert=True)
            return True
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
            await e.edit(f"❌ <b>No stock currently in Server 2 ({tier_label}).</b>", buttons=[[p_btn("Back", "srv_2_pg|1")]])
            return True

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
        if page > 1:
            nav.append(p_btn("Prev", f"s2_countries|{tier}|{purchase_type}|{page-1}"))
        if offset + limit < total:
            nav.append(p_btn("Next", f"s2_countries|{tier}|{purchase_type}|{page+1}"))
        if nav:
            btns.append(nav)
        btns.append([p_btn("Back to Purchase Options", f"s2_tier|{tier}|1")])
        await e.edit(msg, buttons=btns)
        return True

    elif data == "s2_buy_session":
        rows = cur.execute(
            "SELECT country_icon, country_name, COUNT(*) FROM stock WHERE available=1 AND COALESCE(quality_tier, 'good')='good' GROUP BY country_name ORDER BY country_name ASC LIMIT 50"
        ).fetchall()
        if not rows:
            await e.edit("❌ <b>Server 2 Empty.</b>", buttons=[[p_btn("Back", "menu_buy")]])
            return True
        msg = (f"{P_STORE} <b>Server 2 Buy Session</b>\n\n"
               "Choose a country, then choose year and send how many accounts you need to buy.\n"
               "After confirmation, the bot validates and sends the original authorized session file(s).")
        btns = [[p_btn(f"{i} {n} ({c})", f"s2_yr|good|{n[:20]}")] for (i, n, c) in rows]
        btns.append([p_btn("Back", "srv_2_pg|1")])
        await e.edit(msg, buttons=btns)
        return True

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
        if not rows:
            await e.answer("❌ Out of stock.", alert=True)
            return True
        tier_icon = "🟢" if tier == "good" else "🟡"
        tier_label = "Good" if tier == "good" else "Cheap"
        msg = f"{P_CAL} <b>Select Year ({tier_icon} {tier_label})</b>\n🏳️ Country: <b>{country}</b>\n\n"
        btns = [[p_btn(f"{y} | {format_price(uid, p)} | {c}", f"s2_cf|{tier}|{country}|{y}|{p}")] for (y, p, c) in rows]
        btns.append([p_btn("Back", f"s2_countries|{tier}|session|1")])
        await e.edit(msg, buttons=btns)
        return True

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
            await e.answer("❌ Out of stock.", alert=True)
            return True
        tier_icon = "🟢" if tier == "good" else "🟡"
        tier_label = "Good" if tier == "good" else "Cheap"
        msg = f"{P_CAL} <b>Select Account Year ({tier_icon} {tier_label})</b>\n🏳️ Country: <b>{country}</b>\n\nYou will receive the full OTP-assisted account purchase."
        btns = [[p_btn(f"{y} | {format_price(uid, p)} | {c} in stock", f"s2_cf_old|{tier}|{country}|{y}|{p}")] for y, p, c in rows]
        btns.append([p_btn("Back", f"s2_countries|{tier}|account|1")])
        await e.edit(msg, buttons=btns)
        return True

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
        await e.edit(
            f"{P_CART} <b>How many sessions do you want?</b>\n\n"
            f"🏷️ <b>Quality:</b> {tier_label}\n"
            f"🏳️ <b>Country:</b> {country}\n"
            f"{P_CAL} <b>Year:</b> {year}\n"
            f"{P_CASH} <b>Each:</b> {format_price(uid, apply_server_discount(uid, 2, int(base_price)))}{discount_label(uid, 2)}\n"
            f"📦 <b>Available:</b> {stock_count}\n\n"
            "Send quantity as a number.",
            buttons=[[p_btn("Cancel", "s2_qty_cancel")]]
        )
        return True

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

        async with get_user_lock(uid):
            bal = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
            initial_count = cur.execute(
                "SELECT COUNT(*) FROM stock WHERE country_name LIKE ? AND account_year=? AND price=? AND COALESCE(quality_tier, 'good')=? AND available=1",
                (f"{country}%", int(year_str), base_price, tier)
            ).fetchone()[0]
            if initial_count < qty:
                await e.edit("❌ <b>Not enough stock available now.</b>", buttons=[[p_btn("Back", f"s2_yr|{tier}|{country}")]])
                return True
            if bal < total_price:
                await e.edit(f"❌ <b>Insufficient balance.</b>\nNeed {format_price(uid, total_price)}.", buttons=[[p_btn("Recharge", "menu_deposit"), p_btn("Cancel", "srv_2_pg|1")]])
                return True
            cur.execute("UPDATE users SET balance = balance - ? WHERE user_id=? AND balance >= ?", (total_price, uid, total_price))
            if cur.rowcount == 0:
                await e.edit("❌ <b>Balance changed. Try again.</b>", buttons=[[p_btn("Back", f"s2_yr|{tier}|{country}")]])
                return True
            db.commit()

        await e.edit(f"🔄 <b>Verifying {qty} Server 2 session(s)...</b>\n<i>Testing live account health and filtering dead accounts...</i>")

        valid_sessions = []
        dead_phones = []

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
                    try:
                        await test_client.disconnect()
                    except Exception:
                        pass

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

        if refund_amount > 0:
            async with get_user_lock(uid):
                cur.execute("UPDATE users SET balance = balance + ? WHERE user_id=?", (refund_amount, uid))
                db.commit()

        if delivered_count == 0:
            await e.edit(
                f"❌ <b>Stock Verification Failed</b>\n\n"
                f"None of the requested sessions could be verified as active.\n"
                f"💰 Full refund of <b>{format_price(uid, total_price)}</b> has been credited back to your balance.",
                buttons=[[p_btn("Back to Menu", "menu_main")]]
            )
            return True

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
                        await bot_client.send_message(
                            acc['seller_id'],
                            f"{P_GIFT} <b>Account Sold!</b>\nYour uploaded number +{acc['phone']} was sold.\n{P_CASH}{seller_cut} added to Sales Balance."
                        )
                    except Exception:
                        pass
            db.commit()

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
            await bot_client.send_file(uid, zip_filepath, caption=caption, parse_mode="html")

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
                try:
                    os.remove(zip_filepath)
                except Exception:
                    pass
            for acc in valid_sessions:
                delete_session_files(acc['sess'])
        return True

    elif data == "s2_qty_cancel":
        session_buy_state.pop(uid, None)
        await e.edit("❌ <b>Server 2 purchase cancelled.</b>", buttons=[[p_btn("Back", "srv_2_pg|1")]])
        return True

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
        return True

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

            if not row:
                await e.answer("❌ Sold out!", alert=True)
                return True
            phone, sess, c_icon, actual_year, twofa_pass, seller_id = row

            cur.execute("UPDATE users SET balance = balance - ? WHERE user_id=? AND balance >= ?", (final_price, uid, final_price))
            if cur.rowcount == 0:
                await e.answer("❌ Insufficient Balance!", alert=True)
                return True
            cur.execute("UPDATE stock SET available=0 WHERE phone=?", (phone,))
            db.commit()

        await e.edit(f"🔄 <b>Fetching Number (+{phone})...</b>")
        clean_sess = sess if not sess.endswith(".session") else sess[:-8]

        dyn_id, dyn_hash = get_api_credentials()
        client = TelegramClient(clean_sess, dyn_id, dyn_hash)
        try:
            await client.connect()
            if not await client.is_user_authorized():
                raise Exception("Session dead")
        except Exception:
            async with get_user_lock(uid):
                update_balance(uid, final_price)
                db.commit()
            await client.disconnect()
            await remove_invalid_server2_session(phone, sess, "authorization check failed during single purchase")
            await e.edit("❌ <b>Account Invalid.</b> Money refunded.", buttons=[[p_btn("Back", "srv_2_pg|1")]])
            return True

        await log_primary_purchase(uid, country, final_price, final_price, actual_year, 1, phone, "Server 2", phone)

        display_phone = f"+{phone.lstrip('+')}"
        twofa_hint = f"\n{P_SHIELD} <b>2FA Password:</b> <code>{twofa_pass}</code>" if twofa_pass and twofa_pass != "None" else ""
        msg = (f"{P_YES} <b>Account Purchased (Server 2)!</b>\n\n{P_PHONE} <b>Phone:</b> <code>{display_phone}</code>\n🏳️ <b>Country:</b> {c_icon} {country}{twofa_hint}\n\n"
               f"🔻 <b>INSTRUCTIONS:</b>\n1. Add Account in Telegram\n2. Enter number\n3. {P_TIME} Listening for OTP automatically...\n\n"
               f"<i>Note: Auto-cancels in 10 mins if no OTP arrives.</i>")

        btns = [
            [p_btn("📱 Manage Active Devices", f"s2_devs|{phone}")],
            [p_btn("🔄 Get OTP Again", f"get_otp_again|{phone}")],
            [p_btn("🚪 Finish & Logout", f"logout_bot|{phone}")],
        ]
        sent_msg = await e.edit(msg, buttons=btns)
        active_orders[phone] = {'uid': uid, 'client': client, 'sess': sess, 'start_time': time.time(), 'paid': False, 'price': final_price, 'country': country, 'year': actual_year, 'c_icon': c_icon, 'twofa': twofa_pass, 'seller_id': seller_id, 'msg_id': sent_msg.id}
        asyncio.create_task(auto_otp_task(phone))
        return True

    elif data.startswith("s2_get_otp|") or data.startswith("get_otp_again|"):
        phone = data.split("|")[1]
        if phone not in active_orders:
            await safe_answer_cb(e, "⚠️ Session already logged out or expired.", alert=True)
            return True

        order = active_orders[phone]
        client = order['client']
        start_time = order['start_time']

        await e.answer("🔄 Fetching latest OTP...", alert=False)
        try:
            latest_code = await get_latest_telegram_login_otp(client, start_time)

            if latest_code:
                twofa_text = f"{P_SHIELD} <b>2FA:</b> <code>{order['twofa']}</code>" if order['twofa'] != "None" else "🔓 <b>2FA:</b> <code>Disabled</code>"
                display_phone = f"+{phone.lstrip('+')}"
                msg = (f"{P_YES} <b>Latest OTP Fetched!</b>\n\n"
                       f"{P_PHONE} <b>Phone:</b> <code>{display_phone}</code>\n"
                       f"🏳️ <b>Country:</b> {order['c_icon']} {order['country']}\n"
                       f"{P_TIME} <b>OTP:</b> <code>{latest_code}</code>\n"
                       f"{twofa_text}")
                btns = [
                    [p_btn("🔄 Get OTP Again", f"get_otp_again|{phone}")],
                    [p_btn("📱 Manage Active Devices", f"s2_devs|{phone}")],
                    [p_btn("🚪 Finish & Logout", f"logout_bot|{phone}")],
                    [p_btn("Buy Another", f"s2_yr|{order['country']}")]
                ]
                try:
                    await e.edit(msg, buttons=btns)
                except MessageNotModifiedError:
                    pass
            else:
                await e.answer("⏳ No new OTP found yet. Try again in a few seconds.", alert=True)
        except Exception:
            await e.answer("❌ Error fetching OTP.", alert=True)
        return True

    elif data.startswith("logout_bot|"):
        phone = data.split("|")[1]
        if phone in active_orders:
            order = active_orders.pop(phone)
            try:
                await order['client'].log_out()
            except Exception:
                pass
            try:
                await order['client'].disconnect()
            except Exception:
                pass
            delete_session_files(order['sess'])
            await e.edit(f"{P_YES} <b>Session Finished & Logged out successfully.</b>", buttons=[[p_btn("Back to Menu", "menu_main")]])
        else:
            await e.answer("⚠️ No active order found or already logged out.", alert=True)
        return True

    elif data.startswith("s2_devs|"):
        phone = data.split("|")[1]
        await safe_answer_cb(e, "🔍 Checking active devices...", alert=False)

        client = None
        should_disconnect = False
        try:
            if phone in active_orders and active_orders[phone].get('client'):
                client = active_orders[phone]['client']
                if not client.is_connected():
                    await client.connect()
            else:
                sess_path = f"sessions/{phone}"
                if os.path.exists(sess_path + ".session"):
                    dyn_id, dyn_hash = get_api_credentials()
                    client = TelegramClient(sess_path, dyn_id, dyn_hash)
                    await client.connect()
                    should_disconnect = True
                else:
                    await safe_answer_cb(e, "⚠️ Session not found or already logged out.", alert=True)
                    return True

            if not await client.is_user_authorized():
                await safe_answer_cb(e, "❌ Session is no longer authorized.", alert=True)
                return True

            res = await client(GetAuthorizationsRequest())
            authorizations = getattr(res, "authorizations", []) or []
            other_devs = [a for a in authorizations if not getattr(a, "current", False)]
            display_phone = f"+{phone.lstrip('+')}"

            if not other_devs:
                msg = (
                    f"📱 <b>Active Devices & Sessions</b>\n\n"
                    f"📞 Phone: <code>{display_phone}</code>\n\n"
                    f"✅ <b>No other active devices found!</b>\n"
                    f"Only this bot session is currently connected to the account."
                )
                btns = [
                    [p_btn("🔄 Refresh Devices", f"s2_devs|{phone}")],
                    [p_btn("🔙 Back to Order", f"s2_back_ord|{phone}")],
                ]
            else:
                msg = (
                    f"📱 <b>Active Devices & Sessions</b>\n\n"
                    f"📞 Phone: <code>{display_phone}</code>\n"
                    f"Found <b>{len(other_devs)}</b> other active login session(s):\n\n"
                )
                btns = []
                for idx, dev in enumerate(other_devs, 1):
                    dev_model = getattr(dev, "device_model", "Unknown Device") or "Unknown Device"
                    platform = getattr(dev, "platform", "") or ""
                    app_name = getattr(dev, "app_name", "") or ""
                    app_version = getattr(dev, "app_version", "") or ""
                    ip = getattr(dev, "ip", "Unknown") or "Unknown"
                    country_loc = getattr(dev, "country", "") or ""
                    region = getattr(dev, "region", "") or ""
                    loc_str = f"{country_loc} ({region})" if region else (country_loc or "Unknown")

                    msg += (
                        f"<b>{idx}. {html.escape(str(dev_model))}</b>"
                        f"{f' ({html.escape(str(platform))})' if platform else ''}\n"
                        f"   • App: {html.escape(str(app_name))} {html.escape(str(app_version))}\n"
                        f"   • Location: {html.escape(str(loc_str))} [<code>{html.escape(str(ip))}</code>]\n\n"
                    )
                    btn_label = f"❌ Logout: {str(dev_model)[:18]}"
                    btns.append([p_btn(btn_label, f"s2_kick|{phone}|{dev.hash}")])

                btns.append([p_btn("🔄 Refresh Devices", f"s2_devs|{phone}")])
                btns.append([p_btn("🔙 Back to Order", f"s2_back_ord|{phone}")])

            try:
                await e.edit(msg, buttons=btns)
            except MessageNotModifiedError:
                pass
        except Exception as ex:
            await send_admin_error("Server 2 GetAuthorizations failed", f"Phone: {phone}\nError: {ex}")
            await safe_answer_cb(e, f"❌ Failed to fetch devices: {str(ex)[:100]}", alert=True)
        finally:
            if should_disconnect and client:
                try:
                    await client.disconnect()
                except Exception:
                    pass
        return True

    elif data.startswith("s2_kick|"):
        parts = data.split("|")
        phone = parts[1]
        auth_hash = int(parts[2])
        await safe_answer_cb(e, "⏳ Logging out device...", alert=False)

        client = None
        should_disconnect = False
        try:
            if phone in active_orders and active_orders[phone].get('client'):
                client = active_orders[phone]['client']
                if not client.is_connected():
                    await client.connect()
            else:
                sess_path = f"sessions/{phone}"
                if os.path.exists(sess_path + ".session"):
                    dyn_id, dyn_hash = get_api_credentials()
                    client = TelegramClient(sess_path, dyn_id, dyn_hash)
                    await client.connect()
                    should_disconnect = True
                else:
                    await safe_answer_cb(e, "⚠️ Session not found or already logged out.", alert=True)
                    return True

            if not await client.is_user_authorized():
                await safe_answer_cb(e, "❌ Session is no longer authorized.", alert=True)
                return True

            try:
                await client(ResetAuthorizationRequest(hash=auth_hash))
                await safe_answer_cb(e, "✅ Device logged out successfully!", alert=True)
            except FreshResetAuthorisationForbiddenError:
                await safe_answer_cb(
                    e,
                    "⚠️ Telegram Security: This session was logged in recently. Telegram requires a session to be active before it can terminate others. You can terminate it from your official app.",
                    alert=True
                )
            except Exception as kick_err:
                err_msg = str(kick_err)
                if "FRESH_RESET_AUTHORISATION_FORBIDDEN" in err_msg.upper():
                    await safe_answer_cb(
                        e,
                        "⚠️ Telegram Security: This session was logged in recently. Telegram requires a session to be active before it can terminate others. You can terminate it from your official app.",
                        alert=True
                    )
                else:
                    await safe_answer_cb(e, f"❌ Could not terminate device: {err_msg[:80]}", alert=True)

            res = await client(GetAuthorizationsRequest())
            authorizations = getattr(res, "authorizations", []) or []
            other_devs = [a for a in authorizations if not getattr(a, "current", False)]
            display_phone = f"+{phone.lstrip('+')}"

            if not other_devs:
                msg = (
                    f"📱 <b>Active Devices & Sessions</b>\n\n"
                    f"📞 Phone: <code>{display_phone}</code>\n\n"
                    f"✅ <b>No other active devices found!</b>\n"
                    f"Only this bot session is currently connected to the account."
                )
                btns = [
                    [p_btn("🔄 Refresh Devices", f"s2_devs|{phone}")],
                    [p_btn("🔙 Back to Order", f"s2_back_ord|{phone}")],
                ]
            else:
                msg = (
                    f"📱 <b>Active Devices & Sessions</b>\n\n"
                    f"📞 Phone: <code>{display_phone}</code>\n"
                    f"Found <b>{len(other_devs)}</b> other active login session(s):\n\n"
                )
                btns = []
                for idx, dev in enumerate(other_devs, 1):
                    dev_model = getattr(dev, "device_model", "Unknown Device") or "Unknown Device"
                    platform = getattr(dev, "platform", "") or ""
                    app_name = getattr(dev, "app_name", "") or ""
                    app_version = getattr(dev, "app_version", "") or ""
                    ip = getattr(dev, "ip", "Unknown") or "Unknown"
                    country_loc = getattr(dev, "country", "") or ""
                    region = getattr(dev, "region", "") or ""
                    loc_str = f"{country_loc} ({region})" if region else (country_loc or "Unknown")

                    msg += (
                        f"<b>{idx}. {html.escape(str(dev_model))}</b>"
                        f"{f' ({html.escape(str(platform))})' if platform else ''}\n"
                        f"   • App: {html.escape(str(app_name))} {html.escape(str(app_version))}\n"
                        f"   • Location: {html.escape(str(loc_str))} [<code>{html.escape(str(ip))}</code>]\n\n"
                    )
                    btn_label = f"❌ Logout: {str(dev_model)[:18]}"
                    btns.append([p_btn(btn_label, f"s2_kick|{phone}|{dev.hash}")])

                btns.append([p_btn("🔄 Refresh Devices", f"s2_devs|{phone}")])
                btns.append([p_btn("🔙 Back to Order", f"s2_back_ord|{phone}")])

            try:
                await e.edit(msg, buttons=btns)
            except MessageNotModifiedError:
                pass
        except Exception as ex:
            await safe_answer_cb(e, f"❌ Error: {str(ex)[:100]}", alert=True)
        finally:
            if should_disconnect and client:
                try:
                    await client.disconnect()
                except Exception:
                    pass
        return True

    elif data.startswith("s2_back_ord|"):
        phone = data.split("|")[1]
        display_phone = f"+{phone.lstrip('+')}"
        if phone in active_orders:
            order = active_orders[phone]
            twofa_text = f"{P_SHIELD} <b>2FA:</b> <code>{order['twofa']}</code>" if order.get('twofa') and order['twofa'] != "None" else "🔓 <b>2FA:</b> <code>Disabled</code>"
            msg = (
                f"{P_YES} <b>Account Order (Server 2)</b>\n\n"
                f"{P_PHONE} <b>Phone:</b> <code>{display_phone}</code>\n"
                f"🏳️ <b>Country:</b> {order.get('c_icon', '🌍')} {order.get('country', '')}\n"
                f"{twofa_text}\n\n"
                f"🔻 <b>INSTRUCTIONS:</b>\n1. Add Account in Telegram\n2. Enter number\n3. Tap 'Get OTP' when code is sent\n"
            )
            btns = [
                [p_btn("🔄 Get OTP Again", f"get_otp_again|{phone}")],
                [p_btn("📱 Manage Active Devices", f"s2_devs|{phone}")],
                [p_btn("🚪 Finish & Logout", f"logout_bot|{phone}")],
                [p_btn("Buy Another", f"s2_yr|{order.get('country', '')}")]
            ]
            try:
                await e.edit(msg, buttons=btns)
            except MessageNotModifiedError:
                pass
        else:
            await e.edit(
                f"{P_STORE} <b>Server 2 Session</b>\nPhone: <code>{display_phone}</code>\n\nSession finished or logged out.",
                buttons=[[p_btn("Back to Menu", "menu_main")]]
            )
        return True

    return False
