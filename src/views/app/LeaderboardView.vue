<template>
  <div class="p-4 space-y-6">
    <div>
      <h1 class="text-xl font-bold">Leaderboard</h1>
      <p class="text-sm text-base-content/60">See how every group is performing</p>
    </div>

    <!-- View Toggle -->
    <div class="flex gap-2">
      <button class="btn btn-sm" :class="viewMode === 'fund' ? 'btn-primary' : 'btn-ghost'" @click="viewMode = 'fund'">By Fund</button>
      <button class="btn btn-sm" :class="viewMode === 'aggregate' ? 'btn-primary' : 'btn-ghost'" @click="viewMode = 'aggregate'">By Group</button>
    </div>

    <!-- Metric Selector Pills -->
    <div class="overflow-x-auto -mx-4 px-4">
      <div class="flex gap-2 whitespace-nowrap">
        <button
          v-for="m in metrics"
          :key="m.key"
          class="btn btn-sm"
          :class="activeMetric === m.key ? 'btn-primary' : 'btn-ghost'"
          @click="activeMetric = m.key"
        >{{ m.label }}</button>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <div v-if="errorMsg" class="alert alert-error">
        <span>{{ errorMsg }}</span>
      </div>

      <!-- S&P 500 Benchmark -->
      <div class="card bg-base-100 shadow-sm border border-base-300 overflow-hidden">
        <div class="card-body p-0 flex-row items-stretch">
          <div class="bg-primary/10 px-4 py-3 flex flex-col justify-center border-r border-base-300">
            <p class="font-bold text-primary text-sm uppercase tracking-wider">Benchmark</p>
            <p class="text-[10px] text-base-content/50 font-medium">S&P 500 (SPY)</p>
          </div>
          <div class="flex-1 px-6 py-3 flex items-center justify-between">
            <span class="text-xs text-base-content/60 italic">"The index to beat"</span>
            <div class="text-right">
              <template v-if="benchmarkMetricLoading">
                <span class="loading loading-dots loading-xs"></span>
              </template>
              <template v-else-if="activeBenchmarkValue === null">
                <span class="text-sm text-base-content/40">N/A</span>
              </template>
              <template v-else>
                <span class="text-2xl font-black" :class="activeBenchmarkValue >= 0 ? 'text-success' : 'text-error'">
                  {{ activeBenchmarkValue >= 0 ? '+' : '' }}{{ activeBenchmarkValue.toFixed(2) }}%
                </span>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Highlight Stats -->
      <div v-if="highlights" class="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <!-- Top Fund -->
        <div class="card bg-base-100 shadow-sm border border-success/30">
          <div class="card-body p-4 flex-row items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs text-base-content/50 uppercase tracking-wide">🏆 Top Fund</p>
              <p class="font-bold text-sm leading-tight truncate">{{ highlights.topFund?.name || '—' }}</p>
            </div>
            <p class="text-success font-bold text-lg whitespace-nowrap">
              <template v-if="highlights.topFund?.metrics?.[highlights.activeMetric] !== undefined">
                {{ highlights.topFund.metrics[highlights.activeMetric] >= 0 ? '+' : '' }}{{ highlights.topFund.metrics[highlights.activeMetric]?.toFixed(2) }}%
              </template>
              <template v-else>—</template>
            </p>
          </div>
        </div>

        <!-- Best Stock Pick -->
        <div class="card bg-base-100 shadow-sm border border-warning/30">
          <div class="card-body p-4 flex-row items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs text-base-content/50 uppercase tracking-wide">⭐ Best Pick</p>
              <p class="font-bold text-sm leading-tight">{{ highlights.bestStock || '—' }}</p>
              <p v-if="highlights.bestStockName" class="text-[10px] text-base-content/60 truncate" :title="highlights.bestStockName">{{ highlights.bestStockName }}</p>
              <p class="text-xs text-base-content/40 truncate">{{ highlights.bestStockGroup }}</p>
            </div>
            <p class="text-warning font-bold text-lg whitespace-nowrap">
              {{ highlights.bestStockReturn >= 0 ? '+' : '' }}{{ highlights.bestStockReturn?.toFixed(2) }}%
            </p>
          </div>
        </div>

        <!-- Beating SPY -->
        <div class="card bg-base-100 shadow-sm border border-primary/30">
          <div class="card-body p-4 flex-row items-center justify-between gap-3">
            <div>
              <p class="text-xs text-base-content/50 uppercase tracking-wide">📈 Beating SPY</p>
              <p class="text-xs text-base-content/40">Groups above benchmark</p>
            </div>
            <div class="text-right">
              <p class="font-bold text-2xl leading-none text-primary">
                {{ highlights.beatingCount !== null ? highlights.beatingCount : '—' }}
              </p>
              <p class="text-xs text-base-content/40 mt-1">of {{ highlights.total }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Rankings -->
      <div class="space-y-2">
        <LeaderboardEntry
          v-for="(entry, index) in sortedEntries"
          :key="entry.entryKey"
          :rank="index + 1"
          :entry="entry"
          :active-metric="activeMetric"
          :is-me="entry.groupId === myGroupId"
          :benchmark-value="activeBenchmarkValue"
          :metric-loading="isMetricLoading(activeMetric)"
        />
      </div>

      <div v-if="sortedEntries.length === 0" class="text-center py-12 space-y-4">
        <div v-if="!auth.activeClassId" class="space-y-4">
          <p class="text-base-content/50">You haven't joined a class yet.</p>
          <RouterLink to="/join" class="btn btn-primary">Join a Class</RouterLink>
        </div>
        <p v-else class="text-base-content/50">No groups found in your class.</p>
      </div>

      <!-- Comparison Chart (disabled for now — will revisit later)
      <div v-if="!loading" class="card bg-base-100 shadow-sm mt-8">
        <div class="card-body p-4 space-y-3">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <h3 class="font-bold text-lg">Performance Comparison</h3>
            <TimeRangeSelector v-model="chartTimeRange" />
          </div>
          <div class="flex gap-2">
            <button class="btn btn-xs" :class="!showIndividuals ? 'btn-primary' : 'btn-ghost'" @click="showIndividuals = false">Groups</button>
            <button
              class="btn btn-xs"
              :class="showIndividuals ? 'btn-secondary' : 'btn-ghost'"
              @click="showIndividuals = true"
            >Individuals</button>
          </div>
          <div v-if="chartLoading" class="flex justify-center py-8">
            <span class="loading loading-spinner loading-md"></span>
          </div>
          <PortfolioLineChart
            v-else-if="visibleDatasets.length > 0"
            :datasets="visibleDatasets"
            :time-range="chartTimeRange"
            :show-percentage="true"
            height="260px"
          />
          <p v-else class="text-center text-base-content/50 py-4 text-sm">No chart data available yet.</p>
        </div>
      </div>
      -->
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { usePortfolioStore } from '../../stores/portfolio'
import { useMarketDataStore } from '../../stores/marketData'
import { supabase } from '../../lib/supabase'
import LeaderboardEntry from '../../components/LeaderboardEntry.vue'
import PortfolioLineChart from '../../components/charts/PortfolioLineChart.vue'
import TimeRangeSelector from '../../components/charts/TimeRangeSelector.vue'
import { getHistoricalDaily } from '../../services/fmpApi'
import { isMarketOpen } from '../../utils/marketHours'
import {
  computePeriodReturn,
  computeTodayReturn,
  computeAnnualizedReturn,
  computeRiskAdjustedReturn
} from '../../utils/leaderboardMetrics'

const auth = useAuthStore()
const portfolioStore = usePortfolioStore()
const market = useMarketDataStore()

const metrics = [
  { key: 'sinceInception', label: 'Since Inception' },
  { key: 'today', label: 'Today' },
  { key: 'd5', label: '5D' },
  { key: 'd20', label: '20D' },
  { key: 'd30', label: '30D' },
  { key: 'd90', label: '90D' },
  { key: 'y1', label: '1Y' },
  { key: 'annualized', label: 'Annualized' },
  { key: 'riskAdjusted', label: 'Risk-Adj' }
]

// --- Highlight Stats ---
const highlights = computed(() => {
  const entries = sortedEntries.value
  if (!entries.length) return null

  const mKey = activeMetric.value

  // 1. Top fund for the ACTIVE metric
  const topFund = entries[0] // already sorted desc

  // 2. Best single stock pick across all entries
  let bestStockTicker = null
  let bestStockName = null
  let bestStockReturn = -Infinity
  let bestStockGroup = null
  for (const g of entries) {
    for (const h of (g.holdings || [])) {
      const currentPrice = market.getCachedPrice(h.ticker) || Number(h.avg_cost)
      const ret = ((currentPrice - Number(h.avg_cost)) / Number(h.avg_cost)) * 100
      if (ret > bestStockReturn) {
        bestStockReturn = ret
        bestStockTicker = h.ticker
        const profile = market.profilesCache[h.ticker]?.data
        bestStockName = profile?.companyName || profile?.name || null
        bestStockGroup = g.name
      }
    }
  }

  // 3. How many entries beat SPY for the ACTIVE metric
  const spy = activeBenchmarkValue.value
  const beatingCount = spy !== null ? entries.filter(g => (g.metrics?.[mKey] ?? -Infinity) > spy).length : null

  return {
    topFund,
    bestStock: bestStockTicker,
    bestStockName,
    bestStockReturn,
    bestStockGroup,
    beatingCount,
    total: entries.length,
    activeMetric: mKey
  }
})

const PERIOD_METRICS = {
  d5: 5, d20: 20, d30: 30, d90: 90, y1: 365
}

const viewMode = ref('fund')
const activeMetric = ref('today')
const loading = ref(true)
const groups = ref([])
const fundEntries = ref([])
const myGroupId = ref(null)
const errorMsg = ref('')

// Chart state
const chartTimeRange = ref('3M')
const showIndividuals = ref(false)
const chartDatasets = ref([])
const chartLoading = ref(false)
const individualDatasets = ref([])

const GROUP_COLORS = ['primary', 'secondary', 'accent', 'info', 'success', 'warning', 'error']
const INDIVIDUAL_COLORS = ['#8b5cf6', '#ec4899', '#6ee7b7', '#7dd3fc', '#86efac', '#fde047', '#fca5a5']

const visibleDatasets = computed(() => {
  if (showIndividuals.value) {
    return [...chartDatasets.value, ...individualDatasets.value]
  }
  return chartDatasets.value
})

// Benchmark metrics
const benchmarkMetrics = ref({})
const benchmarkMetricLoading = ref(false)
const periodMetricsLoading = ref(true)
const riskMetricsLoading = ref(true)

const activeBenchmarkValue = computed(() => {
  if (activeMetric.value === 'sinceInception') return benchmarkMetrics.value.sinceInception ?? null
  if (activeMetric.value === 'today') return benchmarkMetrics.value.today ?? null
  if (activeMetric.value === 'annualized') return benchmarkMetrics.value.annualized ?? null
  if (activeMetric.value === 'riskAdjusted') return benchmarkMetrics.value.sinceInception ?? null // SPY beta ~= 1
  return benchmarkMetrics.value[activeMetric.value] ?? null
})

function isMetricLoading(key) {
  if (['sinceInception', 'today', 'annualized'].includes(key)) return false
  if (key === 'riskAdjusted') return riskMetricsLoading.value
  return periodMetricsLoading.value
}

// Sort by active metric — switches between fund-level and group-aggregate entries
const sortedEntries = computed(() => {
  const source = viewMode.value === 'fund' ? fundEntries.value : groups.value
  return [...source].sort((a, b) => {
    const aVal = a.metrics?.[activeMetric.value] ?? -Infinity
    const bVal = b.metrics?.[activeMetric.value] ?? -Infinity
    return bVal - aVal
  })
})

let refreshInterval = null
async function loadLeaderboard() {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }

  loading.value = true
  errorMsg.value = ''
  groups.value = []
  fundEntries.value = []
  myGroupId.value = null
  benchmarkMetrics.value = {}
  chartDatasets.value = []
  individualDatasets.value = []
  periodMetricsLoading.value = true
  riskMetricsLoading.value = true

  try {
    const membership = await auth.getCurrentMembership(true)
    myGroupId.value = membership?.group_id

    if (!membership?.class_id) {
      loading.value = false
      return
    }

    // Get all groups in this class with member names
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('*, memberships:class_memberships(user_id, profiles:profiles(full_name))')
      .eq('class_id', membership.class_id)

    if (groupError) {
      throw groupError
    }

    if (!groupData?.length) {
      return
    }

    const groupIds = groupData.map(g => g.id)

    // Bulk fetch portfolios, holdings, trades
    const { portfolios, holdingsMap, tradesMap } = await portfolioStore.getLeaderboardData(groupIds)

    // Build portfolio lookup by owner_id (one group can have multiple funds)
    const portfoliosByGroup = {}
    for (const p of portfolios) {
      if (!portfoliosByGroup[p.owner_id]) portfoliosByGroup[p.owner_id] = []
      portfoliosByGroup[p.owner_id].push(p)
    }

    // Collect all unique tickers for batch quote fetch
    const allTickers = new Set()
    for (const holdings of Object.values(holdingsMap)) {
      for (const h of holdings) allTickers.add(h.ticker)
    }
    allTickers.add('SPY')

    // Fetch all quotes and profiles in one batch
    await Promise.all([
      market.fetchBatchQuotes([...allTickers]),
      market.fetchBatchProfiles([...allTickers])
    ])

    // Helper: compute metrics for a set of holdings + cash
    function computeEntryMetrics(pHoldings, cashBalance, startingCash, createdAt) {
      const holdingsValue = pHoldings.reduce((sum, h) => {
        const price = market.getCachedPrice(h.ticker) || Number(h.avg_cost)
        return sum + (Number(h.shares) * price)
      }, 0)
      const totalValue = holdingsValue + cashBalance
      const sinceInception = startingCash > 0 ? ((totalValue - startingCash) / startingCash) * 100 : 0

      const quotesMap = {}
      for (const h of pHoldings) {
        quotesMap[h.ticker] = market.getCachedQuote(h.ticker)
      }
      const today = computeTodayReturn(pHoldings, quotesMap, cashBalance)

      let topHelper = null
      let topHurter = null
      let maxGain = -Infinity
      let maxLoss = Infinity
      for (const h of pHoldings) {
        const currentPrice = market.getCachedPrice(h.ticker) || Number(h.avg_cost)
        const gainLoss = (currentPrice - Number(h.avg_cost)) * Number(h.shares)
        const profile = market.profilesCache[h.ticker]?.data
        const driverObj = { ticker: h.ticker, name: profile?.companyName || profile?.name || null }
        if (gainLoss > 0 && gainLoss > maxGain) { maxGain = gainLoss; topHelper = driverObj }
        if (gainLoss < 0 && gainLoss < maxLoss) { maxLoss = gainLoss; topHurter = driverObj }
      }

      const annualized = computeAnnualizedReturn(sinceInception, createdAt)

      return { totalValue, holdingsValue, sinceInception, today, annualized, drivers: { helper: topHelper, hurter: topHurter } }
    }

    // Phase 1: build fund-level entries AND aggregate group entries
    const enriched = []       // aggregate (group-level)
    const allFundEntries = [] // per-fund

    for (const group of groupData) {
      const groupPortfolios = portfoliosByGroup[group.id] || []
      const memberNames = (group.memberships || []).map(m => m.profiles?.full_name?.split(' ')[0]).filter(Boolean)

      // Build per-fund entries
      for (const p of groupPortfolios) {
        const pHoldings = holdingsMap[p.id] || []
        const startingCash = p.starting_cash != null ? Number(p.starting_cash) : 100000
        const cashBalance = p.cash_balance != null ? Number(p.cash_balance) : startingCash
        const createdAt = p.created_at || new Date().toISOString()
        const m = computeEntryMetrics(pHoldings, cashBalance, startingCash, createdAt)

        allFundEntries.push({
          ...group,
          entryKey: p.id,
          groupId: group.id,
          name: `${group.name} — ${p.fund_name || p.name || 'Fund'}`,
          portfolioId: p.id,
          totalValue: m.totalValue,
          metrics: { sinceInception: m.sinceInception, today: m.today, annualized: m.annualized },
          drivers: m.drivers,
          memberNames,
          holdings: pHoldings,
          trades: tradesMap[p.id] || [],
          cashBalance,
          startingCash,
          createdAt
        })
      }

      // Build aggregate group entry (combine all funds)
      const allGroupHoldings = groupPortfolios.flatMap(p => holdingsMap[p.id] || [])
      const aggCash = groupPortfolios.reduce((s, p) => s + (p.cash_balance != null ? Number(p.cash_balance) : 0), 0)
      const aggStarting = groupPortfolios.reduce((s, p) => s + (p.starting_cash != null ? Number(p.starting_cash) : 100000), 0)
      const earliestCreated = groupPortfolios.map(p => p.created_at).filter(Boolean).sort()[0] || new Date().toISOString()
      const aggM = computeEntryMetrics(allGroupHoldings, aggCash, aggStarting, earliestCreated)

      enriched.push({
        ...group,
        entryKey: group.id,
        groupId: group.id,
        portfolioId: groupPortfolios[0]?.id,
        totalValue: aggM.totalValue,
        metrics: { sinceInception: aggM.sinceInception, today: aggM.today, annualized: aggM.annualized },
        drivers: aggM.drivers,
        memberNames,
        holdings: allGroupHoldings,
        trades: groupPortfolios.flatMap(p => tradesMap[p.id] || []),
        cashBalance: aggCash,
        startingCash: aggStarting,
        createdAt: earliestCreated
      })
    }

    groups.value = enriched
    fundEntries.value = allFundEntries

    // Benchmark Phase 1
    const spyQuote = market.getCachedQuote('SPY')
    if (spyQuote && spyQuote.price > 0) {
      const benchmarkStartDate = enriched
        .map(group => group.createdAt)
        .filter(Boolean)
        .sort((a, b) => new Date(a) - new Date(b))[0]

      let spySinceInception = null
      if (benchmarkStartDate) {
        const fromStr = new Date(benchmarkStartDate).toISOString().slice(0, 10)
        const toStr = new Date().toISOString().slice(0, 10)
        const spyHistory = await getHistoricalDaily('SPY', fromStr, toStr)
        const firstValidClose = spyHistory
          ?.map(point => Number(point.close ?? point.adjClose ?? point.price))
          .find(price => Number.isFinite(price) && price > 0)

        if (firstValidClose) {
          spySinceInception = ((spyQuote.price - firstValidClose) / firstValidClose) * 100
        }
      }

      benchmarkMetrics.value.sinceInception = spySinceInception
      const spyPrevClose = spyQuote.previousClose || spyQuote.price
      benchmarkMetrics.value.today = spyPrevClose > 0 ? ((spyQuote.price - spyPrevClose) / spyPrevClose) * 100 : 0
      benchmarkMetrics.value.annualized = spySinceInception !== null && benchmarkStartDate
        ? computeAnnualizedReturn(spySinceInception, benchmarkStartDate)
        : null
    } else {
      benchmarkMetrics.value.sinceInception = null
      benchmarkMetrics.value.today = null
      benchmarkMetrics.value.annualized = null
    }

    // Build chart datasets (non-blocking) — use first portfolio per group for chart
    const firstPortfolioByGroup = {}
    for (const [gid, ps] of Object.entries(portfoliosByGroup)) {
      firstPortfolioByGroup[gid] = ps[0]
    }
    buildChartDatasets(enriched, firstPortfolioByGroup, tradesMap)

    // Phase 2: background — period metrics + risk-adjusted (both views)
    computePeriodMetrics(enriched, allFundEntries)
    computeRiskMetrics(enriched, allFundEntries)

    // Auto-refresh prices every 5 minutes (300,000ms)
    // Only if market is open and tab is focused to save API calls
    refreshInterval = setInterval(async () => {
      if (document.hidden) return
      if (!isMarketOpen()) return

      const allT = [...new Set(groups.value.flatMap(g => (g.holdings || []).map(h => h.ticker)).concat(['SPY']))]
      if (allT.length) await market.fetchBatchQuotes(allT)
    }, 300000)
  } catch (error) {
    console.error('[Leaderboard] load failed:', error)
    errorMsg.value = error.message || 'Failed to load leaderboard'
  } finally {
    loading.value = false
  }
}

