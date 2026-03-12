export const config = { runtime: 'edge' }

import { getImmediateExecutionPrice } from '../src/lib/tradePricing.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
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

  // Fetch live price server-side (the key security fix)
  const livePrice = await fetchLivePrice(ticker.toUpperCase())
  if (!livePrice || livePrice <= 0) {
    return jsonResponse({ error: `Could not fetch live price for ${ticker}` }, 400)
  }

  // Fetch benchmark price server-side too
  const bmTicker = benchmark_ticker || 'SPY'
  const bmPrice = await fetchLivePrice(bmTicker)

  // Call Supabase RPC using the user's JWT so auth.uid() resolves correctly
  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/place_trade_order`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${userJwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
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
  if (result?.status === 'queued') {
    return jsonResponse({ ...result, submitted_price: livePrice })
  }
  return jsonResponse({ ...result, price: livePrice })
}
