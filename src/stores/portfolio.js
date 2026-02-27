import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import rawPortfoliosData from '../mock/portfolios.json'
import stocksData from '../mock/stocks.json'
import { useAuthStore } from './auth'

export const usePortfolioStore = defineStore('portfolio', () => {
  const auth = useAuthStore()
  const STARTING_CASH = 100000
  const SP500_RETURN_PCT = 8.42

  // Reactive copy so trades trigger UI updates
  const portfolios = ref(JSON.parse(JSON.stringify(rawPortfoliosData)))
  // Track a version counter to force computed re-evaluation
  const version = ref(0)

  const portfolio = computed(() => {
    void version.value
    if (!auth.currentUser) return null
    return portfolios.value[auth.currentUser.groupId] || null
  })

  const holdings = computed(() => {
    void version.value
    if (!portfolio.value) return []
    return portfolio.value.holdings.map(h => {
      const stock = stocksData.find(s => s.ticker === h.ticker)
      const currentPrice = stock?.price || 0
      const marketValue = h.shares * currentPrice
      const costBasis = h.shares * h.avgCost
      const gainLoss = marketValue - costBasis
      const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0
      return {
        ...h,
        name: stock?.name || h.ticker,
        currentPrice,
        marketValue,
        costBasis,
        gainLoss,
        gainLossPct
      }
    })
  })

  const totalMarketValue = computed(() => {
    void version.value
    if (!portfolio.value) return 0
    const holdingsValue = holdings.value.reduce((sum, h) => sum + h.marketValue, 0)
    return holdingsValue + portfolio.value.cashBalance
  })

  const totalReturnDollar = computed(() => totalMarketValue.value - STARTING_CASH)
  const totalReturnPct = computed(() => (totalReturnDollar.value / STARTING_CASH) * 100)
  const isBeatingSP500 = computed(() => totalReturnPct.value > SP500_RETURN_PCT)

  function getPortfolioValue(groupId) {
    void version.value
    const p = portfolios.value[groupId]
    if (!p) return STARTING_CASH
    const holdingsVal = p.holdings.reduce((sum, h) => {
      const stock = stocksData.find(s => s.ticker === h.ticker)
      return sum + (h.shares * (stock?.price || 0))
    }, 0)
    return holdingsVal + p.cashBalance
  }

  function getPortfolioReturn(groupId) {
    return ((getPortfolioValue(groupId) - STARTING_CASH) / STARTING_CASH) * 100
  }

  function getHolding(ticker) {
    if (!portfolio.value) return null
    return portfolio.value.holdings.find(h => h.ticker === ticker) || null
  }

  function buyStock(ticker, dollars) {
    if (!auth.currentUser) return { success: false, error: 'Not logged in' }
    const groupId = auth.currentUser.groupId
    const p = portfolios.value[groupId]
    if (!p) return { success: false, error: 'Portfolio not found' }

    const stock = stocksData.find(s => s.ticker === ticker)
    if (!stock) return { success: false, error: 'Stock not found' }
    if (dollars <= 0) return { success: false, error: 'Amount must be positive' }
    if (dollars > p.cashBalance) return { success: false, error: 'Insufficient cash' }

    const shares = dollars / stock.price
    const existing = p.holdings.find(h => h.ticker === ticker)

    if (existing) {
      const totalCost = (existing.shares * existing.avgCost) + dollars
      existing.shares += shares
      existing.avgCost = totalCost / existing.shares
    } else {
      p.holdings.push({ ticker, shares, avgCost: stock.price })
    }

    p.cashBalance -= dollars
    version.value++
    return { success: true, shares, price: stock.price }
  }

  function sellStock(ticker, dollars) {
    if (!auth.currentUser) return { success: false, error: 'Not logged in' }
    const groupId = auth.currentUser.groupId
    const p = portfolios.value[groupId]
    if (!p) return { success: false, error: 'Portfolio not found' }

    const stock = stocksData.find(s => s.ticker === ticker)
    if (!stock) return { success: false, error: 'Stock not found' }
    if (dollars <= 0) return { success: false, error: 'Amount must be positive' }

    const existing = p.holdings.find(h => h.ticker === ticker)
    if (!existing) return { success: false, error: 'You don\'t own this stock' }

    const sharesToSell = dollars / stock.price
    if (sharesToSell > existing.shares + 0.0001) return { success: false, error: 'Not enough shares' }

    existing.shares -= sharesToSell
    p.cashBalance += dollars

    if (existing.shares < 0.001) {
      p.holdings = p.holdings.filter(h => h.ticker !== ticker)
    }

    version.value++
    return { success: true, shares: sharesToSell, price: stock.price }
  }

  return {
    portfolio, holdings, totalMarketValue, totalReturnDollar, totalReturnPct,
    isBeatingSP500, SP500_RETURN_PCT, STARTING_CASH, portfolios, version,
    getPortfolioValue, getPortfolioReturn, getHolding, buyStock, sellStock
  }
})
