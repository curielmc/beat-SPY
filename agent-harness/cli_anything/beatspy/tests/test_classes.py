"""Tests for class operations."""

import unittest
from unittest.mock import MagicMock
from cli_anything.beatspy.core.classes import ClassOperations


class TestClassOperations(unittest.TestCase):
    """Test ClassOperations."""

    def setUp(self):
        """Set up test fixtures."""
        self.mock_api = MagicMock()
        self.ops = ClassOperations(self.mock_api)

    def test_list_classes(self):
        """Test listing classes."""
        self.mock_api.sb_get.return_value = [
            {"id": "1", "class_name": "Math 101"},
            {"id": "2", "class_name": "Physics 101"},
        ]

        result = self.ops.list()

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["class_name"], "Math 101")

    def test_list_classes_empty(self):
        """Test listing with no classes."""
        self.mock_api.sb_get.return_value = []

        result = self.ops.list()

        self.assertEqual(result, [])

    def test_get_class(self):
        """Test getting a specific class."""
        self.mock_api.sb_get.return_value = [{"id": "1", "class_name": "Math 101"}]

        result = self.ops.get("1")

        self.assertEqual(result["id"], "1")
        self.assertEqual(result["class_name"], "Math 101")

    def test_get_class_not_found(self):
        """Test getting non-existent class."""
        self.mock_api.sb_get.return_value = []

        result = self.ops.get("nonexistent")

        self.assertIsNone(result)

    def test_dashboard(self):
        """Test getting dashboard data."""
        self.mock_api.edge_post.return_value = {"portfolios": []}

        result = self.ops.dashboard("class-1")

        self.assertIn("portfolios", result)


if __name__ == "__main__":
    unittest.main()
