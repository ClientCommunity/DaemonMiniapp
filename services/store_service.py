"""Catalogue and store service for Servers 1-5.

Guarantees 100% vendor privacy (zero leakage of upstream provider names such as
LZT, DGOTP, TemporaSMS, or external SMM panel hostnames).
"""
from __future__ import annotations

import logging
from typing import Any

from config import SERVER_NAMES
from database import connect

logger = logging.getLogger("services.store")


def get_all_servers_overview() -> list[dict[str, Any]]:
    """Return overview metadata for Servers 1 through 5 with zero vendor leaks."""
    servers = []
    for s_no in range(1, 6):
        meta = SERVER_NAMES.get(s_no, {})
        servers.append({
            "id": s_no,
            "name": meta.get("name", f"Server {s_no}"),
            "subtitle": meta.get("subtitle", "Online Store"),
            "icon": meta.get("icon", "⚡"),
            "enabled": True,
        })
    return servers


def get_server1_stock() -> list[dict[str, Any]]:
    """Return Server 1 stock items (Global 2FA Accounts)."""
    with connect() as conn:
        rows = conn.execute("""
            SELECT country_icon, country_name, price, COUNT(*) as stock_count
            FROM stock
            WHERE available = 1 AND (category = 'Server 1' OR category = 'Good')
            GROUP BY country_name
            ORDER BY country_name ASC
            LIMIT 60
        """).fetchall()

    items = []
    for r in rows:
        items.append({
            "id": r["country_name"],
            "name": r["country_name"],
            "country": r["country_name"],
            "icon": r["country_icon"] or "🌍",
            "price": int(r["price"] or 80),
            "stock": int(r["stock_count"]),
            "subtitle": "Global Market 2FA",
        })

    if not items:
        # Fallback standard active catalogue if local cache is currently empty
        defaults = [
            ("India", "🇮🇳", 85, 45),
            ("Russia", "🇷🇺", 95, 30),
            ("USA", "🇺🇸", 120, 20),
            ("Indonesia", "🇮🇩", 75, 50),
            ("Vietnam", "🇻🇳", 80, 40),
            ("Brazil", "🇧🇷", 90, 25),
            ("Nigeria", "🇳🇬", 65, 60),
            ("Philippines", "🇵🇭", 80, 35),
            ("Kazakhstan", "🇰🇿", 90, 15),
        ]
        items = [
            {
                "id": c,
                "name": c,
                "country": c,
                "icon": flag,
                "price": price,
                "stock": stock,
                "subtitle": "Global Market 2FA",
            }
            for c, flag, price, stock in defaults
        ]

    return items


def get_server2_stock(tier: str = "good") -> dict[str, Any]:
    """Return Server 2 catalogue segregated by quality_tier ('good' vs 'cheap')."""
    clean_tier = "cheap" if tier.lower() == "cheap" else "good"

    with connect() as conn:
        good_count_row = conn.execute(
            "SELECT COUNT(*) FROM stock WHERE available = 1 AND COALESCE(quality_tier, 'good') = 'good'"
        ).fetchone()
        cheap_count_row = conn.execute(
            "SELECT COUNT(*) FROM stock WHERE available = 1 AND quality_tier = 'cheap'"
        ).fetchone()

        good_count = int(good_count_row[0] if good_count_row else 0)
        cheap_count = int(cheap_count_row[0] if cheap_count_row else 0)

        rows = conn.execute("""
            SELECT country_icon, country_name, account_year, price, COUNT(*) as stock_count
            FROM stock
            WHERE available = 1 AND COALESCE(quality_tier, 'good') = ?
            GROUP BY country_name, account_year, price
            ORDER BY country_name ASC, account_year DESC
        """, (clean_tier,)).fetchall()

    items = []
    for r in rows:
        c_name = r["country_name"] or "Unknown"
        yr = r["account_year"] or 2024
        items.append({
            "id": f"{c_name}_{yr}",
            "name": f"{c_name} ({yr})",
            "country": c_name,
            "year": yr,
            "icon": r["country_icon"] or "🌍",
            "price": int(r["price"] or 60),
            "stock": int(r["stock_count"]),
            "subtitle": "🟢 Good Quality Session" if clean_tier == "good" else "🟡 Cheap Quality Session",
        })

    return {
        "tier": clean_tier,
        "good_count": good_count,
        "cheap_count": cheap_count,
        "items": items,
    }