onMounted(loadLeaderboard)

watch(() => auth.masqueradeUser?.id, (next, prev) => {
  if (next !== prev) loadLeaderboard()
})

watch(() => auth.activeClassId, (next, prev) => {
  if (next !== prev) loadLeaderboard()
})

// Simple seeded random for synthetic data
function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s % 1000) / 1000 - 0.5
  }
}

function generateSyntheticHistory(createdAt, returnPct, seed) {
  const start = new Date(createdAt)
  const now = new Date()
  const points = []
  const days = Math.max(1, Math.round((now - start) / 86400000))
  const rng = seededRandom(seed)
  for (let i = 0; i <= days; i++) {
    const date = new Date(start.getTime() + i * 86400000)
    const progress = i / days
    const noise = rng() * 0.5
    const value = 100000 * (1 + (returnPct / 100) * (progress + noise * progress * 0.3))
    points.push({ date, value })
  }
  return points
}

async function buildPortfolioHistory(portfolio, trades, startingCash) {
  if (!portfolio || !trades?.length) return null
  
  // Sort trades chronologically by executed_at
  const sortedTrades = [...trades].sort((a, b) => new Date(a.executed_at) - new Date(b.executed_at))
  
  const holdingsMap = {}
  const tradePriceMap = {} // Track last known price for each ticker from trades
  let runningCash = startingCash
  const history = []
  const firstDate = new Date(portfolio.created_at)
  history.push({ date: firstDate, value: startingCash })

  for (const t of sortedTrades) {
    const date = new Date(t.executed_at)
    const ticker = t.ticker
    const tradePrice = Number(t.price)
    
    // Update trade price map with this trade's price
    tradePriceMap[ticker] = tradePrice
    
    if (t.side === 'buy') {
      runningCash -= Number(t.dollars)
      holdingsMap[ticker] = (holdingsMap[ticker] || 0) + Number(t.shares)
    } else {
      runningCash += Number(t.dollars)
      holdingsMap[ticker] = (holdingsMap[ticker] || 0) - Number(t.shares)
      if (holdingsMap[ticker] <= 0) delete holdingsMap[ticker]
    }
    
    // Calculate holdings value using last known trade prices
    let holdingsValue = 0
    for (const [tickerKey, shares] of Object.entries(holdingsMap)) {
      if (shares <= 0 || !tickerKey) continue
      // Use trade price if available, fallback to cached market price
      const price = tradePriceMap[tickerKey] || market.getCachedPrice(tickerKey) || 0
      if (price <= 0) {
        console.warn(`[Leaderboard] No price for ${tickerKey} in portfolio ${portfolio.id}, using 0`)
      }
      holdingsValue += shares * price
    }
    const totalValue = runningCash + holdingsValue
    
    // Debug logging for anomalous values
    if (totalValue > 200000 || totalValue < 50000) {
      console.warn(`[Leaderboard] Anomalous portfolio value: $${totalValue.toFixed(2)} for ${portfolio.id} at ${date}`, {
        cash: runningCash,
        holdingsValue,
        holdings: {...holdingsMap},
        tradePrices: {...tradePriceMap}
      })
    }
    
    history.push({ date, value: totalValue })
  }
  
  // Aggregate to daily buckets (end-of-day) to match SPY daily data format
  return aggregateToDaily(history)
}

