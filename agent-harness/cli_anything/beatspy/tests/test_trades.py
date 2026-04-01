"""Tests for trade operations."""

import unittest
from unittest.mock import MagicMock
from cli_anything.beatspy.core.trades import TradeOperations


class TestTradeOperations(unittest.TestCase):
    """Test TradeOperations."""

    def setUp(self):
        """Set up test fixtures."""
        self.mock_api = MagicMock()
        self.ops = TradeOperations(self.mock_api)

    def test_place_buy_trade(self):
        """Test placing a buy trade."""
        self.mock_api.edge_post.return_value = {
            "success": True,
            "trade_id": "t1",
            "status": "executed",
        }

        result = self.ops.place("p1", "AAPL", "buy", 1000)

        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "executed")

    def test_place_sell_trade(self):
        """Test placing a sell trade."""
        self.mock_api.edge_post.return_value = {
            "success": True,
            "trade_id": "t2",
            "status": "queued",
        }

        result = self.ops.place("p1", "MSFT", "sell", 500)

        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "queued")

    def test_place_trade_with_rationale(self):
        """Test placing trade with rationale."""
        self.mock_api.edge_post.return_value = {"success": True}

        result = self.ops.place("p1", "AAPL", "buy", 1000, rationale="Strong earnings")

        self.assertTrue(result["success"])


if __name__ == "__main__":
    unittest.main()
