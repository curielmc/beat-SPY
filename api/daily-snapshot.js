export const config = { runtime: 'edge' }

import { FMP_KEY, sbFetch as _sbFetch } from './_lib/supabase.js'
import { OWNER_EMAIL, AGENTMAIL_INBOX } from './_lib/constants.js'

async function sbFetch(path) {
  return _sbFetch(path).catch(() => null)
}

async function notifyAdmin(subject, body) {
  const AGENTMAIL_KEY = process.env.AGENTMAIL_API_KEY
  if (!AGENTMAIL_KEY) return
  try {
    await fetch(`https://api.agentmail.to/v0/inboxes/${AGENTMAIL_INBOX}/messages/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AGENTMAIL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: [OWNER_EMAIL],
        subject,
        html: `<div style="font-family:sans-serif;padding:20px;">
          <h2 style="color:#dc2626;">${subject}</h2>
          <pre style="background:#f3f4f6;padding:16px;border-radius:8px;overflow:auto;">${body}</pre>
          <p style="color:#9ca3af;font-size:12px;margin-top:16px;">Automated alert from Beat the S&amp;P 500 daily snapshot cron.</p>
        </div>`
      })
    })
  } catch (e) { /* best effort */ }
}

export default async function handler(req) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Get all active portfolios with their holdings
  const portfolios = await sbFetch('/portfolios?status=eq.active&select=id,cash_balance,starting_cash,holdings(ticker,shares)')
  if (!portfolios?.length) {
    await notifyAdmin('⚠️ Daily Snapshot: No active portfolios found', 'The cron ran but found zero active portfolios. This is unexpected.')
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

  const result = {
    snapshotted,
    total: portfolios.length,
    prices_fetched: Object.keys(priceMap).length,
    errors: errors.length > 0 ? errors : undefined
  }

  // Alert admin if there were failures
  if (errors.length > 0 || snapshotted === 0) {
    await notifyAdmin(
      `⚠️ Daily Snapshot: ${errors.length} error(s), ${snapshotted}/${portfolios.length} succeeded`,
      JSON.stringify(result, null, 2)
    )
  }

  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
}
