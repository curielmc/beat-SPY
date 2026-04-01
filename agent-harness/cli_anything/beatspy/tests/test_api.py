"""Tests for API client."""

import unittest
import os
from unittest.mock import patch, MagicMock
from cli_anything.beatspy.utils.api import BeatSpyAPIClient


class TestBeatSpyAPIClient(unittest.TestCase):
    """Test BeatSpyAPIClient."""

    def setUp(self):
        """Set up test fixtures."""
        self.jwt = "test_jwt_token"
        self.supabase_url = "https://test.supabase.co"
        self.api_url = "https://beat-snp.com"

    def test_init_with_env_vars(self):
        """Test initialization with environment variables."""
        with patch.dict(
            os.environ,
            {
                "BEATSPY_JWT_TOKEN": self.jwt,
                "BEATSPY_SUPABASE_URL": self.supabase_url,
                "BEATSPY_API_URL": self.api_url,
            },
        ):
            client = BeatSpyAPIClient()
            self.assertEqual(client.jwt_token, self.jwt)
            self.assertEqual(client.supabase_url, self.supabase_url)
            self.assertEqual(client.api_url, self.api_url)

    def test_init_missing_jwt_token(self):
        """Test initialization fails without JWT token."""
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError):
                BeatSpyAPIClient()

    def test_init_missing_supabase_url(self):
        """Test initialization fails without Supabase URL."""
        with patch.dict(os.environ, {"BEATSPY_JWT_TOKEN": self.jwt}, clear=True):
            with self.assertRaises(ValueError):
                BeatSpyAPIClient()

    def test_init_with_parameters(self):
        """Test initialization with explicit parameters."""
        client = BeatSpyAPIClient(
            jwt_token=self.jwt,
            supabase_url=self.supabase_url,
            api_url=self.api_url,
        )
        self.assertEqual(client.jwt_token, self.jwt)
        self.assertEqual(client.supabase_url, self.supabase_url)
        self.assertEqual(client.api_url, self.api_url)

    @patch("requests.get")
    def test_sb_get_success(self, mock_get):
        """Test successful Supabase GET request."""
        mock_get.return_value = MagicMock(
            status_code=200, json=lambda: [{"id": "1", "name": "test"}]
        )

        client = BeatSpyAPIClient(jwt_token=self.jwt, supabase_url=self.supabase_url)
        result = client.sb_get("classes", params={"select": "id,name"})

        self.assertEqual(result, [{"id": "1", "name": "test"}])
        mock_get.assert_called_once()

    @patch("requests.get")
    def test_sb_get_empty_result(self, mock_get):
        """Test Supabase GET with empty result."""
        mock_get.return_value = MagicMock(status_code=200, json=lambda: [])

        client = BeatSpyAPIClient(jwt_token=self.jwt, supabase_url=self.supabase_url)
        result = client.sb_get("classes")

        self.assertEqual(result, [])

    @patch("requests.patch")
    def test_sb_patch_success(self, mock_patch):
        """Test successful Supabase PATCH request."""
        mock_patch.return_value = MagicMock(
            status_code=200, json=lambda: [{"id": "1", "role": "teacher"}]
        )

        client = BeatSpyAPIClient(jwt_token=self.jwt, supabase_url=self.supabase_url)
        result = client.sb_patch("profiles", "id=eq.1", {"role": "teacher"})

        self.assertEqual(result, [{"id": "1", "role": "teacher"}])
        mock_patch.assert_called_once()

    @patch("requests.post")
    def test_edge_post_success(self, mock_post):
        """Test successful edge function POST."""
        mock_post.return_value = MagicMock(
            status_code=200, json=lambda: {"success": True}
        )

        client = BeatSpyAPIClient(
            jwt_token=self.jwt, supabase_url=self.supabase_url, api_url=self.api_url
        )
        result = client.edge_post("/api/place-trade", {"portfolio_id": "1"})

        self.assertEqual(result, {"success": True})

    @patch("requests.get")
    def test_edge_get_success(self, mock_get):
        """Test successful edge function GET."""
        mock_get.return_value = MagicMock(
            status_code=200, json=lambda: {"data": "test"}
        )

        client = BeatSpyAPIClient(
            jwt_token=self.jwt, supabase_url=self.supabase_url, api_url=self.api_url
        )
        result = client.edge_get("/api/admin-users")

        self.assertEqual(result, {"data": "test"})

    @patch("requests.get")
    def test_request_http_error(self, mock_get):
        """Test HTTP error handling."""
        mock_get.return_value = MagicMock(
            status_code=401, json=lambda: {"error": "Unauthorized"}
        )

        client = BeatSpyAPIClient(jwt_token=self.jwt, supabase_url=self.supabase_url)

        with self.assertRaises(Exception):
            client.sb_get("classes")


if __name__ == "__main__":
    unittest.main()
