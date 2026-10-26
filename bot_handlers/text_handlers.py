"""Text message input and multi-step interactive state machine handlers."""
from __future__ import annotations

import asyncio
import datetime
from datetime import timezone
import html
import os
import re
import secrets
import shutil
import sqlite3
import time
from telethon import Button, TelegramClient
from telethon.errors import SessionPasswordNeededError
from telethon.tl.functions.account import GetPasswordRequest, UpdatePasswordSettingsRequest
from database import get_admin_log_channel_id
from bot_helpers import (
    COUNTRY_CODES,
    country_button_label,
    find_country_matches,
    format_inr_amount,
    generate_random_password,
    p_btn,
    bot_api_edit_text,
)


def _ensure_context():
    import bot
    g = globals()
    for k, v in bot.__dict__.items():
        if not k.startswith("__"):
            g.setdefault(k, v)
    if "bot" in bot.__dict__:
        g["bot"] = bot.__dict__["bot"]


async def handle_text_input(e, uid: int, text: str, raw_text: str) -> bool:
    """Handle multi-step interactive text inputs. Returns True if a state handled the message, False otherwise."""
    _ensure_context()
    file_obj = getattr(e, "file", None)
    file_name = getattr(file_obj, "name", "") or ""
    has_state = (
        uid in smm_state
        or uid in fampay_review_state
        or file_name.casefold().endswith(".session")
        or uid in session_buy_state
        or uid in reseller_state
        or uid in giveaway_ticket_state
        or uid in restore_state
        or uid in lzt_search_state
        or uid in server3_search_state
        or uid in server4_country_search_state
        or uid in server4_search_state
        or (uid in payment_admin_state and is_admin(uid))
        or uid in promo_state
        or uid in fampay_deposit_state
        or uid in manual_dep_state
        or uid in transfer_state
        or uid in sell_state
    )
    if not has_state:
        return False

    await _dispatch_text_input(e, uid, text, raw_text)
    return True


async def _dispatch_text_input(e, uid: int, text: str, raw_text: str):
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
            field=step.removeprefix("fpg_edit_");gid=state["gateway_id"];raw_input=(getattr(e,"raw_text",None) or text).strip()
            try:
                if field=="upi":
                    clean_upi=re.sub(r"<[^>]+>","",raw_input).strip()
                    if not re.fullmatch(r"[A-Za-z0-9._-]{2,128}@[A-Za-z]{2,32}",clean_upi):raise ValueError
                    cur.execute("UPDATE fampay_gateways SET upi_id=? WHERE id=?",(clean_upi,gid))
                elif field=="limits":
                    minimum,maximum=[int(x.strip()) for x in raw_input.split("|",1)];assert 1<=minimum<=maximum<=50000;cur.execute("UPDATE fampay_gateways SET min_deposit=?,max_deposit=? WHERE id=?",(minimum,maximum,gid))
                elif field=="gmail":
                    clean_email=re.sub(r"<[^>]+>","",raw_input).replace("mailto:","").strip().lower()
                    if "@" not in clean_email and clean_email:clean_email+="@gmail.com"
                    if not re.fullmatch(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",clean_email):raise ValueError
                    cur.execute("UPDATE fampay_gateways SET gmail=? WHERE id=?",(clean_email,gid))
                else:
                    clean_pw=raw_input.replace(" ","").strip()
                    if len(clean_pw)<8:raise ValueError
                    cur.execute("UPDATE fampay_gateways SET app_password=? WHERE id=?",("enc:"+encrypt_secret(clean_pw),gid))
            except (ValueError,AssertionError):
                prompts={"gmail":"❌ Invalid email format. Send a valid address, for example: <code>yourname@gmail.com</code>.",
                         "upi":"❌ Invalid UPI ID. Send in format: <code>username@handle</code> (for example <code>name@fam</code>).",
                         "limits":"❌ Invalid limits. Send in format: <code>minimum | maximum</code> (for example <code>50 | 10000</code>).",
                         "password":"❌ Invalid app password. Google App Passwords must be at least 8 characters (normally 16 letters)."}
                return await e.reply(prompts.get(field,"❌ Invalid value. Please try again."))
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
            admin_ch = get_admin_log_channel_id()
            if admin_ch:
                await bot.send_file(admin_ch, e.media, caption=caption, parse_mode='html', buttons=btns)
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
