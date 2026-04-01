"""Beat the S&P 500 interactive CLI application."""

import os
import sys
from prompt_toolkit import PromptSession
from prompt_toolkit.history import FileHistory
from pathlib import Path

from cli_anything.beatspy.utils.api import BeatSpyAPIClient
from cli_anything.beatspy.utils.cache import SessionCache
from cli_anything.beatspy.utils.formatting import (
    format_table,
    format_json,
    format_error,
    format_success,
    format_warning,
)
from cli_anything.beatspy.core.classes import ClassOperations
from cli_anything.beatspy.core.users import UserOperations
from cli_anything.beatspy.core.portfolios import PortfolioOperations
from cli_anything.beatspy.core.trades import TradeOperations
from cli_anything.beatspy.core.lessons import LessonOperations
from cli_anything.beatspy.core.leaderboard import LeaderboardOperations


class BeatSpyCLI:
    """Interactive CLI for beat-SPY management."""

    def __init__(self):
        """Initialize the CLI application."""
        try:
            self.api = BeatSpyAPIClient()
        except ValueError as e:
            print(format_error(str(e)))
            sys.exit(1)

        self.cache = SessionCache()
        self.classes_ops = ClassOperations(self.api)
        self.users_ops = UserOperations(self.api)
        self.portfolios_ops = PortfolioOperations(self.api)
        self.trades_ops = TradeOperations(self.api)
        self.lessons_ops = LessonOperations(self.api)
        self.leaderboard_ops = LeaderboardOperations(self.api)

        # Setup history file
        history_dir = Path.home() / ".beatspy_cli"
        history_dir.mkdir(exist_ok=True)
        self.history_file = history_dir / "history"

    def get_prompt(self) -> str:
        """Get the current prompt based on context."""
        if self.cache.is_in_class():
            return f"[{self.cache.class_slug}]> "
        return "> "

    def format_classes(self, classes: list) -> str:
        """Format classes for display."""
        if not classes:
            return "No classes found."
        display = [
            {
                "ID": c.get("id", "")[:8],
                "Name": c.get("class_name", ""),
                "Code": c.get("code", ""),
                "School": c.get("school", ""),
            }
            for c in classes
        ]
        return format_table(display)

    def cmd_class_list(self, args: list) -> None:
        """List all classes."""
        try:
            classes = self.classes_ops.list()
            print(self.format_classes(classes))
        except Exception as e:
            print(format_error(str(e)))

    def cmd_class_select(self, args: list) -> None:
        """Select a class by ID."""
        if not args:
            print(format_error("Usage: class select <id>"))
            return

        class_id = args[0]
        try:
            class_obj = self.classes_ops.get(class_id)
            if not class_obj:
                print(format_error(f"Class not found: {class_id}"))
                return

            self.cache.set_class(class_obj)
            print(
                format_success(
                    f"Entered class: {class_obj.get('class_name', class_id)}"
                )
            )
        except Exception as e:
            print(format_error(str(e)))

    def cmd_class_show(self, args: list) -> None:
        """Show class details."""
        if not args:
            print(format_error("Usage: class show <id>"))
            return

        class_id = args[0]
        try:
            class_obj = self.classes_ops.get(class_id)
            if not class_obj:
                print(format_error(f"Class not found: {class_id}"))
                return

            print(format_json(class_obj))
        except Exception as e:
            print(format_error(str(e)))

    def cmd_portfolio_list(self, args: list) -> None:
        """List portfolios in current class."""
        if not self.cache.is_in_class():
            print(format_error("No class selected. Use 'class select <id>' first."))
            return

        try:
            portfolios = self.portfolios_ops.list_for_class(self.cache.class_id)
            if not portfolios:
                print("No portfolios found in this class.")
                return

            display = [
                {
                    "ID": p.get("id", "")[:8],
                    "Owner": p.get("owner_type", ""),
                    "Cash": f"${p.get('cash_balance', 0):,.2f}",
                    "Status": p.get("status", ""),
                    "Fund": p.get("fund_name", "-"),
                }
                for p in portfolios
            ]
            print(format_table(display))
        except Exception as e:
            print(format_error(str(e)))

    def cmd_portfolio_show(self, args: list) -> None:
        """Show portfolio details with holdings."""
        if not args:
            print(format_error("Usage: portfolio show <id>"))
            return

        portfolio_id = args[0]
        try:
            portfolio = self.portfolios_ops.get(portfolio_id)
            if not portfolio:
                print(format_error(f"Portfolio not found: {portfolio_id}"))
                return

            print("\n=== Portfolio ===")
            print(
                f"ID: {portfolio.get('id', '')[:8]}\n"
                f"Status: {portfolio.get('status', '')}\n"
                f"Cash Balance: ${portfolio.get('cash_balance', 0):,.2f}\n"
                f"Starting Cash: ${portfolio.get('starting_cash', 0):,.2f}"
            )

            holdings = portfolio.get("holdings", [])
            if holdings:
                print(f"\n=== Holdings ({len(holdings)}) ===")
                display = [
                    {
                        "Ticker": h.get("ticker", ""),
                        "Shares": f"{h.get('shares', 0):,.0f}",
                        "Avg Cost": f"${h.get('avg_cost', 0):,.2f}",
                    }
                    for h in holdings
                ]
                print(format_table(display))
        except Exception as e:
            print(format_error(str(e)))

    def cmd_portfolio_trades(self, args: list) -> None:
        """Show trade history for portfolio."""
        if not args:
            print(format_error("Usage: portfolio trades <id>"))
            return

        portfolio_id = args[0]
        try:
            trades = self.portfolios_ops.trades(portfolio_id, limit=20)
            if not trades:
                print("No trades found for this portfolio.")
                return

            display = [
                {
                    "ID": t.get("id", "")[:8],
                    "Ticker": t.get("ticker", ""),
                    "Side": t.get("side", ""),
                    "Dollars": f"${t.get('dollars', 0):,.2f}",
                    "Shares": f"{t.get('shares', 0):,.2f}",
                    "Price": f"${t.get('price', 0):,.2f}",
                }
                for t in trades
            ]
            print(format_table(display))
        except Exception as e:
            print(format_error(str(e)))

    def cmd_portfolio_pending(self, args: list) -> None:
        """Show pending orders for portfolio."""
        if not args:
            print(format_error("Usage: portfolio pending <id>"))
            return

        portfolio_id = args[0]
        try:
            pending = self.portfolios_ops.pending(portfolio_id)
            if not pending:
                print("No pending orders for this portfolio.")
                return

            display = [
                {
                    "ID": p.get("id", "")[:8],
                    "Ticker": p.get("ticker", ""),
                    "Side": p.get("side", ""),
                    "Dollars": f"${p.get('dollars', 0):,.2f}",
                    "Status": p.get("status", ""),
                    "Execute After": p.get("execute_after", ""),
                }
                for p in pending
            ]
            print(format_table(display))
        except Exception as e:
            print(format_error(str(e)))

    def cmd_leaderboard(self, args: list) -> None:
        """Show class leaderboard."""
        if not self.cache.is_in_class():
            print(format_error("No class selected. Use 'class select <id>' first."))
            return

        try:
            leaderboard_data = self.leaderboard_ops.get(self.cache.class_id)
            print(format_json(leaderboard_data))
        except Exception as e:
            print(format_error(str(e)))

    def cmd_tutorial_list(self, args: list) -> None:
        """List available training tutorials."""
        try:
            tutorials = self.lessons_ops.list_tutorials()
            if not tutorials:
                print("No tutorials available.")
                return

            display = [
                {
                    "ID": t.get("id", "")[:8],
                    "Title": t.get("title", ""),
                    "Category": t.get("category", ""),
                    "Status": t.get("status", ""),
                }
                for t in tutorials
            ]
            print(format_table(display))
        except Exception as e:
            print(format_error(str(e)))

    def cmd_config_show(self, args: list) -> None:
        """Show API configuration."""
        supabase_url = os.environ.get("BEATSPY_SUPABASE_URL", "not set")
        api_url = os.environ.get("BEATSPY_API_URL", "https://beat-snp.com")
        token = os.environ.get("BEATSPY_JWT_TOKEN", "")
        masked_token = (token[:20] + "...") if token else "not set"

        print(
            f"Supabase URL: {supabase_url}\n"
            f"API URL: {api_url}\n"
            f"JWT Token: {masked_token}\n"
            f"Class Selected: {self.cache.class_name if self.cache.is_in_class() else 'None'}"
        )

    def cmd_config_verify(self, args: list) -> None:
        """Verify API connection."""
        try:
            classes = self.classes_ops.list()
            class_count = len(classes) if isinstance(classes, list) else 0
            print(
                format_success(
                    f"API connection verified. {class_count} class(es) accessible."
                )
            )
        except Exception as e:
            print(format_error(f"API connection failed: {str(e)}"))

    def cmd_help(self, args: list) -> None:
        """Show help message."""
        help_text = """
Beat the S&P 500 CLI Commands:

Global Context:
  class list              - List all classes
  class select <id>       - Select a class (enter class context)
  class show <id>         - Show class details
  config show             - Show API configuration
  config verify           - Verify API connection
  help                    - Show this help message
  exit                    - Exit the CLI
  back                    - Return to global context (from class context)

Class Context:
  portfolio list          - List portfolios in class
  portfolio show <id>     - Show portfolio details and holdings
  portfolio trades <id>   - Show trade history
  portfolio pending <id>  - Show pending orders
  tutorial list           - List available training tutorials
  leaderboard             - Show class leaderboard
"""
        print(help_text)

    def cmd_back(self, args: list) -> None:
        """Return to global context."""
        if self.cache.is_in_class():
            self.cache.clear_class()
            print(format_success("Returned to global context"))
        else:
            print(format_warning("Already in global context"))

    def cmd_exit(self, args: list) -> None:
        """Exit the CLI."""
        print("Goodbye!")
        sys.exit(0)

    def parse_command(self, line: str) -> tuple:
        """Parse a command line into command and arguments.

        Args:
            line: Input command line

        Returns:
            Tuple of (command, args)
        """
        parts = line.strip().split()
        if not parts:
            return None, []

        command = parts[0]
        args = parts[1:]
        return command, args

    def handle_command(self, command: str, args: list) -> None:
        """Handle a command.

        Args:
            command: Command name
            args: Command arguments
        """
        # Build command method name
        cmd_method = f"cmd_{command.replace(' ', '_')}"

        if hasattr(self, cmd_method):
            getattr(self, cmd_method)(args)
        else:
            print(format_error(f"Unknown command: {command}"))

    def run(self) -> None:
        """Run the interactive CLI."""
        session = PromptSession(history=FileHistory(str(self.history_file)))

        print("Beat the S&P 500 CLI (type 'help' for commands)")

        while True:
            try:
                prompt = self.get_prompt()
                line = session.prompt(prompt)

                if not line.strip():
                    continue

                # Handle multi-word commands
                if line.startswith("class "):
                    cmd = "class " + line[6:].split()[0]
                    rest = line[6 + len(cmd.split()[-1]) + 1:].strip()
                    args = rest.split() if rest else []
                elif line.startswith("portfolio "):
                    cmd = "portfolio " + line[9:].split()[0]
                    rest = line[9 + len(cmd.split()[-1]) + 1:].strip()
                    args = rest.split() if rest else []
                elif line.startswith("config "):
                    cmd = "config " + line[7:].split()[0]
                    rest = line[7 + len(cmd.split()[-1]) + 1:].strip()
                    args = rest.split() if rest else []
                else:
                    cmd, args = self.parse_command(line)

                self.handle_command(cmd, args)

            except KeyboardInterrupt:
                print("\nUse 'exit' to quit")
            except EOFError:
                print("\nGoodbye!")
                break


def main():
    """Entry point for the CLI application."""
    cli = BeatSpyCLI()
    cli.run()


if __name__ == "__main__":
    main()
