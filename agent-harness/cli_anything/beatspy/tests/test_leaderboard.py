"""Tests for leaderboard operations."""

import unittest
from unittest.mock import MagicMock
from cli_anything.beatspy.core.leaderboard import LeaderboardOperations


class TestLeaderboardOperations(unittest.TestCase):
    """Test LeaderboardOperations."""

    def setUp(self):
        """Set up test fixtures."""
        self.mock_api = MagicMock()
        self.ops = LeaderboardOperations(self.mock_api)

    def test_get_leaderboard(self):
        """Test getting leaderboard data."""
        self.mock_api.edge_post.return_value = {
            "rankings": [
                {"rank": 1, "user": "Alice", "return_pct": 15.2},
                {"rank": 2, "user": "Bob", "return_pct": 12.5},
            ]
        }

        result = self.ops.get("class-1")

        self.assertEqual(len(result["rankings"]), 2)
        self.assertEqual(result["rankings"][0]["user"], "Alice")


if __name__ == "__main__":
    unittest.main()
