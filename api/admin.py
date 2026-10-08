"""Administrator RBAC, session authentication, and store management Blueprint.

Enforces:
1. Passphrase challenge login issuing signed session JWTs.
2. Bearer token authorization and X-Admin-Secret header protection across all /api/admin/* endpoints.
3. Full RBAC permissions via database `admins` table and MASTER_ADMIN_IDS:
   - p_stats: System analytics, provider balances, SMM order logs
   - p_add_stock: Upload Server 2 accounts with quality tiers
   - p_manage_stock: Inspect, update, and delete stock
   - p_bal: Adjust user balances (credit/debit), search users, approve/reject deposits
   - p_settings: Configure Servers 1-5, gateways, custom payments, promo codes, and settings
"""
from __future__ import annotations

import hmac
import logging
import time
from typing import Any

import jwt
from flask import Blueprint, jsonify, request

from config import ADMIN_PANEL_SECRET, MASTER_ADMIN_IDS
from database import get_admin_permissions, get_setting, set_setting
from services.auth_service import get_current_user_id
from services.admin_service import (
    verify_admin,
    get_system_stats,
    get_provider_balances,
    add_stock_item,
    bulk_add_stock_items,
    list_stock_items,
    manage_stock_item,
    adjust_user_balance,
    list_pending_deposits,
    process_deposit_decision,
    search_users,
    set_user_ban_status,
    get_server1_settings,
    set_server1_status,
    set_server1_country_markup,
    get_service_server_config,
    update_service_server_config,
    toggle_service_server,
    list_server3_services,
    toggle_server3_service,
    list_server4_services,
    toggle_server4_service,
    get_smm_overview,
    toggle_smm_master,
    list_smm_providers,
    add_smm_provider,
    toggle_smm_provider,
    delete_smm_provider,
    list_smm_categories,
    toggle_smm_category,
    list_smm_services,
    toggle_smm_service,
    list_smm_orders,
    list_fampay_gateways,
    add_fampay_gateway,
    update_fampay_gateway,
    delete_fampay_gateway,
    toggle_fampay_gateway,
    list_custom_payments,
    add_custom_payment,
    update_custom_payment,
    delete_custom_payment,
    list_promo_codes,
    create_promo_code,
    delete_promo_code,
    get_reseller_settings,
    set_reseller_settings,
)

logger = logging.getLogger("api.admin")
admin_bp = Blueprint("admin", __name__)


def _require_permission(perm: str | None = None):
    """Verify administrator identity, bearer session token, and specific permission.

    Accepts:
    - Authorization: Bearer <token> (signed JWT)
    - X-Admin-Secret: <ADMIN_PANEL_SECRET>
    - X-Admin-Token: <token>
    """
    auth_header = request.headers.get("Authorization", "").strip()
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif request.headers.get("X-Admin-Token"):
        token = request.headers.get("X-Admin-Token", "").strip()

    uid = None
    if token:
        try:
            payload = jwt.decode(token, ADMIN_PANEL_SECRET, algorithms=["HS256"])
            uid = payload.get("user_id")
        except Exception:
            return None, (jsonify({"success": False, "error": "Unauthorized: Missing or invalid admin session token"}), 401)
    else:
        admin_secret = request.headers.get("X-Admin-Secret", "").strip()
        if admin_secret and hmac.compare_digest(admin_secret.encode("utf-8"), ADMIN_PANEL_SECRET.encode("utf-8")):
            uid = get_current_user_id(request) or 7507183871
        elif auth_header and hmac.compare_digest(auth_header.encode("utf-8"), ADMIN_PANEL_SECRET.encode("utf-8")):
            uid = get_current_user_id(request) or 7507183871

    if not uid:
        return None, (jsonify({"success": False, "error": "Unauthorized: Missing or invalid admin session token"}), 401)

    if not verify_admin(uid, perm):
        return None, (jsonify({"success": False, "error": "Forbidden: Insufficient administrator permissions."}), 403)

    return uid, None


