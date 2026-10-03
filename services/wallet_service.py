"""Wallet, dual-balance accounting, and P2P transfer service.

Enforces:
1. Promo balance isolation: locked promo credits can NEVER be transferred.
2. Store purchase ordering: promo balance is spent first before transferable main balance.
3. Atomic peer-to-peer transfers with exact audit logging.
"""
from __future__ import annotations

import logging
from typing import Any

from database import (
    connect,
    transaction,
    utcnow,
    get_user_balances,
    deduct_balance_for_purchase,
    execute_p2p_transfer,
)

logger = logging.getLogger("services.wallet")


def get_balances(user_id: int) -> dict[str, int]:
    """Return user balances: balance, promo_balance, transferable_balance, sales_balance."""
    return get_user_balances(user_id)


def purchase_deduct(user_id: int, amount: int | float) -> bool:
    """Atomically deduct balance for a purchase, exhausting promo balance first."""
    return deduct_balance_for_purchase(user_id, amount)


def p2p_transfer(sender_id: int, recipient_raw: str | int, amount: int | float) -> dict[str, Any]:
    """Execute peer-to-peer balance transfer from transferable balance only."""
    try:
        s_id = int(sender_id)
        xfer_amt = int(amount)
    except (ValueError, TypeError):
        return {"success": False, "error": "Invalid user ID or amount."}

    if xfer_amt <= 0:
        return {"success": False, "error": "Transfer amount must be greater than zero."}

    # Resolve recipient
    target_uid: int | None = None
    recipient_str = str(recipient_raw).strip()
    if recipient_str.isdigit():
        target_uid = int(recipient_str)
    else:
        clean_user = recipient_str.lstrip("@").lower()
        # Look up by user_id or settings/reseller
        if clean_user.isdigit():
            target_uid = int(clean_user)

    if not target_uid:
        return {"success": False, "error": "Recipient numerical Telegram ID required."}

    if target_uid == s_id:
        return {"success": False, "error": "Cannot transfer balance to yourself."}

    # Execute transfer via atomic database helper
    result = execute_p2p_transfer(s_id, target_uid, xfer_amt)
    if not result:
        return {"success": False, "error": result.error or "Transfer failed."}

    return {
        "success": True,
        "transfer_id": result.get("transfer_id"),
        "sender_id": s_id,
        "recipient_id": target_uid,
        "amount": xfer_amt,
        "transferred": xfer_amt,
        "new_balance": result.get("new_balance"),
    }


def credit_balance(
    user_id: int,
    amount: int,
    method_name: str = "Manual Admin",
    reason: str = "Deposit",
    is_promo: bool = False,
) -> dict[str, Any]:
    """Atomically credit user wallet with standard balance or locked promo balance."""
    uid = int(user_id)
    amt = int(amount)
    if amt <= 0:
        return {"success": False, "error": "Amount must be positive."}

    with transaction(immediate=True) as conn:
        conn.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (uid,))
        if is_promo:
            conn.execute(
                "UPDATE users SET balance = balance + ?, promo_balance = COALESCE(promo_balance, 0) + ? WHERE user_id = ?",
                (amt, amt, uid),
            )
        else:
            conn.execute(
                "UPDATE users SET balance = balance + ?, total_deposited = total_deposited + ? WHERE user_id = ?",
                (amt, amt, uid),
            )

        conn.execute(
            "INSERT INTO deposits (user_id, amount, method_name, status, date) VALUES (?, ?, ?, 'success', ?)",
            (uid, amt, f"{method_name} ({reason})", utcnow()),
        )

        new_bal_row = conn.execute("SELECT balance, promo_balance FROM users WHERE user_id = ?", (uid,)).fetchone()
        new_balance = int(new_bal_row["balance"] or 0)
        new_promo = int(new_bal_row["promo_balance"] or 0)

    return {
        "success": True,
        "user_id": uid,
        "amount": amt,
        "new_balance": new_balance,
        "promo_balance": new_promo,
        "transferable_balance": max(0, new_balance - new_promo),
    }


def set_user_currency(user_id: int, currency: str) -> str:
    """Set preferred currency for user (INR or USDT)."""
    curr = "USDT" if currency.upper() == "USDT" else "INR"
    with connect() as conn:
        conn.execute("UPDATE users SET pref_curr = ? WHERE user_id = ?", (curr, int(user_id)))
    return curr
