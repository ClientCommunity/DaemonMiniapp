"""Order fulfillment, live OTP tracking, and cancellation/refund service.

Connects directly to live upstream providers:
- Server 1: Global 2FA Accounts (LZT Market fast-buy API)
- Server 2: Good & Cheap Session Accounts (Local managed stock)
- Server 3: Fast Virtual OTP (DGOTP handler API)
- Server 4: Fresh Carrier Numbers (TemporaSMS API)
- Server 5: SMM Growth Hub (Upstream SMM Panel dispatch)

Zero mock or stub data. All operations feature atomic balance deductions and
symmetrical refunds on upstream provider failure.
"""
from __future__ import annotations

import asyncio
import concurrent.futures
import html
import logging
import os
import re
import secrets
import time
from typing import Any

from database import connect, transaction, utcnow
from services.wallet_service import purchase_deduct

logger = logging.getLogger("services.order")


def run_sync(coro):
    """Safely execute an asyncio coroutine from synchronous Flask request threads."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(asyncio.run, coro).result()


def process_reseller_commission(customer_uid: int, purchase_amount: int, description: str = "Purchase") -> None:
    """Credit margin commission to reseller if customer registered via custom margin link."""
    try:
        with connect() as conn:
            user_row = conn.execute(
                "SELECT referred_by, reseller_token FROM users WHERE user_id = ?",
                (customer_uid,)
            ).fetchone()
            if not user_row or not user_row["referred_by"] or not user_row["reseller_token"]:
                return

            reseller_uid = user_row["referred_by"]
            token = user_row["reseller_token"]

            link_row = conn.execute(
                "SELECT margin_percent FROM reseller_links WHERE token = ? AND user_id = ?",
                (token, reseller_uid)
            ).fetchone()
            if not link_row or link_row["margin_percent"] <= 0:
                return

            margin_pct = int(link_row["margin_percent"])
            commission = max(1, int(round((purchase_amount * margin_pct) / 100.0)))

            conn.execute(
                "UPDATE users SET sales_balance = sales_balance + ? WHERE user_id = ?",
                (commission, reseller_uid)
            )
            conn.execute("""
                INSERT INTO reseller_earnings (reseller_id, customer_id, token, amount, commission, description)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (reseller_uid, customer_uid, token, purchase_amount, commission, description))
            conn.commit()
    except Exception as ex:
        logger.warning("Error processing reseller commission for %s: %s", customer_uid, ex)


