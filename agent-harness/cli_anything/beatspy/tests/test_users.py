"""Tests for user operations."""

import unittest
from unittest.mock import MagicMock
from cli_anything.beatspy.core.users import UserOperations


class TestUserOperations(unittest.TestCase):
    """Test UserOperations."""

    def setUp(self):
        """Set up test fixtures."""
        self.mock_api = MagicMock()
        self.ops = UserOperations(self.mock_api)

    def test_list_users(self):
        """Test listing users."""
        self.mock_api.sb_get.return_value = [
            {"id": "1", "email": "user@example.com", "role": "student"},
            {"id": "2", "email": "teacher@example.com", "role": "teacher"},
        ]

        result = self.ops.list()

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["role"], "student")

    def test_list_users_empty(self):
        """Test listing with no users."""
        self.mock_api.sb_get.return_value = []

        result = self.ops.list()

        self.assertEqual(result, [])

    def test_get_user(self):
        """Test getting a specific user."""
        self.mock_api.sb_get.return_value = [
            {"id": "1", "email": "user@example.com", "role": "student"}
        ]

        result = self.ops.get("1")

        self.assertEqual(result["id"], "1")
        self.assertEqual(result["role"], "student")

    def test_get_user_not_found(self):
        """Test getting non-existent user."""
        self.mock_api.sb_get.return_value = []

        result = self.ops.get("nonexistent")

        self.assertIsNone(result)

    def test_update_role(self):
        """Test updating user role."""
        self.mock_api.sb_patch.return_value = [
            {"id": "1", "email": "user@example.com", "role": "teacher"}
        ]

        result = self.ops.update_role("1", "teacher")

        self.assertEqual(result["role"], "teacher")


if __name__ == "__main__":
    unittest.main()
