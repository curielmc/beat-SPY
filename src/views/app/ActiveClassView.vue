<template>
  <div class="space-y-6">
    <h1 class="text-xl font-bold">Active Class</h1>

    <!-- Multi-class tabs -->
    <div v-if="auth.allMemberships.length > 0" class="tabs tabs-bordered">
      <a
        v-for="m in auth.allMemberships"
        :key="m.class_id"
        class="tab"
        :class="{ 'tab-active': m.class_id === auth.activeClassId }"
        @click="switchClass(m.class_id)"
      >
        {{ (m.class?.name || m.class?.class_name || 'Class').slice(0, 20) }}
        <span v-if="!m.group_id" class="ml-1" title="No group yet">&#128339;</span>
      </a>
      <RouterLink to="/join" class="tab">+</RouterLink>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="!membership" class="text-center py-12 text-base-content/60">
      <p>You are not currently in a class.</p>
      <RouterLink to="/join" class="btn btn-primary btn-sm mt-4">Join a Class</RouterLink>
    </div>

    <template v-else>
      <!-- Class Info Card -->
      <div class="card bg-base-100 shadow">
        <div class="card-body p-4 space-y-1">
          <h2 class="card-title text-lg">{{ membership.class.name }}</h2>
          <p v-if="membership.class.school" class="text-sm text-base-content/60">{{ membership.class.school }}</p>
          <p class="text-sm text-base-content/60">Teacher: {{ teacherName || 'Loading...' }}</p>
          <p class="text-xs text-base-content/40 font-mono">Code: {{ membership.class.code }}</p>
        </div>
      </div>

      <!-- My Group Card -->
      <div v-if="membership.group" class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <h2 class="font-semibold">My Group: {{ membership.group.name }}</h2>
          <div v-if="groupMembers.length" class="flex flex-wrap gap-3 mt-2">
            <div v-for="member in groupMembers" :key="member.id" class="flex items-center gap-2">
              <div :class="['avatar', !member.avatar_url && 'placeholder']">
                <div class="bg-primary text-primary-content rounded-full w-8 h-8">
                  <img v-if="member.avatar_url" :src="member.avatar_url" :alt="member.full_name" class="rounded-full object-cover w-full h-full" />
                  <span v-else class="text-xs">{{ (member.full_name || '?')[0].toUpperCase() }}</span>
                </div>
              </div>
              <span class="text-sm">{{ member.full_name }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Class Rules -->
      <div class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <h2 class="font-semibold">Class Rules</h2>
          <div class="grid grid-cols-2 gap-2 mt-2 text-sm">
            <div>
              <span class="text-base-content/60">Starting Cash</span>
              <p class="font-medium">${{ Number(membership.class.starting_cash || 100000).toLocaleString() }}</p>
            </div>
            <div>
              <span class="text-base-content/60">Approval Code</span>
              <p class="font-medium">{{ membership.class.require_approval ? 'Required' : 'Not required' }}</p>
            </div>
            <div>
              <span class="text-base-content/60">Portfolio Reset</span>
              <p class="font-medium">{{ membership.class.allow_reset ? 'Allowed' : 'Not allowed' }}</p>
            </div>
            <div>
              <span class="text-base-content/60">Group Mode</span>
              <p class="font-medium capitalize">{{ (membership.class.group_mode || 'none').replace('_', ' ') }}</p>
            </div>
            <div>
              <span class="text-base-content/60">Trade Frequency</span>
              <p class="font-medium">{{ tradeFrequencyLabel }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Class Leaderboard -->
      <div class="space-y-4">
        <h2 class="font-semibold text-lg">Class Leaderboard</h2>

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

        <div v-if="leaderboardLoading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md"></span>
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
                <template v-if="activeBenchmarkValue === null">
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
              :is-me="group.id === membership.group_id"
              :benchmark-value="activeBenchmarkValue"
              :metric-loading="false"
            />
          </div>

          <p v-if="sortedGroups.length === 0" class="text-center text-base-content/50 py-8">No groups found in your class.</p>
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
import { useMarketDataStore } from '../../stores/marketData'
import { supabase } from '../../lib/supabase'
import LeaderboardEntry from '../../components/LeaderboardEntry.vue'
import {
  computeTodayReturn,
  computeAnnualizedReturn
} from '../../utils/leaderboardMetrics'

const auth = useAuthStore()
const portfolioStore = usePortfolioStore()
const market = useMarketDataStore()

const loading = ref(true)
const membership = ref(null)
const teacherName = ref('')
const groupMembers = ref([])

// Leaderboard state
const leaderboardLoading = ref(true)
const groups = ref([])
const benchmarkMetrics = ref({})
const activeMetric = ref('sinceInception')

const metrics = [
  { key: 'sinceInception', label: 'Since Inception' },
  { key: 'today', label: 'Today' },
  { key: 'annualized', label: 'Annualized' }
]

const tradeFrequencyLabel = computed(() => {
  const freq = membership.value?.class?.restrictions?.tradeFrequency
  const labels = {
    once_per_day: 'Once per day',
    once_per_week: 'Once per week',
    once_per_month: 'Once per month'
  }
  return labels[freq] || 'Unlimited'
})

const activeBenchmarkValue = computed(() => benchmarkMetrics.value[activeMetric.value] ?? null)

const sortedGroups = computed(() => {
  return [...groups.value].sort((a, b) => {
    const aVal = a.metrics?.[activeMetric.value] ?? -Infinity
    const bVal = b.metrics?.[activeMetric.value] ?? -Infinity
    return bVal - aVal
  })
})

async function loadClassData(m) {
  membership.value = m

  if (!m?.class_id) {
    loading.value = false
    leaderboardLoading.value = false
    return
  }

  loading.value = false
  teacherName.value = ''
  groupMembers.value = []
  groups.value = []
  leaderboardLoading.value = true

  // Fetch teacher name
  if (m.class.teacher_id) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', m.class.teacher_id)
      .maybeSingle()
    teacherName.value = data?.full_name || 'Unknown'
  }

  // Fetch group members
  if (m.group_id) {
    groupMembers.value = await auth.getGroupMembers(m.group_id)
  }

  // Leaderboard
  await loadLeaderboard(m.class_id)
}

async function switchClass(classId) {
  auth.setActiveClass(classId)
  loading.value = true
  leaderboardLoading.value = true
  const m = auth.membership
  await loadClassData(m)
}

onMounted(async () => {
  const m = await auth.getCurrentMembership()
  await loadClassData(m)
})

async function loadLeaderboard(classId) {
  const { data: groupData } = await supabase
    .from('groups')
    .select('*, memberships:class_memberships(user_id, profiles:profiles(full_name))')
    .eq('class_id', classId)

  if (!groupData?.length) {
    leaderboardLoading.value = false
    return
  }

  const groupIds = groupData.map(g => g.id)
  const { portfolios, holdingsMap } = await portfolioStore.getLeaderboardData(groupIds)

  const portfolioByGroup = {}
  for (const p of portfolios) {
    portfolioByGroup[p.owner_id] = p
  }

  const allTickers = new Set()
  for (const holdings of Object.values(holdingsMap)) {
    for (const h of holdings) allTickers.add(h.ticker)
  }
  allTickers.add('SPY')
  await market.fetchBatchQuotes([...allTickers])

  const enriched = []
  for (const group of groupData) {
    const p = portfolioByGroup[group.id]
    const pHoldings = p ? (holdingsMap[p.id] || []) : []
    const startingCash = p ? Number(p.starting_cash) : 100000
    const cashBalance = p ? Number(p.cash_balance) : 100000

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

    const createdAt = p?.created_at || new Date().toISOString()
    const annualized = computeAnnualizedReturn(sinceInception, createdAt)

    enriched.push({
      ...group,
      portfolioId: p?.id,
      totalValue,
      metrics: { sinceInception, today, annualized },
      memberNames: (group.memberships || []).map(m => m.profiles?.full_name?.split(' ')[0]).filter(Boolean)
    })
  }

  groups.value = enriched

  // SPY benchmark
  const spyQuote = market.getCachedQuote('SPY')
  if (spyQuote) {
    benchmarkMetrics.value.sinceInception = portfolioStore.benchmarkReturnPct
    const spyPrevClose = spyQuote.previousClose || spyQuote.price
    benchmarkMetrics.value.today = spyPrevClose > 0 ? ((spyQuote.price - spyPrevClose) / spyPrevClose) * 100 : 0
    benchmarkMetrics.value.annualized = benchmarkMetrics.value.sinceInception
  }

  leaderboardLoading.value = false
}
</script>
