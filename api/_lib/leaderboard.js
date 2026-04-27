// Compute class rankings (groups, individuals, funds) over a window from
// `startDate` to today, plus the SPY benchmark return for the same window.
//
// Returns { groups, individuals, funds, spyReturnPct, windowStart, windowEnd }.
//
// Strategy:
//  - Window start value comes from portfolio_snapshots (daily) at-or-just-before
//    startDate; if none exists, we use the portfolio's starting cash (treats
//    the window as inception-to-now for that portfolio).
//  - Current value = sum(cash + holdings * current price).
//  - % return = (currentValue - startValue) / startValue * 100.
//  - Funds are individual portfolios owned by groups (each group has 1+ funds).

import { sbFetch, FMP_KEY } from './supabase.js'

const FMP_BASE = 'https://financialmodelingprep.com/api/v3'

async function fmpBatchQuotes(tickers) {
  if (!tickers.length || !FMP_KEY) return {}
  const csv = tickers.join(',')
  const res = await fetch(`${FMP_BASE}/quote/${csv}?apikey=${FMP_KEY}`).catch(() => null)
  if (!res || !res.ok) return {}
  const data = await res.json().catch(() => [])
  const map = {}
  for (const q of (data || [])) {
    if (q.symbol && q.price) map[q.symbol] = q.price
  }
  return map
}

async function fmpHistoricalClose(ticker, date) {
  if (!ticker || !date || !FMP_KEY) return null
  const res = await fetch(`${FMP_BASE}/historical-price-full/${ticker}?from=${date}&to=${date}&apikey=${FMP_KEY}`).catch(() => null)
  if (!res || !res.ok) return null
  const data = await res.json().catch(() => null)
  return data?.historical?.[0]?.close || null
}

// Find the snapshot row at-or-before windowStart. Returns null if none.
function pickStartSnapshot(snapshots, windowStart) {
  let best = null
  for (const s of snapshots) {
    if (!s.snapshotted_at) continue
    if (s.snapshotted_at > windowStart) continue
    if (!best || s.snapshotted_at > best.snapshotted_at) best = s
  }
  return best
}

