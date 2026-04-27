# Plan 4 — Prize Allocation Builder, Organizer Role, Audit Log

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** Replace the flat `prizes` form with a prize-pool + bucket-allocation builder; add per-challenge organizer roles with scoped permissions; record every material change in an audit log surfaced as an organizer-only viewer.

**Architecture:** Pure resolver `resolvePrizeBuckets(allocation, ranking)` lives in `src/lib/prizeAllocation.js` with thorough unit tests. Admin form (`CompetitionsAdminView.vue`) gets a Prizes panel with 5 presets + custom builder + live preview. Server endpoint `/api/competitions/[id]/audit` returns audit log to organizers. Mutation endpoints use a wrapper `withAuditLog(action, before, after)` that writes the log row.

**Tech stack:** Vue 3 + Pinia, Node test runner.

**Spec sections covered:** §3.2, §3.3 (organizers, audit), §7, §8.

---

### Task 1: Prize allocation resolver — pure function with tests

**Files:**
- Create: `src/lib/prizeAllocation.js`
- Create: `tests/prizeAllocation.test.js`

- [ ] **Step 1:** Write failing tests covering the four spec scenarios

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolvePrizeBuckets } from '../src/lib/prizeAllocation.js'

const ranking = [
  { user_id: 'u1', final_rank: 1, final_return_pct: 12, beat_benchmark: true },
  { user_id: 'u2', final_rank: 2, final_return_pct: 9,  beat_benchmark: true },
  { user_id: 'u3', final_rank: 3, final_return_pct: 7,  beat_benchmark: true },
  { user_id: 'u4', final_rank: 4, final_return_pct: 5,  beat_benchmark: true },
  { user_id: 'u5', final_rank: 5, final_return_pct: 2,  beat_benchmark: false }
]

test('winner takes all', () => {
  const out = resolvePrizeBuckets(
    [{ eligibility: 'place', place_range: [1,1], allocation: { type: 'percent_of_pool', value: 100 }, split: 'winner_take_all' }],
    ranking, 1000)
  assert.deepEqual(out.payouts, [{ user_id: 'u1', amount: 1000 }])
  assert.equal(out.unfilled.length, 0)
})

test('top-3 weighted 50/30/20', () => {
  const out = resolvePrizeBuckets(
    [{ eligibility: 'top_n', n: 3, allocation: { type: 'percent_of_pool', value: 100 }, split: 'weighted_by_rank', weights: [50,30,20] }],
    ranking, 1000)
  assert.deepEqual(out.payouts.map(p => p.amount), [500, 300, 200])
})

test('all who beat SPY equal split', () => {
  const out = resolvePrizeBuckets(
    [{ eligibility: 'all_who_beat_benchmark', allocation: { type: 'percent_of_pool', value: 100 }, split: 'equal_split' }],
    ranking, 1000)
  assert.equal(out.payouts.length, 4) // u1..u4
  out.payouts.forEach(p => assert.equal(p.amount, 250))
})

test('hybrid 25/25/50', () => {
  const out = resolvePrizeBuckets([
    { eligibility: 'place', place_range: [1,1], allocation: { type: 'percent_of_pool', value: 25 }, split: 'winner_take_all' },
    { eligibility: 'place', place_range: [2,3], allocation: { type: 'percent_of_pool', value: 25 }, split: 'equal_split' },
    { eligibility: 'all_who_beat_benchmark', exclude_ranks: [1,2,3], allocation: { type: 'percent_of_pool', value: 50 }, split: 'equal_split' }
  ], ranking, 1000)
  const m = Object.fromEntries(out.payouts.map(p => [p.user_id, p.amount]))
  assert.equal(m.u1, 250)
  assert.equal(m.u2, 125)
  assert.equal(m.u3, 125)
  assert.equal(m.u4, 500) // only u4 left who beat SPY
})