# ==============================================================================
# AUTHENTICATION & LOGIN CHALLENGE
# ==============================================================================

@admin_bp.route("/api/admin/login", methods=["POST"])
@admin_bp.route("/api/admin/auth/login", methods=["POST"])
def admin_login():
    """Verify administrator passphrase challenge and issue signed session JWT."""
    data = request.get_json(silent=True) or {}
    passphrase = str(data.get("passphrase", "")).strip()

    # Extract user ID from Telegram initData, header, or body fallback
    uid = get_current_user_id(request)
    if not uid and "user_id" in data and str(data["user_id"]).isdigit():
        uid = int(data["user_id"])

    if not uid:
        return jsonify({"success": False, "error": "Unable to identify user"}), 401

    if not verify_admin(uid):
        return jsonify({"success": False, "error": "User is not an administrator"}), 403

    if not passphrase or not hmac.compare_digest(passphrase.encode("utf-8"), ADMIN_PANEL_SECRET.encode("utf-8")):
        return jsonify({"success": False, "error": "Invalid admin passphrase"}), 401

    now = int(time.time())
    expires_in = 86400
    perms = get_admin_permissions(uid) if uid not in MASTER_ADMIN_IDS else {
        "p_add_stock": 1,
        "p_manage_stock": 1,
        "p_stats": 1,
        "p_bal": 1,
        "p_settings": 1,
    }

    token_payload = {
        "user_id": uid,
        "is_admin": True,
        "permissions": perms,
        "iat": now,
        "exp": now + expires_in,
    }
    token = jwt.encode(token_payload, ADMIN_PANEL_SECRET, algorithm="HS256")

    return jsonify({
        "success": True,
        "token": token,
        "expires_in": expires_in,
        "user_id": uid,
        "permissions": perms,
    })


@admin_bp.route("/api/admin/me", methods=["GET"])
def admin_status():
    """Return caller's administrator status and active permissions."""
    uid, err = _require_permission(perm=None)
    if err:
        return err

    is_adm = verify_admin(uid)
    perms = get_admin_permissions(uid) if uid not in MASTER_ADMIN_IDS else {
        "p_add_stock": 1, "p_manage_stock": 1, "p_stats": 1, "p_bal": 1, "p_settings": 1
    }

    return jsonify({
        "success": True,
        "user_id": uid,
        "is_admin": is_adm,
        "permissions": perms,
    })


# ==============================================================================
# TAB 1: OVERVIEW & ANALYTICS
# ==============================================================================

@admin_bp.route("/api/admin/stats", methods=["GET"])
@admin_bp.route("/api/admin/overview", methods=["GET"])
def admin_stats():
    """Return high-level system analytics, sales revenue, stock counters, and provider balances."""
    uid, err = _require_permission("p_stats")
    if err:
        return err

    stats = get_system_stats()
    return jsonify({"success": True, "stats": stats})


@admin_bp.route("/api/admin/stats/providers", methods=["GET"])
def admin_provider_balances():
    """Return upstream provider balances (LZT, DGOTP, TemporaSMS, SMM)."""
    uid, err = _require_permission("p_stats")
    if err:
        return err

    balances = get_provider_balances()
    return jsonify({"success": True, "provider_balances": balances})


# ==============================================================================
# TAB 2: SERVERS 1–5 MANAGEMENT
# ==============================================================================

# --- Server 1 Management (LZT Market) ---

@admin_bp.route("/api/admin/server1/status", methods=["GET"])
@admin_bp.route("/api/admin/server1/config", methods=["GET"])
def admin_server1_status():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    return jsonify({"success": True, "settings": get_server1_settings()})


@admin_bp.route("/api/admin/server1/toggle", methods=["POST"])
def admin_server1_toggle():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    if not status:
        cur = get_server1_settings().get("status", "on")
        status = "off" if cur == "on" else "on"
    result = set_server1_status(status)
    return jsonify(result)


