<template>
  <div class="p-4 space-y-6">
    <div>
      <h1 class="text-xl font-bold">Leaderboard</h1>
      <p class="text-sm text-base-content/60">See how every group is performing</p>
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

    <!-- Comparison Chart -->
    <div v-if="!loading" class="card bg-base-100 shadow-sm">
      <div class="card-body p-4 space-y-3">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex gap-2">
            <button class="btn btn-sm btn-primary btn-disabled">Groups</button>
            <button
              class="btn btn-sm"
              :class="showIndividuals ? 'btn-secondary' : 'btn-ghost'"
              @click="showIndividuals = !showIndividuals"
            >Individuals</button>
          </div>
          <TimeRangeSelector v-model="chartTimeRange" />
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

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <!-- S&P 500 Benchmark -->
      <div class="card bg-primary/10 border border-primary/30">
        <div class="card-body p-4 flex-row justify-between items-center">
          <div>
            <p class="font-semibold text-primary">S&P 500 (SPY) Benchmark</p>
            <p class="text-xs text-base-content/60">The index to beat</p>
          </div>
          <div class="text-right">
            <template v-if="benchmarkMetricLoading">
              <span class="loading loading-dots loading-xs"></span>
            </template>
            <template v-else-if="activeBenchmarkValue === null">
              <span class="text-sm text-base-content/40">N/A</span>
            </template>
            <template v-else>
              <span class="text-lg font-bold text-primary">
                {{ activeBenchmarkValue >= 0 ? '+' : '' }}{{ activeBenchmarkValue.toFixed(2) }}%
              </span>
            </template>
          </div>
        </div>
      </div>

      <!-- Rankings -->
      <div class="space-y-2">
        <LeaderboardEntry
          v-for="(group, index) in sortedGroups"
          :key="group.id"
          :rank="index + 1"
          :entry="group"
          :active-metric="activeMetric"
          :is-me="group.id === myGroupId"
          :benchmark-value="activeBenchmarkValue"
          :metric-loading="isMetricLoading(activeMetric)"
        />
      </div>

      <p v-if="sortedGroups.length === 0" class="text-center text-base-content/50 py-8">No groups found in your class.</p>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { usePortfolioStore } from '../../stores/portfolio'
