const FMP_BASE = 'https://financialmodelingprep.com/api/v3'
const FMP_KEY = import.meta.env.VITE_FMP_API_KEY

async function fmpFetch(endpoint) {
  const separator = endpoint.includes('?') ? '&' : '?'
  const url = `${FMP_BASE}${endpoint}${separator}apikey=${FMP_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`FMP API error: ${res.status}`)
  return res.json()
}

export async function getQuote(ticker) {
  const data = await fmpFetch(`/quote/${ticker}`)
  return data?.[0] || null
}

export async function getBatchQuotes(tickers) {
  if (!tickers.length) return []
  const csv = tickers.join(',')
  return fmpFetch(`/quote/${csv}`)
}

export async function getHistoricalDaily(ticker, from, to) {
  let endpoint = `/historical-price-full/${ticker}?serietype=line`
  if (from) endpoint += `&from=${from}`
  if (to) endpoint += `&to=${to}`
  const data = await fmpFetch(endpoint)
  return data?.historical || []
}

export async function searchStocks(query) {
  return fmpFetch(`/search?query=${encodeURIComponent(query)}&limit=20`)
}

export async function getBatchHistoricalClose(tickers, dateStr) {
  if (!tickers.length) return {}
  // Fetch a small window around the target date to handle weekends/holidays
  const target = new Date(dateStr)
  const from = new Date(target.getTime() - 7 * 86400000).toISOString().split('T')[0]
  const to = dateStr
  const csv = tickers.join(',')
  const data = await fmpFetch(`/historical-price-full/${csv}?from=${from}&to=${to}`)

  const result = {}
  // FMP returns { historicalStockList: [...] } for multiple tickers, or { historical: [...] } for single
  const stockList = data?.historicalStockList || [{ symbol: tickers[0], historical: data?.historical || [] }]
  for (const stock of stockList) {
    const hist = stock.historical || []
    // Pick closest trading day at or before target — hist is newest-first
    const sorted = [...hist].sort((a, b) => new Date(b.date) - new Date(a.date))
    const match = sorted.find(d => new Date(d.date) <= target)
    if (match) {
      result[stock.symbol] = match.adjClose ?? match.close
    }
  }
  return result
}

export async function getBatchProfiles(tickers) {
  if (!tickers.length) return []
  const csv = tickers.join(',')
  return fmpFetch(`/profile/${csv}`)
}

export async function getCompanyProfile(ticker) {
  const data = await fmpFetch(`/profile/${ticker}`)
  return data?.[0] || null
}

export async function getGainers() {
  return fmpFetch('/stock/gainers')
}

export async function getLosers() {
  return fmpFetch('/stock/losers')
}

export async function screenStocks(params = {}) {
  const query = new URLSearchParams()
  if (params.sector) query.set('sector', params.sector)
  if (params.marketCapMoreThan) query.set('marketCapMoreThan', params.marketCapMoreThan)
  if (params.marketCapLowerThan) query.set('marketCapLowerThan', params.marketCapLowerThan)
  if (params.exchange) query.set('exchange', params.exchange)
  if (params.country) query.set('country', params.country)
  if (params.dividendMoreThan) query.set('dividendMoreThan', params.dividendMoreThan)
  if (params.betaLowerThan) query.set('betaLowerThan', params.betaLowerThan)
  if (params.betaMoreThan) query.set('betaMoreThan', params.betaMoreThan)
  if (params.isEtf !== undefined) query.set('isEtf', params.isEtf)
  query.set('limit', params.limit || 50)
  return fmpFetch(`/stock-screener?${query.toString()}`)
}

export async function screenStocksMultiCountry(countries, params = {}) {
  const limit = Math.ceil((params.limit || 50) / countries.length)
  const calls = countries.map(c => screenStocks({ ...params, country: c, limit }))
  const results = await Promise.all(calls)
  return results.flat().sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0)).slice(0, params.limit || 50)
}
