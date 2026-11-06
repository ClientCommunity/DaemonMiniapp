"""Catalogue and store service for Servers 1-5.

Guarantees 100% vendor privacy (zero leakage of upstream provider names such as
LZT, DGOTP, TemporaSMS, or external SMM panel hostnames).
"""
from __future__ import annotations

import logging
from typing import Any

from config import SERVER_NAMES
from database import connect

logger = logging.getLogger("services.store")


def get_all_servers_overview() -> list[dict[str, Any]]:
    """Return overview metadata for Servers 1 through 5 with zero vendor leaks,
    dynamically reflecting live status from the database.
    """
    server_statuses = {1: True, 2: True, 3: True, 4: True, 5: True}
    try:
        with connect() as conn:
            # Server 1: settings table key 'server1_status' ('on' / 'off')
            s1_row = conn.execute("SELECT value FROM settings WHERE key = 'server1_status'").fetchone()
            if s1_row and s1_row["value"]:
                server_statuses[1] = (s1_row["value"].strip().lower() != "off")

            # Server 2: settings table key 'server2_status' ('on' / 'off')
            s2_row = conn.execute("SELECT value FROM settings WHERE key = 'server2_status'").fetchone()
            if s2_row and s2_row["value"]:
                server_statuses[2] = (s2_row["value"].strip().lower() != "off")

            # Server 3: service_servers table server_no = 3 (service_enabled 1/0) or settings key 'server3_status'
            s3_setting = conn.execute("SELECT value FROM settings WHERE key = 'server3_status'").fetchone()
            s3_row = conn.execute("SELECT service_enabled FROM service_servers WHERE server_no = 3").fetchone()
            if s3_setting and s3_setting["value"]:
                server_statuses[3] = (s3_setting["value"].strip().lower() != "off")
            elif s3_row:
                server_statuses[3] = bool(s3_row["service_enabled"])

            # Server 4: service_servers table server_no = 4 (service_enabled 1/0) or settings key 'server4_status'
            s4_setting = conn.execute("SELECT value FROM settings WHERE key = 'server4_status'").fetchone()
            s4_row = conn.execute("SELECT service_enabled FROM service_servers WHERE server_no = 4").fetchone()
            if s4_setting and s4_setting["value"]:
                server_statuses[4] = (s4_setting["value"].strip().lower() != "off")
            elif s4_row:
                server_statuses[4] = bool(s4_row["service_enabled"])

            # Server 5: smm_settings table key 'enabled' ('1' / '0') or settings key 'server5_status'
            s5_setting = conn.execute("SELECT value FROM settings WHERE key = 'server5_status'").fetchone()
            s5_smm = conn.execute("SELECT value FROM smm_settings WHERE key = 'enabled'").fetchone()
            if s5_setting and s5_setting["value"]:
                server_statuses[5] = (s5_setting["value"].strip().lower() != "off")
            elif s5_smm and s5_smm["value"]:
                server_statuses[5] = (s5_smm["value"].strip().lower() in ("1", "true", "on"))
    except Exception as exc:
        logger.warning("Error fetching live server statuses from DB: %s", exc)

    servers = []
    for s_no in range(1, 6):
        meta = SERVER_NAMES.get(s_no, {})
        servers.append({
            "id": s_no,
            "name": meta.get("name", f"Server {s_no}"),
            "subtitle": meta.get("subtitle", "Online Store"),
            "icon": meta.get("icon", "⚡"),
            "enabled": server_statuses.get(s_no, True),
        })
    return servers


