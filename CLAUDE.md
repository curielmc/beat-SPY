# CLAUDE.md

## Web Browsing & QA (gstack)

Use the `/browse` skill from gstack for **all web browsing** — never use `mcp__claude-in-chrome__*` tools.

Available gstack skills:

| Skill | Purpose |
|-------|---------|
| `/office-hours` | Brainstorm sessions |
| `/plan-ceo-review` | CEO-level strategy review |
| `/plan-eng-review` | Engineering architecture review |
| `/plan-design-review` | Design plan review |
| `/design-consultation` | Design consultation |
| `/review` | Code review |
| `/ship` | Ship code |
| `/land-and-deploy` | Land and deploy |
| `/canary` | Canary deployment |
| `/benchmark` | Performance benchmarking |
| `/browse` | Headless web browsing |
| `/qa` | QA testing |
| `/qa-only` | QA testing only |
| `/design-review` | Visual design audit |
| `/setup-browser-cookies` | Configure browser cookies |
| `/setup-deploy` | Configure deployment |
| `/retro` | Retrospective |
| `/investigate` | Debugging investigation |
| `/document-release` | Release documentation |
| `/codex` | Second opinion |
| `/cso` | CSO review |
| `/autoplan` | Auto-review and plan |
| `/careful` | Production safety check |
| `/freeze` | Scoped edit freeze |
| `/guard` | Production guard |
| `/unfreeze` | Remove edit freeze |
| `/gstack-upgrade` | Upgrade gstack |

If gstack skills aren't working, run `cd .claude/skills/gstack && ./setup` to build the binary and register skills.
