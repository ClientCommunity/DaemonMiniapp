import unittest
import sqlite3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import (
    get_user_order_stats,
    get_overall_order_stats,
    get_unified_user_orders,
)

class TestUnifiedOrderStats(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("""
            CREATE TABLE orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                country TEXT,
                year INTEGER,
                price INTEGER,
                phone TEXT,
                otp TEXT,
                server TEXT,
                date TEXT
            )
        """)
        self.conn.execute("""
            CREATE TABLE server3_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_order_id TEXT,
                user_id INTEGER,
                service_code TEXT,
                server_code TEXT,
                phone TEXT,
                provider_price REAL,
                charged_price INTEGER,
                status TEXT,
                sms_code TEXT,
                refunded INTEGER,
                created_at TEXT
            )
        """)
        self.conn.execute("""
            CREATE TABLE server4_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider_order_id TEXT,
                user_id INTEGER,
                operator_code TEXT,
                country_code TEXT,
                service_code TEXT,
                phone TEXT,
                provider_price REAL,
                charged_price INTEGER,
                status TEXT,
                sms_code TEXT,
                refunded INTEGER,
                created_at TEXT
            )
        """)
        self.conn.execute("""
            CREATE TABLE smm_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                link TEXT,
                quantity INTEGER,
                charge REAL,
                status TEXT,
                refunded INTEGER,
                created_at TEXT
            )
        """)

    def tearDown(self):
        self.conn.close()

    def test_user_orders_across_all_servers(self):
        uid = 5922646136

        # Server 1 purchase (₹44)
        self.conn.execute(
            "INSERT INTO orders (user_id, country, year, price, phone, otp, server, date) VALUES (?, 'Russia', 2024, 44, '+79001112233', '12345', 'Server 1', '2026-10-24 10:00:00')",
            (uid,)
        )
        # Server 3 purchase (₹80)
        self.conn.execute(
            "INSERT INTO server3_orders (user_id, server_code, charged_price, status, refunded, created_at) VALUES (?, 'India', 80, 'completed', 0, '2026-10-25 11:00:00')",
            (uid,)
        )
        # Server 4 purchase (₹62)
        self.conn.execute(
            "INSERT INTO server4_orders (user_id, service_code, charged_price, status, refunded, created_at) VALUES (?, 'tg', 62, 'completed', 0, '2026-10-26 12:00:00')",
            (uid,)
        )
        # Server 5 purchase (₹100)
        self.conn.execute(
            "INSERT INTO smm_orders (user_id, link, quantity, charge, status, refunded, created_at) VALUES (?, 'https://t.me/pirobuyers', 1000, 100.0, 'completed', 0, '2026-10-27 13:00:00')",
            (uid,)
        )

        stats = get_user_order_stats(self.conn, uid)
        self.assertEqual(stats["total_orders"], 4)
        self.assertEqual(stats["total_spent"], 44 + 80 + 62 + 100)
        self.assertEqual(stats["server1_2"]["orders"], 1)
        self.assertEqual(stats["server1_2"]["spent"], 44)
        self.assertEqual(stats["server3"]["orders"], 1)
        self.assertEqual(stats["server3"]["spent"], 80)
        self.assertEqual(stats["server4"]["orders"], 1)
        self.assertEqual(stats["server4"]["spent"], 62)
        self.assertEqual(stats["server5"]["orders"], 1)
        self.assertEqual(stats["server5"]["spent"], 100)

    def test_refunded_and_cancelled_orders_excluded(self):
        uid = 9999

        # Valid order (₹50)
        self.conn.execute(
            "INSERT INTO orders (user_id, country, year, price, phone, otp, server, date) VALUES (?, 'USA', 2024, 50, '+1234567890', '99999', 'Server 2', '2026-10-24 10:00:00')",
            (uid,)
        )
        # Cancelled in orders (₹50 - should be ignored)
        self.conn.execute(
            "INSERT INTO orders (user_id, country, year, price, phone, otp, server, date) VALUES (?, 'USA', 2024, 50, '+1234567890', 'CANCELLED', 'Server 2', '2026-10-24 11:00:00')",
            (uid,)
        )
        # Refunded in server3_orders (should be ignored)
        self.conn.execute(
            "INSERT INTO server3_orders (user_id, server_code, charged_price, status, refunded, created_at) VALUES (?, 'India', 40, 'cancelled', 1, '2026-10-25 11:00:00')",
            (uid,)
        )
        # Failed in smm_orders (should be ignored)
        self.conn.execute(
            "INSERT INTO smm_orders (user_id, link, quantity, charge, status, refunded, created_at) VALUES (?, 'https://t.me/pirobuyers', 1000, 50.0, 'failed', 1, '2026-10-27 13:00:00')",
            (uid,)
        )

        stats = get_user_order_stats(self.conn, uid)
        self.assertEqual(stats["total_orders"], 1)
        self.assertEqual(stats["total_spent"], 50)

    def test_miniapp_double_count_prevention(self):
        uid = 8888
        # Mini App writes Server 3 purchase to BOTH server3_orders AND orders:
        self.conn.execute(
            "INSERT INTO server3_orders (user_id, server_code, charged_price, status, refunded, created_at) VALUES (?, 'India', 35, 'waiting', 0, '2026-10-25 11:00:00')",
            (uid,)
        )
        self.conn.execute(
            "INSERT INTO orders (user_id, country, year, price, phone, otp, server, date) VALUES (?, 'India', 2024, 35, '+919999999999', 'WAITING', 'Server 3', '2026-10-25 11:00:00')",
            (uid,)
        )

        stats = get_user_order_stats(self.conn, uid)
        self.assertEqual(stats["total_orders"], 1)
        self.assertEqual(stats["total_spent"], 35)

    def test_unified_user_orders_list(self):
        uid = 7777
        self.conn.execute("INSERT INTO orders (user_id, country, year, price, phone, otp, server, date) VALUES (?, 'Russia', 2024, 44, '+79001112233', '12345', 'Server 1', '2026-10-20 10:00:00')", (uid,))
        self.conn.execute("INSERT INTO server3_orders (user_id, server_code, charged_price, phone, sms_code, status, refunded, created_at) VALUES (?, 'India', 40, '+919876543210', '54321', 'completed', 0, '2026-10-21 12:00:00')", (uid,))
        self.conn.execute("INSERT INTO server4_orders (user_id, service_code, charged_price, phone, sms_code, status, refunded, created_at) VALUES (?, 'tg', 50, '+12025550199', '8888', 'completed', 0, '2026-10-22 14:00:00')", (uid,))
        self.conn.execute("INSERT INTO smm_orders (user_id, link, quantity, charge, status, refunded, created_at) VALUES (?, 'https://t.me/test', 500, 75.0, 'completed', 0, '2026-10-23 16:00:00')", (uid,))

        orders = get_unified_user_orders(self.conn, uid, limit=10)
        self.assertEqual(len(orders), 4)
        servers = [o["server"] for o in orders]
        # Should be ordered descending by date: Server 5 (23rd), Server 4 (22nd), Server 3 (21st), Server 1 (20th)
        self.assertEqual(servers, ["Server 5", "Server 4", "Server 3", "Server 1"])

if __name__ == "__main__":
    unittest.main()
