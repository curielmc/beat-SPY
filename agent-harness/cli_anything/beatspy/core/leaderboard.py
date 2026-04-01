"""Leaderboard and analytics operations."""

from typing import Dict, Any
from cli_anything.beatspy.utils.api import BeatSpyAPIClient


class LeaderboardOperations:
    """Operations for leaderboards and analytics."""

    def __init__(self, api_client: BeatSpyAPIClient):
        """Initialize operations.

        Args:
            api_client: API client instance
        """
        self.api = api_client

    def get(self, class_id: str) -> Dict[str, Any]:
        """Get leaderboard data for a class.

        Args:
            class_id: Class ID

        Returns:
            Leaderboard data dictionary
        """
        data = {"class_id": class_id}
        return self.api.edge_post("/api/teacher-leaderboard", data=data)
