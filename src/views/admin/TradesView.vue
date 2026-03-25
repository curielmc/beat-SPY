<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-xl font-bold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
          Trade Audit
        </h1>
        <p class="text-base-content/70">Browse executed trades and the portfolio audit log</p>
      </div>
      <button class="btn btn-sm btn-outline" @click="exportCSV">Export CSV</button>
    </div>

    <div class="flex gap-2">
      <button class="btn btn-sm" :class="activeTab === 'trades' ? 'btn-primary' : 'btn-ghost'" @click="switchTab('trades')">Trades</button>
      <button class="btn btn-sm" :class="activeTab === 'audit' ? 'btn-primary' : 'btn-ghost'" @click="switchTab('audit')">Audit Log</button>
    </div>

    <div v-if="activeTab === 'trades'" class="flex gap-3 flex-wrap">
      <input v-model="tradeFilters.ticker" type="text" placeholder="Ticker..." class="input input-bordered input-sm w-32" @input="resetAndFetchTrades" />
      <input v-model="tradeFilters.user" type="text" placeholder="User name/email..." class="input input-bordered input-sm w-56" @input="applyTradeClientFilters" />
      <select v-model="tradeFilters.side" class="select select-bordered select-sm" @change="resetAndFetchTrades">
        <option value="">All Sides</option>
        <option value="buy">Buy</option>
        <option value="sell">Sell</option>
      </select>
      <input v-model="tradeFilters.dateFrom" type="date" class="input input-bordered input-sm" @change="resetAndFetchTrades" />
      <input v-model="tradeFilters.dateTo" type="date" class="input input-bordered input-sm" @change="resetAndFetchTrades" />
    </div>

    <div v-else class="flex gap-3 flex-wrap">
      <input v-model="auditFilters.user" type="text" placeholder="Changed by..." class="input input-bordered input-sm w-56" @input="applyAuditClientFilters" />
      <select v-model="auditFilters.table" class="select select-bordered select-sm" @change="resetAndFetchAudit">
        <option value="">All Tables</option>
        <option value="holdings">Holdings</option>
        <option value="portfolios">Portfolios</option>
      </select>
      <select v-model="auditFilters.action" class="select select-bordered select-sm" @change="resetAndFetchAudit">
        <option value="">All Actions</option>
        <option value="INSERT">Insert</option>
        <option value="UPDATE">Update</option>
        <option value="DELETE">Delete</option>
      </select>
      <input v-model="auditFilters.dateFrom" type="date" class="input input-bordered input-sm" @change="resetAndFetchAudit" />
      <input v-model="auditFilters.dateTo" type="date" class="input input-bordered input-sm" @change="resetAndFetchAudit" />
    </div>

    <div v-if="errorMessage" class="alert alert-error">
      <span>{{ errorMessage }}</span>
    </div>

    <div v-if="activeTab === 'trades' && loadingTrades && filteredTrades.length === 0" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="activeTab === 'audit' && loadingAudit && filteredAudit.length === 0" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="activeTab === 'trades'" class="card bg-base-100 shadow border border-base-200">
      <div class="card-body p-0">
        <div class="overflow-x-auto">
          <table class="table table-sm table-zebra">
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                <th>Portfolio</th>
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
                  <div>{{ trade._profile?.full_name || 'Unknown user' }}</div>
                  <div class="text-xs text-base-content/50">{{ trade._profile?.email || trade.user_id }}</div>
                </td>
                <td class="text-sm">
                  <div>{{ trade._portfolioLabel }}</div>
                  <div class="text-xs text-base-content/50">{{ trade.portfolio_id }}</div>
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
                <td class="text-sm max-w-[240px] truncate" :title="trade.rationale">{{ trade.rationale || '-' }}</td>
              </tr>
              <tr v-if="filteredTrades.length === 0 && !loadingTrades">
                <td colspan="9" class="text-center text-base-content/50">No trades found</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-else class="card bg-base-100 shadow border border-base-200">
      <div class="card-body p-0">
        <div class="overflow-x-auto">
          <table class="table table-sm table-zebra">
            <thead>
              <tr>
                <th>Date</th>
                <th>Actor</th>
                <th>Table</th>
                <th>Action</th>
                <th>Portfolio</th>
                <th>Change</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in filteredAudit" :key="entry.id">
                <td class="text-sm whitespace-nowrap">{{ formatDate(entry.changed_at) }}</td>
                <td class="text-sm">
                  <div>{{ entry._profile?.full_name || 'System/Unknown' }}</div>
                  <div class="text-xs text-base-content/50">{{ entry._profile?.email || entry.changed_by || 'n/a' }}</div>
                </td>
                <td class="font-mono text-xs">{{ entry.table_name }}</td>
                <td>
                  <span class="badge badge-xs" :class="auditActionClass(entry.action)">{{ entry.action }}</span>
                </td>
                <td class="text-sm">
                  <div>{{ entry._portfolioLabel }}</div>
                  <div class="text-xs text-base-content/50">{{ entry.portfolio_id || 'n/a' }}</div>
                </td>
                <td class="text-sm max-w-[360px] truncate" :title="describeAuditEntry(entry)">{{ describeAuditEntry(entry) }}</td>
                <td class="text-sm max-w-[200px] truncate" :title="entry.note">{{ entry.note || '-' }}</td>
              </tr>
              <tr v-if="filteredAudit.length === 0 && !loadingAudit">
                <td colspan="7" class="text-center text-base-content/50">No audit entries found</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="flex justify-center" v-if="activeTab === 'trades' && hasMoreTrades">
      <button class="btn btn-sm btn-outline" :class="{ loading: loadingTrades }" @click="loadMoreTrades">
        {{ loadingTrades ? 'Loading...' : 'Load More Trades' }}
      </button>
    </div>

    <div class="flex justify-center" v-if="activeTab === 'audit' && hasMoreAudit">
      <button class="btn btn-sm btn-outline" :class="{ loading: loadingAudit }" @click="loadMoreAudit">
        {{ loadingAudit ? 'Loading...' : 'Load More Audit' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'
import { downloadCSV } from '../../utils/csvExport'

const PAGE_SIZE = 50

const activeTab = ref('trades')
const errorMessage = ref('')

const trades = ref([])
const filteredTrades = ref([])
const loadingTrades = ref(true)
const hasMoreTrades = ref(true)
const tradeFilters = ref({ ticker: '', user: '', side: '', dateFrom: '', dateTo: '' })

const auditEntries = ref([])
const filteredAudit = ref([])
const loadingAudit = ref(false)
const hasMoreAudit = ref(true)
const auditFilters = ref({ user: '', table: '', action: '', dateFrom: '', dateTo: '' })

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function isLargeTrade(trade) {
  return Math.abs(Number(trade.dollars)) > 10000
}

function auditActionClass(action) {
  if (action === 'INSERT') return 'badge-success'
  if (action === 'UPDATE') return 'badge-warning'
  if (action === 'DELETE') return 'badge-error'
  return 'badge-ghost'
}

function buildPortfolioLabel(portfolio) {
  if (!portfolio) return 'Unknown portfolio'
  if (portfolio.owner_type === 'group') return portfolio.fund_name || `Group Fund ${portfolio.fund_number || ''}`.trim()
  if (portfolio.owner_type === 'competition') return portfolio.fund_name || portfolio.name || 'Competition Portfolio'
  return portfolio.name || 'My Investments'
}

function describeAuditEntry(entry) {
  const oldData = entry.old_data || {}
  const newData = entry.new_data || {}

  if (entry.table_name === 'holdings') {
    const ticker = newData.ticker || oldData.ticker || 'unknown ticker'
    const oldShares = oldData.shares
    const newShares = newData.shares
    if (entry.action === 'INSERT') return `Holding created for ${ticker} at ${Number(newData.shares || 0).toFixed(2)} shares`
    if (entry.action === 'DELETE') return `Holding removed for ${ticker} from ${Number(oldData.shares || 0).toFixed(2)} shares`
    return `${ticker} shares ${Number(oldShares || 0).toFixed(2)} -> ${Number(newShares || 0).toFixed(2)}`
  }

  if (entry.table_name === 'portfolios') {
    const oldCash = oldData.cash_balance
    const newCash = newData.cash_balance
    if (entry.action === 'INSERT') return `Portfolio created with $${Number(newData.starting_cash || newData.cash_balance || 0).toLocaleString()}`
    if (entry.action === 'DELETE') return `Portfolio deleted`
    if (oldCash !== undefined || newCash !== undefined) {
      return `Cash balance ${Number(oldCash || 0).toLocaleString()} -> ${Number(newCash || 0).toLocaleString()}`
    }
  }

  return `${entry.table_name} ${entry.action.toLowerCase()}`
}

async function fetchProfilesMap(ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))]
  if (uniqueIds.length === 0) return {}
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', uniqueIds)

  return Object.fromEntries((data || []).map(profile => [profile.id, profile]))
}

