<template>
  <div v-if="loading" class="flex justify-center py-20">
    <span class="loading loading-spinner loading-lg"></span>
  </div>

  <!-- Independent user: no portfolio yet -->
  <div v-else-if="!membership && !portfolioStore.portfolio" class="flex flex-col items-center justify-center py-20 space-y-4">
    <div class="text-6xl">&#128200;</div>
    <h2 class="text-2xl font-bold">Welcome to Beat the S&P 500!</h2>
    <p class="text-base-content/60 text-center max-w-md">Start with $100,000 in virtual cash and see if you can beat the market. Or join a class to compete with classmates.</p>
    <div class="flex gap-3">
      <button class="btn btn-primary" @click="handleStartInvesting" :disabled="creatingPortfolio">
        <span v-if="creatingPortfolio" class="loading loading-spinner loading-sm"></span>
        Start Investing
      </button>
      <RouterLink to="/join" class="btn btn-outline">Join a Class</RouterLink>
    </div>
  </div>

  <!-- Waiting for group assignment (teacher_assign mode) -->
  <div v-else-if="membership && !membership.group_id" class="flex flex-col items-center justify-center py-20 space-y-4">
    <div class="text-6xl">&#9203;</div>
    <h2 class="text-2xl font-bold">Waiting for Group Assignment</h2>
    <p class="text-base-content/60 text-center max-w-md">Your teacher hasn't assigned you to a group yet. Check back soon or explore the stocks page in the meantime!</p>
    <RouterLink to="/stocks" class="btn btn-primary">Browse Stocks</RouterLink>
  </div>

  <!-- Bonus Cash Notification Modal -->
  <dialog ref="bonusModal" class="modal" :class="{ 'modal-open': showBonusModal }">
    <div class="modal-box text-center">
      <div class="text-6xl mb-4">&#127881;</div>
      <h3 class="font-bold text-2xl mb-2">Congratulations!</h3>
      <p class="text-lg text-base-content/70 mb-4">Your team received a bonus of</p>
      <p class="text-4xl font-bold text-success mb-4">${{ bonusTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
      <p class="text-base-content/50 mb-6">from your teacher! Use it wisely.</p>
      <button class="btn btn-primary btn-block" @click="dismissBonus">Awesome!</button>
    </div>
    <form method="dialog" class="modal-backdrop" @click="dismissBonus"><button>close</button></form>
  </dialog>

  <div v-if="!loading && membership?.group_id" class="space-y-4">
    <!-- Portfolio Toggle Tabs (only for class students with a group) -->
    <div v-if="hasGroupPortfolio" class="flex gap-2">
      <button
        class="flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all"
        :class="activeTab === 'personal'
          ? 'bg-primary text-primary-content shadow'
          : 'bg-base-200 text-base-content/60 hover:bg-base-300'"
        @click="switchTab('personal')"
      >
        👤 My Portfolio
      </button>
      <button
        class="flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all"
        :class="activeTab === 'group'
          ? 'bg-secondary text-secondary-content shadow'
          : 'bg-base-200 text-base-content/60 hover:bg-base-300'"
        @click="switchTab('group')"
      >
        👥 {{ membership?.group?.name }}
      </button>
    </div>

    <!-- Loading spinner during tab switch -->
    <div v-if="switchingTab" class="flex justify-center py-10">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <!-- Header -->
    <div v-if="!switchingTab" class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold">{{ activeTab === 'group' ? membership?.group?.name : (auth.profile?.full_name || 'My Portfolio') }}</h1>
        <p v-if="activeTab === 'group'" class="text-sm text-base-content/60">{{ auth.profile?.full_name }}</p>
        <p v-else class="text-sm text-base-content/60">Personal Portfolio</p>
      </div>
      <RouterLink v-if="isIndependent" to="/join" class="btn btn-ghost btn-xs gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
        Join a Class
      </RouterLink>
      <div v-if="activeTab === 'group'" class="flex flex-col gap-2">
        <div class="flex gap-1 flex-wrap">
          <div v-for="member in groupMembers" :key="member.id" class="badge badge-sm" :class="member.id === auth.currentUser?.id ? 'badge-primary' : 'badge-ghost'">
            <span v-if="member.avatar_url" class="avatar w-3 h-3 rounded-full mr-1"><img :src="member.avatar_url" /></span>
            {{ member.full_name?.split(' ')[0] }}
          </div>
        </div>
      </div>
    </div>

    <template v-if="!switchingTab">
    <!-- Group trading warning banner -->
    <div v-if="activeTab === 'group'" class="alert alert-warning py-2 px-3">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
      <span class="text-xs"><strong>Team Portfolio</strong> — Trades here affect all members of {{ membership?.group?.name }}. Coordinate with your team before buying or selling.</span>
    </div>

    <!-- Two Key Stats -->
    <div class="grid grid-cols-2 gap-3">
      <div class="card bg-base-100 shadow">
        <div class="card-body p-3">
          <p class="text-xs text-base-content/60">Total Gain/Loss</p>
          <p class="text-xl font-bold" :class="portfolioStore.totalReturnDollar >= 0 ? 'text-success' : 'text-error'">
            {{ portfolioStore.totalReturnDollar >= 0 ? '+' : '-' }}${{ Math.abs(portfolioStore.totalReturnDollar).toLocaleString('en-US', { maximumFractionDigits: 0 }) }}
          </p>
          <p class="text-xs" :class="portfolioStore.totalReturnPct >= 0 ? 'text-success' : 'text-error'">
            {{ portfolioStore.totalReturnPct >= 0 ? '+' : '' }}{{ portfolioStore.totalReturnPct.toFixed(2) }}%
          </p>
        </div>
      </div>
      <div class="card bg-base-100 shadow">
        <div class="card-body p-3">
          <p class="text-xs text-base-content/60">vs S&P 500 ({{ portfolioStore.benchmarkTicker }} proxy)</p>
          <p class="text-xl font-bold" :class="vsSP500 >= 0 ? 'text-success' : 'text-error'">
            {{ vsSP500 >= 0 ? '+' : '' }}{{ vsSP500.toFixed(2) }}%
          </p>
          <p class="text-xs text-base-content/50">
            {{ portfolioStore.isBeatingSP500 ? 'Beating the market' : 'Behind the market' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Portfolio Summary -->
    <div class="stats shadow bg-base-100 w-full">
      <div class="stat py-2">
        <div class="stat-title text-xs">Portfolio Value</div>
        <div class="stat-value text-lg">${{ portfolioStore.totalMarketValue.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}</div>
      </div>
      <div class="stat py-2">
        <div class="stat-title text-xs">Cash Available</div>
        <div class="stat-value text-lg">${{ portfolioStore.cashBalance.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}</div>
      </div>
      <div class="stat py-2">
        <div class="stat-title text-xs">S&P 500 (via {{ portfolioStore.benchmarkTicker }})</div>
        <div class="stat-value text-lg" :class="portfolioStore.benchmarkReturnPct >= 0 ? 'text-success' : 'text-error'">
          {{ portfolioStore.benchmarkReturnPct >= 0 ? '+' : '' }}{{ portfolioStore.benchmarkReturnPct.toFixed(2) }}%
        </div>
      </div>
    </div>

    <!-- Holdings -->
    <div class="card bg-base-100 shadow">
      <div class="card-body p-4">
        <h3 class="font-semibold mb-2">Holdings</h3>
        <div v-if="portfolioStore.holdings.length === 0" class="text-base-content/50 text-center py-6 text-lg">
          No holdings yet. <RouterLink to="/stocks" class="link link-primary">Buy some stocks, ETFs, or other investments!</RouterLink>
        </div>
        <div class="overflow-x-auto" v-else>
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Ticker</th>
                <th class="text-right">Shares</th>
                <th class="text-right">Price</th>
                <th class="text-right">Value</th>
                <th class="text-right">Gain/Loss</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in portfolioStore.holdings" :key="h.ticker">
                <td>
                  <RouterLink :to="`/stocks/${h.ticker}`" class="font-mono font-bold link link-hover">{{ h.ticker }}</RouterLink>
                </td>
                <td class="text-right font-mono">{{ Number(h.shares).toFixed(2) }}</td>
                <td class="text-right font-mono">${{ h.currentPrice.toFixed(2) }}</td>
                <td class="text-right font-mono">${{ h.marketValue.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}</td>
                <td class="text-right font-mono" :class="h.gainLoss >= 0 ? 'text-success' : 'text-error'">
                  {{ h.gainLoss >= 0 ? '+' : '' }}{{ h.gainLossPct.toFixed(2) }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Portfolio Settings -->
    <div class="card bg-base-100 shadow" v-if="portfolioStore.portfolio">
      <div class="card-body p-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold">Portfolio Settings</h3>
          <div class="flex items-center gap-2">
            <template v-if="activeTab === 'personal'">
              <button class="btn btn-xs btn-error btn-outline" @click="showResetConfirm = true">Reset</button>
              <button class="btn btn-xs btn-outline" @click="showCloseConfirm = true">Close</button>
            </template>
            <button class="btn btn-xs btn-ghost" @click="showSettings = !showSettings">
              {{ showSettings ? 'Hide' : 'Show' }}
            </button>
          </div>
        </div>
        <div v-if="showSettings" class="space-y-3">
          <!-- Name & Description -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div class="form-control">
              <label class="label py-1"><span class="label-text text-xs">Portfolio Name</span></label>
              <input v-model="settingsForm.name" type="text" class="input input-bordered input-sm" placeholder="My Portfolio" />
            </div>
            <div class="form-control">
              <label class="label py-1"><span class="label-text text-xs">Description</span></label>
              <input v-model="settingsForm.description" type="text" class="input input-bordered input-sm" placeholder="Growth strategy..." />
            </div>
          </div>

          <!-- Benchmark (locked to SPY) -->
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-xs">Benchmark Index</span></label>
            <div class="flex gap-2 items-center">
              <span class="input input-bordered input-sm flex-1 font-mono uppercase bg-base-200 flex items-center px-3 text-base-content/60">SPY</span>
              <span class="text-xs text-base-content/40">S&P 500 proxy (fixed)</span>
            </div>
          </div>

          <!-- Visibility -->
          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-3">
              <input type="checkbox" class="toggle toggle-primary toggle-sm" v-model="settingsForm.isPublic" @change="toggleVisibility" />
              <span class="label-text text-sm">Public portfolio (visible on leaderboard)</span>
            </label>
          </div>

          <!-- Save Name/Description -->
          <button class="btn btn-sm btn-primary" @click="saveMeta">Save Name & Description</button>

          <!-- Reset & Close (personal portfolios only) -->
          <div v-if="isPersonalPortfolio" class="divider text-xs text-base-content/40">Danger Zone</div>
          <div v-if="isPersonalPortfolio" class="flex flex-wrap items-center gap-2">
            <button class="btn btn-sm btn-error btn-outline" @click="showResetConfirm = true">Reset Portfolio</button>
            <button class="btn btn-sm btn-outline" @click="showCloseConfirm = true">Close Portfolio</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reset Confirmation Modal -->
    <dialog class="modal" :class="{ 'modal-open': showResetConfirm }">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Reset Portfolio?</h3>
        <p class="py-4 text-base-content/70">This will clear all holdings and restore $100k. Your trade history is preserved.</p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showResetConfirm = false">Cancel</button>
          <button class="btn btn-error" @click="handleReset" :disabled="resetting">
            <span v-if="resetting" class="loading loading-spinner loading-sm"></span>
            Reset
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showResetConfirm = false"><button>close</button></form>
    </dialog>

    <!-- Close Confirmation Modal -->
    <dialog class="modal" :class="{ 'modal-open': showCloseConfirm }">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Close Portfolio?</h3>
        <p class="py-4 text-base-content/70">This will close your current portfolio and open a new one. Your track record stays visible in Portfolio History.</p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showCloseConfirm = false">Cancel</button>
          <button class="btn btn-error" @click="handleClose" :disabled="closing">
            <span v-if="closing" class="loading loading-spinner loading-sm"></span>
            Close & Start New
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showCloseConfirm = false"><button>close</button></form>
    </dialog>

    <!-- Settings Feedback -->
    <div v-if="settingsMsg" class="toast toast-end">
      <div class="alert" :class="settingsMsgType === 'success' ? 'alert-success' : 'alert-error'">
        <span>{{ settingsMsg }}</span>
      </div>
    </div>

    <!-- Recent Trades -->
    <div class="card bg-base-100 shadow" v-if="portfolioStore.trades.length > 0">
      <div class="card-body p-4">
        <h3 class="font-semibold mb-2">Recent Trades</h3>
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Ticker</th>
                <th>Side</th>
                <th class="text-right">Amount</th>
                <th class="text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="t in portfolioStore.trades.slice(0, 10)" :key="t.id">
                <tr>
                  <td class="text-sm">{{ new Date(t.executed_at).toLocaleDateString() }}</td>
                  <td class="font-mono font-bold">{{ t.ticker }}</td>
                  <td><span class="badge badge-xs" :class="t.side === 'buy' ? 'badge-success' : 'badge-error'">{{ t.side }}</span></td>
                  <td class="text-right font-mono">${{ Number(t.dollars).toFixed(2) }}</td>
                  <td class="text-right font-mono">${{ Number(t.price).toFixed(2) }}</td>
                </tr>
                <tr v-if="t.rationale">
                  <td colspan="5" class="pt-0 pb-2">
                    <p class="text-xs italic text-base-content/50">"{{ t.rationale }}"</p>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div v-if="portfolioStore.holdings.length > 0 || portfolioStore.cashBalance > 0" class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-sm">Charts</h3>
        <TimeRangeSelector v-model="chartTimeRange" />
      </div>

      <div v-if="chartsLoading" class="flex justify-center py-8">
        <span class="loading loading-spinner loading-md"></span>
      </div>

      <template v-else>
        <!-- Two side-by-side line charts: Portfolio Value + Relative to SPY -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="card bg-base-100 shadow">
            <div class="card-body p-3">
              <h3 class="font-semibold text-sm mb-2">Portfolio Value</h3>
              <PortfolioLineChart
                v-if="portfolioValueDatasets.length > 0"
                :datasets="portfolioValueDatasets"
                :time-range="chartTimeRange"
                height="200px"
              />
            </div>
          </div>
          <div class="card bg-base-100 shadow">
            <div class="card-body p-3">
              <h3 class="font-semibold text-sm mb-2">Relative to S&P 500 <span class="text-xs font-normal text-base-content/40">({{ portfolioStore.benchmarkTicker }} proxy)</span></h3>
              <PortfolioLineChart
                v-if="relativeToSpyDatasets.length > 0"
                :datasets="relativeToSpyDatasets"
                :time-range="chartTimeRange"
                :show-percentage="true"
                height="200px"
              />
            </div>
          </div>
        </div>

        <!-- Compare Teams (only when student is in a class) -->
        <div v-if="activeTab === 'personal' && membership?.group_id && membership.group_id !== 'personal' && classGroups.length > 0" class="card bg-base-100 shadow">
          <div class="card-body p-3">
            <h3 class="font-semibold text-sm mb-2">Compare Teams</h3>
            <div class="flex flex-wrap gap-1 mb-2">
              <button
                v-for="g in classGroups"
                :key="g.id"
                class="btn btn-xs"
                :class="selectedGroupIds.includes(g.id)
                  ? (g.id === membership.group_id ? 'btn-primary' : 'btn-secondary')
                  : 'btn-ghost'"
                :disabled="g.id === membership.group_id"
                @click="toggleGroupComparison(g.id)"
              >
                {{ g.name }}
              </button>
            </div>
            <div v-if="loadingComparison" class="flex justify-center py-4">
              <span class="loading loading-spinner loading-sm"></span>
            </div>
            <PortfolioLineChart
              v-else-if="comparisonDatasets.length > 0"
              :datasets="comparisonDatasets"
              :time-range="chartTimeRange"
              :show-percentage="true"
              height="200px"
            />
          </div>
        </div>

        <!-- Performance Line Chart -->
        <div class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <h3 class="font-semibold mb-2">Performance vs {{ portfolioStore.benchmarkTicker }}</h3>
            <PortfolioLineChart
              v-if="performanceDatasets.length > 0"
              :datasets="performanceDatasets"
              :time-range="chartTimeRange"
              :show-percentage="true"
            />
          </div>
        </div>

        <!-- 4 Pie Charts: Stock, Sector, Country, Asset Class -->
        <div class="grid grid-cols-2 gap-3">
          <PortfolioPieChart
            v-if="stockSegments.length > 0"
            :segments="stockSegments"
            title="By Stock"
          />
          <PortfolioPieChart
            v-if="sectorSegments.length > 0"
            :segments="sectorSegments"
            title="By Sector"
          />
          <PortfolioPieChart
            v-if="countrySegments.length > 0"
            :segments="countrySegments"
            title="By Country"
          />
          <PortfolioPieChart
            v-if="assetClassSegments.length > 0"
            :segments="assetClassSegments"
            title="By Asset Class"
          />
        </div>
      </template>
    </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { usePortfolioStore } from '../../stores/portfolio'
import { supabase } from '../../lib/supabase'
import { getHistoricalDaily, getBatchProfiles } from '../../services/fmpApi'
import PortfolioLineChart from '../../components/charts/PortfolioLineChart.vue'
import PortfolioPieChart from '../../components/charts/PortfolioPieChart.vue'
import TimeRangeSelector from '../../components/charts/TimeRangeSelector.vue'

const auth = useAuthStore()
const portfolioStore = usePortfolioStore()

const loading = ref(true)
const creatingPortfolio = ref(false)
const membership = ref(null)
const groupMembers = ref([])
const activeTab = ref('personal') // default to personal portfolio
const switchingTab = ref(false)
// True when user is in a real class with a group (not independent/personal)
const hasGroupPortfolio = computed(() => membership.value?.group_id && membership.value.group_id !== 'personal')
const showBonusModal = ref(false)
const bonusTotal = ref(0)
const showSettings = ref(false)
const showResetConfirm = ref(false)
const showCloseConfirm = ref(false)
const resetting = ref(false)
const closing = ref(false)
const isPersonalPortfolio = computed(() => {
  const p = portfolioStore.portfolio
  return p && p.owner_type === 'user'
})
const settingsMsg = ref('')
const settingsMsgType = ref('success')
const settingsForm = ref({ name: '', description: '', benchmark: '', isPublic: true })

const vsSP500 = computed(() => portfolioStore.totalReturnPct - portfolioStore.benchmarkReturnPct)
const isIndependent = computed(() => membership.value?.group_id === 'personal')

// Charts state
const chartTimeRange = ref('3M')
const chartsLoading = ref(false)
const performanceDatasets = ref([])
const portfolioValueDatasets = ref([])
const relativeToSpyDatasets = ref([])
const sectorSegments = ref([])
const countrySegments = ref([])
const stockSegments = ref([])
const assetClassSegments = ref([])

// Compare Teams state
const classGroups = ref([])
const selectedGroupIds = ref([])
const comparisonDatasets = ref([])
const loadingComparison = ref(false)

// Synthetic history helper
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

onMounted(async () => {
  // Get current membership
  membership.value = await auth.getCurrentMembership()

  if (membership.value?.group_id) {
    // Load group members
    groupMembers.value = await auth.getGroupMembers(membership.value.group_id)

    // Load portfolio
    await portfolioStore.loadPortfolio('group', membership.value.group_id)

    // Check for bonus notifications
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('group_id', membership.value.group_id)
      .not('seen_by', 'cs', `{${auth.currentUser.id}}`)

    if (notifications?.length > 0) {
      bonusTotal.value = notifications.reduce((sum, n) => sum + Number(n.amount), 0)
      showBonusModal.value = true
    }
  } else if (!membership.value) {
    // Independent user - check for personal portfolio
    await portfolioStore.loadPortfolio('user', auth.currentUser?.id)
    if (portfolioStore.portfolio) {
      // Has personal portfolio, treat as having a "group"
      membership.value = { group_id: 'personal', group: { name: 'My Portfolio' } }
      groupMembers.value = [{ id: auth.currentUser.id, full_name: auth.profile?.full_name }]
    }
  }

  // Populate settings form
  if (portfolioStore.portfolio) {
    settingsForm.value = {
      name: portfolioStore.portfolio.name || '',
      description: portfolioStore.portfolio.description || '',
      benchmark: portfolioStore.benchmarkTicker,
      isPublic: portfolioStore.portfolio.is_public ?? true
    }
  }

  loading.value = false

  // Load charts after portfolio data is ready
  if (portfolioStore.holdings.length > 0) {
    loadCharts()
  }

  // Load class groups for Compare Teams chart
  if (membership.value?.class_id) {
    loadClassGroups()
  }
})

async function loadCharts() {
  if (portfolioStore.holdings.length === 0) return
  chartsLoading.value = true
  try {
    // --- Performance Line Chart ---
    // Build portfolio value over time from trade history
    const trades = [...portfolioStore.trades].sort(
      (a, b) => new Date(a.executed_at) - new Date(b.executed_at)
    )
    const startCash = portfolioStore.startingCash

    // Compute running portfolio value at each trade date
    const portfolioHistory = []
    let runningCash = startCash
    const holdingsMap = {} // ticker -> shares

    // Add starting point
    if (trades.length > 0) {
      const firstDate = new Date(trades[0].executed_at)
      portfolioHistory.push({ date: firstDate, value: startCash })
    }

    for (const t of trades) {
      const date = new Date(t.executed_at)
      if (t.side === 'buy') {
        runningCash -= Number(t.dollars)
        holdingsMap[t.ticker] = (holdingsMap[t.ticker] || 0) + Number(t.shares)
      } else {
        runningCash += Number(t.dollars)
        holdingsMap[t.ticker] = (holdingsMap[t.ticker] || 0) - Number(t.shares)
      }
      // Estimate portfolio value at trade time using trade prices
      let holdingsValue = 0
      for (const [ticker, shares] of Object.entries(holdingsMap)) {
        if (shares <= 0) continue
        // Use the trade price as approximation for that date
        const price = t.ticker === ticker ? Number(t.price) : (portfolioStore.holdings.find(h => h.ticker === ticker)?.currentPrice || 0)
        holdingsValue += shares * price
      }
      portfolioHistory.push({ date, value: runningCash + holdingsValue })
    }

    // Add current value as last point
    if (portfolioHistory.length > 0) {
      portfolioHistory.push({ date: new Date(), value: portfolioStore.totalMarketValue })
    }

    // Fetch SPY historical prices
    const firstTradeDate = trades.length > 0
      ? new Date(trades[0].executed_at).toISOString().split('T')[0]
      : new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    let spyHistory = []
    try {
      const spyData = await getHistoricalDaily('SPY', firstTradeDate, today)
      // spyData is newest-first, reverse it
      spyHistory = [...spyData].reverse().map(d => ({
        date: new Date(d.date),
        value: d.close
      }))
    } catch (e) {
      console.warn('Failed to fetch SPY history:', e)
    }

    // Normalize SPY to same starting value as portfolio
    if (spyHistory.length > 0) {
      const spyBaseline = spyHistory[0].value
      spyHistory = spyHistory.map(d => ({
        date: d.date,
        value: (d.value / spyBaseline) * startCash
      }))
    }

    const datasets = []
    if (portfolioHistory.length > 1) {
      datasets.push({ label: 'My Portfolio', data: portfolioHistory, color: 'primary' })
    }
    if (spyHistory.length > 0) {
      datasets.push({ label: 'S&P 500', data: spyHistory, color: 'sp500' })
    }
    performanceDatasets.value = datasets

    // --- Portfolio Value Line Chart (absolute $) ---
    const pvDatasets = []
    if (portfolioHistory.length > 1) {
      pvDatasets.push({ label: 'My Portfolio', data: portfolioHistory, color: 'primary' })
    } else {
      // Synthetic fallback
      const createdAt = portfolioStore.portfolio?.created_at
      const synth = generateSyntheticHistory(createdAt, null, startCash, portfolioStore.totalMarketValue, portfolioStore.portfolio?.id)
      pvDatasets.push({ label: 'My Portfolio', data: synth, color: 'primary' })
    }
    if (spyHistory.length > 0) {
      pvDatasets.push({ label: portfolioStore.benchmarkTicker, data: spyHistory, color: 'sp500' })
    } else {
      const createdAt = portfolioStore.portfolio?.created_at
      const spyEnd = startCash * (1 + portfolioStore.benchmarkReturnPct / 100)
      const synthSpy = generateSyntheticHistory(createdAt, null, startCash, spyEnd, 'spy-seed')
      pvDatasets.push({ label: portfolioStore.benchmarkTicker, data: synthSpy, color: 'sp500' })
    }
    portfolioValueDatasets.value = pvDatasets

    // --- Relative to S&P 500 (spread %) ---
    // Use a 100 baseline so showPercentage computes correctly
    const myPts = pvDatasets[0]?.data || []
    const spyPts = pvDatasets[1]?.data || []
    if (myPts.length > 0 && spyPts.length > 0) {
      const myBaseline = myPts[0].value
      const spyBaseline = spyPts[0].value
      const spreadData = myPts.map((p, i) => {
        const spyVal = i < spyPts.length ? spyPts[i].value : spyPts[spyPts.length - 1].value
        const myRet = ((p.value - myBaseline) / myBaseline) * 100
        const spyRet = ((spyVal - spyBaseline) / spyBaseline) * 100
        // Store as 100 + spread so showPercentage yields the spread %
        return { date: p.date, value: 100 + (myRet - spyRet) }
      })
      relativeToSpyDatasets.value = [{ label: 'vs S&P 500', data: spreadData, color: 'accent' }]
    }

    // --- Sector & Country Pie Charts ---
    const tickers = portfolioStore.holdings.map(h => h.ticker)
    let profiles = []
    try {
      profiles = await getBatchProfiles(tickers)
    } catch (e) {
      console.warn('Failed to fetch profiles for charts:', e)
    }

    const profileMap = {}
    for (const p of (profiles || [])) {
      profileMap[p.symbol] = p
    }

    // Build sector segments
    const sectorMap = {}
    const countryMap = {}
    for (const h of portfolioStore.holdings) {
      const profile = profileMap[h.ticker]
      const sector = profile?.sector || 'Unknown'
      const country = profile?.country || 'Unknown'
      sectorMap[sector] = (sectorMap[sector] || 0) + h.marketValue
      countryMap[country] = (countryMap[country] || 0) + h.marketValue
    }

    sectorSegments.value = Object.entries(sectorMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)

    countrySegments.value = Object.entries(countryMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)

    // --- By Stock Pie Chart ---
    stockSegments.value = portfolioStore.holdings
      .map(h => ({ label: h.ticker, value: h.marketValue }))
      .sort((a, b) => b.value - a.value)

    // --- By Asset Class Pie Chart ---
    const acMap = {}
    acMap['Cash'] = portfolioStore.cashBalance
    for (const h of portfolioStore.holdings) {
      acMap['Stock'] = (acMap['Stock'] || 0) + h.marketValue
    }
    assetClassSegments.value = Object.entries(acMap)
      .filter(([, v]) => v > 0)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
  } finally {
    chartsLoading.value = false
  }
}

// --- Compare Teams ---
const GROUP_COLORS = ['primary', 'secondary', 'accent', 'info', 'success', 'warning', 'error', 'neutral1', 'neutral2', 'neutral3']

async function loadClassGroups() {
  if (!membership.value?.class_id) return
  const { data } = await supabase
    .from('groups')
    .select('*, portfolios(id, cash_balance, starting_cash, created_at)')
    .eq('class_id', membership.value.class_id)
  if (!data) return
  classGroups.value = data
  // My group always selected
  selectedGroupIds.value = [membership.value.group_id]
  await buildComparisonDatasets()
}

function toggleGroupComparison(groupId) {
  if (groupId === membership.value.group_id) return // can't deselect own group
  const idx = selectedGroupIds.value.indexOf(groupId)
  if (idx >= 0) {
    selectedGroupIds.value.splice(idx, 1)
  } else {
    selectedGroupIds.value.push(groupId)
  }
  buildComparisonDatasets()
}

async function buildComparisonDatasets() {
  loadingComparison.value = true
  try {
    const datasets = []
    const startCash = portfolioStore.startingCash

    for (let gi = 0; gi < selectedGroupIds.value.length; gi++) {
      const gid = selectedGroupIds.value[gi]
      const group = classGroups.value.find(g => g.id === gid)
      if (!group) continue

      const portfolio = group.portfolios?.[0]
      if (!portfolio) continue

      const gStartCash = portfolio.starting_cash || startCash

      // Fetch current group portfolio value
      let currentValue = gStartCash
      if (gid === membership.value.group_id) {
        currentValue = portfolioStore.totalMarketValue
      } else {
        // Query holdings for this group's portfolio to estimate value
        const { data: holdings } = await supabase
          .from('holdings')
          .select('ticker, shares, avg_cost')
          .eq('portfolio_id', portfolio.id)

        let holdingsValue = 0
        if (holdings?.length > 0) {
          // Approximate using our cached prices if available
          for (const h of holdings) {
            const ourHolding = portfolioStore.holdings.find(oh => oh.ticker === h.ticker)
            const price = ourHolding?.currentPrice || h.avg_cost
            holdingsValue += Number(h.shares) * price
          }
        }
        currentValue = (portfolio.cash_balance || 0) + holdingsValue
      }

      const synth = generateSyntheticHistory(portfolio.created_at, null, gStartCash, currentValue, gid)
      const colorIdx = gi % GROUP_COLORS.length
      datasets.push({
        label: group.name,
        data: synth,
        color: GROUP_COLORS[colorIdx]
      })
    }

    // Add SPY line
    const spyEnd = startCash * (1 + portfolioStore.benchmarkReturnPct / 100)
    const createdAt = portfolioStore.portfolio?.created_at
    const synthSpy = generateSyntheticHistory(createdAt, null, startCash, spyEnd, 'spy-compare')
    datasets.push({ label: portfolioStore.benchmarkTicker, data: synthSpy, color: 'sp500' })

    comparisonDatasets.value = datasets
  } finally {
    loadingComparison.value = false
  }
}

async function handleStartInvesting() {
  creatingPortfolio.value = true
  const result = await portfolioStore.createPersonalPortfolio()
  if (result.error) {
    creatingPortfolio.value = false
    return
  }
  await portfolioStore.loadPortfolio('user', auth.currentUser?.id)
  membership.value = { group_id: 'personal', group: { name: 'My Portfolio' } }
  groupMembers.value = [{ id: auth.currentUser.id, full_name: auth.profile?.full_name }]
  settingsForm.value = {
    name: portfolioStore.portfolio?.name || '',
    description: portfolioStore.portfolio?.description || '',
    benchmark: portfolioStore.benchmarkTicker,
    isPublic: portfolioStore.portfolio?.is_public ?? true
  }
  creatingPortfolio.value = false
}

function showFeedback(msg, type = 'success') {
  settingsMsg.value = msg
  settingsMsgType.value = type
  setTimeout(() => { settingsMsg.value = '' }, 3000)
}

async function saveBenchmark() {
  const ticker = settingsForm.value.benchmark.toUpperCase().trim()
  if (!ticker) return
  const result = await portfolioStore.changeBenchmark(ticker)
  if (result.error) return showFeedback(result.error, 'error')
  showFeedback(`Benchmark changed to ${ticker}`)
}

async function toggleVisibility() {
  const result = await portfolioStore.setPublic(settingsForm.value.isPublic)
  if (result.error) return showFeedback(result.error, 'error')
  showFeedback(settingsForm.value.isPublic ? 'Portfolio is now public' : 'Portfolio is now private')
}

async function saveMeta() {
  const result = await portfolioStore.updatePortfolioMeta(
    settingsForm.value.name,
    settingsForm.value.description
  )
  if (result.error) return showFeedback(result.error, 'error')
  showFeedback('Portfolio info saved')
}

async function handleReset() {
  resetting.value = true
  const result = await portfolioStore.resetPortfolio()
  showResetConfirm.value = false
  resetting.value = false
  if (result.error) return showFeedback(result.error, 'error')
  settingsForm.value.benchmark = portfolioStore.benchmarkTicker
  showFeedback('Portfolio has been reset!')
}

async function handleClose() {
  closing.value = true
  const result = await portfolioStore.closePortfolio()
  showCloseConfirm.value = false
  closing.value = false
  if (result.error) return showFeedback(result.error, 'error')
  // Update settings form for the new portfolio
  if (portfolioStore.portfolio) {
    settingsForm.value = {
      name: portfolioStore.portfolio.name || '',
      description: portfolioStore.portfolio.description || '',
      benchmark: portfolioStore.benchmarkTicker,
      isPublic: portfolioStore.portfolio.is_public ?? true
    }
  }
  // Switch to personal tab
  activeTab.value = 'personal'
  // Reload charts
  performanceDatasets.value = []
  sectorSegments.value = []
  countrySegments.value = []
  showFeedback('Portfolio closed. New portfolio created!')
}

async function switchTab(tab) {
  if (tab === activeTab.value) return
  activeTab.value = tab
  switchingTab.value = true
  try {
    if (tab === 'personal') {
      await portfolioStore.loadPortfolio('user', auth.currentUser.id)
    } else {
      await portfolioStore.loadPortfolio('group', membership.value.group_id)
    }
    // Update settings form for the new portfolio
    if (portfolioStore.portfolio) {
      settingsForm.value = {
        name: portfolioStore.portfolio.name || '',
        description: portfolioStore.portfolio.description || '',
        benchmark: portfolioStore.benchmarkTicker,
        isPublic: portfolioStore.portfolio.is_public ?? true
      }
    }
    // Reload charts
    performanceDatasets.value = []
    portfolioValueDatasets.value = []
    relativeToSpyDatasets.value = []
    sectorSegments.value = []
    countrySegments.value = []
    stockSegments.value = []
    assetClassSegments.value = []
    comparisonDatasets.value = []
    if (portfolioStore.holdings.length > 0) {
      loadCharts()
    }
  } finally {
    switchingTab.value = false
  }
}

async function dismissBonus() {
  showBonusModal.value = false
  if (membership.value?.group_id) {
    // Mark notifications as seen
    const { data: notifications } = await supabase
      .from('notifications')
      .select('id, seen_by')
      .eq('group_id', membership.value.group_id)

    for (const n of (notifications || [])) {
      const seenBy = n.seen_by || []
      if (!seenBy.includes(auth.currentUser.id)) {
        await supabase
          .from('notifications')
          .update({ seen_by: [...seenBy, auth.currentUser.id] })
          .eq('id', n.id)
      }
    }
  }
}
</script>
