<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-2xl font-bold">Trade Audit</h1>
        <p class="text-base-content/70">View and filter all platform trades</p>
      </div>
      <button class="btn btn-sm btn-outline" @click="exportCSV">Export CSV</button>
    </div>

    <!-- Filters -->
    <div class="flex gap-3 flex-wrap">
      <input v-model="filters.ticker" type="text" placeholder="Ticker..." class="input input-bordered input-sm w-32" @input="resetAndFetch" />
      <input v-model="filters.user" type="text" placeholder="User name/email..." class="input input-bordered input-sm w-48" @input="resetAndFetch" />
      <select v-model="filters.side" class="select select-bordered select-sm" @change="resetAndFetch">
        <option value="">All Sides</option>
        <option value="buy">Buy</option>
        <option value="sell">Sell</option>
      </select>
      <input v-model="filters.dateFrom" type="date" class="input input-bordered input-sm" @change="resetAndFetch" />
      <input v-model="filters.dateTo" type="date" class="input input-bordered input-sm" @change="resetAndFetch" />
    </div>

    <div v-if="loading && trades.length === 0" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else class="card bg-base-100 shadow">
      <div class="card-body p-0">
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                <th>Ticker</th>
                <th>Side</th>
                <th class="text-right">Shares</th>
                <th class="text-right">Price</th>
                <th class="text-right">Dollars</th>
                <th>Rationale</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="trade in filteredTrades" :key="trade.id" :class="{ 'bg-warning/10': isLargeTrade(trade) }">
                <td class="text-sm whitespace-nowrap">{{ formatDate(trade.executed_at) }}</td>
                <td class="text-sm">
                  <div>{{ trade.profiles?.full_name || 'N/A' }}</div>
                  <div class="text-xs text-base-content/50">{{ trade.profiles?.email }}</div>
                </td>
                <td class="font-mono font-bold">{{ trade.ticker }}</td>
                <td>
                  <span class="badge badge-xs" :class="trade.side === 'buy' ? 'badge-success' : 'badge-error'">{{ trade.side }}</span>
                </td>
                <td class="text-right font-mono">{{ Number(trade.shares).toFixed(2) }}</td>
                <td class="text-right font-mono">${{ Number(trade.price).toFixed(2) }}</td>
                <td class="text-right font-mono" :class="{ 'text-warning font-bold': isLargeTrade(trade) }">
                  ${{ Math.abs(Number(trade.dollars)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                  <span v-if="isLargeTrade(trade)" class="badge badge-warning badge-xs ml-1">LARGE</span>
                </td>
                <td class="text-sm max-w-[200px] truncate" :title="trade.rationale">{{ trade.rationale || '-' }}</td>
              </tr>
              <tr v-if="filteredTrades.length === 0 && !loading">
                <td colspan="8" class="text-center text-base-content/50">No trades found</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="flex justify-center" v-if="hasMore">
      <button class="btn btn-sm btn-outline" :class="{ loading }" @click="loadMore">
        {{ loading ? 'Loading...' : 'Load More' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'
import { downloadCSV } from '../../utils/csvExport'

const PAGE_SIZE = 50
const trades = ref([])
const loading = ref(true)
const hasMore = ref(true)
const filters = ref({ ticker: '', user: '', side: '', dateFrom: '', dateTo: '' })

// We fetch trades with profile join, but filter user client-side since
// supabase doesn't support filtering on joined columns easily
const filteredTrades = computed(() => {
  let result = trades.value
  if (filters.value.user) {
    const q = filters.value.user.toLowerCase()
    result = result.filter(t =>
      t.profiles?.full_name?.toLowerCase().includes(q) ||
      t.profiles?.email?.toLowerCase().includes(q)
    )
  }
  return result
})

function isLargeTrade(trade) {
  return Math.abs(Number(trade.dollars)) > 10000
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

async function fetchTrades(offset = 0) {
  loading.value = true
  let query = supabase
    .from('trades')
    .select('*, profiles:portfolios!inner(user_id, profiles:profiles!inner(full_name, email))')
    .order('executed_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (filters.value.ticker) {
    query = query.ilike('ticker', `%${filters.value.ticker}%`)
  }
  if (filters.value.side) {
    query = query.eq('side', filters.value.side)
  }
  if (filters.value.dateFrom) {
    query = query.gte('executed_at', filters.value.dateFrom)
  }
  if (filters.value.dateTo) {
    query = query.lte('executed_at', filters.value.dateTo + 'T23:59:59')
  }

  const { data, error } = await query

  if (error) {
    // Fallback: fetch without nested join if the schema doesn't support it
    return fetchTradesSimple(offset)
  }

  const mapped = (data || []).map(t => ({
    ...t,
    profiles: t.profiles?.profiles || t.profiles || {}
  }))

  if (offset === 0) {
    trades.value = mapped
  } else {
    trades.value.push(...mapped)
  }
  hasMore.value = (data || []).length === PAGE_SIZE
  loading.value = false
}

async function fetchTradesSimple(offset = 0) {
  let query = supabase
    .from('trades')
    .select('*, portfolio:portfolios(user_id, user:profiles(full_name, email))')
    .order('executed_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (filters.value.ticker) {
    query = query.ilike('ticker', `%${filters.value.ticker}%`)
  }
  if (filters.value.side) {
    query = query.eq('side', filters.value.side)
  }
  if (filters.value.dateFrom) {
    query = query.gte('executed_at', filters.value.dateFrom)
  }
  if (filters.value.dateTo) {
    query = query.lte('executed_at', filters.value.dateTo + 'T23:59:59')
  }

  const { data } = await query

  const mapped = (data || []).map(t => ({
    ...t,
    profiles: t.portfolio?.user || {}
  }))

  if (offset === 0) {
    trades.value = mapped
  } else {
    trades.value.push(...mapped)
  }
  hasMore.value = (data || []).length === PAGE_SIZE
  loading.value = false
}

let debounceTimer = null
function resetAndFetch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    hasMore.value = true
    fetchTrades(0)
  }, 300)
}

function loadMore() {
  fetchTrades(trades.value.length)
}

function exportCSV() {
  const columns = [
    { key: 'executed_at', label: 'Date' },
    { key: '_userName', label: 'User' },
    { key: '_userEmail', label: 'Email' },
    { key: 'ticker', label: 'Ticker' },
    { key: 'side', label: 'Side' },
    { key: 'shares', label: 'Shares' },
    { key: 'price', label: 'Price' },
    { key: 'dollars', label: 'Dollars' },
    { key: 'rationale', label: 'Rationale' }
  ]
  const rows = filteredTrades.value.map(t => ({
    ...t,
    _userName: t.profiles?.full_name || '',
    _userEmail: t.profiles?.email || ''
  }))
  downloadCSV(rows, columns, 'trades_export')
}

onMounted(() => fetchTrades(0))
</script>
