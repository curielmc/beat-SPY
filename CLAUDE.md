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

## Design Context (impeccable)

Design source of truth lives in `PRODUCT.md` (strategy: register=product, student trading game, playful+competitive + finance-credible, WCAG AA) and `DESIGN.md` (Vue 3 + Tailwind v4 + DaisyUI v5, dark-first, Inter).

Custom DaisyUI theme in `src/style.css` (themes named `light`/`dark` so `data-theme` stays compatible):
- **primary** = teal-cyan — actions, selection, active state.
- **secondary** = gold — achievement only (leaderboard, wins, streaks; the "beat SPY" hook).
- semantics conventional (success/error/warning/info); gain/loss must pair color with sign/arrow (color-blind a11y).

Improve UI with `/impeccable <command> <target>` (critique, audit, polish, animate, delight, live). Run `/impeccable document` after token changes to refresh DESIGN.md.

## Dashboard building philosophy — the 5 pillars (adopted by Martin, 2026-11-06)

Source: RoboNuggets, "Anthropic Just Launched Claude DASHBOARDS" (youtube.com/watch?v=9RPUZLJ4v7Q), building on *Information Dashboard Design* (2006). Martin directed that every dashboard built in this repo follow this philosophy. Never one-shot a dashboard — an unplanned build produces chart junk and a vibecoded mess.

Build in this order: **Why → Where → What → How → When.**

1. **Why — the goal.** Before building anything, interview the user one question at a time until the dashboard's goal can be written in one sentence. Classify the dashboard first:
   - *Operational* — what's happening in the business right now?
   - *Strategic* — how are we tracking towards our goals?
   - *Analytical* — what insights would get us to those goals faster?
   Then name the 1–3 decisions the dashboard should help make, and who will look at it. A dashboard without a clear goal is just a wall of numbers.
2. **Where — the data sources.** Sources come before metrics: connect every reachable data source first, even minor ones; trim the fat later. No official connector does **not** mean it cannot be connected — build a CLI or custom connector when needed. If a paid tool is only being bought for its data, work out how it gets or calculates its numbers, test ours against it, and if they roughly match, recommend cancelling it. (Standing firm rule: every source must be API/automatic — no manual data entry.)
3. **What — metrics that matter.** With the goal and the business goals in view, rank the candidate metrics across all connected sources. The top 3–5 become the headline numbers (BANs — big aggregate numbers) at the top of the dashboard; everything else goes below, expandable.
4. **How — the presentation.** No chart junk: nothing on the page that is only decoration or doesn't serve the goal. No 3D or speedometer/gauge charts; avoid pie charts, especially with many categories. A dashboard summarizes — if all the data is on the page, it's a glorified spreadsheet. Use a reference design system (prefer one described in markdown, which agents absorb well) matched to brand colours, agree mockup layouts before the final build, and refine afterwards through comments. Consider adding an in-dashboard chat box (AI-powered artifacts) so teammates can ask questions of the data.
5. **When — freshness.** A dashboard is only useful if its numbers are fresh. Personal dashboards refresh on open, so they don't burn tokens refreshing in the background while unused. Team dashboards refresh on a schedule, before the first person opens them that day. Decide deliberately between pulling live on open and storing the data inside the dashboard (a shared dashboard otherwise uses each viewer's own connections), and weigh the sensitivity of the data before storing it in a hosted dashboard.

Related standing decisions: published artifacts are snapshots for ad hoc analysis and strategic discussion — long-lived dashboards belong in the firm's own apps (Tools / ms_app). Dashboards are built/published in claude.ai under advisors@myecfo.com unless Martin specifies otherwise.
