<template>
  <div class="space-y-5 pb-10">
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-xl font-bold">Performance Attribution</h1>
        <p class="text-base-content/60 text-sm mt-1">
          <span v-if="portfolioLabel" class="font-semibold text-base-content/80">{{ portfolioLabel }}</span>
          <span v-if="portfolioLabel"> — </span>
          What helped, what hurt, and why
        </p>
      </div>
      <div class="text-right">
        <div class="text-xs text-base-content/50">Portfolio return ({{ periodLabel }})</div>
        <div class="text-2xl font-bold" :class="totalReturn >= 0 ? 'text-success' : 'text-error'">
          {{ totalReturn >= 0 ? '+' : '' }}{{ totalReturn.toFixed(2) }}%
        </div>
        <div class="text-xs text-base-content/50">vs SPY {{ spyReturn >= 0 ? '+' : '' }}{{ spyReturn.toFixed(2) }}%</div>
      </div>
    </div>

    <!-- Fund selector (when multiple funds exist) -->
    <div v-if="funds.length > 1" class="flex items-center gap-2 overflow-x-auto">
      <button
        v-for="fund in funds"
        :key="fund.id"
        class="btn btn-xs whitespace-nowrap"
        :class="activeFundId === fund.id ? 'btn-secondary' : 'btn-ghost'"
        @click="switchFund(fund.id)"
      >
        {{ fund.fund_name || `Fund ${fund.fund_number}` }}
      </button>
    </div>

    <!-- Time Range Selector -->
    <div class="flex items-center gap-3">
      <span class="text-xs text-base-content/50 font-semibold">Period:</span>
      <TimeRangeSelector v-model="selectedRange" />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 5" :key="i" class="card bg-base-100 shadow p-4">
        <div class="skeleton h-12 w-full rounded"></div>
      </div>
    </div>

    <template v-else-if="attributions.length">
      <!-- Summary cards -->
      <div class="grid grid-cols-3 gap-3">
        <div class="card bg-success/10 border border-success/20 p-4 text-center">
          <div class="text-xs text-base-content/60 mb-1">Biggest Help</div>
          <div class="font-mono font-bold text-lg text-success">{{ topHelper?.ticker }}</div>
          <div class="text-success font-semibold">{{ topHelper?.contribution >= 0 ? '+' : '' }}{{ topHelper?.contribution.toFixed(2) }}%</div>
          <div class="text-xs text-base-content/50">added to return</div>
        </div>
        <div class="card bg-base-100 border border-base-300 p-4 text-center">
          <div class="text-xs text-base-content/60 mb-1">Beat SPY by</div>
          <div class="text-2xl font-bold" :class="alpha >= 0 ? 'text-success' : 'text-error'">
            {{ alpha >= 0 ? '+' : '' }}{{ alpha.toFixed(2) }}%
          </div>
          <div class="text-xs text-base-content/50">selection effect</div>
        </div>
        <div class="card bg-error/10 border border-error/20 p-4 text-center">
          <div class="text-xs text-base-content/60 mb-1">Biggest Drag</div>
          <div class="font-mono font-bold text-lg text-error">{{ topDrag?.ticker }}</div>
          <div class="text-error font-semibold">{{ topDrag?.contribution >= 0 ? '+' : '' }}{{ topDrag?.contribution.toFixed(2) }}%</div>
          <div class="text-xs text-base-content/50">from return</div>
        </div>
      </div>

      <!-- AI Explain button -->
      <div class="card bg-base-100 shadow p-4">
        <div class="flex items-center gap-3 flex-wrap">
          <button class="btn btn-primary btn-sm gap-2" @click="explainPortfolio" :disabled="explaining">
            <span v-if="explaining && !explainTicker" class="loading loading-spinner loading-xs"></span>
            <span v-else>💡</span>
            {{ explaining && !explainTicker ? 'Reading news...' : 'Explain my portfolio' }}
          </button>
          <span class="text-xs text-base-content/40">Claude reads recent news and explains what moved your stocks</span>
        </div>
        <div v-if="explanation && !explainTicker" class="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm leading-relaxed">
          {{ explanation }}
        </div>
      </div>

      <!-- Waterfall chart -->
      <div class="card bg-base-100 shadow p-5">
        <h2 class="font-semibold mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          Contribution to Return ({{ periodLabel }})
        </h2>
        <div class="space-y-3">
          <div v-for="a in attributions" :key="a.ticker">
            <div class="flex items-center gap-3">
              <!-- Ticker + name -->
              <div class="w-28 shrink-0">
                <div class="font-mono font-bold text-sm">{{ a.ticker }}</div>
                <div class="text-xs text-base-content/50 truncate">{{ a.companyName }}</div>
              </div>
              <!-- Bar -->
              <div class="flex-1 relative h-8 flex items-center">
                <div class="absolute left-1/2 w-px h-full bg-base-300"></div>
                <div
                  class="h-6 rounded transition-all duration-500 flex items-center"
                  :class="a.contribution >= 0 ? 'bg-success ml-auto' : 'bg-error'"
                  :style="barStyle(a.contribution)"
                >
                  <span class="text-xs font-bold text-white px-1 whitespace-nowrap"
                    :class="a.contribution >= 0 ? 'text-right' : 'text-left'">
                    {{ a.contribution >= 0 ? '+' : '' }}{{ a.contribution.toFixed(2) }}%
                  </span>
                </div>
              </div>
              <!-- Stock return + weight -->
              <div class="w-24 shrink-0 text-right">
                <div class="text-sm font-semibold" :class="a.stockReturn >= 0 ? 'text-success' : 'text-error'">
                  {{ a.stockReturn >= 0 ? '+' : '' }}{{ a.stockReturn.toFixed(2) }}%
                </div>
                <div class="text-xs text-base-content/40">{{ a.weight.toFixed(1) }}% wt</div>
              </div>
            </div>
          </div>

          <!-- Cash row if any -->
          <div v-if="cashPct > 0" class="flex items-center gap-3 opacity-50">
            <div class="w-28 shrink-0">
              <div class="font-mono font-bold text-sm">CASH</div>
              <div class="text-xs text-base-content/50">No return</div>
            </div>
            <div class="flex-1 relative h-8 flex items-center">
              <div class="absolute left-1/2 w-px h-full bg-base-300"></div>
              <div class="h-6 rounded bg-base-300 flex items-center px-2" style="width:2px; min-width:40px;">
                <span class="text-xs">0.00%</span>
              </div>
            </div>
            <div class="w-24 shrink-0 text-right">
              <div class="text-sm">0.00%</div>
              <div class="text-xs text-base-content/40">{{ cashPct.toFixed(1) }}% wt</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stock-by-stock detail cards -->
      <div class="card bg-base-100 shadow p-5">
        <h2 class="font-semibold mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          Stock Detail
        </h2>
        <div class="overflow-x-auto">
          <table class="table table-sm table-zebra w-full">
            <thead>
              <tr class="text-base-content/50 text-xs">
                <th>Stock</th>
                <th class="text-right">Weight</th>
                <th class="text-right">{{ periodLabel }} Return</th>
                <th class="text-right">Contribution</th>
                <th class="text-right">vs SPY</th>
                <th class="text-right">Gain/Loss $</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in attributions" :key="a.ticker" class="hover">
                <td>
                  <RouterLink :to="`/stocks/${a.ticker}`" class="link link-hover">
                    <span class="font-mono font-bold">{{ a.ticker }}</span>
                    <span v-if="a.companyName" class="block text-xs text-base-content/50">{{ a.companyName }}</span>
                  </RouterLink>
                  <span v-if="a.status" class="badge badge-xs ml-1" :class="a.status === 'sold' ? 'badge-warning' : 'badge-info'">{{ a.status }}</span>
                  <button class="btn btn-ghost btn-xs text-base-content/40 hover:text-primary mt-0.5" @click="explainStock(a)" :disabled="explaining">
                    <span v-if="explaining && explainTicker === a.ticker" class="loading loading-spinner loading-xs"></span>
                    <span v-else>💡</span> why?
                  </button>
                  <div v-if="explanation && explainTicker === a.ticker" class="mt-1 p-2 bg-primary/5 border border-primary/20 rounded text-xs leading-relaxed max-w-xs">{{ explanation }}</div>
                </td>
                <td class="text-right font-mono">{{ a.weight.toFixed(1) }}%</td>
                <td class="text-right font-mono" :class="a.stockReturn >= 0 ? 'text-success' : 'text-error'">
                  {{ a.stockReturn >= 0 ? '+' : '' }}{{ a.stockReturn.toFixed(2) }}%
                </td>
                <td class="text-right font-mono font-bold" :class="a.contribution >= 0 ? 'text-success' : 'text-error'">
                  {{ a.contribution >= 0 ? '+' : '' }}{{ a.contribution.toFixed(2) }}%
                </td>
                <td class="text-right font-mono" :class="a.vsSpy >= 0 ? 'text-success' : 'text-error'">
                  {{ a.vsSpy >= 0 ? '+' : '' }}{{ a.vsSpy.toFixed(2) }}%
                </td>
                <td class="text-right font-mono" :class="a.dollarGain >= 0 ? 'text-success' : 'text-error'">
                  {{ a.dollarGain >= 0 ? '+' : '' }}${{ Math.abs(a.dollarGain).toLocaleString('en-US', {maximumFractionDigits: 0}) }}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="font-bold border-t border-base-300">
                <td>Portfolio Total</td>
                <td class="text-right font-mono">100%</td>
                <td class="text-right"></td>
                <td class="text-right font-mono" :class="totalReturn >= 0 ? 'text-success' : 'text-error'">
                  {{ totalReturn >= 0 ? '+' : '' }}{{ totalReturn.toFixed(2) }}%
                </td>
                <td class="text-right font-mono" :class="alpha >= 0 ? 'text-success' : 'text-error'">
                  {{ alpha >= 0 ? '+' : '' }}{{ alpha.toFixed(2) }}%
                </td>
                <td class="text-right font-mono" :class="totalDollarGain >= 0 ? 'text-success' : 'text-error'">
                  {{ totalDollarGain >= 0 ? '+' : '' }}${{ Math.abs(totalDollarGain).toLocaleString('en-US', {maximumFractionDigits: 0}) }}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Counterfactuals -->
      <div class="card bg-base-100 shadow p-5">
        <h2 class="font-semibold mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
          What If?
        </h2>
        <div class="space-y-2">
          <div v-for="a in counterfactuals" :key="a.ticker" class="flex items-center justify-between py-2 border-b border-base-200 last:border-0">
            <div class="text-sm">
              <span class="text-base-content/60">Without </span>
              <span class="font-mono font-bold">{{ a.ticker }}</span>
              <span class="text-base-content/60">, your return would be </span>
              <span class="font-bold" :class="a.returnWithout >= 0 ? 'text-success' : 'text-error'">
                {{ a.returnWithout >= 0 ? '+' : '' }}{{ a.returnWithout.toFixed(2) }}%
              </span>
            </div>
            <div class="badge" :class="a.contribution < 0 ? 'badge-error' : 'badge-success'">
              {{ a.contribution < 0 ? 'drag' : 'boost' }}
            </div>
          </div>
        </div>
      </div>

      <!-- How attribution works -->
      <div class="card bg-base-200/50 p-4">
        <p class="text-xs text-base-content/50">
          <strong>How this works:</strong> Contribution = ($ in stock ÷ portfolio total) x stock's return over the period.
          A stock with 30% weight that's up 2% contributes +0.6% to your total return.
          "vs SPY" shows how much each stock beat or missed the S&amp;P 500's return for the same period.
          <template v-if="selectedRange !== '1D'">
            Weights are based on holdings at the start of the period.
            Stocks bought or sold during the period are included with their actual P&amp;L.
          </template>
        </p>
      </div>
    </template>

    <!-- No holdings -->
    <div v-else class="text-center py-20 text-base-content/50">
      <div class="text-5xl mb-4">📊</div>
      <p v-if="noDataReason">{{ noDataReason }}</p>
      <p v-else>No holdings data for this period — make some trades to see attribution analysis.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePortfolioStore } from '../../stores/portfolio'
