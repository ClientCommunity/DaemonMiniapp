"""Administrator management, RBAC permission enforcement, and analytics service."""
from __future__ import annotations

import logging
import os
from typing import Any

from config import MASTER_ADMIN_IDS
from database import (
    connect,
    transaction,
    utcnow,
    check_admin_permission,
    get_admin_permissions,
    get_stock_count,
    get_setting,
    set_setting,
    get_user_balances,
)

logger = logging.getLogger("services.admin")


def verify_admin(user_id: int, required_permission: str | None = None) -> bool:
    """Verify if user is an administrator and holds the required permission."""
    try:
        uid = int(user_id)
    except (ValueError, TypeError):
        return False

    if uid in MASTER_ADMIN_IDS:
        return True

    if not required_permission:
        # Check if user exists in admins table with any positive flag
        perms = get_admin_permissions(uid)
        return any(v == 1 for v in perms.values())

    return check_admin_permission(uid, required_permission)


def get_provider_balances() -> dict[str, Any]:
    """Compile upstream provider balances across Servers 1, 3, 4, and 5."""
    with connect() as conn:
        # Server 1 LZT Market
        lzt_tok = get_setting("lzt_token") or os.getenv("LZT_TOKEN", "")
        lzt_status = "connected" if lzt_tok else "disconnected"

        # Server 3 DGOTP
        s3_row = conn.execute("SELECT api_enabled, api_key FROM service_servers WHERE server_no = 3").fetchone()
        s3_status = "connected" if (s3_row and s3_row["api_enabled"] and s3_row["api_key"]) else "unconfigured"

        # Server 4 TemporaSMS
        s4_row = conn.execute("SELECT api_enabled, api_key FROM service_servers WHERE server_no = 4").fetchone()
        s4_status = "connected" if (s4_row and s4_row["api_enabled"] and s4_row["api_key"]) else "unconfigured"

        # Server 5 SMM Hub
        smm_row = conn.execute("SELECT COUNT(*), COALESCE(SUM(balance), 0) FROM smm_providers WHERE enabled = 1").fetchone()
        smm_count = smm_row[0] if smm_row else 0
        smm_bal = float(smm_row[1] if smm_row else 0.0)
        smm_status = "connected" if smm_count > 0 else "unconfigured"

    return {
        "server1": {"provider": "LZT Market", "status": lzt_status, "balance": 0.0, "currency": "RUB"},
        "server3": {"provider": "DGOTP", "status": s3_status, "balance": 0.0, "currency": "INR"},
        "server4": {"provider": "TemporaSMS", "status": s4_status, "balance": 0.0, "currency": "INR"},
        "server5": {"provider": "SMM Hub", "status": smm_status, "balance": smm_bal, "currency": "USD", "provider_count": smm_count},
    }


def get_system_stats() -> dict[str, Any]:
    """Compile comprehensive system statistics and KPI metrics."""
    with connect() as conn:
        user_count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        total_balance_row = conn.execute(
            "SELECT COALESCE(SUM(balance), 0), COALESCE(SUM(promo_balance), 0) FROM users"
        ).fetchone()

        deposit_stats = conn.execute(
            "SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM deposits WHERE status = 'success'"
        ).fetchone()

        order_stats = conn.execute(
            "SELECT COUNT(*), COALESCE(SUM(price), 0) FROM orders"
        ).fetchone()

        pending_deposits = conn.execute(
            "SELECT COUNT(*) FROM deposits WHERE status = 'pending'"
        ).fetchone()[0]

    good_stock = get_stock_count(quality_tier="good")
    cheap_stock = get_stock_count(quality_tier="cheap")
    prov_bals = get_provider_balances()

    return {
        "users_count": int(user_count or 0),
        "total_balance": int(total_balance_row[0] or 0),
        "total_promo_balance": int(total_balance_row[1] or 0),
        "successful_deposits_count": int(deposit_stats[0] or 0),
        "total_deposited_inr": int(deposit_stats[1] or 0),
        "total_orders_count": int(order_stats[0] or 0),
        "total_orders_revenue_inr": int(order_stats[1] or 0),
        "pending_deposits": int(pending_deposits or 0),
        "stock": {
            "good_quality": good_stock,
            "cheap_quality": cheap_stock,
            "total_available": good_stock + cheap_stock,
        },
        "provider_balances": prov_bals,
    }


