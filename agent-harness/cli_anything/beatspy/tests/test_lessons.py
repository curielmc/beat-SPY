"""Tests for lesson operations."""

import unittest
from unittest.mock import MagicMock
from cli_anything.beatspy.core.lessons import LessonOperations


class TestLessonOperations(unittest.TestCase):
    """Test LessonOperations."""

    def setUp(self):
        """Set up test fixtures."""
        self.mock_api = MagicMock()
        self.ops = LessonOperations(self.mock_api)

    def test_list_tutorials(self):
        """Test listing tutorials."""
        self.mock_api.sb_get.return_value = [
            {"id": "t1", "title": "Diversification", "category": "investments"},
            {"id": "t2", "title": "Risk Management", "category": "trading"},
        ]

        result = self.ops.list_tutorials()

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["title"], "Diversification")

    def test_list_tutorials_empty(self):
        """Test listing with no tutorials."""
        self.mock_api.sb_get.return_value = []

        result = self.ops.list_tutorials()

        self.assertEqual(result, [])

    def test_send_lesson(self):
        """Test sending a lesson."""
        self.mock_api.edge_post.return_value = {
            "success": True,
            "lesson_id": "l1",
            "recipient": "user1",
        }

        result = self.ops.send("class-1", "portfolio-1")

        self.assertTrue(result["success"])

    def test_tutorial_steps(self):
        """Test getting tutorial steps."""
        self.mock_api.sb_get.return_value = [
            {"id": "s1", "title": "Step 1", "position": 1},
            {"id": "s2", "title": "Step 2", "position": 2},
        ]

        result = self.ops.tutorial_steps("t1")

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["position"], 1)


if __name__ == "__main__":
    unittest.main()
