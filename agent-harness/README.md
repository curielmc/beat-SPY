# cli-anything-beatspy

Interactive CLI for Beat the S&P 500 trading simulation management and analytics.

## Installation

```bash
cd agent-harness/
pip install -e .
```

## Setup

Set environment variables:

```bash
export BEATSPY_JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  # Supabase JWT
export BEATSPY_SUPABASE_URL="https://xyzxyz.supabase.co"              # Supabase URL
export BEATSPY_API_URL="https://beat-snp.com"                         # Vercel app URL (optional)
```

## Launch

```bash
cli-anything-beatspy
```

## Quick Example

```
> class list
> class select cls123
[math-101]> portfolio list
[math-101]> portfolio show port1
[math-101]> leaderboard
[math-101]> back
> exit
```

## Features

- **Two-Level Context** — Navigate from global to class context
- **Class Management** — List and select classes (courses)
- **Portfolio Monitoring** — View student portfolios, holdings, trade history
- **Performance Analytics** — View class leaderboard and rankings
- **Trading Insights** — Track pending orders and trade history
- **Training Management** — Access educational tutorials
- **Command History** — Persistent across sessions (`~/.beatspy_cli/history`)

## Commands

### Global Context

```
class list [--search NAME]
class select <id>
class show <id>
tutorial list
config show / verify
help, exit
```

### Class Context

```
portfolio list
portfolio show <id>
portfolio trades <id>
portfolio pending <id>
leaderboard
back
```

## Test Suite

Run all tests:

```bash
python3 -m pytest cli_anything/beatspy/tests/ -v
```

## Code Quality

Format code:

```bash
black cli_anything/beatspy/
```

Check linting:

```bash
flake8 cli_anything/beatspy/ --max-line-length=120
```

## Architecture

- **`beatspy_cli.py`** — REPL shell with command dispatch
- **`core/`** — Business logic (classes, portfolios, trades, lessons, leaderboard)
- **`utils/`** — API client (Supabase REST + Vercel edge functions), session cache, output formatting
- **`tests/`** — 50+ unit tests + 3 E2E tests (skipped unless CLI installed)

All operations use two distinct APIs:
- **Supabase REST API** (`/rest/v1/`) — CRUD on tables (classes, portfolios, trades, users)
- **Vercel Edge Functions** (`/api/`) — Complex operations (leaderboard, trades, lessons)

Both use the same JWT token for authentication.

## API Documentation

See `/cli_anything/beatspy/skills/SKILL.md` for full API reference and examples.
