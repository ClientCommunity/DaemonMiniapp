"""Peer-to-peer balance transfer Blueprint.

Enforces promo balance isolation:
Under NO circumstances can promo credits be transferred. Only transferable_balance
(total balance minus locked promo_balance) is eligible for P2P transfer.
"""
from __future__ import annotations

import logging
from flask import Blueprint, jsonify, request

from services.auth_service import get_current_user_id
from services.wallet_service import p2p_transfer

logger = logging.getLogger("api.transfers")
transfers_bp = Blueprint("transfers", __name__)


@transfers_bp.route("/api/transfer", methods=["POST"])
def transfer_balance():
    """Transfer balance to another user with locked promotional balance protection."""
    uid = get_current_user_id(request)
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    recipient_raw = str(data.get("recipient", "")).strip()
    amount = data.get("amount", 0)

    try:
        amt = int(amount)
    except (ValueError, TypeError):
        return jsonify({"success": False, "error": "Amount must be a positive integer."}), 400

    if amt <= 0:
        return jsonify({"success": False, "error": "Amount must be greater than zero."}), 400

    result = p2p_transfer(sender_id=uid, recipient_raw=recipient_raw, amount=amt)
    status_code = 200 if result.get("success") else 400
    return jsonify(result), status_code
