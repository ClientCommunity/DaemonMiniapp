"""Reseller engine Blueprint.

Enforces custom profit margin validation (min 5% to max 100%),
multi-server bundle configuration into 1 URL, and tracks customer commissions.

Endpoints:
- GET /api/reseller: Retrieve reseller dashboard metrics & link
- POST /api/reseller/create: Create or reset custom reseller link
- POST /api/reseller/set_margin: Update margin percent & server selection within admin bounds
"""
from __future__ import annotations

import logging
from flask import Blueprint, jsonify, request

from services.auth_service import get_current_user_id
from services.reseller_service import get_or_create_reseller_link, update_reseller_margin

logger = logging.getLogger("api.reseller")
reseller_bp = Blueprint("reseller", __name__)


@reseller_bp.route("/api/reseller", methods=["GET"])
def reseller_dashboard():
    """Return reseller referral dashboard, earnings, customer count, and margin settings."""
    uid = get_current_user_id(request)
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    info = get_or_create_reseller_link(uid)
    return jsonify(info)


@reseller_bp.route("/api/reseller/create", methods=["POST"])
def create_link():
    """Create or renew custom reseller referral link."""
    uid = get_current_user_id(request)
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    margin = data.get("margin", 15)
    servers = data.get("servers")

    info = get_or_create_reseller_link(uid)
    if margin != info.get("margin") or servers is not None:
        update_result = update_reseller_margin(uid, margin, servers)
        if not update_result.get("success"):
            return jsonify(update_result), 400
        info["margin"] = margin
        info["margin_percent"] = margin
        if "servers" in update_result:
            info["servers"] = update_result["servers"]
        if "link" in update_result:
            info["link"] = update_result["link"]

    return jsonify(info)


@reseller_bp.route("/api/reseller/set_margin", methods=["POST"])
def set_margin():
    """Update reseller profit margin percent and selected servers."""
    uid = get_current_user_id(request)
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    margin_raw = data.get("margin", 15)
    servers_raw = data.get("servers")

    try:
        margin = int(margin_raw)
    except (ValueError, TypeError):
        return jsonify({"success": False, "error": "Margin must be an integer."}), 400

    servers = None
    if isinstance(servers_raw, list):
        try:
            servers = [int(s) for s in servers_raw if str(s).isdigit() and 1 <= int(s) <= 5]
        except (ValueError, TypeError):
            servers = None

    result = update_reseller_margin(uid, margin, servers)
    status_code = 200 if result.get("success") else 400
    return jsonify(result), status_code
