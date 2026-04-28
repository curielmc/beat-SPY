// Shared finalize logic — invoked from both the manual finalize endpoint
// and the auto-finalize cron path.
//
// Idempotent: if the competition is already in a terminal status
// ('finalized', 'pending_organizer_decision', 'completed', 'archived')
// the function returns { ok: true, idempotent: true } without re-running.
import { SUPABASE_URL, SUPABASE_SERVICE_KEY, sbFetch } from './supabase.js'
import { resolvePrizeBuckets } from '../../src/lib/prizeAllocation.js'
import { resolveCharityDestination } from '../../src/lib/charityResolver.js'
import { assignRanks } from '../../src/lib/competitionRanking.js'
import { writeAudit } from './auditLog.js'
import { sendChallengeNotification } from '../../src/notifications/dispatch.js'

const TERMINAL = new Set(['finalized', 'pending_organizer_decision', 'completed', 'archived'])

function svcHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  }
}

export async function finalizeCompetition({ competitionId, actorId, source = 'manual' }) {
  const comp = (await sbFetch(`/competitions?id=eq.${competitionId}&select=*&limit=1`))?.[0]
  if (!comp) return { ok: false, error: 'not_found', status: 404 }
  if (TERMINAL.has(comp.status)) {
    return { ok: true, idempotent: true, status: comp.status }
  }
  if (comp.status !== 'active') {
    return { ok: false, error: 'not_finalizable', status: 422 }
  }

  // 1. SPY return
  const spyReturnPct = await computeSpyReturn(comp.start_date, comp.end_date)

  // 2. Per-entry valuation + write back
  const entries = await sbFetch(
    `/competition_entries?competition_id=eq.${competitionId}&status=eq.active` +
      `&select=id,user_id,portfolio_id,payout_destination,charity_choice,portfolios(starting_cash)`
  )
  const enriched = []
  for (const e of entries) {
    const value = await computePortfolioValue(e.portfolio_id, comp.end_date)
    const startCash = Number(e.portfolios?.starting_cash || comp.starting_cash || 0)
    const finalReturnPct = startCash > 0 ? ((value - startCash) / startCash) * 100 : 0
    const beat = finalReturnPct > Number(spyReturnPct || 0)
    const excess = finalReturnPct - Number(spyReturnPct || 0)
    await fetch(`${SUPABASE_URL}/rest/v1/competition_entries?id=eq.${e.id}`, {
      method: 'PATCH',
      headers: svcHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        final_return_pct: finalReturnPct,
        beat_benchmark: beat,
        excess_return_pct: excess
      })
    })
    enriched.push({
      entry_id: e.id,
      user_id: e.user_id,
      payout_destination: e.payout_destination,
      charity_choice: e.charity_choice,
      final_return_pct: finalReturnPct,
      beat_benchmark: beat
    })
  }

  // 3. Rank
  enriched.sort((a, b) => b.final_return_pct - a.final_return_pct)
  assignRanks(enriched)
  for (const e of enriched) {
    await fetch(`${SUPABASE_URL}/rest/v1/competition_entries?id=eq.${e.entry_id}`, {
      method: 'PATCH',
      headers: svcHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ final_rank: e.final_rank })
    })
  }

  // 4. Resolve prizes
  const buckets = Array.isArray(comp.prize_allocation) ? comp.prize_allocation : []
  const { payouts, unfilled } = resolvePrizeBuckets(
    buckets,
    enriched,
    Number(comp.prize_pool_amount || 0)
  )

  // Index enriched by user_id for destination/charity/rank lookups.
  const byUser = new Map(enriched.map(e => [e.user_id, e]))

  // 5. Unfilled-bucket policy
  let needsOrganizer = false
  if (unfilled.length) {
    if (comp.unfilled_bucket_policy === 'admin_decide') {
      needsOrganizer = true
    } else if (comp.unfilled_bucket_policy === 'roll_forward') {
      const extra = unfilled.reduce((a, b) => a + Number(b.unallocated || 0), 0)
      if (payouts.length && extra > 0) {
        // Banker's distribution: floor(cents/n) to all, +1 cent to first
        // (rank-ordered) winners. No money lost or gained vs `extra`.
        // Sort payouts by rank ascending so the residual cents go to top winners.
        payouts.sort((a, b) => {
          const ra = byUser.get(a.user_id)?.final_rank ?? Infinity
          const rb = byUser.get(b.user_id)?.final_rank ?? Infinity
          return ra - rb
        })
        const extraCents = Math.round(extra * 100)
        const baseCents = Math.floor(extraCents / payouts.length)
        const remainder = extraCents - baseCents * payouts.length
        for (let i = 0; i < payouts.length; i++) {
          const bonusCents = baseCents + (i < remainder ? 1 : 0)
          payouts[i].amount = Math.round((payouts[i].amount + bonusCents / 100) * 100) / 100
        }
      }
    }
    // 'return_to_sponsor' = no-op
  }

  // 6. Load system default charity for resolution chain
  const sysRow = await sbFetch('/system_settings?key=eq.default_charity&select=value&limit=1')
  const systemDefaultCharity = sysRow?.[0]?.value || null

  // Write payout rows in pending. Resolve destination + charity per row.
  const createdPayouts = []
  if (!needsOrganizer) {
    for (const p of payouts) {
      const e = byUser.get(p.user_id)
      const destination = e?.payout_destination || 'charity'
      let charity = null
      if (destination === 'charity') {
        charity = resolveCharityDestination(e, comp, systemDefaultCharity)
      }
      const row = {
        competition_id: competitionId,
        user_id: p.user_id,
        amount: p.amount,
        currency: comp.prize_pool_currency || 'USD',
        destination,
        charity
      }
      // If charity destination but nothing resolved → write row but mark failed up-front
      if (destination === 'charity' && !charity) {
        row.status = 'failed'
        row.error = 'no_charity_resolved'
      }
      // UNIQUE (competition_id, user_id) on competition_payouts protects against
      // duplicate inserts when two finalize calls race past the terminal-status
      // guard. ignore-duplicates means the second caller silently no-ops.
      const res = await fetch(`${SUPABASE_URL}/rest/v1/competition_payouts`, {
        method: 'POST',
        headers: svcHeaders({ Prefer: 'return=representation,resolution=ignore-duplicates' }),
        body: JSON.stringify(row)
      })
      if (res.ok) {
        const out = await res.json().catch(() => null)
        if (Array.isArray(out) && out[0]) createdPayouts.push(out[0])
        else console.warn('[finalize] payout insert returned no row (likely duplicate)', { user_id: p.user_id })
      } else {
        console.error('[finalize] payout insert failed', res.status, await res.text())
      }
    }
  }

  // 7. Status update
  const newStatus = needsOrganizer ? 'pending_organizer_decision' : 'finalized'
  await fetch(`${SUPABASE_URL}/rest/v1/competitions?id=eq.${competitionId}`, {
    method: 'PATCH',
    headers: svcHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({
      status: newStatus,
      spy_return_pct: spyReturnPct,
      finalized_at: new Date().toISOString()
    })
  })

  // 8. Convert portfolios on completion
  if (comp.convert_to_individual_on_complete && newStatus === 'finalized') {
    for (const e of entries) {
      await fetch(`${SUPABASE_URL}/rest/v1/portfolios?id=eq.${e.portfolio_id}`, {
        method: 'PATCH',
        headers: svcHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({
          owner_type: 'user',
          owner_id: e.user_id,
          name: `${comp.name} portfolio`
        })
      }).catch(err => console.error('[finalize] portfolio convert failed', err))
    }
  }

  await writeAudit({
    competitionId,
    actorId,
    action: 'finalize',
    after: {
      newStatus,
      spyReturnPct,
      payoutCount: createdPayouts.length,
      unfilledCount: unfilled.length,
      source
    }
  })

  // 9. Notify entrants
  for (const e of enriched) {
    try {
      await sendChallengeNotification('finalized', competitionId, e.user_id, {
        competitionName: comp.name,
        rank: e.final_rank,
        returnPct: e.final_return_pct,
        spyPct: spyReturnPct,
        beat: e.beat_benchmark
      })
    } catch (err) {
      console.error('[finalize] notify finalized failed', err)
    }
  }

  return {
    ok: true,
    status: newStatus,
    spyReturnPct,
    payouts: createdPayouts,
    unfilled
  }
}

