// Loads SPY constituents for a given as_of_date; returns Set<string> of tickers.
// Used by universe enforcement to validate trades against an SPY snapshot.
import { sbFetch } from '../../api/_lib/supabase.js'

const cache = new Map() // as_of_date -> { fetchedAt, set }
const TTL_MS = 5 * 60 * 1000

export async function loadSpyConstituentsAsOf(asOfDate) {
  const key = asOfDate
  const hit = cache.get(key)
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.set
  const rows = await sbFetch(`/spy_constituents?as_of_date=eq.${key}&select=ticker`)
  const set = new Set((rows || []).map(r => String(r.ticker).toUpperCase()))
  cache.set(key, { fetchedAt: Date.now(), set })
  return set
}

export async function loadLatestSpyConstituents() {
  const rows = await sbFetch(`/spy_constituents?select=as_of_date&order=as_of_date.desc&limit=1`)
  if (!rows?.length) return new Set()
  return loadSpyConstituentsAsOf(rows[0].as_of_date)
}