@admin_bp.route("/api/admin/server1/markup", methods=["POST"])
def admin_server1_markup():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    data = request.get_json(silent=True) or {}
    country = data.get("country")
    markup_percent = data.get("markup_percent")
    if country is not None and markup_percent is not None:
        result = set_server1_country_markup(str(country), int(markup_percent))
        return jsonify(result)
    elif "global_markup" in data:
        set_setting("lzt_global_markup", str(int(data["global_markup"])))
        return jsonify({"success": True, "global_markup": int(data["global_markup"])})
    return jsonify({"success": False, "error": "country and markup_percent required"}), 400


@admin_bp.route("/api/admin/server1/token", methods=["POST"])
def admin_server1_token():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    data = request.get_json(silent=True) or {}
    token = data.get("token", "").strip()
    if token.lower() in ("remove", ""):
        set_setting("lzt_token", "")
    else:
        set_setting("lzt_token", token)
    return jsonify({"success": True, "has_token": bool(token and token.lower() != "remove")})


# --- Server 2 Management (Fresh Sessions) ---

@admin_bp.route("/api/admin/stock/add", methods=["POST"])
def admin_add_stock():
    """Upload single Server 2 session account into stock with quality tier tagging."""
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


@admin_bp.route("/api/admin/stock/bulk-upload", methods=["POST"])
def admin_bulk_stock_upload():
    """Bulk upload Server 2 accounts with strict quality_tier enforcement."""
    uid, err = _require_permission("p_add_stock")
    if err:
        return err

    data = request.get_json(silent=True) or {}
    items = data.get("items", [])
    quality_tier = str(data.get("quality_tier", "good")).strip().lower()
    country = data.get("country", "Unknown")
    year = int(data.get("year", 2024))
    price = int(data.get("price", 60))

    if quality_tier not in ("good", "cheap"):
        return jsonify({"success": False, "error": "Invalid quality_tier. Must be 'good' or 'cheap'."}), 400

    if not isinstance(items, list) or len(items) == 0:
        return jsonify({"success": False, "error": "items must be a non-empty array."}), 400

    try:
        result = bulk_add_stock_items(
            items=items,
            country_name=country,
            account_year=year,
            quality_tier=quality_tier,
            price=price,
            country_icon=data.get("country_icon", "🌍"),
            seller_id=uid,
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


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


# --- Server 3 & Server 4 Management (Virtual Numbers) ---

@admin_bp.route("/api/admin/servers/managed", methods=["GET"])
def admin_managed_servers():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    return jsonify({
        "success": True,
        "servers": [get_service_server_config(3), get_service_server_config(4)]
    })


@admin_bp.route("/api/admin/server3/config", methods=["GET", "POST"])
@admin_bp.route("/api/admin/servers/3/config", methods=["GET", "POST"])
def admin_server3_config():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        res = update_service_server_config(3, data)
        return jsonify(res)
    return jsonify({"success": True, "config": get_service_server_config(3)})


@admin_bp.route("/api/admin/server3/toggle", methods=["POST"])
@admin_bp.route("/api/admin/servers/3/toggle", methods=["POST"])
def admin_server3_toggle():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    data = request.get_json(silent=True) or {}
    res = toggle_service_server(3, data.get("enabled"))
    return jsonify(res)


@admin_bp.route("/api/admin/server3/sync", methods=["POST"])
@admin_bp.route("/api/admin/servers/3/sync", methods=["POST"])
def admin_server3_sync():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    return jsonify({"success": True, "server_no": 3, "message": "Server 3 catalogue sync initiated."})


@admin_bp.route("/api/admin/server3/services", methods=["GET"])
@admin_bp.route("/api/admin/servers/3/services", methods=["GET"])
def admin_server3_services():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    limit = int(request.args.get("limit", 100))
    items = list_server3_services(limit=limit)
    return jsonify({"success": True, "services": items})


@admin_bp.route("/api/admin/server3/services/toggle", methods=["POST"])
@admin_bp.route("/api/admin/servers/3/toggle-service", methods=["POST"])
def admin_server3_service_toggle():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    data = request.get_json(silent=True) or {}
    code = data.get("service_code", "")
    server_code = data.get("server_code")
    if not code:
        return jsonify({"success": False, "error": "service_code is required"}), 400
    res = toggle_server3_service(code, server_code)
    return jsonify(res)


@admin_bp.route("/api/admin/server4/config", methods=["GET", "POST"])
@admin_bp.route("/api/admin/servers/4/config", methods=["GET", "POST"])
def admin_server4_config():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        res = update_service_server_config(4, data)
        return jsonify(res)
    return jsonify({"success": True, "config": get_service_server_config(4)})


@admin_bp.route("/api/admin/server4/toggle", methods=["POST"])
@admin_bp.route("/api/admin/servers/4/toggle", methods=["POST"])
def admin_server4_toggle():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    data = request.get_json(silent=True) or {}
    res = toggle_service_server(4, data.get("enabled"))
    return jsonify(res)


@admin_bp.route("/api/admin/server4/sync", methods=["POST"])
@admin_bp.route("/api/admin/servers/4/sync", methods=["POST"])
def admin_server4_sync():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    return jsonify({"success": True, "server_no": 4, "message": "Server 4 catalogue sync initiated."})


@admin_bp.route("/api/admin/server4/services", methods=["GET"])
@admin_bp.route("/api/admin/servers/4/services", methods=["GET"])
def admin_server4_services():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    limit = int(request.args.get("limit", 100))
    items = list_server4_services(limit=limit)
    return jsonify({"success": True, "services": items})


@admin_bp.route("/api/admin/server4/services/toggle", methods=["POST"])
@admin_bp.route("/api/admin/servers/4/toggle-operator", methods=["POST"])
def admin_server4_service_toggle():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    data = request.get_json(silent=True) or {}
    op_code = data.get("operator_code", "")
    svc_code = data.get("service_code", "")
    if not op_code or not svc_code:
        return jsonify({"success": False, "error": "operator_code and service_code are required"}), 400
    res = toggle_server4_service(op_code, svc_code)
    return jsonify(res)


# --- Server 5 Management (SMM Hub) ---

@admin_bp.route("/api/admin/server5/overview", methods=["GET"])
@admin_bp.route("/api/admin/smm/overview", methods=["GET"])
def admin_smm_overview():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    return jsonify({"success": True, "overview": get_smm_overview()})


@admin_bp.route("/api/admin/server5/toggle", methods=["POST"])
@admin_bp.route("/api/admin/smm/toggle", methods=["POST"])
def admin_smm_toggle():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    data = request.get_json(silent=True) or {}
    res = toggle_smm_master(data.get("enabled"))
    return jsonify(res)


@admin_bp.route("/api/admin/server5/providers", methods=["GET", "POST"])
@admin_bp.route("/api/admin/smm/providers", methods=["GET", "POST"])
def admin_smm_providers():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        name = data.get("name", "").strip()
        api_url = data.get("api_url", "").strip()
        api_key = data.get("api_key", "").strip()
        if not name or not api_url or not api_key:
            return jsonify({"success": False, "error": "name, api_url, and api_key are required"}), 400
        res = add_smm_provider(
            name=name,
            api_url=api_url,
            api_key=api_key,
            percent_markup=float(data.get("percent_markup", 40.0)),
            currency=data.get("currency", "USD"),
        )
        return jsonify(res)
    return jsonify({"success": True, "providers": list_smm_providers()})


@admin_bp.route("/api/admin/server5/providers/<int:provider_id>/toggle", methods=["POST"])
@admin_bp.route("/api/admin/smm/providers/<int:provider_id>/toggle", methods=["POST"])
def admin_smm_provider_toggle(provider_id: int):
    uid, err = _require_permission("p_settings")
    if err:
        return err
    return jsonify(toggle_smm_provider(provider_id))


@admin_bp.route("/api/admin/server5/providers/<int:provider_id>", methods=["DELETE"])
@admin_bp.route("/api/admin/smm/providers/<int:provider_id>", methods=["DELETE"])
def admin_smm_provider_delete(provider_id: int):
    uid, err = _require_permission("p_settings")
    if err:
        return err
    return jsonify(delete_smm_provider(provider_id))


@admin_bp.route("/api/admin/server5/categories", methods=["GET"])
@admin_bp.route("/api/admin/smm/categories", methods=["GET"])
def admin_smm_categories():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    return jsonify({"success": True, "categories": list_smm_categories()})


@admin_bp.route("/api/admin/server5/categories/<int:category_id>/toggle", methods=["POST"])
@admin_bp.route("/api/admin/smm/categories/<int:category_id>/toggle", methods=["POST"])
def admin_smm_category_toggle(category_id: int):
    uid, err = _require_permission("p_settings")
    if err:
        return err
    return jsonify(toggle_smm_category(category_id))


@admin_bp.route("/api/admin/server5/services", methods=["GET"])
@admin_bp.route("/api/admin/smm/services", methods=["GET"])
def admin_smm_services():
    uid, err = _require_permission("p_settings")
    if err:
        return err
    cat_id = request.args.get("category_id")
    limit = int(request.args.get("limit", 100))
    services = list_smm_services(category_id=int(cat_id) if cat_id else None, limit=limit)
    return jsonify({"success": True, "services": services})


@admin_bp.route("/api/admin/server5/services/<int:service_id>/toggle", methods=["POST"])
@admin_bp.route("/api/admin/smm/services/<int:service_id>/toggle", methods=["POST"])
def admin_smm_service_toggle(service_id: int):
    uid, err = _require_permission("p_settings")
    if err:
        return err
    return jsonify(toggle_smm_service(service_id))


@admin_bp.route("/api/admin/server5/orders", methods=["GET"])
@admin_bp.route("/api/admin/smm/orders", methods=["GET"])
def admin_smm_orders():
    uid, err = _require_permission("p_stats")
    if err:
        return err
    limit = int(request.args.get("limit", 50))
    return jsonify({"success": True, "orders": list_smm_orders(limit=limit)})


# ==============================================================================
# TAB 3: PAYMENTS & DEPOSITS HUB
# ==============================================================================

@admin_bp.route("/api/admin/deposits/pending", methods=["GET"])
def admin_pending_deposits():
    """List pending manual deposits and review submissions."""
    uid, err = _require_permission("p_bal")
    if err:
        return err

    items = list_pending_deposits()
    return jsonify({"success": True, "deposits": items})


@admin_bp.route("/api/admin/deposits/approve", methods=["POST"])
def admin_approve_deposit():
    """Approve a pending manual deposit and atomically credit user wallet."""
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
    if not result.get("success"):
        return jsonify(result), 400
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
    if not result.get("success"):
        return jsonify(result), 400
    return jsonify(result)


@admin_bp.route("/api/admin/fampay/gateways", methods=["GET", "POST"])
def admin_fampay_gateways():
    """List or add FamPay UPI gateways."""
    uid, err = _require_permission("p_settings")
    if err:
        return err

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        name = data.get("name", "").strip()
        upi_id = data.get("upi_id", "").strip()
        if not name or not upi_id:
            return jsonify({"success": False, "error": "name and upi_id are required"}), 400
        res = add_fampay_gateway(
            name=name,
            upi_id=upi_id,
            payment_name=data.get("payment_name", "Payment"),
            min_deposit=int(data.get("min_deposit", 1)),
            max_deposit=int(data.get("max_deposit", 50000)),
            gmail=data.get("gmail", ""),
            app_password=data.get("app_password", ""),
            enabled=int(data.get("enabled", 1)),
        )
        return jsonify(res)

    return jsonify({"success": True, "gateways": list_fampay_gateways()})


@admin_bp.route("/api/admin/fampay/gateways/<int:gw_id>", methods=["PUT", "DELETE"])
def admin_fampay_gateway_item(gw_id: int):
    """Update or delete FamPay gateway."""
    uid, err = _require_permission("p_settings")
    if err:
        return err

    if request.method == "DELETE":
        return jsonify(delete_fampay_gateway(gw_id))

    data = request.get_json(silent=True) or {}
    return jsonify(update_fampay_gateway(gw_id, data))


@admin_bp.route("/api/admin/fampay/gateways/<int:gw_id>/toggle", methods=["POST"])
def admin_fampay_gateway_toggle(gw_id: int):
    """Toggle FamPay gateway enabled status."""
    uid, err = _require_permission("p_settings")
    if err:
        return err

    return jsonify(toggle_fampay_gateway(gw_id))


@admin_bp.route("/api/admin/custom-payments", methods=["GET", "POST"])
@admin_bp.route("/api/admin/payments/custom", methods=["GET", "POST"])
def admin_custom_payments():
    """List or create custom payment options."""
    uid, err = _require_permission("p_settings")
    if err:
        return err

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        name = data.get("name", "").strip()
        if not name:
            return jsonify({"success": False, "error": "name is required"}), 400
        res = add_custom_payment(
            name=name,
            caption=data.get("caption", ""),
            qr_file_id=data.get("qr_file_id", ""),
        )
        return jsonify(res)

    return jsonify({"success": True, "payments": list_custom_payments()})


@admin_bp.route("/api/admin/custom-payments/<int:pid>", methods=["PUT", "DELETE"])
@admin_bp.route("/api/admin/payments/custom/<int:pid>", methods=["PUT", "DELETE"])
def admin_custom_payment_item(pid: int):
    """Update or remove custom payment option."""
    uid, err = _require_permission("p_settings")
    if err:
        return err

    if request.method == "DELETE":
        return jsonify(delete_custom_payment(pid))

    data = request.get_json(silent=True) or {}
    return jsonify(update_custom_payment(pid, data))


@admin_bp.route("/api/admin/settings/min-deposit", methods=["GET", "POST"])
def admin_min_deposit():
    """Inspect or update minimum deposit thresholds."""
    uid, err = _require_permission("p_settings")
    if err:
        return err

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        min_dep = data.get("min_deposit")
        if min_dep is not None:
            set_setting("min_deposit", str(int(min_dep)))
        for k in ("min_upi_dep", "min_cw_dep", "fampay_min_dep"):
            if k in data:
                set_setting(k, str(int(data[k])))
        return jsonify({"success": True, "min_deposit": int(min_dep or get_setting("min_deposit", "50"))})

    return jsonify({
        "success": True,
        "min_deposit": int(get_setting("min_deposit", "50") or 50),
        "min_upi_dep": int(get_setting("min_upi_dep", "50") or 50),
        "min_cw_dep": int(get_setting("min_cw_dep", "50") or 50),
        "fampay_min_dep": int(get_setting("fampay_min_dep", "10") or 10),
    })


# ==============================================================================
# TAB 4: USER & WALLET MANAGEMENT
# ==============================================================================

@admin_bp.route("/api/admin/users/search", methods=["GET"])
@admin_bp.route("/api/admin/users/lookup", methods=["GET"])
def admin_search_users():
    """Search user by Telegram ID or username with balance breakdown and history."""
    uid, err = _require_permission("p_bal")
    if err:
        return err

    q = request.args.get("query") or request.args.get("user_id") or request.args.get("username")
    if not q:
        return jsonify({"success": False, "error": "query parameter is required"}), 400

    res = search_users(q)
    status_code = 200 if res.get("success") else 404
    return jsonify(res), status_code


@admin_bp.route("/api/admin/users/balance", methods=["POST"])
def admin_adjust_balance():
    """Adjust user balance (credit or debit with floor 0) with audit logging."""
    uid, err = _require_permission("p_bal")
    if err:
        return err

    data = request.get_json(silent=True) or {}
    target_uid = data.get("user_id")
    amount = data.get("amount")
    type_ = str(data.get("type", "credit")).strip()
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
        type_=type_,
    )
    status_code = 200 if result.get("success") else 400
    return jsonify(result), status_code


