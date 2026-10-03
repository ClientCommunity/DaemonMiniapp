"""User transactions and activity history Blueprint.

Combines orders, deposits, and P2P transfers in chronological order.

Endpoints:
- GET /api/history: Retrieve unified transaction timeline
"""
from __future__ import annotations

import logging
from flask import Blueprint, jsonify, request

from database import connect
from services.auth_service import get_current_user_id

logger = logging.getLogger("api.history")
history_bp = Blueprint("history", __name__)


@history_bp.route("/api/history", methods=["GET"])
def get_user_history():
    """Return unified history records (Orders, Deposits, Transfers) for current user."""
    uid = get_current_user_id(request)
    if not uid:
        return jsonify({"success": False, "items": []})

    items = []
    with connect() as conn:
        # 1. Orders
        orders = conn.execute("""
            SELECT id, country, price, phone, otp, server, date
            FROM orders
            WHERE user_id = ?
            ORDER BY id DESC LIMIT 25
        """, (uid,)).fetchall()

        for o in orders:
            server_str = o["server"] or "Store"
            phone_str = o["phone"] or "N/A"
            otp_str = o["otp"] or "None"
            items.append({
                "type": "order",
                "title": f"🛒 {o['country']} ({server_str})",
                "amount": f"-₹{o['price']}",
                "date": str(o["date"])[:19],
                "details": f"Number: {phone_str} · OTP: {otp_str}",
                "download_url": (
                    f"/api/session/download/{phone_str}"
                    if server_str == "Server 2" and phone_str != "N/A"
                    else None
                ),
            })

        # 2. Deposits
        deposits = conn.execute("""
            SELECT id, amount, method_name, status, date
            FROM deposits
            WHERE user_id = ?
            ORDER BY id DESC LIMIT 25
        """, (uid,)).fetchall()

        for d in deposits:
            status_text = (d["status"] or "pending").title()
            items.append({
                "type": "deposit",
                "title": f"💳 {d['method_name']}",
                "amount": f"+₹{d['amount']}",
                "date": str(d["date"])[:19],
                "details": f"Status: {status_text}",
                "download_url": None,
            })

        # 3. Balance Transfers (Sent & Received)
        transfers_sent = conn.execute("""
            SELECT id, recipient_id, amount, created_at
            FROM balance_transfers
            WHERE sender_id = ?
            ORDER BY id DESC LIMIT 20
        """, (uid,)).fetchall()

        for t in transfers_sent:
            items.append({
                "type": "transfer_sent",
                "title": f"📤 Transfer to User {t['recipient_id']}",
                "amount": f"-₹{t['amount']}",
                "date": str(t["created_at"])[:19],
                "details": f"P2P Transfer ID #{t['id']}",
                "download_url": None,
            })

        transfers_received = conn.execute("""
            SELECT id, sender_id, amount, created_at
            FROM balance_transfers
            WHERE recipient_id = ?
            ORDER BY id DESC LIMIT 20
        """, (uid,)).fetchall()

        for t in transfers_received:
            items.append({
                "type": "transfer_received",
                "title": f"📥 Transfer from User {t['sender_id']}",
                "amount": f"+₹{t['amount']}",
                "date": str(t["created_at"])[:19],
                "details": f"P2P Transfer ID #{t['id']}",
                "download_url": None,
            })

    # Sort combined events by date descending
    items.sort(key=lambda x: x["date"], reverse=True)
    return jsonify({"success": True, "items": items[:50]})
