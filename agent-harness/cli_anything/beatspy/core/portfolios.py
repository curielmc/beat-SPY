"""Portfolio management operations."""

from typing import Dict, Any, List, Optional
from cli_anything.beatspy.utils.api import BeatSpyAPIClient


class PortfolioOperations:
    """Operations for managing portfolios."""

    def __init__(self, api_client: BeatSpyAPIClient):
        """Initialize operations.

        Args:
            api_client: API client instance
        """
        self.api = api_client

    def list_for_class(self, class_id: str) -> List[Dict[str, Any]]:
        """List portfolios for all students in a class.

        Args:
            class_id: Class ID

        Returns:
            List of portfolio dictionaries
        """
        # Get all class members
        params = {
            "select": "user_id",
            "class_id": f"eq.{class_id}",
        }
        members = self.api.sb_get("class_memberships", params=params)
        if not isinstance(members, list):
            return []

        user_ids = [m.get("user_id") for m in members if m.get("user_id")]
        if not user_ids:
            return []

        # Get portfolios for these users
        user_filter = ",".join(f'"{uid}"' for uid in user_ids)
        params = {
            "select": "id,owner_type,owner_id,starting_cash,cash_balance,status,fund_name,created_at",
            "owner_type": "eq.user",
            "owner_id": f"in.({user_filter})",
            "order": "created_at.desc",
        }
        result = self.api.sb_get("portfolios", params=params)
        return result if isinstance(result, list) else []

    def get(self, portfolio_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific portfolio by ID with holdings.

        Args:
            portfolio_id: Portfolio ID

        Returns:
            Portfolio dictionary with holdings or None
        """
        params = {
            "select": "id,owner_type,owner_id,starting_cash,cash_balance,status,fund_name,created_at",
            "id": f"eq.{portfolio_id}",
            "limit": "1",
        }
        result = self.api.sb_get("portfolios", params=params)
        if not isinstance(result, list) or not result:
            return None

        portfolio = result[0]

        # Get holdings for this portfolio
        holdings_params = {
            "select": "id,ticker,shares,avg_cost",
            "portfolio_id": f"eq.{portfolio_id}",
        }
        holdings = self.api.sb_get("holdings", params=holdings_params)
        portfolio["holdings"] = holdings if isinstance(holdings, list) else []

        return portfolio

    def trades(self, portfolio_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get trade history for a portfolio.

        Args:
            portfolio_id: Portfolio ID
            limit: Maximum number of trades to return

        Returns:
            List of trade dictionaries
        """
        params = {
            "select": "id,ticker,side,dollars,shares,price,rationale,executed_at,user_id",
            "portfolio_id": f"eq.{portfolio_id}",
            "order": "executed_at.desc",
            "limit": str(limit),
        }
        result = self.api.sb_get("trades", params=params)
        return result if isinstance(result, list) else []

    def pending(self, portfolio_id: str) -> List[Dict[str, Any]]:
        """Get pending trade orders for a portfolio.

        Args:
            portfolio_id: Portfolio ID

        Returns:
            List of pending order dictionaries
        """
        params = {
            "select": "id,ticker,side,dollars,status,submitted_price,execute_after,requested_at",
            "portfolio_id": f"eq.{portfolio_id}",
            "status": "eq.queued",
        }
        result = self.api.sb_get("pending_trade_orders", params=params)
        return result if isinstance(result, list) else []
