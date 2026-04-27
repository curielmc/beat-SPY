# Plan 2 — Universe Enforcement & SPY Constituents Cron

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** Make trades inside a challenge portfolio respect that challenge's universe (`app_all`, `sp500_via_spy`, `custom_list`, `exclude_list`), and keep SPY's holdings refreshed daily.

**Architecture:** A small pure helper `assertTickerAllowed` in `src/lib/competitionUniverse.js` is unit-tested with fixtures. A daily cron `api/cron/fetch-spy-constituents.js` pulls SSGA's CSV and upserts into `spy_constituents`. The trade endpoint `api/place-trade.js` calls the helper before booking. The challenge `start_date` cron path snapshots SPY constituents into the competition's `universe.snapshot_date`.

**Tech stack:** Vercel Edge cron, Supabase REST (`sbFetch`), Node test runner, papaparse already-or-write tiny CSV split.

**Spec sections covered:** §3.5 `spy_constituents`, §5 universe enforcement.

---

### Task 1: Pure-function `assertTickerAllowed` with tests

**Files:**
- Create: `src/lib/competitionUniverse.js`
- Create: `tests/competitionUniverse.test.js`

- [ ] **Step 1:** Write failing tests

```js
// tests/competitionUniverse.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertTickerAllowed } from '../src/lib/competitionUniverse.js'

const sp500Set = new Set(['AAPL','MSFT','GOOGL'])

test('app_all allows anything', () => {
  assert.equal(assertTickerAllowed({ mode: 'app_all' }, 'XYZ', sp500Set), true)
})

test('sp500_via_spy allows constituents', () => {
  assert.equal(assertTickerAllowed({ mode: 'sp500_via_spy' }, 'AAPL', sp500Set), true)
})

test('sp500_via_spy rejects non-constituents', () => {
  assert.throws(
    () => assertTickerAllowed({ mode: 'sp500_via_spy' }, 'TSLA', sp500Set),
    /not in the S&P 500/
  )
})

test('custom_list allows listed tickers only', () => {
  const u = { mode: 'custom_list', tickers: ['F','GM'] }
  assert.equal(assertTickerAllowed(u, 'F', sp500Set), true)
  assert.throws(() => assertTickerAllowed(u, 'AAPL', sp500Set), /not in the allowed list/)
})

test('exclude_list rejects listed tickers, allows others', () => {
  const u = { mode: 'exclude_list', tickers: ['TSLA'] }
  assert.equal(assertTickerAllowed(u, 'AAPL', sp500Set), true)
  assert.throws(() => assertTickerAllowed(u, 'TSLA', sp500Set), /restricted/)
})

test('case-insensitive ticker match', () => {
  assert.equal(assertTickerAllowed({ mode: 'sp500_via_spy' }, 'aapl', sp500Set), true)
})
```

- [ ] **Step 2:** Run, expect failure (`Cannot find module`)

```bash
node --test tests/competitionUniverse.test.js
```

- [ ] **Step 3:** Implement helper

```js
// src/lib/competitionUniverse.js
export function assertTickerAllowed(universe, ticker, sp500Set) {
  const t = String(ticker || '').toUpperCase()
  const mode = universe?.mode || 'app_all'

  if (mode === 'app_all') return true

  if (mode === 'sp500_via_spy') {
    if (!sp500Set?.has(t)) {
      throw new UniverseError(`${t} is not in the S&P 500 (universe: sp500_via_spy)`)
    }
    return true
  }

  const list = (universe.tickers || []).map(s => String(s).toUpperCase())

  if (mode === 'custom_list') {
    if (!list.includes(t)) {
      throw new UniverseError(`${t} is not in the allowed list for this challenge`)
    }
    return true
  }

  if (mode === 'exclude_list') {
    if (list.includes(t)) {
      throw new UniverseError(`${t} is restricted in this challenge`)
    }
    return true
  }

  throw new UniverseError(`Unknown universe mode: ${mode}`)
}

export class UniverseError extends Error {
  constructor(msg) { super(msg); this.name = 'UniverseError' }
}
```

- [ ] **Step 4:** Run tests, expect PASS

- [ ] **Step 5:** Commit

```bash
git add src/lib/competitionUniverse.js tests/competitionUniverse.test.js
git commit -m "feat(challenges): pure assertTickerAllowed helper with tests"
```

### Task 2: SPY constituents loader (DB → Set)

**Files:**
- Create: `src/lib/spyConstituents.js`
- Create: `tests/spyConstituents.test.js`

- [ ] **Step 1:** Write loader

