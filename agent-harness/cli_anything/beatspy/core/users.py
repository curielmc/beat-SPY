"""User management operations."""

from typing import Dict, Any, List, Optional
from cli_anything.beatspy.utils.api import BeatSpyAPIClient


class UserOperations:
    """Operations for managing users."""

    def __init__(self, api_client: BeatSpyAPIClient):
        """Initialize operations.

        Args:
            api_client: API client instance
        """
        self.api = api_client

    def list(self) -> List[Dict[str, Any]]:
        """List all users.

        Returns:
            List of user dictionaries
        """
        try:
            # Try admin endpoint first
            result = self.api.edge_get("/api/admin-users")
            if isinstance(result, dict) and "users" in result:
                return result["users"]
        except Exception:
            pass

        # Fallback to Supabase direct query
        params = {
            "select": "id,email,full_name,role,created_at",
            "order": "created_at.desc",
        }
        result = self.api.sb_get("profiles", params=params)
        return result if isinstance(result, list) else []

    def get(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific user by ID.

        Args:
            user_id: User ID (UUID)

        Returns:
            User dictionary or None if not found
        """
        params = {
            "select": "id,email,full_name,role,created_at",
            "id": f"eq.{user_id}",
            "limit": "1",
        }
        result = self.api.sb_get("profiles", params=params)
        if isinstance(result, list) and result:
            return result[0]
        return None

    def update_role(self, user_id: str, role: str) -> Optional[Dict[str, Any]]:
        """Update user role.

        Args:
            user_id: User ID
            role: New role (admin, teacher, or student)

        Returns:
            Updated user dictionary or None
        """
        filter_str = f"id=eq.{user_id}"
        data = {"role": role}
        result = self.api.sb_patch("profiles", filter_str, data)
        if isinstance(result, list) and result:
            return result[0]
        return None
