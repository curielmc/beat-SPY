// Synthetic historical portfolio data generator
// Uses seeded PRNG for deterministic results across page loads
// End values are pinned to match live computed portfolio values from portfolios.json + stocks.json

const STARTING_CASH = 100000
const INCEPTION = new Date('2021-01-04')
const TODAY = new Date('2026-02-27')

// Pre-computed end values from portfolios.json + stocks.json (includes intl stocks, bonds, REITs)
const GROUP_PARAMS = {
  g1: { endValue: 77386.80, volatility: 0.018, seed: 101 },
  g2: { endValue: 62621.20, volatility: 0.022, seed: 202 },
  g3: { endValue: 77056.25, volatility: 0.012, seed: 303 },
  g4: { endValue: 80009.70, volatility: 0.020, seed: 404 },
  g5: { endValue: 63586.00, volatility: 0.014, seed: 505 },
}

// S&P 500: ~10% annualized over 5 years → ~161,051
const SP500_END = STARTING_CASH * Math.pow(1.10, (TODAY - INCEPTION) / (365.25 * 24 * 60 * 60 * 1000))
const SP500_VOLATILITY = 0.010
const SP500_SEED = 999

function seededRNG(seed) {
  let s = seed
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function generateTradingDays(start, end) {
  const days = []
  const d = new Date(start)
  while (d <= end) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) {
      days.push(new Date(d))
    }
    d.setDate(d.getDate() + 1)
  }
  return days
}

function generateSeries(startValue, endValue, volatility, seed, days) {
  const rng = seededRNG(seed)
  const n = days.length
  const totalReturn = endValue / startValue
  const dailyDrift = Math.pow(totalReturn, 1 / n) - 1

  const values = [startValue]
  for (let i = 1; i < n; i++) {
    const noise = (rng() - 0.5) * 2 * volatility
    const prev = values[i - 1]
    values.push(prev * (1 + dailyDrift + noise))
  }

  // Pin the final value by scaling the last 20 days smoothly
  const actual = values[n - 1]
  const ratio = endValue / actual
  const smoothStart = Math.max(0, n - 20)
  for (let i = smoothStart; i < n; i++) {
    const t = (i - smoothStart) / (n - 1 - smoothStart)
    const blend = 1 + (ratio - 1) * t
    values[i] *= blend
  }
  values[n - 1] = endValue

  return days.map((date, i) => ({ date, value: values[i] }))
}

const tradingDays = generateTradingDays(INCEPTION, TODAY)

export function generateGroupHistory(groupId) {
  const params = GROUP_PARAMS[groupId]
  if (!params) return []
  return generateSeries(STARTING_CASH, params.endValue, params.volatility, params.seed, tradingDays)
}

export function generateSP500History() {
  return generateSeries(STARTING_CASH, SP500_END, SP500_VOLATILITY, SP500_SEED, tradingDays)
}

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function generateStockHistory(ticker, currentPrice) {
  const seed = hashString(ticker) || 12345
  const rng = seededRNG(seed)
  const annualReturn = 0.06 + rng() * 0.12
  const years = (TODAY - INCEPTION) / (365.25 * 24 * 60 * 60 * 1000)
  const startPrice = currentPrice / Math.pow(1 + annualReturn, years)
  const vol = 0.012 + rng() * 0.015
  return generateSeries(startPrice, currentPrice, vol, seed + 7, tradingDays)
}