test('unfilled bucket reported', () => {
  const noOneBeat = ranking.map(r => ({ ...r, beat_benchmark: false }))
  const out = resolvePrizeBuckets(
    [{ eligibility: 'all_who_beat_benchmark', allocation: { type: 'percent_of_pool', value: 100 }, split: 'equal_split' }],
    noOneBeat, 1000)
  assert.equal(out.payouts.length, 0)
  assert.equal(out.unfilled.length, 1)
  assert.equal(out.unfilled[0].unallocated, 1000)
})
```

- [ ] **Step 2:** Run tests, expect failure

- [ ] **Step 3:** Implement

```js
// src/lib/prizeAllocation.js
export function resolvePrizeBuckets(buckets, ranking, poolAmount) {
  const payouts = []
  const unfilled = []

  for (const bucket of buckets) {
    const allocation = bucket.allocation
    const bucketAmount = allocation.type === 'fixed_amount'
      ? Number(allocation.value)
      : (Number(allocation.value) / 100) * poolAmount

    const candidates = selectCandidates(bucket, ranking)
    if (candidates.length === 0) {
      unfilled.push({ bucket, unallocated: bucketAmount })
      continue
    }

    const splits = splitAmount(bucket, bucketAmount, candidates)
    for (const s of splits) payouts.push(s)
  }

  return { payouts: mergePayouts(payouts), unfilled }
}

function selectCandidates(bucket, ranking) {
  const exclude = new Set(bucket.exclude_ranks || [])
  let pool = ranking.filter(r => !exclude.has(r.final_rank))
  switch (bucket.eligibility) {
    case 'top_n':
      return pool.slice(0, bucket.n)
    case 'top_n_who_beat_benchmark':
      return pool.filter(r => r.beat_benchmark).slice(0, bucket.n)
    case 'all_who_beat_benchmark':
      return pool.filter(r => r.beat_benchmark)
    case 'place': {
      const [a, b] = bucket.place_range || [bucket.n, bucket.n]
      return pool.filter(r => r.final_rank >= a && r.final_rank <= b)
    }
    default:
      return []
  }
}

function splitAmount(bucket, bucketAmount, candidates) {
  if (bucket.split === 'winner_take_all') {
    if (candidates.length === 1) return [{ user_id: candidates[0].user_id, amount: bucketAmount }]
    // tied — split evenly
    const each = round2(bucketAmount / candidates.length)
    return candidates.map(c => ({ user_id: c.user_id, amount: each }))
  }
  if (bucket.split === 'weighted_by_rank') {
    const weights = bucket.weights || []
    const totalW = weights.slice(0, candidates.length).reduce((a,b)=>a+b, 0)
    return candidates.map((c, i) => ({
      user_id: c.user_id,
      amount: round2((weights[i] / totalW) * bucketAmount)
    }))
  }
  // equal_split
  const each = round2(bucketAmount / candidates.length)
  return candidates.map(c => ({ user_id: c.user_id, amount: each }))
}

function mergePayouts(list) {
  const m = new Map()
  for (const p of list) m.set(p.user_id, round2((m.get(p.user_id) || 0) + p.amount))
  return [...m.entries()].map(([user_id, amount]) => ({ user_id, amount }))
}

