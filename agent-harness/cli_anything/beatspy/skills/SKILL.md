---
name: beatspy-cli
description: Interactive CLI for Beat the S&P 500 trading simulation management and analytics
type: cli
version: 1.0.0
tags:
  - trading
  - simulation
  - education
  - classes
  - analytics
command_groups:
  - class
  - portfolio
  - trade
  - tutorial
  - config
---

# Beat the S&P 500 CLI

Interactive command-line interface for managing educational trading simulations, student portfolios, and performance analytics. Built for teachers to manage classes and monitor student trading performance.

## Quick Start

### Installation

```bash
pip install -e agent-harness/
```

### Set API Credentials

```bash
export BEATSPY_JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  # Supabase JWT
export BEATSPY_SUPABASE_URL="https://xyzxyz.supabase.co"              # Supabase project URL
export BEATSPY_API_URL="https://beat-snp.com"                         # Vercel app URL (optional)
```

### Launch

```bash
cli-anything-beatspy
```

## Context System (Two-Level)

Beat the S&P 500 CLI uses a two-level context system:

```
>                       # Global context (manage classes, config)
[math-101]>             # Class context (manage portfolios, trades, leaderboard)
```

## Command Groups

### Class Operations (Global Context)

Manage and select classes.

```
> class list                # List all classes
> class select <id>         # Enter class context
> class show <id>           # View class details
```

**Example:**
```
> class list
┌────────┬────────────┬──────┬────────┐
│ ID     │ Name       │ Code │ School │
├────────┼────────────┼──────┼────────┤
│ cls123 │ Math 101   │ M101 │ High   │
│ cls456 │ Physics 102│ P102 │ High   │
└────────┴────────────┴──────┴────────┘

> class select cls123
✓ Entered class: Math 101

[math-101]> 
```

### Portfolio Operations (Class Context)

View student portfolios and holdings.

```
[class]> portfolio list             # List all portfolios in class
[class]> portfolio show <id>        # Show portfolio details and holdings
[class]> portfolio trades <id>      # View trade history
[class]> portfolio pending <id>     # View pending orders
```

**Example:**
```
[math-101]> portfolio list
┌────────┬───────────┬──────────────┬─────────┐
│ ID     │ Owner     │ Cash Balance │ Status  │
├────────┼───────────┼──────────────┼─────────┤
│ port1  │ user      │ $98,500.00   │ active  │
│ port2  │ user      │ $102,300.00  │ active  │
└────────┴───────────┴──────────────┴─────────┘

[math-101]> portfolio show port1
=== Portfolio ===
ID: port1
Status: active
Cash Balance: $98,500.00
Starting Cash: $100,000.00

=== Holdings (3) ===
┌────────┬─────────┬──────────┐
│ Ticker │ Shares  │ Avg Cost │
├────────┼─────────┼──────────┤
│ AAPL   │ 10.00   │ $150.00  │
│ MSFT   │ 5.00    │ $320.00  │
│ GOOGL  │ 2.00    │ $2,850.00│
└────────┴─────────┴──────────┘
```

### Trade Operations (Class Context)

Manage trades (view only in CLI — placement via API).

```
[class]> portfolio trades <id>      # View trade history
[class]> portfolio pending <id>     # View queued after-hours trades
```

**Example:**
```
[math-101]> portfolio trades port1
┌────────┬────────┬──────┬────────────┬─────────┬─────────┐
│ ID     │ Ticker │ Side │ Dollars    │ Shares  │ Price   │
├────────┼────────┼──────┼────────────┼─────────┼─────────┤
│ t1     │ AAPL   │ buy  │ $1,500.00  │ 10.00   │ $150.00 │
│ t2     │ MSFT   │ buy  │ $1,600.00  │ 5.00    │ $320.00 │
│ t3     │ GOOGL  │ buy  │ $5,700.00  │ 2.00    │ $2,850  │
└────────┴────────┴──────┴────────────┴─────────┴─────────┘

[math-101]> portfolio pending port1
┌────────┬────────┬──────┬────────────┬─────────────┐
│ ID     │ Ticker │ Side │ Dollars    │ Execute     │
├────────┼────────┼──────┼────────────┼─────────────┤
│ o1     │ TSLA   │ buy  │ $2,000.00  │ 2024-03-31  │
└────────┴────────┴──────┴────────────┴─────────────┘
```

### Leaderboard & Analytics (Class Context)

View class performance rankings.

```
[class]> leaderboard             # View class leaderboard
```

**Example:**
```
[math-101]> leaderboard
{
  "rankings": [
    {
      "rank": 1,
      "student": "Alice Smith",
      "return_percent": 15.2,
      "total_value": 115200,
      "portfolio_count": 1
    },
    {
      "rank": 2,
      "student": "Bob Johnson",
      "return_percent": 12.5,
      "total_value": 112500,
      "portfolio_count": 1
    }
  ],
  "class_id": "cls123",
  "generated_at": "2024-03-31T14:22:00Z"
}
```

### Training & Tutorials (Any Context)

Access educational content.

