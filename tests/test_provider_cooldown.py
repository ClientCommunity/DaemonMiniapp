"""Integration tests for Server 3, 4, 5 rate-limit cooldown behavior."""
import asyncio
import unittest
from unittest.mock import patch, MagicMock

from api_cooldown import (
    is_cooling_down,
    record_rate_limit,
    reset_cooldowns,
    get_cooldown_remaining,
)
from server3 import DGOTPError, client as s3_client
from server4 import TemporaError, client as s4_client
from server5 import SMMError, Client as SMMClient


class TestProviderRateLimitCooldown(unittest.TestCase):
    def setUp(self):
        reset_cooldowns()

    def tearDown(self):
        reset_cooldowns()

    def test_server3_rate_limit_cooldown_blocks_further_requests(self):
        # When Server 3 endpoint is put in cooldown
        endpoint = "https://dgotp.in/stubs/handler_api.php"
        self.assertFalse(is_cooling_down(endpoint))

        record_rate_limit(endpoint, 10.0, reason="Simulated 429")
        self.assertTrue(is_cooling_down(endpoint))

        # Trying to send request to Server 3 should immediately raise DGOTPError without making HTTP calls
        with patch.object(s3_client, "_config", return_value={"api_enabled": 1, "api_key": "test_key", "api_url": endpoint, "timeout_seconds": 5, "retry_count": 0}):
            with self.assertRaises(DGOTPError) as ctx:
                asyncio.run(s3_client.request("getBalance"))
            self.assertEqual(ctx.exception.code, "RATE_LIMIT_COOLDOWN")

    def test_server4_rate_limit_cooldown_blocks_further_requests(self):
        endpoint = "https://api.temporasms.com/stubs/handler_api.php"
        self.assertFalse(is_cooling_down(endpoint))

        record_rate_limit(endpoint, 10.0, reason="Simulated 429")
        self.assertTrue(is_cooling_down(endpoint))

        with patch.object(s4_client, "config", return_value={"api_enabled": 1, "api_key": "test_key", "api_url": endpoint, "timeout_seconds": 5, "retry_count": 0}):
            with self.assertRaises(TemporaError) as ctx:
                asyncio.run(s4_client.request("getBalance"))
            self.assertEqual(ctx.exception.code, "TOO_MANY_REQUESTS")

    def test_server5_rate_limit_cooldown_blocks_further_requests(self):
        endpoint = "https://smm-panel.example/api/v2"
        self.assertFalse(is_cooling_down(endpoint))

        record_rate_limit(endpoint, 10.0, reason="Simulated 429")
        self.assertTrue(is_cooling_down(endpoint))

        client = SMMClient(1)
        with patch.object(client, "config", return_value={"enabled": 1, "api_key": "key", "api_url": endpoint}):
            with self.assertRaises(SMMError) as ctx:
                asyncio.run(client.request("balance"))
            self.assertEqual(ctx.exception.code, "RATE_LIMIT")


if __name__ == "__main__":
    unittest.main()