import { useMarketDataStore } from '../../stores/marketData'
import { useAuthStore } from '../../stores/auth'
import { supabase } from '../../lib/supabase'
import { reconstructHoldingsAsOf, reconstructCashAsOf } from '../../utils/leaderboardMetrics'
import TimeRangeSelector from '../../components/charts/TimeRangeSelector.vue'

const route = useRoute()
const portfolioStore = usePortfolioStore()
const market = useMarketDataStore()
const auth = useAuthStore()
const loading = ref(true)
const selectedRange = ref(route.query.range || 'All')
const noDataReason = ref('')

// Fund selector state
const funds = ref([])
const activeFundId = ref(route.query.portfolioId || null)

// Portfolio label: show which portfolio/fund this is for
const portfolioLabel = computed(() => {
  const p = portfolioStore.portfolio
  if (!p) return ''
  if (p.fund_name) return p.fund_name
  if (p.owner_type === 'user') return 'My Investments'
  return ''
})

// Price caches for the current period computation
const startPrices = ref({})   // prices at start of period
const currentPrices = ref({}) // current prices (or previousClose for 1D)
const spyStartPrice = ref(0)
const spyCurrentPrice = ref(0)
const spyPrevClose = ref(0)

// For AI explanation
const explaining = ref(false)
const explanation = ref('')
const explainTicker = ref('')

