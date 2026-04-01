"""Tests for portfolio operations."""

import unittest
from unittest.mock import MagicMock
from cli_anything.beatspy.core.portfolios import PortfolioOperations


class TestPortfolioOperations(unittest.TestCase):
    """Test PortfolioOperations."""

    def setUp(self):
        """Set up test fixtures."""
        self.mock_api = MagicMock()
        self.ops = PortfolioOperations(self.mock_api)

    def test_list_for_class(self):
        """Test listing portfolios for a class."""
        self.mock_api.sb_get.side_effect = [
            [{"user_id": "user1"}, {"user_id": "user2"}],
            [{"id": "p1", "owner_type": "user"}],
        ]

        result = self.ops.list_for_class("class-1")

        self.assertEqual(len(result), 1)

    def test_get_portfolio(self):
        """Test getting a portfolio."""
        self.mock_api.sb_get.side_effect = [
            [{"id": "p1", "cash_balance": 100000}],
            [{"ticker": "AAPL", "shares": 10}],
        ]

        result = self.ops.get("p1")

        self.assertEqual(result["id"], "p1")
        self.assertEqual(len(result["holdings"]), 1)

    def test_get_portfolio_not_found(self):
        """Test getting non-existent portfolio."""
        self.mock_api.sb_get.return_value = []

        result = self.ops.get("nonexistent")

        self.assertIsNone(result)

    def test_trades(self):
        """Test getting trades for portfolio."""
        self.mock_api.sb_get.return_value = [
            {"id": "t1", "ticker": "AAPL", "side": "buy"},
            {"id": "t2", "ticker": "MSFT", "side": "sell"},
        ]

        result = self.ops.trades("p1")

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["ticker"], "AAPL")

    def test_pending(self):
        """Test getting pending orders."""
        self.mock_api.sb_get.return_value = [
            {"id": "o1", "ticker": "AAPL", "status": "queued"}
        ]

        result = self.ops.pending("p1")

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["status"], "queued")


if __name__ == "__main__":
    unittest.main()