def add_stock_item(
    phone: str,
    country_name: str,
    country_icon: str = "🌍",
    account_year: int = 2024,
    quality_tier: str = "good",
    price: int = 60,
    session_file: str | None = None,
    twofa: str = "None",
    seller_id: int | None = None,
) -> dict[str, Any]:
    """Add a new Server 2 account session into stock with quality tier tagging."""
    clean_phone = phone.replace("+", "").replace(" ", "").strip()
    tier = "cheap" if quality_tier.lower() == "cheap" else "good"

    with transaction(immediate=True) as conn:
        conn.execute("""
            INSERT INTO stock (
                phone, country_name, country_icon, account_year,
                quality_tier, price, session_file, twofa, available,
                seller_id, added_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            ON CONFLICT(phone) DO UPDATE SET
                country_name = excluded.country_name,
                country_icon = excluded.country_icon,
                account_year = excluded.account_year,
                quality_tier = excluded.quality_tier,
                price = excluded.price,
                session_file = excluded.session_file,
                twofa = excluded.twofa,
                available = 1
        """, (
            clean_phone, country_name, country_icon, int(account_year),
            tier, int(price), session_file or f"{clean_phone}.session",
            twofa, seller_id, utcnow()
        ))

    return {"success": True, "phone": clean_phone, "tier": tier}


def adjust_user_balance(
    admin_id: int,
    target_user_id: int,
    amount: int,
    is_promo: bool = False,
    reason: str = "Admin Adjustment",
    type_: str = "credit",
) -> dict[str, Any]:
    """Adjust user balance or promo balance (credit or debit) with audit deposit record."""
    abs_amt = abs(int(amount))
    is_debit = (str(type_).strip().lower() == "debit") or (int(amount) < 0)

    if not is_debit:
        from services.wallet_service import credit_balance
        res = credit_balance(
            user_id=target_user_id,
            amount=abs_amt,
            method_name=f"Admin #{admin_id}",
            reason=reason,
            is_promo=is_promo,
        )
        if isinstance(res, dict) and res.get("success"):
            balances = get_user_balances(target_user_id)
            res.update(balances)
            res["balance"] = balances.get("balance", res.get("new_balance"))
        return res

    # Debit flow: strictly floor at 0 and log audit record
    with transaction(immediate=True) as conn:
        user = conn.execute("SELECT balance, promo_balance FROM users WHERE user_id = ?", (target_user_id,)).fetchone()
        if not user:
            return {"success": False, "error": f"User {target_user_id} not found."}

        cur_bal = int(user["balance"] or 0)
        cur_promo = int(user["promo_balance"] or 0)

        if is_promo:
            deducted = min(cur_promo, abs_amt)
            new_promo = cur_promo - deducted
            new_bal = max(0, cur_bal - deducted)
            conn.execute("UPDATE users SET promo_balance = ?, balance = ? WHERE user_id = ?",
                         (new_promo, new_bal, target_user_id))
        else:
            deducted = min(cur_bal, abs_amt)
            new_bal = cur_bal - deducted
            new_promo = min(cur_promo, new_bal)
            conn.execute("UPDATE users SET balance = ?, promo_balance = ? WHERE user_id = ?",
                         (new_bal, new_promo, target_user_id))

        conn.execute("""
            INSERT INTO deposits (user_id, amount, method_name, status, date)
            VALUES (?, ?, ?, 'success', ?)
        """, (target_user_id, -deducted, f"Admin Debit #{admin_id} ({reason})", utcnow()))

    balances = get_user_balances(target_user_id)
    return {
        "success": True,
        "user_id": target_user_id,
        "deducted": deducted,
        "balance": balances["balance"],
        "promo_balance": balances["promo_balance"],
        "transferable_balance": balances["transferable_balance"],
        "sales_balance": balances["sales_balance"],
    }


def list_pending_deposits() -> list[dict[str, Any]]:
    """List all pending manual deposits and FamPay appeal reviews."""
    with connect() as conn:
        rows = conn.execute("""
            SELECT id, user_id, amount, method_name, status, date
            FROM deposits
            WHERE status = 'pending'
            ORDER BY id DESC LIMIT 50
        """).fetchall()

    return [
        {
            "id": r["id"],
            "user_id": r["user_id"],
            "amount": int(r["amount"] or 0),
            "method_name": r["method_name"],
            "date": str(r["date"]),
        }
        for r in rows
    ]


