"""Unit tests for api_cooldown.py module."""
import asyncio
import unittest
from api_cooldown import (
    DEFAULT_COOLDOWN_SECONDS,
    RateLimitCooldownError,
    check_cooldown,
    get_cooldown_remaining,
    is_cooling_down,
    normalize_endpoint,
    record_rate_limit,
    reset_cooldowns,
    wait_cooldown,
)


class TestApiCooldown(unittest.TestCase):
    def setUp(self):
        reset_cooldowns()

    def tearDown(self):
        reset_cooldowns()

    def test_normalize_endpoint(self):
        self.assertEqual(
            normalize_endpoint("https://dgotp.in/stubs/handler_api.php?action=getStatus&id=123"),
            "https://dgotp.in/stubs/handler_api.php",
        )
        self.assertEqual(
            normalize_endpoint("https://api.temporasms.com/stubs/handler_api.php?api_key=secret&action=getBalance"),
            "https://api.temporasms.com/stubs/handler_api.php",
        )
        self.assertEqual(
            normalize_endpoint("https://api.telegram.org/bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11/editMessageText"),
            "https://api.telegram.org/bot/editMessageText",
        )
        self.assertEqual(
            normalize_endpoint("https://justanotherpanel.com/api/v2?key=xyz"),
            "https://justanotherpanel.com/api/v2",
        )
        self.assertEqual(normalize_endpoint(""), "")

    def test_cooldown_lifecycle(self):
        url = "https://dgotp.in/stubs/handler_api.php?action=getStatus"
        endpoint = "https://dgotp.in/stubs/handler_api.php"

        self.assertFalse(is_cooling_down(url))
        self.assertEqual(get_cooldown_remaining(url), 0.0)

        # Enforce 10s cooldown
        remaining = record_rate_limit(url, 10.0, reason="HTTP 429")
        self.assertGreater(remaining, 8.0)
        self.assertTrue(is_cooling_down(url))
        self.assertTrue(is_cooling_down(endpoint))
        self.assertTrue(is_cooling_down("https://dgotp.in/stubs/handler_api.php?action=getBalance"))

        # Check exception
        with self.assertRaises(RateLimitCooldownError) as ctx:
            check_cooldown(endpoint)
        self.assertIn("in cooldown", str(ctx.exception))

    def test_wait_cooldown(self):
        url = "https://test.api/endpoint"
        # Small cooldown for test
        record_rate_limit(url, 0.05)
        self.assertTrue(is_cooling_down(url))

        async def run_wait():
            cleared = await wait_cooldown(url, max_wait=1.0)
            return cleared

        result = asyncio.run(run_wait())
        self.assertTrue(result)
        self.assertFalse(is_cooling_down(url))

    def test_wait_cooldown_exceeds_max_wait(self):
        url = "https://test.api/slow"
        record_rate_limit(url, 10.0)
        async def run_wait():
            return await wait_cooldown(url, max_wait=0.01)

        result = asyncio.run(run_wait())
        self.assertFalse(result)
        self.assertTrue(is_cooling_down(url))


if __name__ == "__main__":
    unittest.main()
