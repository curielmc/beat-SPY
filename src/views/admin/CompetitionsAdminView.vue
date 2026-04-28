<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold">Manage Challenges</h1>
      <button class="btn btn-primary btn-sm" @click="showForm = !showForm">
        {{ showForm ? 'Cancel' : '+ New Challenge' }}
      </button>
    </div>

    <!-- Create/Edit Form -->
    <div v-if="showForm" class="card bg-base-100 shadow">
      <div class="card-body p-4 space-y-3">
        <h3 class="font-bold">{{ editingId ? 'Edit Challenge' : 'Create Challenge' }}</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-sm">Name *</span></label>
            <input v-model="form.name" type="text" class="input input-bordered w-full" placeholder="e.g., Beat Tech in 10 Days" />
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-sm">Sponsor</span></label>
            <input v-model="form.sponsor" type="text" class="input input-bordered w-full" placeholder="e.g., Fidelity" />
          </div>
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text text-sm">Description</span></label>
          <textarea v-model="form.description" class="textarea textarea-bordered w-full" rows="2"></textarea>
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text text-sm">Sponsor Logo URL</span></label>
          <input v-model="form.sponsor_logo_url" type="text" class="input input-bordered w-full" placeholder="https://..." />
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-sm">Benchmark Ticker *</span></label>
            <input v-model="form.benchmark_ticker" type="text" class="input input-bordered w-full uppercase" placeholder="SPY" />
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-sm">Starting Cash *</span></label>
            <input v-model.number="form.starting_cash" type="number" class="input input-bordered w-full" />
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-sm">Start Date *</span></label>
            <input v-model="form.start_date" type="date" class="input input-bordered w-full" />
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-sm">End Date *</span></label>
            <input v-model="form.end_date" type="date" class="input input-bordered w-full" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-sm">Registration Opens</span></label>
            <input v-model="form.registration_open" type="date" class="input input-bordered w-full" />
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-sm">Registration Closes</span></label>
            <input v-model="form.registration_close" type="date" class="input input-bordered w-full" />
          </div>
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text text-sm">Status</span></label>
          <select v-model="form.status" class="select select-bordered w-full">
            <option value="draft">Draft</option>
            <option value="registration">Registration</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <!-- Rules -->
        <div class="border border-base-300 rounded-lg p-3 space-y-2">
          <p class="font-semibold text-sm">Rules</p>
          <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" v-model="form.rules.require_thesis" class="checkbox checkbox-sm" />
            <span class="label-text text-sm">Require investment thesis</span>
          </label>
          <div class="grid grid-cols-2 gap-3">
            <div class="form-control">
              <label class="label py-0.5"><span class="label-text text-xs">Min # of securities</span></label>
              <input v-model.number="form.rules.min_stocks" type="number" min="0" class="input input-bordered input-sm w-full" />
            </div>
            <div class="form-control">
              <label class="label py-0.5"><span class="label-text text-xs">Max position %</span></label>
              <input v-model.number="form.rules.max_position_pct" type="number" min="0" max="100" class="input input-bordered input-sm w-full" />
            </div>
          </div>
          <div class="form-control">
            <label class="label py-0.5"><span class="label-text text-xs">Restricted tickers (comma-separated)</span></label>
            <input v-model="restrictedTickersInput" type="text" class="input input-bordered input-sm w-full" placeholder="e.g., TSLA, BTC" />
          </div>
        </div>

        <!-- Prize Allocation Builder -->
        <div class="border border-base-300 rounded-lg p-3 space-y-2">
          <p class="font-semibold text-sm">Prize Pool & Allocation</p>
          <PrizeAllocationBuilder
            :pool="form.prize_pool_amount"
            :currency="form.prize_pool_currency"
            :buckets="form.prize_allocation"
            :unfilledPolicy="form.unfilled_bucket_policy"
            @update:pool="(v) => form.prize_pool_amount = v"
            @update:currency="(v) => form.prize_pool_currency = v"
            @update:buckets="(v) => form.prize_allocation = v"
            @update:unfilledPolicy="(v) => form.unfilled_bucket_policy = v"
          />
        </div>

        <!-- Organizers -->
        <OrganizersPanel v-if="editingId" :competition-id="editingId" />

        <!-- Manage participants (active competitions) -->
        <ManageParticipants v-if="editingId && form.status === 'active'" :competition-id="editingId" />

        <label class="label cursor-pointer justify-start gap-2">
          <input type="checkbox" v-model="form.is_public" class="checkbox checkbox-sm" />
          <span class="label-text text-sm">Public</span>
        </label>

        <div v-if="formError" class="text-error text-sm">{{ formError }}</div>

        <div class="flex gap-2">
          <button class="btn btn-sm btn-ghost" @click="resetForm">Cancel</button>
          <button class="btn btn-sm btn-primary flex-1" :disabled="!canSave || saving" @click="save">
            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
            {{ editingId ? 'Save Changes' : 'Create Challenge' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Competition list -->
    <div v-if="store.loading" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else class="space-y-3">
      <div v-for="comp in store.competitions" :key="comp.id" class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="badge badge-sm" :class="statusBadgeClass(comp.status)">{{ comp.status }}</span>
                <span v-if="comp.sponsor" class="text-xs text-base-content/50">{{ comp.sponsor }}</span>
              </div>
              <h3 class="font-bold">{{ comp.name }}</h3>
              <p class="text-xs text-base-content/50">
                {{ new Date(comp.start_date).toLocaleDateString() }} - {{ new Date(comp.end_date).toLocaleDateString() }}
                | Benchmark: {{ comp.benchmark_ticker }} | Cash: ${{ Number(comp.starting_cash).toLocaleString() }}
              </p>
            </div>
            <div class="flex gap-1">
              <button class="btn btn-ghost btn-xs" @click="editComp(comp)">Edit</button>
              <label class="btn btn-ghost btn-xs">
                Roster CSV
                <input type="file" accept=".csv,text/csv" class="hidden" @change="(e) => uploadRoster(comp, e)" />
              </label>
              <button class="btn btn-ghost btn-xs" @click="router.push(`/admin/competitions/${comp.id}/audit`)">Audit</button>
              <button v-if="comp.status === 'active'" class="btn btn-warning btn-xs" @click="finalize(comp)">Finalize</button>
            </div>
          </div>
          <div v-if="rosterStatus[comp.id]" class="text-xs mt-2" :class="rosterStatus[comp.id].error ? 'text-error' : 'text-success'">
            {{ rosterStatus[comp.id].message }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCompetitionsStore } from '../../stores/competitions'
import { useAuthStore } from '../../stores/auth'
import { getAccessToken } from '../../lib/supabase'
import { MATERIAL_FIELDS, detectMaterialChanges } from '../../lib/competitionFields'
import PrizeAllocationBuilder from '../../components/admin/PrizeAllocationBuilder.vue'
import OrganizersPanel from '../../components/admin/OrganizersPanel.vue'
import ManageParticipants from '../../components/admin/ManageParticipants.vue'

const router = useRouter()
const authStore = useAuthStore()

const store = useCompetitionsStore()
const rosterStatus = reactive({})

async function uploadRoster(comp, event) {
  const file = event.target.files?.[0]
  if (!file) return
  rosterStatus[comp.id] = { message: 'Parsing CSV…' }
  try {
    const text = await file.text()
    const rows = parseCsv(text)
    if (!rows.length) {
      rosterStatus[comp.id] = { message: 'CSV is empty', error: true }
      return
    }
    const token = await getAccessToken()
    const res = await fetch('/api/competitions/upload-roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ competition_id: comp.id, rows })
    })
    const body = await res.json()
    if (!res.ok) {
      rosterStatus[comp.id] = { message: body.error || 'Upload failed', error: true }
      return
    }
    rosterStatus[comp.id] = { message: `Uploaded ${body.upserted} entries (${body.skipped || 0} skipped)` }
  } catch (e) {
    rosterStatus[comp.id] = { message: e.message, error: true }
  } finally {
    event.target.value = ''
  }
}

function parseCsv(text) {
  // RFC 4180 quoted-field aware parser.
  const rows = []
  let cur = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue }
      if (ch === '"') { inQuotes = false; i++; continue }
      field += ch; i++; continue
    }
    if (ch === '"') { inQuotes = true; i++; continue }
    if (ch === ',') { cur.push(field); field = ''; i++; continue }
    if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; i++; continue }
    if (ch === '\r') { i++; continue }
    field += ch; i++
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur) }

  // Drop fully-empty trailing rows
  const grid = rows.filter((r) => r.some((c) => String(c).trim() !== ''))
  if (!grid.length) return []

  const header = grid[0].map((s) => String(s).trim().toLowerCase())
  const emailIdx = header.indexOf('email')
  const nameIdx = header.indexOf('full_name')
  const startIdx = (emailIdx === -1 && nameIdx === -1) ? 0 : 1
  const out = []
  for (let r = startIdx; r < grid.length; r++) {
    const parts = grid[r].map((s) => String(s).trim())
    let email, full_name
    if (emailIdx >= 0) { email = parts[emailIdx]; full_name = nameIdx >= 0 ? (parts[nameIdx] || '') : '' }
    else { email = parts[0]; full_name = parts[1] || '' }
    if (email && /@/.test(email)) out.push({ email, full_name })
  }
  return out
}