function round2(n) { return Math.round(n * 100) / 100 }
```

- [ ] **Step 4:** Run tests, expect PASS

- [ ] **Step 5:** Commit

### Task 2: Prize allocation builder UI

**Files:**
- Modify: `src/views/admin/CompetitionsAdminView.vue`
- Create: `src/components/admin/PrizeAllocationBuilder.vue`

- [ ] **Step 1:** New component `PrizeAllocationBuilder.vue` props: `v-model:pool` (number), `v-model:currency` (string), `v-model:buckets` (array). Renders:
  1. Pool input row
  2. Preset picker (5 buttons): Winner takes all / Top 3 / Beat SPY / Hybrid 25-25-50 / Custom
  3. When custom, bucket cards (drag-to-reorder using simple up/down buttons; full DnD is out of scope)
  4. Live preview pane: simulates against fake ranking of 10 users (3 beat SPY, 7 didn't) using `resolvePrizeBuckets` and shows `payouts` + `unfilled`

- [ ] **Step 2:** Validation:
  - Sum of percent allocations ≤ 100 (error if >, warn if <)
  - Sum of fixed amounts ≤ pool (error if >)
  - At least one bucket
  - Place ranges don't overlap

- [ ] **Step 3:** Replace existing Prizes panel in `CompetitionsAdminView.vue` with `<PrizeAllocationBuilder />`. Update payload submitted to API to include `prize_pool_amount`, `prize_pool_currency`, `prize_allocation`, `unfilled_bucket_policy`.

- [ ] **Step 4:** Commit

### Task 3: Organizers panel in admin form

**Files:**
- Modify: `src/views/admin/CompetitionsAdminView.vue`
- Create: `src/components/admin/OrganizersPanel.vue`
- Create: `api/competitions/[id]/organizers.js`

- [ ] **Step 1:** Component renders the list of current organizers (loaded by `competitions store`), with an "Add organizer" search-by-email/username input. Each row has role dropdown (owner / organizer / viewer) and a remove button (disabled for owner unless transferring).

- [ ] **Step 2:** API endpoint POST/DELETE for org rows. Authorization: only existing owners or admins can mutate. Body includes `before` and `after` for audit log.

- [ ] **Step 3:** Server-side: write `competition_audit_log` row with action='organizer_added' / 'organizer_role_changed' / 'organizer_removed'.

- [ ] **Step 4:** Update RLS expectations — organizer rows are mutated server-side via service role since RLS already restricts to owners/admins.

- [ ] **Step 5:** Commit

### Task 4: Audit log helper + viewer

**Files:**
- Create: `api/_lib/auditLog.js`
- Create: `src/views/admin/CompetitionAuditView.vue`
- Modify: `src/router/index.js`

- [ ] **Step 1:** Server helper

```js
// api/_lib/auditLog.js
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './supabase.js'
export async function writeAudit({ competitionId, actorId, action, before = null, after = null }) {
  return fetch(`${SUPABASE_URL}/rest/v1/competition_audit_log`, {
    method: 'POST',
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ competition_id: competitionId, actor_id: actorId, action, before, after })
  })
}
```

- [ ] **Step 2:** Wrap competition update endpoint to write audit before responding success. Use `JSON.stringify` of changed-fields-only for `before`/`after`.

- [ ] **Step 3:** Audit viewer: route `/admin/competitions/:id/audit`, table of rows (timestamp, actor name, action, diff). Query supabase directly via existing RLS (organizers can read).

- [ ] **Step 4:** Commit

### Task 5: Mid-challenge edit confirmation + notification

**Files:**
- Modify: `src/views/admin/CompetitionsAdminView.vue`
- Modify: `api/competitions/[id]/update.js` (or wherever competition update lives)

- [ ] **Step 1:** Define material fields constant

```js
const MATERIAL_FIELDS = ['universe','start_date','end_date','prize_pool_amount','prize_allocation','rules','benchmark_ticker']
```

- [ ] **Step 2:** Client: when status === 'active' and the diff touches any material field, show a dialog:
"This change will be logged and notifies all participants. Optional reason: [textarea]. Continue?"

- [ ] **Step 3:** Server: on update where status=active and material fields changed, write audit + emit notification #8 (rule change). Notification implementation lives in Plan 5; for now write a TODO and put the dispatch behind a feature flag `NOTIFY_RULE_CHANGES=true`.

- [ ] **Step 4:** Commit

### Task 6: Remove participant flow

**Files:**
- Modify: `src/views/admin/CompetitionsAdminView.vue` (or a participants subview)
- Create: `api/competitions/[id]/remove-entry.js`

- [ ] **Step 1:** Endpoint requires `removed_reason` (non-empty). Sets `competition_entries.status='removed'`. Audit log row. Notification #9 dispatched (TODO until Plan 5).

- [ ] **Step 2:** Server validates actor is organizer/owner/admin.

- [ ] **Step 3:** Commit

---

## Self-review

- [ ] `resolvePrizeBuckets` is pure (no DB) — tested
- [ ] Validation errors prevent saving invalid bucket configs
- [ ] Audit writes are best-effort — failure does not block the primary mutation, but is logged
- [ ] Material-field detection lives in one place (constant), reused by client confirmation and server notification
- [ ] Owner cannot be removed; transfer flow forces choosing a new owner first
- [ ] Audit viewer respects RLS (organizers see only their challenges)
