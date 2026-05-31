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

// Fetch the close on `date`, or the most recent close before it. We query a
// 10-day window ending on `date` to handle weekends/holidays gracefully.
async function fmpHistoricalClose(ticker, date) {
  if (!ticker || !date || !FMP_KEY) return null
  const to = new Date(date)
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - 10)
  const fromStr = from.toISOString().split('T')[0]
  const toStr = to.toISOString().split('T')[0]
  const res = await fetch(`${FMP_BASE}/historical-price-full/${ticker}?from=${fromStr}&to=${toStr}&apikey=${FMP_KEY}`).catch(() => null)
  if (!res || !res.ok) return null
  const data = await res.json().catch(() => null)
  // FMP returns historical sorted desc (newest first). Pick the entry at-or-before `date`.
  const rows = data?.historical || []
  for (const row of rows) {
    if (row?.date && row.date <= toStr && row.close) return row.close
  }
  return null
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
  // Track tickers FMP failed to price — we fall back to avg_cost (0% move on that
  // lot), which silently distorts the return, so surface them to the caller.
  const missingPriceTickers = new Set()
  const portfolioPerf = allPortfolios.map(p => {
    const cash = Number(p.cash_balance || 0)
    const pHoldings = holdingsByPortfolio[p.id] || []
    let invested = 0
    let hasMissingPrice = false
    for (const h of pHoldings) {
      let price = priceMap[h.ticker]
      if (price == null) {
        // FMP returned no quote — fall back to cost basis (no move on this lot).
        if (h.ticker) missingPriceTickers.add(h.ticker)
        hasMissingPrice = true
        price = Number(h.avg_cost || 0)
      }
      invested += Number(h.shares || 0) * price
    }
    const currentValue = invested + cash

    // Window start value.
    //   - snapshot:  real daily snapshot at-or-before windowStart (trustworthy).
    //   - younger:   portfolio created after windowStart — starting cash is the
    //                true inception base, so an inception-to-now return is correct.
    //   - inception: portfolio predates windowStart but has NO snapshot. We fall
    //                back to starting cash, but this is inception-to-now, NOT a
    //                window return — it overstates/understates the real window
    //                move. Flag it so callers don't present it as a window figure.
    const startSnap = pickStartSnapshot(snapshotsByPortfolio[p.id] || [], windowStartIso)
    const portfolioCreatedAt = p.created_at || ''
    let startValue
    let startBasis
    if (startSnap) {
      startValue = Number(startSnap.total_value)
      startBasis = 'snapshot'
    } else if (portfolioCreatedAt && portfolioCreatedAt > windowStartIso) {
      startValue = Number(p.fund_starting_cash || p.starting_cash || 100000)
      startBasis = 'younger'
    } else {
      startValue = Number(p.fund_starting_cash || p.starting_cash || 100000)
      startBasis = 'inception'
    }

    let returnPct = startValue > 0 ? ((currentValue - startValue) / startValue) * 100 : 0
    if (!isFinite(returnPct)) returnPct = 0
    return { ...p, currentValue, startValue, returnPct, startBasis, hasMissingPrice }
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
    let returnPct = startSum > 0 ? ((currentSum - startSum) / startSum) * 100 : 0
    if (!isFinite(returnPct)) returnPct = 0
    return {
      id: g.id,
      name: g.name,
      returnPct: round2(returnPct),
      fundCount: gPorts.length,
      // True if any fund's window return is inception-based (no snapshot) — i.e.
      // not a real window measurement. Lets the newsletter footnote it.
      inceptionBased: gPorts.some(p => p.startBasis === 'inception'),
      hasMissingPrice: gPorts.some(p => p.hasMissingPrice),
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
    let returnPct = ((currentSum - startSum) / startSum) * 100
    if (!isFinite(returnPct)) returnPct = 0
    individualResults.push({
      id: userId,
      name: memberByUserId.get(userId) || 'Student',
      returnPct: round2(returnPct),
      inceptionBased: uPorts.some(p => p.startBasis === 'inception'),
      hasMissingPrice: uPorts.some(p => p.hasMissingPrice)
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
      returnPct: round2(p.returnPct),
      inceptionBased: p.startBasis === 'inception',
      hasMissingPrice: p.hasMissingPrice
    }))
    .sort((a, b) => b.returnPct - a.returnPct)

  return {
    groups: groupResults,
    individuals: individualResults,
    funds: fundResults,
    spyReturnPct: round2(spyReturnPct),
    // SPY is PRICE return only (no dividends) — see newsletter label/footnote.
    spyReturnBasis: 'price',
    // Tickers FMP could not price this run; their lots used cost basis (0% move).
    missingPriceTickers: [...missingPriceTickers],
    windowStart: windowStartIso,
    windowEnd
  }
}

function round2(n) { return Math.round(n * 100) / 100 }
