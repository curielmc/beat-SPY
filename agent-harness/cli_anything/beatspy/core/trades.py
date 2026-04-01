"""Trade operations."""

from typing import Dict, Any
from cli_anything.beatspy.utils.api import BeatSpyAPIClient


class TradeOperations:
    """Operations for managing trades."""

    def __init__(self, api_client: BeatSpyAPIClient):
        """Initialize operations.

        Args:
            api_client: API client instance
        """
        self.api = api_client

    def place(
        self,
        portfolio_id: str,
        ticker: str,
        side: str,
        dollars: float,
        rationale: str = "",
    ) -> Dict[str, Any]:
        """Place a trade for a portfolio.

        Args:
            portfolio_id: Portfolio ID
            ticker: Stock ticker symbol
            side: Trade side (buy or sell)
            dollars: Dollar amount
            rationale: Optional trade rationale

        Returns:
            Trade result dictionary with execution details
        """
        data = {
            "portfolio_id": portfolio_id,
            "ticker": ticker,
            "side": side,
            "dollars": dollars,
            "rationale": rationale,
        }
        return self.api.edge_post("/api/place-trade", data=data)
