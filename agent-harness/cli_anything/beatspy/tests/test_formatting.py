"""Tests for formatting utilities."""

import unittest
from cli_anything.beatspy.utils.formatting import (
    format_table,
    format_json,
    format_error,
    format_success,
    format_warning,
    format_info,
)


class TestFormatting(unittest.TestCase):
    """Test output formatting utilities."""

    def test_format_table(self):
        """Test table formatting."""
        data = [{"id": 1, "name": "Test"}]
        result = format_table(data)
        self.assertIn("Test", result)

    def test_format_table_empty(self):
        """Test table formatting with empty data."""
        result = format_table([])
        self.assertIn("No data", result)

    def test_format_json(self):
        """Test JSON formatting."""
        data = {"id": 1, "name": "Test"}
        result = format_json(data)
        self.assertIn('"id"', result)
        self.assertIn("1", result)

    def test_format_error(self):
        """Test error formatting."""
        result = format_error("Error message")
        self.assertIn("✗", result)
        self.assertIn("Error", result)

    def test_format_success(self):
        """Test success formatting."""
        result = format_success("Success message")
        self.assertIn("✓", result)
        self.assertIn("Success", result)

    def test_format_warning(self):
        """Test warning formatting."""
        result = format_warning("Warning message")
        self.assertIn("⚠", result)
        self.assertIn("Warning", result)

    def test_format_info(self):
        """Test info formatting."""
        result = format_info("Info message")
        self.assertIn("ℹ", result)
        self.assertIn("Info", result)


if __name__ == "__main__":
    unittest.main()
