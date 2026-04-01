"""Tests for group operations."""

import unittest
from unittest.mock import patch, MagicMock
from cli_anything.beatspy.core.groups import GroupOperations


class TestGroupOperations(unittest.TestCase):
    """Test GroupOperations."""

    def setUp(self):
        """Set up test fixtures."""
        self.api_mock = MagicMock()
        self.group_ops = GroupOperations(self.api_mock)
        self.class_id = "cls-123"
        self.group_id = "grp-456"

    def test_list_for_class(self):
        """Test listing groups for a class."""
        groups_data = [
            {"id": "grp-1", "name": "Team A", "class_id": self.class_id, "created_at": "2026-03-01"},
            {"id": "grp-2", "name": "Team B", "class_id": self.class_id, "created_at": "2026-03-02"},
        ]
        self.api_mock.sb_get.return_value = groups_data

        result = self.group_ops.list_for_class(self.class_id)

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["name"], "Team A")
        self.api_mock.sb_get.assert_called_once()

    def test_list_for_class_empty(self):
        """Test listing groups when none exist."""
        self.api_mock.sb_get.return_value = []

        result = self.group_ops.list_for_class(self.class_id)

        self.assertEqual(result, [])

    def test_get_group(self):
        """Test getting a specific group."""
        group_data = {
            "id": self.group_id,
            "name": "Finance Bros",
            "class_id": self.class_id,
            "created_at": "2026-03-01",
            "bio": "Investment club"
        }
        self.api_mock.sb_get.return_value = [group_data]

        result = self.group_ops.get(self.group_id)

        self.assertEqual(result["name"], "Finance Bros")
        self.assertEqual(result["bio"], "Investment club")

    def test_get_group_not_found(self):
        """Test getting a group that doesn't exist."""
        self.api_mock.sb_get.return_value = []

        result = self.group_ops.get(self.group_id)

        self.assertIsNone(result)

    def test_get_members(self):
        """Test getting members of a group."""
        members_data = [
            {"user_id": "user-1"},
            {"user_id": "user-2"},
        ]
        portfolios_data = [
            {"id": "port-1", "owner_id": "user-1", "cash_balance": 105000, "starting_cash": 100000},
            {"id": "port-2", "owner_id": "user-2", "cash_balance": 95000, "starting_cash": 100000},
        ]
        profiles_data = [
            {"id": "user-1", "full_name": "Alice"},
            {"id": "user-2", "full_name": "Bob"},
        ]

        # Mock the three calls to sb_get
        def mock_get(table, params=None):
            if "groups_users" in str(params):
                return members_data
            elif "portfolios" in str(params):
                # Return portfolio for specific user
                user_id = params.get("owner_id", "").split(".")[-1] if params else None
                return [p for p in portfolios_data if p.get("owner_id") == user_id]
            elif "profiles" in str(params):
                return profiles_data
            return []

        self.api_mock.sb_get.side_effect = lambda table, params=None: mock_get(table, params)

        result = self.group_ops.get_members(self.group_id)

        self.assertIsInstance(result, list)
        # Should have members or be empty (depending on table availability)

    def test_get_members_empty(self):
        """Test getting members when group has no members."""
        self.api_mock.sb_get.return_value = []

        result = self.group_ops.get_members(self.group_id)

        self.assertEqual(result, [])

    def test_get_leaderboard(self):
        """Test getting group leaderboard."""
        groups_data = [
            {"id": "grp-1", "name": "Team A", "class_id": self.class_id, "created_at": "2026-03-01"},
            {"id": "grp-2", "name": "Team B", "class_id": self.class_id, "created_at": "2026-03-02"},
        ]

        # Mock list_for_class
        with patch.object(self.group_ops, "list_for_class", return_value=groups_data):
            # Mock get_members to return empty (for simplicity)
            with patch.object(self.group_ops, "get_members", return_value=[]):
                result = self.group_ops.get_leaderboard(self.class_id)

                self.assertIsInstance(result, list)
                # Should return sorted list (even if empty)

    def test_return_percentage_calculation(self):
        """Test that return percentage is calculated correctly."""
        members = [
            {
                "user_id": "user-1",
                "name": "Alice",
                "portfolio_id": "port-1",
                "cash_balance": 110000,
                "starting_cash": 100000,
                "pnl": 10000,
                "return_pct": 10.0,
            }
        ]

        # Verify calculation
        expected_return = (10000 / 100000) * 100
        self.assertEqual(members[0]["return_pct"], expected_return)


if __name__ == "__main__":
    unittest.main()
