<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <button class="btn btn-ghost btn-xs" @click="$router.back()">← Back</button>
        <h1 class="text-xl font-bold inline-block ml-2">Payouts</h1>
        <p v-if="competition" class="text-xs text-base-content/60">{{ competition.name }}</p>
      </div>
      <router-link
        v-if="competitionId"
        :to="{ name: 'admin-competition-audit', params: { id: competitionId } }"
        class="btn btn-ghost btn-xs"
      >Audit log →</router-link>
    </div>

    <UnfilledBucketDecision
      v-if="competition?.status === 'pending_organizer_decision'"
      :competition-id="competitionId"
      @decided="loadAll"
    />

    <div class="card bg-base-100 shadow">
      <div class="card-body p-4 space-y-2">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold">Tremendous balance</h2>
          <button class="btn btn-ghost btn-xs" :disabled="loadingBalance" @click="loadBalance">
            {{ loadingBalance ? '...' : 'Refresh' }}
          </button>
        </div>
        <p v-if="balanceError" class="text-xs text-error">{{ balanceError }}</p>
        <p v-else class="text-2xl font-mono">
          ${{ formatMoney(balance) }} <span class="text-sm font-normal text-base-content/60">USD</span>
        </p>
        <p class="text-xs text-base-content/60">
          Pending payout total: <span class="font-mono">${{ formatMoney(needTotal) }}</span>
        </p>
        <p v-if="balance != null && balance < needTotal" class="text-xs text-warning">
          Insufficient balance — top up your Tremendous funding source before sending.
        </p>
      </div>
    </div>

    <div class="card bg-base-100 shadow">
      <div class="card-body p-4">
        <div class="flex items-center justify-between mb-2">
          <h2 class="font-semibold">Payouts</h2>
          <button
            class="btn btn-primary btn-sm"
            :disabled="!pending.length || sending || (balance != null && balance < needTotal)"
            @click="sendAll"
          >
            {{ sending ? 'Sending...' : `Send all (${pending.length})` }}
          </button>
        </div>
        <p v-if="sendError" class="text-xs text-error mb-2">{{ sendError }}</p>

        <div v-if="loadingRows" class="text-sm text-base-content/60">Loading...</div>
        <div v-else-if="!rows.length" class="text-sm text-base-content/60">No payouts yet.</div>
        <div v-else class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Email</th>
                <th class="text-right">Amount</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Reward</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.id">
                <td class="text-xs">{{ r.profiles?.full_name || '—' }}</td>
                <td class="text-xs">{{ r.profiles?.email || '—' }}</td>
                <td class="text-xs text-right font-mono">${{ formatMoney(r.amount) }}</td>
                <td class="text-xs">
                  <span v-if="r.destination === 'charity'">
                    Charity{{ r.charity?.name ? `: ${r.charity.name}` : '' }}
                  </span>
                  <span v-else>Self</span>
                </td>
                <td class="text-xs">
                  <span class="badge badge-sm" :class="badgeClass(r.status)">{{ r.status }}</span>
                  <p v-if="r.error" class="text-[10px] text-error mt-0.5">{{ r.error }}</p>
                </td>
                <td class="text-xs font-mono">{{ r.provider_payout_id || '—' }}</td>
                <td class="text-xs">
                  <button
                    v-if="r.status === 'pending' || r.status === 'failed'"
                    class="btn btn-ghost btn-xs"
                    @click="openManual(r)"
                  >Mark manual</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Manual fallback modal -->
    <dialog ref="manualDialog" class="modal">
      <div class="modal-box">
        <h3 class="font-bold">Mark payout as paid manually</h3>
        <p class="text-xs text-base-content/60 mt-1">
          Recipient: {{ manualTarget?.profiles?.full_name || manualTarget?.profiles?.email }} —
          ${{ formatMoney(manualTarget?.amount) }}
        </p>
        <textarea
          v-model="manualNote"
          class="textarea textarea-bordered w-full mt-3"
          rows="3"
          placeholder="Note (e.g., paid by check #123)"
        ></textarea>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeManual">Cancel</button>
          <button class="btn btn-primary" :disabled="manualBusy" @click="confirmManual">
            {{ manualBusy ? '...' : 'Mark paid' }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop"><button>close</button></form>
    </dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../../lib/supabase'
import UnfilledBucketDecision from '../../components/admin/UnfilledBucketDecision.vue'

const route = useRoute()
const competitionId = computed(() => route.params.id)

const competition = ref(null)
const rows = ref([])
const loadingRows = ref(false)
const balance = ref(null)
const loadingBalance = ref(false)
const balanceError = ref('')

const sending = ref(false)
const sendError = ref('')

const manualDialog = ref(null)
const manualTarget = ref(null)
const manualNote = ref('')
const manualBusy = ref(false)

const pending = computed(() => rows.value.filter(r => r.status === 'pending'))
const needTotal = computed(() => pending.value.reduce((a, r) => a + Number(r.amount || 0), 0))

function formatMoney(n) {
  if (n == null) return '0.00'
  return Number(n).toFixed(2)
}
function badgeClass(status) {
  switch (status) {
    case 'sent': return 'badge-info'
    case 'delivered': return 'badge-success'
    case 'paid_manually': return 'badge-success'
    case 'failed': return 'badge-error'
    case 'canceled': return 'badge-ghost'
    default: return 'badge-warning'
  }
}

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? `Bearer ${session.access_token}` : ''
}

