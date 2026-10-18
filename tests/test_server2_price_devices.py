import unittest
import os
import sqlite3
import jwt
import json
import time
from unittest.mock import AsyncMock, patch, MagicMock

import config
from app import app
from database import migrate, connect, transaction
from services.admin_service import set_auto_price, get_auto_prices, manage_stock_item


class TestServer2PriceAndDevices(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.client = self.app.test_client()
        migrate()
        # Seed master admin and clear stock
        with transaction(immediate=True) as conn:
            conn.execute("DELETE FROM stock")
            conn.execute("DELETE FROM auto_prices")
            conn.execute("DELETE FROM admins")
            conn.execute("INSERT OR REPLACE INTO admins (user_id, p_add_stock, p_manage_stock, p_settings) VALUES (111111, 1, 1, 1)")
            # Add sample stock items
            conn.execute(
                "INSERT OR REPLACE INTO stock (phone, session_file, country_name, country_icon, account_year, price, available) "
                "VALUES ('919999999999', 'sessions/919999999999.session', 'India', '🇮🇳', 2024, 70, 1)"
            )
            conn.execute(
                "INSERT OR REPLACE INTO stock (phone, session_file, country_name, country_icon, account_year, price, available) "
                "VALUES ('918888888888', 'sessions/918888888888.session', 'India', '🇮🇳', 2023, 60, 1)"
            )
        now = int(time.time())
        token_payload = {
            "user_id": 111111,
            "is_admin": True,
            "permissions": {"p_add_stock": 1, "p_manage_stock": 1, "p_settings": 1},
            "iat": now,
            "exp": now + 86400,
        }
        self.token = jwt.encode(token_payload, config.ADMIN_PANEL_SECRET, algorithm="HS256")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "X-User-Id": "111111",
            "Content-Type": "application/json",
        }

    def test_set_auto_price_updates_table_and_existing_stock(self):
        # 1. Update specific year
        res = set_auto_price(country="India", year="2024", price=85, update_existing=True)
        self.assertTrue(res["success"])
        self.assertEqual(res["updated_stock_items"], 1)

        # Check auto_prices table
        auto_prices = get_auto_prices()
        india_2024 = [p for p in auto_prices if p["country"] == "India" and p["year"] == "2024"]
        self.assertEqual(len(india_2024), 1)
        self.assertEqual(india_2024[0]["price"], 85)

        # Check that stock was updated
        with connect() as conn:
            price_2024 = conn.execute("SELECT price FROM stock WHERE phone='919999999999'").fetchone()[0]
            price_2023 = conn.execute("SELECT price FROM stock WHERE phone='918888888888'").fetchone()[0]
            self.assertEqual(price_2024, 85)
            self.assertEqual(price_2023, 60)

        # 2. Update common price
        res_common = set_auto_price(country="India", year="Common", price=95, update_existing=True)
        self.assertTrue(res_common["success"])
        self.assertEqual(res_common["updated_stock_items"], 2)

        with connect() as conn:
            price_2024_after = conn.execute("SELECT price FROM stock WHERE phone='919999999999'").fetchone()[0]
            price_2023_after = conn.execute("SELECT price FROM stock WHERE phone='918888888888'").fetchone()[0]
            self.assertEqual(price_2024_after, 95)
            self.assertEqual(price_2023_after, 95)

    def test_admin_stock_price_api(self):
        # Test POST /api/admin/stock/price
        payload = {"country": "India", "year": "2024", "price": 105, "update_existing": True}
        response = self.client.post("/api/admin/stock/price", headers=self.headers, data=json.dumps(payload))
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("price"), 105)

        # Test GET /api/admin/stock/auto-prices
        get_res = self.client.get("/api/admin/stock/auto-prices", headers=self.headers)
        self.assertEqual(get_res.status_code, 200)
        get_data = get_res.get_json()
        self.assertTrue(get_data.get("success"))
        found = [p for p in get_data.get("auto_prices", []) if p["country"] == "India" and p["year"] == "2024"]
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["price"], 105)

    def test_admin_single_item_price_update(self):
        payload = {"phone": "919999999999", "price": 120}
        response = self.client.post("/api/admin/stock/price", headers=self.headers, data=json.dumps(payload))
        self.assertEqual(response.status_code, 200)
        with connect() as conn:
            price = conn.execute("SELECT price FROM stock WHERE phone='919999999999'").fetchone()[0]
            self.assertEqual(price, 120)


if __name__ == "__main__":
    unittest.main()
