import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'
import { useMarketDataStore } from './marketData'

export const usePortfolioStore = defineStore('portfolio', () => {
  const auth = useAuthStore()
  const STARTING_CASH = 100000

  const portfolio = ref(null)         // current portfolio row
  const holdings = ref([])            // enriched holdings with live prices
  const rawHoldings = ref([])         // raw holdings from DB
  const benchmarkHoldings = ref([])   // benchmark SPY holdings
  const trades = ref([])              // trade history
  const benchmarkTrades = ref([])     // benchmark trade history
  const snapshots = ref([])           // portfolio snapshots (reset/close history)
  const loading = ref(false)
  const version = ref(0)

  const cashBalance = computed(() => portfolio.value?.cash_balance || 0)
  const startingCash = computed(() => portfolio.value?.starting_cash || STARTING_CASH)

  const totalMarketValue = computed(() => {
    const holdingsValue = holdings.value.reduce((sum, h) => sum + h.marketValue, 0)
    return holdingsValue + cashBalance.value
  })

  const totalReturnDollar = computed(() => totalMarketValue.value - startingCash.value)
  const totalReturnPct = computed(() => {
    if (startingCash.value === 0) return 0
    return (totalReturnDollar.value / startingCash.value) * 100
  })

  // Benchmark value
  const benchmarkCash = computed(() => {
    if (!portfolio.value) return 0
    const totalBenchmarkInvested = benchmarkTrades.value
      .reduce((sum, t) => sum + (t.side === 'buy' ? t.dollars : -t.dollars), 0)
    return startingCash.value - totalBenchmarkInvested
  })

  const benchmarkMarketValue = computed(() => {
    const market = useMarketDataStore()
    const bmTicker = benchmarkTicker.value
    const bmPrice = market.getCachedPrice(bmTicker)
    if (!bmPrice) return startingCash.value
    const holdingsValue = benchmarkHoldings.value
      .reduce((sum, h) => sum + (h.shares * bmPrice), 0)
    return holdingsValue + benchmarkCash.value
  })

  const benchmarkReturnPct = computed(() => {
    if (startingCash.value === 0) return 0
    return ((benchmarkMarketValue.value - startingCash.value) / startingCash.value) * 100
  })

  const isBeatingSP500 = computed(() => totalReturnPct.value > benchmarkReturnPct.value)

  // Load portfolio for a given owner (groupId or userId)
  async function loadPortfolio(ownerType, ownerId) {
    if (!ownerId) return
    loading.value = true
    try {
      // Fetch active portfolio (skip closed ones)
      const { data: pData } = await supabase
        .from('portfolios')
        .select('*')
        .eq('owner_type', ownerType)
        .eq('owner_id', ownerId)
        .or('status.eq.active,status.is.null')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      portfolio.value = pData

      if (pData) {
        // Fetch holdings
        const { data: hData } = await supabase
          .from('holdings')
          .select('*')
          .eq('portfolio_id', pData.id)
        rawHoldings.value = hData || []

        // Fetch benchmark holdings
        const { data: bhData } = await supabase
          .from('benchmark_holdings')
          .select('*')
          .eq('portfolio_id', pData.id)
        benchmarkHoldings.value = bhData || []

        // Fetch trades
        const { data: tData } = await supabase
          .from('trades')
          .select('*')
          .eq('portfolio_id', pData.id)
          .order('executed_at', { ascending: false })
        trades.value = tData || []

        // Fetch benchmark trades
        const { data: btData } = await supabase
          .from('benchmark_trades')
          .select('*')
          .eq('portfolio_id', pData.id)
          .order('executed_at', { ascending: false })
        benchmarkTrades.value = btData || []

        // Fetch live prices for all holdings
        await enrichHoldings()
      } else {
        rawHoldings.value = []
        benchmarkHoldings.value = []
        trades.value = []
        benchmarkTrades.value = []
        holdings.value = []
      }
    } finally {
      loading.value = false
    }
  }

  async function enrichHoldings() {
    const market = useMarketDataStore()
    const bmTicker = benchmarkTicker.value
    const tickers = rawHoldings.value.map(h => h.ticker)
    if (tickers.length > 0) {
      await market.fetchBatchQuotes([...tickers, bmTicker])
    } else {
      await market.fetchBatchQuotes([bmTicker])
    }

    holdings.value = rawHoldings.value.map(h => {
      const currentPrice = market.getCachedPrice(h.ticker) || h.avg_cost
      const marketValue = h.shares * currentPrice
      const costBasis = h.shares * h.avg_cost
      const gainLoss = marketValue - costBasis
      const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0
      return {
        ...h,
        currentPrice,
        marketValue,
        costBasis,
        gainLoss,
        gainLossPct
      }
    })
  }

  function getFrequencyWindowStart(frequency) {
    const now = new Date()
    if (frequency === 'once_per_day') {
      now.setHours(0, 0, 0, 0)
    } else if (frequency === 'once_per_week') {
      now.setDate(now.getDate() - 7)
    } else if (frequency === 'once_per_month') {
      now.setMonth(now.getMonth() - 1)
    } else {
      return null
    }
    return now.toISOString()
  }

  const frequencyLabels = {
    once_per_day: 'once per day',
    once_per_week: 'once per week',
    once_per_month: 'once per month'
  }

  async function checkTradeFrequency(ticker, portfolioId, restrictions) {
    const freq = restrictions?.tradeFrequency
    if (!freq || freq === 'unlimited') return null
    const windowStart = getFrequencyWindowStart(freq)
    if (!windowStart) return null

    const { data } = await supabase
      .from('trades')
      .select('id')
      .eq('portfolio_id', portfolioId)
      .eq('ticker', ticker)
      .gte('executed_at', windowStart)
      .limit(1)

    if (data && data.length > 0) {
      return `You can only trade ${ticker} ${frequencyLabels[freq]}. Please wait before trading this stock again.`
    }
    return null
  }

  async function buyStock(ticker, dollars, approvalCode, rationale) {
    if (!auth.currentUser) return { success: false, error: 'Not logged in' }
    if (!portfolio.value) return { success: false, error: 'Portfolio not found' }
    if (dollars <= 0) return { success: false, error: 'Amount must be positive' }
    if (dollars > cashBalance.value) return { success: false, error: 'Insufficient cash' }

    const market = useMarketDataStore()

    // Fetch price (uses last close on weekends/after-hours)
    const quote = await market.fetchQuote(ticker)
    if (!quote) return { success: false, error: 'Could not fetch stock price' }
    const price = quote.price || quote.previousClose
    if (!price || price <= 0) return { success: false, error: 'Could not determine a valid price for ' + ticker }

    // Fetch benchmark price
    const bmTicker = benchmarkTicker.value
    const bmQuote = await market.fetchQuote(bmTicker)
    const bmPrice = bmQuote?.price || bmQuote?.previousClose

    const shares = dollars / price
    const portfolioId = portfolio.value.id

    // Check approval code and restrictions
    if (approvalCode !== undefined) {
      // Validate against class
      const membership = await auth.getCurrentMembership()
      if (membership?.class) {
        const cls = membership.class
        if (cls.approval_code && cls.approval_code !== approvalCode) {
          return { success: false, error: 'Invalid approval code' }
        }
        // Check trade frequency restriction
        const freqError = await checkTradeFrequency(ticker, portfolioId, cls.restrictions)
        if (freqError) return { success: false, error: freqError }
        // Check rationale requirement (default: required)
        const requireRationale = cls.restrictions?.requireRationale !== false
        if (requireRationale && (!rationale || !rationale.trim())) {
          return { success: false, error: 'Please explain your reasoning before trading' }
        }
      }
    }

    // Insert trade
    const { error: tradeError } = await supabase.from('trades').insert({
      portfolio_id: portfolioId,
      user_id: auth.currentUser.id,
      ticker, side: 'buy', dollars, shares, price,
      rationale: rationale?.trim() || null
    })
    if (tradeError) return { success: false, error: tradeError.message }

    // Upsert holding
    const existing = rawHoldings.value.find(h => h.ticker === ticker)
    if (existing) {
      const totalCost = (existing.shares * existing.avg_cost) + dollars
      const newShares = existing.shares + shares
      const newAvgCost = totalCost / newShares
      await supabase.from('holdings')
        .update({ shares: newShares, avg_cost: newAvgCost })
        .eq('id', existing.id)
    } else {
      await supabase.from('holdings').insert({
        portfolio_id: portfolioId,
        ticker, shares, avg_cost: price
      })
    }

    // Update cash balance
    await supabase.from('portfolios')
      .update({ cash_balance: cashBalance.value - dollars })
      .eq('id', portfolioId)

    // Benchmark: buy same dollars of benchmark index
    if (bmPrice) {
      const bmShares = dollars / bmPrice
      await supabase.from('benchmark_trades').insert({
        portfolio_id: portfolioId,
        ticker: bmTicker, side: 'buy', dollars, shares: bmShares, price: bmPrice
      })

      const existingBench = benchmarkHoldings.value.find(h => h.ticker === bmTicker)
      if (existingBench) {
        const totalCost = (existingBench.shares * existingBench.avg_cost) + dollars
        const newShares = existingBench.shares + bmShares
        await supabase.from('benchmark_holdings')
          .update({ shares: newShares, avg_cost: totalCost / newShares })
          .eq('id', existingBench.id)
      } else {
        await supabase.from('benchmark_holdings').insert({
          portfolio_id: portfolioId,
          ticker: bmTicker, shares: bmShares, avg_cost: bmPrice
        })
      }
    }

    // Reload portfolio data
    await loadPortfolio(portfolio.value.owner_type, portfolio.value.owner_id)
    version.value++

    return { success: true, shares, price }
  }

  async function sellStock(ticker, dollars, approvalCode, rationale) {
    if (!auth.currentUser) return { success: false, error: 'Not logged in' }
    if (!portfolio.value) return { success: false, error: 'Portfolio not found' }
    if (dollars <= 0) return { success: false, error: 'Amount must be positive' }

    const market = useMarketDataStore()

    // Fetch price (uses last close on weekends/after-hours)
    const quote = await market.fetchQuote(ticker)
    if (!quote) return { success: false, error: 'Could not fetch stock price' }
    const price = quote.price || quote.previousClose
    if (!price || price <= 0) return { success: false, error: 'Could not determine a valid price for ' + ticker }

    const bmTicker = benchmarkTicker.value
    const bmQuote = await market.fetchQuote(bmTicker)
    const bmPrice = bmQuote?.price || bmQuote?.previousClose

    const existing = rawHoldings.value.find(h => h.ticker === ticker)
    if (!existing) return { success: false, error: "You don't own this stock" }

    const sharesToSell = dollars / price
    if (sharesToSell > existing.shares + 0.0001) return { success: false, error: 'Not enough shares' }

    // Check approval code and restrictions
    if (approvalCode !== undefined) {
      const membership = await auth.getCurrentMembership()
      if (membership?.class) {
        const cls = membership.class
        if (cls.approval_code && cls.approval_code !== approvalCode) {
          return { success: false, error: 'Invalid approval code' }
        }
        // Check trade frequency restriction
        const freqError = await checkTradeFrequency(ticker, portfolio.value.id, cls.restrictions)
        if (freqError) return { success: false, error: freqError }
        // Check rationale requirement (default: required)
        const requireRationale = cls.restrictions?.requireRationale !== false
        if (requireRationale && (!rationale || !rationale.trim())) {
          return { success: false, error: 'Please explain your reasoning before trading' }
        }
      }
    }

    const portfolioId = portfolio.value.id

    // Insert trade
    await supabase.from('trades').insert({
      portfolio_id: portfolioId,
      user_id: auth.currentUser.id,
      ticker, side: 'sell', dollars, shares: sharesToSell, price,
      rationale: rationale?.trim() || null
    })

    // Update or remove holding
    const newShares = existing.shares - sharesToSell
    if (newShares < 0.001) {
      await supabase.from('holdings').delete().eq('id', existing.id)
    } else {
      await supabase.from('holdings')
        .update({ shares: newShares })
        .eq('id', existing.id)
    }

    // Update cash
    await supabase.from('portfolios')
      .update({ cash_balance: cashBalance.value + dollars })
      .eq('id', portfolioId)

    // Benchmark: sell proportional benchmark index
    if (bmPrice) {
      const existingBench = benchmarkHoldings.value.find(h => h.ticker === bmTicker)
      if (existingBench && existingBench.shares > 0) {
        const bmShares = dollars / bmPrice
        const actualBmShares = Math.min(bmShares, existingBench.shares)
        const actualDollars = actualBmShares * bmPrice

        await supabase.from('benchmark_trades').insert({
          portfolio_id: portfolioId,
          ticker: bmTicker, side: 'sell', dollars: actualDollars, shares: actualBmShares, price: bmPrice
        })

        const newBenchShares = existingBench.shares - actualBmShares
        if (newBenchShares < 0.001) {
          await supabase.from('benchmark_holdings').delete().eq('id', existingBench.id)
        } else {
          await supabase.from('benchmark_holdings')
            .update({ shares: newBenchShares })
            .eq('id', existingBench.id)
        }
      }
    }

    await loadPortfolio(portfolio.value.owner_type, portfolio.value.owner_id)
    version.value++

    return { success: true, shares: sharesToSell, price }
  }

  // Benchmark ticker for this portfolio (default SPY)
  const benchmarkTicker = computed(() => portfolio.value?.benchmark_ticker || 'SPY')

  // Change benchmark index
  async function changeBenchmark(newTicker) {
    if (!portfolio.value) return { error: 'No portfolio' }
    const { error } = await supabase
      .from('portfolios')
      .update({ benchmark_ticker: newTicker })
      .eq('id', portfolio.value.id)
    if (error) return { error: error.message }
    portfolio.value.benchmark_ticker = newTicker
    return { success: true }
  }

  // Toggle portfolio visibility
  async function setPublic(isPublic) {
    if (!portfolio.value) return { error: 'No portfolio' }
    const { error } = await supabase
      .from('portfolios')
      .update({ is_public: isPublic })
      .eq('id', portfolio.value.id)
    if (error) return { error: error.message }
    portfolio.value.is_public = isPublic
    return { success: true }
  }

  // Update portfolio name/description
  async function updatePortfolioMeta(name, description) {
    if (!portfolio.value) return { error: 'No portfolio' }
    const { error } = await supabase
      .from('portfolios')
      .update({ name, description })
      .eq('id', portfolio.value.id)
    if (error) return { error: error.message }
    portfolio.value.name = name
    portfolio.value.description = description
    return { success: true }
  }

  // Reset portfolio: snapshot current state, clear holdings, restore cash
  async function resetPortfolio() {
    if (!portfolio.value) return { error: 'No portfolio' }
    const isEmpty = Number(portfolio.value.cash_balance) === 0 && rawHoldings.value.length === 0
    if (portfolio.value.owner_type !== 'user' && !portfolio.value.allow_reset && !isEmpty) {
      return { error: 'Portfolio reset is not allowed' }
    }

    const portfolioId = portfolio.value.id

    // Snapshot current state
    const holdingsSnapshot = holdings.value.map(h => ({
      ticker: h.ticker, shares: Number(h.shares), avg_cost: Number(h.avg_cost),
      currentPrice: h.currentPrice, marketValue: h.marketValue
    }))
    const { error: snapError } = await supabase.from('portfolio_snapshots').insert({
      portfolio_id: portfolioId,
      snapshot_type: 'reset',
      cash_balance: cashBalance.value,
      starting_cash: startingCash.value,
      total_value: totalMarketValue.value,
      return_pct: totalReturnPct.value,
      holdings: holdingsSnapshot
    })
    if (snapError) return { error: snapError.message }

    // Delete all holdings
    await supabase.from('holdings').delete().eq('portfolio_id', portfolioId)
    await supabase.from('benchmark_holdings').delete().eq('portfolio_id', portfolioId)

    // Reset cash and increment reset_count
    const newResetCount = (portfolio.value.reset_count || 0) + 1
    await supabase.from('portfolios').update({
      cash_balance: STARTING_CASH,
      reset_count: newResetCount
    }).eq('id', portfolioId)

    // Reload
    await loadPortfolio(portfolio.value.owner_type, portfolio.value.owner_id)
    version.value++
    return { success: true }
  }

  // Close portfolio: snapshot, close it, create a new active one
  async function closePortfolio() {
    if (!portfolio.value) return { error: 'No portfolio' }
    if (portfolio.value.owner_type !== 'user') return { error: 'Can only close personal portfolios' }

    const portfolioId = portfolio.value.id

    // Snapshot current state
    const holdingsSnapshot = holdings.value.map(h => ({
      ticker: h.ticker, shares: Number(h.shares), avg_cost: Number(h.avg_cost),
      currentPrice: h.currentPrice, marketValue: h.marketValue
    }))
    const { error: snapError } = await supabase.from('portfolio_snapshots').insert({
      portfolio_id: portfolioId,
      snapshot_type: 'close',
      cash_balance: cashBalance.value,
      starting_cash: startingCash.value,
      total_value: totalMarketValue.value,
      return_pct: totalReturnPct.value,
      holdings: holdingsSnapshot
    })
    if (snapError) return { error: snapError.message }

    // Delete holdings
    await supabase.from('holdings').delete().eq('portfolio_id', portfolioId)
    await supabase.from('benchmark_holdings').delete().eq('portfolio_id', portfolioId)

    // Mark as closed
    await supabase.from('portfolios').update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      cash_balance: 0
    }).eq('id', portfolioId)

    // Create a new active portfolio
    const { data: newPortfolio, error: createError } = await supabase
      .from('portfolios')
      .insert({
        owner_type: 'user',
        owner_id: auth.currentUser.id,
        name: 'My Portfolio',
        starting_cash: STARTING_CASH,
        cash_balance: STARTING_CASH,
        allow_reset: true,
        is_public: true
      })
      .select()
      .single()
    if (createError) return { error: createError.message }

    // Load the new portfolio
    await loadPortfolio('user', auth.currentUser.id)
    version.value++
    return { success: true, newPortfolioId: newPortfolio.id }
  }

  // Load snapshots for a portfolio
  async function loadSnapshots(portfolioId) {
    const pid = portfolioId || portfolio.value?.id
    if (!pid) return []
    const { data } = await supabase
      .from('portfolio_snapshots')
      .select('*')
      .eq('portfolio_id', pid)
      .order('snapshotted_at', { ascending: false })
    snapshots.value = data || []
    return data || []
  }

  async function createPersonalPortfolio() {
    if (!auth.currentUser) return { error: 'Not logged in' }
    const { data, error } = await supabase
      .from('portfolios')
      .insert({
        owner_type: 'user',
        owner_id: auth.currentUser.id,
        name: 'My Portfolio',
        cash_balance: STARTING_CASH,
        starting_cash: STARTING_CASH,
        is_public: true,
        allow_reset: true
      })
      .select()
      .single()
    if (error) return { error: error.message }
    portfolio.value = data
    return { success: true, portfolio: data }
  }

  function getHolding(ticker) {
    return holdings.value.find(h => h.ticker === ticker) || null
  }

  // For leaderboard/teacher views: get portfolio value for a given portfolioId
  async function getPortfolioValueById(portfolioId) {
    const { data: hData } = await supabase
      .from('holdings')
      .select('*')
      .eq('portfolio_id', portfolioId)

    const { data: pData } = await supabase
      .from('portfolios')
      .select('cash_balance, starting_cash')
      .eq('id', portfolioId)
      .single()

    if (!pData) return { value: STARTING_CASH, returnPct: 0, cash: STARTING_CASH }

    const market = useMarketDataStore()
    const tickers = (hData || []).map(h => h.ticker)
    if (tickers.length > 0) {
      await market.fetchBatchQuotes(tickers)
    }

    const holdingsValue = (hData || []).reduce((sum, h) => {
      const price = market.getCachedPrice(h.ticker) || h.avg_cost
      return sum + (h.shares * price)
    }, 0)

    const totalValue = holdingsValue + pData.cash_balance
    const returnPct = ((totalValue - pData.starting_cash) / pData.starting_cash) * 100

    return { value: totalValue, returnPct, cash: pData.cash_balance, holdings: hData }
  }

  // Bulk fetch leaderboard data for a set of group IDs.
  // Returns { portfolios, holdingsMap, tradesMap } in 3 queries instead of N+1.
  async function getLeaderboardData(groupIds) {
    if (!groupIds.length) return { portfolios: [], holdingsMap: {}, tradesMap: {} }

    // 1. All portfolios for these groups
    const { data: portfolios } = await supabase
      .from('portfolios')
      .select('*')
      .eq('owner_type', 'group')
      .in('owner_id', groupIds)

    const pIds = (portfolios || []).map(p => p.id)
    if (!pIds.length) return { portfolios: [], holdingsMap: {}, tradesMap: {} }

    // 2. All holdings for these portfolios
    const { data: allHoldings } = await supabase
      .from('holdings')
      .select('*')
      .in('portfolio_id', pIds)

    // 3. All trades for these portfolios (ordered newest first)
    const { data: allTrades } = await supabase
      .from('trades')
      .select('*')
      .in('portfolio_id', pIds)
      .order('executed_at', { ascending: false })

    // Build maps keyed by portfolio_id
    const holdingsMap = {}
    const tradesMap = {}
    for (const pid of pIds) {
      holdingsMap[pid] = []
      tradesMap[pid] = []
    }
    for (const h of (allHoldings || [])) {
      holdingsMap[h.portfolio_id]?.push(h)
    }
    for (const t of (allTrades || [])) {
      tradesMap[t.portfolio_id]?.push(t)
    }

    return { portfolios: portfolios || [], holdingsMap, tradesMap }
  }

  // Bulk fetch for public leaderboard (portfolio IDs already known)
  async function getPublicLeaderboardData(portfolioIds) {
    if (!portfolioIds.length) return { holdingsMap: {}, tradesMap: {} }

    const { data: allHoldings } = await supabase
      .from('holdings')
      .select('*')
      .in('portfolio_id', portfolioIds)

    const { data: allTrades } = await supabase
      .from('trades')
      .select('*')
      .in('portfolio_id', portfolioIds)
      .order('executed_at', { ascending: false })

    const holdingsMap = {}
    const tradesMap = {}
    for (const pid of portfolioIds) {
      holdingsMap[pid] = []
      tradesMap[pid] = []
    }
    for (const h of (allHoldings || [])) {
      holdingsMap[h.portfolio_id]?.push(h)
    }
    for (const t of (allTrades || [])) {
      tradesMap[t.portfolio_id]?.push(t)
    }

    return { holdingsMap, tradesMap }
  }

  return {
    portfolio, holdings, rawHoldings, benchmarkHoldings,
    trades, benchmarkTrades, loading, version,
    cashBalance, startingCash, totalMarketValue,
    totalReturnDollar, totalReturnPct,
    benchmarkMarketValue, benchmarkReturnPct, isBeatingSP500,
    benchmarkTicker, STARTING_CASH,
    loadPortfolio, enrichHoldings, buyStock, sellStock,
    getHolding, getPortfolioValueById,
    changeBenchmark, setPublic, updatePortfolioMeta,
    resetPortfolio, closePortfolio, loadSnapshots, snapshots, createPersonalPortfolio,
    getLeaderboardData, getPublicLeaderboardData
  }
})
