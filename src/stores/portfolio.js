import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'
import { getSP500Constituents } from '../services/fmpApi'
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
  const allFunds = ref([])            // all funds for current user
  const loading = ref(false)
  const version = ref(0)
  const MAX_FUNDS = 6

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

    let holdingsValue
    if (benchmarkHoldings.value.length > 0) {
      // Normal path: use benchmark_holdings rows
      holdingsValue = benchmarkHoldings.value.reduce((sum, h) => sum + (h.shares * bmPrice), 0)
    } else {
      // Fallback: compute from benchmark_trades (personal portfolios may lack benchmark_holdings rows)
      const totalShares = benchmarkTrades.value
        .filter(t => t.side === 'buy')
        .reduce((sum, t) => sum + Number(t.shares), 0)
      holdingsValue = totalShares * bmPrice
    }
    return holdingsValue + benchmarkCash.value
  })

  const benchmarkReturnPct = computed(() => {
    if (startingCash.value === 0) return 0
    return ((benchmarkMarketValue.value - startingCash.value) / startingCash.value) * 100
  })

  const isBeatingSP500 = computed(() => totalReturnPct.value > benchmarkReturnPct.value)

  // Load a specific portfolio by its ID
  async function loadPortfolioById(portfolioId) {
    if (!portfolioId) return
    loading.value = true
    try {
      const { data: pData } = await supabase
        .from('portfolios')
        .select('*')
        .eq('id', portfolioId)
        .single()

      portfolio.value = pData

      if (pData) {
        await _loadPortfolioData(pData)
      } else {
        _clearPortfolioData()
      }
    } finally {
      loading.value = false
    }
  }

  // Load portfolio for a given owner (groupId or userId)
