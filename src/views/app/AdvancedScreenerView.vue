<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold">Advanced Screener</h1>
        <p class="text-sm text-base-content/60">Filter securities using professional-grade criteria</p>
      </div>
      <RouterLink to="/stocks" class="btn btn-ghost btn-sm gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
        Back to Stocks
      </RouterLink>
    </div>

    <div class="flex flex-col lg:flex-row gap-4">
      <!-- Filters Panel -->
      <div class="lg:w-80 lg:flex-shrink-0 space-y-3">
        <!-- Valuation -->
        <div class="collapse collapse-arrow bg-base-100 shadow">
          <input type="checkbox" checked />
          <div class="collapse-title font-semibold text-sm py-3 min-h-0">Valuation</div>
          <div class="collapse-content space-y-2 pb-3">
            <div class="grid grid-cols-2 gap-2">
              <div class="form-control">
                <label class="label py-0.5"><span class="label-text text-xs">P/E Min</span></label>
                <input v-model.number="filters.peMin" type="number" step="0.1" min="0" class="input input-bordered input-sm w-full" placeholder="e.g. 5" />
              </div>
              <div class="form-control">
                <label class="label py-0.5"><span class="label-text text-xs">P/E Max</span></label>
                <input v-model.number="filters.peMax" type="number" step="0.1" min="0" class="input input-bordered input-sm w-full" placeholder="e.g. 30" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="form-control">
                <label class="label py-0.5"><span class="label-text text-xs">Div Yield Min %</span></label>
                <input v-model.number="filters.dividendMin" type="number" step="0.01" min="0" class="input input-bordered input-sm w-full" placeholder="e.g. 1" />
              </div>
              <div class="form-control">
                <label class="label py-0.5"><span class="label-text text-xs">Div Yield Max %</span></label>
                <input v-model.number="filters.dividendMax" type="number" step="0.01" min="0" class="input input-bordered input-sm w-full" placeholder="e.g. 5" />
              </div>
            </div>
          </div>
        </div>

        <!-- Price & Volume -->
        <div class="collapse collapse-arrow bg-base-100 shadow">
          <input type="checkbox" checked />
          <div class="collapse-title font-semibold text-sm py-3 min-h-0">Price & Volume</div>
          <div class="collapse-content space-y-2 pb-3">
            <div class="grid grid-cols-2 gap-2">
              <div class="form-control">
                <label class="label py-0.5"><span class="label-text text-xs">Price Min ($)</span></label>
                <input v-model.number="filters.priceMin" type="number" step="0.01" min="0" class="input input-bordered input-sm w-full" placeholder="e.g. 10" />
              </div>
              <div class="form-control">
                <label class="label py-0.5"><span class="label-text text-xs">Price Max ($)</span></label>
                <input v-model.number="filters.priceMax" type="number" step="0.01" min="0" class="input input-bordered input-sm w-full" placeholder="e.g. 500" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="form-control">
                <label class="label py-0.5"><span class="label-text text-xs">Volume Min</span></label>
                <input v-model.number="filters.volumeMin" type="number" min="0" class="input input-bordered input-sm w-full" placeholder="e.g. 100000" />
              </div>
              <div class="form-control">
                <label class="label py-0.5"><span class="label-text text-xs">Volume Max</span></label>
                <input v-model.number="filters.volumeMax" type="number" min="0" class="input input-bordered input-sm w-full" placeholder="e.g. 50000000" />
              </div>
            </div>
          </div>
        </div>

        <!-- Risk -->
        <div class="collapse collapse-arrow bg-base-100 shadow">
          <input type="checkbox" checked />
          <div class="collapse-title font-semibold text-sm py-3 min-h-0">Risk</div>
          <div class="collapse-content space-y-2 pb-3">
            <div class="grid grid-cols-2 gap-2">
              <div class="form-control">
                <label class="label py-0.5"><span class="label-text text-xs">Beta Min</span></label>
                <input v-model.number="filters.betaMin" type="number" step="0.1" class="input input-bordered input-sm w-full" placeholder="e.g. 0.5" />
              </div>
              <div class="form-control">
                <label class="label py-0.5"><span class="label-text text-xs">Beta Max</span></label>
                <input v-model.number="filters.betaMax" type="number" step="0.1" class="input input-bordered input-sm w-full" placeholder="e.g. 1.5" />
              </div>
            </div>
          </div>
        </div>

        <!-- Size -->
        <div class="collapse collapse-arrow bg-base-100 shadow">
          <input type="checkbox" checked />
          <div class="collapse-title font-semibold text-sm py-3 min-h-0">Market Cap</div>
          <div class="collapse-content space-y-2 pb-3">
            <div class="flex flex-wrap gap-1 mb-2">
              <button class="btn btn-xs" :class="mcapPreset === 'large' ? 'btn-primary' : 'btn-ghost'" @click="setMcapPreset('large')">Large (>$10B)</button>
              <button class="btn btn-xs" :class="mcapPreset === 'mid' ? 'btn-primary' : 'btn-ghost'" @click="setMcapPreset('mid')">Mid ($2B-$10B)</button>
              <button class="btn btn-xs" :class="mcapPreset === 'small' ? 'btn-primary' : 'btn-ghost'" @click="setMcapPreset('small')">Small (<$2B)</button>
              <button v-if="mcapPreset" class="btn btn-xs btn-ghost text-error" @click="setMcapPreset(null)">Clear</button>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="form-control">
                <label class="label py-0.5"><span class="label-text text-xs">Min ($)</span></label>
                <input v-model.number="filters.mcapMin" type="number" min="0" class="input input-bordered input-sm w-full" placeholder="e.g. 1000000000" />
              </div>
              <div class="form-control">
                <label class="label py-0.5"><span class="label-text text-xs">Max ($)</span></label>
                <input v-model.number="filters.mcapMax" type="number" min="0" class="input input-bordered input-sm w-full" placeholder="e.g. 50000000000" />
              </div>
            </div>
          </div>
        </div>

        <!-- Classification -->
        <div class="collapse collapse-arrow bg-base-100 shadow">
          <input type="checkbox" checked />
          <div class="collapse-title font-semibold text-sm py-3 min-h-0">Classification</div>
          <div class="collapse-content space-y-2 pb-3">
            <div class="form-control">
              <label class="label py-0.5"><span class="label-text text-xs">Sector</span></label>
              <select v-model="filters.sector" class="select select-bordered select-sm w-full">
                <option value="">Any</option>
                <option v-for="s in sectorOptions" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
            <div class="form-control">
              <label class="label py-0.5"><span class="label-text text-xs">Exchange</span></label>
              <select v-model="filters.exchange" class="select select-bordered select-sm w-full">
                <option value="">Any</option>
                <option v-for="e in exchangeOptions" :key="e" :value="e">{{ e }}</option>
              </select>
            </div>
            <div class="form-control">
              <label class="label py-0.5"><span class="label-text text-xs">Country</span></label>
              <select v-model="filters.country" class="select select-bordered select-sm w-full">
                <option value="">Any</option>
                <option v-for="c in countryOptions" :key="c.code" :value="c.code">{{ c.label }}</option>
              </select>
            </div>
            <label class="label cursor-pointer justify-start gap-2">
              <input type="checkbox" v-model="filters.isEtf" class="checkbox checkbox-sm" :indeterminate.prop="filters.isEtf === null" @click="cycleEtf" />
              <span class="label-text text-xs">{{ filters.isEtf === true ? 'ETFs only' : filters.isEtf === false ? 'Stocks only' : 'Stocks & ETFs' }}</span>
            </label>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <button class="btn btn-primary flex-1" :disabled="loading" @click="runScreen">
            <span v-if="loading" class="loading loading-spinner loading-sm"></span>
            Run Screen
          </button>
          <button class="btn btn-ghost" @click="clearAll">Clear</button>
        </div>

        <p v-if="hasClientFilters" class="text-xs text-info">P/E filter is applied client-side on returned results.</p>
      </div>

      <!-- Results Panel -->
      <div class="flex-1 min-w-0">
        <div v-if="!hasRun" class="text-center py-16 text-base-content/40">
          <div class="text-5xl mb-3">&#128270;</div>
          <p>Set your filters and click "Run Screen" to find securities.</p>
        </div>

        <div v-else-if="loading" class="flex justify-center py-16">
          <span class="loading loading-spinner loading-lg"></span>
        </div>

        <div v-else>
          <div class="flex items-center justify-between mb-3">
            <span class="badge badge-lg">{{ displayResults.length }} result{{ displayResults.length !== 1 ? 's' : '' }}</span>
            <span v-if="clientFiltered" class="text-xs text-base-content/50">{{ totalBeforeClientFilter }} from API, {{ displayResults.length }} after P/E filter</span>
          </div>

          <div v-if="displayResults.length === 0" class="text-center py-12 text-base-content/40">
            No securities match your criteria. Try relaxing your filters.
          </div>

          <div v-else class="overflow-x-auto">
            <table class="table table-sm table-zebra">
              <thead>
                <tr>
                  <th class="cursor-pointer select-none" @click="toggleSort('symbol')">Ticker {{ sortIcon('symbol') }}</th>
                  <th class="cursor-pointer select-none" @click="toggleSort('companyName')">Name {{ sortIcon('companyName') }}</th>
                  <th class="text-right cursor-pointer select-none" @click="toggleSort('price')">Price {{ sortIcon('price') }}</th>
                  <th class="text-right cursor-pointer select-none" @click="toggleSort('changesPercentage')">Change % {{ sortIcon('changesPercentage') }}</th>
                  <th class="text-right cursor-pointer select-none" @click="toggleSort('marketCap')">Market Cap {{ sortIcon('marketCap') }}</th>
                  <th class="text-right cursor-pointer select-none" @click="toggleSort('pe')">P/E {{ sortIcon('pe') }}</th>
                  <th class="text-right cursor-pointer select-none" @click="toggleSort('lastAnnualDividend')">Div Yield {{ sortIcon('lastAnnualDividend') }}</th>
                  <th class="text-right cursor-pointer select-none" @click="toggleSort('volume')">Volume {{ sortIcon('volume') }}</th>
                  <th class="text-right cursor-pointer select-none" @click="toggleSort('beta')">Beta {{ sortIcon('beta') }}</th>
                  <th>Sector</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="stock in displayResults" :key="stock.symbol" class="hover cursor-pointer" @click="router.push(`/stocks/${stock.symbol}`)">
                  <td class="font-mono font-bold text-primary">{{ stock.symbol }}</td>
                  <td class="max-w-[200px] truncate">{{ stock.companyName }}</td>
                  <td class="text-right font-mono">${{ fmt(stock.price, 2) }}</td>
                  <td class="text-right font-mono" :class="(stock.changesPercentage || 0) >= 0 ? 'text-success' : 'text-error'">
                    {{ (stock.changesPercentage || 0) >= 0 ? '+' : '' }}{{ fmt(stock.changesPercentage, 2) }}%
                  </td>
                  <td class="text-right font-mono">{{ fmtMcap(stock.marketCap) }}</td>
                  <td class="text-right font-mono">{{ stock.pe ? fmt(stock.pe, 1) : '-' }}</td>
                  <td class="text-right font-mono">{{ stock.divYieldPct ? fmt(stock.divYieldPct, 2) + '%' : '-' }}</td>
                  <td class="text-right font-mono">{{ stock.volume ? fmtNum(stock.volume) : '-' }}</td>
                  <td class="text-right font-mono">{{ stock.beta ? fmt(stock.beta, 2) : '-' }}</td>
                  <td class="text-xs">{{ stock.sector || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useMarketDataStore } from '../../stores/marketData'

const router = useRouter()
const market = useMarketDataStore()

const loading = ref(false)
const hasRun = ref(false)
const results = ref([])
const enrichedResults = ref([])
const totalBeforeClientFilter = ref(0)
const clientFiltered = ref(false)

const sortKey = ref('marketCap')
const sortDir = ref('desc')

const mcapPreset = ref(null)

const filters = reactive({
  peMin: null,
  peMax: null,
  dividendMin: null,
  dividendMax: null,
  priceMin: null,
  priceMax: null,
  volumeMin: null,
  volumeMax: null,
  betaMin: null,
  betaMax: null,
  mcapMin: null,
  mcapMax: null,
  sector: '',
  exchange: '',
  country: '',
  isEtf: null
})

const sectorOptions = [
  'Technology', 'Healthcare', 'Financial Services', 'Energy',
  'Consumer Cyclical', 'Industrials', 'Communication Services',
  'Real Estate', 'Consumer Defensive', 'Utilities', 'Basic Materials'
]
const exchangeOptions = ['NYSE', 'NASDAQ', 'AMEX']
const countryOptions = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'DE', label: 'Germany' },
  { code: 'JP', label: 'Japan' },
  { code: 'FR', label: 'France' },
  { code: 'AU', label: 'Australia' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'CN', label: 'China' },
  { code: 'IN', label: 'India' },
  { code: 'BR', label: 'Brazil' },
  { code: 'KR', label: 'South Korea' },
  { code: 'HK', label: 'Hong Kong' }
]