import { useMarketDataStore } from '../../stores/marketData'
import { supabase } from '../../lib/supabase'
import LeaderboardEntry from '../../components/LeaderboardEntry.vue'
import PortfolioLineChart from '../../components/charts/PortfolioLineChart.vue'
import TimeRangeSelector from '../../components/charts/TimeRangeSelector.vue'
import { getHistoricalDaily } from '../../services/fmpApi'
import {
  reconstructHoldingsAsOf,
  reconstructCashAsOf,
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

const PERIOD_METRICS = {
  d5: 5, d20: 20, d30: 30, d90: 90, y1: 365
}

const activeMetric = ref('sinceInception')
const loading = ref(true)
const groups = ref([])
const myGroupId = ref(null)

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

// Sort by active metric
const sortedGroups = computed(() => {
  return [...groups.value].sort((a, b) => {
    const aVal = a.metrics?.[activeMetric.value] ?? -Infinity
    const bVal = b.metrics?.[activeMetric.value] ?? -Infinity
    return bVal - aVal
  })
})

onMounted(async () => {
  const membership = await auth.getCurrentMembership()
  myGroupId.value = membership?.group_id

  if (!membership?.class_id) {
    loading.value = false
    return
  }

  // Get all groups in this class with member names
  const { data: groupData } = await supabase
    .from('groups')
    .select('*, memberships:class_memberships(user_id, profiles:profiles(full_name))')
    .eq('class_id', membership.class_id)

  if (!groupData?.length) {
    loading.value = false
    return
  }

  const groupIds = groupData.map(g => g.id)

  // Bulk fetch portfolios, holdings, trades
  const { portfolios, holdingsMap, tradesMap } = await portfolioStore.getLeaderboardData(groupIds)

  // Build portfolio lookup by owner_id
  const portfolioByGroup = {}
  for (const p of portfolios) {
    portfolioByGroup[p.owner_id] = p
  }

  // Collect all unique tickers for batch quote fetch
  const allTickers = new Set()
  for (const holdings of Object.values(holdingsMap)) {
    for (const h of holdings) allTickers.add(h.ticker)
  }
  allTickers.add('SPY')

  // Fetch all quotes in one batch
  await market.fetchBatchQuotes([...allTickers])

  // Phase 1: compute instant metrics
  const enriched = []
  for (const group of groupData) {
    const p = portfolioByGroup[group.id]
    const pHoldings = p ? (holdingsMap[p.id] || []) : []
    const startingCash = p ? Number(p.starting_cash) : 100000
    const cashBalance = p ? Number(p.cash_balance) : 100000

    // Current value
    const holdingsValue = pHoldings.reduce((sum, h) => {
      const price = market.getCachedPrice(h.ticker) || Number(h.avg_cost)
      return sum + (Number(h.shares) * price)
    }, 0)
    const totalValue = holdingsValue + cashBalance
    const sinceInception = startingCash > 0 ? ((totalValue - startingCash) / startingCash) * 100 : 0

    // Today's return
    const quotesMap = {}
    for (const h of pHoldings) {
      quotesMap[h.ticker] = market.getCachedQuote(h.ticker)
    }
    const today = computeTodayReturn(pHoldings, quotesMap, cashBalance)

    // Annualized
    const createdAt = p?.created_at || new Date().toISOString()
    const annualized = computeAnnualizedReturn(sinceInception, createdAt)

    enriched.push({
      ...group,
      portfolioId: p?.id,
      totalValue,
      metrics: { sinceInception, today, annualized },
      memberNames: (group.memberships || []).map(m => m.profiles?.full_name?.split(' ')[0]).filter(Boolean),
      holdings: pHoldings,
      trades: p ? (tradesMap[p.id] || []) : [],
      cashBalance,
      startingCash,
      createdAt
    })
  }

  groups.value = enriched

  // Benchmark Phase 1
  const spyQuote = market.getCachedQuote('SPY')
  if (spyQuote) {
    benchmarkMetrics.value.sinceInception = portfolioStore.benchmarkReturnPct
    const spyPrevClose = spyQuote.previousClose || spyQuote.price
    benchmarkMetrics.value.today = spyPrevClose > 0 ? ((spyQuote.price - spyPrevClose) / spyPrevClose) * 100 : 0
    benchmarkMetrics.value.annualized = benchmarkMetrics.value.sinceInception // SPY is already annualized-ish
  }

  loading.value = false

  // Build chart datasets (non-blocking)
  buildChartDatasets(enriched, portfolioByGroup, tradesMap)

  // Phase 2: background — period metrics + risk-adjusted
  computePeriodMetrics(enriched)
  computeRiskMetrics(enriched)
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
  const holdingsMap = {}
  let runningCash = startingCash
  const history = []
  const firstDate = new Date(portfolio.created_at)
  history.push({ date: firstDate, value: startingCash })

  for (const t of trades) {
    const date = new Date(t.executed_at)
    if (t.side === 'buy') {
      runningCash -= Number(t.dollars)
      holdingsMap[t.ticker] = (holdingsMap[t.ticker] || 0) + Number(t.shares)
    } else {
      runningCash += Number(t.dollars)
      holdingsMap[t.ticker] = (holdingsMap[t.ticker] || 0) - Number(t.shares)
    }
    let holdingsValue = 0
    for (const [ticker, shares] of Object.entries(holdingsMap)) {
      if (shares <= 0) continue
      const price = t.ticker === ticker ? Number(t.price) : (market.getCachedPrice(ticker) || 0)
      holdingsValue += shares * price
    }
    history.push({ date, value: runningCash + holdingsValue })
  }
  return history
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
        const cashBalance = Number(p.cash_balance) || startingCash
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

async function computePeriodMetrics(entries) {
  try {
    const now = new Date()
    const periodDates = {}
    for (const [key, days] of Object.entries(PERIOD_METRICS)) {
      periodDates[key] = new Date(now.getTime() - days * 86400000).toISOString().split('T')[0]
    }

    // Collect all unique tickers across all entries
    const allTickers = new Set()
    for (const entry of entries) {
      for (const h of entry.holdings) allTickers.add(h.ticker)
    }
    allTickers.add('SPY')
    const tickerList = [...allTickers]

    // Fetch historical prices for each period date
    const historicalByDate = {}
    await Promise.all(
      Object.entries(periodDates).map(async ([key, dateStr]) => {
        historicalByDate[key] = await market.fetchHistoricalCloseForTickers(tickerList, dateStr)
      })
    )

    // Compute period returns for each entry
    for (const entry of entries) {
      for (const [key, dateStr] of Object.entries(periodDates)) {
        const asOfDate = new Date(dateStr)
        const created = new Date(entry.createdAt)

        // Portfolio too young for this period
        if (created > asOfDate) {
          entry.metrics[key] = null
          continue
        }

        const pastHoldings = reconstructHoldingsAsOf(entry.holdings, entry.trades, asOfDate)
        const pastCash = reconstructCashAsOf(entry.cashBalance, entry.trades, asOfDate)
        const historicalPrices = historicalByDate[key]

        const pastValue = pastHoldings.reduce((sum, h) => {
          const price = historicalPrices[h.ticker] || 0
          return sum + (h.shares * price)
        }, 0) + pastCash

        entry.metrics[key] = computePeriodReturn(pastValue, entry.totalValue)
      }
    }

    // SPY benchmark period returns
    for (const [key, dateStr] of Object.entries(periodDates)) {
      const spyPrice = market.getCachedPrice('SPY')
      const spyHistorical = historicalByDate[key]?.SPY
      if (spyPrice && spyHistorical) {
        benchmarkMetrics.value[key] = computePeriodReturn(spyHistorical, spyPrice)
      }
    }

    // Trigger reactivity
    groups.value = [...groups.value]
  } catch (e) {
    console.error('Failed to compute period metrics:', e)
  } finally {
    periodMetricsLoading.value = false
  }
}

async function computeRiskMetrics(entries) {
  try {
    // Collect all unique tickers
    const allTickers = new Set()
    for (const entry of entries) {
      for (const h of entry.holdings) allTickers.add(h.ticker)
    }
    const tickerList = [...allTickers]

    if (tickerList.length === 0) {
      riskMetricsLoading.value = false
      return
    }

    // Fetch profiles for beta data
    const profiles = await market.fetchBatchProfiles(tickerList)

    for (const entry of entries) {
      const sinceInception = entry.metrics.sinceInception || 0
      entry.metrics.riskAdjusted = computeRiskAdjustedReturn(sinceInception, entry.holdings, profiles)
    }

    groups.value = [...groups.value]
  } catch (e) {
    console.error('Failed to compute risk metrics:', e)
  } finally {
    riskMetricsLoading.value = false
  }
}
</script>