const showForm = ref(false)
const editingId = ref(null)
const saving = ref(false)
const formError = ref('')
const restrictedTickersInput = ref('')

const form = reactive({
  name: '',
  description: '',
  sponsor: '',
  sponsor_logo_url: '',
  benchmark_ticker: 'SPY',
  starting_cash: 100000,
  start_date: '',
  end_date: '',
  registration_open: '',
  registration_close: '',
  status: 'draft',
  rules: { require_thesis: false, min_stocks: null, max_position_pct: null },
  prizes: [],
  prize_pool_amount: 0,
  prize_pool_currency: 'USD',
  prize_allocation: [],
  unfilled_bucket_policy: 'admin_decide',
  is_public: true
})

const editingOriginal = ref(null) // snapshot of competition before edit, for diff

const canSave = computed(() => form.name.trim() && form.benchmark_ticker.trim() && form.start_date && form.end_date)

onMounted(() => store.fetchCompetitions())

function addPrize() {
  const nextPlace = form.prizes.length > 0 ? Math.max(...form.prizes.map(p => p.place)) + 1 : 1
  form.prizes.push({ place: nextPlace, description: '' })
}

function resetForm() {
  showForm.value = false
  editingId.value = null
  form.name = ''
  form.description = ''
  form.sponsor = ''
  form.sponsor_logo_url = ''
  form.benchmark_ticker = 'SPY'
  form.starting_cash = 100000
  form.start_date = ''
  form.end_date = ''
  form.registration_open = ''
  form.registration_close = ''
  form.status = 'draft'
  form.rules = { require_thesis: false, min_stocks: null, max_position_pct: null }
  form.prizes = []
  form.prize_pool_amount = 0
  form.prize_pool_currency = 'USD'
  form.prize_allocation = []
  form.unfilled_bucket_policy = 'admin_decide'
  form.is_public = true
  restrictedTickersInput.value = ''
  formError.value = ''
  editingOriginal.value = null
}