export async function computeLeaderboard({ classId, windowStart }) {
  const windowEnd = new Date().toISOString()
  const windowStartIso = new Date(windowStart).toISOString()
  const windowStartDate = windowStartIso.split('T')[0]

  // 1. Class structure
  const groups = await sbFetch(`/groups?class_id=eq.${classId}&select=id,name`)
  if (!groups?.length) {
    return { groups: [], individuals: [], funds: [], spyReturnPct: 0, windowStart: windowStartIso, windowEnd }
  }
  const groupIds = groups.map(g => g.id)
  const groupIdFilter = groupIds.map(id => encodeURIComponent(id)).join(',')

  const memberships = await sbFetch(
    `/class_memberships?class_id=eq.${classId}&select=user_id,group_id,profiles:profiles(full_name)`
  ) || []

  // 2. Portfolios (group + student)
  const groupPortfolios = await sbFetch(
    `/portfolios?owner_type=eq.group&owner_id=in.(${groupIdFilter})&or=(status.eq.active,status.is.null)&select=id,owner_id,owner_type,cash_balance,starting_cash,fund_starting_cash,fund_name,fund_number,created_at`
  ) || []

  const studentIds = new Set(memberships.map(m => m.user_id))
  const studentPortfoliosRaw = await sbFetch(
    `/portfolios?owner_type=eq.user&or=(status.eq.active,status.is.null)&select=id,owner_id,owner_type,cash_balance,starting_cash,fund_starting_cash,fund_name,fund_number,created_at`
  ) || []
  const studentPortfolios = studentPortfoliosRaw.filter(p => studentIds.has(p.owner_id))

  const allPortfolios = [...groupPortfolios, ...studentPortfolios]
  if (!allPortfolios.length) {
    return { groups: [], individuals: [], funds: [], spyReturnPct: 0, windowStart: windowStartIso, windowEnd }
  }

  const portfolioIds = allPortfolios.map(p => p.id)
  const portfolioIdFilter = portfolioIds.map(id => encodeURIComponent(id)).join(',')

  // 3. Holdings + snapshots in the window
  const holdings = await sbFetch(
    `/holdings?portfolio_id=in.(${portfolioIdFilter})&select=portfolio_id,ticker,shares,avg_cost`
  ) || []

  // Pull snapshots from before window start through now. We need the most
  // recent snapshot at-or-before windowStart per portfolio.
  // Cap volume by snapshot_type=daily.
  const snapshots = await sbFetch(
    `/portfolio_snapshots?portfolio_id=in.(${portfolioIdFilter})&snapshot_type=eq.daily&select=portfolio_id,total_value,snapshotted_at&order=snapshotted_at.asc`
  ) || []
  const snapshotsByPortfolio = {}
  for (const s of snapshots) {
    if (!snapshotsByPortfolio[s.portfolio_id]) snapshotsByPortfolio[s.portfolio_id] = []
    snapshotsByPortfolio[s.portfolio_id].push(s)
  }

  // 4. Prices (current + SPY at window start)
  const tickers = [...new Set([...holdings.map(h => h.ticker).filter(Boolean), 'SPY'])]
  const [priceMap, spyStartPrice] = await Promise.all([
    fmpBatchQuotes(tickers),
    fmpHistoricalClose('SPY', windowStartDate)
  ])
  const spyCurrent = priceMap['SPY']
  const spyReturnPct = (spyStartPrice && spyCurrent)
    ? ((spyCurrent - spyStartPrice) / spyStartPrice) * 100
    : 0

  // 5. Holdings by portfolio
  const holdingsByPortfolio = {}
  for (const h of holdings) {
    if (!holdingsByPortfolio[h.portfolio_id]) holdingsByPortfolio[h.portfolio_id] = []
    holdingsByPortfolio[h.portfolio_id].push(h)
  }

  // 6. Compute per-portfolio window return
  const portfolioPerf = allPortfolios.map(p => {
    const cash = Number(p.cash_balance || 0)
    const pHoldings = holdingsByPortfolio[p.id] || []
    let invested = 0
    for (const h of pHoldings) {
      const price = priceMap[h.ticker] || Number(h.avg_cost || 0)
      invested += Number(h.shares || 0) * price
    }
    const currentValue = invested + cash

    // Window start value
    const startSnap = pickStartSnapshot(snapshotsByPortfolio[p.id] || [], windowStartIso)
    const portfolioCreatedAt = p.created_at || ''
    let startValue
    if (startSnap) {
      startValue = Number(startSnap.total_value)
    } else if (portfolioCreatedAt && portfolioCreatedAt > windowStartIso) {
      // Portfolio younger than window — treat starting cash as the start.
      startValue = Number(p.fund_starting_cash || p.starting_cash || 100000)
    } else {
      // No snapshot but portfolio existed before window — fall back to starting cash.
      startValue = Number(p.fund_starting_cash || p.starting_cash || 100000)
    }

    const returnPct = startValue > 0 ? ((currentValue - startValue) / startValue) * 100 : 0
    return { ...p, currentValue, startValue, returnPct }
  })

  // 7. Aggregate per group (cost-weighted % across funds)
  const memberByUserId = new Map()
  for (const m of memberships) {
    if (m.user_id) memberByUserId.set(m.user_id, m.profiles?.full_name || 'Student')
  }

  const groupResults = groups.map(g => {
    const gPorts = portfolioPerf.filter(p => p.owner_type === 'group' && p.owner_id === g.id)
    let startSum = 0, currentSum = 0
    for (const p of gPorts) { startSum += p.startValue; currentSum += p.currentValue }
    const returnPct = startSum > 0 ? ((currentSum - startSum) / startSum) * 100 : 0
    return {
      id: g.id,
      name: g.name,
      returnPct: round2(returnPct),
      fundCount: gPorts.length,
      memberIds: memberships.filter(m => m.group_id === g.id).map(m => m.user_id)
    }
  }).filter(g => g.fundCount > 0)
   .sort((a, b) => b.returnPct - a.returnPct)

  // 8. Per-individual aggregation (across their student portfolios)
  const individualResults = []
  for (const userId of studentIds) {
    const uPorts = portfolioPerf.filter(p => p.owner_type === 'user' && p.owner_id === userId)
    if (!uPorts.length) continue
    let startSum = 0, currentSum = 0
    for (const p of uPorts) { startSum += p.startValue; currentSum += p.currentValue }
    if (startSum <= 0) continue
    const returnPct = ((currentSum - startSum) / startSum) * 100
    individualResults.push({
      id: userId,
      name: memberByUserId.get(userId) || 'Student',
      returnPct: round2(returnPct)
    })
  }
  individualResults.sort((a, b) => b.returnPct - a.returnPct)

  // 9. Funds = group portfolios as standalone entries.
  const groupNameById = new Map(groups.map(g => [g.id, g.name]))
  const fundResults = portfolioPerf
    .filter(p => p.owner_type === 'group')
    .map(p => ({
      id: p.id,
      fundName: p.fund_name || `Fund ${p.fund_number || 1}`,
      groupName: groupNameById.get(p.owner_id) || '',
      returnPct: round2(p.returnPct)
    }))
    .sort((a, b) => b.returnPct - a.returnPct)

  return {
    groups: groupResults,
    individuals: individualResults,
    funds: fundResults,
    spyReturnPct: round2(spyReturnPct),
    windowStart: windowStartIso,
    windowEnd
  }
}

function round2(n) { return Math.round(n * 100) / 100 }
