export const config = { runtime: 'edge' }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, FMP_KEY, sbFetch, jsonResponse } from '../_lib/supabase.js'

const FMP_BASE = 'https://financialmodelingprep.com/api/v3'

async function fmpHistoricalDaily(ticker, from, to, retries = 2) {
  if (!ticker || !FMP_KEY) return []
  const url = `${FMP_BASE}/historical-price-full/${ticker}?serietype=line&from=${from}&to=${to}&apikey=${FMP_KEY}`

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        console.warn(`[FMP] ${ticker} returned status ${res.status}`)
        return []
      }
      const text = await res.text()
      if (!text || text.length === 0) {
        console.warn(`[FMP] ${ticker} returned empty response`)
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
        return []
      }
      const data = JSON.parse(text)
      return data?.historical || []
    } catch (e) {
      console.error(`[FMP] Attempt ${attempt + 1}/${retries + 1} failed for ${ticker}:`, e.message)
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      }
    }
  }
  return []
}

export default async function handler(req) {
  // Verify this is a cron request (would have x-vercel-cron header in production)
  // For local testing, allow POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    console.log('[Cron] Starting daily prices fetch...')

    // 1. Find earliest trade date across all portfolios
    const trades = await sbFetch(`/trades?select=executed_at&order=executed_at.asc&limit=1`)

    const earliestTrade = trades?.[0]
    if (!earliestTrade?.executed_at) {
      return jsonResponse({ message: 'No trades found' }, 200)
    }

    const fromDate = earliestTrade.executed_at.split('T')[0]
    const toDate = new Date().toISOString().split('T')[0]

    console.log(`[Cron] Fetching prices from ${fromDate} to ${toDate}`)

    // 2. Get all unique tickers from trades (across all classes/portfolios)
    const tickerRows = await sbFetch(`/trades?select=ticker`)

    const tickers = [...new Set(
      (tickerRows || [])
        .map(r => r.ticker)
        .filter(Boolean)
    )]

    // Always include SPY for benchmark comparison
    if (!tickers.includes('SPY')) {
      tickers.push('SPY')
    }

    if (!tickers.length) {
      return jsonResponse({ message: 'No tickers found' }, 200)
    }

    console.log(`[Cron] Found ${tickers.length} unique tickers (including SPY for benchmark)`)

    // 3. Fetch historical prices for each ticker from FMP
    let totalInserted = 0
    const errors = []

    for (const ticker of tickers) {
      try {
        const historical = await fmpHistoricalDaily(ticker, fromDate, toDate)
        if (!historical.length) {
          console.log(`[Cron] No historical data for ${ticker}`)
          continue
        }

        // 4. Insert/upsert prices into daily_prices table
        // FMP returns newest first, so reverse for insertion
        const prices = historical.reverse().map(h => ({
          ticker,
          price_date: h.date,
          close_price: h.close,
          adj_close_price: h.adjClose || h.close
        }))

        // Upsert: insert or update if conflict on (ticker, price_date)
        await sbFetch(`/daily_prices`, {
          method: 'POST',
          headers: {
            Prefer: 'resolution=merge-duplicates'
          },
          body: JSON.stringify(prices)
        })

        totalInserted += prices.length
        console.log(`[Cron] Inserted ${prices.length} prices for ${ticker}`)
      } catch (e) {
        console.error(`[Cron] Error processing ${ticker}:`, e)
        errors.push(`${ticker}: ${e.message}`)
      }
    }

    const result = {
      message: 'Daily prices fetch completed',
      tickersProcessed: tickers.length,
      pricesInserted: totalInserted,
      fromDate,
      toDate,
      errors: errors.length > 0 ? errors : undefined
    }

    console.log('[Cron] Result:', result)
    return jsonResponse(result, 200)
  } catch (error) {
    console.error('[Cron] Fatal error:', error)
    return jsonResponse({ error: error.message || 'Unknown error' }, 500)
  }
}
