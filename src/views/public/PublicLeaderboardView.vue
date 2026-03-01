<template>
  <div class="min-h-screen bg-base-200">
    <div class="max-w-4xl mx-auto p-4 space-y-6">
      <!-- Header -->
      <div class="text-center space-y-2 pt-8">
        <h1 class="text-4xl font-bold text-primary">Beat the S&P 500</h1>
        <p class="text-base-content/70">Public Leaderboard &mdash; See who's outperforming the market</p>
        <div class="flex justify-center gap-2 mt-4">
          <RouterLink to="/login" class="btn btn-ghost btn-sm">Log In</RouterLink>
          <RouterLink to="/signup" class="btn btn-primary btn-sm">Sign Up</RouterLink>
        </div>
      </div>

      <!-- Metric Selector Pills -->
      <div class="overflow-x-auto -mx-4 px-4">
        <div class="flex gap-2 whitespace-nowrap justify-center">
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
        <!-- Stats -->
        <div class="stats shadow bg-base-100 w-full">
          <div class="stat">
            <div class="stat-title">Public Portfolios</div>
            <div class="stat-value">{{ portfolios.length }}</div>
          </div>
          <div class="stat">
            <div class="stat-title">Total Investors</div>
            <div class="stat-value">{{ uniqueInvestors }}</div>
          </div>
        </div>

        <!-- Search -->
        <input v-model="search" type="text" placeholder="Search by name or username..." class="input input-bordered w-full" />

        <!-- Benchmark -->
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

        <!-- Leaderboard -->
        <div class="space-y-2">
          <LeaderboardEntry
            v-for="(entry, index) in filteredPortfolios"
            :key="entry.portfolio_id"
            :rank="index + 1"
            :entry="entry"
            :active-metric="activeMetric"
            :is-me="false"
            :benchmark-value="activeBenchmarkValue"
            :metric-loading="isMetricLoading(activeMetric)"
          />

          <p v-if="filteredPortfolios.length === 0" class="text-center text-base-content/50 py-8">No public portfolios found.</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '../../lib/supabase'
import { useMarketDataStore } from '../../stores/marketData'
import { usePortfolioStore } from '../../stores/portfolio'
import LeaderboardEntry from '../../components/LeaderboardEntry.vue'
import {
  reconstructHoldingsAsOf,
  reconstructCashAsOf,
  computePeriodReturn,
  computeTodayReturn,
  computeAnnualizedReturn,
  computeRiskAdjustedReturn
} from '../../utils/leaderboardMetrics'

const market = useMarketDataStore()
const portfolioStore = usePortfolioStore()

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
const portfolios = ref([])
const search = ref('')
const benchmarkMetrics = ref({})
const benchmarkMetricLoading = ref(false)
const periodMetricsLoading = ref(true)
const riskMetricsLoading = ref(true)

const uniqueInvestors = computed(() => {
  const ids = new Set(portfolios.value.map(p => p.owner_id))
  return ids.size
})

const activeBenchmarkValue = computed(() => {
  if (activeMetric.value === 'riskAdjusted') return benchmarkMetrics.value.sinceInception ?? null
  return benchmarkMetrics.value[activeMetric.value] ?? null
})

function isMetricLoading(key) {
  if (['sinceInception', 'today', 'annualized'].includes(key)) return false
  if (key === 'riskAdjusted') return riskMetricsLoading.value
  return periodMetricsLoading.value
}

const sortedPortfolios = computed(() => {
  return [...portfolios.value].sort((a, b) => {
    const aVal = a.metrics?.[activeMetric.value] ?? -Infinity
    const bVal = b.metrics?.[activeMetric.value] ?? -Infinity
    return bVal - aVal
  })
})

const filteredPortfolios = computed(() => {
  if (!search.value) return sortedPortfolios.value
  const q = search.value.toLowerCase()
  return sortedPortfolios.value.filter(p =>
    p.full_name?.toLowerCase().includes(q) ||
    p.username?.toLowerCase().includes(q) ||
    p.group_name?.toLowerCase().includes(q) ||
    p.portfolio_name?.toLowerCase().includes(q)
  )
})