```js
// src/lib/spyConstituents.js
// Loads SPY constituents for a given as_of_date; returns Set<string> of tickers.
import { sbFetch } from '../../api/_lib/supabase.js'

const cache = new Map() // as_of_date -> { fetchedAt, set }
const TTL_MS = 5 * 60 * 1000

export async function loadSpyConstituentsAsOf(asOfDate) {
  const key = asOfDate
  const hit = cache.get(key)
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.set
  const rows = await sbFetch(`/spy_constituents?as_of_date=eq.${key}&select=ticker`)
  const set = new Set(rows.map(r => r.ticker.toUpperCase()))
  cache.set(key, { fetchedAt: Date.now(), set })
  return set
}

export async function loadLatestSpyConstituents() {
  const rows = await sbFetch(`/spy_constituents?select=as_of_date&order=as_of_date.desc&limit=1`)
  if (!rows.length) return new Set()
  return loadSpyConstituentsAsOf(rows[0].as_of_date)
}
```

- [ ] **Step 2:** Skip unit test (touches network/DB) — covered in integration. Commit.

```bash
git add src/lib/spyConstituents.js
git commit -m "feat(challenges): SPY constituents loader with TTL cache"
```

### Task 3: SPY constituents cron

**Files:**
- Create: `api/cron/fetch-spy-constituents.js`
- Modify: `vercel.json` (add cron schedule)

- [ ] **Step 1:** Write cron handler

```js
// api/cron/fetch-spy-constituents.js
export const config = { runtime: 'edge' }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, sbFetch, jsonResponse } from '../_lib/supabase.js'

const SSGA_CSV_URL = process.env.SSGA_SPY_HOLDINGS_URL ||
  'https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx'
// NOTE: SSGA primary is .xlsx; if you have a CSV mirror, set SSGA_SPY_HOLDINGS_URL to override.
// Implementation below assumes CSV; adjust parser if .xlsx by piping through a converter.

export default async function handler(req) {
  // Vercel cron auth
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  const csv = await fetch(SSGA_CSV_URL).then(r => {
    if (!r.ok) throw new Error(`SSGA fetch ${r.status}`)
    return r.text()
  })

  const rows = parseHoldingsCsv(csv) // [{ ticker, weight }]
  if (rows.length < 400) {
    // Sanity check — SPY has ~500 holdings; if we got fewer than 400, the source format changed.
    return jsonResponse({ error: 'sanity_check_failed', got: rows.length }, 500)
  }

  const today = new Date().toISOString().slice(0, 10)
  // Upsert
  const payload = rows.map(r => ({ ticker: r.ticker, weight: r.weight, as_of_date: today }))
  const res = await fetch(`${SUPABASE_URL}/rest/v1/spy_constituents?on_conflict=ticker,as_of_date`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify(payload)
  })
  if (!res.ok) return jsonResponse({ error: 'upsert_failed', detail: await res.text() }, 500)

  return jsonResponse({ ok: true, as_of_date: today, count: rows.length })
}

function parseHoldingsCsv(csv) {
  // SSGA holdings CSVs typically have a few header lines, then "Name,Ticker,Identifier,SEDOL,Weight,Sector,Shares Held,Local Currency"
  const lines = csv.split(/\r?\n/)
  const headerIdx = lines.findIndex(l => /\bTicker\b/i.test(l) && /\bWeight\b/i.test(l))
  if (headerIdx < 0) return []
  const headers = lines[headerIdx].split(',').map(s => s.replace(/"/g, '').trim())
  const tIx = headers.findIndex(h => /^Ticker$/i.test(h))
  const wIx = headers.findIndex(h => /^Weight/i.test(h))
  const out = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(s => s.replace(/"/g, '').trim())
    if (!cols[tIx]) continue
    const ticker = cols[tIx].toUpperCase()
    if (!/^[A-Z.\-]{1,8}$/.test(ticker)) continue
    const w = Number(String(cols[wIx]).replace('%','').trim())
    out.push({ ticker, weight: Number.isFinite(w) ? w : null })
  }
  return out
}
```

- [ ] **Step 2:** Add to `vercel.json` crons array

```json
{
  "crons": [
    { "path": "/api/cron/fetch-spy-constituents", "schedule": "0 22 * * 1-5" }
  ]
}
```

(merge with any existing crons; weekdays 10pm UTC ≈ market close + buffer)

- [ ] **Step 3:** Manual smoke test

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-vercel-app>/api/cron/fetch-spy-constituents
```

Expected: `{ ok: true, as_of_date: "2026-04-...", count: ~500 }`

- [ ] **Step 4:** Commit

```bash
git add api/cron/fetch-spy-constituents.js vercel.json
git commit -m "feat(challenges): daily cron to refresh SPY constituents"
```

### Task 4: Snapshot universe at challenge start

**Files:**
- Create: `api/cron/challenge-lifecycle.js` (will grow in later plans; start here)

- [ ] **Step 1:** Skeleton lifecycle cron — for now only does the start-date snapshot

```js
// api/cron/challenge-lifecycle.js
export const config = { runtime: 'edge' }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, sbFetch, jsonResponse } from '../_lib/supabase.js'

export default async function handler(req) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }
  const now = new Date().toISOString()
  await snapshotUniversesForStartingChallenges(now)
  return jsonResponse({ ok: true })
}