def process_deposit_decision(deposit_id: int, approve: bool, approved_amount: int | None = None) -> dict[str, Any]:
    """Approve or reject a pending manual deposit."""
    with transaction(immediate=True) as conn:
        dep = conn.execute("SELECT user_id, amount, status FROM deposits WHERE id = ?", (deposit_id,)).fetchone()
        if not dep:
            return {"success": False, "error": "Deposit record not found."}
        if dep["status"] != "pending":
            return {"success": False, "error": f"Deposit is already {dep['status']}."}

        uid = dep["user_id"]
        amt = approved_amount if approved_amount is not None else int(dep["amount"] or 0)

        if approve:
            conn.execute("UPDATE deposits SET status = 'success', amount = ? WHERE id = ?", (amt, deposit_id))
            conn.execute("UPDATE users SET balance = balance + ?, total_deposited = total_deposited + ? WHERE user_id = ?",
                         (amt, amt, uid))
            status_result = "approved"
        else:
            conn.execute("UPDATE deposits SET status = 'rejected' WHERE id = ?", (deposit_id,))
            status_result = "rejected"

    return {"success": True, "deposit_id": deposit_id, "status": status_result, "user_id": uid, "amount": amt}


def list_stock_items(quality_tier: str | None = None, available_only: bool = True, limit: int = 50) -> list[dict[str, Any]]:
    """List stock items with optional tier filtering and availability filter."""
    query = "SELECT phone, country_name, country_icon, account_year, quality_tier, price, available, twofa, added_date FROM stock WHERE 1=1"
    params: list[Any] = []
    if available_only:
        query += " AND available = 1"
    if quality_tier and quality_tier in ("good", "cheap"):
        query += " AND quality_tier = ?"
        params.append(quality_tier)
    query += " ORDER BY added_date DESC LIMIT ?"
    params.append(limit)

    with connect() as conn:
        rows = conn.execute(query, params).fetchall()

    return [
        {
            "phone": r["phone"],
            "country_name": r["country_name"],
            "country_icon": r["country_icon"],
            "account_year": r["account_year"],
            "quality_tier": r["quality_tier"],
            "price": r["price"],
            "available": r["available"],
            "twofa": r["twofa"],
            "added_date": str(r["added_date"]),
        }
        for r in rows
    ]


def manage_stock_item(phone: str, action: str = "delete", price: int | None = None, available: int | None = None) -> dict[str, Any]:
    """Manage, update or delete a stock item."""
    clean_phone = phone.replace("+", "").replace(" ", "").strip()
    with transaction(immediate=True) as conn:
        existing = conn.execute("SELECT phone FROM stock WHERE phone = ?", (clean_phone,)).fetchone()
        if not existing:
            return {"success": False, "error": f"Stock item with phone {clean_phone} not found."}

        if action == "delete":
            conn.execute("DELETE FROM stock WHERE phone = ?", (clean_phone,))
            return {"success": True, "action": "deleted", "phone": clean_phone}
        elif action == "update":
            updates = []
            params = []
            if price is not None:
                updates.append("price = ?")
                params.append(int(price))
            if available is not None:
                updates.append("available = ?")
                params.append(int(available))
            if not updates:
                return {"success": False, "error": "No update fields provided."}
            params.append(clean_phone)
            conn.execute(f"UPDATE stock SET {', '.join(updates)} WHERE phone = ?", params)
            return {"success": True, "action": "updated", "phone": clean_phone}

    return {"success": False, "error": f"Unknown action: {action}"}