```
> tutorial list              # List available training tutorials
```

### Configuration (Global Context)

Manage API configuration.

```
> config show               # Show API settings
> config verify             # Test API connection
```

**Example:**
```
> config show
Supabase URL: https://xyzxyz.supabase.co
API URL: https://beat-snp.com
JWT Token: eyJhbGciOiJIUzI1NiIsI...
Class Selected: None

> config verify
✓ API connection verified. 3 class(es) accessible.
```

### Navigation

```
> back                      # Return to global context
> help                      # Show command help
> exit                      # Exit CLI
```

## API Credentials Setup

### Getting a Supabase JWT

The CLI requires a Supabase JWT token for authentication. You can obtain one by:

1. **Via Supabase Dashboard:**
   - Log into your Supabase project
   - Navigate to Authentication → Users
   - Create a test user or use an existing one
   - Manually create a JWT token

2. **Via Supabase Auth API:**
   ```bash
   curl -X POST "https://your-project.supabase.co/auth/v1/token?grant_type=password" \
     -H "apikey: YOUR_SUPABASE_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "user@example.com",
       "password": "password"
     }'
   ```

3. **For Development (Admin):**
   - Use a service key (admin credentials)
   - Set `BEATSPY_JWT_TOKEN` to your service key

### Setting Environment Variables

**Temporary (Current Session):**
```bash
export BEATSPY_JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
export BEATSPY_SUPABASE_URL="https://xyzxyz.supabase.co"
export BEATSPY_API_URL="https://beat-snp.com"
cli-anything-beatspy
```

**Persistent (Add to ~/.bash_profile or ~/.zshrc):**
```bash
export BEATSPY_JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
export BEATSPY_SUPABASE_URL="https://xyzxyz.supabase.co"
export BEATSPY_API_URL="https://beat-snp.com"
```

Then reload:
```bash
source ~/.bash_profile  # or source ~/.zshrc
```

## Command Reference

| Command | Context | Purpose |
|---------|---------|---------|
| `class list` | Global | List all classes |
| `class select` | Global | Select class context |
| `class show` | Global | View class details |
| `portfolio list` | Class | List portfolios in class |
| `portfolio show` | Class | View portfolio with holdings |
| `portfolio trades` | Class | View trade history |
| `portfolio pending` | Class | View pending orders |
| `leaderboard` | Class | View class leaderboard |
| `tutorial list` | Global | List training tutorials |
| `config show` | Global | Show API configuration |
| `config verify` | Global | Test API connection |
| `help` | Global | Show help message |
| `back` | Class | Return to global context |
| `exit` | Global | Exit CLI |

## Features

### Two-Level Context Navigation

- Navigate from global → class with `select` commands
- Use `back` to return to previous level
- Prompt changes to reflect current context

### Dual API Architecture

- **Supabase REST API** for data queries (classes, portfolios, trades, users)
- **Vercel Edge Functions** for complex operations (leaderboard, dashboard, trading)
- Both use the same JWT token for authentication

### Real-Time Data Access

- View live portfolio holdings and performance
- Monitor pending orders queued for next market open
- Access class leaderboard with ranking data

### Role-Based Access

- **Admin**: View all classes and users, manage system
- **Teacher**: Create/manage classes, view student portfolios, send lessons
- **Student**: View own portfolio, place trades

## Troubleshooting

### "BEATSPY_JWT_TOKEN not set"

Set the environment variable:
```bash
export BEATSPY_JWT_TOKEN="your-jwt-token"
```

### "BEATSPY_SUPABASE_URL not set"

Set the environment variable:
```bash
export BEATSPY_SUPABASE_URL="https://your-project.supabase.co"
```

### "401 Unauthorized"

Your JWT token is invalid or expired:
- Check that the token is correct
- If using Supabase, create a new JWT via the auth API
- Ensure the user has appropriate role

### "Connection refused"

The API is not accessible:
```bash
> config verify
```

Check `BEATSPY_API_URL` (default: `https://beat-snp.com`)

### "No data to display"

This may be normal if:
- No classes have been created yet
- No portfolios exist in the selected class
- You don't have permission to view that class

## Development

### Run Tests

```bash
cd agent-harness
python3 -m pytest cli_anything/beatspy/tests/ -v
```

### Code Quality

```bash
black cli_anything/beatspy/
flake8 cli_anything/beatspy/ --max-line-length=120
```

## API Architecture

### Supabase REST API

Direct access to PostgreSQL tables via REST:
- `GET /rest/v1/{table}` — Query rows
- `PATCH /rest/v1/{table}` — Update rows
- Authentication: `Authorization: Bearer {JWT}`

### Vercel Edge Functions

Complex business logic at `/api/{endpoint}`:
- `/api/teacher-leaderboard` — Get class leaderboard
- `/api/teacher-dashboard-data` — Get dashboard metrics
- `/api/place-trade` — Place a trade
- `/api/send-lesson` — Send AI-enhanced lesson

## Support

Contact the MYeCFO development team for issues or feature requests.

## Version

Current version: 1.0.0

## License

MYeCFO Internal Tool
