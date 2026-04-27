# Plan 6 — Tremendous Payout Integration & Payout Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** Finalize the challenge → propose payouts → organizer reviews → click "Send" → Tremendous disburses → webhook updates status. Manual fallback always available.

**Architecture:** A finalize endpoint computes `final_rank`, `beat_benchmark`, `excess_return_pct`, `spy_return_pct`, runs `resolvePrizeBuckets`, writes `competition_payouts` rows in `pending`. Organizer dashboard reads pending payouts, shows balance, lets organizer click "Send all" — server iterates and POSTs each to Tremendous. Webhook `/api/webhooks/tremendous` updates rows on status changes.

**Tech stack:** Tremendous REST API, HMAC signature validation, Vue dashboard.

**Spec sections covered:** §6.2 finalization, §10.

---

### Task 1: Finalize endpoint

**Files:**
- Create: `api/competitions/[id]/finalize.js`
- Modify: `api/cron/challenge-lifecycle.js` (auto-finalize when end_date passed)

- [ ] **Step 1:** Endpoint logic

```js
// api/competitions/[id]/finalize.js
export const config = { runtime: 'edge' }
import { SUPABASE_URL, SUPABASE_SERVICE_KEY, sbFetch, jsonResponse, fetchUserFromToken } from '../../_lib/supabase.js'
import { resolvePrizeBuckets } from '../../../src/lib/prizeAllocation.js'
import { writeAudit } from '../../_lib/auditLog.js'

export default async function handler(req) {
  const url = new URL(req.url)
  const id = url.pathname.split('/').slice(-2, -1)[0]
  const user = await fetchUserFromToken(req.headers.get('authorization'))
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)
  // Authorization: organizer/owner/admin (left as exercise — copy pattern from organizers endpoint)

  const comp = (await sbFetch(`/competitions?id=eq.${id}&select=*&limit=1`))[0]
  if (!comp) return jsonResponse({ error: 'not_found' }, 404)
  if (!['active'].includes(comp.status)) return jsonResponse({ error: 'not_finalizable' }, 422)

  // 1. Compute SPY return over [start, end]
  const spyReturnPct = await computeSpyReturn(comp.start_date, comp.end_date)

  // 2. Snapshot each entry's portfolio value, write final_return_pct
  const entries = await sbFetch(
    `/competition_entries?competition_id=eq.${id}&status=eq.active&select=id,user_id,portfolio_id,portfolios(starting_cash)`
  )
  const enriched = []
  for (const e of entries) {
    const value = await computePortfolioValue(e.portfolio_id, comp.end_date)
    const startCash = Number(e.portfolios?.starting_cash || comp.starting_cash)
    const finalReturnPct = ((value - startCash) / startCash) * 100
    const beat = finalReturnPct > spyReturnPct
    const excess = finalReturnPct - spyReturnPct
    await fetch(`${SUPABASE_URL}/rest/v1/competition_entries?id=eq.${e.id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        final_return_pct: finalReturnPct,
        beat_benchmark: beat,
        excess_return_pct: excess
      })
    })
    enriched.push({ user_id: e.user_id, final_return_pct: finalReturnPct, beat_benchmark: beat })
  }

  // 3. Rank
  enriched.sort((a, b) => b.final_return_pct - a.final_return_pct)
  enriched.forEach((e, i) => { e.final_rank = i + 1 })
  for (const e of enriched) {
    await fetch(`${SUPABASE_URL}/rest/v1/competition_entries?competition_id=eq.${id}&user_id=eq.${e.user_id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ final_rank: e.final_rank })
    })
  }

  // 4. Resolve prizes
  const { payouts, unfilled } = resolvePrizeBuckets(comp.prize_allocation, enriched, Number(comp.prize_pool_amount || 0))

  // 5. Apply unfilled-bucket policy
  let needsOrganizer = false
  if (unfilled.length) {
    if (comp.unfilled_bucket_policy === 'admin_decide') needsOrganizer = true
    else if (comp.unfilled_bucket_policy === 'roll_forward') {
      // (simplified) — sum unallocated and split equally among existing payouts
      const extra = unfilled.reduce((a,b)=>a+b.unallocated, 0)
      if (payouts.length) {
        const each = Math.round((extra / payouts.length) * 100) / 100
        for (const p of payouts) p.amount += each
      }
    }
    // 'return_to_sponsor' = no-op
  }

  // 6. Write payout rows in pending
  for (const p of payouts) {
    await fetch(`${SUPABASE_URL}/rest/v1/competition_payouts`, {
      method: 'POST',
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        competition_id: id,
        user_id: p.user_id,
        amount: p.amount,
        currency: comp.prize_pool_currency || 'USD'
      })
    })
  }

  // 7. Status update
  const newStatus = needsOrganizer ? 'pending_organizer_decision' : 'finalized'
  await fetch(`${SUPABASE_URL}/rest/v1/competitions?id=eq.${id}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus, spy_return_pct: spyReturnPct, finalized_at: new Date().toISOString() })
  })

  // 8. Convert portfolios (deferred to step 9)
  if (comp.convert_to_individual_on_complete) {
    for (const e of entries) {
      await fetch(`${SUPABASE_URL}/rest/v1/portfolios?id=eq.${e.portfolio_id}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_type: 'user', owner_id: e.user_id, name: `${comp.name} portfolio` })
      })
    }
  }

  await writeAudit({ competitionId: id, actorId: user.id, action: 'finalize', after: { newStatus, spyReturnPct, payoutCount: payouts.length } })

  // 9. Notify entrants of results
  for (const e of enriched) {
    await sendChallengeNotification('finalized', id, e.user_id, {
      competitionName: comp.name, rank: e.final_rank, returnPct: e.final_return_pct, spyPct: spyReturnPct, beat: e.beat_benchmark
    })
  }

  return jsonResponse({ ok: true, status: newStatus, payouts })
}

async function computeSpyReturn(startIso, endIso) {
  // Use existing daily snapshot infra to fetch SPY price at two dates.
  // Implementation: query market_data table or call FMP for SPY at startDate + endDate.
  // Pseudocode — replace with actual call after reviewing src/stores/marketData.js
  const startPrice = await fetchSpyPriceOn(startIso.slice(0,10))
  const endPrice = await fetchSpyPriceOn(endIso.slice(0,10))
  return ((endPrice - startPrice) / startPrice) * 100
}

async function fetchSpyPriceOn(date) {
  const rows = await sbFetch(`/daily_prices?ticker=eq.SPY&date=eq.${date}&select=close&limit=1`)
  if (rows[0]) return Number(rows[0].close)
  // Fallback: nearest preceding date
  const prev = await sbFetch(`/daily_prices?ticker=eq.SPY&date=lte.${date}&select=close,date&order=date.desc&limit=1`)
  return Number(prev[0]?.close)
}

async function computePortfolioValue(portfolioId, asOfIso) {
  // Use existing portfolio valuation logic — likely in src/stores/portfolio.js or a daily-snapshot helper.
  // Replace with the real call after reviewing the codebase.
  const snap = await sbFetch(`/portfolio_snapshots?portfolio_id=eq.${portfolioId}&date=lte.${asOfIso.slice(0,10)}&select=total_value&order=date.desc&limit=1`)
  return Number(snap[0]?.total_value || 0)
}
```

- [ ] **Step 2:** Commit

### Task 2: Auto-finalize via cron

**Files:**
- Modify: `api/cron/challenge-lifecycle.js`

- [ ] **Step 1:** Add scan for `status='active' AND end_date <= now()`. Call the finalize handler internally (factor the logic into a function that both routes share).

- [ ] **Step 2:** Commit

### Task 3: Tremendous client

**Files:**
- Create: `src/lib/tremendous.js`

- [ ] **Step 1:** Wrapper

```js
// src/lib/tremendous.js
const BASE = process.env.TREMENDOUS_BASE || 'https://www.tremendous.com/api/v2'
const KEY = process.env.TREMENDOUS_API_KEY
const CAMPAIGN_ID = process.env.TREMENDOUS_CAMPAIGN_ID

function authHeaders() {
  return { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
}

export async function getFundingBalance() {
  const r = await fetch(`${BASE}/funding_sources`, { headers: authHeaders() })
  if (!r.ok) throw new Error(`tremendous funding ${r.status}`)
  const data = await r.json()
  // returns array; pick the primary balance source
  const primary = data.funding_sources.find(s => s.method === 'balance') || data.funding_sources[0]
  return Number(primary?.meta?.available_cents || 0) / 100
}

export async function createOrder({ recipientName, recipientEmail, amount, currency = 'USD', externalId }) {
  const body = {
    payment: { funding_source_id: 'balance' },
    rewards: [{
      campaign_id: CAMPAIGN_ID,
      value: { denomination: amount, currency_code: currency },
      recipient: { name: recipientName, email: recipientEmail }
    }],
    external_id: externalId
  }
  const r = await fetch(`${BASE}/orders`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })
  const data = await r.json()
  if (!r.ok) throw new Error(`tremendous order ${r.status}: ${JSON.stringify(data)}`)
  return { orderId: data.order.id, rewardId: data.order.rewards?.[0]?.id }
}
```

- [ ] **Step 2:** Commit

### Task 4: Send-payouts endpoint

**Files:**
- Create: `api/competitions/[id]/payouts/send.js`

- [ ] **Step 1:** Handler

```js
export const config = { runtime: 'edge' }
import { SUPABASE_URL, SUPABASE_SERVICE_KEY, sbFetch, jsonResponse, fetchUserFromToken } from '../../../_lib/supabase.js'
import { getFundingBalance, createOrder } from '../../../../src/lib/tremendous.js'
import { sendChallengeNotification } from '../../../../src/notifications/dispatch.js'
import { writeAudit } from '../../../_lib/auditLog.js'

export default async function handler(req) {
  // Auth: organizer/owner/admin only
  const user = await fetchUserFromToken(req.headers.get('authorization'))
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)
  // (authorization check omitted)

  const id = new URL(req.url).pathname.split('/').slice(-3, -2)[0]
  const comp = (await sbFetch(`/competitions?id=eq.${id}&select=name,prize_pool_currency&limit=1`))[0]
  const pending = await sbFetch(
    `/competition_payouts?competition_id=eq.${id}&status=eq.pending&select=id,user_id,amount,currency,profiles!inner(full_name,email)`
  )
  if (!pending.length) return jsonResponse({ ok: true, sent: 0 })

  const need = pending.reduce((a, p) => a + Number(p.amount), 0)
  const balance = await getFundingBalance()
  if (balance < need) return jsonResponse({ error: 'insufficient_balance', balance, need }, 422)

  const results = []
  for (const p of pending) {
    try {
      const { orderId, rewardId } = await createOrder({
        recipientName: p.profiles.full_name,
        recipientEmail: p.profiles.email,
        amount: Number(p.amount),
        currency: p.currency,
        externalId: `payout-${p.id}`
      })
      await fetch(`${SUPABASE_URL}/rest/v1/competition_payouts?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent', provider_payout_id: rewardId || orderId })
      })
      await sendChallengeNotification('won_payout', id, p.user_id, {
        amount: p.amount, competitionName: comp.name, claimUrl: `https://tremendous.com/rewards/${rewardId}`
      })
      results.push({ id: p.id, ok: true })
    } catch (e) {
      await fetch(`${SUPABASE_URL}/rest/v1/competition_payouts?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'failed', error: String(e.message) })
      })
      results.push({ id: p.id, ok: false, error: String(e.message) })
    }
  }
  await writeAudit({ competitionId: id, actorId: user.id, action: 'payouts_sent', after: { results } })
  return jsonResponse({ ok: true, results })
}
```

- [ ] **Step 2:** Commit

### Task 5: Tremendous webhook

**Files:**
- Create: `api/webhooks/tremendous.js`

- [ ] **Step 1:** Handler validates HMAC signature header (`Tremendous-Webhook-Signature`) using `TREMENDOUS_WEBHOOK_SECRET`. Parses event. For `REWARDS.DELIVERED` flips status to `delivered`, `paid_at=now()`. For `REWARDS.FAILED` flips to `failed`. For `REWARDS.CANCELED` flips to `canceled`.

```js
import { createHmac, timingSafeEqual } from 'node:crypto'

function verifySig(req, raw) {
  const sig = req.headers.get('tremendous-webhook-signature')
  const expected = createHmac('sha256', process.env.TREMENDOUS_WEBHOOK_SECRET).update(raw).digest('hex')
  if (!sig || sig.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
}

export default async function handler(req) {
  const raw = await req.text()
  if (!verifySig(req, raw)) return new Response('bad sig', { status: 401 })
  const evt = JSON.parse(raw)
  const rewardId = evt.payload?.reward?.id
  const status = evt.event_type
  // Map and PATCH competition_payouts where provider_payout_id = rewardId
  // ... PATCH call ...
  return new Response('ok')
}
```

- [ ] **Step 2:** Configure webhook URL in Tremendous dashboard.

- [ ] **Step 3:** Commit

### Task 6: Payout dashboard UI

**Files:**
- Create: `src/views/admin/CompetitionPayoutsView.vue`
- Modify: `src/router/index.js`

- [ ] **Step 1:** Route `/admin/competitions/:id/payouts`. View loads:
  - Tremendous balance (call to `/api/tremendous/balance` — small new endpoint)
  - Pending payouts table (recipient name, email, amount, status)
  - "Send all payouts" button (disabled if balance < need)
  - Per-row "Mark manual" button (POST to a new `/api/competitions/[id]/payouts/[payoutId]/manual` endpoint that flips status + accepts `manual_note`)
  - Audit-log link

- [ ] **Step 2:** Commit

### Task 7: Manual fallback endpoint

**Files:**
- Create: `api/competitions/[id]/payouts/[payoutId]/manual.js`

- [ ] **Step 1:** Validates organizer role. Patches payout to `status='paid_manually'`, stores `manual_note`. Audit-log entry. Notification #7 dispatched (with manual note in `data.claimUrl=null`).

- [ ] **Step 2:** Commit

### Task 8: Admin "Decide unfilled buckets" flow

**Files:**
- Create: `src/components/admin/UnfilledBucketDecision.vue`
- Create: `api/competitions/[id]/decide-unfilled.js`

- [ ] **Step 1:** When competition status = `pending_organizer_decision`, dashboard shows: "Some prize buckets couldn't be filled. Choose:"
  - Roll forward → recompute payouts using roll_forward policy
  - Return to sponsor → leave the unallocated amount unspent
  - Distribute anyway → ignore beat-benchmark constraint and use top-N by return

- [ ] **Step 2:** Endpoint applies the chosen policy, regenerates `competition_payouts` rows (DELETE existing pending + recreate), flips status to `finalized`. Audit-log entry.

- [ ] **Step 3:** Commit

---

## Self-review

- [ ] Finalize is idempotent (re-running on a finalized comp is a no-op)
- [ ] Pre-flight balance check happens before any orders go out
- [ ] Per-payout state transitions are atomic
- [ ] Webhook signature validation uses constant-time comparison
- [ ] Manual fallback always available even when Tremendous is configured
- [ ] Cron path and manual path share the same finalize function