def get_server1_stock(uid: int | None = None) -> list[dict[str, Any]]:
    """Return Server 1 stock items (Global 2FA Accounts from live LZT Market)."""
    items = []
    flt = get_user_server1_filters(uid if uid else 0)
    sort_mode = flt.get("sort", "az")
    fkey = "_".join(str(flt.get(k, "any")) for k in ("spam", "geoblock", "offline", "login_mail", "premium"))

    mem_cache = {}
    try:
        import bot
        if hasattr(bot, "cached_lzt_stock") and isinstance(bot.cached_lzt_stock, dict):
            mem_cache = bot.cached_lzt_stock.get(fkey) or {}
    except Exception:
        pass

    with connect() as conn:
        # 1. Primary: live cached LZT market inventory
        rows = conn.execute("""
            SELECT country, iso_code, flag, stock_count, price
            FROM lzt_stock_cache
            WHERE stock_count > 0
            ORDER BY stock_count DESC, country ASC
            LIMIT 60
        """).fetchall()

        for r in rows:
            c_name = r["country"]
            stock_count = int(r["stock_count"])
            price = int(round(r["price"] or 80))

            if c_name in mem_cache:
                mem_stock, mem_price = mem_cache[c_name]
                stock_count = int(mem_stock)
                if mem_price > 0:
                    price = int(round(mem_price))

            items.append({
                "id": c_name,
                "name": c_name,
                "country": c_name,
                "icon": r["flag"] or "🌐",
                "price": price,
                "stock": stock_count,
                "subtitle": "Global Market 2FA",
            })

        # 2. Secondary fallback: local stock table if populated
        if not items:
            stock_rows = conn.execute("""
                SELECT country_icon, country_name, price, COUNT(*) as stock_count
                FROM stock
                WHERE available = 1 AND (category = 'Server 1' OR category = 'Good')
                GROUP BY country_name
                ORDER BY stock_count DESC
                LIMIT 60
            """).fetchall()
            for r in stock_rows:
                items.append({
                    "id": r["country_name"],
                    "name": r["country_name"],
                    "country": r["country_name"],
                    "icon": r["country_icon"] or "🌍",
                    "price": int(r["price"] or 80),
                    "stock": int(r["stock_count"]),
                    "subtitle": "Global Market 2FA",
                })

    if sort_mode == "price_low":
        items.sort(key=lambda x: (x["price"], x["country"]))
    elif sort_mode == "price_high":
        items.sort(key=lambda x: (-x["price"], x["country"]))
    elif sort_mode == "stock_high":
        items.sort(key=lambda x: (-x["stock"], x["country"]))
    elif sort_mode == "stock_low":
        items.sort(key=lambda x: (x["stock"], x["country"]))
    elif sort_mode == "az":
        items.sort(key=lambda x: x["country"])

    return items


def get_server2_stock(tier: str = "good") -> dict[str, Any]:
    """Return Server 2 catalogue segregated by quality_tier ('good' vs 'cheap')."""
    clean_tier = "cheap" if tier.lower() == "cheap" else "good"

    with connect() as conn:
        good_count_row = conn.execute(
            "SELECT COUNT(*) FROM stock WHERE available = 1 AND COALESCE(quality_tier, 'good') = 'good'"
        ).fetchone()
        cheap_count_row = conn.execute(
            "SELECT COUNT(*) FROM stock WHERE available = 1 AND quality_tier = 'cheap'"
        ).fetchone()

        good_count = int(good_count_row[0] if good_count_row else 0)
        cheap_count = int(cheap_count_row[0] if cheap_count_row else 0)

        rows = conn.execute("""
            SELECT country_icon, country_name, account_year, price, COUNT(*) as stock_count
            FROM stock
            WHERE available = 1 AND COALESCE(quality_tier, 'good') = ?
            GROUP BY country_name, account_year, price
            ORDER BY country_name ASC, account_year DESC
        """, (clean_tier,)).fetchall()

    items = []
    for r in rows:
        c_name = r["country_name"] or "Unknown"
        yr = r["account_year"] or 2024
        items.append({
            "id": f"{c_name}_{yr}",
            "name": f"{c_name} ({yr})",
            "country": c_name,
            "year": yr,
            "icon": r["country_icon"] or "🌍",
            "price": int(r["price"] or 60),
            "stock": int(r["stock_count"]),
            "subtitle": "🟢 Good Quality Session" if clean_tier == "good" else "🟡 Cheap Quality Session",
        })

    return {
        "tier": clean_tier,
        "good_count": good_count,
        "cheap_count": cheap_count,
        "items": items,
    }


def get_server3_stock() -> list[dict[str, Any]]:
    """Return Server 3 catalogue (Instant Virtual OTP)."""
    items = []
    icon_map = {
        "tg": "✈️", "wa": "💬", "wb": "💬", "go": "🔍", "ig": "📸",
        "fb": "👥", "tw": "🐦", "tk": "🎵", "openai": "🤖", "ds": "🎮",
        "fu": "👻"
    }

    try:
        with connect() as conn:
            rows = conn.execute("""
                SELECT s.service_code, s.server_code, s.name, s.provider_price, COALESCE(v.name, 'India') as server_name
                FROM server3_services s
                LEFT JOIN server3_servers v ON v.code = s.server_code
                WHERE s.enabled = 1 AND s.in_stock = 1 AND s.provider_price > 0
                ORDER BY s.name ASC
            """).fetchall()

        for r in rows:
            code = r["service_code"]
            s_name = r["name"] or code.upper()
            srv_code = r["server_code"]
            country_name = r["server_name"] or "India"
            items.append({
                "id": f"{code}_{srv_code}",
                "service_code": code,
                "server_code": srv_code,
                "name": s_name,
                "country": country_name,
                "icon": icon_map.get(code.lower(), "⚡"),
                "price": int(round(r["provider_price"] or 45)),
                "stock": None,
                "subtitle": f"{country_name} Instant OTP",
            })
    except Exception as exc:
        logger.warning("Error querying server3_services: %s", exc)
    return items


