export const config = { runtime: 'edge' }

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  sbFetch,
  jsonResponse,
  fetchUserFromToken,
  loadProfile
} from '../_lib/supabase.js'

function authHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  }
}

function isUnder18(dob) {
  if (!dob) return false
  const d = new Date(dob)
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 18)
  return d > cutoff
}

export default async function handler(req) {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const user = await fetchUserFromToken(token)
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)

  const profile = await loadProfile(user.id)
  if (!profile) return jsonResponse({ error: 'profile_not_found' }, 404)

  const body = await req.json().catch(() => ({}))
  const { slug, thesis, charity_choice, payout_destination: requestedPayoutDestination } = body
  if (!slug) return jsonResponse({ error: 'slug_required' }, 400)

  const comps = await sbFetch(`/competitions?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`)
  const comp = comps?.[0]
  if (!comp) return jsonResponse({ error: 'not_found' }, 404)

  // 1. Status gating
  const okStatus = comp.status === 'registration' || (comp.status === 'active' && comp.late_join_allowed)
  if (!okStatus) return jsonResponse({ error: 'registration_closed' }, 422)

  // 2. Email-domain allowlist
  if (comp.email_domain_allowlist?.length) {
    const dom = (user.email || '').toLowerCase().split('@')[1] || ''
    const allowed = comp.email_domain_allowlist.map((d) => String(d).toLowerCase())
    if (!allowed.includes(dom)) return jsonResponse({ error: 'domain_not_allowed' }, 403)
  }

  // 3. Roster
  const rosterRows = await sbFetch(`/competition_roster?competition_id=eq.${comp.id}&limit=1`)
  if (rosterRows?.length) {
    const emailLower = (user.email || '').toLowerCase()
    const matches = await sbFetch(
      `/competition_roster?competition_id=eq.${comp.id}&status=eq.invited&select=id,email,matched_user_id,status`
    )
    const match = (matches || []).find((r) => (r.email || '').toLowerCase() === emailLower)
    if (!match) return jsonResponse({ error: 'not_on_roster' }, 403)
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/competition_roster?id=eq.${match.id}`, {
      method: 'PATCH',
      headers: authHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        status: 'registered',
        matched_user_id: profile.id,
        registered_at: new Date().toISOString()
      })
    })
    if (!patchRes.ok) {
      return jsonResponse({ error: 'roster_update_failed' }, 500)
    }
  }

  // 4. Already registered?
  const existing = await sbFetch(
    `/competition_entries?competition_id=eq.${comp.id}&user_id=eq.${profile.id}&limit=1`
  )
  if (existing?.length) return jsonResponse({ error: 'already_registered', entry: existing[0] }, 409)

  // 5. Parental consent for under-18
  if (isUnder18(profile.date_of_birth) && profile.parental_consent_status !== 'consented') {
    if (profile.parental_consent_status === 'revoked') {
      return jsonResponse({ error: 'consent_revoked' }, 403)
    }
    return jsonResponse({ error: 'consent_required' }, 422)
  }

  // 6. Charity / payout destination resolution
  const payoutMode = comp.payout_mode || 'charity_required'
  let payoutDestination = 'charity'
  let resolvedCharity = null

  if (payoutMode === 'cash_required') {
    payoutDestination = 'self'
    resolvedCharity = null
  } else if (payoutMode === 'charity_required') {
    payoutDestination = 'charity'
    resolvedCharity = charity_choice || comp.default_charity || null
    if (!resolvedCharity) return jsonResponse({ error: 'default_charity_unavailable' }, 422)
  } else if (payoutMode === 'charity_or_cash') {
    // Explicit payout_destination from client wins; else infer from charity_choice.
    if (requestedPayoutDestination === 'self' || (charity_choice && charity_choice.destination === 'self')) {
      payoutDestination = 'self'
      resolvedCharity = null
    } else if (charity_choice && charity_choice.ein) {
      payoutDestination = 'charity'
      resolvedCharity = charity_choice
    } else {
      // Default to organizer charity
      payoutDestination = 'charity'
      resolvedCharity = comp.default_charity || null
      if (!resolvedCharity) return jsonResponse({ error: 'default_charity_unavailable' }, 422)
    }
  }

  // Reject explicit cash-for-self when mode requires charity
  if (requestedPayoutDestination === 'self' && payoutMode === 'charity_required') {
    return jsonResponse({ error: 'cash_payout_not_allowed' }, 422)
  }

  // 7. Create dedicated portfolio + entry
  const portfolioRes = await fetch(`${SUPABASE_URL}/rest/v1/portfolios`, {
    method: 'POST',
    headers: authHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify({
      owner_type: 'competition',
      owner_id: comp.id,
      name: `${comp.name} — ${profile.full_name || profile.email}`,
      starting_cash: comp.starting_cash,
      cash_balance: comp.starting_cash,
      benchmark_ticker: comp.benchmark_ticker,
      allow_reset: false
    })
  })
  if (!portfolioRes.ok) {
    const err = await portfolioRes.text()
    return jsonResponse({ error: 'portfolio_create_failed', detail: err }, 500)
  }
  const portfolio = (await portfolioRes.json())[0]

  const entryRes = await fetch(`${SUPABASE_URL}/rest/v1/competition_entries`, {
    method: 'POST',
    headers: authHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify({
      competition_id: comp.id,
      user_id: profile.id,
      portfolio_id: portfolio.id,
      thesis: thesis || null,
      charity_choice: resolvedCharity,
      payout_destination: payoutDestination
    })
  })
  if (!entryRes.ok) {
    const err = await entryRes.text()
    return jsonResponse({ error: 'entry_create_failed', detail: err }, 500)
  }

  return jsonResponse({ ok: true, entry: (await entryRes.json())[0] })
}
