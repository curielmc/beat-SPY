<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold">Manage Competitions</h1>
      <button class="btn btn-primary btn-sm" @click="showForm = !showForm">
        {{ showForm ? 'Cancel' : '+ New Competition' }}
      </button>
    </div>

    <!-- Create/Edit Form -->
    <div v-if="showForm" class="card bg-base-100 shadow">
      <div class="card-body p-4 space-y-3">
        <h3 class="font-bold">{{ editingId ? 'Edit Competition' : 'Create Competition' }}</h3>

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

        <!-- Prizes -->
        <div class="border border-base-300 rounded-lg p-3 space-y-2">
          <div class="flex items-center justify-between">
            <p class="font-semibold text-sm">Prizes</p>
            <button class="btn btn-ghost btn-xs" @click="addPrize">+ Add Prize</button>
          </div>
          <div v-for="(prize, i) in form.prizes" :key="i" class="flex items-center gap-2">
            <span class="badge badge-sm">{{ prize.place }}</span>
            <input v-model="prize.description" type="text" class="input input-bordered input-sm flex-1" :placeholder="`Prize for #${prize.place}`" />
            <button class="btn btn-ghost btn-xs text-error" @click="form.prizes.splice(i, 1)">&#10005;</button>
          </div>
        </div>

        <label class="label cursor-pointer justify-start gap-2">
          <input type="checkbox" v-model="form.is_public" class="checkbox checkbox-sm" />
          <span class="label-text text-sm">Public</span>
        </label>

        <div v-if="formError" class="text-error text-sm">{{ formError }}</div>

        <div class="flex gap-2">
          <button class="btn btn-sm btn-ghost" @click="resetForm">Cancel</button>
          <button class="btn btn-sm btn-primary flex-1" :disabled="!canSave || saving" @click="save">
            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
            {{ editingId ? 'Save Changes' : 'Create Competition' }}
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
              <button v-if="comp.status === 'active'" class="btn btn-warning btn-xs" @click="finalize(comp)">Finalize</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useCompetitionsStore } from '../../stores/competitions'

const store = useCompetitionsStore()

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
  is_public: true
})

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
  form.is_public = true
  restrictedTickersInput.value = ''
  formError.value = ''
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
  form.is_public = comp.is_public
  restrictedTickersInput.value = (comp.rules?.restricted_tickers || []).join(', ')
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
    prizes: form.prizes.filter(p => p.description.trim()),
    is_public: form.is_public
  }

  let result
  if (editingId.value) {
    result = await store.updateCompetition(editingId.value, payload)
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