const hasClientFilters = computed(() => filters.peMin != null || filters.peMax != null)

const displayResults = computed(() => {
  const sorted = [...enrichedResults.value].sort((a, b) => {
    const aVal = a[sortKey.value] ?? 0
    const bVal = b[sortKey.value] ?? 0
    if (typeof aVal === 'string') return sortDir.value === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    return sortDir.value === 'asc' ? aVal - bVal : bVal - aVal
  })
  return sorted
})

function setMcapPreset(preset) {
  mcapPreset.value = preset === mcapPreset.value ? null : preset
  if (mcapPreset.value === 'large') { filters.mcapMin = 10000000000; filters.mcapMax = null }
  else if (mcapPreset.value === 'mid') { filters.mcapMin = 2000000000; filters.mcapMax = 10000000000 }
  else if (mcapPreset.value === 'small') { filters.mcapMin = null; filters.mcapMax = 2000000000 }
  else { filters.mcapMin = null; filters.mcapMax = null }
}

function cycleEtf() {
  if (filters.isEtf === null) filters.isEtf = false
  else if (filters.isEtf === false) filters.isEtf = true
  else filters.isEtf = null
}

function clearAll() {
  Object.keys(filters).forEach(k => {
    if (typeof filters[k] === 'string') filters[k] = ''
    else filters[k] = null
  })
  mcapPreset.value = null
  results.value = []
  enrichedResults.value = []
  hasRun.value = false
  clientFiltered.value = false
}

