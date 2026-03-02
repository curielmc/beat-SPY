<template>
  <div v-if="loading" class="flex justify-center py-20">
    <span class="loading loading-spinner loading-lg"></span>
  </div>

  <div v-else class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold">My Funds</h1>
    </div>

    <div v-if="allFundsEnriched.length === 0" class="text-center py-10 text-base-content/50">
      <p class="text-lg">No funds yet.</p>
      <p class="text-sm mt-1">Create your first fund from the home page!</p>
    </div>

    <!-- Personal Funds Section -->
    <div v-if="personalEnriched.length > 0">
      <h2 class="text-sm font-semibold text-base-content/60 uppercase tracking-wide mb-2">Personal Funds</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div v-for="fund in personalEnriched" :key="fund.id" class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <div class="flex items-start justify-between">
              <div>
                <span class="badge badge-sm badge-primary">Fund {{ fund.fund_number || 1 }}</span>
                <h3 class="font-bold mt-1">{{ fund.fund_name || 'My Portfolio' }}</h3>
                <p v-if="fund.fund_thesis" class="text-xs text-base-content/50 mt-0.5">{{ fund.fund_thesis }}</p>
              </div>
              <span class="badge badge-ghost badge-sm">active</span>
            </div>
            <div class="mt-3 space-y-1">
              <div class="flex justify-between text-sm">
                <span class="text-base-content/60">Current Value</span>
                <span class="font-mono font-bold">${{ fund._totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-base-content/60">Return</span>
                <span class="font-mono" :class="fund._returnPct >= 0 ? 'text-success' : 'text-error'">
                  {{ fund._returnPct >= 0 ? '+' : '' }}{{ fund._returnPct.toFixed(2) }}%
                </span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-base-content/60">vs SPY</span>
                <span class="font-mono" :class="fund._vsSpy >= 0 ? 'text-success' : 'text-error'">
                  {{ fund._vsSpy >= 0 ? '+' : '' }}{{ fund._vsSpy.toFixed(2) }}%
                </span>
              </div>
            </div>
            <div class="mt-3">
              <RouterLink :to="{ name: 'home', query: { fund: fund.id } }" class="btn btn-sm btn-outline btn-block">View Fund</RouterLink>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Group Funds Section -->
    <div v-if="groupEnriched.length > 0">
      <h2 class="text-sm font-semibold text-base-content/60 uppercase tracking-wide mb-2">Group Funds — {{ groupName }}</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div v-for="fund in groupEnriched" :key="fund.id" class="card bg-base-100 shadow border-l-4 border-secondary">
          <div class="card-body p-4">
            <div class="flex items-start justify-between">
              <div>
                <span class="badge badge-sm badge-secondary">Fund {{ fund.fund_number || 1 }}</span>
                <h3 class="font-bold mt-1">{{ fund.fund_name || 'Group Fund' }}</h3>
                <p v-if="fund.fund_thesis" class="text-xs text-base-content/50 mt-0.5">{{ fund.fund_thesis }}</p>
              </div>
              <span class="badge badge-ghost badge-sm">active</span>
            </div>
            <div class="mt-3 space-y-1">
              <div class="flex justify-between text-sm">
                <span class="text-base-content/60">Current Value</span>
                <span class="font-mono font-bold">${{ fund._totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-base-content/60">Return</span>
                <span class="font-mono" :class="fund._returnPct >= 0 ? 'text-success' : 'text-error'">
                  {{ fund._returnPct >= 0 ? '+' : '' }}{{ fund._returnPct.toFixed(2) }}%
                </span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-base-content/60">vs SPY</span>
                <span class="font-mono" :class="fund._vsSpy >= 0 ? 'text-success' : 'text-error'">
                  {{ fund._vsSpy >= 0 ? '+' : '' }}{{ fund._vsSpy.toFixed(2) }}%
                </span>
              </div>
            </div>
            <div class="mt-3">
              <RouterLink :to="{ name: 'home', query: { fund: fund.id } }" class="btn btn-sm btn-outline btn-secondary btn-block">View Fund</RouterLink>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- All Funds Comparison Chart -->
    <div v-if="comparisonDatasets.length > 0" class="card bg-base-100 shadow">
      <div class="card-body p-4">
        <h3 class="font-semibold mb-2">All Funds vs S&P 500</h3>
        <PortfolioLineChart
          :datasets="comparisonDatasets"
          :show-percentage="true"
          height="250px"
        />
      </div>
    </div>

    <!-- Funds Summary Table -->
    <div v-if="allFundsEnriched.length > 0" class="card bg-base-100 shadow">
      <div class="card-body p-4">
        <h3 class="font-semibold mb-2">Fund Summary</h3>
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Fund</th>
                <th>Type</th>
                <th>Thesis</th>
                <th class="text-right">Starting</th>
                <th class="text-right">Current</th>
                <th class="text-right">Return</th>
                <th class="text-right">vs SPY</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="fund in allFundsEnriched" :key="fund.id">
                <td class="font-semibold">{{ fund.fund_name || 'Fund ' + (fund.fund_number || 1) }}</td>
                <td><span class="badge badge-xs" :class="fund._ownerType === 'group' ? 'badge-secondary' : 'badge-primary'">{{ fund._ownerType === 'group' ? 'Group' : 'Personal' }}</span></td>
                <td class="text-xs text-base-content/60 max-w-[200px] truncate">{{ fund.fund_thesis || '-' }}</td>
                <td class="text-right font-mono">${{ Number(fund.starting_cash || 100000).toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</td>
                <td class="text-right font-mono">${{ fund._totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</td>
                <td class="text-right font-mono" :class="fund._returnPct >= 0 ? 'text-success' : 'text-error'">
                  {{ fund._returnPct >= 0 ? '+' : '' }}{{ fund._returnPct.toFixed(2) }}%
                </td>
                <td class="text-right font-mono" :class="fund._vsSpy >= 0 ? 'text-success' : 'text-error'">
                  {{ fund._vsSpy >= 0 ? '+' : '' }}{{ fund._vsSpy.toFixed(2) }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toastMsg" class="toast toast-end">
      <div class="alert" :class="toastType === 'success' ? 'alert-success' : 'alert-error'">
        <span>{{ toastMsg }}</span>
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
import { supabase } from '../../lib/supabase'

const portfolioStore = usePortfolioStore()
const auth = useAuthStore()
const market = useMarketDataStore()

const loading = ref(true)
const personalEnriched = ref([])
const groupEnriched = ref([])
const comparisonDatasets = ref([])
const groupName = ref('')
const toastMsg = ref('')
const toastType = ref('success')

const allFundsEnriched = computed(() => [...personalEnriched.value, ...groupEnriched.value])

function showToast(msg, type = 'success') {
  toastMsg.value = msg
  toastType.value = type
  setTimeout(() => { toastMsg.value = '' }, 3000)
}

async function enrichFunds(funds, ownerType) {
  const enriched = []
  for (const fund of funds) {
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

    enriched.push({
      ...fund,
      _ownerType: ownerType,
      _totalValue: totalValue,
      _returnPct: returnPct,
      _bmReturnPct: bmReturnPct,
      _vsSpy: returnPct - bmReturnPct
    })
  }
  return enriched
}

onMounted(async () => {
  try {
    // Load personal funds
    const pFunds = await portfolioStore.loadFundsForOwner('user', auth.currentUser?.id)
    personalEnriched.value = await enrichFunds(pFunds, 'user')

    // Load group funds if user is in a class with a group
    const membership = await auth.getCurrentMembership()
    if (membership?.group_id) {
      groupName.value = membership.group?.name || 'My Group'
      const gFunds = await portfolioStore.loadFundsForOwner('group', membership.group_id)
      groupEnriched.value = await enrichFunds(gFunds, 'group')
    }

    // Build comparison chart
    buildComparisonChart(allFundsEnriched.value)
  } finally {
    loading.value = false
  }
})

const FUND_COLORS = ['primary', 'secondary', 'accent', 'info', 'success', 'warning']

function buildComparisonChart(enrichedFunds) {
  if (enrichedFunds.length === 0) return
  const datasets = []

  for (let i = 0; i < enrichedFunds.length; i++) {
    const fund = enrichedFunds[i]
    const startCash = Number(fund.starting_cash || 100000)
    const synth = generateSyntheticHistory(fund.created_at, null, startCash, fund._totalValue, fund.id)
    const label = fund._ownerType === 'group'
      ? `${groupName.value}: ${fund.fund_name || 'Fund ' + (fund.fund_number || 1)}`
      : fund.fund_name || `Fund ${fund.fund_number || 1}`
    datasets.push({
      label,
      data: synth,
      color: FUND_COLORS[i % FUND_COLORS.length]
    })
  }

  // Add SPY line using first fund's baseline
  const firstFund = enrichedFunds[0]
  const startCash = Number(firstFund.starting_cash || 100000)
  const spyEnd = startCash * (1 + (firstFund._bmReturnPct || 0) / 100)
  const synthSpy = generateSyntheticHistory(firstFund.created_at, null, startCash, spyEnd, 'spy-funds')
  datasets.push({ label: 'SPY', data: synthSpy, color: 'sp500' })

  comparisonDatasets.value = datasets
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