// Period state
const periodHoldings = ref([])  // holdings at start of period
const periodCash = ref(0)       // cash at start of period
const periodTrades = ref([])    // trades during the period

const periodLabel = computed(() => {
  const labels = {
    '1D': 'Today', '1W': '1 Week', '3W': '3 Weeks',
    '1M': '1 Month', '3M': '3 Months', '1Y': '1 Year',
    '5Y': '5 Years', 'All': 'Since Inception'
  }
  return labels[selectedRange.value] || selectedRange.value
})

function getPeriodStartDate(range) {
  const now = new Date()
  const dayMs = 86400000
  const map = {
    '1D': 1, '1W': 7, '3W': 21, '1M': 30,
    '3M': 90, '1Y': 365, '5Y': 1825, 'All': 3650
  }
  const days = map[range] || 1
  return new Date(now.getTime() - days * dayMs)
}

function getDateStr(date) {
  return date.toISOString().split('T')[0]
}

// ── Load attribution data for selected period ──
async function loadAttribution(isInitial = false) {
  loading.value = true
  noDataReason.value = ''
  explanation.value = ''
  explainTicker.value = ''

  // On first load, use query param if provided (subsequent loads use activeFundId from selector)
  if (isInitial && route.query.portfolioId) {
    activeFundId.value = route.query.portfolioId
    await portfolioStore.loadPortfolioById(route.query.portfolioId)
  }

  // On initial load with 1D, if no current holdings but there are trades, switch to All
  if (isInitial && selectedRange.value === '1D' && portfolioStore.holdings.length === 0 && portfolioStore.trades.length > 0) {
    selectedRange.value = 'All'
  }

  try {
    if (selectedRange.value === '1D') {
      await loadDailyAttribution()
    } else {
      await loadPeriodAttribution()
    }
  } catch (e) {
    console.warn('Attribution load error', e)
  }
  loading.value = false
}