async function fetchPortfoliosMap(ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))]
  if (uniqueIds.length === 0) return {}
  const { data } = await supabase
    .from('portfolios')
    .select('id, owner_type, owner_id, name, fund_name, fund_number')
    .in('id', uniqueIds)

  return Object.fromEntries((data || []).map(portfolio => [portfolio.id, portfolio]))
}

function applyTradeClientFilters() {
  const q = tradeFilters.value.user.trim().toLowerCase()
  filteredTrades.value = q
    ? trades.value.filter(trade =>
        trade._profile?.full_name?.toLowerCase().includes(q) ||
        trade._profile?.email?.toLowerCase().includes(q)
      )
    : [...trades.value]
}

function applyAuditClientFilters() {
  const q = auditFilters.value.user.trim().toLowerCase()
  filteredAudit.value = q
    ? auditEntries.value.filter(entry =>
        entry._profile?.full_name?.toLowerCase().includes(q) ||
        entry._profile?.email?.toLowerCase().includes(q)
      )
    : [...auditEntries.value]
}

async function fetchTrades(offset = 0) {
  loadingTrades.value = true
  errorMessage.value = ''

  let query = supabase
    .from('trades')
    .select('*')
    .order('executed_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (tradeFilters.value.ticker) query = query.ilike('ticker', `%${tradeFilters.value.ticker}%`)
  if (tradeFilters.value.side) query = query.eq('side', tradeFilters.value.side)
  if (tradeFilters.value.dateFrom) query = query.gte('executed_at', tradeFilters.value.dateFrom)
  if (tradeFilters.value.dateTo) query = query.lte('executed_at', tradeFilters.value.dateTo + 'T23:59:59')

  const { data, error } = await query
  if (error) {
    errorMessage.value = error.message
    loadingTrades.value = false
    return
  }

  const profileMap = await fetchProfilesMap((data || []).map(trade => trade.user_id))
  const portfolioMap = await fetchPortfoliosMap((data || []).map(trade => trade.portfolio_id))
  const mapped = (data || []).map(trade => ({
    ...trade,
    _profile: profileMap[trade.user_id] || null,
    _portfolioLabel: buildPortfolioLabel(portfolioMap[trade.portfolio_id])
  }))

  if (offset === 0) trades.value = mapped
  else trades.value.push(...mapped)

  hasMoreTrades.value = mapped.length === PAGE_SIZE
  applyTradeClientFilters()
  loadingTrades.value = false
}

async function fetchAudit(offset = 0) {
  loadingAudit.value = true
  errorMessage.value = ''

  let query = supabase
    .from('portfolio_audit_log')
    .select('*')
    .order('changed_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (auditFilters.value.table) query = query.eq('table_name', auditFilters.value.table)
  if (auditFilters.value.action) query = query.eq('action', auditFilters.value.action)
  if (auditFilters.value.dateFrom) query = query.gte('changed_at', auditFilters.value.dateFrom)
  if (auditFilters.value.dateTo) query = query.lte('changed_at', auditFilters.value.dateTo + 'T23:59:59')

  const { data, error } = await query
  if (error) {
    errorMessage.value = error.message
    loadingAudit.value = false
    return
  }

  const profileMap = await fetchProfilesMap((data || []).map(entry => entry.changed_by))
  const portfolioMap = await fetchPortfoliosMap((data || []).map(entry => entry.portfolio_id))
  const mapped = (data || []).map(entry => ({
    ...entry,
    _profile: profileMap[entry.changed_by] || null,
    _portfolioLabel: buildPortfolioLabel(portfolioMap[entry.portfolio_id])
  }))

  if (offset === 0) auditEntries.value = mapped
  else auditEntries.value.push(...mapped)

  hasMoreAudit.value = mapped.length === PAGE_SIZE
  applyAuditClientFilters()
  loadingAudit.value = false
}

let debounceTimer = null

function resetAndFetchTrades() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    hasMoreTrades.value = true
    fetchTrades(0)
  }, 250)
}