def bulk_add_stock_items(
    items: list[dict[str, Any]],
    country_name: str,
    account_year: int = 2024,
    quality_tier: str = "good",
    price: int = 60,
    country_icon: str = "🌍",
    seller_id: int | None = None,
) -> dict[str, Any]:
    """Bulk upload Server 2 accounts with strict quality_tier enforcement."""
    tier = str(quality_tier).strip().lower()
    if tier not in ("good", "cheap"):
        raise ValueError("Invalid quality_tier. Must be 'good' or 'cheap'.")

    inserted_count = 0
    now_ts = utcnow()
    with transaction(immediate=True) as conn:
        for it in items:
            if isinstance(it, dict):
                raw_phone = it.get("phone", "")
                item_twofa = it.get("twofa", "None")
                item_session = it.get("session_data") or it.get("session_file") or ""
                item_price = int(it.get("price", price))
                item_year = int(it.get("year", account_year))
                item_country = it.get("country", country_name)
            else:
                raw_phone = str(it)
                item_twofa = "None"
                item_session = ""
                item_price = price
                item_year = account_year
                item_country = country_name
            clean_phone = raw_phone.replace("+", "").replace(" ", "").strip()
            if not clean_phone:
                continue
            if not item_session:
                item_session = f"{clean_phone}.session"
            conn.execute("""
                INSERT INTO stock (
                    phone, country_name, country_icon, account_year,
                    quality_tier, price, session_file, twofa, available,
                    seller_id, added_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                ON CONFLICT(phone) DO UPDATE SET
                    country_name = excluded.country_name,
                    country_icon = excluded.country_icon,
                    account_year = excluded.account_year,
                    quality_tier = excluded.quality_tier,
                    price = excluded.price,
                    session_file = excluded.session_file,
                    twofa = excluded.twofa,
                    available = 1
            """, (
                clean_phone, item_country, country_icon, item_year,
                tier, item_price, item_session, item_twofa, seller_id, now_ts
            ))
            inserted_count += 1

    return {"success": True, "count": inserted_count, "tier": tier}


def search_users(query: str | int) -> dict[str, Any]:
    """Search user by Telegram ID or username with balance breakdown and purchase history."""
    q_str = str(query).strip().lstrip("@")
    user_id = int(q_str) if q_str.isdigit() else None

    with connect() as conn:
        if user_id is None:
            row_smm = conn.execute("SELECT user_id FROM smm_orders WHERE username LIKE ? LIMIT 1", (f"%{q_str}%",)).fetchone()
            if row_smm:
                user_id = row_smm["user_id"]

        if user_id is None:
            return {"success": False, "error": f"User '{query}' not found."}

        u = conn.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)).fetchone()
        if not u:
            return {"success": False, "error": f"User ID {user_id} not found."}

        orders = conn.execute("""
            SELECT id, country, year, price, phone, otp, server, date
            FROM orders
            WHERE user_id = ?
            ORDER BY id DESC LIMIT 20
        """, (user_id,)).fetchall()

        deposits = conn.execute("""
            SELECT id, amount, method_name, status, date
            FROM deposits
            WHERE user_id = ?
            ORDER BY id DESC LIMIT 20
        """, (user_id,)).fetchall()

    bal = int(u["balance"] or 0)
    promo = int(u["promo_balance"] or 0)
    trans = max(0, bal - promo)
    sales = int(u["sales_balance"] or 0)

    return {
        "success": True,
        "user": {
            "user_id": user_id,
            "balance": bal,
            "promo_balance": promo,
            "transferable_balance": trans,
            "sales_balance": sales,
            "total_deposited": int(u["total_deposited"] or 0),
            "banned": bool(u["banned"]),
            "joined_date": str(u["joined_date"]),
            "pref_curr": u["pref_curr"] or "INR",
        },
        "orders": [dict(r) for r in orders],
        "deposits": [dict(r) for r in deposits],
    }


def set_user_ban_status(user_id: int, banned: int | None = None) -> dict[str, Any]:
    """Ban or unban user."""
    with transaction(immediate=True) as conn:
        u = conn.execute("SELECT banned FROM users WHERE user_id = ?", (user_id,)).fetchone()
        if not u:
            conn.execute("INSERT INTO users (user_id, banned) VALUES (?, 1)", (user_id,))
            new_banned = 1
        else:
            if banned is not None:
                new_banned = 1 if banned else 0
            else:
                new_banned = 0 if u["banned"] else 1
            conn.execute("UPDATE users SET banned = ? WHERE user_id = ?", (new_banned, user_id))

    return {"success": True, "user_id": user_id, "banned": new_banned}


def get_server1_settings() -> dict[str, Any]:
    """Get Server 1 LZT master toggle, token status, and country markups."""
    status = get_setting("server1_status", "on")
    global_markup = int(get_setting("lzt_global_markup", "20") or 20)
    token = get_setting("lzt_token") or os.getenv("LZT_TOKEN", "")
    with connect() as conn:
        rows = conn.execute("SELECT country, markup_percent FROM lzt_settings ORDER BY country ASC").fetchall()
    return {
        "status": status,
        "global_markup": global_markup,
        "has_token": bool(token),
        "countries": [{"country": r["country"], "markup_percent": r["markup_percent"]} for r in rows],
    }


