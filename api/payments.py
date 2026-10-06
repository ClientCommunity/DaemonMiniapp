"""Payments and deposit Blueprint (FamPay UPI & Manual Gateway).

Endpoints:
- POST /api/deposit/fampay: Generate FamPay dynamic QR checkout
- GET /api/deposit/fampay/check: Check payment verification status
- GET /api/deposit/manual/methods: List available manual deposit gateways
- POST /api/deposit/manual/submit: Submit transaction reference for manual review
"""
from __future__ import annotations

import logging
from flask import Blueprint, jsonify, request

from services.auth_service import get_current_user_id
from services.fampay_service import (
    create_fampay_checkout,
    check_fampay_order,
    get_manual_methods,
    submit_manual_deposit,
)

logger = logging.getLogger("api.payments")
payments_bp = Blueprint("payments", __name__)


@payments_bp.route("/api/deposit/fampay", methods=["POST"])
def deposit_fampay():
    """Create a new FamPay deposit checkout with dynamic QR code."""
    uid = get_current_user_id(request)
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    amount = int(data.get("amount", 100))

    result = create_fampay_checkout(uid, amount)
    status_code = 200 if result.get("success") else (503 if result.get("code") == "GATEWAY_OFFLINE" else 400)
    return jsonify(result), status_code


@payments_bp.route("/api/deposit/fampay/check", methods=["GET"])
def check_fampay_status():
    """Check payment status of a FamPay reference order."""
    ref = request.args.get("ref", "").strip()
    result = check_fampay_order(ref)
    return jsonify(result)


@payments_bp.route("/api/deposit/manual/methods", methods=["GET"])
def list_manual_methods():
    """Return available manual deposit payment methods."""
    data = get_manual_methods()
    return jsonify({
        "success": True,
        "methods": data.get("methods", []),
        "merchant_upi": data.get("merchant_upi", "")
    })


@payments_bp.route("/api/deposit/manual/submit", methods=["POST"])
def submit_manual_payment():
    """Submit manual deposit transaction reference / UTR for admin approval."""
    uid = get_current_user_id(request)
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    utr = data.get("utr", "").strip()
    method_id = data.get("method_id", 1)
    amount = int(data.get("amount", 0))

    result = submit_manual_deposit(uid, method_id, utr, amount)
    status_code = 200 if result.get("success") else 400
    return jsonify(result), status_code