async function runScreen() {
  loading.value = true
  hasRun.value = true
  clientFiltered.value = false

  const params = { limit: 200, isActivelyTrading: true }
  if (filters.mcapMin) params.marketCapMoreThan = filters.mcapMin
  if (filters.mcapMax) params.marketCapLowerThan = filters.mcapMax
  if (filters.priceMin) params.priceMoreThan = filters.priceMin
  if (filters.priceMax) params.priceLowerThan = filters.priceMax
  if (filters.volumeMin) params.volumeMoreThan = filters.volumeMin
  if (filters.volumeMax) params.volumeLowerThan = filters.volumeMax
  if (filters.betaMin) params.betaMoreThan = filters.betaMin
  if (filters.betaMax) params.betaLowerThan = filters.betaMax
  if (filters.dividendMin != null) params.dividendMoreThan = filters.dividendMin
  if (filters.dividendMax != null) params.dividendLowerThan = filters.dividendMax
  if (filters.sector) params.sector = filters.sector
  if (filters.exchange) params.exchange = filters.exchange
  if (filters.country) params.country = filters.country
  if (filters.isEtf !== null) params.isEtf = filters.isEtf

  try {
    const data = await market.screenStocks(params)
    results.value = data || []
    totalBeforeClientFilter.value = results.value.length

    // Enrich with quote data for P/E, change%, and dividend yield
    let enriched = results.value
    if (enriched.length > 0) {
      // Batch quotes in chunks of 50
      const tickers = enriched.map(s => s.symbol)
      const allQuotes = []
      for (let i = 0; i < tickers.length; i += 50) {
        const chunk = tickers.slice(i, i + 50)
        const quotes = await market.fetchBatchQuotes(chunk)
        allQuotes.push(...(quotes || []))
      }

      enriched = enriched.map(s => {
        const q = allQuotes.find(qu => qu.symbol === s.symbol)
        return {
          ...s,
          price: q?.price ?? s.price,
          changesPercentage: q?.changesPercentage ?? null,
          pe: q?.pe ?? null,
          eps: q?.eps ?? null,
          volume: q?.volume ?? s.volume,
          divYieldPct: s.lastAnnualDividend && s.price ? ((s.lastAnnualDividend / s.price) * 100) : null
        }
      })
    }

    // Client-side P/E filtering
    if (filters.peMin != null || filters.peMax != null) {
      clientFiltered.value = true
      enriched = enriched.filter(s => {
        if (!s.pe || s.pe <= 0) return false
        if (filters.peMin != null && s.pe < filters.peMin) return false
        if (filters.peMax != null && s.pe > filters.peMax) return false
        return true
      })
    }

    enrichedResults.value = enriched
  } catch (e) {
    console.error('Screener error:', e)
    results.value = []
    enrichedResults.value = []
  }

  loading.value = false
}

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'symbol' || key === 'companyName' ? 'asc' : 'desc'
  }
}

function sortIcon(key) {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? '\u25B2' : '\u25BC'
}

function fmt(v, d) { return v != null ? Number(v).toFixed(d) : '-' }

function fmtMcap(v) {
  if (!v) return '-'
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(1) + 'T'
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M'
  return '$' + Number(v).toLocaleString()
}

function fmtNum(v) {
  if (!v) return '-'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K'
  return v.toLocaleString()
}
</script>
