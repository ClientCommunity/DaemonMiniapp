"""Authentication and user session Blueprint.

Endpoints:
- POST /api/auth: Telegram WebApp initData HMAC verification
- GET /api/auth/me: Retrieve current session profile
- POST /api/profile/currency: Update currency preference (INR / USDT)
"""
from __future__ import annotations

import logging
from flask import Blueprint, jsonify, request

import time
from services.auth_service import (
    get_current_user_id,
    get_or_create_user,
    verify_google_id_token,
    get_or_create_google_user,
)
from services.wallet_service import set_user_currency
from api.admin import encode_jwt
from config import ADMIN_PANEL_SECRET

logger = logging.getLogger("api.auth")
auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/auth", methods=["POST"])
def auth_session():
    """Authenticate Telegram WebApp session or Web Bearer session and return user profile & balances."""
    uid = get_current_user_id(request)
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    user_info = get_or_create_user(uid)
    return jsonify({
        "success": True,
        "user": user_info,
    })


@auth_bp.route("/api/auth/google", methods=["POST"])
def auth_google():
    """Authenticate web user using Google OAuth ID token.
    Issues signed JWT session token with user_id.
    """
    data = request.get_json(silent=True) or {}
    id_token = data.get("credential") or data.get("id_token")
    if not id_token:
        return jsonify({"success": False, "error": "Missing Google credential"}), 400

    google_info = verify_google_id_token(id_token)
    if not google_info:
        return jsonify({"success": False, "error": "Invalid or expired Google token"}), 401

    user_info = get_or_create_google_user(google_info)
    user_id = user_info["id"]

    # Issue JWT token valid for 30 days
    payload = {
        "user_id": user_id,
        "auth_provider": "google",
        "email": user_info.get("email"),
        "name": user_info.get("name"),
        "exp": int(time.time()) + (30 * 86400),
    }
    token = encode_jwt(payload, ADMIN_PANEL_SECRET)

    return jsonify({
        "success": True,
        "token": token,
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
