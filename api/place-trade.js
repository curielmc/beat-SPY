export const config = { runtime: 'edge' }

import { getImmediateExecutionPrice } from '../src/lib/tradePricing.js'
import { SUPABASE_URL, SUPABASE_SERVICE_KEY, FMP_KEY, sbFetch, jsonResponse, fetchUserFromToken, loadProfile } from './_lib/supabase.js'
import { OWNER_EMAIL } from './_lib/constants.js'
import { assertTickerAllowed, UniverseError } from '../src/lib/competitionUniverse.js'
import { loadSpyConstituentsAsOf } from '../src/lib/spyConstituents.js'

async function loadCompetitionForPortfolio(portfolioId) {
  const rows = await sbFetch(
    `/competition_entries?portfolio_id=eq.${portfolioId}&select=competition_id,competitions(id,universe,status)`
  )
  return rows?.[0]?.competitions || null
}

async function fetchLivePrice(ticker) {
  if (!FMP_KEY) return null
  try {
    const res = await fetch(
      `https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(ticker)}?apikey=${FMP_KEY}`
    )
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      return getImmediateExecutionPrice(data[0])
    }
  } catch (e) {
    // Fall through
  }
  return null
}

async function loadPortfolio(portfolioId) {
  const data = await sbFetch(`/portfolios?id=eq.${portfolioId}&select=id,owner_type,owner_id&limit=1`)
  return data?.[0] || null
}

async function actorCanTradeForPortfolio(actorProfile, effectiveUserId, portfolioId) {
  if (!actorProfile?.id || !actorProfile?.role) return false
  if (actorProfile.role === 'admin' || actorProfile.email?.toLowerCase() === OWNER_EMAIL) return true
  if (actorProfile.role !== 'teacher') return actorProfile.id === effectiveUserId

  const portfolio = await loadPortfolio(portfolioId)
  if (!portfolio) return false

  if (portfolio.owner_type === 'group') {
    const data = await sbFetch(`/groups?id=eq.${portfolio.owner_id}&select=id,class_id,classes!inner(teacher_id)&classes.teacher_id=eq.${actorProfile.id}&limit=1`)
    return Array.isArray(data) && data.length > 0
  }

  if (portfolio.owner_type === 'user') {
    if (portfolio.owner_id !== effectiveUserId) return false
    const data = await sbFetch(`/class_memberships?user_id=eq.${effectiveUserId}&select=id,classes!inner(teacher_id)&classes.teacher_id=eq.${actorProfile.id}&limit=1`)
    return Array.isArray(data) && data.length > 0
  }

  return false
}

async function annotateTradeActor(result, actorProfile) {
  if (!actorProfile?.id || !actorProfile?.role) return

  if (result?.trade_id) {
    await sbFetch(`/trades?id=eq.${result.trade_id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        placed_by_user_id: actorProfile.id,
        placed_by_role: actorProfile.role
      })
    })
  } else if (result?.order_id) {
    await sbFetch(`/pending_trade_orders?id=eq.${result.order_id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        placed_by_user_id: actorProfile.id,
        placed_by_role: actorProfile.role
      })
    })
  }
}

