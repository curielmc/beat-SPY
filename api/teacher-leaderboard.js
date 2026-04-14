export const config = { runtime: 'edge' }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, FMP_KEY, sbFetch, jsonResponse } from './_lib/supabase.js'

const FMP_BASE = 'https://financialmodelingprep.com/api/v3'

async function fmpBatchQuotes(tickers) {
  if (!tickers.length || !FMP_KEY) return {}
  const csv = tickers.join(',')
  const res = await fetch(`${FMP_BASE}/quote/${csv}?apikey=${FMP_KEY}`)
  if (!res.ok) return {}
  const data = await res.json()
  const map = {}
  for (const q of (data || [])) {
    if (q.symbol && q.price) map[q.symbol] = q.price
  }
  return map
}

async function fmpHistoricalClose(ticker, date) {
  if (!ticker || !date || !FMP_KEY) return null
  const res = await fetch(`${FMP_BASE}/historical-price-full/${ticker}?from=${date}&to=${date}&apikey=${FMP_KEY}`)
  if (!res.ok) return null
  const data = await res.json()
  return data?.historical?.[0]?.close || null
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  const token = authHeader.replace('Bearer ', '')
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_SERVICE_KEY
    }
  })
  if (!userRes.ok) return jsonResponse({ error: 'Unauthorized' }, 401)

  const user = await userRes.json()
  const profile = await sbFetch(`/profiles?id=eq.${user.id}&select=role`)
  const role = profile?.[0]?.role
  if (role !== 'teacher' && role !== 'admin') {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }

  const { class_id } = await req.json().catch(() => ({}))
  if (!class_id) return jsonResponse({ error: 'class_id required' }, 400)

  try {
    // 1. Get all groups in this class
    const groups = await sbFetch(`/groups?class_id=eq.${class_id}&select=id,name`)

    if (!groups?.length) return jsonResponse({ groups: [] })

    const groupIds = groups.map(g => g.id)
    const groupIdFilter = groupIds.map(id => encodeURIComponent(id)).join(',')

    // 1b. Get members
    const memberships = await sbFetch(
      `/class_memberships?class_id=eq.${class_id}&select=user_id,group_id,profiles:profiles(full_name)`
    )

    // 2. Get all group portfolios
    const groupPortfolios = await sbFetch(
      `/portfolios?owner_type=eq.group&owner_id=in.(${groupIdFilter})&status=eq.active&select=id,owner_id,cash_balance,starting_cash,fund_starting_cash,fund_name,fund_number,benchmark_ticker,created_at`
    )

    // 2b. Get all student (user) portfolios for students in this class
    const studentIds = (memberships || []).map(m => m.user_id)
    const studentIdFilter = studentIds.map(id => encodeURIComponent(id)).join(',')
    const studentPortfolios = studentIds.length ? await sbFetch(
      `/portfolios?owner_type=eq.user&owner_id=in.(${studentIdFilter})&status=eq.active&select=id,owner_id,cash_balance,starting_cash,fund_starting_cash,fund_name,fund_number,benchmark_ticker,created_at`
    ) : []

    const allPortfolios = [...(groupPortfolios || []), ...(studentPortfolios || [])]

    if (!allPortfolios.length) {
      // No portfolios — return groups with zero values
      const membersByGroup = {}
      for (const m of (memberships || [])) {
        if (!m.group_id) continue
        if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = []
        membersByGroup[m.group_id].push(m.profiles?.full_name || 'Student')
      }
      return jsonResponse({
        groups: groups.map(g => ({
          id: g.id,
          name: g.name,
          members: membersByGroup[g.id] || [],
          totalValue: 0,
          startingCash: 0,
          returnPct: 0,
          cash: 0,
          fundCount: 0
        })),
        stats: { pctStudentsBeating: 0, pctGroupsBeating: 0, pctFundsBeating: 0, maxAlpha: 0, minAlpha: 0, avgAlpha: 0 }
      })
    }

    const portfolioIds = allPortfolios.map(p => p.id)
    const portfolioIdFilter = portfolioIds.map(id => encodeURIComponent(id)).join(',')

    // 4. Get all holdings
    const holdings = await sbFetch(
      `/holdings?portfolio_id=in.(${portfolioIdFilter})&select=portfolio_id,ticker,shares,avg_cost`
    )

    // 5. Fetch current market prices for all tickers (include SPY for benchmark)
    const allTickers = [...new Set([
      ...(holdings || []).map(h => h.ticker).filter(Boolean),
      'SPY'
    ])]
    const priceMap = await fmpBatchQuotes(allTickers)

    // 5b. Fetch historical benchmark prices for each portfolio's start date
    const benchmarkDates = new Map() // "TICKER:DATE" -> price
    const benchmarkFetches = []
    for (const p of allPortfolios) {
      const bt = p.benchmark_ticker || 'SPY'
      const date = (p.created_at || '').split('T')[0]
      if (!date) continue
      const key = `${bt}:${date}`
      if (!benchmarkDates.has(key)) {
        benchmarkDates.set(key, null)
        benchmarkFetches.push(
          fmpHistoricalClose(bt, date).then(price => { benchmarkDates.set(key, price) })
        )
      }
    }
    await Promise.all(benchmarkFetches)

    // 6. Build per-group aggregation
    const membersByGroup = {}
    for (const m of (memberships || [])) {
      if (!m.group_id) continue
      if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = []
      membersByGroup[m.group_id].push(m.profiles?.full_name || 'Student')
    }

    // Map holdings by portfolio_id
    const holdingsByPortfolio = {}
    for (const h of (holdings || [])) {
      if (!holdingsByPortfolio[h.portfolio_id]) holdingsByPortfolio[h.portfolio_id] = []
      holdingsByPortfolio[h.portfolio_id].push(h)
    }

    // Process all portfolios to get performance
    const portfolioPerformance = allPortfolios.map(p => {
      const cash = Number(p.cash_balance || 0)
      const startingCash = Number(p.fund_starting_cash || p.starting_cash || 100000)
      const pHoldings = holdingsByPortfolio[p.id] || []

      let investedValue = 0
      for (const h of pHoldings) {
        const price = priceMap[h.ticker] || Number(h.avg_cost || 0)
        investedValue += Number(h.shares || 0) * price
      }

      const totalValue = investedValue + cash
      const returnPct = startingCash > 0 ? ((totalValue - startingCash) / startingCash) * 100 : 0

      // Benchmark comparison
      const bt = p.benchmark_ticker || 'SPY'
      const date = (p.created_at || '').split('T')[0]
      const currentBenchmarkPrice = priceMap[bt] || priceMap['SPY']
      const startBenchmarkPrice = benchmarkDates.get(`${bt}:${date}`)
      let benchmarkReturnPct = 0
      if (currentBenchmarkPrice && startBenchmarkPrice) {
        benchmarkReturnPct = ((currentBenchmarkPrice - startBenchmarkPrice) / startBenchmarkPrice) * 100
      }

      const alpha = returnPct - benchmarkReturnPct

      return {
        ...p,
        totalValue,
        startingCash,
        returnPct,
        benchmarkReturnPct,
        alpha,
        isBeatingSP500: returnPct > benchmarkReturnPct,
        cash
      }
    })

    // Aggregate per group
    const groupResults = groups.map(group => {
      const groupPortfolios = portfolioPerformance.filter(p => p.owner_id === group.id && p.owner_type === 'group')
      let totalValue = 0
      let totalStartingCash = 0
      let totalCash = 0
      let aggregateBenchmarkValue = 0

      const funds = groupPortfolios.map(p => {
        totalValue += p.totalValue
        totalStartingCash += p.starting_cash
        totalCash += p.cash
        aggregateBenchmarkValue += p.starting_cash * (1 + p.benchmarkReturnPct / 100)

        return {
          id: p.id,
          fundName: p.fund_name || `Fund ${p.fund_number || 1}`,
          fundNumber: p.fund_number || 1,
          returnPct: Math.round(p.returnPct * 100) / 100,
          benchmarkReturnPct: Math.round(p.benchmarkReturnPct * 100) / 100,
          isBeatingSP500: p.isBeatingSP500,
          alpha: Math.round(p.alpha * 100) / 100,
          totalValue: Math.round(p.totalValue * 100) / 100,
          startingCash: Math.round(p.starting_cash * 100) / 100,
          holdings: holdingsByPortfolio[p.id] || [], // Include for attribution
          cash_balance: p.cash
        }
      }).sort((a, b) => (a.fundNumber || 1) - (b.fundNumber || 1))

      const returnPct = totalStartingCash > 0
        ? ((totalValue - totalStartingCash) / totalStartingCash) * 100
        : 0
      const groupBenchmarkReturnPct = totalStartingCash > 0
        ? ((aggregateBenchmarkValue - totalStartingCash) / totalStartingCash) * 100
        : 0
      const alpha = returnPct - groupBenchmarkReturnPct

      return {
        id: group.id,
        name: group.name,
        members: membersByGroup[group.id] || [],
        totalValue: Math.round(totalValue * 100) / 100,
        startingCash: Math.round(totalStartingCash * 100) / 100,
        returnPct: Math.round(returnPct * 100) / 100,
        benchmarkReturnPct: Math.round(groupBenchmarkReturnPct * 100) / 100,
        isBeatingSP500: returnPct > groupBenchmarkReturnPct,
        alpha: Math.round(alpha * 100) / 100,
        cash: Math.round(totalCash * 100) / 100,
        fundCount: groupPortfolios.length,
        funds
      }
    })

    // Calculate Summary Stats
    const studentPerf = portfolioPerformance.filter(p => p.owner_type === 'user')
    const groupPerf = groupResults
    const fundPerf = portfolioPerformance.filter(p => p.owner_type === 'group')

    const stats = {
      pctStudentsBeating: studentPerf.length ? (studentPerf.filter(p => p.isBeatingSP500).length / studentPerf.length) * 100 : 0,
      pctGroupsBeating: groupPerf.length ? (groupPerf.filter(p => p.isBeatingSP500).length / groupPerf.length) * 100 : 0,
      pctFundsBeating: fundPerf.length ? (fundPerf.filter(p => p.isBeatingSP500).length / fundPerf.length) * 100 : 0,
      maxAlpha: portfolioPerformance.length ? Math.max(...portfolioPerformance.map(p => p.alpha)) : 0,
      minAlpha: portfolioPerformance.length ? Math.min(...portfolioPerformance.map(p => p.alpha)) : 0,
      avgAlpha: portfolioPerformance.length ? portfolioPerformance.reduce((sum, p) => sum + p.alpha, 0) / portfolioPerformance.length : 0
    }

    // Sort by return % descending
    groupResults.sort((a, b) => b.returnPct - a.returnPct)

    return jsonResponse({ groups: groupResults, stats })
  } catch (error) {
    console.error('Teacher leaderboard error:', error)
    return jsonResponse({ error: error.message || 'Failed to load leaderboard' }, 500)
  }
}