def set_server1_status(status: str) -> dict[str, Any]:
    """Toggle Server 1 on/off."""
    clean_status = "off" if str(status).strip().lower() in ("off", "0", "false") else "on"
    set_setting("server1_status", clean_status)
    return {"success": True, "server1_status": clean_status}


def set_server1_country_markup(country: str, markup_percent: int) -> dict[str, Any]:
    """Set custom country markup percentage for Server 1."""
    pct = int(markup_percent)
    with transaction(immediate=True) as conn:
        if pct <= 0:
            conn.execute("DELETE FROM lzt_settings WHERE country = ?", (country,))
        else:
            conn.execute("""
                INSERT INTO lzt_settings (country, markup_percent) VALUES (?, ?)
                ON CONFLICT(country) DO UPDATE SET markup_percent = excluded.markup_percent
            """, (country, pct))
        conn.execute("DELETE FROM lzt_stock_cache WHERE country = ?", (country,))
    return {"success": True, "country": country, "markup_percent": pct}


def get_service_server_config(server_no: int) -> dict[str, Any]:
    """Inspect Server 3 or 4 service configuration."""
    with connect() as conn:
        r = conn.execute("SELECT * FROM service_servers WHERE server_no = ?", (server_no,)).fetchone()
    if not r:
        return {"server_no": server_no, "service_enabled": 0, "api_enabled": 0, "has_api_key": False}
    d = dict(r)
    d["has_api_key"] = bool(d.get("api_key"))
    return d


def update_service_server_config(server_no: int, updates: dict[str, Any]) -> dict[str, Any]:
    """Update configuration for Server 3 or Server 4."""
    allowed = {
        "service_enabled", "display_name", "api_enabled", "api_url", "api_key",
        "percent_markup", "fixed_markup", "priority", "minimum_price", "maximum_price",
        "retry_count", "timeout_seconds"
    }
    # Auto-encrypt api_key if provided as plain text
    if "api_key" in updates and updates["api_key"]:
        raw_key = str(updates["api_key"]).strip()
        if raw_key and not raw_key.startswith("enc:"):
            try:
                from secrets_manager import encrypt_secret
                updates["api_key"] = f"enc:{encrypt_secret(raw_key)}"
            except Exception:
                updates["api_key"] = raw_key
        elif not raw_key:
            updates["api_key"] = ""

    cols = []
    vals = []
    for k, v in updates.items():
        if k in allowed:
            cols.append(f"{k} = ?")
            vals.append(v)
    if not cols:
        return {"success": False, "error": "No valid fields provided."}
    vals.append(server_no)
    with transaction(immediate=True) as conn:
        conn.execute(f"UPDATE service_servers SET {', '.join(cols)} WHERE server_no = ?", vals)
        if "service_enabled" in updates:
            st = "on" if updates["service_enabled"] else "off"
            conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (f"server{server_no}_status", st))
    return {"success": True, "server_no": server_no, "updated": list(updates.keys())}


def toggle_service_server(server_no: int, enabled: int | None = None) -> dict[str, Any]:
    """Toggle service server (3 or 4) on/off."""
    with transaction(immediate=True) as conn:
        cur = conn.execute("SELECT service_enabled FROM service_servers WHERE server_no = ?", (server_no,)).fetchone()
        if not cur:
            conn.execute("INSERT INTO service_servers (server_no, service_enabled) VALUES (?, 1)", (server_no,))
            new_st = 1
        else:
            new_st = (1 if enabled else 0) if enabled is not None else (0 if cur["service_enabled"] else 1)
            conn.execute("UPDATE service_servers SET service_enabled = ? WHERE server_no = ?", (new_st, server_no))
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (f"server{server_no}_status", "on" if new_st else "off"))
    return {"success": True, "server_no": server_no, "service_enabled": new_st}


def list_server3_services(limit: int = 100) -> list[dict[str, Any]]:
    """List Server 3 services."""
    with connect() as conn:
        rows = conn.execute("""
            SELECT service_code, server_code, name, provider_price, enabled, in_stock
            FROM server3_services
            ORDER BY name ASC LIMIT ?
        """, (limit,)).fetchall()
    return [dict(r) for r in rows]


