<template>
  <div class="space-y-6">

    <!-- Hero Section -->
    <div class="card bg-gradient-to-br from-primary/20 to-secondary/10 border border-primary/30 shadow-lg">
      <div class="card-body p-6 md:p-8">
        <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight">S&P 500 — The Benchmark</h1>
        <p class="text-base-content/70 max-w-2xl mt-1">
          The S&P 500 tracks 500 of the largest US companies. We use <span class="font-bold text-primary">SPY</span>, an ETF that mirrors the index, as your benchmark.
        </p>

        <!-- Live SPY stats -->
        <div v-if="spyQuote" class="stats stats-horizontal shadow bg-base-100 w-full mt-4 overflow-x-auto">
          <div class="stat py-2 px-4">
            <div class="stat-title text-xs">SPY Price</div>
            <div class="stat-value text-lg">${{ spyQuote.price?.toFixed(2) }}</div>
          </div>
          <div class="stat py-2 px-4">
            <div class="stat-title text-xs">1-Day Change</div>
            <div class="stat-value text-lg" :class="spyQuote.changesPercentage >= 0 ? 'text-success' : 'text-error'">
              {{ spyQuote.changesPercentage >= 0 ? '+' : '' }}{{ spyQuote.changesPercentage?.toFixed(2) }}%
            </div>
          </div>
          <div class="stat py-2 px-4">
            <div class="stat-title text-xs">YTD Return</div>
            <div class="stat-value text-lg" :class="ytdReturn >= 0 ? 'text-success' : 'text-error'">
              {{ ytdReturn >= 0 ? '+' : '' }}{{ ytdReturn?.toFixed(2) }}%
            </div>
          </div>
          <div class="stat py-2 px-4">
            <div class="stat-title text-xs">P/E Ratio</div>
            <div class="stat-value text-lg">{{ spyQuote.pe?.toFixed(1) || 'N/A' }}</div>
          </div>
          <div class="stat py-2 px-4">
            <div class="stat-title text-xs">Market Cap</div>
            <div class="stat-value text-lg">{{ formatMarketCap(spyQuote.marketCap) }}</div>
          </div>
        </div>
        <div v-else class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    </div>

    <!-- Historical SPY Performance Chart -->
    <div class="card bg-base-100 shadow">
      <div class="card-body p-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <h2 class="font-bold text-lg flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
            SPY Performance
          </h2>
          <TimeRangeSelector v-model="chartRange" />
        </div>
        <div v-if="spyChartDatasets.length" class="mt-2">
          <PortfolioLineChart :datasets="spyChartDatasets" :time-range="chartRange" show-percentage height="260px" />
        </div>
        <div v-else class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    </div>

    <!-- Sector Breakdown -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Pie chart -->
      <div class="lg:col-span-1">
        <PortfolioPieChart v-if="sectorSegments.length" :segments="sectorSegments" title="S&P 500 Sectors" height="280px" />
        <div v-else class="card bg-base-100 shadow h-full flex items-center justify-center py-12">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      </div>

      <!-- Sector cards -->
      <div class="lg:col-span-2">
        <h2 class="font-bold text-lg mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
          Sector Breakdown
        </h2>
        <div v-if="sectorDetails.length" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div v-for="sector in sectorDetails" :key="sector.name" class="card bg-base-100 shadow-sm border border-base-300">
            <div class="card-body p-3">
              <div class="flex justify-between items-start">
                <h3 class="font-semibold text-sm"><SectorLabel :sector="sector.name" size="xs" /></h3>
                <span class="badge badge-primary badge-sm">{{ sector.weight.toFixed(1) }}%</span>
              </div>
              <p class="text-xs text-base-content/50 mt-1">{{ sector.count }} companies</p>
              <div class="flex flex-wrap gap-1 mt-1">
                <span v-for="h in sector.topHoldings" :key="h" class="badge badge-ghost badge-xs">{{ h }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    </div>

    <!-- Key Stats -->
    <div>
      <h2 class="font-bold text-lg mb-3 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
        Key Stats
      </h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body p-3 items-center text-center">
            <div class="text-2xl font-bold text-primary">{{ constituentsCount }}</div>
            <div class="text-xs text-base-content/60">Companies</div>
          </div>
        </div>
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body p-3 items-center text-center">
            <div class="text-2xl font-bold text-primary">{{ sectorDetails.length }}</div>
            <div class="text-xs text-base-content/60">Sectors</div>
          </div>
        </div>
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body p-3 items-center text-center">
            <div class="text-2xl font-bold text-primary">{{ top10Weight.toFixed(1) }}%</div>
            <div class="text-xs text-base-content/60">Top 10 Weight</div>
          </div>
        </div>
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body p-3 items-center text-center">
            <div class="text-2xl font-bold text-primary">{{ spyQuote?.pe?.toFixed(1) || '—' }}</div>
            <div class="text-xs text-base-content/60">P/E Ratio</div>
          </div>
        </div>
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body p-3 items-center text-center">
            <div class="text-2xl font-bold text-primary">{{ formatMarketCap(spyQuote?.marketCap) }}</div>
            <div class="text-xs text-base-content/60">Total Mkt Cap</div>
          </div>
        </div>
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body p-3 items-center text-center">
            <div class="text-2xl font-bold text-primary">{{ spyProfile?.lastDiv?.toFixed(2) || '—' }}%</div>
            <div class="text-xs text-base-content/60">Dividend Yield</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Constituents Table -->
    <div class="card bg-base-100 shadow">
      <div class="card-body p-4">
        <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 class="font-bold text-lg flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            All Constituents
          </h2>
          <input v-model="searchQuery" type="text" placeholder="Search ticker or company..." class="input input-sm input-bordered w-60" />
        </div>

        <div class="overflow-x-auto">
          <table class="table table-sm table-zebra">
            <thead>
              <tr>
                <th class="cursor-pointer" @click="toggleSort('rank')">#</th>
                <th class="cursor-pointer" @click="toggleSort('symbol')">Ticker</th>
                <th class="cursor-pointer" @click="toggleSort('name')">Company</th>
                <th>Sector</th>
                <th class="cursor-pointer text-right" @click="toggleSort('weightPercentage')">Weight %</th>
                <th class="cursor-pointer text-right" @click="toggleSort('price')">Price</th>
                <th class="cursor-pointer text-right" @click="toggleSort('changesPercentage')">1D Chg %</th>
                <th class="cursor-pointer text-right" @click="toggleSort('marketCap')">Mkt Cap</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(stock, i) in visibleConstituents" :key="stock.symbol" class="hover">
                <td class="text-base-content/50">{{ i + 1 }}</td>
                <td>
                  <RouterLink :to="`/stocks/${stock.symbol}`" class="flex items-center gap-3 group">
                    <div class="avatar">
                      <div class="w-8 h-8 rounded bg-base-200 flex items-center justify-center overflow-hidden border border-base-300">
                        <img v-if="market.profilesCache[stock.symbol]?.data?.image" :src="market.profilesCache[stock.symbol].data.image" :alt="stock.symbol" />
                        <span v-else class="text-[10px] font-bold text-base-content/20">{{ stock.symbol }}</span>
                      </div>
                    </div>
                    <span class="link link-primary font-mono font-semibold group-hover:text-primary-focus transition-colors">{{ stock.symbol }}</span>
                  </RouterLink>
                </td>
                <td class="max-w-[200px] truncate">{{ stock.name }}</td>
                <td class="text-xs">
                  <SectorLabel v-if="stock.sector" :sector="stock.sector" size="xs" />
                  <span v-else>—</span>
                </td>
                <td class="text-right font-mono">{{ stock.weightPercentage?.toFixed(2) }}%</td>
                <td class="text-right font-mono">${{ stock.price?.toFixed(2) || '—' }}</td>
                <td class="text-right font-mono" :class="(stock.changesPercentage || 0) >= 0 ? 'text-success' : 'text-error'">
                  {{ stock.changesPercentage != null ? ((stock.changesPercentage >= 0 ? '+' : '') + stock.changesPercentage.toFixed(2) + '%') : '—' }}
                </td>
                <td class="text-right font-mono">{{ formatMarketCap(stock.marketCap) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="filteredConstituents.length > displayCount" class="flex justify-center mt-4">
          <button class="btn btn-primary btn-sm" @click="displayCount += 50">
            Load more ({{ filteredConstituents.length - displayCount }} remaining)
          </button>
        </div>
        <p v-if="!constituents.length" class="text-center py-8 text-base-content/50">
          <span class="loading loading-spinner loading-lg"></span>
        </p>
      </div>
    </div>

    <!-- How SPY Works Explainer -->
    <div>
      <h2 class="font-bold text-lg mb-3 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        How SPY Works
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="card in explainerCards" :key="card.title" class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body p-4">
            <div class="text-2xl mb-1">{{ card.icon }}</div>
            <h3 class="font-bold text-sm">{{ card.title }}</h3>
            <p class="text-xs text-base-content/70 leading-relaxed">{{ card.body }}</p>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import PortfolioLineChart from '../../components/charts/PortfolioLineChart.vue'
import PortfolioPieChart from '../../components/charts/PortfolioPieChart.vue'
import TimeRangeSelector from '../../components/charts/TimeRangeSelector.vue'
import SectorLabel from '../../components/SectorLabel.vue'
import { useMarketDataStore } from '../../stores/marketData'
import {
  getQuote,
  getCompanyProfile,
  getHistoricalDaily,
  getSPYHoldings,
  getSP500Constituents,
  getBatchProfiles,
  getBatchQuotes
} from '../../services/fmpApi.js'

// --- State ---
const market = useMarketDataStore()
const spyQuote = ref(null)
const spyProfile = ref(null)
const ytdReturn = ref(0)
const chartRange = ref('1Y')
const spyHistory = ref([])
const holdings = ref([])
const constituents = ref([])
const searchQuery = ref('')
const displayCount = ref(50)
const sortKey = ref('weightPercentage')
const sortAsc = ref(false)

// --- Computed ---
const spyChartDatasets = computed(() => {
  if (!spyHistory.value.length) return []
  return [{
    label: 'SPY',
    color: 'primary',
    data: spyHistory.value.map(d => ({ date: new Date(d.date), value: d.close }))
  }]
})

const sectorMap = computed(() => {
  const map = {}
  for (const h of holdings.value) {
    const sector = h.sector || 'Other'
    if (!map[sector]) map[sector] = { weight: 0, tickers: [], count: 0 }
    map[sector].weight += h.weightPercentage || 0
    map[sector].tickers.push({ symbol: h.asset || h.symbol, weight: h.weightPercentage || 0 })
    map[sector].count++
  }
  return map
})

const sectorSegments = computed(() => {
  return Object.entries(sectorMap.value)
    .map(([name, data]) => ({ label: name, value: parseFloat(data.weight.toFixed(2)) }))
    .sort((a, b) => b.value - a.value)
})

const sectorDetails = computed(() => {
  return Object.entries(sectorMap.value)
    .map(([name, data]) => ({
      name,
      weight: data.weight,
      count: data.count,
      topHoldings: data.tickers.sort((a, b) => b.weight - a.weight).slice(0, 3).map(t => t.symbol)
    }))
    .sort((a, b) => b.weight - a.weight)
})

const constituentsCount = computed(() => constituents.value.length || '—')

const top10Weight = computed(() => {
  const sorted = [...holdings.value].sort((a, b) => (b.weightPercentage || 0) - (a.weightPercentage || 0))
  return sorted.slice(0, 10).reduce((sum, h) => sum + (h.weightPercentage || 0), 0)
})

const filteredConstituents = computed(() => {
  let list = [...constituents.value]
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(s => s.symbol?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q))
  }
  list.sort((a, b) => {
    const aVal = a[sortKey.value] ?? 0
    const bVal = b[sortKey.value] ?? 0
    if (typeof aVal === 'string') return sortAsc.value ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    return sortAsc.value ? aVal - bVal : bVal - aVal
  })
  return list
})

const visibleConstituents = computed(() => filteredConstituents.value.slice(0, displayCount.value))

// --- Helpers ---
function formatMarketCap(val) {
  if (!val) return '—'
  if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`
  return `$${val.toLocaleString()}`
}

function toggleSort(key) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = false
  }
}

const explainerCards = [
  {
    icon: '📦',
    title: 'What is an ETF?',
    body: 'An ETF (Exchange-Traded Fund) is a basket of stocks you can buy with a single trade. Instead of buying 500 individual stocks, you buy one share of SPY and own a tiny piece of all 500 companies.'
  },
  {
    icon: '🪞',
    title: 'How SPY Tracks the S&P 500',
    body: 'SPY holds the exact same stocks in the same proportions as the S&P 500 index. When the index changes, SPY adjusts its holdings to match. Its price moves almost identically to the index.'
  },
  {
    icon: '🎯',
    title: 'Why We Use SPY as Your Benchmark',
    body: 'Most professional fund managers can\'t beat the S&P 500 over time. If your portfolio outperforms SPY, you\'re doing better than most professionals on Wall Street!'
  },
  {
    icon: '⚖️',
    title: 'Market-Cap Weighting',
    body: 'Bigger companies get a bigger slice. Apple and Microsoft have much more influence on the index than smaller companies. A 1% move in Apple matters more than a 1% move in a smaller stock.'
  },
  {
    icon: '🔄',
    title: 'How Rebalancing Works',
    body: 'The S&P 500 committee reviews the index quarterly. Companies can be added or removed based on market cap, profitability, and trading volume. This keeps the index fresh and representative.'
  },
  {
    icon: '📊',
    title: 'Diversification in Action',
    body: 'With 500 companies across 11 sectors, SPY gives you instant diversification. If one company or sector struggles, the others can offset those losses. That\'s the power of not putting all eggs in one basket.'
  }
]

// --- Data Loading ---
onMounted(async () => {
  // Kick off parallel fetches
  const [quoteData, profileData, historyData, holdingsData, constituentsData] = await Promise.all([
    getQuote('SPY'),
    getCompanyProfile('SPY'),
    getHistoricalDaily('SPY', '2021-01-01'),
    getSPYHoldings(),
    getSP500Constituents()
  ])

  spyQuote.value = quoteData
  spyProfile.value = profileData
  spyHistory.value = (historyData || []).sort((a, b) => new Date(a.date) - new Date(b.date))

  // Calculate YTD
  if (historyData?.length && quoteData) {
    const yearStart = historyData.filter(d => d.date >= '2026-01-01').sort((a, b) => new Date(a.date) - new Date(b.date))
    if (yearStart.length) {
      ytdReturn.value = ((quoteData.price - yearStart[0].close) / yearStart[0].close) * 100
    }
  }

  // Merge holdings with constituents for sector info
  const constituentMap = {}
  for (const c of (constituentsData || [])) {
    constituentMap[c.symbol] = c
  }

  // Enrich holdings with sector from constituents
  const enrichedHoldings = (holdingsData || []).map(h => {
    const ticker = h.asset || h.symbol
    const c = constituentMap[ticker]
    return { ...h, symbol: ticker, sector: c?.sector || h.sector || '' }
  })
  holdings.value = enrichedHoldings

  // Build constituents list: merge holdings + constituent data
  const holdingMap = {}
  for (const h of enrichedHoldings) {
    holdingMap[h.symbol] = h
  }

  const allSymbols = [...new Set([
    ...enrichedHoldings.map(h => h.symbol),
    ...(constituentsData || []).map(c => c.symbol)
  ])]

  const merged = allSymbols.map(sym => {
    const h = holdingMap[sym] || {}
    const c = constituentMap[sym] || {}
    return {
      symbol: sym,
      name: c.name || h.name || h.asset || sym,
      sector: c.sector || h.sector || '',
      subSector: c.subSector || '',
      weightPercentage: h.weightPercentage || 0,
      price: null,
      changesPercentage: null,
      marketCap: null
    }
  })

  constituents.value = merged.sort((a, b) => (b.weightPercentage || 0) - (a.weightPercentage || 0))

  // Fetch quotes in batches for the top constituents
  loadQuotes()
})

async function loadQuotes() {
  const batchSize = 50
  const symbols = constituents.value.map(c => c.symbol)

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    try {
      const quotes = await getBatchQuotes(batch)
      const profiles = await getBatchProfiles(batch)

      const quoteMap = {}
      for (const q of (quotes || [])) quoteMap[q.symbol] = q
      const profileMap = {}
      for (const p of (profiles || [])) profileMap[p.symbol] = p

      for (const c of constituents.value) {
        const q = quoteMap[c.symbol]
        const p = profileMap[c.symbol]
        if (q) {
          c.price = q.price
          c.changesPercentage = q.changesPercentage
          c.marketCap = q.marketCap
        }
        if (p && !c.sector) {
          c.sector = p.sector || ''
        }
      }
    } catch (e) {
      console.warn('Batch quote fetch failed for batch starting at', i, e)
    }
  }
}
</script>
