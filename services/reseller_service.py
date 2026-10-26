"""Reseller custom margin links and commission dashboard service.

Enforces:
Admin min margin <= reseller margin <= Admin max margin (5% to 100%).
Supports multi-server bundling into 1 unique reseller URL.
"""
from __future__ import annotations

import logging
import secrets
from typing import Any

from config import RESELLER_MIN_MARGIN, RESELLER_MAX_MARGIN
from database import connect, transaction, utcnow, get_reseller_info, get_setting

logger = logging.getLogger("services.reseller")


def get_margin_bounds() -> tuple[int, int]:
    """Fetch current global minimum and maximum allowed reseller margin percent."""
    min_m = get_setting("reseller_min_margin")
    max_m = get_setting("reseller_max_margin")

    try:
        min_val = int(min_m) if min_m else RESELLER_MIN_MARGIN
    except ValueError:
        min_val = RESELLER_MIN_MARGIN

    try:
        max_val = int(max_m) if max_m else RESELLER_MAX_MARGIN
    except ValueError:
        max_val = RESELLER_MAX_MARGIN

    return min_val, max_val


def get_or_create_reseller_link(user_id: int) -> dict[str, Any]:
    """Retrieve reseller dashboard link, stats, and margin config."""
    uid = int(user_id)
    min_m, max_m = get_margin_bounds()

    with transaction(immediate=True) as conn:
        r_link = conn.execute("""
            SELECT token, margin_percent, target_id
            FROM reseller_links
            WHERE user_id = ?
            ORDER BY created_at DESC LIMIT 1
        """, (uid,)).fetchone()

        if not r_link:
            token = secrets.token_hex(4).lower()
            default_margin = max(min_m, min(15, max_m))
            conn.execute("""
                INSERT INTO reseller_links (token, user_id, margin_percent, target_id, product_type, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (token, uid, default_margin, "1,2,3,4,5", "all", utcnow()))
            margin = default_margin
            servers = [1, 2, 3, 4, 5]
        else:
            token = r_link["token"]
            margin = int(r_link["margin_percent"])
            target_id = r_link["target_id"] if "target_id" in r_link.keys() else ""
            if target_id:
                servers = [int(s) for s in str(target_id).split(",") if s.strip().isdigit()]
                if not servers:
                    servers = [1, 2, 3, 4, 5]
            else:
                servers = [1, 2, 3, 4, 5]

        cust_count = conn.execute("""
            SELECT COUNT(*) FROM users
            WHERE referred_by = ? AND reseller_token IS NOT NULL
        """, (uid,)).fetchone()[0]

        earnings_row = conn.execute("""
            SELECT COUNT(*), COALESCE(SUM(commission), 0)
            FROM reseller_earnings
            WHERE reseller_id = ?
        """, (uid,)).fetchone()

        orders_count = int(earnings_row[0] or 0)
        total_earned = float(earnings_row[1] or 0.0)

    # 1 URL for multiple servers: if subset selected, attach server filter tag
    if len(servers) < 5:
        server_suffix = "_s" + "_s".join(str(s) for s in sorted(servers))
        link = f"https://t.me/DeamonOTPbot?start=resell_{token}{server_suffix}"
    else:
        link = f"https://t.me/DeamonOTPbot?start=resell_{token}"

    return {
        "success": True,
        "token": token,
        "margin": margin,
        "margin_percent": margin,
        "servers": servers,
        "link": link,
        "customers": int(cust_count or 0),
        "orders": orders_count,
        "earnings": total_earned,
        "min_margin": min_m,
        "max_margin": max_m,
    }


def update_reseller_margin(user_id: int, new_margin: int, servers: list[int] | None = None) -> dict[str, Any]:
    """Update reseller profit margin and multi-server configuration within enforced admin bounds."""
    uid = int(user_id)
    margin = int(new_margin)
    min_m, max_m = get_margin_bounds()

    if not (min_m <= margin <= max_m):
        return {
            "success": False,
            "error": f"Margin must be between {min_m}% and {max_m}%.",
            "min_margin": min_m,
            "max_margin": max_m,
        }

    clean_servers = [s for s in servers if 1 <= s <= 5] if servers else [1, 2, 3, 4, 5]
    if not clean_servers:
        clean_servers = [1, 2, 3, 4, 5]

    target_str = ",".join(str(s) for s in sorted(clean_servers))
    prod_type = "servers" if len(clean_servers) < 5 else "all"

    with transaction(immediate=True) as conn:
        row = conn.execute("SELECT token FROM reseller_links WHERE user_id = ? LIMIT 1", (uid,)).fetchone()
        if not row:
            token = secrets.token_hex(4).lower()
            conn.execute("""
                INSERT INTO reseller_links (token, user_id, margin_percent, target_id, product_type, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (token, uid, margin, target_str, prod_type, utcnow()))
        else:
            token = row["token"]
            conn.execute("""
                UPDATE reseller_links
                SET margin_percent = ?, target_id = ?, product_type = ?
                WHERE user_id = ?
            """, (margin, target_str, prod_type, uid))

    if len(clean_servers) < 5:
        server_suffix = "_s" + "_s".join(str(s) for s in sorted(clean_servers))
        link = f"https://t.me/DeamonOTPbot?start=resell_{token}{server_suffix}"
    else:
        link = f"https://t.me/DeamonOTPbot?start=resell_{token}"

    return {
        "success": True,
        "margin": margin,
        "servers": clean_servers,
        "link": link,
        "token": token,
        "min_margin": min_m,
        "max_margin": max_m,
    }
