"""End-to-end tests for beat-SPY CLI.

These tests are skipped unless the CLI is installed in development mode.
Run with: CLI_ANYTHING_FORCE_INSTALLED=1 pytest cli_anything/beatspy/tests/test_full_e2e.py
"""

import os
import unittest
from cli_anything.beatspy.utils.api import BeatSpyAPIClient


class TestE2ECLI(unittest.TestCase):
    """End-to-end tests for beat-SPY CLI."""

    @classmethod
    def setUpClass(cls):
        """Set up test environment."""
        force_installed = os.environ.get("CLI_ANYTHING_FORCE_INSTALLED") == "1"
        if not force_installed:
            raise unittest.SkipTest("CLI not installed. Run: pip install -e .")

    def test_api_client_initialization(self):
        """Test that API client can be initialized with env vars."""
        jwt = os.environ.get("BEATSPY_JWT_TOKEN")
        supabase_url = os.environ.get("BEATSPY_SUPABASE_URL")

        if not jwt or not supabase_url:
            self.skipTest("Missing required env vars for E2E test")

        client = BeatSpyAPIClient()
        self.assertIsNotNone(client)

    def test_classes_list_e2e(self):
        """Test listing classes via API."""
        jwt = os.environ.get("BEATSPY_JWT_TOKEN")
        supabase_url = os.environ.get("BEATSPY_SUPABASE_URL")

        if not jwt or not supabase_url:
            self.skipTest("Missing required env vars for E2E test")

        client = BeatSpyAPIClient()
        # This may return empty list if no classes exist, which is okay
        result = client.sb_get("classes")
        self.assertIsInstance(result, list)

    def test_api_connection_verify(self):
        """Test that API connection is working."""
        jwt = os.environ.get("BEATSPY_JWT_TOKEN")
        supabase_url = os.environ.get("BEATSPY_SUPABASE_URL")

        if not jwt or not supabase_url:
            self.skipTest("Missing required env vars for E2E test")

        client = BeatSpyAPIClient()
        # Attempt a simple query to verify connection
        try:
            client.sb_get("classes", params={"limit": "1"})
        except Exception as e:
            self.fail(f"API connection failed: {str(e)}")


if __name__ == "__main__":
    unittest.main()