_SERVER4_CACHE: dict[str, Any] = {"timestamp": 0.0, "items": []}

def get_server4_stock() -> list[dict[str, Any]]:
    """Return Server 4 catalogue (Fresh Carrier Numbers) with authentic country combinations."""
    import time
    now = time.time()
    if _SERVER4_CACHE["items"] and (now - _SERVER4_CACHE["timestamp"]) < 60.0:
        return _SERVER4_CACHE["items"]

    items = []
    try:
        with connect() as conn:
            # 1. Fetch Server 4 markup settings
            s4_cfg = conn.execute("SELECT percent_markup, fixed_markup, minimum_price FROM service_servers WHERE server_no = 4").fetchone()
            pct_markup = float(s4_cfg["percent_markup"] if s4_cfg and s4_cfg["percent_markup"] is not None else 15.0)
            fixed_markup = float(s4_cfg["fixed_markup"] if s4_cfg and s4_cfg["fixed_markup"] is not None else 0.0)
            min_price_floor = float(s4_cfg["minimum_price"] if s4_cfg and s4_cfg["minimum_price"] is not None else 15.0)

            # 2. Query verified in-stock services across countries with available_count > 0
            popular_rows = conn.execute("""
                SELECT
                    v.service_code,
                    v.name as service_name,
                    c.country_code,
                    c.name as country_name,
                    s.operator_code,
                    MIN(s.min_price) as min_price,
                    SUM(s.available_count) as total_stock
                FROM server4_stock s
                JOIN server4_countries c ON c.operator_code = s.operator_code AND c.country_code = s.country_code
                JOIN server4_services v ON v.operator_code = s.operator_code AND v.service_code = s.service_code
                WHERE s.available_count > 0 AND c.enabled = 1 AND v.enabled = 1
                GROUP BY v.name, c.name
                ORDER BY
                  CASE
                    WHEN LOWER(v.name) LIKE '%whatsapp%' THEN 1
                    WHEN LOWER(v.name) LIKE '%telegram%' THEN 2
                    WHEN LOWER(v.name) LIKE '%instagram%' THEN 3
                    WHEN LOWER(v.name) LIKE '%google%' OR LOWER(v.name) LIKE '%gmail%' THEN 4
                    WHEN LOWER(v.name) LIKE '%snap%' THEN 5
                    WHEN LOWER(v.name) LIKE '%facebook%' THEN 6
                    ELSE 10
                  END ASC,
                  total_stock DESC
                LIMIT 8000
            """).fetchall()

            for r in popular_rows:
                s_name = r["service_name"]
                c_name = r["country_name"]
                raw_cost = float(r["min_price"] or 10.0)
                final_price = int(round(max(min_price_floor, raw_cost * (1 + pct_markup / 100.0) + fixed_markup)))
                final_price = max(15, final_price)
                stock_count = int(r["total_stock"] or 0)
                item_id = f"s4_{r['service_code']}_{r['country_code']}"

                items.append({
                    "id": item_id,
                    "service_code": r["service_code"],
                    "country_code": r["country_code"],
                    "operator_code": r["operator_code"],
                    "name": f"{s_name} ({c_name})",
                    "country": c_name,
                    "icon": "📶",
                    "price": final_price,
                    "stock": stock_count,
                    "subtitle": f"Fresh Carrier · {c_name}",
                })

        _SERVER4_CACHE["timestamp"] = now
        _SERVER4_CACHE["items"] = items
    except Exception as exc:
        logger.warning("Error querying server4_services: %s", exc)

    return items or _SERVER4_CACHE["items"]


_SERVER5_CACHE: dict[str, Any] = {"timestamp": 0.0, "items": []}