// ── 1D: use previousClose (existing logic) ──
async function loadDailyAttribution() {
  const tickers = portfolioStore.holdings.map(h => h.ticker)
  if (!tickers.length) {
    periodHoldings.value = []
    noDataReason.value = portfolioStore.trades.length > 0
      ? 'No current holdings — select a longer period (1W, 1M, etc.) to see attribution from past trades.'
      : 'No holdings yet — make some trades to see attribution analysis.'
    return
  }

  const all = [...new Set([...tickers, 'SPY'])]
  const FMP_KEY = import.meta.env.VITE_FMP_API_KEY
  const res = await fetch(`https://financialmodelingprep.com/api/v3/quote/${all.join(',')}?apikey=${FMP_KEY}`)
  const quotes = await res.json()

  const prevMap = {}
  const curMap = {}
  for (const q of quotes) {
    prevMap[q.symbol] = q.previousClose || q.price
    curMap[q.symbol] = q.price
    if (q.symbol === 'SPY') {
      spyPrevClose.value = q.previousClose || q.price
      spyCurrentPrice.value = q.price
    }
  }
  startPrices.value = prevMap
  currentPrices.value = curMap

  await market.fetchBatchQuotes(all)
  await market.fetchBatchProfiles(tickers)

  // Build period holdings from current holdings for 1D mode
  periodHoldings.value = portfolioStore.holdings.map(h => ({
    ticker: h.ticker,
    shares: Number(h.shares),
    startPrice: prevMap[h.ticker] || h.currentPrice,
    endPrice: curMap[h.ticker] || h.currentPrice,
  }))
  periodCash.value = portfolioStore.cashBalance
  periodTrades.value = []
}

