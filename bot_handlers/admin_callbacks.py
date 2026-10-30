"""Admin dashboard, settings, permissions, and payment review callbacks handler."""
from __future__ import annotations

import asyncio
import html
import os
import re
import time
import sqlite3
import zipfile
from telethon import Button, TelegramClient
from telethon.errors import MessageNotModifiedError, SessionPasswordNeededError
from telethon.tl.functions.account import GetPasswordRequest
from database import get_user_order_stats, get_overall_order_stats
from bot_helpers import (
    COUNTRY_CODES,
    ConversationCancelled,
    format_inr_amount,
    p_btn,
    bot_api_edit_text,
)


def _ensure_context(event=None):
    client = getattr(event, "client", None)
    import sys
    bot_mod = sys.modules.get("bot")
    if not bot_mod:
        import bot as bot_mod
    g = globals()
    for k in dir(bot_mod):
        if not k.startswith("__"):
            try:
                g.setdefault(k, getattr(bot_mod, k))
            except Exception:
                pass
    if client:
        g["bot"] = client
    elif hasattr(bot_mod, "bot"):
        g["bot"] = getattr(bot_mod, "bot")


async def handle_admin_callback(e, uid: int, data: str) -> bool:
    """Handle all administrative dashboard, settings, and review callbacks. Returns True if handled, False otherwise."""
    is_admin_cb = (
        data.startswith("adm_")
        or data.startswith("kp_adm|")
        or data.startswith("wd_act|")
        or data.startswith("dep_act|")
        or data.startswith("fampay_review_action|")
    )
    if not is_admin_cb:
        return False

    _ensure_context(e)
    import sys
    bot_module = sys.modules.get("bot")
    if not bot_module:
        import bot as bot_module
    live_client = getattr(e, "client", None)
    bot = live_client or getattr(bot_module, "bot", bot_module)
    globals()["bot"] = bot
    ADMIN_IDS = getattr(bot_module, "ADMIN_IDS", globals().get("ADMIN_IDS", []))
    is_admin = getattr(bot_module, "is_admin", globals().get("is_admin"))
    safe_answer_cb = getattr(bot_module, "safe_answer_cb", globals().get("safe_answer_cb"))
    if not is_admin:
        def is_admin(target_uid):
            return target_uid in ADMIN_IDS or bool(cur.execute("SELECT user_id FROM admins WHERE user_id=?", (target_uid,)).fetchone())

    if not is_admin(uid):
        await safe_answer_cb(e, "Unauthorized.", alert=True)
        return True

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


    if data.startswith("fampay_review_action|"):
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


    # --- KEYPAD DYNAMIC LOGIC FOR ADMINS ---
    if data.startswith("kp_adm|"):
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
            # 1. Send success message to user FIRST!
            try:
                await bot.send_message(t_uid, f"✅ Your {html.escape(method_label)} payment of ₹{final_amt} has been approved and credited.")
            except Exception as u_ex:
                logger.warning("Failed to message user on keypad deposit: %s", u_ex)

            # 2. Update Admin UI
            try:
                await e.edit(f"✅ Approved <b>{html.escape(method_label)}</b> and credited ₹{final_amt} to user <code>{t_uid}</code>!")
            except Exception:
                pass

            # 3. Safely log to proof channel
            try:
                await log_primary_deposit(t_uid, final_amt, f"CONSOLE_{method_label}")
            except Exception as ch_ex:
                logger.warning("Proof channel logging failed: %s", ch_ex)
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
                [p_btn("Broadcast", "adm_bcast"), p_btn("📌 Pinned Services", "adm_pinned")],
                [p_btn("Discount", "adm_discount")],
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

        elif action == "pinned":
            with managed_connect() as conn:
                rows = conn.execute("SELECT id, server_no, service_name, badge, is_active FROM pinned_services ORDER BY server_no, display_order, id ASC").fetchall()
            txt = "📌 <b>Pinned / Featured Services</b>\n\nManage services pinned to Mini App & Bot.\nTap a service to view, toggle, broadcast, or remove:\n"
            if not rows:
                txt += "\n<i>No services currently pinned. Pin services from Mini App Admin Panel or add one here.</i>"
            btns = []
            for r in rows:
                status = "🟢" if r["is_active"] else "🔴"
                btns.append([p_btn(f"{status} [{r['badge']}] S{r['server_no']} • {r['service_name'][:25]}", f"adm_pinview|{r['id']}")])
            btns.append([p_btn("↩ Back to Admin", "adm_adminmain")])
            await e.edit(txt, buttons=btns)

        elif action.startswith("adm_pinview|"):
            pid = int(action.split("|")[1])
            with managed_connect() as conn:
                r = conn.execute("SELECT * FROM pinned_services WHERE id = ?", (pid,)).fetchone()
            if not r:
                return await e.answer("Pinned service not found.", alert=True)
            status = "🟢 ACTIVE" if r["is_active"] else "🔴 INACTIVE"
            txt = (
                f"📌 <b>Pinned Service #{r['id']}</b>\n\n"
                f"Server: <b>Server {r['server_no']}</b>\n"
                f"Service Name: <b>{html.escape(r['service_name'])}</b>\n"
                f"Service ID: <code>{html.escape(r['service_id'])}</code>\n"
                f"Category: <b>{html.escape(r['category_name'] or 'N/A')}</b>\n"
                f"Badge: <b>{r['badge']}</b>\n"
                f"Status: <b>{status}</b>\n"
                f"Order: <b>{r['display_order']}</b>\n"
            )
            btns = [
                [p_btn(f"Toggle {'Off 🔴' if r['is_active'] else 'On 🟢'}", f"adm_pintoggle|{pid}")],
                [p_btn("📢 Broadcast to All Users", f"adm_pinbcast|{pid}", style="primary")],
                [p_btn("🗑 Remove Pin", f"adm_pindel|{pid}", style="danger")],
                [p_btn("↩ Back to Pinned List", "adm_pinned")]
            ]
            await e.edit(txt, buttons=btns)

        elif action.startswith("adm_pintoggle|"):
            pid = int(action.split("|")[1])
            with managed_connect() as conn:
                conn.execute("UPDATE pinned_services SET is_active = CASE is_active WHEN 1 THEN 0 ELSE 1 END WHERE id = ?", (pid,))
                conn.commit()
            return await handle_admin_callback(e, uid, f"adm_adm_pinview|{pid}")

        elif action.startswith("adm_pindel|"):
            pid = int(action.split("|")[1])
            with managed_connect() as conn:
                conn.execute("DELETE FROM pinned_services WHERE id = ?", (pid,))
                conn.commit()
            await e.answer("Pinned service deleted.", alert=True)
            return await handle_admin_callback(e, uid, "adm_pinned")

        elif action.startswith("adm_pinbcast|"):
            pid = int(action.split("|")[1])
            from services.admin_service import broadcast_pinned_service
            await e.edit("✈️ <b>Broadcasting pinned service to all Telegram bot users...</b>\nPlease wait.")
            try:
                res = broadcast_pinned_service(pid)
                await e.edit(f"✅ <b>Broadcast Completed!</b>\n\nService: <b>{html.escape(res['service_name'])}</b>\nSent: <b>{res['sent']}</b>\nFailed: <b>{res['failed']}</b>\nTotal users: <b>{res['total_users']}</b>", buttons=[[p_btn("Back to Pinned", "adm_pinned")]])
            except Exception as ex:
                await e.edit(f"❌ Broadcast failed: {html.escape(str(ex))}", buttons=[[p_btn("Back", f"adm_pinview|{pid}")]])

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
            stats = get_overall_order_stats(cur)

            msg = (f"📊 <b>ADVANCED STATS</b>\n\n👥 <b>Total Users:</b> {u}\n📦 <b>Accounts in Stock:</b> {s}\n"
                   f"💰 <b>Total UPI Revenue:</b> ₹{r}\n\n💳 <b>Overall Users Balance:</b> ₹{total_bal}\n"
                   f"🛒 <b>Total Orders Sold:</b> {stats['total_orders']}\n"
                   f"💲 <b>Overall Sales Amount:</b> ₹{stats['total_spent']}\n\n"
                   f"📊 <b>Sales by Server:</b>\n"
                   f"  • S1/S2 Accounts: {stats['server1_2']['orders']} (₹{stats['server1_2']['spent']})\n"
                   f"  • Server 3 OTP: {stats['server3']['orders']} (₹{stats['server3']['spent']})\n"
                   f"  • Server 4 SMS: {stats['server4']['orders']} (₹{stats['server4']['spent']})\n"
                   f"  • Server 5 SMM: {stats['server5']['orders']} (₹{stats['server5']['spent']})")
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
            await safe_answer_cb(e, "⏳ Creating compressed database snapshot...", alert=False)
            status_msg = None
            zip_file = None
            try:
                status_msg = await bot.send_message(uid, "📦 <b>Creating database snapshot & compressing...</b>\n<i>Please wait 3-5 seconds.</i>")
                from services.admin_service import create_compressed_database_backup
                zip_file, orig_sz, comp_sz = await asyncio.to_thread(create_compressed_database_backup)

                orig_mb = orig_sz / (1024 * 1024)
                comp_mb = comp_sz / (1024 * 1024)
                reduction = (1 - (comp_sz / max(orig_sz, 1))) * 100

                now_str = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
                caption = (
                    f"✅ <b>Full Database Backup Ready</b>\n\n"
                    f"🗄️ Database: <code>otp_bot_final.db</code>\n"
                    f"📊 Uncompressed Size: <b>{orig_mb:.2f} MB</b>\n"
                    f"🗜️ Compressed Size: <b>{comp_mb:.2f} MB</b> (-{reduction:.1f}%)\n"
                    f"⏰ Created: <code>{now_str}</code>\n\n"
                    f"<i>Safe archive containing all users, balances, stock, and orders.</i>"
                )
                await bot.send_file(uid, zip_file, caption=caption, parse_mode="html")
                if status_msg:
                    try:
                        await status_msg.delete()
                    except Exception:
                        pass
            except Exception as ex:
                logger.error("Admin Telegram backup failed: %s", ex, exc_info=True)
                await send_admin_error("Backup failed", str(ex))
                await bot.send_message(uid, f"❌ <b>Backup failed:</b> {html.escape(str(ex))}")
            finally:
                if zip_file and os.path.exists(zip_file):
                    try:
                        os.remove(zip_file)
                    except Exception:
                        pass
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
            _,gid,field=action.split("|",2);payment_admin_state[uid]={"step":f"fpg_edit_{field}","gateway_id":int(gid)}
            prompts = {
                "gmail": "✉️ Send the full Gmail address used for IMAP auto-verification (example: <code>yourname@gmail.com</code>).",
                "password": "🔑 Send the 16-character Google App Password (from myaccount.google.com/apppasswords).",
                "upi": "💳 Send the new UPI ID (example: <code>name@fam</code>).",
                "limits": "📊 Send the deposit limits as <code>minimum | maximum</code> (example: <code>50 | 10000</code>)."
            }
            await e.edit(prompts.get(field, f"Send new {field} value."), buttons=[[p_btn("Cancel", f"adm_fampay_gateway|{gid}")]])
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
            btns = [[p_btn(f"💰 Change Price for {year}", f"adm_msedit|yprice|{c_name}|{year}")]]
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

                    up_row = cur.execute("SELECT SUM(amount) FROM upi_orders WHERE user_id=? AND status='success'", (t_uid,)).fetchone()
                    stats = get_user_order_stats(cur, t_uid)

                    bal, dep, joined, is_banned, disc = u_row
                    u_upi = up_row[0] if up_row and up_row[0] else 0

                    msg = (f"👤 <b>USER INFO:</b> <code>{t_uid}</code>\n\n"
                           f"💰 Balance: ₹{bal}\n"
                           f"💳 Total Deposited: ₹{dep}\n"
                           f"🏦 UPI Deposited: ₹{u_upi}\n"
                           f"🛒 Total Orders: {stats['total_orders']}\n"
                           f"💲 Total Spent: ₹{stats['total_spent']}\n\n"
                           f"📊 <b>Server Breakdown:</b>\n"
                           f"  • S1/S2 Accounts: {stats['server1_2']['orders']} (₹{stats['server1_2']['spent']})\n"
                           f"  • Server 3 OTP: {stats['server3']['orders']} (₹{stats['server3']['spent']})\n"
                           f"  • Server 4 SMS: {stats['server4']['orders']} (₹{stats['server4']['spent']})\n"
                           f"  • Server 5 SMM: {stats['server5']['orders']} (₹{stats['server5']['spent']})\n\n"
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
                        cur.execute("INSERT OR REPLACE INTO auto_prices (country, year, price) VALUES (?, 'Common', ?)", (c_name, new_p))
                        db.commit()
                        await bot.send_message(uid, f"✅ All existing '{c_name}' accounts updated to ₹{new_p}!\nDefault price for new accounts also updated to ₹{new_p}.")
                    elif m_act == "yprice":
                        year = parts[3]
                        new_p = int((await get_reply(f"💰 <b>Enter NEW Price for {c_name} ({year}):</b>")).text)
                        cur.execute("UPDATE stock SET price=? WHERE country_name=? AND account_year=?", (new_p, c_name, year))
                        cur.execute("INSERT OR REPLACE INTO auto_prices (country, year, price) VALUES (?,?,?)", (c_name, str(year), new_p))
                        db.commit()
                        await bot.send_message(uid, f"✅ All existing '{c_name}' ({year}) accounts updated to ₹{new_p}!\nDefault price for new accounts also updated to ₹{new_p}.")

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
                    min_m=fampay_setting("reseller_min_margin", "5"); max_m=fampay_setting("reseller_max_margin", "100")
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
            clean_id = str(order_id).replace("M", "").strip()
            if action == "app":
                req_row = cur.execute("SELECT amount, status FROM deposits WHERE id=?", (clean_id,)).fetchone()
                if req_row and req_row[1] == "success":
                    await e.edit(f"ℹ️ Deposit <code>{order_id}</code> was already approved!")
                    return

                real_amt = int(req_row[0]) if (req_row and req_row[0]) else amt
                update_balance(t_uid, real_amt)
                cur.execute("UPDATE users SET total_deposited = total_deposited + ? WHERE user_id=?", (real_amt, t_uid))
                cur.execute("UPDATE deposits SET status='success', amount=? WHERE id=?", (real_amt, clean_id))
                db.commit()

                # 1. Immediately send success message to user!
                try:
                    await bot.send_message(t_uid, f"✅ Your manual payment of ₹{real_amt} has been approved and credited.")
                except Exception as u_ex:
                    logger.warning("Failed to message user %s on deposit approval: %s", t_uid, u_ex)

                # 2. Immediately update Admin UI so button shows approved
                try:
                    await e.edit(f"✅ Approved and credited ₹{real_amt} to user <code>{t_uid}</code>!")
                except Exception:
                    try:
                        await e.answer(f"✅ Approved and credited ₹{real_amt} to user {t_uid}!", alert=True)
                    except Exception:
                        pass

                # 3. Safely log to proof channel without EVER interrupting the approval
                try:
                    await log_primary_deposit(t_uid, real_amt, "MANUAL (Approved)")
                except Exception as ch_ex:
                    logger.warning("Proof channel logging failed (approval succeeded): %s", ch_ex)
            else:
                cur.execute("UPDATE deposits SET status='rejected' WHERE id=?", (clean_id,))
                db.commit()
                try:
                    await bot.send_message(t_uid, f"❌ Your deposit transaction was rejected by admin review.")
                except Exception as u_ex:
                    logger.warning("Failed to message user %s on reject: %s", t_uid, u_ex)
                try:
                    await e.edit(f"❌ Rejected deposit proof for user <code>{t_uid}</code>.")
                except Exception:
                    pass


    return True