def get_server5_stock() -> list[dict[str, Any]]:
    """Return Server 5 catalogue (SMM Hub) with authentic rates, markup, and enabled providers."""
    import time
    now = time.time()
    if _SERVER5_CACHE["items"] and (now - _SERVER5_CACHE["timestamp"]) < 120.0:
        return _SERVER5_CACHE["items"]

    items = []
    try:
        with connect() as conn:
            cur_row = conn.execute("SELECT value FROM smm_settings WHERE key='default_currency'").fetchone()
            selling_currency = (cur_row["value"] if cur_row and cur_row["value"] else "INR").strip().upper()

            rows = conn.execute("""
                SELECT
                    s.id,
                    s.name,
                    s.description,
                    s.rate,
                    s.minimum,
                    s.maximum,
                    s.custom_markup,
                    s.markup_type,
                    s.markup_value,
                    s.category_id,
                    c.display_name AS category_name,
                    p.id AS provider_id,
                    p.currency AS provider_currency,
                    p.percent_markup AS provider_percent_markup,
                    p.exchange_rate AS provider_exchange_rate
                FROM smm_services s
                JOIN smm_categories c ON c.id = s.category_id
                JOIN smm_providers p ON p.id = s.provider_id
                WHERE s.enabled = 1
                  AND s.visible = 1
                  AND s.deleted_at IS NULL
                  AND c.visible = 1
                  AND p.enabled = 1
                  AND p.deleted_at IS NULL
                  AND LOWER(c.display_name) NOT LIKE '%private%'
                  AND LOWER(c.display_name) NOT LIKE '%dont use%'
                  AND LOWER(c.display_name) NOT LIKE '%non working%'
                  AND LOWER(c.display_name) NOT LIKE '%disabled%'
                ORDER BY s.featured DESC, s.popular DESC, s.sort_position ASC, s.name ASC
            """).fetchall()

            for r in rows:
                p_curr = str(r["provider_currency"] or "").strip().upper()
                exchange = 1.0 if p_curr == selling_currency else float(r["provider_exchange_rate"] or 83.0)
                cost_inr = float(r["rate"] or 0.0) * exchange
                percent = float(r["provider_percent_markup"] or 0.0)
                if r["custom_markup"]:
                    kind = r["markup_type"]
                    val = float(r["markup_value"] or 0.0)
                    if kind == "percentage":
                        percent = val
                    elif kind == "multiplier":
                        percent = (val - 1.0) * 100.0

                charge_inr = cost_inr * (1.0 + percent / 100.0)
                final_price = round(charge_inr, 2) if charge_inr >= 1.0 else round(charge_inr, 4)
                if final_price <= 0:
                    final_price = 1.0

                cat = r["category_name"] or "SMM"
                items.append({
                    "id": r["id"],
                    "name": r["name"],
                    "country": cat,
                    "category": cat,
                    "icon": "🚀",
                    "price": final_price,
                    "min_qty": int(r["minimum"] or 100),
                    "max_qty": int(r["maximum"] or 10000),
                    "stock": 9999,
                    "subtitle": f"{cat} · Rate per 1,000",
                })

        _SERVER5_CACHE["timestamp"] = now
        _SERVER5_CACHE["items"] = items
    except Exception as exc:
        logger.warning("Error querying server5_stock: %s", exc)

    return items or _SERVER5_CACHE["items"]


