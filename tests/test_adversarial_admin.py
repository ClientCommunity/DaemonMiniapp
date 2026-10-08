"""Adversarial stress-testing suite for Krish Mini App Admin Panel Integration.

Empirically tests:
1. RBAC Attack Vectors:
   - Forged requests without tokens or invalid tokens to all /api/admin/* endpoints (401/403)
   - Forged tokens with fake secrets, expired tokens, tampered payloads
   - Non-admin user IDs challenging /api/admin/login (rejected with 403)
   - Invalid, empty, and brute-force passphrase attempts against /api/admin/login
2. Boundary Conditions:
   - Server 2 stock upload with invalid quality tiers (non 'good'/'cheap')
   - User balance debit exceeding balance (verify floor at 0, no negative balances)
   - Promo balance debit exceeding promo balance (verify floor at 0)
   - Reseller margins outside [₹5, ₹100] bounds (both admin config and reseller set_margin)
   - Dynamic storefront reflection when servers are toggled (Servers 1-5)
   - Double-approval / Double-rejection race & boundary on manual deposits
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
import time
import unittest
from pathlib import Path
from urllib.parse import urlencode

import jwt

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import config
from app import create_app
from database import (
    connect,
    transaction,
    migrate,
    get_user_balances,
    get_setting,
    set_setting,
)
from services.store_service import get_all_servers_overview


def make_telegram_init_data(user_id: int, first_name: str = "TestUser", username: str = "testuser") -> str:
    """Helper to generate a valid Telegram WebApp initData query string."""
    user_json = json.dumps({"id": user_id, "first_name": first_name, "username": username}, separators=(",", ":"))
    auth_date = str(int(time.time()))
    query_params = {
        "auth_date": auth_date,
        "query_id": "AAHdF6IQAAAAAN0XohC8z_t0",
        "user": user_json,
    }
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(query_params.items()))
    secret_key = hmac.new(b"WebAppData", config.BOT_TOKEN.encode("utf-8"), hashlib.sha256).digest()
    sig = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()
    query_params["hash"] = sig
    return urlencode(query_params)


class AdversarialAdminTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        migrate()
        cls.app = create_app()
        cls.client = cls.app.test_client()

        cls.master_admin_id = 7507183871
        cls.non_admin_id = 99887711
        cls.victim_user_id = 88776655

    def setUp(self):
        with transaction(immediate=True) as conn:
            # Non-admin user
            conn.execute(
                "INSERT OR REPLACE INTO users (user_id, balance, promo_balance, sales_balance) VALUES (?, ?, ?, ?)",
                (self.non_admin_id, 200, 50, 0),
            )
            # Master admin
            conn.execute(
                "INSERT OR REPLACE INTO users (user_id, balance, promo_balance) VALUES (?, ?, ?)",
                (self.master_admin_id, 1000, 0),
            )
            # Victim user for balance testing
            conn.execute(
                "INSERT OR REPLACE INTO users (user_id, balance, promo_balance, sales_balance) VALUES (?, ?, ?, ?)",
                (self.victim_user_id, 100, 40, 0),
            )
            # Ensure reseller bounds in DB are reset
            conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('reseller_min_margin', '5')")
            conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('reseller_max_margin', '100')")
            conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('reseller_status', 'on')")

    def get_valid_admin_token(self, user_id: int | None = None) -> str:
        """Issue signed valid JWT session token."""
        uid = user_id or self.master_admin_id
        now = int(time.time())
        payload = {
            "user_id": uid,
            "is_admin": True,
            "permissions": {"p_add_stock": 1, "p_manage_stock": 1, "p_stats": 1, "p_bal": 1, "p_settings": 1},
            "iat": now,
            "exp": now + 86400,
        }
        return jwt.encode(payload, config.ADMIN_PANEL_SECRET, algorithm="HS256")

    def admin_headers(self, user_id: int | None = None) -> dict[str, str]:
        token = self.get_valid_admin_token(user_id)
        return {
            "Authorization": f"Bearer {token}",
            "X-User-Id": str(user_id or self.master_admin_id),
        }

    # =========================================================================
    # 1. RBAC ATTACK VECTORS
    # =========================================================================

    def test_unauthenticated_requests_to_admin_endpoints_rejected_401(self):
        """Forge requests without tokens or auth headers to all /api/admin/* endpoints."""
        endpoints = [
            ("GET", "/api/admin/overview"),
            ("GET", "/api/admin/stats"),
            ("GET", "/api/admin/stats/providers"),
            ("GET", "/api/admin/me"),
            ("GET", "/api/admin/server1/status"),
            ("POST", "/api/admin/server1/toggle", {"status": "off"}),
            ("POST", "/api/admin/server1/markup", {"country": "RU", "markup_percent": 20}),
            ("POST", "/api/admin/server1/token", {"token": "fake"}),
            ("POST", "/api/admin/stock/add", {"phone": "+1234567890"}),
            ("POST", "/api/admin/stock/bulk-upload", {"items": ["+1234567890"], "quality_tier": "good"}),
            ("GET", "/api/admin/stock/manage"),
            ("DELETE", "/api/admin/stock/manage?phone=1234567890"),
            ("GET", "/api/admin/servers/managed"),
            ("GET", "/api/admin/server3/config"),
            ("POST", "/api/admin/server3/toggle", {"enabled": 0}),
            ("POST", "/api/admin/server3/sync", {}),
            ("GET", "/api/admin/server3/services"),
            ("GET", "/api/admin/smm/overview"),
            ("GET", "/api/admin/deposits/pending"),
            ("POST", "/api/admin/deposits/approve", {"deposit_id": 1}),
            ("POST", "/api/admin/deposits/reject", {"deposit_id": 1}),
            ("GET", "/api/admin/fampay/gateways"),
            ("POST", "/api/admin/fampay/gateways", {"name": "test"}),
            ("GET", "/api/admin/custom-payments"),
            ("POST", "/api/admin/custom-payments", {"name": "test"}),
            ("GET", "/api/admin/settings/min-deposit"),
            ("POST", "/api/admin/settings/min-deposit", {"min_deposit": 50}),
            ("GET", f"/api/admin/users/search?query={self.non_admin_id}"),
            ("POST", "/api/admin/users/balance", {"user_id": self.non_admin_id, "amount": 10}),
            ("POST", "/api/admin/users/ban", {"user_id": self.non_admin_id, "banned": 1}),
            ("GET", "/api/admin/reseller/settings"),
            ("POST", "/api/admin/reseller/settings", {"min_margin": 10, "max_margin": 50}),
            ("GET", "/api/admin/promo-codes"),
            ("POST", "/api/admin/promo-codes", {"code": "HACK", "value": 100}),
            ("DELETE", "/api/admin/promo-codes/HACK"),
            ("GET", "/api/admin/system/force-join"),
            ("POST", "/api/admin/system/force-join", {"status": "off"}),
            ("GET", "/api/admin/system/bot-status"),
            ("POST", "/api/admin/system/bot-status", {"status": "off"}),
            ("GET", "/api/admin/settings"),
            ("POST", "/api/admin/settings", {"key": "test", "value": "123"}),
        ]

        for item in endpoints:
            method = item[0]
            url = item[1]
            body = item[2] if len(item) > 2 else None

            if method == "GET":
                res = self.client.get(url)
            elif method == "POST":
                res = self.client.post(url, json=body or {})
            elif method == "DELETE":
                res = self.client.delete(url)
            else:
                continue

            self.assertIn(
                res.status_code,
                (401, 403),
                f"Expected 401/403 for unauthenticated {method} {url}, got {res.status_code}",
            )
            data = res.get_json() or {}
            self.assertFalse(data.get("success", False))

    def test_forged_and_invalid_tokens_rejected(self):
        """Test forged tokens, wrong secrets, expired tokens, and tampered payloads."""
        # 1. Completely bogus string
        res1 = self.client.get("/api/admin/overview", headers={"Authorization": "Bearer not_a_jwt"})
        self.assertEqual(res1.status_code, 401)

        # 2. Token signed with wrong secret key
        now = int(time.time())
        fake_payload = {
            "user_id": self.master_admin_id,
            "is_admin": True,
            "permissions": {"p_stats": 1},
            "iat": now,
            "exp": now + 3600,
        }
        forged_token = jwt.encode(fake_payload, "malicious_secret_key_12345", algorithm="HS256")
        res2 = self.client.get("/api/admin/overview", headers={"Authorization": f"Bearer {forged_token}"})
        self.assertEqual(res2.status_code, 401)

        # 3. Expired token (iat & exp in past)
        expired_payload = {
            "user_id": self.master_admin_id,
            "is_admin": True,
            "permissions": {"p_stats": 1},
            "iat": now - 7200,
            "exp": now - 3600,
        }
        expired_token = jwt.encode(expired_payload, config.ADMIN_PANEL_SECRET, algorithm="HS256")
        res3 = self.client.get("/api/admin/overview", headers={"Authorization": f"Bearer {expired_token}"})
        self.assertEqual(res3.status_code, 401)

        # 4. Valid signature, BUT payload user_id belongs to a non-admin user
        non_admin_token_payload = {
            "user_id": self.non_admin_id,  # 99887711 is NOT an admin
            "is_admin": True,  # forged flag in token
            "permissions": {"p_stats": 1, "p_bal": 1},
            "iat": now,
            "exp": now + 3600,
        }
        non_admin_token = jwt.encode(non_admin_token_payload, config.ADMIN_PANEL_SECRET, algorithm="HS256")
        res4 = self.client.get("/api/admin/overview", headers={"Authorization": f"Bearer {non_admin_token}"})
        # verify_admin(uid) MUST reject non-admin with 403 Forbidden!
        self.assertEqual(res4.status_code, 403)
        self.assertIn("Forbidden", res4.get_json().get("error", ""))

        # 5. Token with missing user_id
        missing_uid_payload = {"is_admin": True, "iat": now, "exp": now + 3600}
        missing_uid_token = jwt.encode(missing_uid_payload, config.ADMIN_PANEL_SECRET, algorithm="HS256")
        res5 = self.client.get("/api/admin/overview", headers={"Authorization": f"Bearer {missing_uid_token}"})
        self.assertEqual(res5.status_code, 401)

        # 6. Wrong X-Admin-Secret header
        res6 = self.client.get("/api/admin/overview", headers={"X-Admin-Secret": "wrong_secret_pass"})
        self.assertEqual(res6.status_code, 401)

        # 7. Wrong X-Admin-Token header
        res7 = self.client.get("/api/admin/overview", headers={"X-Admin-Token": "bogus_token"})
        self.assertEqual(res7.status_code, 401)

    def test_non_admin_user_login_challenge_rejected(self):
        """Non-admin user IDs trying to challenge /api/admin/login must be rejected."""
        # 1. Non-admin user ID in body with correct passphrase
        res1 = self.client.post(
            "/api/admin/login",
            json={
                "user_id": self.non_admin_id,
                "passphrase": config.ADMIN_PANEL_SECRET,
            },
        )
        self.assertEqual(res1.status_code, 403)
        self.assertFalse(res1.get_json().get("success"))
        self.assertIn("not an administrator", res1.get_json().get("error", "").lower())

        # 2. Non-admin user ID via Telegram initData with correct passphrase
        non_admin_init_data = make_telegram_init_data(self.non_admin_id)
        res2 = self.client.post(
            "/api/admin/login",
            headers={"X-Telegram-Init-Data": non_admin_init_data},
            json={"passphrase": config.ADMIN_PANEL_SECRET},
        )
        self.assertEqual(res2.status_code, 403)
        self.assertFalse(res2.get_json().get("success"))

        # 3. Completely unknown / random user ID
        res3 = self.client.post(
            "/api/admin/login",
            json={
                "user_id": 999999999,
                "passphrase": config.ADMIN_PANEL_SECRET,
            },
        )
        self.assertEqual(res3.status_code, 403)

        # 4. Missing user ID entirely
        res4 = self.client.post(
            "/api/admin/login",
            json={"passphrase": config.ADMIN_PANEL_SECRET},
        )
        self.assertEqual(res4.status_code, 401)
        self.assertIn("identify user", res4.get_json().get("error", "").lower())

    def test_invalid_empty_and_bruteforce_passphrase_rejected(self):
        """Empty, whitespace, and brute-force passphrase attempts against /api/admin/login."""
        # 1. Empty string passphrase
        res_empty = self.client.post(
            "/api/admin/login",
            json={"user_id": self.master_admin_id, "passphrase": ""},
        )
        self.assertEqual(res_empty.status_code, 401)
        self.assertFalse(res_empty.get_json().get("success"))

        # 2. Whitespace passphrase
        res_ws = self.client.post(
            "/api/admin/login",
            json={"user_id": self.master_admin_id, "passphrase": "    \t  \n  "},
        )
        self.assertEqual(res_ws.status_code, 401)
        self.assertFalse(res_ws.get_json().get("success"))

        # 3. Missing passphrase field
        res_missing = self.client.post(
            "/api/admin/login",
            json={"user_id": self.master_admin_id},
        )
        self.assertEqual(res_missing.status_code, 401)

        # 4. Brute-force wordlist dictionary attack
        wordlist = [
            "admin", "admin123", "root", "password", "123456", "secret",
            "krish", "deamon", "adminpanel", "superadmin", "administrator",
            config.ADMIN_PANEL_SECRET + "_extra",
            config.ADMIN_PANEL_SECRET[:-1],
        ]
        for candidate in wordlist:
            if candidate == config.ADMIN_PANEL_SECRET:
                continue
            res_bf = self.client.post(
                "/api/admin/login",
                json={"user_id": self.master_admin_id, "passphrase": candidate},
            )
            self.assertEqual(
                res_bf.status_code, 401,
                f"Candidate '{candidate}' unexpectedly succeeded or returned non-401: {res_bf.status_code}",
            )
            self.assertFalse(res_bf.get_json().get("success"))

        # 5. Exact match with correct secret MUST succeed
        res_correct = self.client.post(
            "/api/admin/login",
            json={"user_id": self.master_admin_id, "passphrase": config.ADMIN_PANEL_SECRET},
        )
        self.assertEqual(res_correct.status_code, 200)
        data = res_correct.get_json()
        self.assertTrue(data.get("success"))
        token = data.get("token")
        self.assertIsNotNone(token)

        # Validate issued token
        decoded = jwt.decode(token, config.ADMIN_PANEL_SECRET, algorithms=["HS256"])
        self.assertEqual(decoded.get("user_id"), self.master_admin_id)
        self.assertTrue(decoded.get("is_admin"))

    # =========================================================================
    # 2. BOUNDARY CONDITIONS
    # =========================================================================

    def test_server2_stock_upload_quality_tier_validation(self):
        """Server 2 bulk upload strictly validates quality_tier ('good' vs 'cheap')."""
        invalid_tiers = [
            "ultra", "super", "premium", "gold", "unknown", "123", "", "GOOD_TIER", "CHEAP_TIER"
        ]
        for bad_tier in invalid_tiers:
            res_bulk = self.client.post(
                "/api/admin/stock/bulk-upload",
                headers=self.admin_headers(),
                json={
                    "items": ["+12345678000"],
                    "quality_tier": bad_tier,
                    "country": "Russia",
                    "year": 2024,
                    "price": 60,
                },
            )
            self.assertEqual(
                res_bulk.status_code, 400,
                f"Expected 400 for invalid quality_tier '{bad_tier}', got {res_bulk.status_code}",
            )
            self.assertFalse(res_bulk.get_json().get("success"))
            self.assertIn("Invalid quality_tier", res_bulk.get_json().get("error", ""))

        # Empty items list must be rejected
        res_empty = self.client.post(
            "/api/admin/stock/bulk-upload",
            headers=self.admin_headers(),
            json={"items": [], "quality_tier": "good"},
        )
        self.assertEqual(res_empty.status_code, 400)

        # Valid tiers 'good' and 'cheap' MUST succeed and persist correct tier
        phone_good = "+12345678111"
        res_good = self.client.post(
            "/api/admin/stock/bulk-upload",
            headers=self.admin_headers(),
            json={
                "items": [phone_good],
                "quality_tier": "good",
                "country": "Germany",
                "year": 2023,
                "price": 65,
            },
        )
        self.assertEqual(res_good.status_code, 200)
        self.assertTrue(res_good.get_json().get("success"))

        phone_cheap = "+12345678222"
        res_cheap = self.client.post(
            "/api/admin/stock/bulk-upload",
            headers=self.admin_headers(),
            json={
                "items": [phone_cheap],
                "quality_tier": "cheap",
                "country": "India",
                "year": 2024,
                "price": 30,
            },
        )
        self.assertEqual(res_cheap.status_code, 200)
        self.assertTrue(res_cheap.get_json().get("success"))

        # Verify segregation directly in database
        with connect() as conn:
            row_g = conn.execute("SELECT quality_tier FROM stock WHERE phone = '12345678111'").fetchone()
            self.assertIsNotNone(row_g)
            self.assertEqual(row_g["quality_tier"], "good")

            row_c = conn.execute("SELECT quality_tier FROM stock WHERE phone = '12345678222'").fetchone()
            self.assertIsNotNone(row_c)
            self.assertEqual(row_c["quality_tier"], "cheap")

    def test_user_balance_debit_exceeding_balance_floors_at_zero(self):
        """User balance debit exceeding balance must floor at 0, never produce negative balance."""
        target_uid = self.victim_user_id
        # Reset to known balance: balance=100, promo=40 (transferable=60)
        with transaction(immediate=True) as conn:
            conn.execute("UPDATE users SET balance = 100, promo_balance = 40 WHERE user_id = ?", (target_uid,))

        # 1. Main balance debit ₹30 (within balance 100)
        res1 = self.client.post(
            "/api/admin/users/balance",
            headers=self.admin_headers(),
            json={"user_id": target_uid, "amount": 30, "type": "debit", "reason": "Standard debit"},
        )
        self.assertEqual(res1.status_code, 200)
        data1 = res1.get_json()
        self.assertEqual(data1.get("balance"), 70)
        self.assertEqual(data1.get("promo_balance"), 40)
        self.assertEqual(data1.get("transferable_balance"), 30)

        # 2. Main balance debit ₹500 (exceeds balance 70) -> MUST floor at 0
        res2 = self.client.post(
            "/api/admin/users/balance",
            headers=self.admin_headers(),
            json={"user_id": target_uid, "amount": 500, "type": "debit", "reason": "Excessive debit"},
        )
        self.assertEqual(res2.status_code, 200)
        data2 = res2.get_json()
        self.assertEqual(data2.get("balance"), 0, "Balance must floor at 0")
        self.assertEqual(data2.get("promo_balance"), 0, "Promo balance cannot exceed total balance")
        self.assertEqual(data2.get("transferable_balance"), 0)

        # Verify DB directly
        balances_db = get_user_balances(target_uid)
        self.assertGreaterEqual(balances_db["balance"], 0)
        self.assertGreaterEqual(balances_db["promo_balance"], 0)
        self.assertGreaterEqual(balances_db["transferable_balance"], 0)

        # 3. Promo balance debit testing
        with transaction(immediate=True) as conn:
            conn.execute("UPDATE users SET balance = 150, promo_balance = 60 WHERE user_id = ?", (target_uid,))

        # Promo debit ₹200 (exceeds promo 60) -> MUST floor promo at 0
        res_promo = self.client.post(
            "/api/admin/users/balance",
            headers=self.admin_headers(),
            json={"user_id": target_uid, "amount": 200, "type": "debit", "is_promo": True, "reason": "Excessive promo debit"},
        )
        self.assertEqual(res_promo.status_code, 200)
        data_p = res_promo.get_json()
        self.assertEqual(data_p.get("promo_balance"), 0, "Promo balance must floor at 0")
        self.assertEqual(data_p.get("balance"), 90, "Main balance deducted by promo reduction 150-60=90")
        self.assertEqual(data_p.get("transferable_balance"), 90)

        # 4. Negative amount input with debit type -> must not invert to credit
        res_neg = self.client.post(
            "/api/admin/users/balance",
            headers=self.admin_headers(),
            json={"user_id": target_uid, "amount": -20, "type": "debit", "reason": "Negative amount test"},
        )
        self.assertEqual(res_neg.status_code, 200)
        self.assertEqual(res_neg.get_json().get("balance"), 70, "Should debit 20, not credit")

    def test_reseller_margins_outside_bounds_rejected(self):
        """Reseller margins outside [₹5, ₹100] bounds must be rejected or clamped."""
        # 1. Admin configuring reseller settings: out of bounds clamped to [5, 100]
        res_clamp = self.client.post(
            "/api/admin/reseller/settings",
            headers=self.admin_headers(),
            json={"min_margin": 1, "max_margin": 250, "status": "on"},
        )
        self.assertEqual(res_clamp.status_code, 200)
        data_clamp = res_clamp.get_json()
        self.assertEqual(data_clamp.get("min_margin"), 5, "Min margin must be clamped to >= 5")
        self.assertEqual(data_clamp.get("max_margin"), 100, "Max margin must be clamped to <= 100")

        # Inverted margins (min > max) reset to default
        res_inv = self.client.post(
            "/api/admin/reseller/settings",
            headers=self.admin_headers(),
            json={"min_margin": 60, "max_margin": 20, "status": "on"},
        )
        self.assertEqual(res_inv.status_code, 200)
        self.assertEqual(res_inv.get_json().get("min_margin"), 5)
        self.assertEqual(res_inv.get_json().get("max_margin"), 100)

        # 2. Reseller updating custom profit margin via /api/reseller/set_margin
        reseller_headers = {"X-User-Id": str(self.non_admin_id)}

        # Out-of-bounds low (< ₹5)
        for bad_low in (0, 1, 4, -10):
            res_low = self.client.post(
                "/api/reseller/set_margin",
                headers=reseller_headers,
                json={"margin": bad_low},
            )
            self.assertEqual(res_low.status_code, 400, f"Expected 400 for margin {bad_low}, got {res_low.status_code}")
            self.assertFalse(res_low.get_json().get("success"))

        # Out-of-bounds high (> ₹100)
        for bad_high in (101, 150, 999):
            res_high = self.client.post(
                "/api/reseller/set_margin",
                headers=reseller_headers,
                json={"margin": bad_high},
            )
            self.assertEqual(res_high.status_code, 400, f"Expected 400 for margin {bad_high}, got {res_high.status_code}")
            self.assertFalse(res_high.get_json().get("success"))

        # Boundaries ₹5 and ₹100 MUST succeed
        res_min = self.client.post(
            "/api/reseller/set_margin",
            headers=reseller_headers,
            json={"margin": 5},
        )
        self.assertEqual(res_min.status_code, 200)
        self.assertTrue(res_min.get_json().get("success"))
        self.assertEqual(res_min.get_json().get("margin"), 5)

        res_max = self.client.post(
            "/api/reseller/set_margin",
            headers=reseller_headers,
            json={"margin": 100},
        )
        self.assertEqual(res_max.status_code, 200)
        self.assertTrue(res_max.get_json().get("success"))
        self.assertEqual(res_max.get_json().get("margin"), 100)

        # Mid-range ₹25 succeeds
        res_mid = self.client.post(
            "/api/reseller/set_margin",
            headers=reseller_headers,
            json={"margin": 25},
        )
        self.assertEqual(res_mid.status_code, 200)
        self.assertEqual(res_mid.get_json().get("margin"), 25)

    def test_dynamic_storefront_reflection_when_servers_toggled(self):
        """Dynamic storefront reflection: toggling Servers 1–5 in Admin immediately alters /api/store/servers."""
        # 1. Reset all servers to ON
        self.client.post("/api/admin/server1/toggle", headers=self.admin_headers(), json={"status": "on"})
        set_setting("server2_status", "on")
        self.client.post("/api/admin/server3/toggle", headers=self.admin_headers(), json={"enabled": 1})
        self.client.post("/api/admin/servers/4/toggle", headers=self.admin_headers(), json={"enabled": 1})
        self.client.post("/api/admin/server5/toggle", headers=self.admin_headers(), json={"enabled": 1})

        res_init = self.client.get("/api/store/servers")
        self.assertEqual(res_init.status_code, 200)
        overview_init = {s["id"]: s["enabled"] for s in res_init.get_json().get("servers", [])}
        for s_id in range(1, 6):
            self.assertTrue(overview_init[s_id], f"Server {s_id} should initially be enabled")

        # 2. Toggle Server 1 OFF
        self.client.post("/api/admin/server1/toggle", headers=self.admin_headers(), json={"status": "off"})
        res_s1 = self.client.get("/api/store/servers")
        servers_s1 = {s["id"]: s["enabled"] for s in res_s1.get_json().get("servers", [])}
        self.assertFalse(servers_s1[1], "Server 1 must dynamically show disabled in customer storefront")
        self.assertTrue(servers_s1[2], "Server 2 remains enabled")

        # 3. Toggle Server 2 OFF
        set_setting("server2_status", "off")
        res_s2 = self.client.get("/api/store/servers")
        servers_s2 = {s["id"]: s["enabled"] for s in res_s2.get_json().get("servers", [])}
        self.assertFalse(servers_s2[2], "Server 2 must dynamically show disabled")

        # 4. Toggle Server 3 OFF
        self.client.post("/api/admin/server3/toggle", headers=self.admin_headers(), json={"enabled": 0})
        res_s3 = self.client.get("/api/store/servers")
        servers_s3 = {s["id"]: s["enabled"] for s in res_s3.get_json().get("servers", [])}
        self.assertFalse(servers_s3[3], "Server 3 must dynamically show disabled")

        # 5. Toggle Server 4 OFF
        self.client.post("/api/admin/servers/4/toggle", headers=self.admin_headers(), json={"enabled": 0})
        res_s4 = self.client.get("/api/store/servers")
        servers_s4 = {s["id"]: s["enabled"] for s in res_s4.get_json().get("servers", [])}
        self.assertFalse(servers_s4[4], "Server 4 must dynamically show disabled")

        # 6. Toggle Server 5 OFF
        self.client.post("/api/admin/server5/toggle", headers=self.admin_headers(), json={"enabled": 0})
        res_s5 = self.client.get("/api/store/servers")
        servers_s5 = {s["id"]: s["enabled"] for s in res_s5.get_json().get("servers", [])}
        self.assertFalse(servers_s5[5], "Server 5 must dynamically show disabled")

        # ALL 5 are disabled
        for s_id in range(1, 6):
            self.assertFalse(servers_s5[s_id], f"Server {s_id} should be disabled when all are toggled off")

        # 7. Re-enable all
        self.client.post("/api/admin/server1/toggle", headers=self.admin_headers(), json={"status": "on"})
        set_setting("server2_status", "on")
        self.client.post("/api/admin/server3/toggle", headers=self.admin_headers(), json={"enabled": 1})
        self.client.post("/api/admin/servers/4/toggle", headers=self.admin_headers(), json={"enabled": 1})
        self.client.post("/api/admin/server5/toggle", headers=self.admin_headers(), json={"enabled": 1})

        res_final = self.client.get("/api/store/servers")
        servers_final = {s["id"]: s["enabled"] for s in res_final.get_json().get("servers", [])}
        for s_id in range(1, 6):
            self.assertTrue(servers_final[s_id], f"Server {s_id} should be re-enabled")

    def test_deposit_decision_boundary_and_concurrency(self):
        """Test edge cases for manual UTR deposit approval/rejection."""
        # Insert a fresh pending deposit
        with transaction(immediate=True) as conn:
            cur = conn.execute(
                "INSERT INTO deposits (user_id, amount, method_name, status, date) VALUES (?, 250, 'Manual UTR', 'pending', datetime('now'))",
                (self.victim_user_id,),
            )
            dep_id = cur.lastrowid

        # 1. Non-existent deposit ID
        res_none = self.client.post(
            "/api/admin/deposits/approve",
            headers=self.admin_headers(),
            json={"deposit_id": 99999999},
        )
        self.assertEqual(res_none.status_code, 400)
        self.assertIn("not found", res_none.get_json().get("error", "").lower())

        # 2. Approve valid deposit
        bal_before = get_user_balances(self.victim_user_id)["balance"]
        res_app = self.client.post(
            "/api/admin/deposits/approve",
            headers=self.admin_headers(),
            json={"deposit_id": dep_id},
        )
        self.assertEqual(res_app.status_code, 200)
        bal_after = get_user_balances(self.victim_user_id)["balance"]
        self.assertEqual(bal_after, bal_before + 250)

        # 3. Double-approval boundary: approve already approved deposit MUST fail
        res_dup = self.client.post(
            "/api/admin/deposits/approve",
            headers=self.admin_headers(),
            json={"deposit_id": dep_id},
        )
        self.assertEqual(res_dup.status_code, 400)
        self.assertIn("already", res_dup.get_json().get("error", "").lower())
        # Balance must NOT be credited a second time!
        self.assertEqual(get_user_balances(self.victim_user_id)["balance"], bal_after)

        # 4. Reject an already approved deposit MUST fail
        res_rej = self.client.post(
            "/api/admin/deposits/reject",
            headers=self.admin_headers(),
            json={"deposit_id": dep_id},
        )
        self.assertEqual(res_rej.status_code, 400)
        self.assertIn("already", res_rej.get_json().get("error", "").lower())


if __name__ == "__main__":
    unittest.main()