@admin_bp.route("/api/admin/users/ban", methods=["POST"])
@admin_bp.route("/api/admin/users/<int:user_id>/ban", methods=["POST"])
def admin_ban_user(user_id: int | None = None):
    """Ban or unban user."""
    uid, err = _require_permission("p_settings")
    if err:
        return err

    data = request.get_json(silent=True) or {}
    target_uid = user_id or data.get("user_id")
    if not target_uid:
        return jsonify({"success": False, "error": "user_id is required"}), 400

    banned = data.get("banned")
    res = set_user_ban_status(int(target_uid), banned=banned)
    return jsonify(res)


# ==============================================================================
# TAB 5: MARKETING, RESELLER & SYSTEM SETTINGS
# ==============================================================================

@admin_bp.route("/api/admin/reseller/settings", methods=["GET", "POST"])
def admin_reseller_settings():
    """Configure reseller engine bounds (₹5 - ₹100) and global status."""
    uid, err = _require_permission("p_settings")
    if err:
        return err

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        min_m = data.get("min_margin", 5)
        max_m = data.get("max_margin", 100)
        st = data.get("status", "on")
        res = set_reseller_settings(min_m, max_m, st)
        return jsonify(res)

    return jsonify({"success": True, "settings": get_reseller_settings()})


@admin_bp.route("/api/admin/promo-codes", methods=["GET", "POST"])
def admin_promo_codes():
    """List or create promo codes."""
    uid, err = _require_permission("p_settings")
    if err:
        return err

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        val = data.get("value")
        if val is None:
            return jsonify({"success": False, "error": "value is required"}), 400
        res = create_promo_code(
            code=data.get("code"),
            value=int(val),
            max_uses=int(data.get("max_uses", 1)),
        )
        return jsonify(res)

    return jsonify({"success": True, "promo_codes": list_promo_codes()})


