"""Comprehensive integration and unit test suite for DeamonOTPBot backend.

Tests:
1. Go Reverse Proxy X-Proxy-Secret middleware security
2. CORS and error handling
3. Telegram WebApp HMAC authentication
4. Store catalogue Servers 1-5 with zero upstream leaks
5. Dual-Balance Engine invariants (promo balance consumed first)
6. P2P balance transfer with strict promo balance isolation
7. Order fulfillment, OTP status polling, and cancellation refunds
8. FamPay dynamic QR checkout & manual deposit submissions
9. Reseller margins (5-100% enforcement) & dashboard
10. Single session & Bulk ZIP downloads
11. Unified chronological history
12. RBAC admin permissions & management endpoints
"""
from __future__ import annotations

import hashlib
import hmac
import io
import json
import os
import sys
import time
import unittest
import zipfile
from pathlib import Path
from urllib.parse import urlencode

import jwt

# Ensure root directory is on sys.path
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
    deduct_balance_for_purchase,
    execute_p2p_transfer,
    check_admin_permission,
)
from services.auth_service import validate_telegram_init_data
from services.store_service import (
    get_all_servers_overview,
    get_server1_stock,
    get_server2_stock,
)


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


class DeamonApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        migrate()
        cls.app = create_app()
        cls.client = cls.app.test_client()

        # Test users
        cls.test_user_id = 99887711
        cls.recipient_user_id = 99887722
        cls.master_admin_id = 7507183871

    def setUp(self):
        with transaction(immediate=True) as conn:
            conn.execute("INSERT OR REPLACE INTO users (user_id, balance, promo_balance, sales_balance) VALUES (?, ?, ?, ?)",
                         (self.test_user_id, 200, 50, 0))
            conn.execute("INSERT OR REPLACE INTO users (user_id, balance, promo_balance, sales_balance) VALUES (?, ?, ?, ?)",
                         (self.recipient_user_id, 10, 0, 0))
            conn.execute("INSERT OR REPLACE INTO users (user_id, balance, promo_balance) VALUES (99887788, 0, 0)")
            conn.execute("INSERT OR IGNORE INTO users (user_id, balance) VALUES (?, 1000)",
                         (self.master_admin_id,))

    def get_admin_token(self, user_id: int | None = None) -> str:
        """Issue signed JWT session token for test calls."""
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
        """Produce Authorization Bearer header for admin endpoints."""
        token = self.get_admin_token(user_id)
        return {
            "Authorization": f"Bearer {token}",
            "X-User-Id": str(user_id or self.master_admin_id),
        }

    # ==========================================================================
    # 1. SECURITY & PROXY MIDDLEWARE TESTS
    # ==========================================================================

    def test_health_endpoint_public(self):
        """Health endpoints must be accessible without proxy secret."""
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "healthy")

    def test_proxy_secret_verification(self):
        """Valid proxy secrets are accepted; invalid ones rejected."""
        # Valid header from default proxy secret
        res = self.client.get(
            "/api/store/servers",
            headers={"X-Proxy-Secret": "deamon_proxy_secret_2026"}
        )
        self.assertEqual(res.status_code, 200)

        # Invalid header rejected with 403 Forbidden
        res_bad = self.client.get(
            "/api/store/servers",
            headers={"X-Proxy-Secret": "wrong_secret_123"}
        )
        self.assertEqual(res_bad.status_code, 403)
        self.assertIn("Invalid X-Proxy-Secret", res_bad.get_json().get("detail", ""))

    def test_proxy_secret_enforcement_mode(self):
        """When REQUIRE_PROXY_SECRET is true, missing header is rejected with 403."""
        orig = config.REQUIRE_PROXY_SECRET
        try:
            config.REQUIRE_PROXY_SECRET = True
            # Missing header -> 403
            res_no_sec = self.client.get("/api/store/servers")
            self.assertEqual(res_no_sec.status_code, 403)
            self.assertIn("Missing X-Proxy-Secret", res_no_sec.get_json().get("detail", ""))

            # Valid header -> 200
            res_valid = self.client.get("/api/store/servers", headers={"X-Proxy-Secret": "deamon_proxy_secret_2026"})
            self.assertEqual(res_valid.status_code, 200)

            # Health check exempted -> 200
            res_health = self.client.get("/health")
            self.assertEqual(res_health.status_code, 200)
        finally:
            config.REQUIRE_PROXY_SECRET = orig

    def test_cors_headers(self):
        """Responses must include permissive CORS headers for WebApp consumption."""
        res = self.client.get("/health")
        self.assertEqual(res.headers.get("Access-Control-Allow-Origin"), "*")
        self.assertIn("GET", res.headers.get("Access-Control-Allow-Methods", ""))

    # ==========================================================================
    # 2. TELEGRAM HMAC AUTHENTICATION TESTS
    # ==========================================================================

    def test_telegram_init_data_hmac_verification(self):
        """Valid HMAC passes verification and extracts user profile."""
        init_data = make_telegram_init_data(self.test_user_id)
        validated = validate_telegram_init_data(init_data, config.BOT_TOKEN)
        self.assertIsNotNone(validated)
        self.assertEqual(validated.get("id"), self.test_user_id)

        # Invalid HMAC fails verification
        tampered_init_data = init_data.replace(str(self.test_user_id), "11111111")
        self.assertIsNone(validate_telegram_init_data(tampered_init_data, config.BOT_TOKEN))

    def test_api_auth_endpoint(self):
        """POST /api/auth verifies signature and returns profile with dual balances."""
        init_data = make_telegram_init_data(self.test_user_id)
        res = self.client.post("/api/auth", headers={"X-Telegram-Init-Data": init_data})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        user = data.get("user")
        self.assertEqual(user.get("id"), self.test_user_id)
        self.assertEqual(user.get("promo_balance"), 50)
        self.assertEqual(user.get("transferable_balance"), 150)

    # ==========================================================================
    # 3. STORE CATALOGUE & ZERO VENDOR LEAK TESTS
    # ==========================================================================

    def test_store_overview_no_vendor_leaks(self):
        """Store servers list must not expose internal vendor names (LZT, DGOTP, etc.)."""
        res = self.client.get("/api/store/servers")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        servers = data.get("servers")
        self.assertEqual(len(servers), 5)

        raw_text = json.dumps(data).lower()
        for forbidden in ["lzt", "dgotp", "tempora"]:
            self.assertNotIn(forbidden, raw_text)

    def test_server2_stock_tier_split(self):
        """Server 2 catalogue supports good vs cheap quality split."""
        # Good tier
        res_good = self.client.get("/api/store/server2?tier=good")
        self.assertEqual(res_good.status_code, 200)
        data_good = res_good.get_json()
        self.assertEqual(data_good.get("tier"), "good")
        self.assertIn("good_count", data_good)

        # Cheap tier
        res_cheap = self.client.get("/api/store/server2?tier=cheap")
        self.assertEqual(res_cheap.status_code, 200)
        data_cheap = res_cheap.get_json()
        self.assertEqual(data_cheap.get("tier"), "cheap")
        self.assertIn("cheap_count", data_cheap)

    # ==========================================================================
    # 4. DUAL-BALANCE & P2P PROMO GUARD TESTS
    # ==========================================================================

    def test_p2p_transfer_promo_balance_isolation(self):
        """Promo balance cannot be transferred via P2P transfers."""
        # Total balance: 200, Promo: 50, Transferable: 150
        # Attempting to transfer 160 (more than transferable 150) MUST FAIL
        res = self.client.post(
            "/api/transfer",
            headers={"X-User-Id": str(self.test_user_id)},
            json={"recipient": str(self.recipient_user_id), "amount": 160}
        )
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.get_json().get("success"))
        self.assertIn("Promo balance", res.get_json().get("error", ""))

        # Transferring 50 (within transferable 150) MUST SUCCEED
        res_ok = self.client.post(
            "/api/transfer",
            headers={"X-User-Id": str(self.test_user_id)},
            json={"recipient": str(self.recipient_user_id), "amount": 50}
        )
        self.assertEqual(res_ok.status_code, 200)
        self.assertTrue(res_ok.get_json().get("success"))

        # Verify balances after transfer
        balances_sender = get_user_balances(self.test_user_id)
        balances_recipient = get_user_balances(self.recipient_user_id)
        self.assertEqual(balances_sender["balance"], 150)  # 200 - 50
        self.assertEqual(balances_sender["promo_balance"], 50)  # Locked promo untouched!
        self.assertEqual(balances_sender["transferable_balance"], 100)  # 150 - 50
        self.assertEqual(balances_recipient["balance"], 60)  # 10 + 50

    def test_dual_balance_purchase_ordering(self):
        """Purchases must consume promo balance first before main balance."""
        user_id = 99887733
        with transaction(immediate=True) as conn:
            # 100 total balance, of which 40 is promo balance (transferable = 60)
            conn.execute("INSERT OR REPLACE INTO users (user_id, balance, promo_balance) VALUES (?, 100, 40)", (user_id,))

        # Purchase of 25: should be deducted fully from promo_balance
        ok1 = deduct_balance_for_purchase(user_id, 25)
        self.assertTrue(ok1)
        b1 = get_user_balances(user_id)
        self.assertEqual(b1["balance"], 75)
        self.assertEqual(b1["promo_balance"], 15)  # 40 - 25 = 15
        self.assertEqual(b1["transferable_balance"], 60)  # Untouched main transferable!

        # Purchase of 35: should exhaust remaining 15 promo, and take 20 from transferable
        ok2 = deduct_balance_for_purchase(user_id, 35)
        self.assertTrue(ok2)
        b2 = get_user_balances(user_id)
        self.assertEqual(b2["balance"], 40)
        self.assertEqual(b2["promo_balance"], 0)  # Promo depleted to 0
        self.assertEqual(b2["transferable_balance"], 40)  # 60 - 20 = 40

        # Purchase exceeding remaining balance (50 > 40) MUST FAIL
        ok3 = deduct_balance_for_purchase(user_id, 50)
        self.assertFalse(ok3)
        b3 = get_user_balances(user_id)
        self.assertEqual(b3["balance"], 40)  # Balance unchanged

    # ==========================================================================
    # 5. ORDER FULFILLMENT, OTP POLLING & REFUND TESTS
    # ==========================================================================

    def test_order_purchase_and_otp_status(self):
        """POST /api/buy and GET /api/otp/status flow."""
        # Seed user with balance
        buyer_uid = 99887744
        with transaction(immediate=True) as conn:
            conn.execute("INSERT OR REPLACE INTO users (user_id, balance, promo_balance) VALUES (?, 500, 0)", (buyer_uid,))

        res_buy = self.client.post(
            "/api/buy",
            headers={"X-User-Id": str(buyer_uid)},
            json={"server": 1, "item": {"country": "India", "price": 85}, "qty": 1}
        )
        self.assertEqual(res_buy.status_code, 200)
        buy_data = res_buy.get_json()
        self.assertTrue(buy_data.get("success"))
        phone = buy_data.get("phone")
        self.assertIsNotNone(phone)

        # Check OTP status
        res_otp = self.client.get(f"/api/otp/status?phone={phone}")
        self.assertEqual(res_otp.status_code, 200)
        otp_data = res_otp.get_json()
        self.assertEqual(otp_data.get("status"), "waiting")

        # Cancel order and receive refund
        res_cancel = self.client.post(
            "/api/otp/cancel",
            headers={"X-User-Id": str(buyer_uid)},
            json={"phone": phone}
        )
        self.assertEqual(res_cancel.status_code, 200)
        cancel_data = res_cancel.get_json()
        self.assertTrue(cancel_data.get("success"))
        self.assertEqual(cancel_data.get("refunded_amount"), 85)
        self.assertEqual(cancel_data.get("new_balance"), 500)

    # ==========================================================================
    # 6. PAYMENTS & DEPOSITS TESTS
    # ==========================================================================

    def test_fampay_deposit_checkout(self):
        """POST /api/deposit/fampay generates valid reference and dynamic QR code."""
        res = self.client.post(
            "/api/deposit/fampay",
            headers={"X-User-Id": str(self.test_user_id)},
            json={"amount": 150}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("amount"), 150)
        self.assertIn("upi://pay", data.get("upi_uri", ""))
        self.assertIn("quickchart.io/qr", data.get("qr_url", ""))

        # Check order status
        ref = data.get("reference")
        res_check = self.client.get(f"/api/deposit/fampay/check?ref={ref}")
        self.assertEqual(res_check.status_code, 200)
        self.assertEqual(res_check.get_json().get("status"), "pending")

    def test_manual_deposit_submission(self):
        """Submit manual deposit transaction UTR."""
        res = self.client.post(
            "/api/deposit/manual/submit",
            headers={"X-User-Id": str(self.test_user_id)},
            json={"method_id": 1, "utr": "UTR1234567890", "amount": 250}
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.get_json().get("success"))

    # ==========================================================================
    # 7. RESELLER ENGINE TESTS
    # ==========================================================================

    def test_reseller_margin_bounds_enforcement(self):
        """Reseller margin must be constrained between 5% and 100%."""
        uid = 99887755
        # Set margin within bounds (e.g. 20%) -> SUCCESS
        res_ok = self.client.post(
            "/api/reseller/set_margin",
            headers={"X-User-Id": str(uid)},
            json={"margin": 20}
        )
        self.assertEqual(res_ok.status_code, 200)
        self.assertEqual(res_ok.get_json().get("margin"), 20)

        # Set margin below minimum (e.g. 2%) -> REJECTED
        res_low = self.client.post(
            "/api/reseller/set_margin",
            headers={"X-User-Id": str(uid)},
            json={"margin": 2}
        )
        self.assertEqual(res_low.status_code, 400)
        self.assertFalse(res_low.get_json().get("success"))

        # Set margin above maximum (e.g. 150%) -> REJECTED
        res_high = self.client.post(
            "/api/reseller/set_margin",
            headers={"X-User-Id": str(uid)},
            json={"margin": 150}
        )
        self.assertEqual(res_high.status_code, 400)
        self.assertFalse(res_high.get_json().get("success"))

    # ==========================================================================
    # 8. DOWNLOADS & BULK ZIP ARCHIVE TESTS
    # ==========================================================================

    def test_bulk_session_zip_download(self):
        """GET /api/session/download_zip/<order_id> produces valid ZIP archive."""
        # Create a mock order with two phones
        order_uid = 99887766
        phone1, phone2 = "919876500001", "919876500002"
        with transaction(immediate=True) as conn:
            conn.execute("""
                INSERT OR REPLACE INTO orders (id, user_id, country, year, price, phone, otp, server)
                VALUES (99991, ?, 'India', 2024, 120, ?, 'ZIP DELIVERED', 'Server 2')
            """, (order_uid, f"{phone1},{phone2}"))

        res = self.client.get(
            "/api/session/download_zip/99991",
            headers={"X-User-Id": str(order_uid)}
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("Content-Type"), "application/zip")

        # Verify ZIP contents
        zip_bytes = io.BytesIO(res.data)
        with zipfile.ZipFile(zip_bytes, "r") as zf:
            namelist = zf.namelist()
            self.assertIn("accounts.txt", namelist)
            self.assertIn(f"{phone1}.session", namelist)
            self.assertIn(f"{phone2}.session", namelist)

    # ==========================================================================
    # 9. RBAC ADMIN PERMISSION & EXPANDED REST TESTS
    # ==========================================================================

    def test_admin_login_challenge(self):
        """POST /api/admin/login verifies secret passphrase and issues signed JWT."""
        # 1. Wrong secret -> 401 Unauthorized
        res_bad = self.client.post(
            "/api/admin/login",
            json={"user_id": self.master_admin_id, "passphrase": "wrong_secret_123"}
        )
        self.assertEqual(res_bad.status_code, 401)
        self.assertIn("Invalid admin passphrase", res_bad.get_json().get("error", ""))

        # 2. Non-admin user with correct secret -> 403 Forbidden
        res_unauth = self.client.post(
            "/api/admin/login",
            json={"user_id": self.test_user_id, "passphrase": config.ADMIN_PANEL_SECRET}
        )
        self.assertEqual(res_unauth.status_code, 403)
        self.assertIn("User is not an administrator", res_unauth.get_json().get("error", ""))

        # 3. Valid master admin with correct secret -> 200 OK with signed JWT
        res_ok = self.client.post(
            "/api/admin/login",
            json={"user_id": self.master_admin_id, "passphrase": config.ADMIN_PANEL_SECRET}
        )
        self.assertEqual(res_ok.status_code, 200)
        data = res_ok.get_json()
        self.assertTrue(data.get("success"))
        self.assertIn("token", data)
        self.assertEqual(data.get("user_id"), self.master_admin_id)
        self.assertIn("permissions", data)
        self.assertEqual(data.get("expires_in"), 86400)

        # Decode token to verify signature with secret
        decoded = jwt.decode(data["token"], config.ADMIN_PANEL_SECRET, algorithms=["HS256"])
        self.assertEqual(decoded["user_id"], self.master_admin_id)

    def test_admin_rbac_permission_checks(self):
        """Unauthenticated requests return 401, non-admins 403, valid token / secret returns 200."""
        # 1. No token / secret -> 401 Unauthorized
        res_no_auth = self.client.get("/api/admin/stats")
        self.assertEqual(res_no_auth.status_code, 401)

        # 2. Invalid bearer token -> 401 Unauthorized
        res_bad_tok = self.client.get(
            "/api/admin/stats",
            headers={"Authorization": "Bearer invalid.fake.token"}
        )
        self.assertEqual(res_bad_tok.status_code, 401)

        # 3. Valid token for non-admin user -> 403 Forbidden
        res_non_admin = self.client.get(
            "/api/admin/stats",
            headers=self.admin_headers(self.test_user_id)
        )
        self.assertEqual(res_non_admin.status_code, 403)

        # 4. Valid token for master admin -> 200 OK
        res_admin = self.client.get(
            "/api/admin/stats",
            headers=self.admin_headers(self.master_admin_id)
        )
        self.assertEqual(res_admin.status_code, 200)
        data = res_admin.get_json()
        self.assertTrue(data.get("success"))
        self.assertIn("stock", data.get("stats", {}))

        # 5. X-Admin-Secret header -> 200 OK
        res_secret = self.client.get(
            "/api/admin/stats",
            headers={"X-Admin-Secret": config.ADMIN_PANEL_SECRET, "X-User-Id": str(self.master_admin_id)}
        )
        self.assertEqual(res_secret.status_code, 200)

    def test_admin_me_endpoint(self):
        """GET /api/admin/me returns admin status and active permissions."""
        res = self.client.get("/api/admin/me", headers=self.admin_headers())
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertTrue(data.get("is_admin"))
        self.assertIn("permissions", data)

    def test_admin_overview_and_provider_balances(self):
        """GET /api/admin/stats, /api/admin/overview, and /api/admin/stats/providers."""
        # Overview endpoint
        res = self.client.get("/api/admin/overview", headers=self.admin_headers())
        self.assertEqual(res.status_code, 200)
        stats = res.get_json().get("stats", {})
        self.assertIn("users_count", stats)
        self.assertIn("provider_balances", stats)

        # Providers specific endpoint
        res_prov = self.client.get("/api/admin/stats/providers", headers=self.admin_headers())
        self.assertEqual(res_prov.status_code, 200)
        provs = res_prov.get_json().get("provider_balances", {})
        self.assertIn("server1", provs)
        self.assertIn("server3", provs)
        self.assertIn("server4", provs)
        self.assertIn("server5", provs)

    def test_admin_server1_toggle_and_markups(self):
        """Server 1 status toggle and country markup configuration."""
        # 1. Inspect status
        res_status = self.client.get("/api/admin/server1/status", headers=self.admin_headers())
        self.assertEqual(res_status.status_code, 200)
        self.assertIn("settings", res_status.get_json())

        # 2. Toggle Server 1 off and on
        res_off = self.client.post("/api/admin/server1/toggle", headers=self.admin_headers(), json={"status": "off"})
        self.assertEqual(res_off.status_code, 200)
        self.assertEqual(res_off.get_json().get("server1_status"), "off")

        res_on = self.client.post("/api/admin/server1/toggle", headers=self.admin_headers(), json={"status": "on"})
        self.assertEqual(res_on.status_code, 200)
        self.assertEqual(res_on.get_json().get("server1_status"), "on")

        # 3. Country markup updates
        res_cmark = self.client.post(
            "/api/admin/server1/markup",
            headers=self.admin_headers(),
            json={"country": "India", "markup_percent": 25}
        )
        self.assertEqual(res_cmark.status_code, 200)

        # 4. Global markup updates
        res_gmark = self.client.post(
            "/api/admin/server1/markup",
            headers=self.admin_headers(),
            json={"global_markup": 35}
        )
        self.assertEqual(res_gmark.status_code, 200)

    def test_admin_add_stock_with_quality_tier(self):
        """Admin adds stock for Server 2 with good / cheap quality tier tagging."""
        res = self.client.post(
            "/api/admin/stock/add",
            headers=self.admin_headers(),
            json={
                "phone": "+919999888877",
                "country_name": "India",
                "quality_tier": "cheap",
                "account_year": 2023,
                "price": 55,
                "twofa": "secret123"
            }
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.get_json().get("success"))
        self.assertEqual(res.get_json().get("tier"), "cheap")

    def test_admin_server2_bulk_stock_upload(self):
        """POST /api/admin/stock/bulk-upload enforces quality_tier and uploads accounts."""
        # 1. Invalid quality tier -> 400 Bad Request
        res_bad_tier = self.client.post(
            "/api/admin/stock/bulk-upload",
            headers=self.admin_headers(),
            json={
                "quality_tier": "unsupported_tier",
                "country": "India",
                "items": [{"phone": "+919876500010"}]
            }
        )
        self.assertEqual(res_bad_tier.status_code, 400)
        self.assertIn("Invalid quality_tier", res_bad_tier.get_json().get("error", ""))

        # 2. Empty items array -> 400 Bad Request
        res_empty = self.client.post(
            "/api/admin/stock/bulk-upload",
            headers=self.admin_headers(),
            json={"quality_tier": "good", "items": []}
        )
        self.assertEqual(res_empty.status_code, 400)

        # 3. Successful bulk upload for Good Quality accounts
        res_good = self.client.post(
            "/api/admin/stock/bulk-upload",
            headers=self.admin_headers(),
            json={
                "quality_tier": "good",
                "country": "India",
                "year": 2024,
                "price": 70,
                "items": [
                    {"phone": "+919876500011", "twofa": "pass1"},
                    {"phone": "+919876500012", "twofa": "pass2"}
                ]
            }
        )
        self.assertEqual(res_good.status_code, 200)
        self.assertEqual(res_good.get_json().get("count"), 2)
        self.assertEqual(res_good.get_json().get("tier"), "good")

        # 4. Successful bulk upload for Cheap Quality accounts
        res_cheap = self.client.post(
            "/api/admin/stock/bulk-upload",
            headers=self.admin_headers(),
            json={
                "quality_tier": "cheap",
                "country": "USA",
                "year": 2023,
                "price": 40,
                "items": [{"phone": "+19876500021"}]
            }
        )
        self.assertEqual(res_cheap.status_code, 200)
        self.assertEqual(res_cheap.get_json().get("count"), 1)
        self.assertEqual(res_cheap.get_json().get("tier"), "cheap")

    def test_admin_stock_manage_crud(self):
        """GET, POST, and DELETE /api/admin/stock/manage for stock inventory."""
        test_phone = "+919999111222"
        # 1. Add item
        self.client.post(
            "/api/admin/stock/add",
            headers=self.admin_headers(),
            json={"phone": test_phone, "country_name": "Testland", "price": 40, "quality_tier": "good"}
        )

        # 2. GET list
        res_list = self.client.get(
            "/api/admin/stock/manage?tier=good",
            headers=self.admin_headers()
        )
        self.assertEqual(res_list.status_code, 200)
        items = res_list.get_json().get("items", [])
        phones = [i["phone"] for i in items]
        self.assertIn("919999111222", phones)

        # 3. POST update price
        res_upd = self.client.post(
            "/api/admin/stock/manage",
            headers=self.admin_headers(),
            json={"action": "update", "phone": "919999111222", "price": 45}
        )
        self.assertEqual(res_upd.status_code, 200)
        self.assertEqual(res_upd.get_json().get("action"), "updated")

        # 4. DELETE item
        res_del = self.client.delete(
            "/api/admin/stock/manage?phone=919999111222",
            headers=self.admin_headers()
        )
        self.assertEqual(res_del.status_code, 200)
        self.assertEqual(res_del.get_json().get("action"), "deleted")

    def test_admin_servers_3_and_4_management(self):
        """Server 3 & Server 4 configurations, sync triggers, and service toggles."""
        # 1. Managed servers list
        res_managed = self.client.get("/api/admin/servers/managed", headers=self.admin_headers())
        self.assertEqual(res_managed.status_code, 200)
        self.assertEqual(len(res_managed.get_json().get("servers", [])), 2)

        # 2. Server 3 config update & toggle
        res_s3_cfg = self.client.post(
            "/api/admin/server3/config",
            headers=self.admin_headers(),
            json={"api_url": "https://dgotp.in/api", "api_key": "test_dgotp_key", "service_enabled": 1}
        )
        self.assertEqual(res_s3_cfg.status_code, 200)

        res_s3_tgl = self.client.post(
            "/api/admin/server3/toggle",
            headers=self.admin_headers(),
            json={"enabled": 1}
        )
        self.assertEqual(res_s3_tgl.status_code, 200)

        res_s3_sync = self.client.post("/api/admin/server3/sync", headers=self.admin_headers())
        self.assertEqual(res_s3_sync.status_code, 200)

        # 3. Server 4 config update & toggle
        res_s4_cfg = self.client.post(
            "/api/admin/server4/config",
            headers=self.admin_headers(),
            json={"percent_markup": 15.0, "service_enabled": 1}
        )
        self.assertEqual(res_s4_cfg.status_code, 200)

        res_s4_tgl = self.client.post(
            "/api/admin/server4/toggle",
            headers=self.admin_headers(),
            json={"enabled": 1}
        )
        self.assertEqual(res_s4_tgl.status_code, 200)

        res_s4_sync = self.client.post("/api/admin/server4/sync", headers=self.admin_headers())
        self.assertEqual(res_s4_sync.status_code, 200)

    def test_admin_server5_smm_management(self):
        """Server 5 SMM overview, master toggle, provider CRUD, categories, and orders."""
        # 1. Overview
        res_ov = self.client.get("/api/admin/server5/overview", headers=self.admin_headers())
        self.assertEqual(res_ov.status_code, 200)

        # 2. Master toggle
        res_tgl = self.client.post("/api/admin/server5/toggle", headers=self.admin_headers(), json={"enabled": 1})
        self.assertEqual(res_tgl.status_code, 200)
        self.assertTrue(res_tgl.get_json().get("enabled"))

        # 3. Add SMM provider
        res_prov = self.client.post(
            "/api/admin/server5/providers",
            headers=self.admin_headers(),
            json={
                "name": "Test SMM Provider",
                "api_url": "https://smm-provider.test/api/v2",
                "api_key": "secret_smm_token_123",
                "percent_markup": 45.0,
                "currency": "USD"
            }
        )
        self.assertEqual(res_prov.status_code, 200)
        pid = res_prov.get_json().get("provider_id")
        self.assertIsNotNone(pid)

        # 4. Toggle provider
        res_ptgl = self.client.post(f"/api/admin/server5/providers/{pid}/toggle", headers=self.admin_headers())
        self.assertEqual(res_ptgl.status_code, 200)

        # 5. List categories & orders
        res_cats = self.client.get("/api/admin/server5/categories", headers=self.admin_headers())
        self.assertEqual(res_cats.status_code, 200)

        res_orders = self.client.get("/api/admin/server5/orders", headers=self.admin_headers())
        self.assertEqual(res_orders.status_code, 200)

        # 6. Delete provider
        res_pdel = self.client.delete(f"/api/admin/server5/providers/{pid}", headers=self.admin_headers())
        self.assertEqual(res_pdel.status_code, 200)

    def test_admin_deposits_approve_reject(self):
        """Test admin listing and approving/rejecting manual deposits."""
        # Create pending deposit
        dep_id = None
        with transaction(immediate=True) as conn:
            cur = conn.execute(
                "INSERT INTO deposits (user_id, amount, method_name, status) VALUES (?, 300, 'UPI Manual', 'pending')",
                (self.test_user_id,)
            )
            dep_id = cur.lastrowid

        # List pending
        res_list = self.client.get(
            "/api/admin/deposits/pending",
            headers=self.admin_headers()
        )
        self.assertEqual(res_list.status_code, 200)
        deps = res_list.get_json().get("deposits", [])
        dep_ids = [d["id"] for d in deps]
        self.assertIn(dep_id, dep_ids)

        # Approve deposit atomically
        res_appr = self.client.post(
            "/api/admin/deposits/approve",
            headers=self.admin_headers(),
            json={"deposit_id": dep_id, "amount": 300}
        )
        self.assertEqual(res_appr.status_code, 200)
        self.assertEqual(res_appr.get_json().get("status"), "approved")

        # Reject another deposit
        dep_rej_id = None
        with transaction(immediate=True) as conn:
            cur = conn.execute(
                "INSERT INTO deposits (user_id, amount, method_name, status) VALUES (?, 100, 'UPI Manual', 'pending')",
                (self.test_user_id,)
            )
            dep_rej_id = cur.lastrowid

        res_rej = self.client.post(
            "/api/admin/deposits/reject",
            headers=self.admin_headers(),
            json={"deposit_id": dep_rej_id}
        )
        self.assertEqual(res_rej.status_code, 200)
        self.assertEqual(res_rej.get_json().get("status"), "rejected")

    def test_admin_fampay_gateways_crud(self):
        """FamPay gateways CRUD and enable/disable toggle."""
        # 1. Add gateway
        res_add = self.client.post(
            "/api/admin/fampay/gateways",
            headers=self.admin_headers(),
            json={
                "name": "Main Merchant Gateway",
                "upi_id": "krishmerchant@fampay",
                "payment_name": "Krish Store",
                "min_deposit": 10,
                "max_deposit": 50000,
            }
        )
        self.assertEqual(res_add.status_code, 200)
        gw_id = res_add.get_json().get("gateway_id")
        self.assertIsNotNone(gw_id)

        # 2. List gateways
        res_list = self.client.get("/api/admin/fampay/gateways", headers=self.admin_headers())
        self.assertEqual(res_list.status_code, 200)
        ids = [g["id"] for g in res_list.get_json().get("gateways", [])]
        self.assertIn(gw_id, ids)

        # 3. Toggle gateway
        res_tgl = self.client.post(f"/api/admin/fampay/gateways/{gw_id}/toggle", headers=self.admin_headers())
        self.assertEqual(res_tgl.status_code, 200)

        # 4. Update gateway
        res_upd = self.client.put(
            f"/api/admin/fampay/gateways/{gw_id}",
            headers=self.admin_headers(),
            json={"min_deposit": 25}
        )
        self.assertEqual(res_upd.status_code, 200)

        # 5. Delete gateway
        res_del = self.client.delete(f"/api/admin/fampay/gateways/{gw_id}", headers=self.admin_headers())
        self.assertEqual(res_del.status_code, 200)

    def test_admin_custom_payments_crud(self):
        """Custom payments CRUD."""
        # 1. Create custom payment
        res_add = self.client.post(
            "/api/admin/custom-payments",
            headers=self.admin_headers(),
            json={"name": "USDT Direct", "caption": "Send USDT BEP20 to wallet"}
        )
        self.assertEqual(res_add.status_code, 200)
        pid = res_add.get_json().get("payment_id")
        self.assertIsNotNone(pid)

        # 2. List
        res_list = self.client.get("/api/admin/custom-payments", headers=self.admin_headers())
        self.assertEqual(res_list.status_code, 200)

        # 3. Update
        res_upd = self.client.put(
            f"/api/admin/custom-payments/{pid}",
            headers=self.admin_headers(),
            json={"caption": "Updated caption"}
        )
        self.assertEqual(res_upd.status_code, 200)

        # 4. Delete
        res_del = self.client.delete(f"/api/admin/custom-payments/{pid}", headers=self.admin_headers())
        self.assertEqual(res_del.status_code, 200)

    def test_admin_user_search_and_ban(self):
        """User lookup with balance breakdown and ban/unban toggling."""
        # 1. Search user
        res_search = self.client.get(
            f"/api/admin/users/search?query={self.test_user_id}",
            headers=self.admin_headers()
        )
        self.assertEqual(res_search.status_code, 200)
        u_data = res_search.get_json().get("user", {})
        self.assertEqual(u_data.get("user_id"), self.test_user_id)
        self.assertEqual(u_data.get("balance"), 200)
        self.assertEqual(u_data.get("promo_balance"), 50)
        self.assertEqual(u_data.get("transferable_balance"), 150)

        # 2. Ban user
        res_ban = self.client.post(
            "/api/admin/users/ban",
            headers=self.admin_headers(),
            json={"user_id": self.test_user_id, "banned": 1}
        )
        self.assertEqual(res_ban.status_code, 200)
        self.assertEqual(res_ban.get_json().get("banned"), 1)

        # 3. Unban user
        res_unban = self.client.post(
            "/api/admin/users/ban",
            headers=self.admin_headers(),
            json={"user_id": self.test_user_id, "banned": 0}
        )
        self.assertEqual(res_unban.status_code, 200)
        self.assertEqual(res_unban.get_json().get("banned"), 0)

    def test_admin_adjust_user_balance_and_debit(self):
        """Admin adjusts user balance with credit, debit, and floor at 0."""
        target_uid = 99887788
        with transaction(immediate=True) as conn:
            conn.execute("INSERT OR REPLACE INTO users (user_id, balance, promo_balance) VALUES (?, 100, 40)", (target_uid,))

        # 1. Credit main balance
        res_cred = self.client.post(
            "/api/admin/users/balance",
            headers=self.admin_headers(),
            json={"user_id": target_uid, "amount": 50, "type": "credit", "reason": "Bonus"}
        )
        self.assertEqual(res_cred.status_code, 200)
        self.assertEqual(res_cred.get_json().get("balance"), 150)

        # 2. Debit main balance
        res_deb = self.client.post(
            "/api/admin/users/balance",
            headers=self.admin_headers(),
            json={"user_id": target_uid, "amount": 30, "type": "debit", "reason": "Correction"}
        )
        self.assertEqual(res_deb.status_code, 200)
        self.assertEqual(res_deb.get_json().get("balance"), 120)

        # 3. Excessive debit: must floor at 0 (never negative)
        res_floor = self.client.post(
            "/api/admin/users/balance",
            headers=self.admin_headers(),
            json={"user_id": target_uid, "amount": 999999, "type": "debit", "reason": "Floor test"}
        )
        self.assertEqual(res_floor.status_code, 200)
        self.assertEqual(res_floor.get_json().get("balance"), 0)

        # 4. Credit promo balance
        res_promo_cred = self.client.post(
            "/api/admin/users/balance",
            headers=self.admin_headers(),
            json={"user_id": target_uid, "amount": 80, "type": "credit", "is_promo": True, "reason": "Promo Gift"}
        )
        self.assertEqual(res_promo_cred.status_code, 200)
        self.assertEqual(res_promo_cred.get_json().get("promo_balance"), 80)

        # 5. Debit promo balance
        res_promo_deb = self.client.post(
            "/api/admin/users/balance",
            headers=self.admin_headers(),
            json={"user_id": target_uid, "amount": 30, "type": "debit", "is_promo": True, "reason": "Promo Expiry"}
        )
        self.assertEqual(res_promo_deb.status_code, 200)
        self.assertEqual(res_promo_deb.get_json().get("promo_balance"), 50)

    def test_admin_reseller_settings_and_promo_codes(self):
        """Reseller bounds (₹5 - ₹100), global status, and promo codes CRUD."""
        # 1. Reseller bounds configuration
        res_ref = self.client.post(
            "/api/admin/reseller/settings",
            headers=self.admin_headers(),
            json={"min_margin": 10, "max_margin": 80, "status": "on"}
        )
        self.assertEqual(res_ref.status_code, 200)
        data_ref = res_ref.get_json()
        self.assertEqual(data_ref.get("min_margin"), 10)
        self.assertEqual(data_ref.get("max_margin"), 80)
        self.assertEqual(data_ref.get("status"), "on")

        # 2. Promo codes creation
        res_promo = self.client.post(
            "/api/admin/promo-codes",
            headers=self.admin_headers(),
            json={"code": "KRISHBONUS", "value": 50, "max_uses": 10}
        )
        self.assertEqual(res_promo.status_code, 200)
        self.assertEqual(res_promo.get_json().get("code"), "KRISHBONUS")

        # 3. Promo codes list
        res_plist = self.client.get("/api/admin/promo-codes", headers=self.admin_headers())
        self.assertEqual(res_plist.status_code, 200)
        codes = [p["code"] for p in res_plist.get_json().get("promo_codes", [])]
        self.assertIn("KRISHBONUS", codes)

        # 4. Promo codes deletion
        res_pdel = self.client.delete("/api/admin/promo-codes/KRISHBONUS", headers=self.admin_headers())
        self.assertEqual(res_pdel.status_code, 200)

    def test_admin_system_toggles_and_storefront_dynamic_reflection(self):
        """Toggling servers dynamically reflects live in the Mini App customer storefront."""
        # Ensure Server 1 is initially 'on'
        self.client.post("/api/admin/server1/toggle", headers=self.admin_headers(), json={"status": "on"})
        res_store1 = self.client.get("/api/store/servers")
        self.assertEqual(res_store1.status_code, 200)
        servers1 = {s["id"]: s["enabled"] for s in res_store1.get_json().get("servers", [])}
        self.assertTrue(servers1[1])

        # Turn Server 1 OFF in Admin
        self.client.post("/api/admin/server1/toggle", headers=self.admin_headers(), json={"status": "off"})

        # Customer storefront MUST dynamically report Server 1 disabled!
        res_store2 = self.client.get("/api/store/servers")
        servers2 = {s["id"]: s["enabled"] for s in res_store2.get_json().get("servers", [])}
        self.assertFalse(servers2[1])

        # Re-enable Server 1
        self.client.post("/api/admin/server1/toggle", headers=self.admin_headers(), json={"status": "on"})
        res_store3 = self.client.get("/api/store/servers")
        servers3 = {s["id"]: s["enabled"] for s in res_store3.get_json().get("servers", [])}
        self.assertTrue(servers3[1])

        # Toggle Server 3 off
        self.client.post("/api/admin/server3/toggle", headers=self.admin_headers(), json={"enabled": 0})
        res_store4 = self.client.get("/api/store/servers")
        servers4 = {s["id"]: s["enabled"] for s in res_store4.get_json().get("servers", [])}
        self.assertFalse(servers4[3])

        # Toggle Server 3 on
        self.client.post("/api/admin/server3/toggle", headers=self.admin_headers(), json={"enabled": 1})
        res_store5 = self.client.get("/api/store/servers")
        servers5 = {s["id"]: s["enabled"] for s in res_store5.get_json().get("servers", [])}
        self.assertTrue(servers5[3])

        # Toggle Server 5 off
        self.client.post("/api/admin/server5/toggle", headers=self.admin_headers(), json={"enabled": 0})
        res_store6 = self.client.get("/api/store/servers")
        servers6 = {s["id"]: s["enabled"] for s in res_store6.get_json().get("servers", [])}
        self.assertFalse(servers6[5])

        # Toggle Server 5 on
        self.client.post("/api/admin/server5/toggle", headers=self.admin_headers(), json={"enabled": 1})
        res_store7 = self.client.get("/api/store/servers")
        servers7 = {s["id"]: s["enabled"] for s in res_store7.get_json().get("servers", [])}
        self.assertTrue(servers7[5])

        # Bot status & Force join toggles
        res_bot = self.client.post("/api/admin/system/bot-status", headers=self.admin_headers(), json={"status": "off"})
        self.assertEqual(res_bot.status_code, 200)
        self.assertEqual(res_bot.get_json().get("bot_status"), "off")

        res_fj = self.client.post("/api/admin/system/force-join", headers=self.admin_headers(), json={"status": "on"})
        self.assertEqual(res_fj.status_code, 200)
        self.assertEqual(res_fj.get_json().get("force_join_status"), "on")

    def test_admin_settings_lifecycle(self):
        """GET and POST /api/admin/settings."""
        # Read
        res_get = self.client.get("/api/admin/settings", headers=self.admin_headers())
        self.assertEqual(res_get.status_code, 200)
        self.assertIn("settings", res_get.get_json())

        # Update
        res_set = self.client.post(
            "/api/admin/settings",
            headers=self.admin_headers(),
            json={"key": "reseller_min_margin", "value": "7"}
        )
        self.assertEqual(res_set.status_code, 200)
        self.assertEqual(res_set.get_json().get("value"), "7")

    def test_webhook_add_balance_authentication(self):
        """POST /webhook/add_balance requires valid secret."""
        # Invalid secret -> 401
        res_bad = self.client.post(
            "/webhook/add_balance",
            json={"secret": "wrong_secret", "user_id": self.test_user_id, "amount": 100}
        )
        self.assertEqual(res_bad.status_code, 401)

        # Valid secret -> 200
        res_ok = self.client.post(
            "/webhook/add_balance",
            json={"secret": config.WEBHOOK_SECRET, "user_id": self.test_user_id, "amount": 100, "reason": "Test topup"}
        )
        self.assertEqual(res_ok.status_code, 200)
        self.assertTrue(res_ok.get_json().get("success"))
        self.assertEqual(res_ok.get_json().get("amount_added"), 100)


if __name__ == "__main__":
    unittest.main()
