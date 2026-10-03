"""Administrator management, RBAC permission enforcement, and analytics service."""
from __future__ import annotations

import logging
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
    reason: str = "Admin Adjustment"
) -> dict[str, Any]:
    """Adjust user balance or promo balance with audit deposit record."""
    from services.wallet_service import credit_balance
    return credit_balance(
        user_id=target_user_id,
        amount=amount,
        method_name=f"Admin #{admin_id}",
        reason=reason,
        is_promo=is_promo,
    )


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
