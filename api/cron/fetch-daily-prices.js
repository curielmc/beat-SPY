export const config = { runtime: 'edge' }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, FMP_KEY, sbFetch, jsonResponse } from '../_lib/supabase.js'

const FMP_BASE = 'https://financialmodelingprep.com/api/v3'

async function fmpHistoricalDaily(ticker, from, to) {
  if (!ticker || !FMP_KEY) return []
  const url = `${FMP_BASE}/historical-price-full/${ticker}?serietype=line&from=${from}&to=${to}&apikey=${FMP_KEY}`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return data?.historical || []
  } catch (e) {
    console.error(`[FMP] Failed to fetch ${ticker}:`, e)
    return []
  }
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
    const tradesRes = await fetch(`${SUPABASE_URL}/rest/v1/trades?select=executed_at&order=executed_at.asc&limit=1`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    })

    if (!tradesRes.ok) {
      return jsonResponse({ error: 'Failed to fetch earliest trade' }, 500)
    }

    const trades = await tradesRes.json()
    const earliestTrade = trades?.[0]
    if (!earliestTrade?.executed_at) {
      return jsonResponse({ message: 'No trades found' }, 200)
    }

    const fromDate = earliestTrade.executed_at.split('T')[0]
    const toDate = new Date().toISOString().split('T')[0]

    console.log(`[Cron] Fetching prices from ${fromDate} to ${toDate}`)

    // 2. Get all unique tickers from trades (across all classes/portfolios)
    const tickersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/trades?select=ticker&distinct=true`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    )

    if (!tickersRes.ok) {
      return jsonResponse({ error: 'Failed to fetch tickers' }, 500)
    }

    const tickerRows = await tickersRes.json()
    const tickers = (tickerRows || [])
      .map(r => r.ticker)
      .filter(Boolean)
      .filter((t, i, a) => a.indexOf(t) === i) // unique

    if (!tickers.length) {
      return jsonResponse({ message: 'No tickers found' }, 200)
    }

    console.log(`[Cron] Found ${tickers.length} unique tickers`)

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
        const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/daily_prices`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates'
          },
          body: JSON.stringify(prices)
        })

        if (!upsertRes.ok) {
          const err = await upsertRes.text()
          console.error(`[Cron] Failed to insert prices for ${ticker}:`, err)
          errors.push(`${ticker}: ${err}`)
        } else {
          totalInserted += prices.length
          console.log(`[Cron] Inserted ${prices.length} prices for ${ticker}`)
        }
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
