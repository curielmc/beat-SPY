import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as fmpApi from '../services/fmpApi'

const CACHE_TTL = 60 * 1000 // 1 minute

export const useMarketDataStore = defineStore('marketData', () => {
  const quotesCache = ref({})     // { ticker: { data, timestamp } }
  const profilesCache = ref({})   // { ticker: { data, timestamp } }
  const historicalPricesCache = ref({})  // { "AAPL:2025-01-15": adjClose } — never expires
  const searchResults = ref([])
  const loading = ref(false)

  function isCacheValid(entry) {
    return entry && (Date.now() - entry.timestamp) < CACHE_TTL
  }

  async function fetchQuote(ticker) {
    const cached = quotesCache.value[ticker]
    if (isCacheValid(cached)) return cached.data

    try {
      const data = await fmpApi.getQuote(ticker)
      if (data) {
        quotesCache.value[ticker] = { data, timestamp: Date.now() }
      }
      return data
    } catch (e) {
      console.error(`Failed to fetch quote for ${ticker}:`, e)
      return cached?.data || null
    }
  }

  async function fetchBatchQuotes(tickers) {
    if (!tickers.length) return []

    // Separate cached and uncached
    const uncached = tickers.filter(t => !isCacheValid(quotesCache.value[t]))
    const results = []

    if (uncached.length > 0) {
      try {
        const data = await fmpApi.getBatchQuotes(uncached)
        for (const quote of (data || [])) {
          quotesCache.value[quote.symbol] = { data: quote, timestamp: Date.now() }
        }
      } catch (e) {
        console.error('Failed to fetch batch quotes:', e)
      }
    }

    // Return all from cache
    for (const ticker of tickers) {
      const cached = quotesCache.value[ticker]
      if (cached?.data) results.push(cached.data)
    }
    return results
  }

  async function fetchHistory(ticker, range = '1Y') {
    const rangeMap = {
      '1W': 7,
      '3W': 21,
      '1M': 30,
      '3M': 90,
      '1Y': 365,
      '5Y': 1825,
      'All': 3650
    }
    const days = rangeMap[range] || 365
    const to = new Date().toISOString().split('T')[0]
    const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]

    try {
      const data = await fmpApi.getHistoricalDaily(ticker, from, to)
      // FMP returns newest first, reverse for chronological
      return data.reverse().map(d => ({
        date: new Date(d.date),
        value: d.close
      }))
    } catch (e) {
      console.error(`Failed to fetch history for ${ticker}:`, e)
      return []
    }
  }

  async function fetchCompanyProfile(ticker) {
    const cached = profilesCache.value[ticker]
    if (isCacheValid(cached)) return cached.data

    try {
      const data = await fmpApi.getCompanyProfile(ticker)
      if (data) {
        profilesCache.value[ticker] = { data, timestamp: Date.now() }
      }
      return data
    } catch (e) {
      console.error(`Failed to fetch profile for ${ticker}:`, e)
      return cached?.data || null
    }
  }

  async function searchStocks(query) {
    if (!query || query.length < 1) {
      searchResults.value = []
      return []
    }
    loading.value = true
    try {
      const data = await fmpApi.searchStocks(query)
      searchResults.value = data || []
      return data || []
    } catch (e) {
      console.error('Failed to search stocks:', e)
      return []
    } finally {
      loading.value = false
    }
  }

  const gainersCache = ref(null)  // { data, timestamp }
  const losersCache = ref(null)

  async function fetchGainers() {
    if (isCacheValid(gainersCache.value)) return gainersCache.value.data
    try {
      const data = await fmpApi.getGainers()
      const top10 = (data || []).slice(0, 10)
      gainersCache.value = { data: top10, timestamp: Date.now() }
      return top10
    } catch (e) {
      console.error('Failed to fetch gainers:', e)
      return gainersCache.value?.data || []
    }
  }

  async function fetchLosers() {
    if (isCacheValid(losersCache.value)) return losersCache.value.data
    try {
      const data = await fmpApi.getLosers()
      const top10 = (data || []).slice(0, 10)
      losersCache.value = { data: top10, timestamp: Date.now() }
      return top10
    } catch (e) {
      console.error('Failed to fetch losers:', e)
      return losersCache.value?.data || []
    }
  }

  async function screenStocks(filters) {
    loading.value = true
    try {
      const data = await fmpApi.screenStocks(filters)
      return data || []
    } catch (e) {
      console.error('Failed to screen stocks:', e)
      return []
    } finally {
      loading.value = false
    }
  }

  async function screenStocksMultiCountry(countries, filters) {
    loading.value = true
    try {
      const data = await fmpApi.screenStocksMultiCountry(countries, filters)
      return data || []
    } catch (e) {
      console.error('Failed to screen stocks multi-country:', e)
      return []
    } finally {
      loading.value = false
    }
  }

  // Get cached quote price (sync, for computations)
  function getCachedPrice(ticker) {
    return quotesCache.value[ticker]?.data?.price || null
  }

  // Get full cached quote object (includes previousClose, price, etc.)
  function getCachedQuote(ticker) {
    return quotesCache.value[ticker]?.data || null
  }

  // Fetch adjusted close prices for multiple tickers on a specific date.
  // Uses indefinite cache — past closes never change.
  async function fetchHistoricalCloseForTickers(tickers, dateStr) {
    const result = {}
    const uncached = []

    for (const t of tickers) {
      const key = `${t}:${dateStr}`
      if (historicalPricesCache.value[key] !== undefined) {
        result[t] = historicalPricesCache.value[key]
      } else {
        uncached.push(t)
      }
    }

    if (uncached.length > 0) {
      try {
        const prices = await fmpApi.getBatchHistoricalClose(uncached, dateStr)
        for (const [ticker, price] of Object.entries(prices)) {
          const key = `${ticker}:${dateStr}`
          historicalPricesCache.value[key] = price
          result[ticker] = price
        }
      } catch (e) {
        console.error('Failed to fetch historical closes:', e)
      }
    }

    return result
  }

  // Fetch profiles for multiple tickers in one call
  async function fetchBatchProfiles(tickers) {
    const uncached = tickers.filter(t => !isCacheValid(profilesCache.value[t]))
    if (uncached.length > 0) {
      try {
        const data = await fmpApi.getBatchProfiles(uncached)
        for (const profile of (data || [])) {
          profilesCache.value[profile.symbol] = { data: profile, timestamp: Date.now() }
        }
      } catch (e) {
        console.error('Failed to fetch batch profiles:', e)
      }
    }
    const result = {}
    for (const t of tickers) {
      if (profilesCache.value[t]?.data) result[t] = profilesCache.value[t].data
    }
    return result
  }

  return {
    quotesCache, searchResults, loading,
    fetchQuote, fetchBatchQuotes, fetchHistory,
    fetchCompanyProfile, fetchBatchProfiles, searchStocks, screenStocks, screenStocksMultiCountry,
    getCachedPrice, getCachedQuote, fetchHistoricalCloseForTickers,
    fetchGainers, fetchLosers
  }
})