function editComp(comp) {
  editingId.value = comp.id
  showForm.value = true
  form.name = comp.name
  form.description = comp.description || ''
  form.sponsor = comp.sponsor || ''
  form.sponsor_logo_url = comp.sponsor_logo_url || ''
  form.benchmark_ticker = comp.benchmark_ticker
  form.starting_cash = comp.starting_cash
  form.start_date = comp.start_date?.slice(0, 10) || ''
  form.end_date = comp.end_date?.slice(0, 10) || ''
  form.registration_open = comp.registration_open?.slice(0, 10) || ''
  form.registration_close = comp.registration_close?.slice(0, 10) || ''
  form.status = comp.status
  form.rules = { require_thesis: false, min_stocks: null, max_position_pct: null, ...(comp.rules || {}) }
  form.prizes = [...(comp.prizes || [])]
  form.prize_pool_amount = Number(comp.prize_pool_amount || 0)
  form.prize_pool_currency = comp.prize_pool_currency || 'USD'
  form.prize_allocation = Array.isArray(comp.prize_allocation) ? JSON.parse(JSON.stringify(comp.prize_allocation)) : []
  form.unfilled_bucket_policy = comp.unfilled_bucket_policy || 'admin_decide'
  form.is_public = comp.is_public
  restrictedTickersInput.value = (comp.rules?.restricted_tickers || []).join(', ')
  editingOriginal.value = JSON.parse(JSON.stringify(comp))
}