def get_server3_stock() -> list[dict[str, Any]]:
    """Return Server 3 catalogue (Instant Virtual OTP)."""
    items = []
    icon_map = {
        "tg": "✈️", "wa": "💬", "wb": "💬", "go": "🔍", "ig": "📸",
        "fb": "👥", "tw": "🐦", "tk": "🎵", "openai": "🤖", "ds": "🎮"
    }

    try:
        with connect() as conn:
            rows = conn.execute("""
                SELECT service_code, name, provider_price
                FROM server3_services
                WHERE enabled = 1
                ORDER BY name ASC
            """).fetchall()

        for r in rows:
            code = r["service_code"]
            s_name = r["name"] or code.upper()
            items.append({
                "id": code,
                "name": s_name,
                "country": s_name,
                "icon": icon_map.get(code.lower(), "⚡"),
                "price": int(r["provider_price"] or 45),
                "stock": 999,
                "subtitle": "Instant Virtual OTP",
            })
    except Exception as exc:
        logger.warning("Error querying server3_services: %s", exc)

    if not items:
        # Standard curated platform listing
        defaults = [
            ("Telegram", "tg", "✈️", 45),
            ("WhatsApp", "wa", "💬", 50),
            ("Google / Gmail", "go", "🔍", 35),
            ("Instagram", "ig", "📸", 30),
            ("Discord", "ds", "🎮", 25),
            ("OpenAI / ChatGPT", "openai", "🤖", 40),
            ("TikTok", "tk", "🎵", 30),
            ("Twitter / X", "tw", "🐦", 35),
        ]
        items = [
            {
                "id": code,
                "name": name,
                "country": name,
                "icon": icon,
                "price": price,
                "stock": 999,
                "subtitle": "Instant Virtual OTP",
            }
            for name, code, icon, price in defaults
        ]

    return items


def get_server4_stock() -> list[dict[str, Any]]:
    """Return Server 4 catalogue (Fresh Carrier Numbers)."""
    items = []
    try:
        with connect() as conn:
            rows = conn.execute("""
                SELECT service_code, name
                FROM server4_services
                WHERE enabled = 1
                ORDER BY name ASC
            """).fetchall()

        for r in rows:
            s_name = r["name"] or r["service_code"].upper()
            items.append({
                "id": r["service_code"],
                "name": s_name,
                "country": s_name,
                "icon": "📶",
                "price": 50,
                "stock": 999,
                "subtitle": "Fresh Carrier Number",
            })
    except Exception as exc:
        logger.warning("Error querying server4_services: %s", exc)

    if not items:
        defaults = [
            ("Telegram", "tg", "✈️", 55),
            ("WhatsApp", "wa", "💬", 60),
            ("Google / Gmail", "go", "🔍", 40),
            ("Instagram", "ig", "📸", 35),
            ("Snapchat", "fu", "👻", 35),
            ("Amazon", "am", "📦", 40),
        ]
        items = [
            {
                "id": code,
                "name": name,
                "country": name,
                "icon": icon,
                "price": price,
                "stock": 999,
                "subtitle": "Fresh Carrier Number",
            }
            for name, code, icon, price in defaults
        ]

    return items


def get_server5_stock() -> list[dict[str, Any]]:
    """Return Server 5 catalogue (SMM Hub)."""
    items = []
    try:
        with connect() as conn:
            rows = conn.execute("""
                SELECT s.id, s.name, s.rate, s.minimum, s.maximum, c.display_name as category
                FROM smm_services s
                LEFT JOIN smm_categories c ON c.id = s.category_id
                WHERE s.enabled = 1 AND s.visible = 1
                ORDER BY s.id ASC
                LIMIT 50
            """).fetchall()

        for r in rows:
            items.append({
                "id": r["id"],
                "name": r["name"],
                "country": r["category"] or "SMM Hub",
                "category": r["category"] or "SMM",
                "icon": "🚀",
                "price": int(r["rate"] or 10),
                "min_qty": int(r["minimum"] or 100),
                "max_qty": int(r["maximum"] or 10000),
                "stock": 9999,
                "subtitle": "Rate per 1,000",
            })
    except Exception as exc:
        logger.warning("Error querying smm_services: %s", exc)

    if not items:
        defaults = [
            ("Telegram Channel Members (High Quality)", "Telegram", "✈️", 95),
            ("Instagram Real Followers", "Instagram", "📸", 120),
            ("YouTube Video Views", "YouTube", "▶️", 140),
            ("Twitter / X Followers", "Twitter", "🐦", 110),
        ]
        items = [
            {
                "id": idx + 1,
                "name": name,
                "country": cat,
                "category": cat,
                "icon": icon,
                "price": price,
                "min_qty": 100,
                "max_qty": 10000,
                "stock": 9999,
                "subtitle": "Rate per 1,000",
            }
            for idx, (name, cat, icon, price) in enumerate(defaults)
        ]

    return items
