"""Orders and live OTP polling Blueprint.

Endpoints:
- POST /api/buy: Atomically purchase accounts/numbers/services
- GET /api/otp/status: Poll live incoming OTP for active order
- POST /api/otp/cancel: Cancel pending order and process atomic wallet refund
"""
from __future__ import annotations

import logging
from flask import Blueprint, jsonify, request

from services.auth_service import get_current_user_id
from services.order_service import execute_buy, poll_otp_status, cancel_order

logger = logging.getLogger("api.orders")
orders_bp = Blueprint("orders", __name__)


@orders_bp.route("/api/buy", methods=["POST"])
def buy_item():
    """Execute purchase atomically with dual-balance deduction and commission routing."""
    uid = get_current_user_id(request)
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    from services.force_join_service import check_user_force_join
    joined, missing = check_user_force_join(uid)
    if not joined:
        return jsonify({
            "success": False,
            "error": "You must join our required channels before placing an order.",
            "force_join_required": True,
            "channels": missing,
        }), 403

    data = request.get_json(silent=True) or {}
    server_num = int(data.get("server", 1))
    item = data.get("item", {})
    qty = max(1, int(data.get("qty", 1)))
    tier = str(data.get("tier", "good"))
    fmt = str(data.get("format", "account"))

    result = execute_buy(
        user_id=uid,
        server=server_num,
        item_data=item,
        qty=qty,
        tier=tier,
        fmt=fmt,
    )

    status_code = 200 if result.get("success") else 400
    return jsonify(result), status_code


@orders_bp.route("/api/otp/status", methods=["GET"])
def check_otp():
    """Poll live incoming OTP status for a phone or order identifier."""
    phone = request.args.get("phone") or request.args.get("order_id") or ""
    result = poll_otp_status(phone)
    return jsonify(result)


@orders_bp.route("/api/otp/cancel", methods=["POST"])
def cancel_active_order():
    """Cancel a waiting order and atomically refund the purchase amount."""
    uid = get_current_user_id(request)
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    phone = data.get("phone") or data.get("order_id") or request.args.get("phone") or ""

    result = cancel_order(uid, phone)
    status_code = 200 if result.get("success") else 400
    return jsonify(result), status_code


@orders_bp.route("/api/user/active-numbers", methods=["GET"])
def get_user_active_numbers():
    """Return all active numbers awaiting OTP or active for user."""
    uid = get_current_user_id(request)
    if not uid:
        return jsonify({"success": False, "items": []})

    from database import connect
    items = []
    with connect() as conn:
        # 1. Server 1 & Server 2 active orders (unarchived)
        rows = conn.execute("""
            SELECT id, country, price, phone, otp, server, date, twofa, provider_item_id, is_active
            FROM orders
            WHERE user_id = ? 
              AND (is_active = 1 OR is_active IS NULL)
              AND (refunded = 0 OR refunded IS NULL)
              AND (server IN ('Server 1', 'Server 2') OR server IS NULL)
            ORDER BY id DESC LIMIT 10
        """, (uid,)).fetchall()

        for r in rows:
            phone = r["phone"]
            if not phone:
                continue
            otp_val = r["otp"]
            has_otp = bool(otp_val and otp_val not in ("WAITING", "ZIP DELIVERED", "IN_PROGRESS", "None"))
            status = "received" if has_otp else "waiting"
            server_name = r["server"] or "Server 1"
            s_num = 1 if "1" in server_name else 2
            twofa_val = r["twofa"] if ("twofa" in r.keys() and r["twofa"] and r["twofa"] != "None") else ""
            provider_oid = r["provider_item_id"] if "provider_item_id" in r.keys() else ""
            
            items.append({
                "order_id": provider_oid or f"ORD_{r['id']}",
                "db_id": r["id"],
                "server": s_num,
                "service_name": "Telegram",
                "country": r["country"] or "Telegram Account",
                "phone": phone,
                "twofa": twofa_val,
                "otp_code": otp_val if has_otp else None,
                "status": status,
                "can_fetch_otp": True,
                "is_auto_polling": False,
                "created_at": str(r["date"])[:19] if r["date"] else "",
            })

        # 2. Server 3 active orders (waiting or recently completed)
        s3_rows = conn.execute("""
            SELECT id, provider_order_id, service_code, server_code, phone, charged_price, status, sms_code, created_at
            FROM server3_orders
            WHERE user_id = ? AND status IN ('waiting', 'completed') AND (refunded = 0 OR refunded IS NULL)
            ORDER BY id DESC LIMIT 5
        """, (uid,)).fetchall()
        for r in s3_rows:
            phone = r["phone"]
            if not phone:
                continue
            has_otp = bool(r["sms_code"])
            items.append({
                "order_id": r["provider_order_id"],
                "db_id": r["id"],
                "server": 3,
                "service_name": r["service_code"].upper(),
                "country": f"Server {r['server_code']}",
                "phone": phone,
                "twofa": "",
                "otp_code": r["sms_code"] if has_otp else None,
                "status": "received" if has_otp else "waiting",
                "can_fetch_otp": True,
                "is_auto_polling": True,
                "created_at": str(r["created_at"])[:19] if r["created_at"] else "",
            })

        # 3. Server 4 active orders (waiting or recently completed)
        s4_rows = conn.execute("""
            SELECT id, provider_order_id, service_code, country_code, phone, charged_price, status, sms_code, created_at
            FROM server4_orders
            WHERE user_id = ? AND status IN ('waiting', 'completed') AND (refunded = 0 OR refunded IS NULL)
            ORDER BY id DESC LIMIT 5
        """, (uid,)).fetchall()
        for r in s4_rows:
            phone = r["phone"]
            if not phone:
                continue
            has_otp = bool(r["sms_code"])
            items.append({
                "order_id": r["provider_order_id"],
                "db_id": r["id"],
                "server": 4,
                "service_name": r["service_code"].upper(),
                "country": f"Country {r['country_code']}",
                "phone": phone,
                "twofa": "",
                "otp_code": r["sms_code"] if has_otp else None,
                "status": "received" if has_otp else "waiting",
                "can_fetch_otp": True,
                "is_auto_polling": True,
                "created_at": str(r["created_at"])[:19] if r["created_at"] else "",
            })

    return jsonify({"success": True, "items": items})


@orders_bp.route("/api/otp/archive", methods=["POST"])
def archive_active_order():
    """Archive / dismiss an active number from the active numbers list."""
    uid = get_current_user_id(request)
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    order_id = str(data.get("order_id") or data.get("phone") or "").strip()
    if not order_id:
        return jsonify({"success": False, "error": "Order identifier required"}), 400

    from database import connect
    with connect() as conn:
        conn.execute("""
            UPDATE orders 
            SET is_active = 0 
            WHERE user_id = ? AND (provider_item_id = ? OR phone = ? OR id = ?)
        """, (uid, order_id, order_id, int(order_id) if order_id.isdigit() else -1))
        conn.execute("""
            UPDATE server3_orders
            SET status = 'completed'
            WHERE user_id = ? AND (provider_order_id = ? OR phone = ?)
        """, (uid, order_id, order_id))
        conn.execute("""
            UPDATE server4_orders
            SET status = 'completed'
            WHERE user_id = ? AND (provider_order_id = ? OR phone = ?)
        """, (uid, order_id, order_id))
        conn.commit()

    return jsonify({"success": True, "message": "Order archived successfully"})