def toggle_server3_service(service_code: str, server_code: str | None = None) -> dict[str, Any]:
    """Toggle Server 3 service status."""
    with transaction(immediate=True) as conn:
        if server_code:
            conn.execute("UPDATE server3_services SET enabled = 1 - enabled WHERE service_code = ? AND server_code = ?",
                         (service_code, server_code))
        else:
            conn.execute("UPDATE server3_services SET enabled = 1 - enabled WHERE service_code = ?",
                         (service_code,))
    return {"success": True, "service_code": service_code}


def list_server4_services(limit: int = 100) -> list[dict[str, Any]]:
    """List Server 4 services."""
    with connect() as conn:
        rows = conn.execute("""
            SELECT operator_code, service_code, name, enabled, in_stock
            FROM server4_services
            ORDER BY name ASC LIMIT ?
        """, (limit,)).fetchall()
    return [dict(r) for r in rows]


def toggle_server4_service(operator_code: str, service_code: str) -> dict[str, Any]:
    """Toggle Server 4 service status."""
    with transaction(immediate=True) as conn:
        conn.execute("UPDATE server4_services SET enabled = 1 - enabled WHERE operator_code = ? AND service_code = ?",
                     (operator_code, service_code))
    return {"success": True, "operator_code": operator_code, "service_code": service_code}


def get_smm_overview() -> dict[str, Any]:
    """Overview metrics for Server 5 (SMM Hub)."""
    with connect() as conn:
        smm_row = conn.execute("SELECT value FROM smm_settings WHERE key = 'enabled'").fetchone()
        enabled = smm_row["value"] if smm_row else "0"
        providers_count = conn.execute("SELECT COUNT(*) FROM smm_providers WHERE enabled = 1").fetchone()[0]
        categories_count = conn.execute("SELECT COUNT(*) FROM smm_categories WHERE visible = 1").fetchone()[0]
        services_count = conn.execute("SELECT COUNT(*) FROM smm_services WHERE enabled = 1 AND visible = 1").fetchone()[0]
        orders_count = conn.execute("SELECT COUNT(*) FROM smm_orders").fetchone()[0]
    return {
        "enabled": (enabled == "1"),
        "providers_count": int(providers_count or 0),
        "categories_count": int(categories_count or 0),
        "services_count": int(services_count or 0),
        "orders_count": int(orders_count or 0),
    }


def toggle_smm_master(enabled: int | None = None) -> dict[str, Any]:
    """Toggle Server 5 master on/off."""
    with transaction(immediate=True) as conn:
        cur = conn.execute("SELECT value FROM smm_settings WHERE key = 'enabled'").fetchone()
        cur_val = cur["value"] if cur else "0"
        if enabled is not None:
            new_val = "1" if enabled else "0"
        else:
            new_val = "0" if cur_val == "1" else "1"
        conn.execute("INSERT OR REPLACE INTO smm_settings (key, value) VALUES ('enabled', ?)", (new_val,))
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('server5_status', ?)", ("on" if new_val == "1" else "off",))
    return {"success": True, "enabled": (new_val == "1")}


def list_smm_providers() -> list[dict[str, Any]]:
    """List SMM providers."""
    with connect() as conn:
        rows = conn.execute("""
            SELECT id, name, api_url, enabled, currency, balance, percent_markup, fixed_markup, auto_sync
            FROM smm_providers ORDER BY id ASC
        """).fetchall()
    return [dict(r) for r in rows]


def add_smm_provider(
    name: str,
    api_url: str,
    api_key: str,
    percent_markup: float = 40.0,
    currency: str = "USD"
) -> dict[str, Any]:
    """Add new SMM provider."""
    now_ts = utcnow()
    with transaction(immediate=True) as conn:
        cur = conn.execute("""
            INSERT INTO smm_providers (
                name, api_url, api_key, percent_markup, currency,
                enabled, balance, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 1, 0.0, ?, ?)
        """, (name, api_url, api_key, float(percent_markup), currency, now_ts, now_ts))
        new_id = cur.lastrowid
    return {"success": True, "provider_id": new_id, "name": name}


def toggle_smm_provider(provider_id: int) -> dict[str, Any]:
    """Toggle SMM provider status."""
    with transaction(immediate=True) as conn:
        conn.execute("UPDATE smm_providers SET enabled = 1 - enabled WHERE id = ?", (provider_id,))
    return {"success": True, "provider_id": provider_id}


