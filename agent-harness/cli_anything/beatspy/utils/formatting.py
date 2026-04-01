"""Output formatting utilities."""

import json
from typing import Any, List, Dict
from tabulate import tabulate


def format_table(data: List[Dict[str, Any]]) -> str:
    """Format data as a table.

    Args:
        data: List of dictionaries to format as table

    Returns:
        Formatted table string
    """
    if not data:
        return "No data to display."

    return tabulate(data, headers="keys", tablefmt="grid")


def format_json(data: Any) -> str:
    """Format data as JSON.

    Args:
        data: Data to format as JSON

    Returns:
        JSON-formatted string
    """
    return json.dumps(data, indent=2, default=str)


def format_error(message: str) -> str:
    """Format an error message.

    Args:
        message: Error message

    Returns:
        Formatted error string
    """
    return f"✗ Error: {message}"


def format_success(message: str) -> str:
    """Format a success message.

    Args:
        message: Success message

    Returns:
        Formatted success string
    """
    return f"✓ {message}"


def format_warning(message: str) -> str:
    """Format a warning message.

    Args:
        message: Warning message

    Returns:
        Formatted warning string
    """
    return f"⚠ Warning: {message}"


def format_info(message: str) -> str:
    """Format an info message.

    Args:
        message: Info message

    Returns:
        Formatted info string
    """
    return f"ℹ {message}"
