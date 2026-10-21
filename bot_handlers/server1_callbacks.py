"""Server 1 (LZT Market) callback queries handler."""
from __future__ import annotations

import asyncio
import html
import time
from telethon.errors import MessageNotModifiedError
from bot_helpers import (
    COUNTRY_CODES,
    LZT_PRICE_CURRENCY,
    P_INR,
    P_NO,
    P_PHONE,
    P_SHIELD,
    P_TIME,
    P_WARN,
    P_YES,
    country_button_label,
    filter_lzt_items,
    lzt_currency_params,
    lzt_error_text,
    lzt_item_requires_password,
    lzt_market_price,
    lzt_purchase_has_error,
    lzt_purchase_item_id,
    normalize_lzt_phone,
    p_btn,
)


async def handle_server1_callback(e, uid: int, data: str) -> bool:
    """Handle all Server 1 LZT Market callback events. Returns True if handled, False otherwise."""
    if not (data.startswith("srv_1_pg|") or data.startswith("lzt_") or data.startswith("flt_chg|")):
        return False

    import bot
    render_server1_country_page = bot.render_server1_country_page
    send_all_countries_list = bot.send_all_countries_list
    lzt_search_state = bot.lzt_search_state
    get_user_filters = bot.get_user_filters
    get_filter_key = bot.get_filter_key
    active_filter_keys = bot.active_filter_keys
    cached_lzt_stock = bot.cached_lzt_stock
    LZT_CACHE_CONCURRENCY = bot.LZT_CACHE_CONCURRENCY
    fetch_lzt_country_data_with_filters = bot.fetch_lzt_country_data_with_filters
    safe_answer_cb = bot.safe_answer_cb
    handle_callbacks = bot.handle_callbacks
    lzt_request = bot.lzt_request
    LZT_STOCK_TIMEOUT = bot.LZT_STOCK_TIMEOUT
    LZT_STOCK_RETRIES = bot.LZT_STOCK_RETRIES
    get_lzt_markup = bot.get_lzt_markup
    lzt_final_inr_price = bot.lzt_final_inr_price
    format_price = bot.format_price
    render_lzt_product = bot.render_lzt_product
    active_lzt_purchases = bot.active_lzt_purchases
    get_user_lock = bot.get_user_lock
    get_lzt_candidate_items = bot.get_lzt_candidate_items
    apply_server_discount = bot.apply_server_discount
    lzt_fast_buy_item = bot.lzt_fast_buy_item
    finish_lzt_purchase_success = bot.finish_lzt_purchase_success
    active_orders = bot.active_orders
    log_primary_purchase = bot.log_primary_purchase
    try_lzt_reset_authorizations = bot.try_lzt_reset_authorizations
    get_verified_lzt_otp = bot.get_verified_lzt_otp
    cur = bot.cur
    db = bot.db

    if data.startswith("srv_1_pg|"):
        page = int(data.split("|")[1])
        await render_server1_country_page(e, uid, page)
        return True

    elif data == "lzt_all_countries":
        await e.answer("Sending Server 1 country list...", alert=False)
        await send_all_countries_list(uid)
        return True

    elif data == "lzt_search_country":
        lzt_search_state[uid] = True
        await e.edit(
            "<tg-emoji emoji-id='6032850693348399258'>🔎</tg-emoji> <b>Search Server 1 Country</b>\n\n"
            "Send a country key now. Examples: <code>+91</code>, <code>Ind</code>, <code>US</code>",
            buttons=[[p_btn("Back", "srv_1_pg|1")]]
        )
        return True

    elif data == "lzt_refresh_cache":
        await e.answer("Recalculating and synchronizing server stocks... Please wait.", alert=True)
        flt = get_user_filters(uid)
        fkey = get_filter_key(flt)
        active_filter_keys.add(fkey)

        sem = asyncio.Semaphore(max(1, LZT_CACHE_CONCURRENCY))

        async def quick_fetch(country_name):
            async with sem:
                try:
                    d = await fetch_lzt_country_data_with_filters(
                        country_name, flt["spam"], flt["geoblock"], flt["offline"], flt["login_mail"], flt["premium"]
                    )
                    if fkey not in cached_lzt_stock:
                        cached_lzt_stock[fkey] = {}
                    if d is not None:
                        cached_lzt_stock[fkey][country_name] = (d[1], d[2])
                except Exception:
                    if fkey not in cached_lzt_stock:
                        cached_lzt_stock[fkey] = {}

        for c in COUNTRY_CODES.keys():
            await quick_fetch(c)
            await asyncio.sleep(0.3)

        class FakeEv:
            data = b"srv_1_pg|1"
            sender_id = uid

            async def edit(self, text, buttons):
                await e.edit(text, buttons=buttons)

            async def answer(self, text, alert=False):
                pass

        await handle_callbacks(FakeEv())
        return True

    elif data == "lzt_toggle_filters":
        flt = get_user_filters(uid)
        msg = ("⚙️ <b>Server 1 Search Filter Configurations</b>\n\n"
               "Select search properties to apply on catalog lookups:")

        spam_st = "🟢 NO SPAM" if flt["spam"] == "no" else ("🔴 ALLOW SPAM" if flt["spam"] == "yes" else "🔵 ANY")
        geo_st = "🟢 NO GEO-BLOCK" if flt["geoblock"] == "no" else ("🔴 BLOCKED" if flt["geoblock"] == "yes" else "🔵 ANY")
        mail_st = "🟢 MAIL INCLUDED" if flt["login_mail"] == "yes" else ("🔴 NO MAIL" if flt["login_mail"] == "no" else "🔵 ANY")
        offline_st = f"🔵 ≥{flt['offline']} Days" if flt['offline'] != "any" else "🔵 ANY"
        prem_st = "🟢 PREMIUM ONLY" if flt["premium"] == "yes" else ("🔴 NON-PREMIUM ONLY" if flt["premium"] == "no" else "🔵 ANY")

        btns = [
            [p_btn(f"Spam filter: {spam_st}", "flt_chg|spam")],
            [p_btn(f"Geo-block filter: {geo_st}", "flt_chg|geoblock")],
            [p_btn(f"Login Mail: {mail_st}", "flt_chg|login_mail")],
            [p_btn(f"Premium filter: {prem_st}", "flt_chg|premium")],
            [p_btn(f"Offline filter: {offline_st}", "flt_chg|offline")],
            [p_btn("✅ Apply Filters and Back", "srv_1_pg|1"), p_btn("🔄 Refresh", "lzt_refresh_cache")]
        ]
        await e.edit(msg, buttons=btns)
        return True

    elif data == "lzt_sort_menu":
        flt = get_user_filters(uid)
        current = flt.get("sort", "az")

        def mark(mode):
            return "✅ " if current == mode else ""

        btns = [
            [p_btn(f"{mark('az')}A-Z", "lzt_sort|az")],
            [p_btn(f"{mark('price_low')}Price Low To High", "lzt_sort|price_low")],
            [p_btn(f"{mark('price_high')}Price High To Low", "lzt_sort|price_high")],
            [p_btn(f"{mark('stock_low')}Stock Low To High", "lzt_sort|stock_low")],
            [p_btn(f"{mark('stock_high')}Stock High To Low", "lzt_sort|stock_high")],
            [p_btn("Back", "srv_1_pg|1")]
        ]
        await e.edit("↕️ <b>Choose Server 1 Sorting</b>\n\nThis changes the country list order only.", buttons=btns)
        return True

    elif data.startswith("lzt_sort|"):
        mode = data.split("|", 1)[1]
        if mode not in ("az", "price_low", "price_high", "stock_low", "stock_high"):
            await safe_answer_cb(e, "Invalid sorting option.", alert=True)
            return True
        get_user_filters(uid)["sort"] = mode
        await render_server1_country_page(e, uid, 1)
        return True

    elif data.startswith("flt_chg|"):
        attrib = data.split("|")[1]
        flt = get_user_filters(uid)

        if attrib == "spam":
            flt["spam"] = "yes" if flt["spam"] == "no" else ("any" if flt["spam"] == "yes" else "no")
        elif attrib == "geoblock":
            flt["geoblock"] = "yes" if flt["geoblock"] == "no" else ("any" if flt["geoblock"] == "yes" else "no")
        elif attrib == "login_mail":
            flt["login_mail"] = "no" if flt["login_mail"] == "yes" else ("any" if flt["login_mail"] == "no" else "yes")
        elif attrib == "premium":
            flt["premium"] = "no" if flt["premium"] == "yes" else ("any" if flt["premium"] == "no" else "yes")
        elif attrib == "offline":
            flt["offline"] = "7" if flt["offline"] == "1" else ("14" if flt["offline"] == "7" else ("30" if flt["offline"] == "14" else ("any" if flt["offline"] == "30" else "1")))
        elif attrib == "sort":
            order = ["az", "stock_high", "stock_low", "price_low", "price_high"]
            flt["sort"] = order[(order.index(flt.get("sort", "az")) + 1) % len(order)] if flt.get("sort", "az") in order else "az"

        fkey = get_filter_key(flt)
        active_filter_keys.add(fkey)

        flt = get_user_filters(uid)
        msg = ("⚙️ <b>Server 1 Search Filter Configurations</b>\n\n"
               "Select search properties to apply on catalog lookups:")

        spam_st = "🟢 NO SPAM" if flt["spam"] == "no" else ("🔴 ALLOW SPAM" if flt["spam"] == "yes" else "🔵 ANY")
        geo_st = "🟢 NO GEO-BLOCK" if flt["geoblock"] == "no" else ("🔴 BLOCKED" if flt["geoblock"] == "yes" else "🔵 ANY")
        mail_st = "🟢 MAIL INCLUDED" if flt["login_mail"] == "yes" else ("🔴 NO MAIL" if flt["login_mail"] == "no" else "🔵 ANY")
        offline_st = f"🔵 ≥{flt['offline']} Days" if flt['offline'] != "any" else "🔵 ANY"
        prem_st = "🟢 PREMIUM ONLY" if flt["premium"] == "yes" else ("🔴 NON-PREMIUM ONLY" if flt["premium"] == "no" else "🔵 ANY")

        btns = [
            [p_btn(f"Spam filter: {spam_st}", "flt_chg|spam")],
            [p_btn(f"Geo-block filter: {geo_st}", "flt_chg|geoblock")],
            [p_btn(f"Login Mail: {mail_st}", "flt_chg|login_mail")],
            [p_btn(f"Premium filter: {prem_st}", "flt_chg|premium")],
            [p_btn(f"Offline filter: {offline_st}", "flt_chg|offline")],
            [p_btn("✅ Apply Filters and Back", "srv_1_pg|1"), p_btn("🔄 Refresh", "lzt_refresh_cache")]
        ]
        await e.edit(msg, buttons=btns)
        return True

    elif data.startswith("lzt_chk|"):
        parts = data.split("|")
        iso_code = parts[1]
        page = int(parts[2]) if len(parts) > 2 else 1

        await e.answer("Loading interactive catalog...", alert=False)

        country = next((k for k, v in COUNTRY_CODES.items() if v[0] == iso_code), "United States")
        flag = COUNTRY_CODES.get(country, ("US", "🇺🇸"))[1]

        flt = get_user_filters(uid)
        params = {
            "country[]": iso_code,
            "spam": flt["spam"] if flt["spam"] != "any" else None,
            "nsb": 1,
            "pmin": 0.01,
            "pmax": 1000,
            "page": page,
            "per_page": 40,
            "password": "no",
            "currency": LZT_PRICE_CURRENCY
        }
        if flt["offline"] != "any":
            params["daybreak"] = int(flt["offline"])
        if flt["premium"] != "any":
            params["premium"] = flt["premium"]

        res = await lzt_request('GET', '/telegram', params=params, timeout_total=LZT_STOCK_TIMEOUT, max_retries=LZT_STOCK_RETRIES, notify_errors=False)
        if isinstance(res, dict) and 'items' in res and len(res['items']) == 0 and params["country[]"] != country:
            params["country[]"] = country
            res = await lzt_request('GET', '/telegram', params=params, timeout_total=LZT_STOCK_TIMEOUT, max_retries=1, notify_errors=False)

        if not res or 'items' not in res or len(res['items']) == 0:
            empty_msg = (f"❌ <b>Stock Empty!</b>\n\n"
                         f"There are currently no active listings for <b>{country} {flag}</b> on Server 1.\n"
                         f"Please choose another country or check back soon.")
            btns = [
                [p_btn("🔄 Refresh Catalog Info", f"lzt_chk|{iso_code}|1")],
                [p_btn("Change Country", "srv_1_pg|1")]
            ]
            await e.edit(empty_msg, buttons=btns)
            return True

        matched_items = filter_lzt_items(res.get('items', []), flt)
        if not matched_items:
            empty_msg = (f"❌ <b>Stock Empty!</b>\n\n"
                         f"No listings matched your active filters for <b>{country} {flag}</b>.\n"
                         f"Try changing filters or choose another country.")
            btns = [
                [p_btn("⚙️ Change Filters", "lzt_toggle_filters")],
                [p_btn("🔄 Refresh Catalog Info", f"lzt_chk|{iso_code}|1")],
                [p_btn("Change Country", "srv_1_pg|1")]
            ]
            await e.edit(empty_msg, buttons=btns)
            return True

        items = sorted(matched_items, key=lambda x: float(x.get('price_with_fee') or x.get('priceWithSellerFee') or x.get('price') or 99999))[:40]
        total_items = res.get('totalItems', len(items)) if len(matched_items) == len(res.get('items', [])) else len(matched_items)
        total_pages = max(1, (total_items + 39) // 40)

        markup = get_lzt_markup(country)
        starting_price = lzt_final_inr_price(items[0], markup) if items else 0

        msg = (f"📦 Found: {total_items} | Page {page}/{total_pages}\n"
               f"💰 Starting Price: {format_price(uid, starting_price)}\n"
               f"🔽 Filters: {country} {flag} | ⚡ Cheap | 📊 Cheapest | "
               f"Spam: {flt['spam']} | Geo: {flt['geoblock']} | Mail: {flt['login_mail']} | "
               f"Premium: {flt['premium']} | Offline: {flt['offline']}\n\n"
               f"Tap an account to view details & buy:\n")

        grid_buttons = [[p_btn("⚙️ Change Filters", "lzt_toggle_filters")]]
        grid_row = []

        for index, item in enumerate(items, start=1):
            final_price = lzt_final_inr_price(item, markup)
            global_index = (page - 1) * 40 + index
            item_id = int(item.get('item_id'))
            btn_lbl = f"[{country_button_label(country, include_phone=False)} #{global_index}] - {format_price(uid, final_price)}"
            grid_row.append(p_btn(btn_lbl, f"lzt_view|{item_id}|{country}|{final_price}"))
            if len(grid_row) == 2:
                grid_buttons.append(grid_row)
                grid_row = []
        if grid_row:
            grid_buttons.append(grid_row)

        nav = []
        if page > 1:
            nav.append(p_btn("⬅️ Prev Page", f"lzt_chk|{iso_code}|{page-1}"))
        if total_items > (page * 40):
            nav.append(p_btn("Next Page ➡️", f"lzt_chk|{iso_code}|{page+1}"))
        if nav:
            grid_buttons.append(nav)

        grid_buttons.append([p_btn("Change Country", "srv_1_pg|1")])
        await e.edit(msg, buttons=grid_buttons)
        return True

    elif data.startswith("lzt_view|"):
        _, item_id, country, _price_hint = data.split("|")
        await render_lzt_product(e, uid, item_id, country)
        return True

    elif data.startswith("lzt_mass_buy|"):
        _, first_item_id, price_str, country = data.split("|", 3)
        if uid in active_lzt_purchases:
            await safe_answer_cb(e, "⏳ Please wait. Your previous Server 1 purchase is still processing.", alert=True)
            return True
        active_lzt_purchases[uid] = time.time()
        iso_code = COUNTRY_CODES.get(country, ("US", "🇺🇸"))[0]
        target_price = int(float(price_str))
        reserve_done = False
        tried = 0
        skipped = 0
        last_error = "No matching accounts found."
        try:
            async with get_user_lock(uid):
                bal_row = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()
                current_bal = bal_row[0] if bal_row else 0
                if current_bal < target_price:
                    await safe_answer_cb(e, f"❌ Insufficient Balance! Need {P_INR}{target_price}", alert=True)
                    return True
                cur.execute("UPDATE users SET balance = balance - ? WHERE user_id=? AND balance >= ?", (target_price, uid, target_price))
                if cur.rowcount == 0:
                    await safe_answer_cb(e, f"❌ Insufficient Balance! Need {P_INR}{target_price}", alert=True)
                    return True
                db.commit()
                reserve_done = True

            await e.edit(
                f"{P_TIME} <b>Mass Buy Started (Server 1)</b>\n\n"
                f"Target price: {format_price(uid, target_price)}\n"
                f"How it works: bot tries selected ID first, then other same-price IDs from this country until one purchase succeeds or all fail. Your balance is reserved now and refunded if all fail."
            )

            candidates = await get_lzt_candidate_items(uid, country, target_price, preferred_item_id=first_item_id, max_pages=3)
            if not candidates:
                last_error = "No same-price Server 1 accounts were found."

            for item in candidates:
                candidate_id = str(item.get('item_id') or item.get('id') or '')
                if not candidate_id:
                    skipped += 1
                    continue
                latest_res = await lzt_request('GET', f"/{candidate_id}", params=lzt_currency_params())
                latest_item = latest_res.get('item') if isinstance(latest_res, dict) else item
                if not latest_item or lzt_item_requires_password(latest_item):
                    skipped += 1
                    last_error = "Skipped password-required account."
                    continue
                candidate_price = apply_server_discount(uid, 1, lzt_final_inr_price(latest_item, get_lzt_markup(country)))
                if candidate_price != target_price:
                    skipped += 1
                    last_error = "Skipped account because price changed."
                    continue
                market_price = lzt_market_price(latest_item)
                if market_price is None:
                    skipped += 1
                    last_error = "Skipped account because market price was unavailable."
                    continue

                tried += 1
                try:
                    await e.edit(
                        f"{P_TIME} <b>Mass Buy Running...</b>\n\n"
                        f"Trying ID: <code>{candidate_id}</code>\n"
                        f"Tried: <b>{tried}</b> | Skipped: <b>{skipped}</b>\n"
                        f"Target price: {format_price(uid, target_price)}"
                    )
                except MessageNotModifiedError:
                    pass

                buy_res = await lzt_fast_buy_item(candidate_id, market_price)
                if buy_res and not lzt_purchase_has_error(buy_res):
                    purchased_id = lzt_purchase_item_id(buy_res, candidate_id)
                    phone, display_phone = await finish_lzt_purchase_success(uid, purchased_id, country, target_price)
                    reserve_done = False
                    msg = (f"{P_YES} <b>Mass Buy Success (Server 1)!</b>\n\n"
                           f"{P_PHONE} <b>Phone:</b> <code>{display_phone}</code>\n"
                           f"<tg-emoji emoji-id='5776233299424843260'>🌐</tg-emoji> <b>Country:</b> {country}\n"
                           f"<tg-emoji emoji-id='6028435952299413210'>ℹ</tg-emoji> <b>Purchased ID:</b> <code>{purchased_id}</code>\n"
                           f" <tg-emoji emoji-id='6030657343744644592'>🔁</tg-emoji> <b>Attempts:</b> {tried} tried, {skipped} skipped\n\n"
                           f"<i>Click Get OTP when you need the latest login code.</i>")
                    btns = [
                        [p_btn("🔄 Get OTP", f"lzt_get_otp|{phone}")],
                        [p_btn("⬅ Back", f"lzt_chk|{iso_code}|1"), p_btn("Back to Menu", "menu_main")]
                    ]
                    sent_msg = await e.edit(msg, buttons=btns)
                    active_orders[phone] = {
                        'uid': uid, 'start_time': time.time(), 'paid': True, 'otp_sent': False,
                        'price': target_price, 'country': country, 'year': 2024,
                        'msg_id': sent_msg.id, 'phone_num': display_phone
                    }
                    return True

                last_error = lzt_error_text(buy_res) or "Purchase failed for this ID."

            if reserve_done:
                async with get_user_lock(uid):
                    cur.execute("UPDATE users SET balance = balance + ? WHERE user_id=?", (target_price, uid))
                    db.commit()
                reserve_done = False
            await e.edit(
                f"{P_NO} <b>Mass Buy Failed</b>\n\n"
                f"Tried: <b>{tried}</b> | Skipped: <b>{skipped}</b>\n"
                f"Reason: <code>{html.escape(str(last_error)[:500])}</code>\n\n"
                f"Your reserved balance was refunded.",
                buttons=[[p_btn("Back", f"lzt_chk|{iso_code}|1")], [p_btn("Change Country", "srv_1_pg|1")]]
            )
            return True
        finally:
            if reserve_done:
                async with get_user_lock(uid):
                    cur.execute("UPDATE users SET balance = balance + ? WHERE user_id=?", (target_price, uid))
                    db.commit()
            active_lzt_purchases.pop(uid, None)

    elif data.startswith("lzt_buy|"):
        _, item_id, price_str, country = data.split("|")
        if uid in active_lzt_purchases:
            await safe_answer_cb(e, "⏳ Please wait. Your previous Server 1 purchase is still processing.", alert=True)
            return True
        active_lzt_purchases[uid] = time.time()
        final_price = float(price_str)
        iso_code = COUNTRY_CODES.get(country, ("US", "🇺🇸"))[0]
        try:
            latest_res = await lzt_request('GET', f"/{item_id}", params=lzt_currency_params())
            latest_item = latest_res.get('item') if isinstance(latest_res, dict) else None
            market_price = lzt_market_price(latest_item)
            if not latest_item or market_price is None:
                await e.edit(f"{P_WARN} <b>Unable to load latest Server 1 price.</b>\nPlease refresh the stock and try again.", buttons=[[p_btn("Back", f"lzt_chk|{iso_code}|1")]])
                return True
            if lzt_item_requires_password(latest_item):
                await e.edit(
                    f"{P_WARN} <b>Cannot buy this Server 1 account.</b>\nThis listing requires a seller login password, so the bot skipped it before charging your wallet.",
                    buttons=[[p_btn("Back", f"lzt_chk|{iso_code}|1")], [p_btn("Change Country", "srv_1_pg|1")]]
                )
                return True
            final_price = apply_server_discount(uid, 1, lzt_final_inr_price(latest_item, get_lzt_markup(country)))

            async with get_user_lock(uid):
                bal_row = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()
                current_bal = bal_row[0] if bal_row else 0
                if current_bal < final_price:
                    await safe_answer_cb(e, f"❌ Insufficient Balance! Need {P_INR}{final_price}", alert=True)
                    return True
                cur.execute("UPDATE users SET balance = balance - ? WHERE user_id=? AND balance >= ?", (final_price, uid, final_price))
                if cur.rowcount == 0:
                    await safe_answer_cb(e, f"❌ Insufficient Balance! Need {P_INR}{final_price}", alert=True)
                    return True
                db.commit()

            await e.edit(f"{P_TIME} <b>Purchasing from Server 1...</b>\n\nPlease wait for this purchase to finish before buying another account.")

            buy_res = await lzt_fast_buy_item(item_id, market_price)

            if lzt_purchase_has_error(buy_res):
                async with get_user_lock(uid):
                    cur.execute("UPDATE users SET balance = balance + ? WHERE user_id=?", (final_price, uid))
                    db.commit()
                err_text = lzt_error_text(buy_res)
                if "password" in err_text.lower():
                    await e.edit(f"{P_WARN} <b>Purchase skipped and refunded.</b>\nServer 1 says this account requires a seller login password, so it cannot be bought safely by the bot.", buttons=[[p_btn("Back", f"lzt_chk|{iso_code}|1")], [p_btn("Change Country", "srv_1_pg|1")]])
                    return True
                if "balance" in err_text.lower() or "средств" in err_text.lower() or "not enough" in err_text.lower():
                    await e.edit(f"{P_WARN} <b>Server 1 Maintenance.</b>\nBalance refunded. Market balance is not enough; please notify admin or use Server 2.", buttons=[[p_btn("Back", "menu_buy")]])
                    return True
                if "timeout" in err_text.lower():
                    await e.edit(f"{P_WARN} <b>Server 1 is slow right now.</b>\nMoney refunded. Please try again in a minute.", buttons=[[p_btn("Back", f"lzt_chk|{iso_code}|1")]])
                    return True
                await e.edit(f"{P_NO} <b>Purchase Failed!</b> Account was sold or API busy. Money refunded.", buttons=[[p_btn("Back", f"lzt_chk|{iso_code}|1")]])
                return True

            item_id = lzt_purchase_item_id(buy_res, item_id)
            res = await lzt_request('GET', f"/{item_id}", params=lzt_currency_params())
            phone_num = f"LZT_{item_id}"
            if res and 'item' in res:
                item = res['item']
                phone_num = item.get('phone') or item.get('telegram_phone') or item.get('login') or f"LZT_{item_id}"

            display_phone = normalize_lzt_phone(phone_num, item_id)
            phone = f"LZT_{item_id}"

            async with get_user_lock(uid):
                cur.execute(
                    "INSERT INTO orders (user_id, country, year, price, phone, otp, server) VALUES (?,?,?,?,?,?,?)",
                    (uid, country, 2024, final_price, display_phone, None, "Server 1")
                )
                local_order_id = cur.lastrowid
                db.commit()
            await log_primary_purchase(uid, country, final_price, final_price, 2024, 1, display_phone, "Server 1", local_order_id or item_id)
            await try_lzt_reset_authorizations(item_id)

            msg = (f"{P_YES} <b>Account Purchased (Server 1)!</b>\n\n"
                   f"{P_PHONE} <b>Phone:</b> <code>{display_phone}</code>\n"
                   f"🏳️ <b>Country:</b> {country}\n\n"
                   f"<i>Click Get OTP when you need the latest login code.</i>")

            btns = [
                [p_btn("🔄 Get OTP", f"lzt_get_otp|{phone}")],
                [p_btn("⬅ Back", f"lzt_chk|{iso_code}|1"), p_btn("Back to Menu", "menu_main")]
            ]
            sent_msg = await e.edit(msg, buttons=btns)
            active_orders[phone] = {
                'uid': uid,
                'start_time': time.time(),
                'paid': True,
                'otp_sent': False,
                'price': final_price,
                'country': country,
                'year': 2024,
                'msg_id': sent_msg.id,
                'phone_num': display_phone
            }
            return True
        finally:
            active_lzt_purchases.pop(uid, None)

    elif data.startswith("lzt_get_otp|"):
        phone = data.split("|")[1]
        if phone not in active_orders:
            await safe_answer_cb(e, "Session Expired.", alert=True)
            return True
        order = active_orders[phone]
        item_id = phone.split("_")[1]
        country = order['country']
        iso_code = COUNTRY_CODES.get(country, ("US", "🇺🇸"))[0]

        await e.answer("Fetching OTP from Server 1...", alert=False)
        code, verified, res = await get_verified_lzt_otp(item_id, attempts=3, delay=1.5)

        display_phone = order.get('phone_num') or normalize_lzt_phone(None, item_id)

        if code:
            async with get_user_lock(uid):
                cur.execute("UPDATE orders SET otp=? WHERE phone=? AND user_id=? AND server='Server 1'", (code, display_phone, uid))
                db.commit()
            msg = (f"{P_YES} <b>Latest OTP Fetched!</b>\n\n"
                   f"{P_PHONE} <b>Phone:</b> <code>{display_phone}</code>\n"
                   f"🏳️ <b>Country:</b> {country}\n"
                   f"{P_TIME} <b>OTP:</b> <code>{code}</code>\n\n"
                   f"{P_SHIELD} <b>Server 1 double-check:</b> {'Verified' if verified else 'Best latest code'}\n\n"
                   f"<i>Use this code to login.</i>")
            btns = [
                [p_btn("🔄 Get OTP Again", f"lzt_get_otp|{phone}")],
                [p_btn("⬅ Back", f"lzt_chk|{iso_code}|1"), p_btn("Back to Menu", "menu_main")]
            ]
            try:
                await e.edit(msg, buttons=btns)
            except MessageNotModifiedError:
                pass
        else:
            await e.answer("⏳ OTP not available yet. Wait and retry.", alert=True)
        return True

    elif data.startswith("lzt_logout|"):
        phone = data.split("|")[1]
        if phone in active_orders:
            order = active_orders.pop(phone)
            item_id = phone.split("_")[1]
            reset_res = await lzt_request('POST', f"/{item_id}/telegram-reset-authorizations")
            reset_errors = reset_res.get('errors', []) if isinstance(reset_res, dict) else []
            if reset_errors:
                err_txt = str(reset_errors[0])
                if "24 hour" in err_txt.lower() or "24 hours" in err_txt.lower() or "too new authorization" in err_txt.lower():
                    await e.edit("⚠️ <b>Logout scheduled later.</b>\nTelegram limits reset for ~24h after new authorization.\n\nYou can come back later and press logout again.", buttons=[[p_btn("Back to Menu", "menu_main")]])
                    return True
        await e.edit(f"{P_YES} <b>Session Closed from Server 1 successfully.</b>", buttons=[[p_btn("Back to Menu", "menu_main")]])
        return True

    return False