def get_user_server1_filters(uid: int) -> dict[str, str]:
    """Retrieve user-specific Server 1 filters with fallback to defaults."""
    default = {
        "spam": "no",
        "geoblock": "no",
        "login_mail": "any",
        "premium": "any",
        "offline": "any",
        "sort": "az",
    }
    try:
        import bot
        if hasattr(bot, "get_user_filters"):
            return bot.get_user_filters(uid)
    except Exception:
        pass

    try:
        with connect() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_server1_filters (
                    user_id INTEGER PRIMARY KEY,
                    spam TEXT DEFAULT 'no',
                    geoblock TEXT DEFAULT 'no',
                    login_mail TEXT DEFAULT 'any',
                    premium TEXT DEFAULT 'any',
                    offline TEXT DEFAULT 'any',
                    sort TEXT DEFAULT 'az',
                    updated_at TEXT
                )
            """)
            row = conn.execute("SELECT * FROM user_server1_filters WHERE user_id = ?", (uid,)).fetchone()
            if row:
                return {
                    "spam": row["spam"] or "no",
                    "geoblock": row["geoblock"] or "no",
                    "login_mail": row["login_mail"] or "any",
                    "premium": row["premium"] or "any",
                    "offline": row["offline"] or "any",
                    "sort": row["sort"] or "az",
                }
    except Exception as exc:
        logger.warning("Error reading user_server1_filters: %s", exc)

    return default


def set_user_server1_filters(uid: int, data: dict[str, Any]) -> dict[str, str]:
    """Persist and update user-specific Server 1 filters."""
    allowed_spam = {"no", "yes", "any"}
    allowed_geoblock = {"no", "yes", "any"}
    allowed_mail = {"yes", "no", "any"}
    allowed_premium = {"yes", "no", "any"}
    allowed_offline = {"any", "1", "7", "14", "30"}
    allowed_sort = {"az", "price_low", "price_high", "stock_high", "stock_low"}

    cur_filters = get_user_server1_filters(uid)

    spam = str(data.get("spam", cur_filters.get("spam", "no"))).lower()
    geoblock = str(data.get("geoblock", cur_filters.get("geoblock", "no"))).lower()
    login_mail = str(data.get("login_mail", cur_filters.get("login_mail", "any"))).lower()
    premium = str(data.get("premium", cur_filters.get("premium", "any"))).lower()
    offline = str(data.get("offline", cur_filters.get("offline", "any"))).lower()
    sort = str(data.get("sort", cur_filters.get("sort", "az"))).lower()

    if spam not in allowed_spam: spam = "no"
    if geoblock not in allowed_geoblock: geoblock = "no"
    if login_mail not in allowed_mail: login_mail = "any"
    if premium not in allowed_premium: premium = "any"
    if offline in allowed_offline:
        pass
    elif offline.isdigit() and 1 <= int(offline) <= 3650:
        pass
    else:
        offline = "any"
    if sort not in allowed_sort: sort = "az"

    updated = {
        "spam": spam,
        "geoblock": geoblock,
        "login_mail": login_mail,
        "premium": premium,
        "offline": offline,
        "sort": sort,
    }

    try:
        import bot
        if hasattr(bot, "user_filters"):
            bot.user_filters[uid] = updated.copy()
        if hasattr(bot, "active_filter_keys") and hasattr(bot, "get_filter_key"):
            bot.active_filter_keys.add(bot.get_filter_key(updated))
    except Exception:
        pass

    try:
        from database import utcnow
        now = utcnow()
        with connect() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_server1_filters (
                    user_id INTEGER PRIMARY KEY,
                    spam TEXT DEFAULT 'no',
                    geoblock TEXT DEFAULT 'no',
                    login_mail TEXT DEFAULT 'any',
                    premium TEXT DEFAULT 'any',
                    offline TEXT DEFAULT 'any',
                    sort TEXT DEFAULT 'az',
                    updated_at TEXT
                )
            """)
            conn.execute("""
                INSERT INTO user_server1_filters (user_id, spam, geoblock, login_mail, premium, offline, sort, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    spam = excluded.spam,
                    geoblock = excluded.geoblock,
                    login_mail = excluded.login_mail,
                    premium = excluded.premium,
                    offline = excluded.offline,
                    sort = excluded.sort,
                    updated_at = excluded.updated_at
            """, (uid, spam, geoblock, login_mail, premium, offline, sort, now))
            conn.commit()
    except Exception as exc:
        logger.warning("Error saving user_server1_filters: %s", exc)

    return updated