// Aggregate intraday history to daily end-of-day values
function aggregateToDaily(history) {
  if (!history || history.length === 0) return history
  
  const dailyMap = new Map()
  
  for (const point of history) {
    const dateKey = point.date.toISOString().split('T')[0] // YYYY-MM-DD
    // Keep the last value of each day (end-of-day)
    dailyMap.set(dateKey, { date: new Date(dateKey), value: point.value })
  }
  
  // Convert map to sorted array
  return [...dailyMap.values()].sort((a, b) => a.date - b.date)
}

async function buildChartDatasets(enriched, portfolioByGroup, tradesMap) {
  chartLoading.value = true
  try {
    const datasets = []

    // Find earliest portfolio date for SPY query
    let earliestDate = new Date()
    for (const g of enriched) {
      const d = new Date(g.createdAt)
      if (d < earliestDate) earliestDate = d
    }
    const fromStr = earliestDate.toISOString().split('T')[0]
    const toStr = new Date().toISOString().split('T')[0]

    // SPY benchmark
    let spyHistory = []
    try {
      const spyData = await getHistoricalDaily('SPY', fromStr, toStr)
      spyHistory = [...spyData].reverse().map(d => ({
        date: new Date(d.date),
        value: d.close
      }))
    } catch (e) {
      console.warn('Failed to fetch SPY history for leaderboard chart:', e)
    }

    if (spyHistory.length > 0) {
      const spyBaseline = spyHistory[0].value
      datasets.push({
        label: 'S&P 500',
        data: spyHistory.map(d => ({ date: d.date, value: (d.value / spyBaseline) * 100000 })),
        color: 'sp500'
      })
    }

    // Group portfolios
    for (let i = 0; i < enriched.length; i++) {
      const g = enriched[i]
      const p = portfolioByGroup[g.id]
      const trades = p ? (tradesMap[p.id] || []) : []

      let history = await buildPortfolioHistory(p, trades, g.startingCash)
      if (!history || history.length < 2) {
        // Synthetic fallback
        const seed = g.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
        history = generateSyntheticHistory(g.createdAt, g.metrics.sinceInception || 0, seed)
      }

      // Add current value as final point
      history.push({ date: new Date(), value: g.totalValue })

      datasets.push({
        label: g.name,
        data: history,
        color: GROUP_COLORS[i % GROUP_COLORS.length]
      })
    }

    chartDatasets.value = datasets

    // Build individual datasets in background
    buildIndividualDatasets(enriched)
  } catch (e) {
    console.error('Failed to build chart datasets:', e)
  } finally {
    chartLoading.value = false
  }
}

