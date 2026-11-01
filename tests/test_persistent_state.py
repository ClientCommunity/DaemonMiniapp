import os
import sys
import time
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database import DB_PATH, connect, migrate, cleanup_expired_conversations
from bot_helpers.state_manager import PersistentState, TrackedDict


class TestPersistentStateIntegration(unittest.TestCase):
    def setUp(self):
        migrate()
        # Clean up any leftover test data
        with connect() as conn:
            conn.execute("DELETE FROM user_conversations WHERE namespace LIKE 'test_%'")

    def tearDown(self):
        with connect() as conn:
            conn.execute("DELETE FROM user_conversations WHERE namespace LIKE 'test_%'")

    def test_basic_crud_and_contains(self):
        state = PersistentState("test_basic", ttl=300)
        uid = 987654321

        self.assertNotIn(uid, state)
        self.assertIsNone(state.get(uid))

        state[uid] = {"step": "wait_target", "amount": 100}
        self.assertIn(uid, state)

        fetched = state[uid]
        self.assertEqual(fetched["step"], "wait_target")
        self.assertEqual(fetched["amount"], 100)

        # Pop
        popped = state.pop(uid)
        self.assertEqual(popped["step"], "wait_target")
        self.assertNotIn(uid, state)

        # Pop with default
        self.assertEqual(state.pop(uid, "default_val"), "default_val")

    def test_in_place_dict_mutation(self):
        state1 = PersistentState("test_mutation", ttl=300)
        uid = 11223344

        state1[uid] = {"step": "wait_target"}
        st = state1[uid]
        st["step"] = "wait_amount"
        st["target_uid"] = 556677
        st["recip_label"] = "Bob"

        # Simulate bot restart by instantiating a new PersistentState instance
        state2 = PersistentState("test_mutation", ttl=300)
        self.assertIn(uid, state2)
        st2 = state2[uid]
        self.assertEqual(st2["step"], "wait_amount")
        self.assertEqual(st2["target_uid"], 556677)
        self.assertEqual(st2["recip_label"], "Bob")

        # Test dictionary update() method
        st2.update(step="confirm", charge=250)
        state3 = PersistentState("test_mutation", ttl=300)
        st3 = state3[uid]
        self.assertEqual(st3["step"], "confirm")
        self.assertEqual(st3["charge"], 250)

    def test_tuple_preservation_for_orders(self):
        state = PersistentState("test_srv3", ttl=300)
        uid = 445566

        test_tuple = ("WA", "srv3_us", 45, 9999999999.0)
        state[uid] = test_tuple

        # Read back in a fresh instance
        state_fresh = PersistentState("test_srv3", ttl=300)
        read_val = state_fresh.pop(uid, None)

        self.assertIsInstance(read_val, tuple)
        self.assertEqual(read_val, test_tuple)
        self.assertEqual(read_val[:2], ("WA", "srv3_us"))
        self.assertEqual(read_val[2], 45)

    def test_set_compatibility_interface(self):
        state = PersistentState("test_set", ttl=300)
        uid = 778899

        self.assertNotIn(uid, state)
        state.add(uid)
        self.assertIn(uid, state)
        self.assertTrue(state[uid])

        state.discard(uid)
        self.assertNotIn(uid, state)
        # Discard on non-existent does not raise
        state.discard(uid)

    def test_ttl_and_cleanup(self):
        state = PersistentState("test_ttl", ttl=1)
        uid = 334455

        state[uid] = "temporary_state"
        self.assertIn(uid, state)

        time.sleep(1.1)

        # Access after TTL should reflect expiration
        self.assertNotIn(uid, state)
        self.assertIsNone(state.get(uid))

        # Test explicit cleanup_expired_conversations
        state_quick = PersistentState("test_cleanup", ttl=-1) # Already expired
        state_quick[999] = "expired"

        deleted = cleanup_expired_conversations()
        self.assertGreaterEqual(deleted, 1)


if __name__ == "__main__":
    unittest.main()
