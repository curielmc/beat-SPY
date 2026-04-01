"""Tests for session cache."""

import unittest
from cli_anything.beatspy.utils.cache import SessionCache


class TestSessionCache(unittest.TestCase):
    """Test SessionCache."""

    def setUp(self):
        """Set up test fixtures."""
        self.cache = SessionCache()

    def test_initial_state(self):
        """Test initial cache state."""
        self.assertIsNone(self.cache.class_id)
        self.assertIsNone(self.cache.class_name)
        self.assertFalse(self.cache.is_in_class())

    def test_set_class(self):
        """Test setting a class."""
        class_dict = {"id": "class-123", "class_name": "Math 101"}
        self.cache.set_class(class_dict)

        self.assertEqual(self.cache.class_id, "class-123")
        self.assertEqual(self.cache.class_name, "Math 101")
        self.assertTrue(self.cache.is_in_class())

    def test_clear_class(self):
        """Test clearing class context."""
        class_dict = {"id": "class-123", "class_name": "Math 101"}
        self.cache.set_class(class_dict)
        self.cache.clear_class()

        self.assertIsNone(self.cache.class_id)
        self.assertIsNone(self.cache.class_name)
        self.assertFalse(self.cache.is_in_class())

    def test_class_slug(self):
        """Test class slug generation."""
        class_dict = {"id": "class-123", "class_name": "Math 101"}
        self.cache.set_class(class_dict)

        slug = self.cache.class_slug
        self.assertEqual(slug, "math-101")

    def test_class_slug_with_special_chars(self):
        """Test slug with special characters."""
        class_dict = {"id": "class-123", "class_name": "Advanced Physics (2024)"}
        self.cache.set_class(class_dict)

        slug = self.cache.class_slug
        self.assertEqual(slug, "advanced-physics-202")

    def test_class_slug_max_length(self):
        """Test slug max length limit."""
        class_dict = {
            "id": "class-123",
            "class_name": "This is a very long class name that should be truncated",
        }
        self.cache.set_class(class_dict)

        slug = self.cache.class_slug
        self.assertEqual(len(slug), 20)


if __name__ == "__main__":
    unittest.main()