async function buildIndividualDatasets(enriched) {
  try {
    // Get class_id from first group
    const classId = enriched[0]?.class_id
    if (!classId) return

    const { data: memberships } = await supabase
      .from('class_memberships')
      .select('user_id, profiles:profiles(full_name)')
      .eq('class_id', classId)

    if (!memberships?.length) return

    const userIds = memberships.map(m => m.user_id)
    const { data: userPortfolios } = await supabase
      .from('portfolios')
      .select('*')
      .eq('owner_type', 'user')
      .in('owner_id', userIds)

    if (!userPortfolios?.length) return

    const portfolioIds = userPortfolios.map(p => p.id)
    const { data: allTrades } = await supabase
      .from('trades')
      .select('*')
      .in('portfolio_id', portfolioIds)
      .order('executed_at')

    const tradesByPortfolio = {}
    for (const t of (allTrades || [])) {
      if (!tradesByPortfolio[t.portfolio_id]) tradesByPortfolio[t.portfolio_id] = []
      tradesByPortfolio[t.portfolio_id].push(t)
    }

    const memberMap = {}
    for (const m of memberships) {
      memberMap[m.user_id] = m.profiles?.full_name?.split(' ')[0] || 'Student'
    }

    const datasets = []
    for (let i = 0; i < userPortfolios.length; i++) {
      const p = userPortfolios[i]
      const trades = tradesByPortfolio[p.id] || []
      const startingCash = Number(p.starting_cash) || 100000

      let history = await buildPortfolioHistory(p, trades, startingCash)
      if (!history || history.length < 2) {
        const seed = p.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
        const cashBalance = p.cash_balance != null ? Number(p.cash_balance) : startingCash
        const returnPct = startingCash > 0 ? ((cashBalance - startingCash) / startingCash) * 100 : 0
        history = generateSyntheticHistory(p.created_at, returnPct, seed)
      }

      datasets.push({
        label: memberMap[p.owner_id] || 'Student',
        data: history,
        color: INDIVIDUAL_COLORS[i % INDIVIDUAL_COLORS.length]
      })
    }

    individualDatasets.value = datasets
  } catch (e) {
    console.warn('Failed to build individual datasets:', e)
  }
}

