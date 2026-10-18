"""Unit tests for Google OAuth authentication and web user isolation."""
import unittest
from unittest.mock import patch

from app import create_app
from database import migrate, connect
from config import ADMIN_PANEL_SECRET
from api.admin import decode_jwt


class TestGoogleAuth(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        migrate()
        cls.app = create_app()
        cls.client = cls.app.test_client()

    def test_google_login_flow_and_web_user_creation(self):
        """Web users signing in with Google are assigned 9B+ user_id and receive valid JWT."""
        mock_google_info = {
            "sub": "google-test-sub-123456",
            "email": "testwebuser@example.com",
            "name": "Test Web User",
            "picture": "https://example.com/avatar.png",
        }

        with patch("api.auth.verify_google_id_token", return_value=mock_google_info):
            res = self.client.post("/api/auth/google", json={"credential": "mock-valid-id-token"})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data.get("success"))
            self.assertIn("token", data)
            user = data.get("user")
            self.assertIsNotNone(user)

            # Verify numeric user_id is in 9,000,000,000+ space
            uid = user.get("id")
            self.assertGreaterEqual(uid, 9000000000)
            self.assertEqual(user.get("email"), "testwebuser@example.com")
            self.assertEqual(user.get("auth_provider"), "google")

            token = data["token"]
            # Verify JWT payload
            payload = decode_jwt(token, ADMIN_PANEL_SECRET)
            self.assertEqual(payload.get("user_id"), uid)
            self.assertEqual(payload.get("auth_provider"), "google")

            # Test using this token on /api/auth/me
            me_res = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
            self.assertEqual(me_res.status_code, 200)
            me_data = me_res.get_json()
            self.assertTrue(me_data.get("success"))
            self.assertEqual(me_data["user"]["id"], uid)

            # Test that web user CANNOT access any admin endpoints
            admin_res = self.client.get("/api/admin/me", headers={"Authorization": f"Bearer {token}"})
            self.assertEqual(admin_res.status_code, 403)

    def test_google_login_missing_credential(self):
        """Missing credential returns 400 Bad Request."""
        res = self.client.post("/api/auth/google", json={})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data.get("success"))

    def test_google_login_invalid_credential(self):
        """Invalid Google token returns 401 Unauthorized."""
        with patch("api.auth.verify_google_id_token", return_value=None):
            res = self.client.post("/api/auth/google", json={"credential": "invalid-token"})
            self.assertEqual(res.status_code, 401)
            data = res.get_json()
            self.assertFalse(data.get("success"))


if __name__ == "__main__":
    unittest.main()