def delete_smm_provider(provider_id: int) -> dict[str, Any]:
    """Delete SMM provider."""
    with transaction(immediate=True) as conn:
        conn.execute("DELETE FROM smm_providers WHERE id = ?", (provider_id,))
    return {"success": True, "provider_id": provider_id}


def list_smm_categories() -> list[dict[str, Any]]:
    """List SMM categories with visibility flags."""
    with connect() as conn:
        rows = conn.execute("""
            SELECT c.id, c.provider_id, c.display_name, c.visible, p.name as provider_name
            FROM smm_categories c
            LEFT JOIN smm_providers p ON p.id = c.provider_id
            ORDER BY c.sort_position ASC, c.display_name ASC
        """).fetchall()
    return [dict(r) for r in rows]


def toggle_smm_category(category_id: int) -> dict[str, Any]:
    """Toggle SMM category visibility."""
    with transaction(immediate=True) as conn:
        conn.execute("UPDATE smm_categories SET visible = 1 - visible WHERE id = ?", (category_id,))
    return {"success": True, "category_id": category_id}


def list_smm_services(category_id: int | None = None, limit: int = 100) -> list[dict[str, Any]]:
    """List SMM services."""
    query = """
        SELECT s.id, s.provider_id, s.category_id, s.name, s.rate, s.enabled, s.visible, c.display_name as category
        FROM smm_services s
        LEFT JOIN smm_categories c ON c.id = s.category_id
        WHERE 1=1
    """
    params: list[Any] = []
    if category_id:
        query += " AND s.category_id = ?"
        params.append(category_id)
    query += " ORDER BY s.id ASC LIMIT ?"
    params.append(limit)
    with connect() as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]


def toggle_smm_service(service_id: int) -> dict[str, Any]:
    """Toggle SMM service visibility and enabled flag."""
    with transaction(immediate=True) as conn:
        conn.execute("UPDATE smm_services SET visible = 1 - visible, enabled = 1 - enabled WHERE id = ?", (service_id,))
    return {"success": True, "service_id": service_id}


def list_smm_orders(limit: int = 50) -> list[dict[str, Any]]:
    """Inspect live SMM orders log."""
    with connect() as conn:
        rows = conn.execute("""
            SELECT id, user_id, service_id, provider_id, quantity, link, charge, status, created_at
            FROM smm_orders ORDER BY id DESC LIMIT ?
        """, (limit,)).fetchall()
    return [dict(r) for r in rows]


def list_fampay_gateways() -> list[dict[str, Any]]:
    """List FamPay UPI gateways."""
    with connect() as conn:
        rows = conn.execute("""
            SELECT id, name, upi_id, payment_name, min_deposit, max_deposit, gmail, enabled, created_at
            FROM fampay_gateways ORDER BY id ASC
        """).fetchall()
    return [dict(r) for r in rows]


