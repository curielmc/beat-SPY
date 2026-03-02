<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">Portfolio History</h1>
    <p class="text-sm text-base-content/60">All your portfolios, including closed ones and reset snapshots.</p>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="portfolios.length === 0" class="text-center py-12 text-base-content/50">
      No portfolios found.
    </div>

    <div v-else class="space-y-3">
      <div v-for="p in portfolios" :key="p.id" class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <!-- Header row -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h3 class="font-semibold">{{ p.name || 'My Portfolio' }}</h3>
              <span class="badge badge-sm" :class="p.status === 'active' ? 'badge-success' : 'badge-ghost'">
                {{ p.status || 'active' }}
              </span>
            </div>
            <button v-if="snapshotsByPortfolio[p.id]?.length" class="btn btn-ghost btn-xs" @click="toggleExpand(p.id)">
              {{ expandedIds.has(p.id) ? 'Hide Snapshots' : `Show Snapshots (${snapshotsByPortfolio[p.id].length})` }}
            </button>
          </div>

          <!-- Stats -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            <div>
              <p class="text-xs text-base-content/50">Created</p>
              <p class="text-sm font-mono">{{ formatDate(p.created_at) }}</p>
            </div>
            <div v-if="p.closed_at">
              <p class="text-xs text-base-content/50">Closed</p>
              <p class="text-sm font-mono">{{ formatDate(p.closed_at) }}</p>
            </div>
            <div>
              <p class="text-xs text-base-content/50">{{ p.status === 'closed' ? 'Final Value' : 'Current Value' }}</p>
              <p class="text-sm font-mono">
                ${{ (portfolioValues[p.id]?.value ?? Number(p.cash_balance)).toLocaleString('en-US', { maximumFractionDigits: 2 }) }}
              </p>
            </div>
            <div>
              <p class="text-xs text-base-content/50">Return</p>
              <p class="text-sm font-mono" :class="getReturnPct(p) >= 0 ? 'text-success' : 'text-error'">
                {{ getReturnPct(p) >= 0 ? '+' : '' }}{{ getReturnPct(p).toFixed(2) }}%
              </p>
            </div>
          </div>

          <div v-if="p.reset_count > 0" class="mt-1">
            <span class="badge badge-outline badge-xs">{{ p.reset_count }} reset{{ p.reset_count > 1 ? 's' : '' }}</span>
          </div>

          <!-- Expanded snapshots -->
          <div v-if="expandedIds.has(p.id) && snapshotsByPortfolio[p.id]?.length" class="mt-3 space-y-2">
            <div class="divider text-xs text-base-content/40 my-1">Snapshots</div>
            <div v-for="s in snapshotsByPortfolio[p.id]" :key="s.id" class="bg-base-200 rounded-lg p-3">
              <div class="flex items-center justify-between mb-2">
                <span class="badge badge-xs" :class="s.snapshot_type === 'reset' ? 'badge-warning' : 'badge-info'">
                  {{ s.snapshot_type }}
                </span>
                <span class="text-xs text-base-content/50">{{ formatDate(s.snapshotted_at) }}</span>
              </div>
              <div class="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p class="text-xs text-base-content/50">Value</p>
                  <p class="font-mono">${{ Number(s.total_value).toLocaleString('en-US', { maximumFractionDigits: 2 }) }}</p>
                </div>
                <div>
                  <p class="text-xs text-base-content/50">Cash</p>
                  <p class="font-mono">${{ Number(s.cash_balance).toLocaleString('en-US', { maximumFractionDigits: 2 }) }}</p>
                </div>
                <div>
                  <p class="text-xs text-base-content/50">Return</p>
                  <p class="font-mono" :class="Number(s.return_pct) >= 0 ? 'text-success' : 'text-error'">
                    {{ Number(s.return_pct) >= 0 ? '+' : '' }}{{ Number(s.return_pct).toFixed(2) }}%
                  </p>
                </div>
              </div>
              <!-- Holdings at snapshot time -->
              <div v-if="s.holdings?.length" class="mt-2">
                <p class="text-xs text-base-content/50 mb-1">Holdings at snapshot:</p>
                <div class="flex flex-wrap gap-1">
                  <span v-for="h in s.holdings" :key="h.ticker" class="badge badge-ghost badge-xs font-mono">
                    {{ h.ticker }} ({{ Number(h.shares).toFixed(2) }})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { usePortfolioStore } from '../../stores/portfolio'
import { supabase } from '../../lib/supabase'

const auth = useAuthStore()
const portfolioStore = usePortfolioStore()

const loading = ref(true)
const portfolios = ref([])
const snapshotsByPortfolio = reactive({})
const portfolioValues = reactive({})
const expandedIds = ref(new Set())

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString()
}

function getReturnPct(p) {
  const value = portfolioValues[p.id]?.value
  if (value !== undefined) {
    const starting = Number(p.starting_cash) || 100000
    return ((value - starting) / starting) * 100
  }
  // For closed portfolios, use snapshot data
  const closeSnapshot = snapshotsByPortfolio[p.id]?.find(s => s.snapshot_type === 'close')
  if (closeSnapshot) return Number(closeSnapshot.return_pct)
  // Fallback
  const starting = Number(p.starting_cash) || 100000
  const cash = Number(p.cash_balance) || 0
  return ((cash - starting) / starting) * 100
}

function toggleExpand(id) {
  const newSet = new Set(expandedIds.value)
  if (newSet.has(id)) {
    newSet.delete(id)
  } else {
    newSet.add(id)
  }
  expandedIds.value = newSet
}

onMounted(async () => {
  if (!auth.currentUser) return

  // Load all user portfolios
  const { data } = await supabase
    .from('portfolios')
    .select('*')
    .eq('owner_type', 'user')
    .eq('owner_id', auth.currentUser.id)
    .order('created_at', { ascending: false })

  portfolios.value = data || []

  // Load snapshots for each portfolio
  for (const p of portfolios.value) {
    const { data: snaps } = await supabase
      .from('portfolio_snapshots')
      .select('*')
      .eq('portfolio_id', p.id)
      .order('snapshotted_at', { ascending: false })
    snapshotsByPortfolio[p.id] = snaps || []

    // For active portfolios, get live value
    if (p.status === 'active' || !p.status) {
      try {
        const valData = await portfolioStore.getPortfolioValueById(p.id)
        portfolioValues[p.id] = valData
      } catch (e) {
        // fallback to cash
        portfolioValues[p.id] = { value: Number(p.cash_balance) }
      }
    } else {
      // For closed, use the close snapshot value
      const closeSnap = (snaps || []).find(s => s.snapshot_type === 'close')
      if (closeSnap) {
        portfolioValues[p.id] = { value: Number(closeSnap.total_value) }
      }
    }
  }

  loading.value = false
})
</script>
