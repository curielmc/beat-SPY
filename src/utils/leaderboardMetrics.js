/**
 * Pure calculation functions for multi-metric leaderboard.
 * All functions are stateless — no API calls or store access.
 */

/**
 * Reconstruct what holdings looked like on a past date by reversing trades
 * that happened after that date.
 * Undo buy  = subtract shares
 * Undo sell = add shares
 */
export function reconstructHoldingsAsOf(currentHoldings, trades, asOfDate) {
  // Clone current holdings into a map { ticker: shares }
  const map = {}
  for (const h of currentHoldings) {
    map[h.ticker] = Number(h.shares)
  }

  // Walk trades (assumed newest-first) and undo any after asOfDate
  for (const t of trades) {
    const tradeDate = new Date(t.executed_at)
    if (tradeDate <= asOfDate) break
    const shares = Number(t.shares)
    if (t.side === 'buy') {
      map[t.ticker] = (map[t.ticker] || 0) - shares
    } else {
      map[t.ticker] = (map[t.ticker] || 0) + shares
    }
  }

  // Filter out tickers with zero or negative shares (fully sold since then)
  return Object.entries(map)
    .filter(([, shares]) => shares > 0.0001)
    .map(([ticker, shares]) => ({ ticker, shares }))
}

/**
 * Reconstruct cash balance on a past date by reversing trades after that date.
 * Undo buy  = add dollars back
 * Undo sell = subtract dollars
 */
export function reconstructCashAsOf(currentCash, trades, asOfDate) {
  let cash = Number(currentCash)
  for (const t of trades) {
    const tradeDate = new Date(t.executed_at)
    if (tradeDate <= asOfDate) break
    const dollars = Number(t.dollars)
    if (t.side === 'buy') {
      cash += dollars
    } else {
      cash -= dollars
    }
  }
  return cash
}

/**
 * Simple period return: ((current - past) / past) * 100
 */
export function computePeriodReturn(pastValue, currentValue) {
  if (!pastValue || pastValue === 0) return 0
  return ((currentValue - pastValue) / pastValue) * 100
}

/**
 * Today's return using previousClose from FMP quote objects.
 * Calculates yesterday's portfolio value using previousClose prices,
 * then compares to current value.
 */
export function computeTodayReturn(holdings, quotes, cash) {
  const yesterdayValue = holdings.reduce((sum, h) => {
    const q = quotes[h.ticker]
    const prevClose = q?.previousClose || q?.price || 0
    return sum + (Number(h.shares) * prevClose)
  }, 0) + Number(cash)

  const currentValue = holdings.reduce((sum, h) => {
    const q = quotes[h.ticker]
    const price = q?.price || 0
    return sum + (Number(h.shares) * price)
  }, 0) + Number(cash)

  return computePeriodReturn(yesterdayValue, currentValue)
}

/**
 * Annualized return.
 * If portfolio is younger than 18 days, returns the raw total return instead.
 */
export function computeAnnualizedReturn(totalReturnPct, createdAt) {
  const created = new Date(createdAt)
  const now = new Date()
  const days = (now - created) / (1000 * 60 * 60 * 24)
  if (days < 18) return totalReturnPct

  const years = days / 365.25
  const totalMultiplier = 1 + totalReturnPct / 100
  if (totalMultiplier <= 0) return -100
  return (Math.pow(totalMultiplier, 1 / years) - 1) * 100
}

/**
 * Risk-adjusted return = sinceInception / weighted portfolio beta.
 * If beta data is missing for all holdings, returns the raw return.
 */
export function computeRiskAdjustedReturn(returnPct, holdings, profiles) {
  let totalWeight = 0
  let weightedBeta = 0

  for (const h of holdings) {
    const profile = profiles[h.ticker]
    if (profile?.beta && profile.beta > 0) {
      const weight = Number(h.shares) // weight by share count (will normalize)
      totalWeight += weight
      weightedBeta += weight * profile.beta
    }
  }

  if (totalWeight === 0 || weightedBeta === 0) return returnPct
  const portfolioBeta = weightedBeta / totalWeight
  return returnPct / portfolioBeta
}