async function computePeriodMetrics(entries, fundEntriesArr) {
  try {
    const now = new Date()
    const periodDates = {}
    for (const [key, days] of Object.entries(PERIOD_METRICS)) {
      periodDates[key] = new Date(now.getTime() - days * 86400000).toISOString().split('T')[0]
    }

    // Get all portfolio IDs from both arrays
    const allEntries = [...entries, ...fundEntriesArr]
    const portfolioIds = allEntries.map(e => e.portfolioId).filter(Boolean)

    // Find the earliest period date we need
    const allDateStrs = Object.values(periodDates)
    const earliestDate = allDateStrs.sort()[0]

    // Fetch all daily snapshots for these portfolios from the earliest date
    let allSnapshots = []
    if (portfolioIds.length > 0) {
      const { data } = await supabase
        .from('portfolio_snapshots')
        .select('portfolio_id, total_value, snapshot_date')
        .eq('snapshot_type', 'daily')
        .in('portfolio_id', portfolioIds)
        .gte('snapshot_date', earliestDate)
        .order('snapshot_date', { ascending: true })
      allSnapshots = data || []
    }

    // Index snapshots by portfolio_id
    const snapshotsByPortfolio = {}
    for (const s of allSnapshots) {
      if (!snapshotsByPortfolio[s.portfolio_id]) snapshotsByPortfolio[s.portfolio_id] = []
      snapshotsByPortfolio[s.portfolio_id].push(s)
    }

    // For each entry and period, find the closest snapshot
    for (const entry of allEntries) {
      const snapshots = snapshotsByPortfolio[entry.portfolioId] || []

      for (const [key, dateStr] of Object.entries(periodDates)) {
        const created = new Date(entry.createdAt)
        const asOfDate = new Date(dateStr)

        if (created > asOfDate) {
          entry.metrics[key] = entry.metrics.sinceInception
          continue
        }

        // Find the closest snapshot to the target date
        const targetTs = new Date(dateStr).getTime()
        let closest = null
        let closestDiff = Infinity
        for (const s of snapshots) {
          const sDate = new Date(s.snapshot_date).getTime()
          const diff = Math.abs(sDate - targetTs)
          if (diff < closestDiff) {
            closestDiff = diff
            closest = s
          }
        }

        if (closest && closestDiff < 5 * 86400000) {
          // Use snapshot if within 5 days of target
          const pastValue = Number(closest.total_value)
          if (pastValue > 1) {
            entry.metrics[key] = computePeriodReturn(pastValue, entry.totalValue)
          } else {
            entry.metrics[key] = entry.metrics.sinceInception
          }
        } else {
          // No snapshot available — fall back to since inception
          entry.metrics[key] = entry.metrics.sinceInception
        }
      }
    }

    // SPY benchmark period returns (still use FMP historical)
    const spyPrice = market.getCachedPrice('SPY')
    if (spyPrice) {
      const spyDates = Object.entries(periodDates)
      const spyHistorical = {}
      await Promise.all(
        spyDates.map(async ([key, dateStr]) => {
          const prices = await market.fetchHistoricalCloseForTickers(['SPY'], dateStr)
          spyHistorical[key] = prices?.SPY
        })
      )

      for (const [key] of spyDates) {
        if (spyHistorical[key] && spyHistorical[key] > 0) {
          benchmarkMetrics.value[key] = computePeriodReturn(spyHistorical[key], spyPrice)
        } else {
          benchmarkMetrics.value[key] = null
        }
      }
    }

    // Trigger reactivity
    groups.value = [...groups.value]
    fundEntries.value = [...fundEntries.value]
  } catch (e) {
    console.error('Failed to compute period metrics:', e)
  } finally {
    periodMetricsLoading.value = false
  }
}

async function computeRiskMetrics(entries, fundEntriesArr) {
  try {
    const allEntries = [...entries, ...fundEntriesArr]
    // Collect all unique tickers
    const allTickers = new Set()
    for (const entry of allEntries) {
      for (const h of entry.holdings) allTickers.add(h.ticker)
    }
    const tickerList = [...allTickers]

    if (tickerList.length === 0) {
      riskMetricsLoading.value = false
      return
    }

    // Fetch profiles for beta data
    const profiles = await market.fetchBatchProfiles(tickerList)

    for (const entry of allEntries) {
      const sinceInception = entry.metrics.sinceInception || 0
      entry.metrics.riskAdjusted = computeRiskAdjustedReturn(sinceInception, entry.holdings, profiles)
    }

    groups.value = [...groups.value]
    fundEntries.value = [...fundEntries.value]
  } catch (e) {
    console.error('Failed to compute risk metrics:', e)
  } finally {
    riskMetricsLoading.value = false
  }
}
onUnmounted(() => { if (refreshInterval) clearInterval(refreshInterval) })
</script>
