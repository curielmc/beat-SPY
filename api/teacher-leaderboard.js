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

    // 2. Get all group portfolios
    const portfolios = await sbFetch(
      `/portfolios?owner_type=eq.group&owner_id=in.(${groupIdFilter})&status=eq.active&select=id,owner_id,cash_balance,starting_cash,fund_starting_cash,fund_name,fund_number,benchmark_ticker,created_at`
    )

    // 3. Get members
    const memberships = await sbFetch(
      `/class_memberships?class_id=eq.${class_id}&select=user_id,group_id,profiles:profiles(full_name)`
    )

    if (!portfolios?.length) {
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
        }))
      })
    }

    const portfolioIds = portfolios.map(p => p.id)
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
    for (const p of portfolios) {
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

    // Aggregate per group
    const groupResults = groups.map(group => {
      const groupPortfolios = portfolios.filter(p => p.owner_id === group.id)
      let totalValue = 0
      let totalStartingCash = 0
      let totalCash = 0
      let aggregateBenchmarkValue = 0

      const funds = groupPortfolios.map(p => {
        const cash = Number(p.cash_balance || 0)
        const startingCash = Number(p.fund_starting_cash || p.starting_cash || 100000)
        const pHoldings = holdingsByPortfolio[p.id] || []

        let investedValue = 0
        for (const h of pHoldings) {
          const price = priceMap[h.ticker] || Number(h.avg_cost || 0)
          investedValue += Number(h.shares || 0) * price
        }

        const fundTotalValue = investedValue + cash
        const fundReturnPct = startingCash > 0
          ? ((fundTotalValue - startingCash) / startingCash) * 100
          : 0

        // Benchmark comparison
        const bt = p.benchmark_ticker || 'SPY'
        const date = (p.created_at || '').split('T')[0]
        const currentBenchmarkPrice = priceMap[bt] || priceMap['SPY']
        const startBenchmarkPrice = benchmarkDates.get(`${bt}:${date}`)
        let benchmarkReturnPct = 0
        if (currentBenchmarkPrice && startBenchmarkPrice) {
          benchmarkReturnPct = ((currentBenchmarkPrice - startBenchmarkPrice) / startBenchmarkPrice) * 100
        }

        totalValue += fundTotalValue
        totalStartingCash += startingCash
        totalCash += cash
        aggregateBenchmarkValue += startingCash * (1 + benchmarkReturnPct / 100)

        return {
          id: p.id,
          fundName: p.fund_name || `Fund ${p.fund_number || 1}`,
          fundNumber: p.fund_number || 1,
          returnPct: Math.round(fundReturnPct * 100) / 100,
          benchmarkReturnPct: Math.round(benchmarkReturnPct * 100) / 100,
          isBeatingSP500: fundReturnPct > benchmarkReturnPct,
          totalValue: Math.round(fundTotalValue * 100) / 100,
          startingCash: Math.round(startingCash * 100) / 100
        }
      }).sort((a, b) => (a.fundNumber || 1) - (b.fundNumber || 1))

      const returnPct = totalStartingCash > 0
        ? ((totalValue - totalStartingCash) / totalStartingCash) * 100
        : 0
      const groupBenchmarkReturnPct = totalStartingCash > 0
        ? ((aggregateBenchmarkValue - totalStartingCash) / totalStartingCash) * 100
        : 0

      return {
        id: group.id,
        name: group.name,
        members: membersByGroup[group.id] || [],
        totalValue: Math.round(totalValue * 100) / 100,
        startingCash: Math.round(totalStartingCash * 100) / 100,
        returnPct: Math.round(returnPct * 100) / 100,
        benchmarkReturnPct: Math.round(groupBenchmarkReturnPct * 100) / 100,
        isBeatingSP500: returnPct > groupBenchmarkReturnPct,
        cash: Math.round(totalCash * 100) / 100,
        fundCount: groupPortfolios.length,
        funds
      }
    })

    // Sort by return % descending
    groupResults.sort((a, b) => b.returnPct - a.returnPct)

    return jsonResponse({ groups: groupResults })
  } catch (error) {
    console.error('Teacher leaderboard error:', error)
    return jsonResponse({ error: error.message || 'Failed to load leaderboard' }, 500)
  }
}
