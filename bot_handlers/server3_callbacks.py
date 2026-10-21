"""Server 3 (DGOTP) callback queries handler."""
from __future__ import annotations

import html
import time
from datetime import datetime, timezone
from bot_helpers import p_btn, p_copy_btn


async def handle_server3_callback(e, uid: int, data: str) -> bool:
    """Handle all Server 3 DGOTP callback events. Returns True if handled, False otherwise."""
    if not (data.startswith("srv3_") or data == "srv3_search"):
        return False

    import bot
    managed_connect = bot.managed_connect
    provider_country_display = bot.provider_country_display
    managed_server_name = bot.managed_server_name
    server3_search_state = bot.server3_search_state
    server3 = bot.server3
    server3_client = bot.server3_client
    provider_sort = bot.provider_sort
    apply_server_discount = bot.apply_server_discount
    server3_purchase_state = bot.server3_purchase_state
    ACTIVATION_TTL = bot.ACTIVATION_TTL
    expiry_timestamp = bot.expiry_timestamp
    cancellation_wait = bot.cancellation_wait
    provider_phone_details = bot.provider_phone_details
    log_primary_purchase = bot.log_primary_purchase
    report_server3_user_error = bot.report_server3_user_error
    DGOTPError = bot.DGOTPError
    complete_order = bot.complete_order
    cancel_and_refund = bot.cancel_and_refund
    cur = bot.cur
    db = bot.db
    logger = bot.logger

    if data.startswith("srv3_servers|"):
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
        if page > 1:
            nav.append(p_btn("Prev", f"srv3_servers|{page-1}"))
        if len(rows) > limit:
            nav.append(p_btn("Next", f"srv3_servers|{page+1}"))
        if nav:
            buttons.append(nav)
        buttons.append([p_btn("Back", "menu_buy")])
        await e.edit(f"🖥 <b>{html.escape(managed_server_name(3))}</b>\n\nChoose an available server." if rows else "📭 Stock is updating. Please try again shortly.", buttons=buttons)
        return True

    elif data == "srv3_search":
        server3_search_state.add(uid)
        await e.edit(f"🔎 <b>Search {html.escape(managed_server_name(3))}</b>\n\nSend a service name or code.\n\nPopular: <code>telegram</code>, <code>whatsapp</code>, <code>gmail</code>, <code>facebook</code>, <code>instagram</code>, <code>tiktok</code>.", buttons=[[p_btn("Cancel", "srv3_servers|1")]])
        return True

    elif data.startswith("srv3_server|"):
        _, server_code, page_text = data.split("|")
        page, limit = max(1, int(page_text)), 12
        cfg = server3.config()
        with managed_connect() as conn:
            server_row = conn.execute("SELECT name FROM server3_servers WHERE code=? AND enabled=1", (server_code,)).fetchone()
            rows = conn.execute("""SELECT service_code,name,provider_price FROM server3_services
              WHERE server_code=? AND enabled=1 AND in_stock=1""", (server_code,)).fetchall()
        if not server_row:
            await e.answer("This server is disabled.", alert=True)
            return True
        prepared = [(row, max(cfg.minimum_price, row[2] * (1 + cfg.percent_markup / 100) + cfg.fixed_markup)) for row in rows]
        mode = provider_sort(uid, 3)
        prepared.sort(key=(lambda item: item[1]) if mode == "price_low" else (lambda item: -item[1]) if mode == "price_high" else (lambda item: item[0][1].casefold()))
        visible = prepared[(page - 1) * limit:page * limit + 1]
        buttons = [[p_btn("A-Z", f"sort_provider|3|az|srv3_server|{server_code}|1", style="primary"), p_btn("Price ↑", f"sort_provider|3|price_low|srv3_server|{server_code}|1", style="primary"), p_btn("Price ↓", f"sort_provider|3|price_high|srv3_server|{server_code}|1", style="primary")]]
        for row, final in visible[:limit]:
            if not cfg.maximum_price or final <= cfg.maximum_price:
                buttons.append([p_btn(f"{row[1]} ({row[0]}) · ₹{int(round(final))}", f"srv3_buy|{row[0]}|{server_code}", style="success")])
        nav = []
        if page > 1:
            nav.append(p_btn("Prev", f"srv3_server|{server_code}|{page-1}"))
        if len(visible) > limit:
            nav.append(p_btn("Next", f"srv3_server|{server_code}|{page+1}"))
        if nav:
            buttons.append(nav)
        buttons.append([p_btn("All Servers", "srv3_servers|1")])
        message = f"📲 <b>{html.escape(server_row['name'])}</b>\n\nChoose an available service." if rows else f"?? <b>{html.escape(server_row['name'])}</b> currently has no available services."
        await e.edit(message, buttons=buttons)
        return True

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
            if cfg.maximum_price > 0 and final > cfg.maximum_price:
                continue
            buttons.append([p_btn(f"{provider_country_display(row[1])} · ₹{int(round(final))}", f"srv3_buy|{service_code}|{row[0]}", style="success")])
        nav = []
        if page > 1:
            nav.append(p_btn("Prev", f"srv3_variants|{service_code}|{page-1}"))
        if len(rows) > limit:
            nav.append(p_btn("Next", f"srv3_variants|{service_code}|{page+1}"))
        if nav:
            buttons.append(nav)
        buttons.append([p_btn("Back", "srv3_servers|1")])
        await e.edit(f"📡 <b>{html.escape(managed_server_name(3))}</b>\nService: <code>{html.escape(service_code)}</code>", buttons=buttons)
        return True

    elif data.startswith("srv3_buy|"):
        _, service_code, server_code = data.split("|")
        cfg = server3.config()
        with managed_connect() as conn:
            item = conn.execute("""SELECT s.provider_price,s.name,v.name server_name FROM server3_services s
              JOIN server3_servers v ON v.code=s.server_code WHERE s.service_code=? AND s.server_code=?
              AND s.enabled=1 AND s.in_stock=1 AND v.enabled=1""", (service_code, server_code)).fetchone()
        if not item:
            await e.answer("This stock is no longer available.", alert=True)
            return True
        charge = apply_server_discount(uid, 3, int(round(max(cfg.minimum_price, item[0] * (1 + cfg.percent_markup / 100) + cfg.fixed_markup))))
        if cfg.maximum_price > 0 and charge > cfg.maximum_price:
            await e.answer("This stock exceeds the configured maximum price.", alert=True)
            return True
        balance = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
        if balance < charge:
            await e.answer(f"Insufficient balance. Need ₹{charge}.", alert=True)
            return True
        server3_purchase_state[uid] = (service_code, server_code, charge, time.monotonic() + 120)
        await e.edit(
            f"📲 <b>Confirm Number Purchase</b>\n\n"
            f"Country / Server: <b>{html.escape(provider_country_display(item['server_name']))}</b>\n"
            f"Service: <b>{html.escape(item['name'])}</b> (<code>{html.escape(service_code)}</code>)\n"
            f"Price: <b>₹{charge}</b>\nBalance: <b>₹{balance}</b>\n\n"
            f"One OTP is included. If no OTP arrives, cancellation becomes available after the displayed waiting period and the order auto-expires after {ACTIVATION_TTL // 60} minutes.",
            buttons=[
                [p_btn("✅ Confirm Purchase", f"srv3_confirm|{service_code}|{server_code}", style="success")],
                [p_btn("❌ Cancel", f"srv3_server|{server_code}|1", style="danger")]
            ],
        )
        return True

    elif data.startswith("srv3_confirm|"):
        _, service_code, server_code = data.split("|")
        confirmation = server3_purchase_state.pop(uid, None)
        if not confirmation or confirmation[:2] != (service_code, server_code) or confirmation[3] < time.monotonic():
            await e.answer("This confirmation expired or was already used. Please select the service again.", alert=True)
            return True
        cfg = server3.config()
        with managed_connect() as conn:
            item = conn.execute("""SELECT s.provider_price,v.name server_name FROM server3_services s
              JOIN server3_servers v ON v.code=s.server_code WHERE s.service_code=? AND s.server_code=?
              AND s.enabled=1 AND s.in_stock=1""", (service_code, server_code)).fetchone()
        if not item:
            await e.answer("This stock is no longer available.", alert=True)
            return True
        charge = apply_server_discount(uid, 3, int(round(max(cfg.minimum_price, item[0] * (1 + cfg.percent_markup / 100) + cfg.fixed_markup))))
        if cfg.maximum_price > 0 and charge > cfg.maximum_price:
            await e.answer("This stock exceeds the configured maximum price.", alert=True)
            return True
        balance = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
        if balance < charge:
            await e.answer(f"Insufficient balance. Need ₹{charge}.", alert=True)
            return True
        activation = None
        try:
            activation = await server3_client.get_number(service_code, server_code)
            cur.execute("UPDATE users SET balance=balance-? WHERE user_id=? AND balance>=?", (charge, uid, charge))
            if cur.rowcount != 1:
                await server3_client.set_status(activation.order_id, 8)
                await e.answer("Balance changed; provider activation was cancelled.", alert=True)
                return True
            created = datetime.now(timezone.utc)
            cur.execute("""INSERT INTO server3_orders(provider_order_id,user_id,service_code,server_code,phone,provider_price,charged_price,status,expires_at,created_at,updated_at)
              VALUES(?,?,?,?,?,?,?,'waiting',?,?,?)""", (activation.order_id, uid, service_code, server_code, activation.phone, item[0], charge, expiry_timestamp(created), created.isoformat(), created.isoformat()))
            db.commit()
            wait = cancellation_wait(created.isoformat())
            phone = provider_phone_details(activation.phone)
            await log_primary_purchase(uid, item['server_name'], charge, charge, 2024, 1, activation.phone, "Server 3", activation.order_id)
            await e.edit(
                f"✅ <b>Number allocated</b>\n\nNumber: {phone['flag']} <code>{html.escape(phone['full'])}</code>\nPrice: ₹{charge}\nOrder: <code>{html.escape(activation.order_id)}</code>\n\nWaiting for one OTP…\nCancellation available in: <b>{wait // 60:02d}:{wait % 60:02d}</b>",
                buttons=[
                    [p_copy_btn("📋 Copy Number", phone['full']), p_copy_btn("📋 Copy Without Code", phone['local'])],
                    [p_btn("🔄 Check OTP", f"srv3_status|{activation.order_id}", style="primary")],
                    [p_btn("❌ Cancel / Refund", f"srv3_cancel|{activation.order_id}", style="danger")]
                ]
            )
        except DGOTPError as exc:
            if exc.code == "NO_NUMBERS":
                with managed_connect() as conn:
                    conn.execute("UPDATE server3_services SET in_stock=0 WHERE service_code=? AND server_code=?", (service_code, server_code))
                    conn.commit()
            await report_server3_user_error(e, exc, "number allocation")
        except Exception as exc:
            db.rollback()
            logger.exception("Server 3 order persistence failed: %s", exc)
            if activation:
                try:
                    await server3_client.set_status(activation.order_id, 8)
                except Exception:
                    pass
            await e.answer("The order could not be saved and was cancelled. Your wallet was not charged.", alert=True)
        return True

    elif data.startswith("srv3_status|"):
        order_id = data.split("|", 1)[1]
        with managed_connect() as conn:
            owned = conn.execute("SELECT status FROM server3_orders WHERE provider_order_id=? AND user_id=?", (order_id, uid)).fetchone()
        if not owned:
            await e.answer("Order not found.", alert=True)
            return True
        if owned['status'] != 'waiting':
            await e.answer("This order is already closed. OTPs are delivered only once.", alert=True)
            return True
        try:
            status, code = await server3_client.get_status(order_id)
            if code:
                completed = complete_order("server3_orders", order_id, code)
                if not completed:
                    await e.answer("This order is already closed.", alert=True)
                    return True
                await e.edit(f"✅ <b>OTP received</b>\n\nCode: <code>{html.escape(code)}</code>\nOrder: <code>{html.escape(order_id)}</code>\n\nCompleted successfully. This OTP will not be delivered again.", buttons=[[p_btn("Back", "srv3_servers|1", style="primary")]])
                return True
            elif status == "cancelled":
                refund = cancel_and_refund("server3_orders", order_id, "provider_cancelled")
                await e.answer(f"Activation cancelled. ₹{refund['amount']} refunded." if refund else "Activation cancelled.", alert=True)
                return True
            else:
                await e.answer("Still waiting for SMS.", alert=True)
        except DGOTPError as exc:
            await report_server3_user_error(e, exc, "SMS status")
        return True

    elif data.startswith("srv3_cancel|"):
        action_name, order_id = data.split("|", 1)
        with managed_connect() as conn:
            owned = conn.execute("SELECT status,charged_price,created_at FROM server3_orders WHERE provider_order_id=? AND user_id=?", (order_id, uid)).fetchone()
        if not owned:
            await e.answer("Order not found.", alert=True)
            return True
        if owned['status'] != 'waiting':
            await e.answer("This order is already closed and cannot be refunded again.", alert=True)
            return True
        remaining = cancellation_wait(owned['created_at'])
        if remaining:
            await e.answer(f"Please wait {remaining // 60:02d}:{remaining % 60:02d} before cancelling. OTP checking continues automatically.", alert=True)
            return True
        try:
            response = await server3_client.set_status(order_id, 8)
            if response not in ("ACCESS_CANCEL", "ACCESS_CANCEL_ALREADY", "STATUS_CANCEL"):
                await e.answer("Cancellation is awaiting confirmation. No refund is issued until cancellation succeeds.", alert=True)
                return True
            refund = cancel_and_refund("server3_orders", order_id, "user_cancelled")
            await e.edit(f"↩️ <b>Order cancelled</b>\n\nRefund: ₹{refund['amount']}" if refund else "This order was already closed.", buttons=[[p_btn("Back", "srv3_servers|1", style="primary")]])
        except DGOTPError as exc:
            await report_server3_user_error(e, exc, "activation update")
        return True

    return False
