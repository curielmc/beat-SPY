export const config = { runtime: 'edge' }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, FMP_KEY, sbFetch, jsonResponse } from '../_lib/supabase.js'

// Primary source: Financial Modeling Prep `/etf-holder/SPY` — already wired into the
// codebase via FMP_KEY (VITE_FMP_API_KEY). Returns clean JSON: [{ asset, weightPercentage, ... }, ...].
//
// Backup source: SSGA's daily holdings file at
//   https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx
// SSGA's primary distribution is .xlsx (not CSV) — they do not publish a stable
// CSV mirror. To use SSGA, set SSGA_SPY_HOLDINGS_URL to a CSV mirror; the parser
// below assumes CSV. Otherwise we rely on FMP.

const FMP_BASE = 'https://financialmodelingprep.com/api/v3'
const SSGA_CSV_URL = process.env.SSGA_SPY_HOLDINGS_URL || null

export default async function handler(req) {
  // Vercel cron auth (Bearer CRON_SECRET).
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  let rows = []
  let source = null

  // Try FMP first (preferred — already authenticated, JSON, stable).
  if (FMP_KEY) {
    try {
      rows = await fetchFromFmp()
      source = 'fmp'
    } catch (e) {
      console.error('[spy-constituents] FMP fetch failed:', e.message)
    }
  }

  // Fall back to SSGA CSV mirror if explicitly configured.
  if (rows.length < 400 && SSGA_CSV_URL) {
    try {
      const csv = await fetch(SSGA_CSV_URL).then(r => {
        if (!r.ok) throw new Error(`SSGA fetch ${r.status}`)
        return r.text()
      })
      rows = parseHoldingsCsv(csv)
      source = 'ssga'
    } catch (e) {
      console.error('[spy-constituents] SSGA fetch failed:', e.message)
    }
  }

  // Sanity check — SPY has ~500 holdings. If we got fewer than 400, source format changed.
  if (rows.length < 400) {
    return jsonResponse({ error: 'sanity_check_failed', got: rows.length, source }, 500)
  }

  const today = new Date().toISOString().slice(0, 10)
  const payload = rows.map(r => ({ ticker: r.ticker, weight: r.weight, as_of_date: today }))

  const res = await fetch(`${SUPABASE_URL}/rest/v1/spy_constituents?on_conflict=ticker,as_of_date`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(payload)
  })
  if (!res.ok) return jsonResponse({ error: 'upsert_failed', detail: await res.text() }, 500)

  return jsonResponse({ ok: true, as_of_date: today, count: rows.length, source })
}

async function fetchFromFmp() {
  const url = `${FMP_BASE}/etf-holder/SPY?apikey=${FMP_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`FMP etf-holder ${res.status}`)
  const data = await res.json()
  if (!Array.isArray(data)) throw new Error('FMP etf-holder: unexpected response shape')
  const out = []
  for (const h of data) {
    const ticker = String(h.asset || '').toUpperCase()
    if (!/^[A-Z.\-]{1,8}$/.test(ticker)) continue
    const w = Number(h.weightPercentage)
    out.push({ ticker, weight: Number.isFinite(w) ? w : null })
  }
  return out
}

// SSGA holdings CSVs typically have a few header lines, then:
//   "Name,Ticker,Identifier,SEDOL,Weight,Sector,Shares Held,Local Currency"
export function parseHoldingsCsv(csv) {
  const lines = csv.split(/\r?\n/)
  const headerIdx = lines.findIndex(l => /\bTicker\b/i.test(l) && /\bWeight\b/i.test(l))
  if (headerIdx < 0) return []
  const headers = lines[headerIdx].split(',').map(s => s.replace(/"/g, '').trim())
  const tIx = headers.findIndex(h => /^Ticker$/i.test(h))
  const wIx = headers.findIndex(h => /^Weight/i.test(h))
  if (tIx < 0 || wIx < 0) return []
  const out = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(s => s.replace(/"/g, '').trim())
    if (!cols[tIx]) continue
    const ticker = cols[tIx].toUpperCase()
    if (!/^[A-Z.\-]{1,8}$/.test(ticker)) continue
    const w = Number(String(cols[wIx]).replace('%', '').trim())
    out.push({ ticker, weight: Number.isFinite(w) ? w : null })
  }
  return out
}
