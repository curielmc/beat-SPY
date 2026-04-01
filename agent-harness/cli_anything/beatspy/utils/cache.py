"""Session cache for managing CLI context state."""

from typing import Optional


class SessionCache:
    """Manages CLI session state including class selection."""

    def __init__(self):
        """Initialize empty session cache."""
        self._class_id: Optional[str] = None
        self._class_name: Optional[str] = None

    def set_class(self, class_dict: dict) -> None:
        """Set the current class context.

        Args:
            class_dict: Class dictionary with 'id' and 'class_name' keys
        """
        self._class_id = class_dict.get("id")
        self._class_name = class_dict.get("class_name")

    def clear_class(self) -> None:
        """Clear the current class context."""
        self._class_id = None
        self._class_name = None

    @property
    def class_id(self) -> Optional[str]:
        """Get current class ID."""
        return self._class_id

    @property
    def class_name(self) -> Optional[str]:
        """Get current class name."""
        return self._class_name

    @property
    def class_slug(self) -> str:
        """Get slugified class name for prompt display."""
        if not self._class_name:
            return ""
        slug = (
            self._class_name.lower()
            .replace(" ", "-")
            .replace("_", "-")
            .replace(".", "-")
        )
        # Remove non-alphanumeric except hyphens
        slug = "".join(c if c.isalnum() or c == "-" else "" for c in slug)
        # Limit to 20 chars
        return slug[:20]

    def is_in_class(self) -> bool:
        """Check if a class is currently selected."""
        return self._class_id is not None