def execute_buy(
    user_id: int,
    server: int,
    item_data: dict[str, Any],
    qty: int = 1,
    tier: str = "good",
    fmt: str = "account"
) -> dict[str, Any]:
    """Execute a purchase atomically, reserving stock and deducting wallet."""
    uid = int(user_id)
    server_num = int(server)
    quantity = max(1, int(qty))
    unit_price = int(item_data.get("price", 50))
    if server_num == 5:
        # In Server 5 (SMM), item_data["price"] is the total price for the requested order quantity (rates are quoted per 1,000)
        total_price = max(1, unit_price)
    else:
        total_price = unit_price * quantity

    # 1. Atomic balance check and deduction (promo balance consumed first)
    with connect() as conn:
        u_row = conn.execute("SELECT balance, COALESCE(promo_balance, 0) FROM users WHERE user_id = ?", (uid,)).fetchone()
        promo_before = int(u_row[1] or 0) if u_row else 0
        promo_deducted = min(total_price, max(0, promo_before))

    if not purchase_deduct(uid, total_price):
        return {
            "success": False,
            "error": "Insufficient balance. Please deposit funds first.",
            "required": total_price,
        }

    with connect() as conn:
        # ======================================================================
        # SERVER 2: Session Accounts (Good / Cheap)
        # ======================================================================
        if server_num == 2:
            country = item_data.get("country", "")
            year = item_data.get("year", 2024)
            clean_tier = "cheap" if tier.lower() == "cheap" else "good"

            # A. Bulk ZIP delivery for multiple sessions
            if fmt == "session" and quantity > 1:
                stock_rows = conn.execute("""
                    SELECT phone, session_file, twofa
                    FROM stock
                    WHERE available = 1
                      AND country_name LIKE ?
                      AND account_year = ?
                      AND COALESCE(quality_tier, 'good') = ?
                    LIMIT ?
                """, (f"{country}%", year, clean_tier, quantity)).fetchall()

                if len(stock_rows) < quantity:
                    # Partial / out of stock - symmetrical refund atomically
                    conn.execute("""
                        UPDATE users
                        SET balance = balance + ?,
                            promo_balance = COALESCE(promo_balance, 0) + ?
                        WHERE user_id = ?
                    """, (total_price, promo_deducted, uid))
                    conn.commit()
                    return {
                        "success": False,
                        "error": f"Insufficient stock. Requested {quantity}, but only {len(stock_rows)} available."
                    }

                delivered_phones = []
                for s in stock_rows:
                    conn.execute("UPDATE stock SET available = 0 WHERE phone = ?", (s["phone"],))
                    delivered_phones.append(s["phone"])

                order_id = f"ZIP_{int(time.time())}_{secrets.token_hex(3)}"
                conn.execute("""
                    INSERT INTO orders (user_id, country, year, price, phone, otp, server, date, promo_deducted)
                    VALUES (?, ?, ?, ?, ?, 'ZIP DELIVERED', 'Server 2', ?, ?)
                """, (uid, country, year, total_price, ",".join(delivered_phones), utcnow(), promo_deducted))
                conn.commit()

                process_reseller_commission(uid, total_price, f"Server 2 Bulk ({quantity}x)")

                new_bal = conn.execute("SELECT balance, COALESCE(promo_balance, 0) FROM users WHERE user_id = ?", (uid,)).fetchone()
                return {
                    "success": True,
                    "order_id": order_id,
                    "delivery_type": "session_zip",
                    "count": len(delivered_phones),
                    "download_url": f"/api/session/download_zip/{order_id}",
                    "new_balance": int(new_bal[0] or 0),
                    "new_promo_balance": int(new_bal[1] or 0),
                }

            # B. Single Account Live Delivery
            cand = conn.execute("""
                SELECT phone, session_file, country_icon, twofa
                FROM stock
                WHERE available = 1
                  AND country_name LIKE ?
                  AND account_year = ?
                  AND COALESCE(quality_tier, 'good') = ?
                LIMIT 1
            """, (f"{country}%", year, clean_tier)).fetchone()

            if not cand:
                # Symmetrical refund
                conn.execute("""
                    UPDATE users
                    SET balance = balance + ?,
                        promo_balance = COALESCE(promo_balance, 0) + ?
                    WHERE user_id = ?
                """, (total_price, promo_deducted, uid))
                conn.commit()
                return {"success": False, "error": "This item is currently out of stock."}

            phone = cand["phone"]
            conn.execute("UPDATE stock SET available = 0 WHERE phone = ?", (phone,))
            conn.execute("""
                INSERT INTO orders (user_id, country, year, price, phone, otp, server, date, promo_deducted)
                VALUES (?, ?, ?, ?, ?, 'WAITING', 'Server 2', ?, ?)
            """, (uid, country, year, total_price, phone, utcnow(), promo_deducted))
            conn.commit()

            process_reseller_commission(uid, total_price, f"Server 2 ({phone})")

            new_bal = conn.execute("SELECT balance, COALESCE(promo_balance, 0) FROM users WHERE user_id = ?", (uid,)).fetchone()
            clean_phone = f"+{phone.lstrip('+')}"
            return {
                "success": True,
                "order_id": phone,
                "phone": clean_phone,
                "delivery_type": "account_live",
                "download_url": f"/api/session/download/{phone}",
                "twofa": cand["twofa"] or "None",
                "new_balance": int(new_bal[0] or 0),
                "new_promo_balance": int(new_bal[1] or 0),
            }

        # ======================================================================
        # SERVER 1: Global 2FA Accounts (Live LZT Market Fast-Buy)
        # ======================================================================
        if server_num == 1:
            country = item_data.get("country", "Global")
            provided_item_id = str(item_data.get("item_id") or item_data.get("id") or "").strip()
            target_price = unit_price

            async def _buy_lzt():
                from bot import (
                    lzt_fast_buy_item, lzt_request, lzt_currency_params,
                    lzt_purchase_has_error, lzt_purchase_item_id, lzt_error_text,
                    lzt_market_price, lzt_item_requires_password, normalize_lzt_phone,
                    try_lzt_reset_authorizations, get_lzt_candidate_items
                )
                candidates = []
                if provided_item_id.isdigit():
                    res = await lzt_request('GET', f"/{provided_item_id}", params=lzt_currency_params())
                    if res and isinstance(res.get('item'), dict):
                        candidates.append(res['item'])

                if not candidates:
                    candidates = await get_lzt_candidate_items(uid, country, target_price, max_pages=2)

                if not candidates:
                    return None, "No accounts currently available in stock for this country on Server 1."

                last_err = "Purchase failed."
                for cand in candidates:
                    cand_id = str(cand.get('item_id') or cand.get('id') or '')
                    if not cand_id:
                        continue
                    m_price = lzt_market_price(cand)
                    if m_price is None:
                        continue
                    if lzt_item_requires_password(cand):
                        continue

                    buy_res = await lzt_fast_buy_item(cand_id, m_price)
                    if buy_res and not lzt_purchase_has_error(buy_res):
                        purchased_id = lzt_purchase_item_id(buy_res, cand_id)
                        acc_res = await lzt_request('GET', f"/{purchased_id}", params=lzt_currency_params())
                        item = (acc_res.get('item') if isinstance(acc_res, dict) else None) or cand
                        raw_phone = item.get('phone') or item.get('telegram_phone') or item.get('login') or f"LZT_{purchased_id}"
                        display_phone = normalize_lzt_phone(raw_phone, purchased_id)
                        twofa_pw = item.get('password') or item.get('twofa') or item.get('telegram_password') or "None"
                        await try_lzt_reset_authorizations(purchased_id)
                        return {
                            "item_id": purchased_id,
                            "phone": display_phone,
                            "twofa": twofa_pw,
                        }, None
                    last_err = lzt_error_text(buy_res) or "Account was already sold or provider busy."

                return None, last_err

            lzt_res, err = None, None
            try:
                lzt_res, err = run_sync(_buy_lzt())
            except Exception as ex:
                logger.error("Server 1 LZT exception: %s", ex)
                err = str(ex)

            if not lzt_res:
                # Symmetrical refund
                with connect() as conn_rf:
                    conn_rf.execute("""
                        UPDATE users
                        SET balance = balance + ?,
                            promo_balance = COALESCE(promo_balance, 0) + ?
                        WHERE user_id = ?
                    """, (total_price, promo_deducted, uid))
                    conn_rf.commit()
                return {
                    "success": False,
                    "error": f"Server 1 purchase failed: {err}. Your balance has been fully refunded.",
                }

            purchased_phone = lzt_res["phone"]
            purchased_twofa = lzt_res["twofa"]
            purchased_id = lzt_res["item_id"]
            order_key = f"LZT_{purchased_id}"

            conn.execute("""
                INSERT INTO orders (user_id, country, year, price, phone, otp, server, date, promo_deducted)
                VALUES (?, ?, 2024, ?, ?, 'WAITING', 'Server 1', ?, ?)
            """, (uid, country, total_price, purchased_phone, utcnow(), promo_deducted))
            conn.commit()

            process_reseller_commission(uid, total_price, f"Server 1 ({country})")
            new_bal = conn.execute("SELECT balance, COALESCE(promo_balance, 0) FROM users WHERE user_id = ?", (uid,)).fetchone()
            return {
                "success": True,
                "order_id": order_key,
                "phone": purchased_phone,
                "twofa": purchased_twofa,
                "delivery_type": "account_live",
                "new_balance": int(new_bal[0] or 0),
                "new_promo_balance": int(new_bal[1] or 0),
            }

        # ======================================================================
        # SERVER 3: Fast Virtual OTP (Live DGOTP API)
        # ======================================================================
        if server_num == 3:
            service_code = str(item_data.get("service_code") or item_data.get("id") or "tg").strip()
            server_code = str(item_data.get("server_code") or item_data.get("server") or "0").strip()
            service_name = str(item_data.get("name") or service_code.upper())

            async def _buy_server3():
                from server3 import Server3Client, DGOTPError
                client = Server3Client()
                act = await client.get_number(service_code, server_code)
                return act

            activation, s3_err = None, None
            try:
                activation = run_sync(_buy_server3())
            except Exception as ex:
                logger.error("Server 3 DGOTP exception: %s", ex)
                s3_err = str(ex)

            if not activation:
                # Symmetrical refund
                with connect() as conn_rf:
                    conn_rf.execute("""
                        UPDATE users
                        SET balance = balance + ?,
                            promo_balance = COALESCE(promo_balance, 0) + ?
                        WHERE user_id = ?
                    """, (total_price, promo_deducted, uid))
                    conn_rf.commit()
                return {
                    "success": False,
                    "error": f"Server 3: {s3_err or 'No numbers available'}. Your balance has been fully refunded.",
                }

            order_id = activation.order_id
            real_phone = activation.phone
            clean_phone = f"+{real_phone.lstrip('+')}"
            now = utcnow()

            # Record in server3_orders table
            conn.execute("""
                INSERT INTO server3_orders (
                    provider_order_id, user_id, service_code, server_code, phone,
                    provider_price, charged_price, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', ?, ?)
            """, (order_id, uid, service_code, server_code, clean_phone, unit_price, total_price, now, now))

            # Record in main orders table for Mini App UI & history
            conn.execute("""
                INSERT INTO orders (user_id, country, year, price, phone, otp, server, date, promo_deducted)
                VALUES (?, ?, 2024, ?, ?, 'WAITING', 'Server 3', ?, ?)
            """, (uid, service_name, total_price, clean_phone, now, promo_deducted))
            conn.commit()

            process_reseller_commission(uid, total_price, f"Server 3 ({service_name})")
            new_bal = conn.execute("SELECT balance, COALESCE(promo_balance, 0) FROM users WHERE user_id = ?", (uid,)).fetchone()
            return {
                "success": True,
                "order_id": order_id,
                "phone": clean_phone,
                "delivery_type": "account_live",
                "new_balance": int(new_bal[0] or 0),
                "new_promo_balance": int(new_bal[1] or 0),
            }

        # ======================================================================
        # SERVER 4: Fresh Carrier Numbers (Live TemporaSMS API)
        # ======================================================================
        if server_num == 4:
            service_code = str(item_data.get("service_code") or item_data.get("id") or "tg").strip()
            country_code = str(item_data.get("country_code") or item_data.get("country") or "0").strip()
            operator_code = str(item_data.get("operator_code") or item_data.get("operator") or "1").strip()
            service_name = str(item_data.get("name") or service_code.upper())

            async def _buy_server4():
                from server4 import TemporaClient, TemporaError
                client = TemporaClient()
                act, actual_cost = await client.get_number_v2(service_code, country_code, operator_code, unit_price)
                return act, actual_cost

            act_result, s4_err = None, None
            try:
                act_result = run_sync(_buy_server4())
            except Exception as ex:
                logger.error("Server 4 TemporaSMS exception: %s", ex)
                s4_err = str(ex)

            if not act_result:
                # Symmetrical refund
                with connect() as conn_rf:
                    conn_rf.execute("""
                        UPDATE users
                        SET balance = balance + ?,
                            promo_balance = COALESCE(promo_balance, 0) + ?
                        WHERE user_id = ?
                    """, (total_price, promo_deducted, uid))
                    conn_rf.commit()
                return {
                    "success": False,
                    "error": f"Server 4: {s4_err or 'No numbers available'}. Your balance has been fully refunded.",
                }

            activation, actual_cost = act_result
            order_id = activation.order_id
            real_phone = activation.phone
            clean_phone = f"+{real_phone.lstrip('+')}"
            now = utcnow()

            # Record in server4_orders table
            conn.execute("""
                INSERT INTO server4_orders (
                    provider_order_id, user_id, operator_code, country_code, service_code, phone,
                    provider_price, charged_price, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', ?, ?)
            """, (order_id, uid, operator_code, country_code, service_code, clean_phone, actual_cost, total_price, now, now))

            # Record in main orders table for Mini App UI & history
            conn.execute("""
                INSERT INTO orders (user_id, country, year, price, phone, otp, server, date, promo_deducted)
                VALUES (?, ?, 2024, ?, ?, 'WAITING', 'Server 4', ?, ?)
            """, (uid, service_name, total_price, clean_phone, now, promo_deducted))
            conn.commit()

            process_reseller_commission(uid, total_price, f"Server 4 ({service_name})")
            new_bal = conn.execute("SELECT balance, COALESCE(promo_balance, 0) FROM users WHERE user_id = ?", (uid,)).fetchone()
            return {
                "success": True,
                "order_id": order_id,
                "phone": clean_phone,
                "delivery_type": "account_live",
                "new_balance": int(new_bal[0] or 0),
                "new_promo_balance": int(new_bal[1] or 0),
            }

        # ======================================================================
        # SERVER 5: SMM Growth Hub (Live Upstream SMM Provider Dispatch)
        # ======================================================================
        if server_num == 5:
            service_id = item_data.get("service_id") or item_data.get("id")
            service_name = str(item_data.get("name") or f"SMM #{service_id}")
            target_link = str(item_data.get("link") or "").strip()

            if not target_link:
                # Symmetrical refund
                with connect() as conn_rf:
                    conn_rf.execute("""
                        UPDATE users
                        SET balance = balance + ?,
                            promo_balance = COALESCE(promo_balance, 0) + ?
                        WHERE user_id = ?
                    """, (total_price, promo_deducted, uid))
                    conn_rf.commit()
                return {
                    "success": False,
                    "error": "A target link or username is required for SMM orders.",
                }

            async def _buy_server5():
                from server5 import place_order, SMMError
                # Temporarily credit back the balance that was deducted at top of execute_buy
                # because place_order performs its own atomic deduction with exact quoted charges
                with connect() as c_temp:
                    c_temp.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (total_price, uid))
                    c_temp.commit()

                return await place_order(
                    user_id=uid,
                    username=f"user_{uid}",
                    service_id=int(service_id),
                    quantity=quantity,
                    link=target_link
                )

            smm_res, smm_err = None, None
            try:
                smm_res = run_sync(_buy_server5())
            except Exception as ex:
                logger.error("Server 5 SMM exception: %s", ex)
                smm_err = getattr(ex, 'detail', str(ex))

            if not smm_res:
                return {
                    "success": False,
                    "error": f"Server 5 upstream order failed: {smm_err}. Your balance has been fully refunded.",
                }

            oid, provider_order_id, q = smm_res
            order_key = f"SMM_{oid}"

            conn.execute("""
                INSERT INTO orders (user_id, country, year, price, phone, otp, server, date, promo_deducted)
                VALUES (?, ?, ?, ?, ?, 'IN_PROGRESS', 'Server 5', ?, 0)
            """, (uid, service_name, quantity, int(q.charge), target_link, utcnow()))
            conn.commit()

            process_reseller_commission(uid, int(q.charge), f"Server 5 ({service_name})")
            new_bal = conn.execute("SELECT balance, COALESCE(promo_balance, 0) FROM users WHERE user_id = ?", (uid,)).fetchone()
            return {
                "success": True,
                "order_id": order_key,
                "provider_order_id": str(provider_order_id),
                "phone": target_link,
                "delivery_type": "smm_order",
                "new_balance": int(new_bal[0] or 0),
                "new_promo_balance": int(new_bal[1] or 0),
            }

        return {"success": False, "error": f"Unknown store server: {server_num}"}