async function snapshotUniversesForStartingChallenges(nowIso) {
  // Find competitions transitioning into active status with sp500_via_spy and no snapshot yet
  const due = await sbFetch(
    `/competitions?status=in.(registration,active)&select=id,start_date,universe&universe->>mode=eq.sp500_via_spy`
  )
  const today = nowIso.slice(0, 10)
  const latestRow = (await sbFetch(`/spy_constituents?select=as_of_date&order=as_of_date.desc&limit=1`))[0]
  if (!latestRow) return
  const snapshotDate = latestRow.as_of_date

  for (const c of due) {
    if (c.universe?.snapshot_date) continue
    if (c.start_date > nowIso) continue
    const newU = { ...c.universe, snapshot_date: snapshotDate }
    await fetch(`${SUPABASE_URL}/rest/v1/competitions?id=eq.${c.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ universe: newU, status: 'active' })
    })
  }
}
```

- [ ] **Step 2:** Add cron schedule to `vercel.json`

```json
{ "path": "/api/cron/challenge-lifecycle", "schedule": "5 13 * * *" }
```

(Daily at 13:05 UTC ≈ 9:05 ET, just after market open)

- [ ] **Step 3:** Commit

```bash
git add api/cron/challenge-lifecycle.js vercel.json
git commit -m "feat(challenges): lifecycle cron — snapshot SPY universe at start"
```

### Task 5: Hook universe enforcement into `place-trade.js`

**Files:**
- Modify: `api/place-trade.js`

- [ ] **Step 1:** Find the section where the portfolio is loaded (currently `loadPortfolio`) and where the trade is about to be booked. Add a competition check.

```js
// near top
import { assertTickerAllowed, UniverseError } from '../src/lib/competitionUniverse.js'
import { loadSpyConstituentsAsOf } from '../src/lib/spyConstituents.js'

async function loadCompetitionForPortfolio(portfolioId) {
  const rows = await sbFetch(
    `/competition_entries?portfolio_id=eq.${portfolioId}&select=competition_id,competitions(id,universe,status)`
  )
  return rows?.[0]?.competitions || null
}
```

- [ ] **Step 2:** Inside the request handler, after the actor authorization passes and before the order is booked:

```js
const comp = await loadCompetitionForPortfolio(portfolio.id)
if (comp && comp.status === 'active' && comp.universe?.mode !== 'app_all') {
  let sp500Set = new Set()
  if (comp.universe.mode === 'sp500_via_spy') {
    const date = comp.universe.snapshot_date
    if (!date) return jsonResponse({ error: 'universe_not_snapshotted' }, 503)
    sp500Set = await loadSpyConstituentsAsOf(date)
  }
  try {
    assertTickerAllowed(comp.universe, ticker, sp500Set)
  } catch (e) {
    if (e instanceof UniverseError) return jsonResponse({ error: e.message }, 422)
    throw e
  }
}
```

- [ ] **Step 3:** Smoke-test manually with a competition portfolio + a non-S&P ticker → expect 422.

- [ ] **Step 4:** Commit

```bash
git add api/place-trade.js
git commit -m "feat(challenges): enforce universe in place-trade for active competitions"
```

### Task 6: Trade UI — surface universe constraint

**Files:**
- Modify: `src/views/app/StockDetailView.vue` (the "Buy" button area)
- Create: `src/composables/useChallengeContext.js`

- [ ] **Step 1:** Composable

```js
// src/composables/useChallengeContext.js
import { ref, watch } from 'vue'
import { supabase } from '../lib/supabase.js'

export function useChallengeContext(portfolioIdRef) {
  const challenge = ref(null)
  watch(portfolioIdRef, async (id) => {
    challenge.value = null
    if (!id) return
    const { data } = await supabase
      .from('competition_entries')
      .select('competition_id, competitions(id,name,universe,status,end_date)')
      .eq('portfolio_id', id).maybeSingle()
    if (data?.competitions?.status === 'active') challenge.value = data.competitions
  }, { immediate: true })
  return { challenge }
}
```

- [ ] **Step 2:** In `StockDetailView.vue`, when the active portfolio has a challenge attached, render an info badge above the buy button:

```vue
<div v-if="challenge && !canTradeInChallenge" class="alert alert-warning text-sm py-2">
  This challenge ({{ challenge.name }}) only allows {{ universeLabel(challenge.universe) }}.
</div>
<button :disabled="challenge && !canTradeInChallenge" @click="buy()">Buy</button>
```

- [ ] **Step 3:** Commit

```bash
git add src/composables/useChallengeContext.js src/views/app/StockDetailView.vue
git commit -m "feat(challenges): surface universe constraint on trade UI"
```

---

## Self-review

- [ ] `assertTickerAllowed` is pure (no DB) — tested directly
- [ ] Cron auth uses `CRON_SECRET` env var
- [ ] SSGA URL is overridable via env (so URL drift doesn't require a deploy)
- [ ] Sanity check (count < 400) prevents writing a malformed snapshot
- [ ] Universe snapshot taken once at start_date; not refreshed mid-challenge
- [ ] Place-trade returns 422 with named-constraint error
- [ ] UI displays a friendly message before the user even clicks buy
