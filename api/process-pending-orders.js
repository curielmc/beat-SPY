export const config = { runtime: 'edge' }

import { getQueuedExecutionPrice } from '../src/lib/tradePricing.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const FMP_KEY = process.env.VITE_FMP_API_KEY

function easterDate(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451), em = h + l - 7 * m + 114
  return new Date(year, Math.floor(em / 31) - 1, (em % 31) + 1)
}

function isUSMarketHoliday(date) {
  const y = date.getFullYear()
  const same = (a, b) => a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const observed = (m, d) => { const dt = new Date(y, m - 1, d); const dow = dt.getDay(); if (dow === 0) dt.setDate(dt.getDate() + 1); if (dow === 6) dt.setDate(dt.getDate() - 1); return dt }
  const nthDay = (m, wd, n) => { const f = new Date(y, m - 1, 1); return new Date(y, m - 1, 1 + ((wd - f.getDay() + 7) % 7) + (n - 1) * 7) }
  const lastMon = () => { const last = new Date(y, 5, 0); return new Date(y, 4, last.getDate() - ((last.getDay() - 1 + 7) % 7)) }
  const holidays = [
    observed(1, 1), nthDay(1, 1, 3), nthDay(2, 1, 3),
    new Date(easterDate(y).getTime() - 2 * 86400000),
    lastMon(), observed(6, 19), observed(7, 4),
    nthDay(9, 1, 1), nthDay(11, 4, 4), observed(12, 25)
  ]
  return holidays.some(h => same(h, date))
}

function isMarketOpen(now = new Date()) {
  const easternTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = easternTime.getDay()
  const timeInMinutes = easternTime.getHours() * 60 + easternTime.getMinutes()
  return day >= 1 && day <= 5 && timeInMinutes >= 570 && timeInMinutes < 960 && !isUSMarketHoliday(easternTime)
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
  const quoteMap = {}
  if (!FMP_KEY || tickers.length === 0) return quoteMap

  for (let i = 0; i < tickers.length; i += 50) {
    const batch = tickers.slice(i, i + 50)
    try {
      const quotes = await fetch(`https://financialmodelingprep.com/api/v3/quote/${batch.join(',')}?apikey=${FMP_KEY}`).then(r => r.json())
      for (const quote of (quotes || [])) {
        quoteMap[quote.symbol] = quote
      }
    } catch (err) {
      // Partial quote fetches are acceptable; failed symbols will fail execution individually.
    }
  }

  return quoteMap
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
  let skipped = 0

  for (const order of orders) {
    const benchmarkTicker = order.portfolios?.benchmark_ticker || 'SPY'
    const executionPrice = getQueuedExecutionPrice(quotes[order.ticker])
    const benchmarkExecutionPrice = getQueuedExecutionPrice(quotes[benchmarkTicker])

    if (!executionPrice || !benchmarkExecutionPrice) {
      skipped += 1
      results.push({
        id: order.id,
        success: false,
        skipped: true,
        reason: 'opening_price_unavailable'
      })
      continue
    }

    try {
      const data = await sbRpc('execute_pending_trade_order', {
        p_order_id: order.id,
        p_price: executionPrice,
        p_benchmark_price: benchmarkExecutionPrice
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
    skipped,
    results
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