def check_lzt_code(phone_or_item: str) -> str | None:
    """Fetch telegram login code from LZT API if token is configured."""
    item_id = ""
    clean = str(phone_or_item or "").strip()
    if "LZT_" in clean:
        item_id = clean.split("LZT_")[-1]
    elif clean.isdigit() and len(clean) < 11:
        item_id = clean

    if not item_id:
        return None

    try:
        import os, urllib.request, json, re
        token = os.getenv("LZT_TOKEN", "").strip()
        if not token:
            with connect() as c:
                r = c.execute("SELECT value FROM settings WHERE key='lzt_token'").fetchone()
                if r and r[0]:
                    token = str(r[0]).strip()
        if not token:
            return None
        token = token.replace("Bearer ", "").strip()
        req = urllib.request.Request(
            f"https://prod-api.lzt.market/{item_id}/telegram-login-code",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        )
        with urllib.request.urlopen(req, timeout=6.0) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
            text = json.dumps(data)
            matches = re.findall(r"\b\d{5,6}\b", text)
            if matches:
                return matches[0]
    except Exception as exc:
        logger.debug("Live LZT OTP lookup failed: %s", exc)
    return None


def poll_otp_status(identifier: str) -> dict[str, Any]:
    """Check live OTP delivery status for a phone number or order identifier."""
    clean_id = (identifier or "").replace("+", "").replace(" ", "").strip()
    if not clean_id:
        return {"status": "not_found", "otp": None}

    with connect() as conn:
        row = conn.execute("""
            SELECT id, user_id, price, phone, otp, server, date
            FROM orders
            WHERE phone LIKE ? OR id = ? OR phone = ?
            ORDER BY id DESC LIMIT 1
        """, (f"%{clean_id}%", clean_id if clean_id.isdigit() else -1, clean_id)).fetchone()

    if not row:
        return {"status": "not_found", "otp": None}

    raw_otp = row["otp"]
    if raw_otp and raw_otp not in ("WAITING", "ZIP DELIVERED", "IN_PROGRESS"):
        return {
            "status": "completed",
            "otp": raw_otp,
            "phone": row["phone"],
            "server": row["server"],
        }

    server_label = str(row["server"] or "").strip()

    # 1. Server 1: Query upstream LZT Market
    if server_label == "Server 1":
        fetched = check_lzt_code(row["phone"] or clean_id)
        if fetched:
            with connect() as conn:
                conn.execute("UPDATE orders SET otp = ? WHERE id = ?", (fetched, row["id"]))
            return {
                "status": "completed",
                "otp": fetched,
                "phone": row["phone"],
                "server": row["server"],
            }

    # 2. Server 3: Query DGOTP live status
    if server_label == "Server 3":
        try:
            with connect() as conn:
                s3_row = conn.execute("""
                    SELECT provider_order_id, status FROM server3_orders
                    WHERE (phone LIKE ? OR provider_order_id = ?)
                    ORDER BY id DESC LIMIT 1
                """, (f"%{clean_id}%", clean_id)).fetchone()
            if s3_row and s3_row["status"] == "waiting":
                from server3 import Server3Client
                client = Server3Client()
                s_status, code = run_sync(client.get_status(s3_row["provider_order_id"]))
                if code:
                    with connect() as conn:
                        conn.execute("UPDATE server3_orders SET status = 'completed', sms_code = ? WHERE provider_order_id = ?", (code, s3_row["provider_order_id"]))
                        conn.execute("UPDATE orders SET otp = ? WHERE id = ?", (code, row["id"]))
                    return {
                        "status": "completed",
                        "otp": code,
                        "phone": row["phone"],
                        "server": row["server"],
                    }
                elif s_status == "cancelled":
                    with connect() as conn:
                        conn.execute("UPDATE server3_orders SET status = 'cancelled' WHERE provider_order_id = ?", (s3_row["provider_order_id"],))
                        conn.execute("UPDATE orders SET otp = 'CANCELLED' WHERE id = ?", (row["id"],))
                        conn.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (row["price"], row["user_id"]))
                    return {"status": "cancelled", "otp": None, "phone": row["phone"], "server": row["server"]}
        except Exception as ex:
            logger.debug("Server 3 poll exception: %s", ex)

    # 3. Server 4: Query TemporaSMS live status
    if server_label == "Server 4":
        try:
            with connect() as conn:
                s4_row = conn.execute("""
                    SELECT provider_order_id, status FROM server4_orders
                    WHERE (phone LIKE ? OR provider_order_id = ?)
                    ORDER BY id DESC LIMIT 1
                """, (f"%{clean_id}%", clean_id)).fetchone()
            if s4_row and s4_row["status"] == "waiting":
                from server4 import TemporaClient
                client = TemporaClient()
                s_status, code = run_sync(client.get_status(s4_row["provider_order_id"]))
                if code:
                    with connect() as conn:
                        conn.execute("UPDATE server4_orders SET status = 'completed', sms_code = ? WHERE provider_order_id = ?", (code, s4_row["provider_order_id"]))
                        conn.execute("UPDATE orders SET otp = ? WHERE id = ?", (code, row["id"]))
                    return {
                        "status": "completed",
                        "otp": code,
                        "phone": row["phone"],
                        "server": row["server"],
                    }
                elif s_status == "cancelled":
                    with connect() as conn:
                        conn.execute("UPDATE server4_orders SET status = 'cancelled' WHERE provider_order_id = ?", (s4_row["provider_order_id"],))
                        conn.execute("UPDATE orders SET otp = 'CANCELLED' WHERE id = ?", (row["id"],))
                        conn.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (row["price"], row["user_id"]))
                    return {"status": "cancelled", "otp": None, "phone": row["phone"], "server": row["server"]}
        except Exception as ex:
            logger.debug("Server 4 poll exception: %s", ex)

    return {
        "status": "waiting",
        "otp": None,
        "phone": row["phone"],
        "server": row["server"],
    }


