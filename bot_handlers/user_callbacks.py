"""User menus, profile, reseller, wallet transfer, seller, giveaways, and help callbacks."""
from __future__ import annotations

import html
import os
import re
import time
import random
from telethon import Button, TelegramClient
from telethon.errors import MessageNotModifiedError
from bot_helpers import (
    format_inr_amount,
    format_purchase_datetime,
    p_btn,
    bot_api_edit_text,
)


def _ensure_context():
    import bot
    g = globals()
    for k, v in bot.__dict__.items():
        if not k.startswith("__"):
            g.setdefault(k, v)


async def handle_user_callbacks(e, uid: int, data: str) -> bool:
    """Handle all user-facing menu, giveaway, and profile callbacks. Returns True if handled, False otherwise."""
    is_user_cb = (
        data.startswith("join_gwy|")
        or data.startswith("gwy_cf|")
        or data == "gwy_cancel"
        or data.startswith("join_fight|")
        or data.startswith("g_open|")
        or data.startswith("g_custom|")
        or data.startswith("g_buy|")
        or data in ("verify_join", "menu_main", "cancel_action", "tc_accept", "tc_reject", "menu_buy")
        or data.startswith("sort_provider|")
        or data.startswith("copy_phone|")
        or data in ("menu_account", "menu_reseller", "reseller_set_margin", "menu_transfer", "claim_promo", "tgl_curr")
        or data.startswith("xfer_do|")
        or data in ("wd_sales", "wd_to_main", "wd_to_upi", "wd_to_usdt")
        or data.startswith("wd_usdt_net|")
        or data in ("menu_sell", "menu_uploads")
        or data.startswith("up_manage|")
        or data.startswith("up_rm|")
        or data.startswith("sell_get|")
        or data.startswith("sell_rm_final|")
        or data == "menu_history"
        or data.startswith("page_purchases_")
        or data == "menu_help"
    )
    if not is_user_cb:
        return False

    _ensure_context()
    await _dispatch_user_callbacks(e, uid, data)
    return True


async def _dispatch_user_callbacks(e, uid: int, data: str):
    # Giveaway Join Callback
    if data.startswith("join_gwy|"):
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