def get_pinned_services(server_no: int | None = None) -> list[dict[str, Any]]:
    """Return active pinned/featured services across servers with live prices and badges."""
    pinned = []
    try:
        with connect() as conn:
            if server_no is not None:
                rows = conn.execute("""
                    SELECT id, server_no, service_id, service_name, category_name, country_code, country_name, badge, display_order
                    FROM pinned_services
                    WHERE is_active = 1 AND server_no = ?
                    ORDER BY display_order ASC, id ASC
                """, (int(server_no),)).fetchall()
            else:
                rows = conn.execute("""
                    SELECT id, server_no, service_id, service_name, category_name, country_code, country_name, badge, display_order
                    FROM pinned_services
                    WHERE is_active = 1
                    ORDER BY display_order ASC, id ASC
                """).fetchall()

            for r in rows:
                s_no = int(r["server_no"])
                meta = SERVER_NAMES.get(s_no, {})
                s_name = meta.get("name", f"Server {s_no}")
                s_icon = meta.get("icon", "⚡")

                price = 0
                stock = None
                subtitle = meta.get("subtitle", "")
                min_qty = None
                max_qty = None

                svc_id = str(r["service_id"]).strip()
                cat_name = str(r["category_name"] or "").strip()
                c_name = str(r["country_name"] or "").strip()
                c_code = str(r["country_code"] or "").strip()

                try:
                    if s_no == 1:
                        target = c_name or svc_id
                        lzt_row = conn.execute(
                            "SELECT price, stock_count, flag FROM lzt_stock_cache WHERE country = ? OR iso_code = ?",
                            (target, target)
                        ).fetchone()
                        if lzt_row:
                            price = int(round(lzt_row["price"] or 80))
                            stock = int(lzt_row["stock_count"] or 0)
                            if lzt_row["flag"]:
                                s_icon = lzt_row["flag"]
                        else:
                            stk_row = conn.execute(
                                "SELECT price, COUNT(*) as cnt, country_icon FROM stock WHERE country_name = ? AND available = 1",
                                (target,)
                            ).fetchone()
                            if stk_row and stk_row["cnt"]:
                                price = int(stk_row["price"] or 80)
                                stock = int(stk_row["cnt"])
                                if stk_row["country_icon"]:
                                    s_icon = stk_row["country_icon"]
                        subtitle = "Global Market 2FA"

                    elif s_no == 2:
                        target = c_name or svc_id
                        stk_row = conn.execute(
                            "SELECT price, COUNT(*) as cnt, country_icon FROM stock WHERE country_name = ? AND available = 1",
                            (target,)
                        ).fetchone()
                        if stk_row and stk_row["cnt"]:
                            price = int(stk_row["price"] or 60)
                            stock = int(stk_row["cnt"])
                            if stk_row["country_icon"]:
                                s_icon = stk_row["country_icon"]
                        subtitle = "Session + TData Combo"

                    elif s_no == 3:
                        s3_row = conn.execute(
                            "SELECT provider_price FROM server3_services WHERE service_code = ? OR name = ?",
                            (svc_id, r["service_name"])
                        ).fetchone()
                        if s3_row:
                            price = int(s3_row["provider_price"] or 45)
                        subtitle = "Instant Virtual OTP"

                    elif s_no == 4:
                        s4_cfg = conn.execute("SELECT percent_markup, fixed_markup, minimum_price FROM service_servers WHERE server_no = 4").fetchone()
                        pct = float(s4_cfg["percent_markup"] if s4_cfg and s4_cfg["percent_markup"] is not None else 15.0)
                        fix = float(s4_cfg["fixed_markup"] if s4_cfg and s4_cfg["fixed_markup"] is not None else 0.0)
                        flr = float(s4_cfg["minimum_price"] if s4_cfg and s4_cfg["minimum_price"] is not None else 15.0)

                        s4_row = conn.execute(
                            "SELECT MIN(min_price) as mp, SUM(available_count) as cnt FROM server4_stock WHERE service_code = ?",
                            (svc_id,)
                        ).fetchone()
                        if s4_row and s4_row["mp"] is not None:
                            raw = float(s4_row["mp"])
                            calc_price = int(round(max(flr, raw * (1 + pct / 100.0) + fix)))
                            price = max(15, calc_price)
                            stock = int(s4_row["cnt"] or 0)
                        subtitle = "Fresh Carrier OTP"

                    elif s_no == 5:
                        s5_row = conn.execute(
                            "SELECT rate, minimum, maximum, name FROM smm_services WHERE id = ?",
                            (int(svc_id) if svc_id.isdigit() else 0,)
                        ).fetchone()
                        if s5_row:
                            price = int(s5_row["rate"] or 10)
                            min_qty = int(s5_row["minimum"] or 100)
                            max_qty = int(s5_row["maximum"] or 10000)
                            stock = 9999
                        subtitle = "Rate per 1,000"
                except Exception as inner_ex:
                    logger.debug("Failed to calculate live price for pinned service #%s: %s", r["id"], inner_ex)

                pinned.append({
                    "id": r["id"],
                    "server_no": s_no,
                    "server_name": s_name,
                    "server_icon": s_icon,
                    "service_id": svc_id,
                    "service_name": r["service_name"],
                    "category_name": cat_name,
                    "country_code": c_code,
                    "country_name": c_name,
                    "badge": r["badge"] or "🔥 Hot",
                    "display_order": int(r["display_order"] or 0),
                    "price": price,
                    "stock": stock,
                    "subtitle": subtitle,
                    "min_qty": min_qty,
                    "max_qty": max_qty,
                    "deep_link": f"pin_{r['id']}",
                })
    except Exception as exc:
        logger.error("Error querying pinned_services: %s", exc)

    return pinned
