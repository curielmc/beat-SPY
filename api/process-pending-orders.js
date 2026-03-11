export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const FMP_KEY = process.env.VITE_FMP_API_KEY

function isMarketOpen(now = new Date()) {
  const easternTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = easternTime.getDay()
  const timeInMinutes = easternTime.getHours() * 60 + easternTime.getMinutes()
  return day >= 1 && day <= 5 && timeInMinutes >= 570 && timeInMinutes < 960
}

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
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

async function sbRpc(fn, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    throw new Error(await res.text())
  }

  return res.json()
}

async function fetchQuotes(tickers) {
  const priceMap = {}
  if (!FMP_KEY || tickers.length === 0) return priceMap

  for (let i = 0; i < tickers.length; i += 50) {
    const batch = tickers.slice(i, i + 50)
    try {
      const quotes = await fetch(`https://financialmodelingprep.com/api/v3/quote/${batch.join(',')}?apikey=${FMP_KEY}`).then(r => r.json())
      for (const quote of (quotes || [])) {
        priceMap[quote.symbol] = quote.price || quote.previousClose || null
      }
    } catch (err) {
      // Partial quote fetches are acceptable; failed symbols will fail execution individually.
    }
  }

  return priceMap
}

export default async function handler(req) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!isMarketOpen()) {
    return new Response(JSON.stringify({ processed: 0, skipped: true, reason: 'market_closed' }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const nowIso = new Date().toISOString()
  const path = `/pending_trade_orders?status=in.(queued,processing)&execute_after=lte.${encodeURIComponent(nowIso)}&select=id,ticker,portfolio_id,portfolios(benchmark_ticker)&order=requested_at.asc&limit=100`
  const orders = await sbFetch(path).catch(() => [])

  if (!orders.length) {
    return new Response(JSON.stringify({ processed: 0, queued: 0 }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const tickers = new Set()
  for (const order of orders) {
    if (order.ticker) tickers.add(order.ticker)
    tickers.add(order.portfolios?.benchmark_ticker || 'SPY')
  }

  const quotes = await fetchQuotes([...tickers])
  const results = []

  for (const order of orders) {
    const benchmarkTicker = order.portfolios?.benchmark_ticker || 'SPY'
    try {
      const data = await sbRpc('execute_pending_trade_order', {
        p_order_id: order.id,
        p_price: quotes[order.ticker] ?? null,
        p_benchmark_price: quotes[benchmarkTicker] ?? null
      })
      results.push({ id: order.id, success: true, status: data?.status || 'executed' })
    } catch (error) {
      results.push({ id: order.id, success: false, error: error.message })
    }
  }

  return new Response(JSON.stringify({
    processed: results.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
