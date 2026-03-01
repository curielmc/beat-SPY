<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Portfolios</h1>
      <p class="text-base-content/70">View and manage all portfolios</p>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else class="space-y-3">
      <div v-for="p in portfolios" :key="p.id" class="collapse collapse-arrow bg-base-100 shadow">
        <input type="checkbox" />
        <div class="collapse-title">
          <div class="flex items-center justify-between pr-4">
            <div class="flex items-center gap-3">
              <span class="badge" :class="p.owner_type === 'group' ? 'badge-primary' : 'badge-secondary'">{{ p.owner_type }}</span>
              <span class="font-bold">{{ p.ownerName || p.owner_id }}</span>
            </div>
            <div class="flex gap-3 text-sm">
              <span>Cash: <strong class="font-mono">${{ Number(p.cash_balance).toLocaleString('en-US', { maximumFractionDigits: 2 }) }}</strong></span>
              <span class="badge badge-ghost badge-sm">{{ p.holdingsCount || 0 }} holdings</span>
              <span class="badge badge-ghost badge-sm">{{ p.tradesCount || 0 }} trades</span>
            </div>
          </div>
        </div>
        <div class="collapse-content">
          <div class="space-y-3">
            <div class="flex gap-4 text-sm">
              <span>Starting Cash: <strong>${{ Number(p.starting_cash).toLocaleString() }}</strong></span>
              <span>Created: <strong>{{ new Date(p.created_at).toLocaleDateString() }}</strong></span>
            </div>

            <!-- Holdings -->
            <div v-if="p.holdings?.length" class="overflow-x-auto">
              <h3 class="font-semibold text-sm mb-1">Holdings</h3>
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th class="text-right">Shares</th>
                    <th class="text-right">Avg Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="h in p.holdings" :key="h.id">
                    <td class="font-mono font-bold">{{ h.ticker }}</td>
                    <td class="text-right font-mono">{{ Number(h.shares).toFixed(4) }}</td>
                    <td class="text-right font-mono">${{ Number(h.avg_cost).toFixed(2) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Actions -->
            <div class="flex gap-2">
              <button class="btn btn-warning btn-sm btn-outline" @click="resetPortfolio(p)">Reset Portfolio</button>
              <button class="btn btn-sm btn-outline" @click="openCashModal(p)">Adjust Cash</button>
            </div>
          </div>
        </div>
      </div>

      <p v-if="portfolios.length === 0" class="text-center text-base-content/50 py-8">No portfolios found</p>
    </div>

    <!-- Cash Adjustment Modal -->
    <dialog class="modal" :class="{ 'modal-open': showCashModal }">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Adjust Cash Balance</h3>
        <p class="text-sm text-base-content/60 mb-4">Current: ${{ cashTarget ? Number(cashTarget.cash_balance).toLocaleString() : 0 }}</p>
        <div class="form-control mb-4">
          <label class="label"><span class="label-text">New Cash Balance ($)</span></label>
          <input v-model.number="newCashBalance" type="number" class="input input-bordered" />
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showCashModal = false">Cancel</button>
          <button class="btn btn-primary" @click="adjustCash">Save</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showCashModal = false"><button>close</button></form>
    </dialog>

    <div v-if="successMsg" class="alert alert-success">
      <span>{{ successMsg }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'

const portfolios = ref([])
const loading = ref(true)
const showCashModal = ref(false)
const cashTarget = ref(null)
const newCashBalance = ref(0)
const successMsg = ref('')

onMounted(async () => {
  await fetchPortfolios()
})

async function fetchPortfolios() {
  loading.value = true
  const { data } = await supabase
    .from('portfolios')
    .select('*, holdings(*), trades(id)')
    .order('created_at', { ascending: false })

  // Enrich with owner names
  for (const p of (data || [])) {
    p.holdingsCount = p.holdings?.length || 0
    p.tradesCount = p.trades?.length || 0
    if (p.owner_type === 'group') {
      const { data: group } = await supabase.from('groups').select('name').eq('id', p.owner_id).maybeSingle()
      p.ownerName = group?.name || 'Unknown Group'
    } else {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', p.owner_id).maybeSingle()
      p.ownerName = profile?.full_name || 'Unknown User'
    }
  }

  portfolios.value = data || []
  loading.value = false
}

async function resetPortfolio(p) {
  if (!confirm(`Reset portfolio for "${p.ownerName}"? This deletes all holdings and trades.`)) return

  await supabase.from('holdings').delete().eq('portfolio_id', p.id)
  await supabase.from('trades').delete().eq('portfolio_id', p.id)
  await supabase.from('benchmark_holdings').delete().eq('portfolio_id', p.id)
  await supabase.from('benchmark_trades').delete().eq('portfolio_id', p.id)
  await supabase.from('portfolios').update({ cash_balance: p.starting_cash }).eq('id', p.id)

  showSuccess('Portfolio reset')
  await fetchPortfolios()
}

function openCashModal(p) {
  cashTarget.value = p
  newCashBalance.value = Number(p.cash_balance)
  showCashModal.value = true
}

async function adjustCash() {
  if (!cashTarget.value) return
  await supabase.from('portfolios').update({ cash_balance: newCashBalance.value }).eq('id', cashTarget.value.id)
  showCashModal.value = false
  showSuccess('Cash balance updated')
  await fetchPortfolios()
}

function showSuccess(msg) {
  successMsg.value = msg
  setTimeout(() => { successMsg.value = '' }, 3000)
}
</script>
