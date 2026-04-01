"""Dual API client for Supabase REST and Vercel edge functions."""

import os
import requests
from typing import Dict, Any, Optional


class BeatSpyAPIClient:
    """Client for beat-SPY API with Supabase REST and Vercel edge function support."""

    def __init__(
        self,
        jwt_token: Optional[str] = None,
        supabase_url: Optional[str] = None,
        api_url: Optional[str] = None,
    ):
        """Initialize API client.

        Args:
            jwt_token: Supabase JWT (reads from BEATSPY_JWT_TOKEN env var if not provided)
            supabase_url: Supabase project URL (reads from BEATSPY_SUPABASE_URL if not provided)
            api_url: Vercel API URL (reads from BEATSPY_API_URL, default: https://beat-snp.com)

        Raises:
            ValueError: If JWT token is not provided and env var not set.
        """
        self.jwt_token = jwt_token or os.environ.get("BEATSPY_JWT_TOKEN")
        if not self.jwt_token:
            raise ValueError(
                "BEATSPY_JWT_TOKEN environment variable not set. "
                "Please set it and try again."
            )

        self.supabase_url = supabase_url or os.environ.get("BEATSPY_SUPABASE_URL")
        if not self.supabase_url:
            raise ValueError(
                "BEATSPY_SUPABASE_URL environment variable not set. "
                "Please set it and try again."
            )
        self.supabase_url = self.supabase_url.rstrip("/")

        self.api_url = (
            api_url or os.environ.get("BEATSPY_API_URL", "https://beat-snp.com")
        ).rstrip("/")

    def _request(
        self,
        method: str,
        url: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make HTTP request to API.

        Args:
            method: HTTP method (GET, POST, PATCH, DELETE)
            url: Full URL for the request
            data: Request body (for POST/PATCH)
            params: Query parameters

        Returns:
            Response JSON dict (or empty dict for 204)

        Raises:
            requests.exceptions.RequestException: On HTTP error
        """
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
        }

        try:
            if method == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == "POST":
                response = requests.post(
                    url, headers=headers, json=data, params=params, timeout=30
                )
            elif method == "PATCH":
                response = requests.patch(
                    url, headers=headers, json=data, params=params, timeout=30
                )
            elif method == "DELETE":
                response = requests.delete(
                    url, headers=headers, params=params, timeout=30
                )
            else:
                raise ValueError(f"Unsupported method: {method}")

            # Handle 204 No Content
            if response.status_code == 204:
                return {}

            # Parse JSON response
            try:
                response_data = response.json()
            except ValueError:
                response_data = {}

            # Check for errors
            if response.status_code >= 400:
                error_msg = (
                    response_data.get("error")
                    or response_data.get("message")
                    or response.text
                )
                raise requests.exceptions.HTTPError(
                    f"{response.status_code}: {error_msg}", response=response
                )

            return response_data

        except requests.exceptions.Timeout:
            raise requests.exceptions.RequestException(
                "Request timed out after 30 seconds"
            )
        except requests.exceptions.ConnectionError:
            raise requests.exceptions.RequestException(
                f"Failed to connect to API at {self.api_url}"
            )

    def sb_get(self, table: str, params: Optional[Dict[str, str]] = None) -> Any:
        """GET request to Supabase REST API.

        Args:
            table: Table name
            params: Query parameters (select, filter, order, etc.)

        Returns:
            Response data (array for GET, object for single row)
        """
        url = f"{self.supabase_url}/rest/v1/{table}"
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
        }

        try:
            response = requests.get(url, headers=headers, params=params, timeout=30)

            if response.status_code == 204:
                return None

            response_data = response.json()

            if response.status_code >= 400:
                error_msg = (
                    response_data.get("error")
                    if isinstance(response_data, dict)
                    else response.text
                )
                raise requests.exceptions.HTTPError(
                    f"{response.status_code}: {error_msg}", response=response
                )

            return response_data

        except requests.exceptions.Timeout:
            raise requests.exceptions.RequestException(
                "Request timed out after 30 seconds"
            )
        except requests.exceptions.ConnectionError:
            raise requests.exceptions.RequestException(
                f"Failed to connect to Supabase at {self.supabase_url}"
            )

    def sb_patch(self, table: str, filter_str: str, data: Dict[str, Any]) -> Any:
        """PATCH request to Supabase REST API.

        Args:
            table: Table name
            filter_str: Filter string (e.g., "id=eq.uuid")
            data: Data to update

        Returns:
            Updated row data
        """
        url = f"{self.supabase_url}/rest/v1/{table}?{filter_str}"
        headers = {
            "Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

        try:
            response = requests.patch(url, headers=headers, json=data, timeout=30)

            response_data = response.json()

            if response.status_code >= 400:
                error_msg = (
                    response_data.get("error")
                    if isinstance(response_data, dict)
                    else response.text
                )
                raise requests.exceptions.HTTPError(
                    f"{response.status_code}: {error_msg}", response=response
                )

            return response_data

        except requests.exceptions.Timeout:
            raise requests.exceptions.RequestException(
                "Request timed out after 30 seconds"
            )
        except requests.exceptions.ConnectionError:
            raise requests.exceptions.RequestException(
                f"Failed to connect to Supabase at {self.supabase_url}"
            )

    def edge_get(self, path: str, params: Optional[Dict[str, str]] = None) -> Any:
        """GET request to Vercel edge function.

        Args:
            path: API path (e.g., /api/admin-users)
            params: Query parameters

        Returns:
            Response data
        """
        url = f"{self.api_url}{path}"
        return self._request("GET", url, params=params)

    def edge_post(self, path: str, data: Optional[Dict[str, Any]] = None) -> Any:
        """POST request to Vercel edge function.

        Args:
            path: API path (e.g., /api/place-trade)
            data: Request body

        Returns:
            Response data
        """
        url = f"{self.api_url}{path}"
        return self._request("POST", url, data=data)