export async function computeSpyReturn(startIso, endIso) {
  if (!startIso || !endIso) return 0
  const startPrice = await fetchSpyPriceOn(String(startIso).slice(0, 10))
  const endPrice = await fetchSpyPriceOn(String(endIso).slice(0, 10))
  if (!startPrice || !endPrice) return 0
  return ((endPrice - startPrice) / startPrice) * 100
}

async function fetchSpyPriceOn(date) {
  const exact = await sbFetch(`/daily_prices?ticker=eq.SPY&date=eq.${date}&select=close&limit=1`)
  if (exact?.[0]) return Number(exact[0].close)
  const prev = await sbFetch(
    `/daily_prices?ticker=eq.SPY&date=lte.${date}&select=close,date&order=date.desc&limit=1`
  )
  return Number(prev?.[0]?.close || 0)
}

// Use the most recent portfolio_snapshots row at-or-before asOfIso.
// This mirrors the daily-snapshot writer in api/daily-snapshot.js.
export async function computePortfolioValue(portfolioId, asOfIso) {
  const date = String(asOfIso || '').slice(0, 10)
  const snap = await sbFetch(
    `/portfolio_snapshots?portfolio_id=eq.${portfolioId}` +
      `&snapshot_date=lte.${date}&select=total_value&order=snapshot_date.desc&limit=1`
  )
  return Number(snap?.[0]?.total_value || 0)
}