onMounted(async () => {
  const { data: leaderboardData } = await supabase
    .from('public_leaderboard')
    .select('*')

  if (!leaderboardData?.length) {
    loading.value = false
    return
  }

  const portfolioIds = leaderboardData.map(e => e.portfolio_id)

  // Bulk fetch holdings and trades
  const { holdingsMap, tradesMap } = await portfolioStore.getPublicLeaderboardData(portfolioIds)

  // Collect all tickers
  const allTickers = new Set()
  for (const holdings of Object.values(holdingsMap)) {
    for (const h of holdings) allTickers.add(h.ticker)
  }
  allTickers.add('SPY')
  await market.fetchBatchQuotes([...allTickers])

  // Phase 1: instant metrics
  const enriched = []
  for (const entry of leaderboardData) {
    const pHoldings = holdingsMap[entry.portfolio_id] || []
    const cashBalance = Number(entry.cash_balance)
    const startingCash = Number(entry.starting_cash)

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
    const createdAt = entry.created_at || new Date().toISOString()
    const annualized = computeAnnualizedReturn(sinceInception, createdAt)

    enriched.push({
      ...entry,
      totalValue,
      metrics: { sinceInception, today, annualized },
      holdings: pHoldings,
      trades: tradesMap[entry.portfolio_id] || [],
      cashBalance,
      startingCash,
      createdAt
    })
  }

  portfolios.value = enriched

  // SPY benchmark Phase 1
  const spyQuote = market.getCachedQuote('SPY')
  if (spyQuote) {
    // Simple benchmark: use SPY price change as proxy
    const spyPrevClose = spyQuote.previousClose || spyQuote.price
    benchmarkMetrics.value.sinceInception = spyQuote.changesPercentage || 0
    benchmarkMetrics.value.today = spyPrevClose > 0 ? ((spyQuote.price - spyPrevClose) / spyPrevClose) * 100 : 0
    benchmarkMetrics.value.annualized = benchmarkMetrics.value.sinceInception
  }

  loading.value = false

  // Phase 2: background
  computePeriodMetrics(enriched)
  computeRiskMetrics(enriched)
})

async function computePeriodMetrics(entries) {
  try {
    const now = new Date()
    const periodDates = {}
    for (const [key, days] of Object.entries(PERIOD_METRICS)) {
      periodDates[key] = new Date(now.getTime() - days * 86400000).toISOString().split('T')[0]
    }

    const allTickers = new Set()
    for (const entry of entries) {
      for (const h of entry.holdings) allTickers.add(h.ticker)
    }
    allTickers.add('SPY')
    const tickerList = [...allTickers]

    const historicalByDate = {}
    await Promise.all(
      Object.entries(periodDates).map(async ([key, dateStr]) => {
        historicalByDate[key] = await market.fetchHistoricalCloseForTickers(tickerList, dateStr)
      })
    )

    for (const entry of entries) {
      for (const [key, dateStr] of Object.entries(periodDates)) {
        const asOfDate = new Date(dateStr)
        const created = new Date(entry.createdAt)

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
    for (const [key] of Object.entries(periodDates)) {
      const spyPrice = market.getCachedPrice('SPY')
      const spyHistorical = historicalByDate[key]?.SPY
      if (spyPrice && spyHistorical) {
        benchmarkMetrics.value[key] = computePeriodReturn(spyHistorical, spyPrice)
      }
    }

    portfolios.value = [...portfolios.value]
  } catch (e) {
    console.error('Failed to compute period metrics:', e)
  } finally {
    periodMetricsLoading.value = false
  }
}

async function computeRiskMetrics(entries) {
  try {
    const allTickers = new Set()
    for (const entry of entries) {
      for (const h of entry.holdings) allTickers.add(h.ticker)
    }
    const tickerList = [...allTickers]

    if (tickerList.length === 0) {
      riskMetricsLoading.value = false
      return
    }

    const profiles = await market.fetchBatchProfiles(tickerList)

    for (const entry of entries) {
      const sinceInception = entry.metrics.sinceInception || 0
      entry.metrics.riskAdjusted = computeRiskAdjustedReturn(sinceInception, entry.holdings, profiles)
    }

    portfolios.value = [...portfolios.value]
  } catch (e) {
    console.error('Failed to compute risk metrics:', e)
  } finally {
    riskMetricsLoading.value = false
  }
}
</script>
