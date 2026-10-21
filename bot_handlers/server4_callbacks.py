"""Server 4 (TemporaSMS) callback queries handler."""
from __future__ import annotations

import html
import time
from datetime import datetime, timezone
from bot_helpers import p_btn, p_copy_btn


async def handle_server4_callback(e, uid: int, data: str) -> bool:
    """Handle all Server 4 TemporaSMS callback events. Returns True if handled, False otherwise."""
    if not (data.startswith("srv4_") or data == "srv4_operators"):
        return False

    import bot
    managed_connect = bot.managed_connect
    managed_server_name = bot.managed_server_name
    get_flag_by_country_name = bot.get_flag_by_country_name
    server4_search_state = bot.server4_search_state
    server4_country_search_state = bot.server4_country_search_state
    server4_purchase_state = bot.server4_purchase_state
    server4 = bot.server4
    server4_client = bot.server4_client
    provider_sort = bot.provider_sort
    apply_server_discount = bot.apply_server_discount
    expiry_timestamp = bot.expiry_timestamp
    cancellation_wait = bot.cancellation_wait
    provider_phone_details = bot.provider_phone_details
    log_primary_purchase = bot.log_primary_purchase
    complete_order = bot.complete_order
    cancel_and_refund = bot.cancel_and_refund
    send_admin_error = bot.send_admin_error
    TemporaError = bot.TemporaError
    cur = bot.cur
    db = bot.db

    if data == "srv4_operators":
        with managed_connect() as conn:
            rows = conn.execute("""SELECT code,name FROM server4_operators o WHERE enabled=1
              AND EXISTS(SELECT 1 FROM server4_stock s WHERE s.operator_code=o.code AND s.available_count>0)
              ORDER BY name""").fetchall()
        buttons = [[p_btn(f"📡 {r['name']}", f"srv4_countries|{r['code']}|1", style="primary")] for r in rows]
        buttons.append([p_btn("Back", "menu_buy")])
        await e.edit(f"🌐 <b>{html.escape(managed_server_name(4))}</b>\nChoose a network." if rows else "Stock is updating. Please try again shortly.", buttons=buttons)
        return True

    elif data.startswith("srv4_countries|"):
        _, operator, page_text = data.split("|")
        page = int(page_text)
        limit = 15
        with managed_connect() as conn:
            rows = conn.execute("""SELECT c.country_code,c.name,COUNT(DISTINCT s.service_code) service_count,SUM(s.available_count) total_stock FROM server4_countries c
              JOIN server4_stock s ON s.operator_code=c.operator_code AND s.country_code=c.country_code
              WHERE c.operator_code=? AND c.enabled=1 AND c.in_stock=1
              AND EXISTS(SELECT 1 FROM server4_stock s WHERE s.operator_code=c.operator_code AND s.country_code=c.country_code AND s.available_count>0)
              GROUP BY c.country_code,c.name ORDER BY c.name LIMIT ? OFFSET ?""", (operator, limit + 1, (page - 1) * limit)).fetchall()
        buttons = [[p_btn(f"{get_flag_by_country_name(r['name'])} {r['name']} · {r['service_count']} services", f"srv4_services|{operator}|{r['country_code']}|1", style="primary")] for r in rows[:limit]]
        buttons.insert(0, [p_btn("🔎 Search Countries", f"srv4_country_search|{operator}", style="primary"), p_btn("🔎 Search Services", f"srv4_search|{operator}", style="success")])
        nav = []
        if page > 1:
            nav.append(p_btn("Prev", f"srv4_countries|{operator}|{page-1}"))
        if len(rows) > limit:
            nav.append(p_btn("Next", f"srv4_countries|{operator}|{page+1}"))
        if nav:
            buttons.append(nav)
        buttons.append([p_btn("Back", "srv4_operators")])
        await e.edit("🏳️ <b>Choose Country</b>", buttons=buttons)
        return True

    elif data.startswith("srv4_search|"):
        operator = data.split("|", 1)[1]
        server4_search_state[uid] = operator
        await e.edit(f"🔎 <b>Search {html.escape(managed_server_name(4))}</b>\n\nSend a service name or code, for example <code>WhatsApp</code>, <code>Telegram</code>, <code>wa</code>, or <code>tg</code>.", buttons=[[p_btn("Cancel", f"srv4_countries|{operator}|1")]])
        return True

    elif data.startswith("srv4_country_search|"):
        operator = data.split("|", 1)[1]
        server4_country_search_state[uid] = operator
        await e.edit(f"🔎 <b>Search Countries</b>\n\nSend a country name or country code, for example <code>India</code>, <code>22</code>, <code>United States</code>, or <code>US</code>.", buttons=[[p_btn("Cancel", f"srv4_countries|{operator}|1")]])
        return True

    elif data.startswith("srv4_services|"):
        _, operator, country, page_text = data.split("|")
        page = int(page_text)
        limit = 15
        with managed_connect() as conn:
            rows = conn.execute("""SELECT v.service_code,v.name,s.min_price,s.available_count FROM server4_services v
              JOIN server4_stock s ON s.operator_code=v.operator_code AND s.service_code=v.service_code
              WHERE v.operator_code=? AND s.country_code=? AND v.enabled=1 AND v.in_stock=1 AND s.available_count>0
              """, (operator, country)).fetchall()
        cfg = server4.config()
        prepared = [(r, max(cfg.minimum_price, r['min_price'] * (1 + cfg.percent_markup / 100) + cfg.fixed_markup)) for r in rows]
        mode = provider_sort(uid, 4)
        prepared.sort(key=(lambda item: item[1]) if mode == "price_low" else (lambda item: -item[1]) if mode == "price_high" else (lambda item: item[0]['name'].casefold()))
        visible = prepared[(page - 1) * limit:page * limit + 1]
        buttons = [[p_btn("A-Z", f"sort_provider|4|az|srv4_services|{operator}|{country}|1"), p_btn("Price ↑", f"sort_provider|4|price_low|srv4_services|{operator}|{country}|1"), p_btn("Price ↓", f"sort_provider|4|price_high|srv4_services|{operator}|{country}|1")]]
        for r, final in visible[:limit]:
            if not cfg.maximum_price or final <= cfg.maximum_price:
                buttons.append([p_btn(f"{r['name']} · ₹{int(round(final))} · {r['available_count']} available", f"srv4_quote|{operator}|{country}|{r['service_code']}")])
        nav = []
        if page > 1:
            nav.append(p_btn("Prev", f"srv4_services|{operator}|{country}|{page-1}"))
        if len(visible) > limit:
            nav.append(p_btn("Next", f"srv4_services|{operator}|{country}|{page+1}"))
        if nav:
            buttons.append(nav)
        buttons.append([p_btn("Back", f"srv4_countries|{operator}|1")])
        await e.edit("📲 <b>Choose Service</b>", buttons=buttons)
        return True

    elif data.startswith("srv4_quote|"):
        _, operator, country, service = data.split("|")
        try:
            provider_price = await server4_client.minimum_price(operator, country, service)
            cfg = server4.config()
            charge = int(round(max(cfg.minimum_price, provider_price * (1 + cfg.percent_markup / 100) + cfg.fixed_markup)))
            if cfg.maximum_price and charge > cfg.maximum_price:
                await e.answer("Service exceeds the configured maximum price.", alert=True)
                return True
            server4_purchase_state[uid] = (operator, country, service, provider_price, charge, time.monotonic() + 120)
            await e.edit(
                f"📲 <b>Confirm {html.escape(managed_server_name(4))} Number</b>\n\nPrice: ₹{charge}\nNetwork: <code>{operator}</code>\nCountry: <code>{country}</code>\nService: <code>{service}</code>",
                buttons=[[p_btn("Buy", f"srv4_buy|{operator}|{country}|{service}|{provider_price}|{charge}", style="success")], [p_btn("Back", f"srv4_services|{operator}|{country}|1")]]
            )
        except TemporaError as exc:
            await send_admin_error("Server 4 quote failed", str(exc))
            await e.answer("Server 4 is temporarily unavailable. Admin notified.", alert=True)
        return True

    elif data.startswith("srv4_buy|"):
        _, operator, country, service, provider_text, charge_text = data.split("|")
        provider_price = float(provider_text)
        charge = int(charge_text)
        confirmation = server4_purchase_state.pop(uid, None)
        if not confirmation or confirmation[:3] != (operator, country, service) or confirmation[5] < time.monotonic():
            await e.answer("This confirmation expired or was already used. Please select the service again.", alert=True)
            return True
        provider_price, charge = confirmation[3], apply_server_discount(uid, 4, confirmation[4])
        balance = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
        if balance < charge:
            await e.answer(f"Insufficient balance. Need ₹{charge}.", alert=True)
            return True
        activation = None
        try:
            activation, actual_provider_cost = await server4_client.get_number_v2(service, country, operator, provider_price)
            cur.execute("UPDATE users SET balance=balance-? WHERE user_id=? AND balance>=?", (charge, uid, charge))
            if cur.rowcount != 1:
                await server4_client.set_status(activation.order_id, 8)
                await e.answer("Balance changed; activation cancelled.", alert=True)
                return True
            created = datetime.now(timezone.utc)
            now = created.isoformat()
            cur.execute("""INSERT INTO server4_orders(provider_order_id,user_id,operator_code,country_code,service_code,phone,provider_price,charged_price,status,expires_at,created_at,updated_at)
              VALUES(?,?,?,?,?,?,?,?, 'waiting',?,?,?)""", (activation.order_id, uid, operator, country, service, activation.phone, actual_provider_cost, charge, expiry_timestamp(created), now, now))
            db.commit()
            wait = cancellation_wait(now)
            phone = provider_phone_details(activation.phone)
            with managed_connect() as conn:
                country_row = conn.execute("SELECT name FROM server4_countries WHERE operator_code=? AND country_code=?", (operator, country)).fetchone()
            await log_primary_purchase(uid, country_row['name'] if country_row else country, charge, charge, 2024, 1, activation.phone, "Server 4", activation.order_id)
            await e.edit(
                f"✅ <b>{html.escape(managed_server_name(4))} Number</b>\n\nNumber: {phone['flag']} <code>{html.escape(phone['full'])}</code>\nOrder: <code>{activation.order_id}</code>\n\nWaiting for one OTP…\nCancellation available in: <b>{wait // 60:02d}:{wait % 60:02d}</b>",
                buttons=[
                    [p_copy_btn("📋 Copy Number", phone['full']), p_copy_btn("📋 Copy Without Code", phone['local'])],
                    [p_btn("🔄 Check OTP", f"srv4_status|{activation.order_id}", style="primary")],
                    [p_btn("❌ Cancel / Refund", f"srv4_set|8|{activation.order_id}", style="danger")]
                ]
            )
        except TemporaError as exc:
            db.rollback()
            await send_admin_error("Server 4 allocation failed", str(exc))
            await e.answer("Server 4 could not complete the request. Admin notified.", alert=True)
        except Exception as exc:
            db.rollback()
            if activation:
                try:
                    await server4_client.set_status(activation.order_id, 8)
                except Exception:
                    pass
            await send_admin_error("Server 4 order persistence failed", str(exc))
            await e.answer("The order could not be saved. Your wallet was not charged and support was notified.", alert=True)
        return True

    elif data.startswith("srv4_status|"):
        order_id = data.split("|", 1)[1]
        with managed_connect() as conn:
            owned = conn.execute("SELECT status FROM server4_orders WHERE provider_order_id=? AND user_id=?", (order_id, uid)).fetchone()
        if not owned:
            await e.answer("Order not found.", alert=True)
            return True
        if owned['status'] != 'waiting':
            await e.answer("This order is already closed. OTPs are delivered only once.", alert=True)
            return True
        try:
            status, code = await server4_client.get_status(order_id)
            if code:
                completed = complete_order("server4_orders", order_id, code)
                if not completed:
                    await e.answer("This order is already closed.", alert=True)
                    return True
                await e.edit(f"✅ <b>OTP received</b>\n\nCode: <code>{html.escape(code)}</code>\n\nCompleted successfully. This OTP will not be delivered again.", buttons=[[p_btn("Back", "srv4_operators", style="primary")]])
                return True
            if status == "cancelled":
                refund = cancel_and_refund("server4_orders", order_id, "provider_cancelled")
                await e.answer(f"Activation cancelled. ₹{refund['amount']} refunded." if refund else "Activation cancelled.", alert=True)
                return True
            await e.answer("Waiting for SMS.", alert=True)
        except TemporaError as exc:
            await send_admin_error("Server 4 status failed", str(exc))
            await e.answer("Status unavailable. Admin notified.", alert=True)
        return True

    elif data.startswith("srv4_set|"):
        _, status_text, order_id = data.split("|")
        with managed_connect() as conn:
            owned = conn.execute("SELECT charged_price,status,created_at FROM server4_orders WHERE provider_order_id=? AND user_id=?", (order_id, uid)).fetchone()
        if not owned:
            await e.answer("Order not found.", alert=True)
            return True
        if status_text != "8":
            await e.answer("Only one OTP is supported for each order.", alert=True)
            return True
        if owned['status'] != 'waiting':
            await e.answer("This order is already closed and cannot be refunded again.", alert=True)
            return True
        remaining = cancellation_wait(owned['created_at'])
        if remaining:
            await e.answer(f"Please wait {remaining // 60:02d}:{remaining % 60:02d} before cancelling. OTP checking continues automatically.", alert=True)
            return True
        try:
            response = await server4_client.set_status(order_id, int(status_text))
            if response not in ("ACCESS_CANCEL", "ACCESS_CANCEL_ALREADY", "STATUS_CANCEL"):
                await e.answer("Cancellation is awaiting confirmation. No refund is issued until cancellation succeeds.", alert=True)
                return True
            refund = cancel_and_refund("server4_orders", order_id, "user_cancelled")
            await e.edit(f"↩️ <b>Order cancelled</b>\n\nRefund: ₹{refund['amount']}" if refund else "This order was already closed.", buttons=[[p_btn("Back", "srv4_operators", style="primary")]])
        except TemporaError as exc:
            await send_admin_error("Server 4 status update failed", str(exc))
            await e.answer("Request failed. Admin notified.", alert=True)
        return True

    return False
