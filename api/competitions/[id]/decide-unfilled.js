export const config = { runtime: 'edge' }

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  sbFetch,
  jsonResponse,
  fetchUserFromToken,
  loadProfile
} from '../../_lib/supabase.js'
import { resolvePrizeBuckets } from '../../../src/lib/prizeAllocation.js'
import { resolveCharityDestination } from '../../../src/lib/charityResolver.js'
import { writeAudit } from '../../_lib/auditLog.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_DECISIONS = new Set(['roll_forward', 'return_to_sponsor', 'distribute_anyway'])

function svcHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  }
}

async function requireOrganizer(profile, competitionId) {
  if (profile.role === 'admin') return true
  const orgs = await sbFetch(
    `/competition_organizers?competition_id=eq.${competitionId}&user_id=eq.${profile.id}&select=role&limit=1`
  )
  const role = orgs?.[0]?.role
  return role === 'owner' || role === 'organizer'
}

export default async function handler(req) {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const url = new URL(req.url)
  const m = url.pathname.match(/\/api\/competitions\/([^/]+)\/decide-unfilled/)
  const competitionId = m?.[1]
  if (!competitionId || !UUID_RE.test(competitionId)) {
    return jsonResponse({ error: 'invalid_competition_id' }, 400)
  }

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const user = await fetchUserFromToken(token)
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)
  const profile = await loadProfile(user.id)
  if (!profile) return jsonResponse({ error: 'profile_not_found' }, 404)
  if (!(await requireOrganizer(profile, competitionId))) {
    return jsonResponse({ error: 'forbidden' }, 403)
  }

  const body = await req.json().catch(() => ({}))
  const decision = String(body.decision || '')
  if (!VALID_DECISIONS.has(decision)) {
    return jsonResponse({ error: 'invalid_decision' }, 400)
  }

  const comp = (await sbFetch(`/competitions?id=eq.${competitionId}&select=*&limit=1`))?.[0]
  if (!comp) return jsonResponse({ error: 'not_found' }, 404)
  if (comp.status !== 'pending_organizer_decision') {
    return jsonResponse({ error: 'not_pending_decision' }, 422)
  }

  // Load the already-ranked entries written during the original finalize.
  const entries = await sbFetch(
    `/competition_entries?competition_id=eq.${competitionId}&status=eq.active` +
      `&select=user_id,payout_destination,charity_choice,final_rank,final_return_pct,beat_benchmark`
  )
  const ranking = (entries || [])
    .filter(e => e.final_rank != null)
    .sort((a, b) => a.final_rank - b.final_rank)

  const buckets = Array.isArray(comp.prize_allocation) ? comp.prize_allocation : []
  const poolAmount = Number(comp.prize_pool_amount || 0)

  // Recompute the base allocation.
  let { payouts, unfilled } = resolvePrizeBuckets(buckets, ranking, poolAmount)

  if (decision === 'roll_forward') {
    const extra = unfilled.reduce((a, b) => a + Number(b.unallocated || 0), 0)
    if (payouts.length && extra > 0) {
      const each = Math.round((extra / payouts.length) * 100) / 100
      payouts = payouts.map(p => ({ ...p, amount: Math.round((p.amount + each) * 100) / 100 }))
    }
  } else if (decision === 'distribute_anyway') {
    // Re-resolve unfilled buckets ignoring beat_benchmark constraints.
    const fallbackPayouts = []
    for (const u of unfilled) {
      const b = u.bucket
      const bucketAmount = Number(u.unallocated || 0)
      // Pick the top-N (or place_range) from full ranking, ignoring beat_benchmark.
      let candidates = ranking
      if (b.eligibility === 'top_n' || b.eligibility === 'top_n_who_beat_benchmark') {
        candidates = ranking.slice(0, b.n)
      } else if (b.eligibility === 'place') {
        const [a, c] = b.place_range || [b.n, b.n]
        candidates = ranking.filter(r => r.final_rank >= a && r.final_rank <= c)
      } else if (b.eligibility === 'all_who_beat_benchmark') {
        candidates = ranking
      }
      if (!candidates.length) continue
      const each = Math.round((bucketAmount / candidates.length) * 100) / 100
      for (const c of candidates) fallbackPayouts.push({ user_id: c.user_id, amount: each })
    }
    // Merge into payouts.
    const m = new Map(payouts.map(p => [p.user_id, p.amount]))
    for (const fp of fallbackPayouts) {
      m.set(fp.user_id, Math.round(((m.get(fp.user_id) || 0) + fp.amount) * 100) / 100)
    }
    payouts = [...m.entries()].map(([user_id, amount]) => ({ user_id, amount }))
  }
  // 'return_to_sponsor' — leave payouts unchanged.

  // Resolve system default charity once.
  const sysRow = await sbFetch('/system_settings?key=eq.default_charity&select=value&limit=1')
  const systemDefault = sysRow?.[0]?.value || null

  const byUser = new Map((entries || []).map(e => [e.user_id, e]))

  // DELETE existing pending payouts and recreate.
  const existingPending = await sbFetch(
    `/competition_payouts?competition_id=eq.${competitionId}&status=eq.pending&select=id`
  )
  if (existingPending?.length) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/competition_payouts?competition_id=eq.${competitionId}&status=eq.pending`,
      { method: 'DELETE', headers: svcHeaders({ Prefer: 'return=minimal' }) }
    )
  }

  const created = []
  for (const p of payouts) {
    const e = byUser.get(p.user_id) || {}
    const destination = e.payout_destination || 'charity'
    let charity = null
    if (destination === 'charity') {
      charity = resolveCharityDestination(e, comp, systemDefault)
    }
    const row = {
      competition_id: competitionId,
      user_id: p.user_id,
      amount: p.amount,
      currency: comp.prize_pool_currency || 'USD',
      destination,
      charity
    }
    if (destination === 'charity' && !charity) {
      row.status = 'failed'
      row.error = 'no_charity_resolved'
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/competition_payouts`, {
      method: 'POST',
      headers: svcHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(row)
    })
    if (res.ok) {
      const out = await res.json()
      if (out?.[0]) created.push(out[0])
    } else {
      console.error('[decide-unfilled] insert failed', await res.text())
    }
  }

  // Flip status to finalized.
  await fetch(`${SUPABASE_URL}/rest/v1/competitions?id=eq.${competitionId}`, {
    method: 'PATCH',
    headers: svcHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ status: 'finalized' })
  })

  await writeAudit({
    competitionId,
    actorId: profile.id,
    action: 'decide_unfilled',
    before: { unfilled },
    after: { decision, payoutCount: created.length }
  })

  return jsonResponse({ ok: true, decision, payouts: created })
}
