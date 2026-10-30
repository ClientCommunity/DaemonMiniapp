"""Server 5 (SMM Hub) callback queries handler."""
from __future__ import annotations

import html
from bot_helpers import p_btn, bot_api_edit_text


async def handle_server5_callback(e, uid: int, data: str) -> bool:
    """Handle all Server 5 SMM callback events. Returns True if handled, False otherwise."""
    if not (data.startswith("smm_") or data in ("smm_search", "smm_back_services")):
        return False

    import bot
    smm_state = bot.smm_state
    smm_search_results = bot.smm_search_results
    managed_connect = bot.managed_connect
    render_smm_categories = bot.render_smm_categories
    render_smm_services = bot.render_smm_services
    render_smm_search = bot.render_smm_search
    smm_service_rows = bot.smm_service_rows
    smm_quote = bot.smm_quote
    format_smm_money = bot.format_smm_money
    smm_place_order = bot.smm_place_order
    smm_refresh_order = bot.smm_refresh_order
    SMMError = bot.SMMError
    user_server_discount = bot.user_server_discount
    send_admin_error = bot.send_admin_error
    log_smm_purchase = bot.log_smm_purchase

    if data.startswith("smm_cats|"):
        parts = data.split('|')
        await render_smm_categories(e, max(1, int(parts[1])), parts[2] if len(parts) > 2 else '')
        return True

    elif data.startswith("smm_brand|"):
        _, brand, page = data.split('|')
        await render_smm_categories(e, int(page), brand)
        return True

    elif data.startswith("smm_cat|"):
        parts = data.split('|')
        cid = parts[1]
        page = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 1
        with managed_connect() as conn:
            cat = conn.execute("SELECT display_name FROM smm_categories WHERE id=? AND visible=1", (int(cid),)).fetchone()
        if not cat:
            await e.answer("Category unavailable.", alert=True)
            return True
        if len(parts) > 3 and parts[3] == 'search':
            search_page = int(parts[4]) if len(parts) > 4 and parts[4].isdigit() else 1
            back_target = f"smm_searchpage|{search_page}"
        elif len(parts) > 3 and parts[3].isdigit():
            cat_page = int(parts[3])
            brand = parts[4] if len(parts) > 4 else ''
            back_target = f"smm_cats|{cat_page}|{brand}" if brand else f"smm_cats|{cat_page}"
        else:
            back_target = "smm_cats|1"
        await render_smm_services(e, uid, int(page), '', 'az', cat['display_name'], back_target=back_target)
        return True

    elif data.startswith("smm_page|"):
        _, page, sort = data.split("|")
        state = smm_search_results.get(uid, {})
        await render_smm_services(e, uid, int(page), state.get('query', ''), sort, state.get('category_name', ''), back_target=state.get('back_target'))
        return True

    elif data == "smm_search":
        smm_state[uid] = {"step": "search"}
        await e.edit("🔍 <b>Search Services</b>\n\nSend a service name or Service ID.", buttons=[[p_btn("Back", "smm_cats|1")]])
        return True

    elif data.startswith("smm_searchpage|"):
        state = smm_search_results.get(uid)
        if not state:
            await e.answer("Search expired.", alert=True)
            return True
        await render_smm_search(e, uid, state['query'], int(data.split('|')[1]))
        return True

    elif data.startswith("smm_sort|"):
        page = data.split('|')[1]
        await e.edit(
            "🔃 <b>Sort Services</b>",
            buttons=[
                [p_btn("💰 Price Low → High", f"smm_page|{page}|price_low")],
                [p_btn("💰 Price High → Low", f"smm_page|{page}|price_high")],
                [p_btn("🔤 A → Z", f"smm_page|{page}|az")],
                [p_btn("🔥 Popular", f"smm_page|{page}|popular")]
            ]
        )
        return True

    elif data.startswith("smm_view|"):
        sid = int(data.split('|')[1])
        rows = [r for r in smm_service_rows(limit=100000) if r['id'] == sid]
        if not rows:
            await e.answer("Service unavailable.", alert=True)
            return True
        r = rows[0]
        q = smm_quote(sid, 1000, enforce_limits=False)
        back_target = smm_search_results.get(uid, {}).get("back_target")
        smm_state[uid] = {"step": "link", "service_id": sid, "category_name": r['category_name'], "back_target": back_target}
        raw_description = ' '.join(str(r['description'] or '').split())
        description = raw_description[:700]
        description_block = (f"<blockquote expandable>{html.escape(description)}{'…' if len(raw_description) > 700 else ''}</blockquote>\n\n" if description else "")
        detail_text = (
            f"{r['emoji']} <b>{html.escape(r['name'])}</b>\n\n{description_block}"
            f"Price: <b>₹{format_smm_money(q.charge)} per 1000</b>\nMinimum: <b>{r['minimum']}</b>\nMaximum: <b>{r['maximum']}</b>\n"
            f"Average time: <b>{html.escape(r['average_time'] or 'Not specified')}</b>\nRefill: {'✅' if r['refill'] else '❌'} · Cancel: {'✅' if r['cancellable'] else '❌'}\n\nSend the target link."
        )
        if not await bot_api_edit_text(e, detail_text, [[{"text": "↩ Back to Services", "callback_data": "smm_back_services", "style": "danger"}]]):
            await e.edit(
                f"{r['emoji']} <b>{html.escape(r['name'])}</b>\n\nPrice: <b>₹{format_smm_money(q.charge)} per 1000</b>\nMinimum: <b>{r['minimum']}</b>\nMaximum: <b>{r['maximum']}</b>\nAverage time: <b>{html.escape(r['average_time'] or 'Not specified')}</b>\n\nSend the target link.",
                buttons=[[p_btn("↩ Back to Services", "smm_back_services", style="danger")]]
            )
        return True

    elif data == "smm_back_services":
        state = smm_state.pop(uid, None)
        category = state.get('category_name', '') if state else ''
        back_target = state.get('back_target') if state else None
        if category:
            await render_smm_services(e, uid, 1, '', 'az', category, back_target=back_target)
        elif back_target:
            parts = back_target.split('|')
            if parts[0] == 'smm_cats':
                await render_smm_categories(e, max(1, int(parts[1])), parts[2] if len(parts) > 2 else '')
            elif parts[0] == 'smm_searchpage':
                state_sr = smm_search_results.get(uid, {})
                await render_smm_search(e, uid, state_sr.get('query', ''), int(parts[1]))
            else:
                await render_smm_categories(e, 1)
        else:
            await render_smm_categories(e, 1)
        return True

    elif data.startswith("smm_confirm|"):
        parts = data.split('|')
        sid, qty = parts[1], parts[2]
        request_id = parts[3] if len(parts) > 3 else None
        state = smm_state.get(uid)
        if not state or state.get('step') != 'confirm' or state.get('service_id') != int(sid) or state.get('quantity') != int(qty) or (request_id and state.get('request_id') != request_id):
            await e.answer("Confirmation expired.", alert=True)
            return True
        smm_state.pop(uid, None)
        try:
            entity = await e.get_sender()
            oid, porder, q = await smm_place_order(uid, getattr(entity, 'username', None), int(sid), int(qty), state['link'], request_id or state.get('request_id'), user_server_discount(uid, 5))
        except SMMError as exc:
            if exc.code == "RATE_LIMIT":
                await e.edit("⏳ <b>Provider Busy (Rate Limit)</b>\n\nThe upstream SMM provider is currently processing a high volume of requests. Please wait a moment and try placing your order again.", buttons=[[p_btn("Try Again", f"smm_buy|{sid}")], [p_btn("Services", "smm_page|1|price_low")]])
                return True
            await send_admin_error(f"Server 5 order failed for user {uid}", exc.detail)
            await e.edit("❌ Order could not be placed. No successful order was charged. Support has been notified.", buttons=[[p_btn("Services", "smm_page|1|price_low")]])
            return True
        with managed_connect() as conn:
            service_row = conn.execute("SELECT name FROM smm_services WHERE id=?", (int(sid),)).fetchone()
        await log_smm_purchase(uid, state['link'], q.charge, service_row['name'] if service_row else sid, oid)
        await e.edit(
            f"✅ <b>Order Placed</b>\n\nOrder: <code>#{oid}</code>\nQuantity: {qty}\nCharge: ₹{format_smm_money(q.charge)}\nStatus: Pending",
            buttons=[[p_btn("📦 View Order", f"smm_order|{oid}", style="success")], [p_btn("Services", "smm_page|1|price_low")]]
        )
        return True

    elif data.startswith("smm_orders|"):
        page = int(data.split('|')[1])
        limit = 10
        with managed_connect() as conn:
            rows = conn.execute(
                "SELECT o.id,o.status,o.charge,o.quantity,s.name FROM smm_orders o JOIN smm_services s ON s.id=o.service_id WHERE o.user_id=? ORDER BY o.id DESC LIMIT ? OFFSET ?",
                (uid, limit + 1, (page - 1) * limit)
            ).fetchall()
        buttons = [[p_btn(f"#{r['id']} · {r['name']} · {r['status'].title()} · ₹{r['charge']:.2f}", f"smm_order|{r['id']}")] for r in rows[:limit]]
        nav = []
        if page > 1:
            nav.append(p_btn("Prev", f"smm_orders|{page-1}"))
        if len(rows) > limit:
            nav.append(p_btn("Next", f"smm_orders|{page+1}"))
        if nav:
            buttons.append(nav)
        buttons.append([p_btn("Services", "smm_page|1|price_low")])
        await e.edit("📦 <b>My Orders</b>\n\nTrack status or order again.", buttons=buttons)
        return True

    elif data.startswith("smm_order|"):
        oid = int(data.split('|')[1])
        with managed_connect() as conn:
            o = conn.execute(
                "SELECT o.*,s.name,s.refill,s.cancellable FROM smm_orders o JOIN smm_services s ON s.id=o.service_id WHERE o.id=? AND o.user_id=?",
                (oid, uid)
            ).fetchone()
        if not o:
            await e.answer("Order not found.", alert=True)
            return True
        buttons = [
            [p_btn("🔄 Refresh", f"smm_refresh|{oid}", style="primary")],
            [p_btn("🔁 Order Again", f"smm_view|{o['service_id']}")],
            [p_btn("Back", "smm_orders|1")]
        ]
        await e.edit(
            f"📦 <b>Order #{oid}</b>\n\nService: {html.escape(o['name'])}\nQuantity: {o['quantity']}\nCharge: ₹{o['charge']:.2f}\nStatus: <b>{o['status'].title()}</b>\nStart Count: {o['start_count'] or '-'}\nRemains: {o['remains'] if o['remains'] is not None else '-'}\nCreated: {o['created_at']}",
            buttons=buttons
        )
        return True

    elif data.startswith("smm_refresh|"):
        oid = int(data.split('|')[1])
        try:
            status, _, refund = await smm_refresh_order(oid)
            notice = f"Status: {status.title()}"
            if refund:
                notice += f" · ₹{format_smm_money(refund['amount'])} refunded"
            await e.answer(notice, alert=True)
        except SMMError as exc:
            await send_admin_error(f"Order {oid} refresh failed", exc.detail)
            await e.answer("Could not refresh now.", alert=True)
        return True

    return False
