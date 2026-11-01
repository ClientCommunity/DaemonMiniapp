import json
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app
from database import managed_connect, migrate
from services.force_join_service import (
    is_force_join_enabled,
    get_force_join_channels,
    check_user_force_join,
    clear_user_membership_cache,
    DEFAULT_CHECK_CHANNELS,
)


class TestForceJoinIntegration(unittest.TestCase):
    def setUp(self):
        migrate()
        self.client = app.test_client()
        with managed_connect() as conn:
            conn.execute("DELETE FROM settings WHERE key IN ('force_join_status', 'force_join_channels')")
            conn.execute("INSERT OR REPLACE INTO users (user_id, balance) VALUES (12345678, 1000)")
            conn.commit()
        clear_user_membership_cache(12345678)

    def tearDown(self):
        with managed_connect() as conn:
            conn.execute("DELETE FROM settings WHERE key IN ('force_join_status', 'force_join_channels')")
            conn.commit()
        clear_user_membership_cache(12345678)

    def test_force_join_status_toggle(self):
        # Default is enabled
        self.assertTrue(is_force_join_enabled())

        with managed_connect() as conn:
            conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('force_join_status', 'off')")
            conn.commit()
        self.assertFalse(is_force_join_enabled())

        with managed_connect() as conn:
            conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('force_join_status', 'on')")
            conn.commit()
        self.assertTrue(is_force_join_enabled())

    def test_dynamic_channels_from_database(self):
        # Default fallback
        defaults = get_force_join_channels()
        self.assertGreaterEqual(len(defaults), 1)
        self.assertEqual(defaults[0]["id"], DEFAULT_CHECK_CHANNELS[0])

        # Admin configures dynamic custom channels
        custom = [
            {"id": "-1009988776655", "url": "https://t.me/CustomChannel", "name": "Custom Updates"},
            {"id": "@MyNewGroup", "url": "https://t.me/MyNewGroup", "name": "Community Chat"},
        ]
        with managed_connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('force_join_channels', ?)",
                (json.dumps(custom),)
            )
            conn.commit()

        channels = get_force_join_channels()
        self.assertEqual(len(channels), 2)
        self.assertEqual(channels[0]["id"], "-1009988776655")
        self.assertEqual(channels[0]["url"], "https://t.me/CustomChannel")
        self.assertEqual(channels[1]["id"], "@MyNewGroup")

    @patch("services.force_join_service.check_channel_member_http")
    def test_api_user_middleware_and_blocked_actions(self, mock_check_member):
        # Simulate user is NOT a member
        mock_check_member.return_value = False
        clear_user_membership_cache(12345678)

        # 1. GET /api/user should indicate force_join_required
        resp = self.client.get("/api/user", headers={"X-User-Id": "12345678"})
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data.get("force_join_required"))
        self.assertGreaterEqual(len(data.get("missing_channels", [])), 1)

        # 2. POST /api/buy must be rejected with 403
        buy_resp = self.client.post("/api/buy", json={"server": 1}, headers={"X-User-Id": "12345678"})
        self.assertEqual(buy_resp.status_code, 403)
        buy_data = buy_resp.get_json()
        self.assertTrue(buy_data.get("force_join_required"))

        # 3. POST /api/transfer must be rejected with 403
        transfer_resp = self.client.post(
            "/api/transfer",
            json={"recipient": "87654321", "amount": 50},
            headers={"X-User-Id": "12345678"}
        )
        self.assertEqual(transfer_resp.status_code, 403)

        # 4. Now simulate user JOINED
        clear_user_membership_cache(12345678)
        mock_check_member.return_value = True

        verify_resp = self.client.post("/api/user/verify_force_join", headers={"X-User-Id": "12345678"})
        self.assertEqual(verify_resp.status_code, 200)
        verify_data = verify_resp.get_json()
        self.assertTrue(verify_data.get("joined"))
        self.assertFalse(verify_data.get("force_join_required"))

        user_resp = self.client.get("/api/user", headers={"X-User-Id": "12345678"})
        self.assertFalse(user_resp.get_json().get("force_join_required"))


if __name__ == "__main__":
    unittest.main()
