export const config = { runtime: 'edge' }

import { getImmediateExecutionPrice } from '../src/lib/tradePricing.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const FMP_KEY = process.env.VITE_FMP_API_KEY

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

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

async function fetchUserFromToken(token) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`
    }
  })
  if (!res.ok) return null
  return res.json().catch(() => null)
}

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  if (!res.ok) {
    throw new Error(await res.text())
  }

  if (res.status === 204) return null
  return res.json()
}

async function loadProfile(userId) {
  const data = await sbFetch(`/profiles?id=eq.${userId}&select=id,role,email&limit=1`)
  return data?.[0] || null
}

async function loadPortfolio(portfolioId) {
  const data = await sbFetch(`/portfolios?id=eq.${portfolioId}&select=id,owner_type,owner_id&limit=1`)
  return data?.[0] || null
}

async function actorCanTradeForPortfolio(actorProfile, effectiveUserId, portfolioId) {
  if (!actorProfile?.id || !actorProfile?.role) return false
  if (actorProfile.role === 'admin' || actorProfile.email?.toLowerCase() === 'martin@myecfo.com') return true
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

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
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
      p_dollars: dollars,
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
  await annotateTradeActor(result, actorProfile).catch(() => {})
  if (result?.status === 'queued') {
    return jsonResponse({ ...result, submitted_price: livePrice })
  }
  return jsonResponse({ ...result, price: livePrice })
}