// ── Multi-day period: reconstruct holdings at start ──
async function loadPeriodAttribution() {
  const asOfDate = getPeriodStartDate(selectedRange.value)
  const asOfDateStr = getDateStr(asOfDate)

  // Need trades sorted newest-first (they already are from the store)
  const trades = portfolioStore.trades
  const currentHoldings = portfolioStore.rawHoldings
  const currentCash = portfolioStore.cashBalance

  // Reconstruct past state
  const pastHoldings = reconstructHoldingsAsOf(currentHoldings, trades, asOfDate)
  const pastCash = reconstructCashAsOf(currentCash, trades, asOfDate)

  // Collect all tickers: held at start + held now + traded during period
  const tradesInPeriod = trades.filter(t => new Date(t.executed_at) > asOfDate)
  const tradedTickers = [...new Set(tradesInPeriod.map(t => t.ticker))]
  const pastTickers = pastHoldings.map(h => h.ticker)
  const currentTickers = currentHoldings.map(h => h.ticker)
  const allTickers = [...new Set([...pastTickers, ...currentTickers, ...tradedTickers])]

  if (allTickers.length === 0 && pastCash === currentCash) {
    periodHoldings.value = []
    noDataReason.value = 'No holdings or trades during this period.'
    return
  }

  // Fetch historical prices at period start + current prices
  const allWithSpy = [...new Set([...allTickers, 'SPY'])]
  const [historicalPrices] = await Promise.all([
    market.fetchHistoricalCloseForTickers(allWithSpy, asOfDateStr),
    market.fetchBatchQuotes(allWithSpy),
  ])

  if (allTickers.length > 0) {
    await market.fetchBatchProfiles(allTickers)
  }

  spyStartPrice.value = historicalPrices['SPY'] || 0
  spyCurrentPrice.value = market.getCachedPrice('SPY') || 0

  // Build a map of start prices and end prices
  const sMap = {}
  const eMap = {}
  for (const ticker of allTickers) {
    sMap[ticker] = historicalPrices[ticker] || 0
    eMap[ticker] = market.getCachedPrice(ticker) || 0
  }
  startPrices.value = sMap
  currentPrices.value = eMap

  // Build attribution entries for each ticker involved
  const entries = []
  const pastHoldingsMap = Object.fromEntries(pastHoldings.map(h => [h.ticker, h.shares]))
  const currentHoldingsMap = Object.fromEntries(currentHoldings.map(h => [h.ticker, Number(h.shares)]))

  // Calculate starting portfolio value for weights
  let startPortfolioValue = pastCash
  for (const h of pastHoldings) {
    startPortfolioValue += h.shares * (sMap[h.ticker] || 0)
  }

  // If portfolio didn't exist yet (start value = 0), use starting_cash
  if (startPortfolioValue <= 0) {
    startPortfolioValue = portfolioStore.startingCash
  }

  for (const ticker of allTickers) {
    const startShares = pastHoldingsMap[ticker] || 0
    const endShares = currentHoldingsMap[ticker] || 0
    const sp = sMap[ticker] || 0
    const ep = eMap[ticker] || 0

    let stockReturn = 0
    let dollarGain = 0
    let weight = 0
    let status = null

    if (startShares > 0 && endShares > 0) {
      // Held throughout (possibly with partial trades)
      // Use beginning-of-period weight and price return
      const startValue = startShares * sp
      weight = startPortfolioValue > 0 ? (startValue / startPortfolioValue) * 100 : 0
      stockReturn = sp > 0 ? ((ep / sp) - 1) * 100 : 0

      // Dollar P&L: change in held value + realized from trades
      const tradesForTicker = tradesInPeriod.filter(t => t.ticker === ticker)
      const netTraded = tradesForTicker.reduce((sum, t) =>
        sum + (t.side === 'sell' ? Number(t.dollars) : -Number(t.dollars)), 0)
      dollarGain = (endShares * ep) - (startShares * sp) + netTraded
    } else if (startShares > 0 && endShares === 0) {
      // Sold during period
      status = 'sold'
      const startValue = startShares * sp
      weight = startPortfolioValue > 0 ? (startValue / startPortfolioValue) * 100 : 0
      // P&L = sell proceeds - start value
      const sellProceeds = tradesInPeriod
        .filter(t => t.ticker === ticker && t.side === 'sell')
        .reduce((sum, t) => sum + Number(t.dollars), 0)
      dollarGain = sellProceeds - startValue
      stockReturn = startValue > 0 ? (dollarGain / startValue) * 100 : 0
    } else if (startShares === 0 && endShares > 0) {
      // Bought during period
      status = 'new'
      const buyDollars = tradesInPeriod
        .filter(t => t.ticker === ticker && t.side === 'buy')
        .reduce((sum, t) => sum + Number(t.dollars), 0)
      // Weight by cost basis relative to starting portfolio
      weight = startPortfolioValue > 0 ? (buyDollars / startPortfolioValue) * 100 : 0
      const currentValue = endShares * ep
      dollarGain = currentValue - buyDollars
      stockReturn = buyDollars > 0 ? (dollarGain / buyDollars) * 100 : 0
    } else {
      // Bought and sold entirely within the period (round-trip)
      status = 'round-trip'
      const buyDollars = tradesInPeriod
        .filter(t => t.ticker === ticker && t.side === 'buy')
        .reduce((sum, t) => sum + Number(t.dollars), 0)
      const sellDollars = tradesInPeriod
        .filter(t => t.ticker === ticker && t.side === 'sell')
        .reduce((sum, t) => sum + Number(t.dollars), 0)
      weight = startPortfolioValue > 0 ? (buyDollars / startPortfolioValue) * 100 : 0
      dollarGain = sellDollars - buyDollars
      stockReturn = buyDollars > 0 ? (dollarGain / buyDollars) * 100 : 0
    }

    const contribution = (weight / 100) * stockReturn
    const spyPeriodReturn = spyStartPrice.value > 0
      ? ((spyCurrentPrice.value / spyStartPrice.value) - 1) * 100
      : 0
    const vsSpy = stockReturn - spyPeriodReturn

    entries.push({
      ticker, weight, stockReturn, contribution, vsSpy, dollarGain, status,
      marketValue: endShares * ep,
    })
  }

  periodHoldings.value = entries
  periodCash.value = pastCash
  periodTrades.value = tradesInPeriod
}

