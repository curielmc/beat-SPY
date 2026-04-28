// Pure helper to enforce a competition's universe rule against a ticker.
// Throws UniverseError on violation; returns true on allow.
//
// Modes:
//   - app_all: no restriction
//   - sp500_via_spy: ticker must be in the provided sp500Set (snapshot of SPY constituents)
//   - custom_list: ticker must appear in universe.tickers
//   - exclude_list: ticker must NOT appear in universe.tickers

export class UniverseError extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'UniverseError'
  }
}

export function assertTickerAllowed(universe, ticker, sp500Set) {
  const t = String(ticker || '').toUpperCase()
  const mode = universe?.mode || 'app_all'

  if (mode === 'app_all') return true

  if (mode === 'sp500_via_spy') {
    if (!sp500Set?.has(t)) {
      throw new UniverseError(`${t} is not in the S&P 500 (universe: sp500_via_spy)`)
    }
    return true
  }

  const list = (universe?.tickers || []).map(s => String(s).toUpperCase())

  if (mode === 'custom_list') {
    if (!list.includes(t)) {
      throw new UniverseError(`${t} is not in the allowed list for this challenge`)
    }
    return true
  }

  if (mode === 'exclude_list') {
    if (list.includes(t)) {
      throw new UniverseError(`${t} is restricted in this challenge`)
    }
    return true
  }

  throw new UniverseError(`Unknown universe mode: ${mode}`)
}
