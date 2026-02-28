<template>
  <!-- Unassigned State -->
  <div v-if="!auth.currentUser?.groupId" class="flex flex-col items-center justify-center py-20 space-y-4">
    <div class="text-6xl">⏳</div>
    <h2 class="text-2xl font-bold">Waiting for Group Assignment</h2>
    <p class="text-base-content/60 text-center max-w-md">Your teacher hasn't assigned you to a group yet. Check back soon or explore the stocks page in the meantime!</p>
    <RouterLink to="/stocks" class="btn btn-primary">Browse Stocks</RouterLink>
  </div>

  <!-- Bonus Cash Notification Modal -->
  <dialog ref="bonusModal" class="modal" :class="{ 'modal-open': showBonusModal }">
    <div class="modal-box text-center">
      <div class="text-6xl mb-4">🎉</div>
      <h3 class="font-bold text-2xl mb-2">Congratulations!</h3>
      <p class="text-lg text-base-content/70 mb-4">Your team received a bonus of</p>
      <p class="text-4xl font-bold text-success mb-4">${{ bonusTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
      <p class="text-base-content/50 mb-6">from your teacher! Use it wisely.</p>
      <button class="btn btn-primary btn-block" @click="dismissBonus">Awesome!</button>
    </div>
    <form method="dialog" class="modal-backdrop" @click="dismissBonus"><button>close</button></form>
  </dialog>

  <div v-if="auth.currentUser?.groupId" class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold">{{ auth.currentGroup?.name || 'My Portfolio' }}</h1>
        <p class="text-sm text-base-content/60">{{ auth.currentUser?.name }}</p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <div v-for="member in auth.groupMembers" :key="member.id" class="badge badge-sm" :class="member.id === auth.currentUser?.id ? 'badge-primary' : 'badge-ghost'">
          {{ member.name.split(' ')[0] }}
        </div>
      </div>
    </div>

    <!-- Two Key Stats -->
    <div class="grid grid-cols-2 gap-3">
      <div class="card bg-base-100 shadow">
        <div class="card-body p-3">
          <p class="text-xs text-base-content/60">Total Gain/Loss</p>
          <p class="text-xl font-bold" :class="portfolio.totalReturnDollar >= 0 ? 'text-success' : 'text-error'">
            {{ portfolio.totalReturnDollar >= 0 ? '+' : '-' }}${{ Math.abs(portfolio.totalReturnDollar).toLocaleString('en-US', { maximumFractionDigits: 0 }) }}
          </p>
          <p class="text-xs" :class="portfolio.totalReturnPct >= 0 ? 'text-success' : 'text-error'">
            {{ portfolio.totalReturnPct >= 0 ? '+' : '' }}{{ portfolio.totalReturnPct.toFixed(2) }}%
          </p>
        </div>
      </div>
      <div class="card bg-base-100 shadow">
        <div class="card-body p-3">
          <p class="text-xs text-base-content/60">vs S&P 500</p>
          <p class="text-xl font-bold" :class="vsSP500 >= 0 ? 'text-success' : 'text-error'">
            {{ vsSP500 >= 0 ? '+' : '' }}{{ vsSP500.toFixed(2) }}%
          </p>
          <p class="text-xs text-base-content/50">
            {{ portfolio.isBeatingSP500 ? 'Beating the market' : 'Behind the market' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Time Range Selector (shared) -->
    <div class="flex justify-end">
      <TimeRangeSelector v-model="timeRange" />
    </div>

    <!-- Two Line Charts Side by Side -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div class="card bg-base-100 shadow">
        <div class="card-body p-3">
          <h3 class="font-semibold text-sm">Portfolio Value</h3>
          <PortfolioLineChart :datasets="portfolioDatasets" :time-range="timeRange" height="220px" />
        </div>
      </div>
      <div class="card bg-base-100 shadow">
        <div class="card-body p-3">
          <h3 class="font-semibold text-sm">Relative to S&P 500</h3>
          <PortfolioLineChart :datasets="relativeDatasets" :time-range="timeRange" :show-percentage="true" height="220px" />
        </div>
      </div>
    </div>

    <!-- Compare Teams -->
    <div class="card bg-base-100 shadow">
      <div class="card-body p-3">
        <h3 class="font-semibold text-sm mb-2">Compare Teams</h3>
        <div class="flex flex-wrap gap-1 mb-2">
          <button
            v-for="g in classGroups"
            :key="g.id"
            class="btn btn-xs"
            :class="selectedGroups.includes(g.id) ? 'btn-primary' : 'btn-ghost'"
            :disabled="g.id === myGroupId"
            @click="toggleGroup(g.id)"
          >{{ g.name }}</button>
        </div>
        <PortfolioLineChart :datasets="comparisonDatasets" :time-range="timeRange" height="200px" />
      </div>
    </div>

    <!-- 4 Pie Charts -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <PortfolioPieChart title="By Stock" :segments="stockSegments" height="160px" />
      <PortfolioPieChart title="By Sector" :segments="sectorSegments" height="160px" />
      <PortfolioPieChart title="By Country" :segments="countrySegments" height="160px" />
      <PortfolioPieChart title="By Asset Class" :segments="assetClassSegments" height="160px" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { usePortfolioStore } from '../../stores/portfolio'
import { useHistoricalDataStore } from '../../stores/historicalData'
import { useNotificationsStore } from '../../stores/notifications'
import stocksData from '../../mock/stocks.json'
import PortfolioLineChart from '../../components/charts/PortfolioLineChart.vue'
import PortfolioPieChart from '../../components/charts/PortfolioPieChart.vue'
import TimeRangeSelector from '../../components/charts/TimeRangeSelector.vue'

const auth = useAuthStore()
const portfolio = usePortfolioStore()
const histStore = useHistoricalDataStore()
const notificationsStore = useNotificationsStore()

const timeRange = ref('3M')
const myGroupId = auth.currentUser?.groupId
const showBonusModal = ref(false)
const bonusTotal = ref(0)

onMounted(() => {
  if (!myGroupId) return
  const unseen = notificationsStore.getUnseenForGroup(myGroupId)
  if (unseen.length > 0) {
    bonusTotal.value = unseen.reduce((sum, n) => sum + n.amount, 0)
    showBonusModal.value = true
  }
})

function dismissBonus() {
  showBonusModal.value = false
  if (myGroupId) notificationsStore.markAllSeenForGroup(myGroupId)
}

const vsSP500 = computed(() => portfolio.totalReturnPct - portfolio.SP500_RETURN_PCT)

// Line chart datasets
const portfolioDatasets = computed(() => [
  { label: auth.currentGroup?.name || 'My Team', data: histStore.getGroupHistory(myGroupId), color: 'primary' },
  { label: 'S&P 500', data: histStore.sp500History, color: 'sp500' }
])

const relativeDatasets = computed(() => {
  const groupHist = histStore.getGroupHistory(myGroupId)
  const sp500Hist = histStore.sp500History
  const relativeData = groupHist.map((point, i) => {
    const sp = sp500Hist[i]
    if (!sp) return { date: point.date, value: point.value }
    const groupPct = ((point.value - 100000) / 100000) * 100
    const spPct = ((sp.value - 100000) / 100000) * 100
    return { date: point.date, value: 100000 + (groupPct - spPct) * 1000 }
  })
  return [{ label: 'vs S&P 500', data: relativeData, color: 'primary' }]
})

// Team comparison
const classGroups = computed(() =>
  auth.groups.filter(g => g.teacherCode === auth.currentUser?.teacherCode)
)
const selectedGroups = ref([myGroupId])

function toggleGroup(id) {
  if (id === myGroupId) return
  const idx = selectedGroups.value.indexOf(id)
  if (idx === -1) selectedGroups.value.push(id)
  else selectedGroups.value.splice(idx, 1)
}

const TEAM_COLORS = ['primary', 'secondary', 'accent', 'info', 'success']
const comparisonDatasets = computed(() => {
  const ds = selectedGroups.value.map((gId, i) => ({
    label: auth.groups.find(g => g.id === gId)?.name || gId,
    data: histStore.getGroupHistory(gId),
    color: TEAM_COLORS[i % TEAM_COLORS.length]
  }))
  ds.push({ label: 'S&P 500', data: histStore.sp500History, color: 'sp500' })
  return ds
})

// Pie chart data: compute holdings with enriched stock info
const enrichedHoldings = computed(() => {
  if (!portfolio.portfolio) return []
  return portfolio.portfolio.holdings.map(h => {
    const stock = stocksData.find(s => s.ticker === h.ticker)
    return {
      ticker: h.ticker,
      marketValue: h.shares * (stock?.price || 0),
      sector: stock?.sector || 'Unknown',
      country: stock?.country || 'Unknown',
      assetType: stock?.assetType || 'Stock'
    }
  })
})

const stockSegments = computed(() =>
  enrichedHoldings.value.map(h => ({ label: h.ticker, value: h.marketValue }))
)

const sectorSegments = computed(() => {
  const map = {}
  enrichedHoldings.value.forEach(h => {
    map[h.sector] = (map[h.sector] || 0) + h.marketValue
  })
  return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
})

const countrySegments = computed(() => {
  const map = {}
  enrichedHoldings.value.forEach(h => {
    map[h.country] = (map[h.country] || 0) + h.marketValue
  })
  return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
})

const assetClassSegments = computed(() => {
  const map = { Cash: portfolio.portfolio?.cashBalance || 0 }
  enrichedHoldings.value.forEach(h => {
    map[h.assetType] = (map[h.assetType] || 0) + h.marketValue
  })
  return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
})
</script>