async function save() {
  formError.value = ''
  saving.value = true

  const rules = { ...form.rules }
  if (restrictedTickersInput.value.trim()) {
    rules.restricted_tickers = restrictedTickersInput.value.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
  }
  // Clean up null/0 rule values
  if (!rules.min_stocks) delete rules.min_stocks
  if (!rules.max_position_pct) delete rules.max_position_pct

  const payload = {
    name: form.name.trim(),
    description: form.description.trim() || null,
    sponsor: form.sponsor.trim() || null,
    sponsor_logo_url: form.sponsor_logo_url.trim() || null,
    benchmark_ticker: form.benchmark_ticker.toUpperCase(),
    starting_cash: form.starting_cash,
    start_date: form.start_date,
    end_date: form.end_date,
    registration_open: form.registration_open || null,
    registration_close: form.registration_close || null,
    status: form.status,
    rules,
    prizes: form.prizes.filter(p => p.description?.trim?.()),
    prize_pool_amount: Number(form.prize_pool_amount) || 0,
    prize_pool_currency: form.prize_pool_currency || 'USD',
    prize_allocation: form.prize_allocation || [],
    unfilled_bucket_policy: form.unfilled_bucket_policy || 'admin_decide',
    is_public: form.is_public
  }

  // Mid-challenge edit: confirm material changes against participants.
  let reason = null
  if (editingId.value && editingOriginal.value && form.status === 'active') {
    const changes = detectMaterialChanges(editingOriginal.value, payload)
    const fields = Object.keys(changes)
    if (fields.length) {
      const r = window.prompt(
        `This change touches material field(s) [${fields.join(', ')}]. ` +
        `It will be logged in the audit trail and will notify all participants. ` +
        `Optional reason (will be included in the notification):`,
        ''
      )
      if (r === null) { saving.value = false; return } // cancelled
      reason = r.trim() || null
    }
  }

  let result
  if (editingId.value) {
    // Use server-side update endpoint when editing an existing competition so
    // material changes get audited + notifications dispatched server-side.
    try {
      const token = await getAccessToken()
      const res = await fetch(`/api/competitions/${editingId.value}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ updates: payload, reason })
      })
      const body = await res.json()
      if (!res.ok) result = { error: body.error || 'Update failed' }
      else result = { success: true, competition: body.competition }
    } catch (e) {
      result = { error: e.message }
    }
  } else {
    result = await store.createCompetition(payload)
  }

  saving.value = false
  if (result.error) {
    formError.value = result.error
    return
  }

  resetForm()
  store.fetchCompetitions()
}

async function finalize(comp) {
  if (!confirm(`Finalize "${comp.name}"? This will lock results.`)) return
  await store.finalizeCompetition(comp.id)
  store.fetchCompetitions()
}

function statusBadgeClass(status) {
  const map = { draft: 'badge-ghost', registration: 'badge-info', active: 'badge-success', completed: 'badge-neutral', cancelled: 'badge-error' }
  return map[status] || 'badge-ghost'
}
</script>
