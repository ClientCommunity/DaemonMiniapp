"""Verification test for live provider store fulfillment and UTR verification."""
import os
import unittest
os.environ["PAYMENT_ENCRYPTION_KEY"] = "deamon_master_secret_encryption_key_2026_xyz"

from database import transaction, connect
from services.order_service import execute_buy, poll_otp_status, cancel_order
from services.fampay_service import submit_manual_deposit, check_imap_for_utr


class TestLiveStoreFulfillment(unittest.TestCase):
    def setUp(self):
        self.test_uid = 918273645
        with transaction(immediate=True) as conn:
            conn.execute("INSERT OR REPLACE INTO users (user_id, balance, promo_balance) VALUES (?, 1000, 100)", (self.test_uid,))

    def test_server3_allocation_or_refund(self):
        """Server 3 must either return a real phone number or symmetrically refund 100% of balance."""
        res = execute_buy(
            user_id=self.test_uid,
            server=3,
            item_data={"service_code": "tg", "server_code": "0", "name": "Telegram", "price": 45},
            qty=1
        )
        with connect() as conn:
            bal, promo = conn.execute("SELECT balance, promo_balance FROM users WHERE user_id = ?", (self.test_uid,)).fetchone()

        if res.get("success"):
            self.assertIn("phone", res)
            self.assertFalse(res["phone"].startswith("+91000")) # Must not be fake
            self.assertEqual(bal + promo, 1100 - 45)
            # Test cancellation
            canc = cancel_order(self.test_uid, res["phone"])
            self.assertTrue(canc.get("success"))
        else:
            # If provider had no numbers or balance, balance must be intact
            self.assertEqual(bal, 1000)
            self.assertEqual(promo, 100)

    def test_server4_allocation_or_refund(self):
        """Server 4 must either return a real phone number or symmetrically refund 100% of balance."""
        res = execute_buy(
            user_id=self.test_uid,
            server=4,
            item_data={"service_code": "tg", "country_code": "0", "operator_code": "1", "name": "Telegram", "price": 50},
            qty=1
        )
        with connect() as conn:
            bal, promo = conn.execute("SELECT balance, promo_balance FROM users WHERE user_id = ?", (self.test_uid,)).fetchone()

        if res.get("success"):
            self.assertIn("phone", res)
            self.assertFalse(res["phone"].startswith("+91000")) # Must not be fake
            self.assertEqual(bal + promo, 1100 - 50)
            # Test cancellation
            canc = cancel_order(self.test_uid, res["phone"])
            self.assertTrue(canc.get("success"))
        else:
            # If provider had no numbers or balance, balance must be intact
            self.assertEqual(bal, 1000)
            self.assertEqual(promo, 100)

    def test_server5_link_requirement_and_refund(self):
        """Server 5 must require a target link and symmetrically protect balance."""
        res = execute_buy(
            user_id=self.test_uid,
            server=5,
            item_data={"id": 1, "name": "Instagram Likes", "price": 25, "link": ""},
            qty=10
        )
        self.assertFalse(res.get("success"))
        self.assertIn("link", res.get("error", "").lower())
        with connect() as conn:
            bal = conn.execute("SELECT balance FROM users WHERE user_id = ?", (self.test_uid,)).fetchone()[0]
        self.assertEqual(bal, 1000)

    def test_utr_duplicate_replay_protection(self):
        """Depositing with an already credited UTR must be blocked by anti-replay protection."""
        test_utr = "REPLAY123456"
        with transaction(immediate=True) as conn:
            conn.execute("""
                INSERT INTO deposits (user_id, amount, method_name, status)
                VALUES (?, 50, ?, 'success')
            """, (self.test_uid, f"UPI Auto-Verified (UTR: {test_utr})"))

        res = submit_manual_deposit(self.test_uid, "upi_qr", test_utr, 50)
        self.assertFalse(res.get("success"))
        self.assertIn("already been verified", res.get("error", ""))


if __name__ == "__main__":
    unittest.main()
