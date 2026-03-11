<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          Admin Dashboard
        </h1>
        <p class="text-base-content/70">Platform overview and statistics</p>
      </div>
      <button class="btn btn-primary btn-sm gap-2" @click="showNotesModal = true" :disabled="loading">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        Generate Class Notes
      </button>
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
        <div class="card bg-base-100 shadow border border-base-200">
          <div class="card-body">
            <h2 class="card-title text-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              Signups per Week
            </h2>
            <div style="height: 220px; position: relative;">
              <Bar v-if="signupChartData" :data="signupChartData" :options="barOptions" />
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow border border-base-200">
          <div class="card-body">
            <h2 class="card-title text-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              Trading Volume per Week
            </h2>
            <div style="height: 220px; position: relative;">
              <Bar v-if="tradeVolumeChartData" :data="tradeVolumeChartData" :options="barOptions" />
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Top Traded Tickers -->
        <div class="card bg-base-100 shadow border border-base-200">
          <div class="card-body">
            <h2 class="card-title text-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              Top Traded Tickers (This Week)
            </h2>
            <div v-if="topTickers.length === 0" class="text-base-content/50">No trades this week</div>
            <table class="table table-sm table-zebra">
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
        <div class="card bg-base-100 shadow border border-base-200">
          <div class="card-body">
            <h2 class="card-title text-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              Users by Role
            </h2>
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
      <div class="card bg-base-100 shadow border border-base-200">
        <div class="card-body">
          <h2 class="card-title text-lg flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Recent Activity
          </h2>
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

    <!-- Class Notes Modal -->
    <dialog :class="['modal', showNotesModal && 'modal-open']">
      <div class="modal-box max-w-3xl max-h-[85vh]">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" @click="showNotesModal = false">X</button>
        <h3 class="font-bold text-lg flex items-center gap-2 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Generate Class Notes
        </h3>

        <div v-if="!classNotes" class="space-y-4">
          <div class="form-control">
            <label class="label"><span class="label-text font-medium">Class</span></label>
            <select v-model="notesClassId" class="select select-bordered select-sm" @change="loadGroupsForClass">
              <option value="">Select a class</option>
              <option v-for="c in allClasses" :key="c.id" :value="c.id">{{ c.class_name }} ({{ c.school }})</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text font-medium">Start Date</span></label>
              <input type="date" v-model="notesDateStart" class="input input-bordered input-sm" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text font-medium">End Date</span></label>
              <input type="date" v-model="notesDateEnd" class="input input-bordered input-sm" />
            </div>
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text font-medium">Focus on Group</span></label>
            <select v-model="notesGroupId" class="select select-bordered select-sm">
              <option value="">All Groups</option>
              <option v-for="g in notesGroups" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
          </div>

          <div class="flex gap-2 mt-2">
            <button class="btn btn-sm btn-ghost" @click="setNotesDateRange(7)">Last 7 days</button>
            <button class="btn btn-sm btn-ghost" @click="setNotesDateRange(14)">Last 14 days</button>
            <button class="btn btn-sm btn-ghost" @click="setNotesDateRange(30)">Last 30 days</button>
          </div>

          <button class="btn btn-primary w-full" :disabled="generatingNotes || !notesClassId" @click="generateNotes">
            <span v-if="generatingNotes" class="loading loading-spinner loading-sm"></span>
            <span v-else>Generate Notes</span>
          </button>

          <p v-if="notesError" class="text-error text-sm">{{ notesError }}</p>
        </div>

        <div v-else class="space-y-4">
          <div class="flex items-center justify-between">
            <p class="text-sm text-base-content/60">{{ notesMeta }}</p>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-outline" @click="copyNotes">{{ notesCopied ? 'Copied!' : 'Copy' }}</button>
              <button class="btn btn-sm btn-ghost" @click="classNotes = null">Regenerate</button>
            </div>
          </div>
          <div class="prose prose-sm max-w-none overflow-y-auto max-h-[55vh] bg-base-200/50 rounded-lg p-4" v-html="renderedNotes"></div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showNotesModal = false"><button>close</button></form>
    </dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
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

// Class Notes state
const showNotesModal = ref(false)
const generatingNotes = ref(false)
const classNotes = ref(null)
const notesMeta = ref('')
const notesError = ref('')
const notesCopied = ref(false)
const allClasses = ref([])
const notesGroups = ref([])
const notesClassId = ref('')
const notesGroupId = ref('')
const todayStr = new Date().toISOString().split('T')[0]
const sevenAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
const notesDateStart = ref(sevenAgoStr)
const notesDateEnd = ref(todayStr)

function setNotesDateRange(days) {
  notesDateStart.value = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  notesDateEnd.value = new Date().toISOString().split('T')[0]
}

async function loadGroupsForClass() {
  notesGroupId.value = ''
  if (!notesClassId.value) { notesGroups.value = []; return }
  const { data } = await supabase.from('groups').select('id, name').eq('class_id', notesClassId.value)
  notesGroups.value = data || []
}

async function generateNotes() {
  if (!notesClassId.value) return
  generatingNotes.value = true
  notesError.value = ''
  classNotes.value = null

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { notesError.value = 'Not logged in'; generatingNotes.value = false; return }

  try {
    const body = {
      class_id: notesClassId.value,
      date_start: new Date(notesDateStart.value).toISOString(),
      date_end: new Date(notesDateEnd.value + 'T23:59:59').toISOString()
    }
    if (notesGroupId.value) body.group_id = notesGroupId.value

    const res = await fetch('/api/generate-class-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify(body)
    })

    const data = await res.json()
    if (!res.ok) {
      notesError.value = data.error || 'Failed to generate notes'
    } else {
      classNotes.value = data.notes
      notesMeta.value = `${data.period} | ${data.groups_analyzed} groups | ${data.tickers_tracked} stocks tracked`
    }
  } catch (err) {
    notesError.value = 'Server error — the request may have timed out. Try a shorter date range or a single group.'
  }
  generatingNotes.value = false
}

function copyNotes() {
  if (classNotes.value) {
    navigator.clipboard.writeText(classNotes.value)
    notesCopied.value = true
    setTimeout(() => { notesCopied.value = false }, 2000)
  }
}

const renderedNotes = computed(() => {
  if (!classNotes.value) return ''
  return classNotes.value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
})

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
    // Load classes for class notes feature
    const { data: classData } = await supabase.from('classes').select('id, class_name, school')
    allClasses.value = classData || []

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