function resetAndFetchAudit() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    hasMoreAudit.value = true
    fetchAudit(0)
  }, 250)
}

function loadMoreTrades() {
  fetchTrades(trades.value.length)
}

function loadMoreAudit() {
  fetchAudit(auditEntries.value.length)
}

function switchTab(tab) {
  activeTab.value = tab
  errorMessage.value = ''
  if (tab === 'audit' && auditEntries.value.length === 0) fetchAudit(0)
}

function exportCSV() {
  if (activeTab.value === 'trades') {
    downloadCSV(
      filteredTrades.value.map(trade => ({
        date: trade.executed_at,
        user_name: trade._profile?.full_name || '',
        user_email: trade._profile?.email || '',
        portfolio: trade._portfolioLabel,
        ticker: trade.ticker,
        side: trade.side,
        shares: trade.shares,
        price: trade.price,
        dollars: trade.dollars,
        rationale: trade.rationale || ''
      })),
      [
        { key: 'date', label: 'Date' },
        { key: 'user_name', label: 'User' },
        { key: 'user_email', label: 'Email' },
        { key: 'portfolio', label: 'Portfolio' },
        { key: 'ticker', label: 'Ticker' },
        { key: 'side', label: 'Side' },
        { key: 'shares', label: 'Shares' },
        { key: 'price', label: 'Price' },
        { key: 'dollars', label: 'Dollars' },
        { key: 'rationale', label: 'Rationale' }
      ],
      'trade_browser_export'
    )
    return
  }

  downloadCSV(
    filteredAudit.value.map(entry => ({
      date: entry.changed_at,
      actor_name: entry._profile?.full_name || '',
      actor_email: entry._profile?.email || '',
      table_name: entry.table_name,
      action: entry.action,
      portfolio: entry._portfolioLabel,
      portfolio_id: entry.portfolio_id,
      note: entry.note || '',
      summary: describeAuditEntry(entry)
    })),
    [
      { key: 'date', label: 'Date' },
      { key: 'actor_name', label: 'Actor' },
      { key: 'actor_email', label: 'Actor Email' },
      { key: 'table_name', label: 'Table' },
      { key: 'action', label: 'Action' },
      { key: 'portfolio', label: 'Portfolio' },
      { key: 'portfolio_id', label: 'Portfolio ID' },
      { key: 'summary', label: 'Summary' },
      { key: 'note', label: 'Note' }
    ],
    'audit_log_export'
  )
}

onMounted(() => {
  fetchTrades(0)
})
</script>
