export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const FMP_KEY = process.env.VITE_FMP_API_KEY

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }
  })
  if (!res.ok) return null
  return res.json()
}

export default async function handler(req) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Get all active portfolios with their holdings
  const portfolios = await sbFetch('/portfolios?status=eq.active&select=id,cash_balance,starting_cash,holdings(ticker,shares)')
  if (!portfolios?.length) {
    return new Response(JSON.stringify({ message: 'No active portfolios' }), { headers: { 'Content-Type': 'application/json' } })
  }

  // Collect all unique tickers
  const allTickers = new Set()
  for (const p of portfolios) {
    for (const h of (p.holdings || [])) allTickers.add(h.ticker)
  }

  // Fetch current prices from FMP
  const tickerList = [...allTickers]
  const priceMap = {}

  if (FMP_KEY && tickerList.length > 0) {
    // FMP batch quote supports up to 50 tickers at a time
    for (let i = 0; i < tickerList.length; i += 50) {
      const batch = tickerList.slice(i, i + 50)
      try {
        const quotes = await fetch(`https://financialmodelingprep.com/api/v3/quote/${batch.join(',')}?apikey=${FMP_KEY}`).then(r => r.json())
        for (const q of (quotes || [])) {
          priceMap[q.symbol] = q.price
        }
      } catch (e) {
        // continue with partial data
      }
    }
  }

  const now = new Date()
  const today = now.toISOString()
  // Use ET date for snapshot_date
  const etDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const snapshotDate = etDate.toISOString().split('T')[0]
  let snapshotted = 0
  const errors = []

  for (const p of portfolios) {
    try {
      const holdingsValue = (p.holdings || []).reduce((sum, h) => {
        const price = priceMap[h.ticker] || 0
        return sum + (Number(h.shares) * price)
      }, 0)
      const totalValue = holdingsValue + Number(p.cash_balance)
      const returnPct = Number(p.starting_cash) > 0
        ? ((totalValue - Number(p.starting_cash)) / Number(p.starting_cash)) * 100
        : 0

      // Upsert snapshot (one per portfolio per day)
      const res = await fetch(`${SUPABASE_URL}/rest/v1/portfolio_snapshots`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify({
          portfolio_id: p.id,
          snapshot_type: 'daily',
          snapshot_date: snapshotDate,
          cash_balance: Number(p.cash_balance),
          starting_cash: Number(p.starting_cash),
          total_value: totalValue,
          return_pct: returnPct,
          holdings: (p.holdings || []).map(h => ({
            ticker: h.ticker,
            shares: Number(h.shares),
            price: priceMap[h.ticker] || 0
          })),
          snapshotted_at: today
        })
      })

      if (res.ok) snapshotted++
      else errors.push({ id: p.id, error: await res.text() })
    } catch (e) {
      errors.push({ id: p.id, error: e.message })
    }
  }

  return new Response(JSON.stringify({
    snapshotted,
    total: portfolios.length,
    prices_fetched: Object.keys(priceMap).length,
    errors: errors.length > 0 ? errors : undefined
  }), { headers: { 'Content-Type': 'application/json' } })
}