// ── Computed attribution from periodHoldings ──
const attributions = computed(() => {
  if (selectedRange.value === '1D') {
    // Daily mode: compute from periodHoldings array
    if (!periodHoldings.value.length) return []
    const portfolioTotal = periodHoldings.value.reduce((s, h) => s + (h.shares * h.startPrice), 0)
      + (portfolioStore.cashBalance || 0)
    if (portfolioTotal <= 0) return []

    return periodHoldings.value.map(h => {
      const stockReturn = h.startPrice ? ((h.endPrice / h.startPrice) - 1) * 100 : 0
      const weight = (h.shares * h.startPrice) / portfolioTotal * 100
      const contribution = (weight / 100) * stockReturn
      const spyDayReturn = spyPrevClose.value ? ((spyCurrentPrice.value / spyPrevClose.value) - 1) * 100 : 0
      const vsSpy = stockReturn - spyDayReturn
      const dollarGain = h.shares * (h.endPrice - h.startPrice)
      const profile = market.profilesCache?.[h.ticker]?.data
      return {
        ticker: h.ticker,
        companyName: profile?.companyName || profile?.name || '',
        weight, stockReturn, contribution, vsSpy, dollarGain,
        marketValue: h.shares * h.endPrice,
        status: null,
      }
    }).sort((a, b) => b.contribution - a.contribution)
  }

  // Period mode: periodHoldings already has computed entries
  if (!periodHoldings.value.length) return []
  return periodHoldings.value
    .filter(h => Math.abs(h.weight) > 0.01 || Math.abs(h.dollarGain) > 0.5)
    .map(h => {
      const profile = market.profilesCache?.[h.ticker]?.data
      return {
        ...h,
        companyName: profile?.companyName || profile?.name || '',
      }
    })
    .sort((a, b) => b.contribution - a.contribution)
})

const spyReturn = computed(() => {
  if (selectedRange.value === '1D') {
    return spyPrevClose.value ? ((spyCurrentPrice.value / spyPrevClose.value) - 1) * 100 : 0
  }
  return spyStartPrice.value > 0
    ? ((spyCurrentPrice.value / spyStartPrice.value) - 1) * 100
    : 0
})