async function loadCompetition() {
  const { data } = await supabase
    .from('competitions')
    .select('id, name, status')
    .eq('id', competitionId.value)
    .maybeSingle()
  competition.value = data
}

async function loadRows() {
  loadingRows.value = true
  try {
    const { data, error } = await supabase
      .from('competition_payouts')
      .select('id, user_id, amount, currency, status, destination, charity, provider_payout_id, error, manual_note, paid_at, created_at, profiles(full_name, email)')
      .eq('competition_id', competitionId.value)
      .order('created_at', { ascending: true })
    if (!error) rows.value = data || []
  } finally {
    loadingRows.value = false
  }
}

async function loadBalance() {
  loadingBalance.value = true
  balanceError.value = ''
  try {
    const res = await fetch(`/api/competitions/${competitionId.value}/payouts/balance`, {
      headers: { Authorization: await authHeader() }
    })
    const data = await res.json()
    if (!res.ok || data.ok === false) {
      balanceError.value = data.error || `HTTP ${res.status}`
      balance.value = null
    } else {
      balance.value = Number(data.balance || 0)
    }
  } catch (e) {
    balanceError.value = String(e.message || e)
  } finally {
    loadingBalance.value = false
  }
}

async function loadAll() {
  await Promise.all([loadCompetition(), loadRows(), loadBalance()])
}

async function sendAll() {
  if (!confirm(`Send ${pending.value.length} payout(s) totaling $${formatMoney(needTotal.value)} via Tremendous?`)) return
  sending.value = true
  sendError.value = ''
  try {
    const res = await fetch(`/api/competitions/${competitionId.value}/payouts/send`, {
      method: 'POST',
      headers: { Authorization: await authHeader(), 'Content-Type': 'application/json' }
    })
    const data = await res.json()
    if (!res.ok) {
      sendError.value = data.error === 'insufficient_balance'
        ? `Insufficient balance ($${formatMoney(data.balance)} < $${formatMoney(data.need)})`
        : (data.error || `HTTP ${res.status}`)
    }
    await loadAll()
  } catch (e) {
    sendError.value = String(e.message || e)
  } finally {
    sending.value = false
  }
}

function openManual(row) {
  manualTarget.value = row
  manualNote.value = row.manual_note || ''
  manualDialog.value?.showModal()
}
function closeManual() {
  manualDialog.value?.close()
  manualTarget.value = null
  manualNote.value = ''
}
async function confirmManual() {
  if (!manualTarget.value) return
  manualBusy.value = true
  try {
    const res = await fetch(
      `/api/competitions/${competitionId.value}/payouts/${manualTarget.value.id}/manual`,
      {
        method: 'POST',
        headers: { Authorization: await authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual_note: manualNote.value })
      }
    )
    const data = await res.json()
    if (!res.ok) {
      alert(data.error || `HTTP ${res.status}`)
    } else {
      closeManual()
      await loadRows()
    }
  } finally {
    manualBusy.value = false
  }
}

onMounted(loadAll)
</script>