// Stale-while-revalidate cache
  const _portfolioCache = {}
  const PORTFOLIO_TTL = 30 * 1000 // 30 seconds

  function _checkCacheClear() {
    if (typeof window !== 'undefined' && window.__clearPortfolioCache) {
      window.__clearPortfolioCache = false
      Object.keys(_portfolioCache).forEach(k => delete _portfolioCache[k])
    }
  }

  async function loadPortfolio(ownerType, ownerId) {
    if (!ownerId) return
    _checkCacheClear()
    const cacheKey = `${ownerType}:${ownerId}`
    const cached = _portfolioCache[cacheKey]
    const now = Date.now()

    // Serve from cache immediately (stale-while-revalidate)
    if (cached && (now - cached.ts) < PORTFOLIO_TTL) {
      return // data already in reactive state, still fresh
    }
    if (cached && portfolio.value?.id === cached.portfolioId) {
      // Stale but we have data — show it immediately, refresh in background
      _doLoadPortfolio(ownerType, ownerId, cacheKey)
      return
    }

    // No cache — must wait for fresh load
    loading.value = true
    await _doLoadPortfolio(ownerType, ownerId, cacheKey)
    loading.value = false
  }

  async function _doLoadPortfolio(ownerType, ownerId, cacheKey) {
    try {
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
        await _loadPortfolioData(pData)
        _portfolioCache[cacheKey] = { ts: Date.now(), portfolioId: pData.id }
      } else {
        _clearPortfolioData()
      }
    } catch (e) {
      console.warn('loadPortfolio error', e)
    }
  }

  async function _loadPortfolioData(pData) {
    const { data: hData } = await supabase
      .from('holdings')
      .select('*')
      .eq('portfolio_id', pData.id)
    rawHoldings.value = hData || []

    const { data: bhData } = await supabase
      .from('benchmark_holdings')
      .select('*')
      .eq('portfolio_id', pData.id)
    benchmarkHoldings.value = bhData || []

    const { data: tData } = await supabase
      .from('trades')
      .select('*')
      .eq('portfolio_id', pData.id)
      .order('executed_at', { ascending: false })
    trades.value = tData || []

    const { data: btData } = await supabase
      .from('benchmark_trades')
      .select('*')
      .eq('portfolio_id', pData.id)
      .order('executed_at', { ascending: false })
    benchmarkTrades.value = btData || []

    await enrichHoldings()
  }

  function _clearPortfolioData() {
    rawHoldings.value = []
    benchmarkHoldings.value = []
    trades.value = []
    benchmarkTrades.value = []
    holdings.value = []
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

    // Also fetch company names (non-blocking)
    if (tickers.length > 0) {
      try { await market.fetchBatchProfiles(tickers) } catch(e) { /* non-fatal */ }
    }

    holdings.value = rawHoldings.value.map(h => {
      const currentPrice = market.getCachedPrice(h.ticker) || h.avg_cost
      const marketValue = h.shares * currentPrice
      const costBasis = h.shares * h.avg_cost
      const gainLoss = marketValue - costBasis
      const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0
      const profile = market.profilesCache?.[h.ticker]?.data
      return {
        ...h,
        currentPrice,
        marketValue,
        costBasis,
        gainLoss,
        gainLossPct,
        companyName: profile?.companyName || profile?.name || null
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

    // ── Universe + Sector restrictions (group portfolios only — personal is always free) ──
    if (portfolio.value?.owner_type === 'group') {
      const membership = await auth.getCurrentMembership()
      const classRestrictions = membership?.class?.restrictions || {}
      // Use fund-specific restrictions if set, fall back to top-level
      const fundNum = String(portfolio.value?.fund_number || '1')
      const restrictions = classRestrictions.byFund?.[fundNum] || classRestrictions
      const universe = restrictions.universe || 'sp500'

      // Universe check
      if (universe !== 'any') {
        let allowed = []
        if (universe === 'sp500') {
          const data = await getSP500Constituents()
          allowed = (data || []).map(s => s.symbol?.toUpperCase())
        } else if (universe === 'dow30') {
          const fmpKey = import.meta.env.VITE_FMP_API_KEY
          const data = await fetch(`https://financialmodelingprep.com/api/v3/dowjones_constituent?apikey=${fmpKey}`).then(r => r.json()).catch(() => [])
          allowed = (data || []).map(s => s.symbol?.toUpperCase())
        } else if (universe === 'nasdaq100') {
          const fmpKey = import.meta.env.VITE_FMP_API_KEY
          const data = await fetch(`https://financialmodelingprep.com/api/v3/nasdaq_constituent?apikey=${fmpKey}`).then(r => r.json()).catch(() => [])
          allowed = (data || []).map(s => s.symbol?.toUpperCase())
        }
        const allowedSet = new Set(allowed)
        if (allowedSet.size > 0 && !allowedSet.has(ticker.toUpperCase())) {
          const label = universe === 'sp500' ? 'S&P 500' : universe === 'dow30' ? 'Dow Jones 30' : 'NASDAQ 100'
          return { success: false, error: `${ticker} is not in the ${label}. Your class is restricted to ${label} stocks only.` }
        }
      }

      // Sector checks (max stocks per sector, max sector %)
      if (restrictions.maxStocksPerSector || restrictions.maxSectorPct) {
        // Get sector for this ticker
        const profiles = await getBatchProfiles([ticker])
        const tickerSector = profiles?.[0]?.sector || 'Unknown'

        // Get current holdings sectors
        const allTickers = rawHoldings.value.map(h => h.ticker)
        const holdingProfiles = allTickers.length ? await getBatchProfiles(allTickers) : []
        const sectorMap = {}
        for (const p of holdingProfiles) sectorMap[p.symbol] = p.sector || 'Unknown'

        // Count stocks in this sector
        if (restrictions.maxStocksPerSector) {
          const sectorCount = rawHoldings.value.filter(h => sectorMap[h.ticker] === tickerSector).length
          if (sectorCount >= restrictions.maxStocksPerSector) {
            return { success: false, error: `You already have ${sectorCount} stock${sectorCount > 1 ? 's' : ''} in ${tickerSector}. Max ${restrictions.maxStocksPerSector} per sector allowed.` }
          }
        }

        // Check sector % allocation
        if (restrictions.maxSectorPct) {
          const totalPortfolioValue = rawHoldings.value.reduce((sum, h) => {
            const price = market.getCachedPrice(h.ticker) || h.avg_cost
            return sum + (h.shares * price)
          }, 0) + cashBalance.value
          const sectorValue = rawHoldings.value
            .filter(h => sectorMap[h.ticker] === tickerSector)
            .reduce((sum, h) => sum + (h.shares * (market.getCachedPrice(h.ticker) || h.avg_cost)), 0)
          const newSectorPct = totalPortfolioValue > 0 ? ((sectorValue + dollars) / totalPortfolioValue) * 100 : 0
          if (newSectorPct > restrictions.maxSectorPct) {
            return { success: false, error: `This trade would put ${newSectorPct.toFixed(1)}% of your portfolio in ${tickerSector}. Max ${restrictions.maxSectorPct}% per sector allowed.` }
          }
        }
      }
    }

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

    // Update cash balance — update local state immediately to prevent overdraft on rapid trades
    const newCash = cashBalance.value - dollars
    portfolio.value.cash_balance = newCash
    await supabase.from('portfolios')
      .update({ cash_balance: newCash })
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

    // Lightweight refresh — update holdings + prices without full DB reload
    const { data: freshHoldings } = await supabase.from('holdings').select('*').eq('portfolio_id', portfolioId)
    rawHoldings.value = freshHoldings || []
    await enrichHoldings()
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
        const sellFundNum = String(portfolio.value?.fund_number || '1')
        const sellRestrictions = cls.restrictions?.byFund?.[sellFundNum] || cls.restrictions || {}
        const freqError = await checkTradeFrequency(ticker, portfolio.value.id, sellRestrictions)
        if (freqError) return { success: false, error: freqError }
        // Check rationale requirement (default: required)
        const requireRationale = sellRestrictions?.requireRationale !== false
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
    const newCashSell = cashBalance.value + dollars
    portfolio.value.cash_balance = newCashSell
    await supabase.from('portfolios')
      .update({ cash_balance: newCashSell })
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

    // Lightweight refresh
    const { data: freshHoldings2 } = await supabase.from('holdings').select('*').eq('portfolio_id', portfolioId)
    rawHoldings.value = freshHoldings2 || []
    await enrichHoldings()
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

  // Update portfolio visibility (private/group/public)
  async function updateVisibility(portfolioId, visibility) {
    const pid = portfolioId || portfolio.value?.id
    if (!pid) return { error: 'No portfolio' }
    const { error } = await supabase
      .from('portfolios')
      .update({ visibility })
      .eq('id', pid)
    if (error) return { error: error.message }
    if (portfolio.value?.id === pid) portfolio.value.visibility = visibility
    return { success: true }
  }

  // Update share_holdings flag (group funds)
  async function updateShareHoldings(portfolioId, shareHoldings) {
    const pid = portfolioId || portfolio.value?.id
    if (!pid) return { error: 'No portfolio' }
    const { error } = await supabase
      .from('portfolios')
      .update({ share_holdings: shareHoldings })
      .eq('id', pid)
    if (error) return { error: error.message }
    if (portfolio.value?.id === pid) portfolio.value.share_holdings = shareHoldings
    return { success: true }
  }

  // Legacy toggle for backward compat
  async function setPublic(isPublic) {
    return updateVisibility(portfolio.value?.id, isPublic ? 'public' : 'private')
  }

  // Load the single personal portfolio for the current user
  async function loadPersonalPortfolio() {
    if (!auth.currentUser) return
    loading.value = true
    try {
      const { data: pData } = await supabase
        .from('portfolios')
        .select('*')
        .eq('owner_type', 'user')
        .eq('owner_id', auth.currentUser.id)
        .or('status.eq.active,status.is.null')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      portfolio.value = pData
      if (pData) {
        await _loadPortfolioData(pData)
      } else {
        _clearPortfolioData()
      }
    } finally {
      loading.value = false
    }
  }

  // Load all group funds for a group, sorted by fund_number
  async function loadGroupFunds(groupId) {
    if (!groupId) return []
    const { data, error } = await supabase
      .from('portfolios')
      .select('id, fund_name, fund_number, fund_thesis, cash_balance, starting_cash, fund_starting_cash, status, created_at, visibility, share_holdings')
      .eq('owner_type', 'group')
      .eq('owner_id', groupId)
      .or('status.eq.active,status.is.null')
      .order('fund_number', { ascending: true })
    if (error) {
      console.warn('Failed to load group funds:', error)
      return []
    }
    return data || []
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

    // Clear trade history for personal portfolios only
    if (portfolio.value.owner_type === 'user') {
      await supabase.from('trades').delete().eq('portfolio_id', portfolioId)
      await supabase.from('benchmark_trades').delete().eq('portfolio_id', portfolioId)
    }

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

  // Load all funds for a given owner (user or group)
  async function loadFundsForOwner(ownerType, ownerId) {
    if (!ownerId) return []
    const { data, error } = await supabase
      .from('portfolios')
      .select('id, fund_name, fund_number, fund_thesis, cash_balance, starting_cash, fund_starting_cash, status, created_at')
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .or('status.eq.active,status.is.null')
      .order('fund_number', { ascending: true })
    if (error) {
      console.warn('Failed to load funds for owner:', error)
      return []
    }
    return data || []
  }

  // Create a new fund for any owner (user or group)
  async function createFund(ownerType, ownerId, fundName, fundThesis, fundStartingCash = 100000) {
    if (!auth.currentUser) return { error: 'Not logged in' }

    // Count existing funds for this owner
    const { count } = await supabase
      .from('portfolios')
      .select('id', { count: 'exact' })
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .or('status.eq.active,status.is.null')

    if ((count || 0) >= MAX_FUNDS) return { error: `Maximum of ${MAX_FUNDS} funds allowed` }

    const nextFundNumber = (count || 0) + 1

    const { data: newPortfolio, error } = await supabase
      .from('portfolios')
      .insert({
        owner_type: ownerType,
        owner_id: ownerId,
        cash_balance: fundStartingCash,
        starting_cash: fundStartingCash,
        fund_starting_cash: fundStartingCash,
        fund_name: fundName || `Fund ${nextFundNumber}`,
        fund_thesis: fundThesis || '',
        fund_number: nextFundNumber,
        status: 'active',
        allow_reset: ownerType === 'user',
        is_public: true
      })
      .select()
      .single()
    if (error) return { error: error.message }

    return { success: true, portfolio: newPortfolio }
  }

  // Load all funds for current user (personal only — kept for backward compat)
  async function loadAllFunds() {
    if (!auth.currentUser) return []
    const data = await loadFundsForOwner('user', auth.currentUser.id)
    allFunds.value = data
    return data
  }

  return {
    portfolio, holdings, rawHoldings, benchmarkHoldings,
    trades, benchmarkTrades, loading, version,
    cashBalance, startingCash, totalMarketValue,
    totalReturnDollar, totalReturnPct,
    benchmarkMarketValue, benchmarkReturnPct, isBeatingSP500,
    benchmarkTicker, STARTING_CASH, allFunds, MAX_FUNDS,
    loadPortfolio, loadPortfolioById, enrichHoldings, buyStock, sellStock,
    getHolding, getPortfolioValueById,
    setPublic, updateVisibility, updateShareHoldings, updatePortfolioMeta,
    resetPortfolio, closePortfolio, loadSnapshots, snapshots, createPersonalPortfolio,
    getLeaderboardData, getPublicLeaderboardData,
    createFund, loadAllFunds, loadFundsForOwner,
    loadPersonalPortfolio, loadGroupFunds
  }
})