const cashPct = computed(() => {
  if (selectedRange.value === '1D') {
    const total = periodHoldings.value.reduce((s, h) => s + h.shares * h.startPrice, 0) + (portfolioStore.cashBalance || 0)
    return total > 0 ? (portfolioStore.cashBalance / total) * 100 : 0
  }
  const startVal = periodHoldings.value.reduce((s, h) => s + (h.weight || 0), 0)
  // Cash % = 100 - sum of stock weights
  return Math.max(0, 100 - startVal)
})

const totalReturn = computed(() => attributions.value.reduce((s, a) => s + a.contribution, 0))
const totalDollarGain = computed(() => attributions.value.reduce((s, a) => s + a.dollarGain, 0))
const alpha = computed(() => totalReturn.value - spyReturn.value)
const topHelper = computed(() => attributions.value[0] || null)
const topDrag = computed(() => [...attributions.value].sort((a, b) => a.contribution - b.contribution)[0] || null)

const counterfactuals = computed(() => {
  return attributions.value.map(a => ({
    ticker: a.ticker,
    contribution: a.contribution,
    returnWithout: totalReturn.value - a.contribution
  })).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 5)
})

const MAX_BAR = 50
const maxContrib = computed(() => Math.max(...attributions.value.map(a => Math.abs(a.contribution)), 0.1))

function barStyle(contribution) {
  const pct = (Math.abs(contribution) / maxContrib.value) * MAX_BAR
  if (contribution >= 0) {
    return { width: `${pct}%`, maxWidth: '50%', marginLeft: 'auto' }
  } else {
    return { width: `${pct}%`, maxWidth: '50%', marginRight: 'auto' }
  }
}

// ── AI Explanation ──
async function explainPortfolio() {
  explaining.value = true
  explainTicker.value = ''
  explanation.value = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) throw new Error('Login required')
    const tickers = attributions.value.map(a => a.ticker)
    const changes = Object.fromEntries(attributions.value.map(a => [a.ticker, a.stockReturn]))
    const summary = `Portfolio return (${periodLabel.value}): ${totalReturn.value.toFixed(2)}%. Best: ${topHelper.value?.ticker}. Worst: ${topDrag.value?.ticker}. vs SPY: ${alpha.value.toFixed(2)}%.`
    const res = await fetch('/api/explain-attribution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ tickers, changes, portfolioSummary: summary, mode: 'portfolio' })
    })
    const data = await res.json()
    explanation.value = data.explanation
  } catch(e) { explanation.value = 'Could not load explanation. Try again.' }
  finally { explaining.value = false }
}

async function explainStock(a) {
  explaining.value = true
  explainTicker.value = a.ticker
  explanation.value = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) throw new Error('Login required')
    const res = await fetch('/api/explain-attribution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ tickers: [a.ticker], changes: { [a.ticker]: a.stockReturn }, mode: 'stock' })
    })
    const data = await res.json()
    explanation.value = data.explanation
  } catch(e) { explanation.value = 'Could not load explanation. Try again.' }
  finally { explaining.value = false }
}

async function switchFund(fundId) {
  if (fundId === activeFundId.value) return
  activeFundId.value = fundId
  await portfolioStore.loadPortfolioById(fundId)
  loadAttribution()
}

// ── Watch for range changes ──
watch(selectedRange, () => {
  loadAttribution()
})

onMounted(async () => {
  // Load fund list for selector (personal + group funds)
  const membership = await auth.getCurrentMembership()
  const allFunds = []

  // Load personal portfolio
  const uid = auth.effectiveUserId
  if (uid) {
    const { data: personalPortfolio } = await supabase
      .from('portfolios')
      .select('id, fund_name, fund_number, owner_type')
      .eq('owner_type', 'user')
      .eq('owner_id', uid)
      .or('status.eq.active,status.is.null')
      .limit(1)
      .maybeSingle()
    if (personalPortfolio) {
      allFunds.push({ ...personalPortfolio, fund_name: personalPortfolio.fund_name || 'My Investments' })
    }
  }

  // Load group funds
  if (membership?.group_id && membership.group_id !== 'personal') {
    const gFunds = await portfolioStore.loadGroupFunds(membership.group_id)
    allFunds.push(...gFunds)
  }

  funds.value = allFunds

  // If no portfolioId specified, default to first fund
  if (!activeFundId.value && allFunds.length > 0) {
    activeFundId.value = allFunds[0].id
    await portfolioStore.loadPortfolioById(allFunds[0].id)
  }

  loadAttribution(true)
})
</script>