const TICKER_RE = /^[A-Z]{1,5}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // Extract user JWT from Authorization header
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }
  const userJwt = authHeader.replace('Bearer ', '')
  const actorHeader = req.headers.get('x-actor-authorization')
  const actorJwt = actorHeader?.startsWith('Bearer ') ? actorHeader.replace('Bearer ', '') : null

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return jsonResponse({ error: 'Server auth is not configured' }, 500)
  }

  let body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400)
  }

  const { portfolio_id, ticker, side, dollars, rationale, approval_code, benchmark_ticker } = body

  if (!portfolio_id || !ticker || !side || !dollars) {
    return jsonResponse({ error: 'Missing required fields: portfolio_id, ticker, side, dollars' }, 400)
  }

  // Validate field formats
  if (!UUID_RE.test(portfolio_id)) {
    return jsonResponse({ error: 'Invalid portfolio_id format' }, 400)
  }
  if (!TICKER_RE.test(ticker.toUpperCase())) {
    return jsonResponse({ error: 'Invalid ticker format (1-5 uppercase letters)' }, 400)
  }
  if (side !== 'buy' && side !== 'sell') {
    return jsonResponse({ error: 'Side must be "buy" or "sell"' }, 400)
  }
  const dollarsNum = Number(dollars)
  if (!Number.isFinite(dollarsNum) || dollarsNum <= 0) {
    return jsonResponse({ error: 'Dollars must be a positive number' }, 400)
  }

  const effectiveUser = await fetchUserFromToken(userJwt)
  if (!effectiveUser?.id) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }

  const effectiveProfile = await loadProfile(effectiveUser.id)
  if (!effectiveProfile?.role) {
    return jsonResponse({ error: 'Profile not found' }, 403)
  }

  let actorProfile = effectiveProfile
  if (actorJwt) {
    const actorUser = await fetchUserFromToken(actorJwt)
    if (!actorUser?.id) {
      return jsonResponse({ error: 'Original educator session is invalid. Please stop masquerading and sign in again.' }, 401)
    }

    const loadedActorProfile = await loadProfile(actorUser.id)
    if (!loadedActorProfile?.role) {
      return jsonResponse({ error: 'Original educator profile not found.' }, 403)
    }

    const authorized = await actorCanTradeForPortfolio(loadedActorProfile, effectiveUser.id, portfolio_id)
    if (!authorized) {
      return jsonResponse({ error: 'You are not allowed to trade on behalf of this student.' }, 403)
    }

    actorProfile = loadedActorProfile
  }

  // Universe enforcement — if the portfolio belongs to an active competition with a
  // restricted universe, reject trades against tickers outside that universe.
  try {
    const comp = await loadCompetitionForPortfolio(portfolio_id)
    if (comp && comp.status === 'active' && comp.universe?.mode && comp.universe.mode !== 'app_all') {
      let sp500Set = new Set()
      if (comp.universe.mode === 'sp500_via_spy') {
        const date = comp.universe.snapshot_date
        if (!date) return jsonResponse({ error: 'universe_not_snapshotted' }, 503)
        sp500Set = await loadSpyConstituentsAsOf(date)
      }
      assertTickerAllowed(comp.universe, ticker, sp500Set)
    }
  } catch (e) {
    if (e instanceof UniverseError) return jsonResponse({ error: e.message }, 422)
    throw e
  }

  // Fetch live price server-side (the key security fix)
  const livePrice = await fetchLivePrice(ticker.toUpperCase())
  if (!livePrice || livePrice <= 0) {
    return jsonResponse({ error: `Could not fetch live price for ${ticker}` }, 400)
  }

  // Fetch benchmark price server-side too
  const bmTicker = benchmark_ticker || 'SPY'
  const bmPrice = await fetchLivePrice(bmTicker)

  // Call the service-only RPC after validating the actor/effective user server-side.
  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/place_trade_order_as_user`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_user_id: effectiveUser.id,
      p_portfolio_id: portfolio_id,
      p_ticker: ticker,
      p_side: side,
      p_dollars: dollarsNum,
      p_price: livePrice,
      p_rationale: rationale || null,
      p_approval_code: approval_code || null,
      p_benchmark_price: bmPrice || null
    })
  })

  if (!rpcRes.ok) {
    const errText = await rpcRes.text()
    // Extract the human-readable error message from Supabase error JSON
    try {
      const errJson = JSON.parse(errText)
      return jsonResponse({ error: errJson.message || errText }, rpcRes.status)
    } catch {
      return jsonResponse({ error: errText }, rpcRes.status)
    }
  }

  const result = await rpcRes.json()
  await annotateTradeActor(result, actorProfile).catch(e => console.error('annotateTradeActor failed:', e.message))
  if (result?.status === 'queued') {
    return jsonResponse({ ...result, submitted_price: livePrice })
  }
  return jsonResponse({ ...result, price: livePrice })
}
