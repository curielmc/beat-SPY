"""Class management operations."""

from typing import Dict, Any, List, Optional
from cli_anything.beatspy.utils.api import BeatSpyAPIClient


class ClassOperations:
    """Operations for managing classes."""

    def __init__(self, api_client: BeatSpyAPIClient):
        """Initialize operations.

        Args:
            api_client: API client instance
        """
        self.api = api_client

    def list(self) -> List[Dict[str, Any]]:
        """List all classes.

        Returns:
            List of class dictionaries
        """
        params = {
            "select": "id,class_name,code,school,teacher_id,created_at",
            "order": "created_at.desc",
        }
        result = self.api.sb_get("classes", params=params)
        return result if isinstance(result, list) else []

    def get(self, class_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific class by ID.

        Args:
            class_id: Class ID (UUID)

        Returns:
            Class dictionary or None if not found
        """
        params = {
            "select": "id,class_name,code,school,teacher_id,created_at",
            "id": f"eq.{class_id}",
            "limit": "1",
        }
        result = self.api.sb_get("classes", params=params)
        if isinstance(result, list) and result:
            return result[0]
        return None

    def dashboard(self, class_id: str) -> Dict[str, Any]:
        """Get teacher dashboard data for a class.

        Args:
            class_id: Class ID

        Returns:
            Dashboard data including portfolios, holdings, trades
        """
        data = {"class_id": class_id}
        return self.api.edge_post("/api/teacher-dashboard-data", data=data)
