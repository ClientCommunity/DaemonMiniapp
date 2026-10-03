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
