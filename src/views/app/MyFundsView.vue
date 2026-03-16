<template>
  <div v-if="loading" class="flex justify-center py-20">
    <span class="loading loading-spinner loading-lg"></span>
  </div>

  <div v-else class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
        Group Funds
      </h1>
    </div>

    <div v-if="groupEnriched.length > 0" class="card border border-secondary/20 bg-secondary/5 shadow-sm">
      <div class="card-body p-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="font-semibold text-base">Open A Fund To Trade</h2>
            <p class="text-sm text-base-content/65">Use the Open button for a group fund to see its holdings, then buy more or sell from that fund.</p>
          </div>
          <div class="text-sm text-base-content/55">
            Trading is always tied to the specific fund you open.
          </div>
        </div>
      </div>
    </div>

    <div v-if="groupEnriched.length === 0" class="text-center py-10 text-base-content/50">
      <p class="text-lg">No funds yet.</p>
      <p class="text-sm mt-1">Start investing from the home page!</p>
    </div>

    <!-- Funds overview table -->
    <div v-if="groupEnriched.length > 0" class="card bg-base-100 shadow">
      <div class="card-body p-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            Fund Summary
          </h3>
          <span v-if="groupEnriched.length > 0" class="text-xs uppercase tracking-wide text-base-content/45">Group {{ groupName }}</span>
        </div>
        <div class="overflow-x-auto">
          <table class="table table-sm table-zebra">
            <thead>
              <tr>
                <th>Fund</th>
                <th>Type</th>
                <th class="text-right">Starting</th>
                <th class="text-right">Current</th>
                <th class="text-right">Return</th>
                <th class="text-right">vs Benchmark</th>
                <th class="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="fund in groupEnriched" :key="fund.id">
                <td class="font-semibold">
                  <div>{{ fund.fund_name || 'Fund ' + (fund.fund_number || 1) }}</div>
                  <div class="text-xs text-base-content/45">{{ fund.fund_thesis || 'Group fund' }}</div>
                </td>
                <td><span class="badge badge-xs badge-secondary">Fund {{ fund.fund_number || 1 }}</span></td>
                <td class="text-right font-mono">${{ Number(fund.starting_cash || 100000).toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</td>
                <td class="text-right font-mono">${{ fund._totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</td>
                <td class="text-right font-mono" :class="fund._returnPct >= 0 ? 'text-success' : 'text-error'">
                  {{ fund._returnPct >= 0 ? '+' : '' }}{{ fund._returnPct.toFixed(2) }}%
                </td>
                <td class="text-right font-mono" :class="fund._vsSpy >= 0 ? 'text-success' : 'text-error'">
                  {{ fund._vsSpy >= 0 ? '+' : '' }}{{ fund._vsSpy.toFixed(2) }}%
                </td>
                <td class="text-right">
                  <button
                    class="btn btn-xs"
                    :class="selectedFundId === fund.id ? 'btn-secondary' : 'btn-outline'"
                    @click="toggleFund(fund)"
                  >
                    {{ selectedFundId === fund.id ? 'Hide' : 'Open' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="selectedFundCard" class="card bg-base-100 shadow">
      <div class="card-body p-4 space-y-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-semibold">{{ selectedFundCard.fund_name || `Fund ${selectedFundCard.fund_number || 1}` }}</h3>
              <span class="badge badge-secondary badge-sm">Fund {{ selectedFundCard.fund_number || 1 }}</span>
            </div>
            <p class="mt-1 text-sm text-base-content/60">{{ selectedFundCard.fund_thesis || 'Group fund' }}</p>
          </div>
          <div class="grid grid-cols-2 gap-3 text-sm lg:min-w-[320px]">
            <div class="rounded-xl border border-base-300 bg-base-200/40 p-3">
              <div class="text-xs uppercase tracking-wide text-base-content/45">Current Value</div>
              <div class="mt-1 font-mono text-lg font-semibold">${{ selectedFundCard._totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</div>
            </div>
            <div class="rounded-xl border border-base-300 bg-base-200/40 p-3">
              <div class="text-xs uppercase tracking-wide text-base-content/45">Return</div>
              <div class="mt-1 font-mono text-lg font-semibold" :class="selectedFundCard._returnPct >= 0 ? 'text-success' : 'text-error'">
                {{ selectedFundCard._returnPct >= 0 ? '+' : '' }}{{ selectedFundCard._returnPct.toFixed(2) }}%
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <RouterLink :to="{ path: '/stocks', query: { fund: selectedFundCard.id } }" class="btn btn-primary btn-sm">Browse Stocks For This Fund</RouterLink>
          <RouterLink :to="{ path: '/screener', query: { fund: selectedFundCard.id } }" class="btn btn-outline btn-sm">Advanced Screener</RouterLink>
        </div>

        <div v-if="selectedFundLoading" class="flex justify-center py-6">
          <span class="loading loading-spinner loading-md"></span>
        </div>

        <div v-else-if="selectedFundDetails">
          <div v-if="selectedFundDetails.holdings.length === 0" class="rounded-xl border border-dashed border-base-300 p-6 text-center text-base-content/55">
            <p class="font-medium">No holdings in this fund yet.</p>
            <p class="mt-1 text-sm">Use the buttons above to buy the first investment for this specific fund.</p>
          </div>

          <div v-else class="space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="font-semibold">Current Holdings</h4>
              <div class="text-xs text-base-content/50">Buy and sell below stay inside this fund.</div>
            </div>
            <div class="overflow-x-auto">
              <table class="table table-sm table-zebra">
                <thead>
                  <tr>
                    <th>Stock</th>
                    <th>Sector</th>
                    <th class="text-right">Shares</th>
                    <th class="text-right">Price</th>
                    <th class="text-right">Value</th>
                    <th class="text-right">Gain/Loss</th>
                    <th class="text-center">Trade</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="holding in selectedFundDetails.holdings" :key="holding.ticker">
                    <td>
                      <RouterLink :to="stockDetailLocation(holding.ticker, { fund: selectedFundCard.id })" class="flex items-center gap-3 group">
                        <div class="avatar">
                          <div class="w-9 rounded bg-base-200 flex items-center justify-center overflow-hidden border border-base-300">
                            <img v-if="holding.image" :src="holding.image" :alt="holding.ticker" />
                            <span v-else class="text-[10px] font-bold text-base-content/40">{{ holding.ticker }}</span>
                          </div>
                        </div>
                        <div>
                          <div class="font-mono font-bold group-hover:text-primary transition-colors">{{ holding.ticker }}</div>
                          <div class="text-xs text-base-content/50">{{ holding.companyName || '' }}</div>
                        </div>
                      </RouterLink>
                    </td>
                    <td class="text-xs text-base-content/70">
                      <SectorLabel :sector="holding.sector" size="xs" />
                    </td>
                    <td class="text-right font-mono">{{ Number(holding.shares).toFixed(2) }}</td>
                    <td class="text-right font-mono">${{ holding.currentPrice.toFixed(2) }}</td>
                    <td class="text-right font-mono font-semibold">${{ holding.marketValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</td>
                    <td class="text-right font-mono" :class="holding.gainLoss >= 0 ? 'text-success' : 'text-error'">
                      {{ holding.gainLoss >= 0 ? '+' : '' }}{{ holding.gainLossPct.toFixed(2) }}%
                    </td>
                    <td class="text-center">
                      <div class="flex items-center justify-center gap-1">
                        <RouterLink :to="stockDetailLocation(holding.ticker, { fund: selectedFundCard.id, mode: 'buy' })" class="btn btn-ghost btn-xs text-success px-1 hover:bg-success/10" title="Buy more">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>
                        </RouterLink>
                        <RouterLink :to="stockDetailLocation(holding.ticker, { fund: selectedFundCard.id, mode: 'sell' })" class="btn btn-ghost btn-xs text-error px-1 hover:bg-error/10" title="Sell shares">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" /></svg>
                        </RouterLink>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- All Funds Comparison Chart -->
    <div v-if="comparisonDatasets.length > 0" class="card bg-base-100 shadow">
      <div class="card-body p-4">
        <h3 class="font-semibold mb-2 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
          All Funds vs {{ comparisonBenchmarkLabel }}
        </h3>
        <PortfolioLineChart
          :datasets="comparisonDatasets"
          :show-percentage="true"
          height="250px"
        />
      </div>
    </div>

    <!-- Multi-Period Performance Table -->
    <div v-if="periodPerformance.length > 0" class="card bg-base-100 shadow">
      <div class="card-body p-4">
        <h3 class="font-semibold mb-2 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          Performance by Period
        </h3>
        <div class="overflow-x-auto">
          <table class="table table-sm table-zebra">
            <thead>
              <tr>
                <th>Fund</th>
                <th v-for="p in periods" :key="p.key" class="text-right">{{ p.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in periodPerformance" :key="row.fundId">
                <td class="font-semibold">{{ row.fundName }}</td>
                <td v-for="p in periods" :key="p.key" class="text-right">
                  <template v-if="row[p.key] != null">
                    <div class="font-mono text-sm" :class="row[p.key] >= 0 ? 'text-success' : 'text-error'">
                      {{ row[p.key] >= 0 ? '+' : '' }}{{ row[p.key].toFixed(2) }}%
                    </div>
                    <div class="font-mono text-xs" :class="row[p.key + '_vs'] >= 0 ? 'text-success/60' : 'text-error/60'">
                      {{ row[p.key + '_vs'] >= 0 ? '+' : '' }}{{ row[p.key + '_vs']?.toFixed(2) }}% vs SPY
                    </div>
                  </template>
                  <span v-else class="text-base-content/30 text-xs">—</span>
                </td>
              </tr>
              <!-- SPY row -->
              <tr class="opacity-60">
                <td class="font-semibold">S&P 500 (SPY)</td>
                <td v-for="p in periods" :key="p.key" class="text-right">
                  <div v-if="spyPeriodReturns[p.key] != null" class="font-mono text-sm" :class="spyPeriodReturns[p.key] >= 0 ? 'text-success' : 'text-error'">
                    {{ spyPeriodReturns[p.key] >= 0 ? '+' : '' }}{{ spyPeriodReturns[p.key].toFixed(2) }}%
                  </div>
                  <span v-else class="text-base-content/30 text-xs">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { usePortfolioStore } from '../../stores/portfolio'
import { useAuthStore } from '../../stores/auth'
import { useMarketDataStore } from '../../stores/marketData'
import PortfolioLineChart from '../../components/charts/PortfolioLineChart.vue'
import SectorLabel from '../../components/SectorLabel.vue'
import { supabase } from '../../lib/supabase'
import { getHistoricalDaily } from '../../services/fmpApi'
import { reconstructHoldingsAsOf, reconstructCashAsOf } from '../../utils/leaderboardMetrics'

const portfolioStore = usePortfolioStore()
const auth = useAuthStore()
const market = useMarketDataStore()

const loading = ref(true)
const groupEnriched = ref([])
const comparisonDatasets = ref([])
const comparisonBenchmarkLabel = ref('SPY')
const groupName = ref('')
const selectedFundId = ref(null)
const selectedFundLoading = ref(false)
const selectedFundDetails = ref(null)

const selectedFundCard = computed(() =>
  groupEnriched.value.find(fund => fund.id === selectedFundId.value) || null
)

async function enrichFund(fund) {
  const valueData = await portfolioStore.getPortfolioValueById(fund.id)
  const startCash = Number(fund.starting_cash || 100000)
  const totalValue = valueData.value
  const returnPct = valueData.returnPct

  // Get benchmark return for this fund
  const { data: bmHoldings } = await supabase
    .from('benchmark_holdings')
    .select('*')
    .eq('portfolio_id', fund.id)

  const { data: bmTrades } = await supabase
    .from('benchmark_trades')
    .select('*')
    .eq('portfolio_id', fund.id)

  let bmValue = startCash
  if (bmHoldings?.length > 0) {
    const bmTicker = fund.benchmark_ticker || 'SPY'
    const bmPrice = market.getCachedPrice(bmTicker)
    if (bmPrice) {
      const totalBmInvested = (bmTrades || []).reduce((sum, t) => sum + (t.side === 'buy' ? Number(t.dollars) : -Number(t.dollars)), 0)
      const bmCash = startCash - totalBmInvested
      const holdingsVal = bmHoldings.reduce((sum, h) => sum + (Number(h.shares) * bmPrice), 0)
      bmValue = holdingsVal + bmCash
    }
  }
  const bmReturnPct = ((bmValue - startCash) / startCash) * 100

  return {
    _totalValue: totalValue,
    _returnPct: returnPct,
    _bmReturnPct: bmReturnPct,
    _vsSpy: returnPct - bmReturnPct,
    _benchmarkLabel: fund.benchmark_ticker || 'SPY'
  }
}

function stockDetailLocation(ticker, query = {}) {
  return { path: `/stocks/${ticker}`, query }
}

function toggleFund(fund) {
  if (selectedFundId.value === fund.id) {
    selectedFundId.value = null
    selectedFundDetails.value = null
    return
  }

  selectedFundId.value = fund.id
  loadSelectedFundDetails(fund)
}

async function loadSelectedFundDetails(fund) {
  selectedFundLoading.value = true
  selectedFundDetails.value = null

  try {
    const { data: holdingsData } = await supabase
      .from('holdings')
      .select('ticker, shares, avg_cost')
      .eq('portfolio_id', fund.id)

    const tickers = [...new Set((holdingsData || []).map(h => h.ticker).filter(Boolean))]
    if (tickers.length > 0) {
      await market.fetchBatchQuotes(tickers)
      try {
        await market.fetchBatchProfiles(tickers)
      } catch (e) {
        console.warn('Failed to fetch selected fund profiles', e)
      }
    }

    const holdings = (holdingsData || []).map(h => {
      const shares = Number(h.shares) || 0
      const avgCost = Number(h.avg_cost) || 0
      const currentPrice = market.getCachedPrice(h.ticker) || avgCost || 0
      const marketValue = shares * currentPrice
      const costBasis = shares * avgCost
      const gainLoss = marketValue - costBasis
      const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0
      const profile = market.profilesCache?.[h.ticker]?.data

      return {
        ...h,
        shares,
        currentPrice,
        marketValue,
        gainLoss,
        gainLossPct,
        companyName: profile?.companyName || profile?.name || null,
        image: profile?.image || null,
        sector: profile?.sector || 'Unknown'
      }
    }).sort((a, b) => b.marketValue - a.marketValue)

    selectedFundDetails.value = { holdings }
  } finally {
    selectedFundLoading.value = false
  }
}

onMounted(async () => {
  try {
    // Load group funds if user is in a class with a group
    const membership = await auth.getCurrentMembership()
    if (membership?.group_id) {
      groupName.value = membership.group?.name || 'My Group'
      const gFunds = await portfolioStore.loadGroupFunds(membership.group_id)
      const enriched = []
      for (const fund of gFunds) {
        const data = await enrichFund(fund)
        enriched.push({ ...fund, _ownerType: 'group', ...data })
      }
      groupEnriched.value = enriched
      if (enriched.length === 1) {
        selectedFundId.value = enriched[0].id
        await loadSelectedFundDetails(enriched[0])
      }
    }

    // Build comparison chart
    await buildComparisonChart()

    // Load period performance (non-blocking)
    loadPeriodPerformance()
  } finally {
    loading.value = false
  }
})

const FUND_COLORS = ['primary', 'secondary', 'accent', 'info', 'success', 'warning']

async function buildComparisonChart() {
  const datasets = []
  const benchmarkTickers = new Set()
  let colorIdx = 0

  // Add group funds
  for (const fund of groupEnriched.value) {
    const startCash = Number(fund.starting_cash || 100000)
    const synth = generateSyntheticHistory(fund.created_at, null, startCash, fund._totalValue, fund.id)
    const label = `${groupName.value}: ${fund.fund_name || 'Fund ' + (fund.fund_number || 1)}`
    datasets.push({
      label,
      data: synth,
      color: FUND_COLORS[colorIdx++ % FUND_COLORS.length],
      baseline: startCash
    })
    benchmarkTickers.add(fund._benchmarkLabel || 'SPY')
  }

  if (datasets.length === 0) {
    comparisonDatasets.value = []
    comparisonBenchmarkLabel.value = 'SPY'
    return
  }

  const funds = [...groupEnriched.value]
  const firstItem = funds[0]
  const fromStr = new Date(firstItem.created_at).toISOString().slice(0, 10)
  const toStr = new Date().toISOString().slice(0, 10)
  const benchmarkList = [...benchmarkTickers].filter(Boolean)

  comparisonBenchmarkLabel.value = benchmarkList.length === 1 ? benchmarkList[0] : 'Benchmarks'

  for (const ticker of benchmarkList) {
    const rawHistory = await getHistoricalDaily(ticker, fromStr, toStr)
    if (!Array.isArray(rawHistory) || rawHistory.length === 0) continue

    const normalized = rawHistory
      .map(item => ({
        date: new Date(item.date),
        close: Number(item.close ?? item.adjClose ?? item.price)
      }))
      .filter(item => !Number.isNaN(item.date.getTime()) && Number.isFinite(item.close))
      .sort((a, b) => a.date - b.date)
      .map((item, index, arr) => ({
        date: item.date,
        value: 100000 * (item.close / arr[0].close)
      }))

    if (normalized.length === 0) continue

    datasets.push({
      label: ticker,
      data: normalized,
      color: 'sp500',
      baseline: 100000
    })
  }

  comparisonDatasets.value = datasets
}

// --- Multi-period performance ---
const periods = [
  { key: '1d', label: '1 Day', days: 1 },
  { key: '1w', label: '1 Week', days: 7 },
  { key: '1m', label: '1 Month', days: 30 },
  { key: '3m', label: '3 Months', days: 90 },
  { key: 'ytd', label: 'YTD', days: null },
  { key: 'all', label: 'Since Inception', days: null },
]

const periodPerformance = ref([])
const spyPeriodReturns = ref({})

function getDateNDaysAgo(n) {
  return new Date(Date.now() - n * 86400000)
}

function getYTDStart() {
  const now = new Date()
  return new Date(now.getFullYear(), 0, 1)
}

async function loadPeriodPerformance() {
  // Collect all fund IDs and their data
  const fundList = []
  for (const fund of groupEnriched.value) {
    fundList.push({ id: fund.id, name: fund.fund_name || `Fund ${fund.fund_number || 1}`, createdAt: fund.created_at })
  }
  if (fundList.length === 0) return

  // For each fund, load holdings + trades to reconstruct past values
  const rows = []
  const spyReturns = {}

  // Fetch SPY historical prices for period calculations
  const earliestCreated = fundList.reduce((min, f) => {
    const d = new Date(f.createdAt)
    return d < min ? d : min
  }, new Date())
  const fromStr = new Date(earliestCreated.getTime() - 400 * 86400000).toISOString().split('T')[0]
  const toStr = new Date().toISOString().split('T')[0]

  let spyHistory = []
  try {
    const raw = await getHistoricalDaily('SPY', fromStr, toStr)
    spyHistory = (raw || []).map(d => ({ date: d.date, close: Number(d.close ?? d.adjClose) })).sort((a, b) => new Date(a.date) - new Date(b.date))
  } catch (e) { /* ignore */ }

  function getSpyPriceNear(targetDate) {
    const target = targetDate.getTime()
    let best = null
    for (const d of spyHistory) {
      const dt = new Date(d.date).getTime()
      if (dt <= target) best = d.close
    }
    return best
  }

  const spyNow = spyHistory.length > 0 ? spyHistory[spyHistory.length - 1].close : null

  // Calculate SPY returns for each period
  for (const p of periods) {
    if (!spyNow) continue
    let startDate
    if (p.key === 'ytd') startDate = getYTDStart()
    else if (p.key === 'all') continue // no SPY "since inception" — each fund differs
    else startDate = getDateNDaysAgo(p.days)

    const spyStart = getSpyPriceNear(startDate)
    if (spyStart && spyStart > 0) {
      spyReturns[p.key] = ((spyNow / spyStart) - 1) * 100
    }
  }
  spyPeriodReturns.value = spyReturns

  // For each fund, compute returns per period
  for (const fund of fundList) {
    const { data: holdings } = await supabase.from('holdings').select('*').eq('portfolio_id', fund.id)
    const { data: trades } = await supabase.from('trades').select('*').eq('portfolio_id', fund.id).order('executed_at', { ascending: false })
    const { data: pf } = await supabase.from('portfolios').select('cash_balance, starting_cash').eq('id', fund.id).single()

    const currentHoldings = holdings || []
    const allTrades = trades || []
    const currentCash = pf?.cash_balance != null ? Number(pf.cash_balance) : Number(pf?.starting_cash || 100000)
    const startingCash = Number(pf?.starting_cash || 100000)

    // Current portfolio value
    const tickers = currentHoldings.map(h => h.ticker)
    if (tickers.length > 0) await market.fetchBatchQuotes(tickers)
    const currentValue = currentHoldings.reduce((sum, h) => sum + (Number(h.shares) * (market.getCachedPrice(h.ticker) || 0)), 0) + currentCash

    const row = { fundId: fund.id, fundName: fund.name }

    for (const p of periods) {
      let asOfDate
      if (p.key === 'ytd') asOfDate = getYTDStart()
      else if (p.key === 'all') asOfDate = new Date(fund.createdAt)
      else asOfDate = getDateNDaysAgo(p.days)

      // Skip if fund didn't exist yet
      if (new Date(fund.createdAt) > asOfDate && p.key !== 'all') {
        row[p.key] = null
        row[p.key + '_vs'] = null
        continue
      }

      if (p.key === 'all') {
        // Since inception = current total return
        const ret = startingCash > 0 ? ((currentValue - startingCash) / startingCash) * 100 : 0
        // SPY since inception
        const spyStart = getSpyPriceNear(new Date(fund.createdAt))
        const spyRet = spyStart && spyNow ? ((spyNow / spyStart) - 1) * 100 : 0
        row[p.key] = ret
        row[p.key + '_vs'] = ret - spyRet
        continue
      }

      // Reconstruct portfolio value at period start
      const pastHoldings = reconstructHoldingsAsOf(currentHoldings, allTrades, asOfDate)
      const pastCash = reconstructCashAsOf(currentCash, allTrades, asOfDate)

      // Get historical prices for past holdings
      let pastValue = pastCash
      for (const h of pastHoldings) {
        const dateStr = asOfDate.toISOString().split('T')[0]
        let price = 0
        try {
          const hist = await market.fetchHistoricalCloseForTickers([h.ticker], dateStr)
          price = hist[h.ticker] || 0
        } catch (e) { /* ignore */ }
        pastValue += h.shares * price
      }

      // If past value is 0 (no holdings and no cash), use starting cash
      if (pastValue <= 0) pastValue = startingCash

      const ret = pastValue > 0 ? ((currentValue - pastValue) / pastValue) * 100 : 0
      const spyRet = spyReturns[p.key] || 0
      row[p.key] = ret
      row[p.key + '_vs'] = ret - spyRet
    }

    rows.push(row)
  }

  periodPerformance.value = rows
}

function generateSyntheticHistory(startDate, endDate, startValue, endValue, seed) {
  const start = new Date(startDate)
  const end = new Date(endDate || new Date())
  const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)))
  const points = []
  let rng = seed ? parseInt(String(seed).replace(/-/g, '').slice(0, 8), 16) : 12345
  for (let i = 0; i <= Math.min(days, 180); i++) {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff
    const noise = ((rng >>> 0) / 0xffffffff - 0.5) * 0.003
    const t = i / Math.max(days, 1)
    const value = startValue + (endValue - startValue) * t + noise * startValue
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    points.push({ date, value })
  }
  return points
}
</script>
