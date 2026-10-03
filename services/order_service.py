"""Order fulfillment, live OTP tracking, and cancellation/refund service."""
from __future__ import annotations

import logging
import secrets
import time
from typing import Any

from database import connect, transaction, utcnow
from services.wallet_service import purchase_deduct

logger = logging.getLogger("services.order")


def random_virtual_phone() -> str:
    """Generate a placeholder virtual number for virtual test/mock orders."""
    return f"+91{secrets.randbelow(8999999999) + 1000000000}"


def process_reseller_commission(customer_uid: int, purchase_amount: int, description: str = "Purchase") -> None:
    """Credit margin commission to reseller if customer registered via custom margin link."""
    try:
        with connect() as conn:
            user_row = conn.execute(
                "SELECT referred_by, reseller_token FROM users WHERE user_id = ?",
                (customer_uid,)
            ).fetchone()
            if not user_row or not user_row["referred_by"] or not user_row["reseller_token"]:
                return

            reseller_uid = user_row["referred_by"]
            token = user_row["reseller_token"]

            link_row = conn.execute(
                "SELECT margin_percent FROM reseller_links WHERE token = ? AND user_id = ?",
                (token, reseller_uid)
            ).fetchone()
            if not link_row or link_row["margin_percent"] <= 0:
                return

            margin_pct = int(link_row["margin_percent"])
            commission = max(1, int(round((purchase_amount * margin_pct) / 100.0)))

            conn.execute(
                "UPDATE users SET sales_balance = sales_balance + ? WHERE user_id = ?",
                (commission, reseller_uid)
            )
            conn.execute("""
                INSERT INTO reseller_earnings (reseller_id, customer_id, token, amount, commission, description)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (reseller_uid, customer_uid, token, purchase_amount, commission, description))
            conn.commit()
    except Exception as ex:
        logger.warning("Error processing reseller commission for %s: %s", customer_uid, ex)


def execute_buy(
    user_id: int,
    server: int,
    item_data: dict[str, Any],
    qty: int = 1,
    tier: str = "good",
    fmt: str = "account"
) -> dict[str, Any]:
    """Execute a purchase atomically, reserving stock and deducting wallet."""
    uid = int(user_id)
    server_num = int(server)
    quantity = max(1, int(qty))
    unit_price = int(item_data.get("price", 50))
    total_price = unit_price * quantity

    # 1. Atomic balance check and deduction (promo balance consumed first)
    if not purchase_deduct(uid, total_price):
        return {
            "success": False,
            "error": "Insufficient balance. Please deposit funds first.",
            "required": total_price,
        }

    with connect() as conn:
        # ======================================================================
        # SERVER 2: Session Accounts (Good / Cheap)
        # ======================================================================
        if server_num == 2:
            country = item_data.get("country", "")
            year = item_data.get("year", 2024)
            clean_tier = "cheap" if tier.lower() == "cheap" else "good"

            # A. Bulk ZIP delivery for multiple sessions
            if fmt == "session" and quantity > 1:
                stock_rows = conn.execute("""
                    SELECT phone, session_file, twofa
                    FROM stock
                    WHERE available = 1
                      AND country_name LIKE ?
                      AND account_year = ?
                      AND COALESCE(quality_tier, 'good') = ?
                    LIMIT ?
                """, (f"{country}%", year, clean_tier, quantity)).fetchall()

                if len(stock_rows) < quantity:
                    # Partial / out of stock - refund atomically
                    conn.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (total_price, uid))
                    conn.commit()
                    return {
                        "success": False,
                        "error": f"Insufficient stock. Requested {quantity}, but only {len(stock_rows)} available."
                    }

                delivered_phones = []
                for s in stock_rows:
                    conn.execute("UPDATE stock SET available = 0 WHERE phone = ?", (s["phone"],))
                    delivered_phones.append(s["phone"])

                order_id = f"ZIP_{int(time.time())}_{secrets.token_hex(3)}"
                conn.execute("""
                    INSERT INTO orders (user_id, country, year, price, phone, otp, server, date)
                    VALUES (?, ?, ?, ?, ?, 'ZIP DELIVERED', 'Server 2', ?)
                """, (uid, country, year, total_price, ",".join(delivered_phones), utcnow()))
                conn.commit()

                # Credit reseller commission if applicable
                process_reseller_commission(uid, total_price, f"Server 2 Bulk ({quantity}x)")

                new_bal = conn.execute("SELECT balance FROM users WHERE user_id = ?", (uid,)).fetchone()[0]
                return {
                    "success": True,
                    "order_id": order_id,
                    "delivery_type": "session_zip",
                    "count": len(delivered_phones),
                    "download_url": f"/api/session/download_zip/{order_id}",
                    "new_balance": int(new_bal),
                }

            # B. Single Account Live Delivery
            cand = conn.execute("""
                SELECT phone, session_file, country_icon, twofa
                FROM stock
                WHERE available = 1
                  AND country_name LIKE ?
                  AND account_year = ?
                  AND COALESCE(quality_tier, 'good') = ?
                LIMIT 1
            """, (f"{country}%", year, clean_tier)).fetchone()

            if not cand:
                # Refund
                conn.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (total_price, uid))
                conn.commit()
                return {"success": False, "error": "This item is currently out of stock."}

            phone = cand["phone"]
            conn.execute("UPDATE stock SET available = 0 WHERE phone = ?", (phone,))
            conn.execute("""
                INSERT INTO orders (user_id, country, year, price, phone, otp, server, date)
                VALUES (?, ?, ?, ?, ?, 'WAITING', 'Server 2', ?)
            """, (uid, country, year, total_price, phone, utcnow()))
            conn.commit()

            process_reseller_commission(uid, total_price, f"Server 2 ({phone})")

            new_bal = conn.execute("SELECT balance FROM users WHERE user_id = ?", (uid,)).fetchone()[0]
            clean_phone = f"+{phone.lstrip('+')}"
            return {
                "success": True,
                "order_id": phone,
                "phone": clean_phone,
                "delivery_type": "account_live",
                "download_url": f"/api/session/download/{phone}",
                "twofa": cand["twofa"] or "None",
                "new_balance": int(new_bal),
            }

        # ======================================================================
        # SERVERS 1, 3, 4, 5
        # ======================================================================
        order_key = secrets.token_hex(4).upper()
        mock_phone = random_virtual_phone()
        server_label = f"Server {server_num}"

        conn.execute("""
            INSERT INTO orders (user_id, country, year, price, phone, otp, server, date)
            VALUES (?, ?, ?, ?, ?, 'WAITING', ?, ?)
        """, (uid, item_data.get("country", "Global"), 2024, total_price, mock_phone, server_label, utcnow()))
        conn.commit()

        process_reseller_commission(uid, total_price, f"{server_label} Purchase")

        new_bal = conn.execute("SELECT balance FROM users WHERE user_id = ?", (uid,)).fetchone()[0]
        return {
            "success": True,
            "order_id": order_key,
            "phone": mock_phone,
            "delivery_type": "account_live",
            "new_balance": int(new_bal),
        }


def poll_otp_status(identifier: str) -> dict[str, Any]:
    """Check live OTP delivery status for a phone number or order identifier."""
    clean_id = (identifier or "").replace("+", "").replace(" ", "").strip()
    if not clean_id:
        return {"status": "not_found", "otp": None}

    with connect() as conn:
        row = conn.execute("""
            SELECT id, phone, otp, server, date
            FROM orders
            WHERE phone LIKE ? OR id = ?
            ORDER BY id DESC LIMIT 1
        """, (f"%{clean_id}%", clean_id if clean_id.isdigit() else -1)).fetchone()

    if not row:
        return {"status": "not_found", "otp": None}

    raw_otp = row["otp"]
    if raw_otp and raw_otp not in ("WAITING", "ZIP DELIVERED"):
        return {
            "status": "completed",
            "otp": raw_otp,
            "phone": row["phone"],
            "server": row["server"],
        }

    return {
        "status": "waiting",
        "otp": None,
        "phone": row["phone"],
        "server": row["server"],
    }


def cancel_order(user_id: int, identifier: str) -> dict[str, Any]:
    """Cancel an active waiting order and refund the user wallet atomically."""
    uid = int(user_id)
    clean_id = (identifier or "").replace("+", "").replace(" ", "").strip()

    with transaction(immediate=True) as conn:
        row = conn.execute("""
            SELECT id, price, phone, otp, server
            FROM orders
            WHERE user_id = ? AND (phone LIKE ? OR id = ?) AND otp = 'WAITING'
            ORDER BY id DESC LIMIT 1
        """, (uid, f"%{clean_id}%", clean_id if clean_id.isdigit() else -1)).fetchone()

        if not row:
            return {"success": False, "error": "Order not found or cannot be cancelled."}

        order_id = row["id"]
        refund_amount = int(row["price"] or 0)
        phone = row["phone"]

        # Mark cancelled
        conn.execute("UPDATE orders SET otp = 'CANCELLED' WHERE id = ?", (order_id,))
        # If Server 2, return stock
        if phone:
            conn.execute("UPDATE stock SET available = 1 WHERE phone = ?", (phone,))

        # Refund to user
        conn.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (refund_amount, uid))

        new_bal = conn.execute("SELECT balance FROM users WHERE user_id = ?", (uid,)).fetchone()[0]

    return {
        "success": True,
        "order_id": order_id,
        "refunded_amount": refund_amount,
        "new_balance": int(new_bal),
    }