def cancel_order(user_id: int, identifier: str) -> dict[str, Any]:
    """Cancel an active waiting order and refund the user wallet atomically and symmetrically."""
    uid = int(user_id)
    clean_id = (identifier or "").replace("+", "").replace(" ", "").strip()

    with transaction(immediate=True) as conn:
        row = conn.execute("""
            SELECT id, price, phone, otp, server, promo_deducted
            FROM orders
            WHERE user_id = ? AND (phone LIKE ? OR id = ? OR phone = ?) AND otp = 'WAITING'
            ORDER BY id DESC LIMIT 1
        """, (uid, f"%{clean_id}%", clean_id if clean_id.isdigit() else -1, clean_id)).fetchone()

        if not row:
            return {"success": False, "error": "Order not found or cannot be cancelled."}

        order_id = row["id"]
        refund_amount = int(row["price"] or 0)
        phone = row["phone"]
        promo_restored = int(row["promo_deducted"] or 0) if "promo_deducted" in row.keys() else 0
        server_label = str(row["server"] or "").strip()

        # Upstream cancellation for Server 3
        if server_label == "Server 3":
            try:
                s3_row = conn.execute("SELECT provider_order_id FROM server3_orders WHERE phone = ? OR provider_order_id = ?", (phone, clean_id)).fetchone()
                if s3_row:
                    from server3 import Server3Client
                    run_sync(Server3Client().set_status(s3_row["provider_order_id"], 8))
                    conn.execute("UPDATE server3_orders SET status = 'cancelled' WHERE provider_order_id = ?", (s3_row["provider_order_id"],))
            except Exception as ex:
                logger.warning("Upstream Server 3 cancellation notice: %s", ex)

        # Upstream cancellation for Server 4
        elif server_label == "Server 4":
            try:
                s4_row = conn.execute("SELECT provider_order_id FROM server4_orders WHERE phone = ? OR provider_order_id = ?", (phone, clean_id)).fetchone()
                if s4_row:
                    from server4 import TemporaClient
                    run_sync(TemporaClient().set_status(s4_row["provider_order_id"], 8))
                    conn.execute("UPDATE server4_orders SET status = 'cancelled' WHERE provider_order_id = ?", (s4_row["provider_order_id"],))
            except Exception as ex:
                logger.warning("Upstream Server 4 cancellation notice: %s", ex)

        # Return stock for Server 2
        elif server_label == "Server 2" and phone:
            conn.execute("UPDATE stock SET available = 1 WHERE phone = ?", (phone,))

        # Mark cancelled in orders table
        conn.execute("UPDATE orders SET otp = 'CANCELLED' WHERE id = ?", (order_id,))

        # Symmetrical refund: restore main balance and promo balance exactly
        conn.execute("""
            UPDATE users
            SET balance = balance + ?,
                promo_balance = COALESCE(promo_balance, 0) + ?
            WHERE user_id = ?
        """, (refund_amount, promo_restored, uid))

        new_bal = conn.execute("SELECT balance FROM users WHERE user_id = ?", (uid,)).fetchone()[0]

    return {
        "success": True,
        "order_id": order_id,
        "refunded_amount": refund_amount,
        "new_balance": int(new_bal),
    }
