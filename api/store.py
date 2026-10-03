"""Store and product catalogue Blueprint.

Guarantees 100% vendor privacy with zero upstream leaks.

Endpoints:
- GET /api/store/servers: Overview of Servers 1-5
- GET /api/store/server1 (& /api/server1/stock): Server 1 Global 2FA Accounts
- GET /api/store/server2 (& /api/server2/stock): Server 2 Sessions (Good/Cheap tiers)
- GET /api/store/server3 (& /api/server3/stock): Server 3 Instant Virtual OTP
- GET /api/store/server4 (& /api/server4/stock): Server 4 Fresh Carrier Numbers
- GET /api/store/server5 (& /api/server5/stock): Server 5 SMM Hub Services
"""
from __future__ import annotations

import logging
from flask import Blueprint, jsonify, request

from services.store_service import (
    get_all_servers_overview,
    get_server1_stock,
    get_server2_stock,
    get_server3_stock,
    get_server4_stock,
    get_server5_stock,
)

logger = logging.getLogger("api.store")
store_bp = Blueprint("store", __name__)


@store_bp.route("/api/store/servers", methods=["GET"])
def list_servers():
    """List all available store servers with sanitized friendly names."""
    servers = get_all_servers_overview()
    return jsonify({"success": True, "servers": servers})


@store_bp.route("/api/store/server1", methods=["GET"])
@store_bp.route("/api/server1/stock", methods=["GET"])
def server1_stock():
    """Return Server 1 stock catalogue (Global 2FA Accounts)."""
    items = get_server1_stock()
    return jsonify({"success": True, "items": items})


@store_bp.route("/api/store/server2", methods=["GET"])
@store_bp.route("/api/server2/stock", methods=["GET"])
def server2_stock():
    """Return Server 2 catalogue segregated by quality tier (good vs cheap)."""
    tier = request.args.get("tier", "good").lower()
    data = get_server2_stock(tier=tier)
    return jsonify({
        "success": True,
        "tier": data["tier"],
        "good_count": data["good_count"],
        "cheap_count": data["cheap_count"],
        "items": data["items"],
    })


@store_bp.route("/api/store/server3", methods=["GET"])
@store_bp.route("/api/server3/stock", methods=["GET"])
def server3_stock():
    """Return Server 3 virtual numbers stock (Instant Virtual OTP)."""
    items = get_server3_stock()
    return jsonify({"success": True, "items": items})


@store_bp.route("/api/store/server4", methods=["GET"])
@store_bp.route("/api/server4/stock", methods=["GET"])
def server4_stock():
    """Return Server 4 virtual numbers stock (Fresh Carrier Numbers)."""
    items = get_server4_stock()
    return jsonify({"success": True, "items": items})


@store_bp.route("/api/store/server5", methods=["GET"])
@store_bp.route("/api/server5/stock", methods=["GET"])
def server5_stock():
    """Return Server 5 SMM catalogue (SMM Hub)."""
    items = get_server5_stock()
    return jsonify({"success": True, "items": items})