def add_fampay_gateway(
    name: str,
    upi_id: str,
    payment_name: str = "Payment",
    min_deposit: int = 1,
    max_deposit: int = 50000,
    gmail: str = "",
    app_password: str = "",
    enabled: int = 1,
) -> dict[str, Any]:
    """Add a new FamPay gateway."""
    with transaction(immediate=True) as conn:
        cur = conn.execute("""
            INSERT INTO fampay_gateways (
                name, upi_id, payment_name, min_deposit, max_deposit, gmail, app_password, enabled
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (name, upi_id, payment_name, int(min_deposit), int(max_deposit), gmail, app_password, int(enabled)))
        new_id = cur.lastrowid
    return {"success": True, "gateway_id": new_id, "name": name}


def update_fampay_gateway(gw_id: int, updates: dict[str, Any]) -> dict[str, Any]:
    """Update existing FamPay gateway configuration."""
    allowed = {"name", "upi_id", "payment_name", "min_deposit", "max_deposit", "gmail", "app_password", "enabled"}
    cols = []
    vals = []
    for k, v in updates.items():
        if k in allowed:
            cols.append(f"{k} = ?")
            vals.append(v)
    if not cols:
        return {"success": False, "error": "No valid fields provided."}
    vals.append(gw_id)
    with transaction(immediate=True) as conn:
        conn.execute(f"UPDATE fampay_gateways SET {', '.join(cols)} WHERE id = ?", vals)
    return {"success": True, "gateway_id": gw_id}


def delete_fampay_gateway(gw_id: int) -> dict[str, Any]:
    """Delete a FamPay gateway."""
    with transaction(immediate=True) as conn:
        conn.execute("DELETE FROM fampay_gateways WHERE id = ?", (gw_id,))
    return {"success": True, "gateway_id": gw_id}


def toggle_fampay_gateway(gw_id: int) -> dict[str, Any]:
    """Toggle FamPay gateway enabled flag."""
    with transaction(immediate=True) as conn:
        conn.execute("UPDATE fampay_gateways SET enabled = 1 - enabled WHERE id = ?", (gw_id,))
    return {"success": True, "gateway_id": gw_id}


def list_custom_payments() -> list[dict[str, Any]]:
    """List custom payment methods."""
    with connect() as conn:
        rows = conn.execute("SELECT id, name, caption, qr_file_id FROM custom_payments ORDER BY id ASC").fetchall()
    return [dict(r) for r in rows]


def add_custom_payment(name: str, caption: str = "", qr_file_id: str = "") -> dict[str, Any]:
    """Create a new custom payment method."""
    with transaction(immediate=True) as conn:
        cur = conn.execute("INSERT INTO custom_payments (name, caption, qr_file_id) VALUES (?, ?, ?)",
                           (name, caption, qr_file_id))
        new_id = cur.lastrowid
    return {"success": True, "payment_id": new_id, "name": name}


def update_custom_payment(pid: int, updates: dict[str, Any]) -> dict[str, Any]:
    """Update custom payment method."""
    allowed = {"name", "caption", "qr_file_id"}
    cols = []
    vals = []
    for k, v in updates.items():
        if k in allowed:
            cols.append(f"{k} = ?")
            vals.append(v)
    if not cols:
        return {"success": False, "error": "No valid fields provided."}
    vals.append(pid)
    with transaction(immediate=True) as conn:
        conn.execute(f"UPDATE custom_payments SET {', '.join(cols)} WHERE id = ?", vals)
    return {"success": True, "payment_id": pid}


def delete_custom_payment(pid: int) -> dict[str, Any]:
    """Delete custom payment method."""
    with transaction(immediate=True) as conn:
        conn.execute("DELETE FROM custom_payments WHERE id = ?", (pid,))
    return {"success": True, "payment_id": pid}


def list_promo_codes() -> list[dict[str, Any]]:
    """List all promo codes."""
    with connect() as conn:
        rows = conn.execute("SELECT code, value, max_uses, used_count FROM promo_codes ORDER BY rowid DESC").fetchall()
    return [dict(r) for r in rows]


def create_promo_code(code: str | None, value: int, max_uses: int = 1) -> dict[str, Any]:
    """Create a new promotional code."""
    import random
    import string
    c = str(code).strip() if code else ("PROMO" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8)))
    with transaction(immediate=True) as conn:
        conn.execute("INSERT INTO promo_codes (code, value, max_uses, used_count) VALUES (?, ?, ?, 0)",
                     (c, int(value), int(max_uses)))
    return {"success": True, "code": c, "value": int(value), "max_uses": int(max_uses)}


def delete_promo_code(code: str) -> dict[str, Any]:
    """Delete a promo code."""
    with transaction(immediate=True) as conn:
        conn.execute("DELETE FROM promo_codes WHERE code = ?", (code,))
    return {"success": True, "code": code}


def get_reseller_settings() -> dict[str, Any]:
    """Retrieve reseller margin bounds and status."""
    min_m = int(get_setting("reseller_min_margin", "5") or 5)
    max_m = int(get_setting("reseller_max_margin", "100") or 100)
    status = get_setting("reseller_status", "on")
    return {"min_margin": min_m, "max_margin": max_m, "status": status}


def set_reseller_settings(min_margin: int, max_margin: int, status: str = "on") -> dict[str, Any]:
    """Set reseller bounds (strictly between 5 and 100) and global status."""
    min_val = max(5, int(min_margin))
    max_val = min(100, int(max_margin))
    if min_val > max_val:
        min_val, max_val = 5, 100
    clean_st = "off" if str(status).lower() in ("off", "0", "false") else "on"
    set_setting("reseller_min_margin", str(min_val))
    set_setting("reseller_max_margin", str(max_val))
    set_setting("reseller_status", clean_st)
    return {"success": True, "min_margin": min_val, "max_margin": max_val, "status": clean_st}

