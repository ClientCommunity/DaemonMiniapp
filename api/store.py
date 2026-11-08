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
    get_server5_stock_paginated,
    get_pinned_services,
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
    from services.auth_service import get_current_user_id
    uid = get_current_user_id(request)
    items = get_server1_stock(uid=uid)
    return jsonify({"success": True, "items": items})


@store_bp.route("/api/store/server1/check", methods=["GET"])
def server1_check_country():
    """Return live filtered stock count and price for a specific country matching active user filters."""
    from services.auth_service import get_current_user_id
    from services.store_service import check_server1_country_stock
    uid = get_current_user_id(request)
    country = (request.args.get("country") or request.args.get("c") or "").strip()
    if not country:
        return jsonify({"success": False, "error": "Country parameter is required"}), 400
    res = check_server1_country_stock(country, uid=uid)
    return jsonify(res)


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
    """Return Server 5 SMM catalogue (SMM Hub), supporting both full and paginated queries."""
    page_param = request.args.get("page")
    limit_param = request.args.get("limit")
    platform = request.args.get("platform")
    category = request.args.get("category")
    search = request.args.get("search")

    # If any pagination or filtering query parameter is provided:
    if page_param is not None or limit_param is not None or category or search or (platform and platform.lower() != 'all'):
        page = int(page_param) if page_param and page_param.isdigit() else 1
        limit = int(limit_param) if limit_param and limit_param.isdigit() else 40
        result = get_server5_stock_paginated(
            page=page,
            limit=limit,
            platform=platform,
            category=category,
            search=search,
        )
        return jsonify({
            "success": True,
            "items": result["items"],
            "total": result["total"],
            "page": result["page"],
            "limit": result["limit"],
            "has_more": result["has_more"],
        })

    # Backward compatibility: unpaginated catalogue
    items = get_server5_stock()
    return jsonify({"success": True, "items": items})


@store_bp.route("/api/store/server5/categories", methods=["GET"])
def server5_categories():
    """Return distinct active categories with item counts for rapid tab filtering."""
    all_items = get_server5_stock()
    cat_map = {}
    for item in all_items:
        c_name = str(item.get("category") or "Other").strip()
        p_name = str(item.get("platform") or "general").strip().lower()
        if c_name not in cat_map:
            cat_map[c_name] = {"category": c_name, "platform": p_name, "count": 0}
        cat_map[c_name]["count"] += 1
    categories = sorted(cat_map.values(), key=lambda x: x["count"], reverse=True)
    return jsonify({"success": True, "categories": categories})


@store_bp.route("/api/store/pinned", methods=["GET"])
def list_pinned_services():
    """Return active pinned/featured services across servers with live prices and badges."""
    server_param = request.args.get("server")
    s_no = None
    if server_param and server_param.isdigit():
        s_no = int(server_param)
    items = get_pinned_services(server_no=s_no)
    return jsonify({"success": True, "pinned": items})
