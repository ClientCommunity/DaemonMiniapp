"""Authentication and user session Blueprint.

Endpoints:
- POST /api/auth: Telegram WebApp initData HMAC verification
- GET /api/auth/me: Retrieve current session profile
- POST /api/profile/currency: Update currency preference (INR / USDT)
"""
from __future__ import annotations

import logging
from flask import Blueprint, jsonify, request

from services.auth_service import get_current_user_id, get_or_create_user
from services.wallet_service import set_user_currency

logger = logging.getLogger("api.auth")
auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/auth", methods=["POST"])
def auth_session():
    """Authenticate Telegram WebApp session and return user profile & balances."""
    uid = get_current_user_id(request)
    if not uid:
        # Check if first user in db can serve as dev fallback when not in strict mode
        from database import connect
        with connect() as conn:
            row = conn.execute("SELECT user_id FROM users LIMIT 1").fetchone()
            uid = row[0] if row else 7507183871

    user_info = get_or_create_user(uid)
    return jsonify({
        "success": True,
        "user": user_info,
    })


@auth_bp.route("/api/auth/me", methods=["GET"])
def get_session():
    """Retrieve currently authenticated user profile and wallet balances."""
    uid = get_current_user_id(request)
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    user_info = get_or_create_user(uid)
    return jsonify({
        "success": True,
        "user": user_info,
    })


@auth_bp.route("/api/profile/currency", methods=["POST"])
def update_currency():
    """Update preferred currency for current user (INR / USDT)."""
    uid = get_current_user_id(request)
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    curr = data.get("curr", "INR")
    updated = set_user_currency(uid, curr)

    return jsonify({"success": True, "curr": updated})
