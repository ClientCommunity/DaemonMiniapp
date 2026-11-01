import asyncio
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database import DB_PATH, connect, managed_connect, migrate, db, cur


class TestCursorConcurrency(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        migrate()
        with managed_connect() as conn:
            conn.execute("DELETE FROM users WHERE user_id >= 990000 AND user_id <= 990100")
            conn.commit()

    def tearDown(self):
        with managed_connect() as conn:
            conn.execute("DELETE FROM users WHERE user_id >= 990000 AND user_id <= 990100")
            conn.commit()

    async def test_concurrent_tasks_cursor_isolation(self):
        """Simulate 30 concurrent user interactions on the global cur and db."""
        async def user_workflow(uid: int):
            # Step 1: Create user with distinct balance
            initial_balance = uid % 1000 + 500
            cur.execute("INSERT OR REPLACE INTO users (user_id, balance) VALUES (?, ?)", (uid, initial_balance))

            # Step 2: Read balance
            row = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()
            self.assertIsNotNone(row)
            self.assertEqual(row[0], initial_balance)

            # Yield control to simulate network / Telethon async event handling
            await asyncio.sleep(0.01)

            # Step 3: Deduct balance with rowcount check
            charge = 25
            cur.execute("UPDATE users SET balance = balance - ? WHERE user_id=? AND balance >= ?", (charge, uid, charge))
            # Verify rowcount is not corrupted by other concurrent tasks
            self.assertEqual(cur.rowcount, 1)

            # Yield again
            await asyncio.sleep(0.01)

            # Step 4: Verify balance deduction
            row2 = cur.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()
            self.assertIsNotNone(row2)
            self.assertEqual(row2[0], initial_balance - charge)

            db.commit()
            return True

        uids = [990000 + i for i in range(30)]
        results = await asyncio.gather(*[user_workflow(uid) for uid in uids])
        self.assertEqual(len(results), 30)
        self.assertTrue(all(results))

    async def test_nested_cursor_execution_does_not_raise(self):
        """Verify that executing a query while iterating another query does not raise recursion error."""
        # Insert test users
        for i in range(5):
            cur.execute("INSERT OR REPLACE INTO users (user_id, balance) VALUES (?, 100)", (990050 + i,))

        # Iterate over cursor while executing inner queries
        updated_count = 0
        for row in cur.execute("SELECT user_id FROM users WHERE user_id >= 990050 AND user_id < 990055"):
            u = row[0]
            cur.execute("UPDATE users SET balance = balance + 10 WHERE user_id=?", (u,))
            self.assertEqual(cur.rowcount, 1)
            updated_count += 1

        self.assertEqual(updated_count, 5)


if __name__ == "__main__":
    unittest.main()