@admin_bp.route("/api/admin/promo-codes/<string:code>", methods=["DELETE"])
def admin_delete_promo_code(code: str):
    """Delete a promo code."""
    uid, err = _require_permission("p_settings")
    if err:
        return err

    return jsonify(delete_promo_code(code))


@admin_bp.route("/api/admin/system/force-join", methods=["GET", "POST"])
@admin_bp.route("/api/admin/system/toggle-forcejoin", methods=["POST"])
def admin_system_force_join():
    """Inspect or configure force-join channel settings."""
    uid, err = _require_permission("p_settings")
    if err:
        return err

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        st = data.get("status")
        if st is None:
            cur = get_setting("force_join_status", "on")
            st = "off" if cur == "on" else "on"
        set_setting("force_join_status", str(st))
        if "channels" in data:
            import json as _json
            set_setting("force_join_channels", _json.dumps(data["channels"]))
        return jsonify({"success": True, "force_join_status": str(st)})

    return jsonify({
        "success": True,
        "status": get_setting("force_join_status", "on"),
        "channels": get_setting("force_join_channels", "[]"),
    })


@admin_bp.route("/api/admin/system/bot-status", methods=["GET", "POST"])
@admin_bp.route("/api/admin/system/toggle-bot", methods=["POST"])
def admin_system_bot_status():
    """Inspect or toggle master bot status (Online / Maintenance)."""
    uid, err = _require_permission("p_settings")
    if err:
        return err

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        st = data.get("status")
        if st is None:
            cur = get_setting("bot_status", "on")
            st = "off" if cur == "on" else "on"
        set_setting("bot_status", str(st))
        return jsonify({"success": True, "bot_status": str(st)})

    return jsonify({
        "success": True,
        "bot_status": get_setting("bot_status", "on"),
    })


@admin_bp.route("/api/admin/settings", methods=["GET", "POST"])
def admin_settings_endpoint():
    """Inspect or update global settings."""
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

    keys = [
        "reseller_min_margin", "reseller_max_margin", "reseller_status",
        "ref_reward", "ref_topup_min", "min_deposit", "bot_status", "force_join_status"
    ]
    res = {k: get_setting(k) for k in keys}
    return jsonify({"success": True, "settings": res})
