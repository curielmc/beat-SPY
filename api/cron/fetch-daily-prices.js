export const config = { runtime: 'edge' }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, FMP_KEY, sbFetch, jsonResponse } from '../_lib/supabase.js'

const FMP_BASE = 'https://financialmodelingprep.com/api/v3'

// Fetch historical closes for a batch of tickers in one request.
// FMP accepts comma-separated tickers and returns { historicalStockList: [...] }.
// Returns a map { ticker: [ {date, close}, ... ] }.
async function fmpHistoricalBatch(tickers, from, to, retries = 2) {
  if (!tickers?.length || !FMP_KEY) return {}
  const csv = tickers.join(',')
  const url = `${FMP_BASE}/historical-price-full/${csv}?serietype=line&from=${from}&to=${to}&apikey=${FMP_KEY}`

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        console.warn(`[FMP] batch of ${tickers.length} returned status ${res.status}`)
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
        return {}
      }
      const text = await res.text()
      if (!text) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
        return {}
      }
      const data = JSON.parse(text)
      const out = {}
      if (data?.historicalStockList) {
        for (const s of data.historicalStockList) out[s.symbol] = s.historical || []
      } else if (data?.historical && tickers.length === 1) {
        out[tickers[0]] = data.historical
      }
      return out
    } catch (e) {
      console.error(`[FMP] batch attempt ${attempt + 1}/${retries + 1} failed:`, e.message)
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      }
    }
  }
  return {}
}

export default async function handler(req) {
  // Vercel scheduled crons invoke this via GET; manual triggers use POST.
  if (req.method !== 'GET' && req.method !== 'POST') {
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

    // 3. Fetch historical prices in batches from FMP (single request per batch).
    const BATCH_SIZE = 20
    let totalInserted = 0
    const errors = []

    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const batch = tickers.slice(i, i + BATCH_SIZE)
      const histByTicker = await fmpHistoricalBatch(batch, fromDate, toDate)

      const allPrices = []
      for (const ticker of batch) {
        const historical = histByTicker[ticker] || []
        if (!historical.length) continue
        for (const h of historical) {
          allPrices.push({
            ticker,
            price_date: h.date,
            close_price: h.close,
            adj_close_price: h.adjClose || h.close
          })
        }
      }

      if (!allPrices.length) continue

      try {
        // Upsert: insert or update if conflict on (ticker, price_date).
        // on_conflict query param is required because the table also has a
        // primary key (id), and PostgREST defaults to PK as the conflict
        // target unless told otherwise.
        await sbFetch(`/daily_prices?on_conflict=ticker,price_date`, {
          method: 'POST',
          headers: {
            Prefer: 'resolution=merge-duplicates'
          },
          body: JSON.stringify(allPrices)
        })
        totalInserted += allPrices.length
        console.log(`[Cron] Upserted ${allPrices.length} prices for batch of ${batch.length}`)
      } catch (e) {
        console.error('[Cron] Batch upsert failed:', e)
        errors.push(`batch ${i}: ${e.message}`)
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
