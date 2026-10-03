"""Administrator RBAC and store management Blueprint.

Enforces permission checks via database `admins` table and MASTER_ADMIN_IDS:
- p_stats: System analytics & KPI
- p_add_stock: Upload Server 2 accounts with quality tiers
- p_manage_stock: Inspect and delete stock
- p_bal: Adjust user balances & approve manual deposits
- p_settings: Configure store and reseller settings
"""
from __future__ import annotations

import logging
from flask import Blueprint, jsonify, request

from database import get_admin_permissions, get_setting, set_setting
from services.admin_service import (
    verify_admin,
    get_system_stats,
    add_stock_item,
    list_stock_items,
    manage_stock_item,
    adjust_user_balance,
    list_pending_deposits,
    process_deposit_decision,
)
from services.auth_service import get_current_user_id

logger = logging.getLogger("api.admin")
admin_bp = Blueprint("admin", __name__)


def _require_permission(perm: str | None = None):
    """Helper to verify admin session and permission."""
    uid = get_current_user_id(request)
    if not uid:
        return None, (jsonify({"success": False, "error": "Unauthorized"}), 401)

    if not verify_admin(uid, perm):
        return None, (jsonify({"success": False, "error": "Forbidden: Insufficient administrator permissions."}), 403)

    return uid, None


@admin_bp.route("/api/admin/me", methods=["GET"])
def admin_status():
    """Return caller's administrator status and active permissions."""
    uid = get_current_user_id(request)
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    is_adm = verify_admin(uid)
    perms = get_admin_permissions(uid)

    return jsonify({
        "success": True,
        "user_id": uid,
        "is_admin": is_adm,
        "permissions": perms,
    })


@admin_bp.route("/api/admin/stats", methods=["GET"])
def admin_stats():
    """Return high-level system analytics, sales revenue, and inventory counters."""
    uid, err = _require_permission("p_stats")
    if err:
        return err

    stats = get_system_stats()
    return jsonify({"success": True, "stats": stats})


@admin_bp.route("/api/admin/stock/add", methods=["POST"])
def admin_add_stock():
    """Upload a Server 2 session account into stock with quality tier tagging."""
    uid, err = _require_permission("p_add_stock")
    if err:
        return err

    data = request.get_json(silent=True) or {}
    phone = data.get("phone", "").strip()
    country_name = data.get("country_name", "Unknown").strip()
    quality_tier = data.get("quality_tier", "good").strip()
    account_year = data.get("account_year", 2024)
    price = data.get("price", 60)
    session_file = data.get("session_file")
    twofa = data.get("twofa", "None")

    if not phone:
        return jsonify({"success": False, "error": "Phone number is required."}), 400

    result = add_stock_item(
        phone=phone,
        country_name=country_name,
        country_icon=data.get("country_icon", "🌍"),
        account_year=account_year,
        quality_tier=quality_tier,
        price=price,
        session_file=session_file,
        twofa=twofa,
        seller_id=uid,
    )
    return jsonify(result)


@admin_bp.route("/api/admin/stock/manage", methods=["GET", "POST", "DELETE"])
def admin_manage_stock():
    """Inspect, update, or remove stock items."""
    uid, err = _require_permission("p_manage_stock")
    if err:
        return err

    if request.method == "GET":
        tier = request.args.get("tier")
        limit = int(request.args.get("limit", 50))
        items = list_stock_items(quality_tier=tier, limit=limit)
        return jsonify({"success": True, "items": items})

    if request.method == "DELETE":
        phone = request.args.get("phone") or (request.get_json(silent=True) or {}).get("phone", "")
        if not phone:
            return jsonify({"success": False, "error": "Phone parameter required."}), 400
        result = manage_stock_item(phone=phone, action="delete")
        status_code = 200 if result.get("success") else 400
        return jsonify(result), status_code

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        action = data.get("action", "update")
        phone = data.get("phone", "")
        if not phone:
            return jsonify({"success": False, "error": "Phone parameter required."}), 400
        result = manage_stock_item(
            phone=phone,
            action=action,
            price=data.get("price"),
            available=data.get("available"),
        )
        status_code = 200 if result.get("success") else 400
        return jsonify(result), status_code


@admin_bp.route("/api/admin/users/balance", methods=["POST"])
def admin_adjust_balance():
    """Adjust user balance or promo balance."""
    uid, err = _require_permission("p_bal")
    if err:
        return err

    data = request.get_json(silent=True) or {}
    target_uid = data.get("user_id")
    amount = data.get("amount")
    is_promo = bool(data.get("is_promo", False))
    reason = str(data.get("reason", "Admin Balance Adjustment"))

    if not target_uid or amount is None:
        return jsonify({"success": False, "error": "user_id and amount are required."}), 400

    result = adjust_user_balance(
        admin_id=uid,
        target_user_id=int(target_uid),
        amount=int(amount),
        is_promo=is_promo,
        reason=reason,
    )
    return jsonify(result)


@admin_bp.route("/api/admin/deposits/pending", methods=["GET"])
def admin_pending_deposits():
    """List pending manual deposits awaiting administrator decision."""
    uid, err = _require_permission("p_bal")
    if err:
        return err

    items = list_pending_deposits()
    return jsonify({"success": True, "deposits": items})


@admin_bp.route("/api/admin/deposits/approve", methods=["POST"])
def admin_approve_deposit():
    """Approve a pending manual deposit and credit user wallet."""
    uid, err = _require_permission("p_bal")
    if err:
        return err

    data = request.get_json(silent=True) or {}
    dep_id = data.get("deposit_id")
    approved_amt = data.get("amount")

    if not dep_id:
        return jsonify({"success": False, "error": "deposit_id is required."}), 400

    result = process_deposit_decision(
        deposit_id=int(dep_id),
        approve=True,
        approved_amount=int(approved_amt) if approved_amt is not None else None,
    )
    return jsonify(result)


@admin_bp.route("/api/admin/deposits/reject", methods=["POST"])
def admin_reject_deposit():
    """Reject a pending manual deposit."""
    uid, err = _require_permission("p_bal")
    if err:
        return err

    data = request.get_json(silent=True) or {}
    dep_id = data.get("deposit_id")

    if not dep_id:
        return jsonify({"success": False, "error": "deposit_id is required."}), 400

    result = process_deposit_decision(deposit_id=int(dep_id), approve=False)
    return jsonify(result)


@admin_bp.route("/api/admin/settings", methods=["GET", "POST"])
def admin_settings_endpoint():
    """Inspect or update global application settings."""
    uid, err = _require_permission("p_settings")
    if err:
        return err

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        key = data.get("key", "").strip()
        val = str(data.get("value", "")).strip()
        if not key:
            return jsonify({"success": False, "error": "Settings key is required."}), 400
        set_setting(key, val)
        return jsonify({"success": True, "key": key, "value": val})

    # GET: return common system settings
    keys = ["reseller_min_margin", "reseller_max_margin", "ref_reward", "ref_topup_min"]
    res = {k: get_setting(k) for k in keys}
    return jsonify({"success": True, "settings": res})
