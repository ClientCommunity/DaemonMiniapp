import sys
import unittest
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app import create_app
from database import connect, migrate
from services.store_service import get_pinned_services
from services.admin_service import (
    list_all_pinned_services,
    add_pinned_service,
    update_pinned_service,
    delete_pinned_service,
)


class TestPinnedServices(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        migrate()
        cls.app = create_app()
        cls.client = cls.app.test_client()

    def setUp(self):
        with connect() as conn:
            conn.execute("DELETE FROM pinned_services")
            conn.commit()

    def tearDown(self):
        with connect() as conn:
            conn.execute("DELETE FROM pinned_services")
            conn.commit()

    def test_pinned_crud_and_store_retrieval(self):
        # 1. Initially empty
        items = get_pinned_services()
        self.assertEqual(items, [])

        # 2. Add pinned service for Server 5 (SMM)
        added = add_pinned_service(
            server_no=5,
            service_id="101",
            service_name="Telegram Fast Views",
            category_name="Telegram",
            badge="⚡ Instant",
            display_order=1
        )
        self.assertIsNotNone(added.get("id"))
        self.assertEqual(added["server_no"], 5)

        # 3. Add pinned service for Server 3 (OTP)
        added2 = add_pinned_service(
            server_no=3,
            service_id="tg",
            service_name="Telegram OTP",
            country_name="India",
            badge="🔥 Hot",
            display_order=2
        )
        self.assertIsNotNone(added2.get("id"))

        # 4. Check get_pinned_services()
        pinned = get_pinned_services()
        self.assertEqual(len(pinned), 2)
        self.assertEqual(pinned[0]["service_name"], "Telegram Fast Views")
        self.assertEqual(pinned[0]["badge"], "⚡ Instant")
        self.assertEqual(pinned[0]["deep_link"], f"pin_{added['id']}")
        self.assertEqual(pinned[1]["service_name"], "Telegram OTP")

        # 5. Filter by server
        s5_only = get_pinned_services(server_no=5)
        self.assertEqual(len(s5_only), 1)
        self.assertEqual(s5_only[0]["server_no"], 5)

        s1_only = get_pinned_services(server_no=1)
        self.assertEqual(len(s1_only), 0)

        # 6. Update pinned service (toggle inactive)
        update_pinned_service(added["id"], is_active=0)
        pinned_active = get_pinned_services()
        self.assertEqual(len(pinned_active), 1)
        self.assertEqual(pinned_active[0]["id"], added2["id"])

        # 7. Admin list returns both active and inactive
        admin_items = list_all_pinned_services()
        self.assertEqual(len(admin_items), 2)

        # 8. Delete pinned service
        delete_pinned_service(added2["id"])
        self.assertEqual(len(list_all_pinned_services()), 1)

    def test_public_store_pinned_api(self):
        add_pinned_service(
            server_no=1,
            service_id="US",
            service_name="USA 2FA Account",
            country_name="United States",
            badge="⭐ Best Deal",
            display_order=0
        )

        res = self.client.get("/api/store/pinned")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(len(data.get("pinned", [])), 1)
        self.assertEqual(data["pinned"][0]["service_name"], "USA 2FA Account")
