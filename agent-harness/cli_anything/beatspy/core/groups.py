"""Group management operations."""

from typing import Dict, Any, List, Optional
from cli_anything.beatspy.utils.api import BeatSpyAPIClient


class GroupOperations:
    """Operations for managing groups and group performance."""

    def __init__(self, api_client: BeatSpyAPIClient):
        """Initialize operations.

        Args:
            api_client: API client instance
        """
        self.api = api_client

    def list_for_class(self, class_id: str) -> List[Dict[str, Any]]:
        """List all groups in a class.

        Args:
            class_id: Class ID

        Returns:
            List of group dictionaries
        """
        params = {
            "select": "id,name,created_at",
            "class_id": f"eq.{class_id}",
            "order": "created_at.desc",
        }
        result = self.api.sb_get("groups", params=params)
        return result if isinstance(result, list) else []

    def get(self, group_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific group by ID.

        Args:
            group_id: Group ID

        Returns:
            Group dictionary or None if not found
        """
        params = {
            "select": "id,name,class_id,created_at,bio",
            "id": f"eq.{group_id}",
            "limit": "1",
        }
        result = self.api.sb_get("groups", params=params)
        if isinstance(result, list) and result:
            return result[0]
        return None

    def get_members(self, group_id: str) -> List[Dict[str, Any]]:
        """Get all members of a group with their portfolio performance.

        Args:
            group_id: Group ID

        Returns:
            List of member dictionaries with performance data
        """
        try:
            # Query the groups_users table (if it exists) or groups_members
            for table_name in ["groups_users", "group_members", "user_groups"]:
                params = {
                    "select": "user_id",
                    "group_id": f"eq.{group_id}",
                }
                members = self.api.sb_get(table_name, params=params)
                if isinstance(members, list) and members:
                    # Found the right table
                    user_ids = [m.get("user_id") for m in members if m.get("user_id")]

                    if user_ids:
                        # Get portfolio data for these users
                        portfolios_list = []
                        for uid in user_ids:
                            p_params = {
                                "select": "id,owner_id,cash_balance,starting_cash",
                                "owner_id": f"eq.{uid}",
                                "owner_type": "eq.user",
                                "limit": "1",
                            }
                            ports = self.api.sb_get("portfolios", params=p_params)
                            if isinstance(ports, list) and ports:
                                portfolios_list.append(ports[0])

                        # Get user profiles
                        profiles = self.api.sb_get("profiles", params={"select": "id,full_name"})
                        profile_map = {}
                        if isinstance(profiles, list):
                            profile_map = {p.get("id"): p.get("full_name", "Unknown") for p in profiles}

                        # Combine data
                        result = []
                        for port in portfolios_list:
                            user_id = port.get("owner_id")
                            result.append({
                                "user_id": user_id,
                                "name": profile_map.get(user_id, "Unknown"),
                                "portfolio_id": port.get("id"),
                                "cash_balance": port.get("cash_balance", 0),
                                "starting_cash": port.get("starting_cash", 0),
                                "pnl": port.get("cash_balance", 0) - port.get("starting_cash", 0),
                                "return_pct": (
                                    (port.get("cash_balance", 0) - port.get("starting_cash", 0))
                                    / port.get("starting_cash", 1)
                                    * 100
                                    if port.get("starting_cash", 0) > 0
                                    else 0
                                ),
                            })
                        return result

            # If no membership table found, return empty
            return []
        except Exception as e:
            # Silently return empty if membership table doesn't exist
            return []

    def get_leaderboard(self, class_id: str) -> List[Dict[str, Any]]:
        """Get leaderboard data for groups in a class.

        Aggregates portfolio performance by group.

        Args:
            class_id: Class ID

        Returns:
            List of groups ranked by aggregate returns
        """
        groups = self.list_for_class(class_id)

        group_data = []
        for group in groups:
            group_id = group.get("id")
            members = self.get_members(group_id)

            if members:
                total_pnl = sum([m.get("pnl", 0) for m in members])
                total_starting = sum([m.get("starting_cash", 0) for m in members])
                total_current = sum([m.get("cash_balance", 0) for m in members])
                group_return = (
                    (total_pnl / total_starting * 100)
                    if total_starting > 0
                    else 0
                )

                group_data.append({
                    "id": group_id,
                    "name": group.get("name", "Unknown"),
                    "member_count": len(members),
                    "total_starting": total_starting,
                    "total_current": total_current,
                    "total_pnl": total_pnl,
                    "return_pct": group_return,
                    "members": members,
                })

        # Sort by return percentage descending
        return sorted(group_data, key=lambda x: x["return_pct"], reverse=True)
