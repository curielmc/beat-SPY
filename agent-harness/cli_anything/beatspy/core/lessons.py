"""Lesson and tutorial operations."""

from typing import Dict, Any, List
from cli_anything.beatspy.utils.api import BeatSpyAPIClient


class LessonOperations:
    """Operations for managing lessons and training."""

    def __init__(self, api_client: BeatSpyAPIClient):
        """Initialize operations.

        Args:
            api_client: API client instance
        """
        self.api = api_client

    def list_tutorials(self) -> List[Dict[str, Any]]:
        """List available training tutorials.

        Returns:
            List of tutorial dictionaries
        """
        params = {
            "select": "id,title,slug,description,category,status,position",
            "status": "eq.active",
            "order": "position.asc",
        }
        result = self.api.sb_get("training_tutorials", params=params)
        return result if isinstance(result, list) else []

    def send(self, class_id: str, portfolio_id: str) -> Dict[str, Any]:
        """Send AI-enhanced lesson to portfolio owner.

        Args:
            class_id: Class ID
            portfolio_id: Portfolio ID

        Returns:
            Result dictionary
        """
        data = {
            "class_id": class_id,
            "portfolio_id": portfolio_id,
        }
        return self.api.edge_post("/api/send-lesson", data=data)

    def tutorial_steps(self, tutorial_id: str) -> List[Dict[str, Any]]:
        """Get steps for a tutorial.

        Args:
            tutorial_id: Tutorial ID

        Returns:
            List of step dictionaries
        """
        params = {
            "select": "id,title,slug,description,position,duration_minutes",
            "training_tutorial_id": f"eq.{tutorial_id}",
            "order": "position.asc",
        }
        result = self.api.sb_get("training_steps", params=params)
        return result if isinstance(result, list) else []
