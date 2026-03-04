<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Admin Dashboard</h1>
      <p class="text-base-content/70">Platform overview and statistics</p>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <!-- Summary Stats -->
      <div class="stats shadow bg-base-100 w-full flex-wrap">
        <div class="stat">
          <div class="stat-title">Total Users</div>
          <div class="stat-value">{{ stats.totalUsers }}</div>
          <div class="stat-desc">{{ stats.students }} students, {{ stats.teachers }} teachers</div>
        </div>
        <div class="stat">
          <div class="stat-title">Classes</div>
          <div class="stat-value">{{ stats.totalClasses }}</div>
        </div>
        <div class="stat">
          <div class="stat-title">Portfolios</div>
          <div class="stat-value">{{ stats.totalPortfolios }}</div>
        </div>
        <div class="stat">
          <div class="stat-title">Trades Executed</div>
          <div class="stat-value">{{ stats.totalTrades }}</div>
        </div>
      </div>

      <!-- Active Users -->
      <div class="stats shadow bg-base-100 w-full flex-wrap">
        <div class="stat">
          <div class="stat-title">Active (7 days)</div>
          <div class="stat-value text-primary">{{ activeUsers.last7 }}</div>
          <div class="stat-desc">Users who traded in last 7 days</div>
        </div>
        <div class="stat">
          <div class="stat-title">Active (30 days)</div>
          <div class="stat-value text-secondary">{{ activeUsers.last30 }}</div>
          <div class="stat-desc">Users who traded in last 30 days</div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h2 class="card-title text-lg">Signups per Week (Last 12 Weeks)</h2>
            <div style="height: 220px; position: relative;">
              <Bar v-if="signupChartData" :data="signupChartData" :options="barOptions" />
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h2 class="card-title text-lg">Trading Volume per Week (Last 12 Weeks)</h2>
            <div style="height: 220px; position: relative;">
              <Bar v-if="tradeVolumeChartData" :data="tradeVolumeChartData" :options="barOptions" />
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Top Traded Tickers -->
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h2 class="card-title text-lg">Top Traded Tickers (This Week)</h2>
            <div v-if="topTickers.length === 0" class="text-base-content/50">No trades this week</div>
            <table v-else class="table table-sm">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th class="text-right">Trades</th>
                  <th class="text-right">Volume ($)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in topTickers" :key="t.ticker">
                  <td class="font-mono font-bold">{{ t.ticker }}</td>
                  <td class="text-right">{{ t.count }}</td>
                  <td class="text-right font-mono">${{ Number(t.totalDollars).toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Users by Role -->
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h2 class="card-title text-lg">Users by Role</h2>
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <span>Students</span>
                <span class="badge badge-primary">{{ stats.students }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span>Teachers</span>
                <span class="badge badge-secondary">{{ stats.teachers }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span>Admins</span>
                <span class="badge badge-error">{{ stats.admins }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <h2 class="card-title text-lg">Recent Activity</h2>
          <div v-if="recentTrades.length === 0" class="text-base-content/50">No trades yet</div>
          <div v-for="trade in recentTrades" :key="trade.id" class="flex justify-between items-center text-sm border-b border-base-200 pb-1">
            <div>
              <span class="font-mono font-bold">{{ trade.ticker }}</span>
              <span class="badge badge-xs ml-1" :class="trade.side === 'buy' ? 'badge-success' : 'badge-error'">{{ trade.side }}</span>
            </div>
            <span class="font-mono">${{ Number(trade.dollars).toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { supabase } from '../../lib/supabase'

ChartJS.register(BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend)

const loading = ref(true)
const stats = ref({ totalUsers: 0, students: 0, teachers: 0, admins: 0, totalClasses: 0, totalPortfolios: 0, totalTrades: 0 })
const recentTrades = ref([])
const activeUsers = ref({ last7: 0, last30: 0 })
const signupChartData = ref(null)
const tradeVolumeChartData = ref(null)
const topTickers = ref([])

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { mode: 'index' }
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    y: { beginAtZero: true, ticks: { font: { size: 10 }, precision: 0 }, grid: { color: 'rgba(128,128,128,0.1)' } }
  }
}

function getWeekLabel(date) {
  const d = new Date(date)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function getWeekBuckets(count = 12) {
  const weeks = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(now)
    start.setDate(now.getDate() - (i + 1) * 7)
    const end = new Date(now)
    end.setDate(now.getDate() - i * 7)
    weeks.push({ start, end, label: getWeekLabel(start) })
  }
  return weeks
}

function bucketByWeek(items, dateField, weeks) {
  const counts = new Array(weeks.length).fill(0)
  for (const item of items) {
    const d = new Date(item[dateField])
    for (let i = 0; i < weeks.length; i++) {
      if (d >= weeks[i].start && d < weeks[i].end) {
        counts[i]++
        break
      }
    }
  }
  return counts
}

onMounted(async () => {
  try {
    const now = new Date()
    const ago7 = new Date(now); ago7.setDate(now.getDate() - 7)
    const ago30 = new Date(now); ago30.setDate(now.getDate() - 30)
    const ago12w = new Date(now); ago12w.setDate(now.getDate() - 84)
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7)

    const [profiles, classesRes, portfoliosRes, tradesRes, recentRes, trades12w, activeRes7, activeRes30, weekTrades] = await Promise.all([
      supabase.from('profiles').select('role, created_at'),
      supabase.from('classes').select('id', { count: 'exact', head: true }),
      supabase.from('portfolios').select('id', { count: 'exact', head: true }),
      supabase.from('trades').select('id', { count: 'exact', head: true }),
      supabase.from('trades').select('*').order('executed_at', { ascending: false }).limit(10),
      supabase.from('trades').select('executed_at').gte('executed_at', ago12w.toISOString()),
      supabase.from('trades').select('portfolio_id').gte('executed_at', ago7.toISOString()),
      supabase.from('trades').select('portfolio_id').gte('executed_at', ago30.toISOString()),
      supabase.from('trades').select('ticker, dollars').gte('executed_at', weekStart.toISOString())
    ])

    const roles = profiles.data || []
    stats.value = {
      totalUsers: roles.length,
      students: roles.filter(p => p.role === 'student').length,
      teachers: roles.filter(p => p.role === 'teacher').length,
      admins: roles.filter(p => p.role === 'admin').length,
      totalClasses: classesRes.count || 0,
      totalPortfolios: portfoliosRes.count || 0,
      totalTrades: tradesRes.count || 0
    }

    recentTrades.value = recentRes.data || []

    // Active users (unique portfolio_ids as proxy for unique users)
    const unique7 = new Set((activeRes7.data || []).map(t => t.portfolio_id))
    const unique30 = new Set((activeRes30.data || []).map(t => t.portfolio_id))
    activeUsers.value = { last7: unique7.size, last30: unique30.size }

    // Signup trend
    const weeks = getWeekBuckets(12)
    const signupCounts = bucketByWeek(roles, 'created_at', weeks)
    signupChartData.value = {
      labels: weeks.map(w => w.label),
      datasets: [{ label: 'Signups', data: signupCounts, backgroundColor: '#570df8' }]
    }

    // Trade volume trend
    const tradeCounts = bucketByWeek(trades12w.data || [], 'executed_at', weeks)
    tradeVolumeChartData.value = {
      labels: weeks.map(w => w.label),
      datasets: [{ label: 'Trades', data: tradeCounts, backgroundColor: '#f000b8' }]
    }

    // Top traded tickers this week
    const tickerMap = {}
    for (const t of (weekTrades.data || [])) {
      if (!tickerMap[t.ticker]) tickerMap[t.ticker] = { ticker: t.ticker, count: 0, totalDollars: 0 }
      tickerMap[t.ticker].count++
      tickerMap[t.ticker].totalDollars += Math.abs(Number(t.dollars) || 0)
    }
    topTickers.value = Object.values(tickerMap).sort((a, b) => b.count - a.count).slice(0, 10)
  } finally {
    loading.value = false
  }
})
</script>
