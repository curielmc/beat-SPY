<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">Settings & Restrictions</h1>
        <p class="text-base-content/70">Configure trading rules, group mode, and parameters for {{ currentClass?.class_name || 'your class' }}</p>
      </div>
      <div v-if="currentClass" class="badge badge-lg badge-outline gap-2 py-4">
        <span class="text-base-content/50">Class Code:</span>
        <span class="font-mono font-bold text-primary">{{ currentClass.code }}</span>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <template v-else-if="currentClass">
      <div v-if="saved" class="alert alert-success shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="C9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>{{ savedMessage }}</span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Sidebar: Configuration Context -->
        <div class="space-y-6">
          <!-- Selection Menu -->
          <div class="card bg-base-100 shadow border border-base-200">
            <div class="card-body p-4">
              <h2 class="text-sm font-bold uppercase tracking-wider text-base-content/50 mb-4">Configuration Scope</h2>
              <ul class="menu p-0 gap-1">
                <li>
                  <button
                    class="flex justify-between items-center"
                    :class="activeFundNum === 'global' ? 'active' : ''"
                    @click="setScope('global')"
                  >
                    <span class="flex items-center gap-2 font-semibold">🌎 Global Class Defaults</span>
                    <span class="badge badge-sm badge-ghost">Default</span>
                  </button>
                </li>
                <div class="divider my-1 text-[10px] uppercase text-base-content/30">Fund-Specific Overrides</div>
                <li v-for="num in availableFunds" :key="num">
                  <button
                    class="flex justify-between items-center"
                    :class="activeFundNum === String(num) ? 'active' : ''"
                    @click="setScope(String(num))"
                  >
                    <span>💰 Fund {{ num }}</span>
                    <span v-if="fundRestrictions[String(num)]" class="badge badge-xs badge-success">Custom</span>
                    <span v-else class="badge badge-xs badge-ghost">Global</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <!-- Quick Actions / Mode -->
          <div class="card bg-base-200 shadow-sm border border-base-300">
            <div class="card-body p-4 space-y-4">
              <h3 class="font-bold text-sm">Class Controls</h3>
              <div class="form-control">
                <label class="label cursor-pointer">
                  <span class="label-text">Group Assignment</span>
                </label>
                <select v-model="groupModeLocal" class="select select-sm select-bordered w-full" @change="saveGroupMode">
                  <option value="student_choice">Students choose own group</option>
                  <option value="teacher_assign">I assign groups</option>
                </select>
              </div>

              <div class="form-control">
                <label class="label cursor-pointer">
                  <span class="label-text">Approval Code</span>
                </label>
                <div class="flex gap-2">
                  <input v-model="customCode" type="text" class="input input-sm input-bordered w-full font-mono uppercase" :placeholder="currentApprovalCode || 'NONE'" />
                  <button class="btn btn-sm btn-primary" @click="setCustomCode">Set</button>
                </div>
                <div class="flex gap-1 mt-2">
                  <button class="btn btn-xs btn-outline flex-1" @click="autoGenerateCode">Auto</button>
                  <button v-if="currentApprovalCode" class="btn btn-xs btn-error btn-outline" @click="removeCode">Off</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Form: Restrictions -->
        <div class="lg:col-span-2 space-y-6">
          <div class="card bg-base-100 shadow border border-base-200">
            <div class="card-body">
              <div class="flex items-center justify-between mb-4">
                <h2 class="card-title text-xl">
                  {{ activeFundNum === 'global' ? '🌎 Global Class Defaults' : `💰 Fund ${activeFundNum} Parameters` }}
                </h2>
                <div v-if="activeFundNum !== 'global' && !fundRestrictions[activeFundNum]" class="badge badge-info gap-2">
                  Inheriting Global Defaults
                </div>
              </div>

              <div class="divider">Universe & Parameters</div>

              <!-- SPY Toggle (Universe) -->
              <div class="form-control bg-base-200/50 p-4 rounded-xl border border-base-300 mb-6">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    </div>
                    <div>
                      <span class="font-bold text-lg">S&P 500 Toggle</span>
                      <p class="text-xs text-base-content/60">Restrict all investments to the 500 largest US companies (SPY constituents)</p>
                    </div>
                  </div>
                  <input type="checkbox" class="toggle toggle-primary toggle-lg" :checked="form.universe === 'sp500'" @change="toggleSPY" />
                </div>
                <div v-if="form.universe !== 'sp500' && form.universe !== 'any'" class="text-xs text-info mt-2 px-1">
                  Custom universe selected: <span class="font-bold uppercase">{{ form.universe }}</span>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Max Stocks Constraint -->
                <div class="form-control">
                  <label class="label">
                    <span class="label-text font-bold">Max Stocks per Portfolio</span>
                  </label>
                  <div class="join">
                    <input v-model.number="form.maxStocksPerPortfolio" type="number" min="1" max="50" class="input input-bordered w-full join-item" />
                    <span class="join-item bg-base-200 flex items-center px-4 border border-base-300 border-l-0">Stocks</span>
                  </div>
                </div>

                <!-- Max Position Size Constraint -->
                <div class="form-control">
                  <label class="label">
                    <span class="label-text font-bold text-primary">Max Position Size (%)</span>
                  </label>
                  <div class="join">
                    <input v-model.number="form.maxPositionPct" type="number" min="1" max="100" class="input input-bordered w-full join-item" placeholder="Unlimited" />
                    <span class="join-item bg-base-200 flex items-center px-4 border border-base-300 border-l-0">%</span>
                  </div>
                  <label class="label">
                    <span class="label-text-alt text-base-content/50">Prevents "betting the farm" on one stock.</span>
                  </label>
                </div>
              </div>

              <div class="divider mt-8">Portfolio Composition</div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Min Sectors Constraint -->
                <div class="form-control">
                  <label class="label">
                    <span class="label-text font-bold text-primary">Min Unique Sectors</span>
                  </label>
                  <div class="join">
                    <input v-model.number="form.minSectors" type="number" min="1" max="11" class="input input-bordered w-full join-item" placeholder="No min" />
                    <span class="join-item bg-base-200 flex items-center px-4 border border-base-300 border-l-0">Sectors</span>
                  </div>
                  <label class="label">
                    <span class="label-text-alt text-base-content/50">Forces students to diversify across sectors.</span>
                  </label>
                </div>

                <!-- Max Sector Concentration -->
                <div class="form-control">
                  <label class="label">
                    <span class="label-text font-bold">Max Sector Allocation</span>
                  </label>
                  <div class="join">
                    <input v-model.number="form.maxSectorPct" type="number" min="1" max="100" class="input input-bordered w-full join-item" placeholder="No limit" />
                    <span class="join-item bg-base-200 flex items-center px-4 border border-base-300 border-l-0">%</span>
                  </div>
                </div>
              </div>

              <div class="divider mt-8">Dividend Requirements</div>

              <div class="form-control bg-base-200/50 p-4 rounded-xl border border-base-300">
                <label class="label cursor-pointer justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center text-success">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                      <span class="font-bold text-lg text-primary">Dividend-Paying Stocks Only</span>
                      <p class="text-xs text-base-content/60">Students can only invest in companies that pay a dividend.</p>
                    </div>
                  </div>
                  <input type="checkbox" v-model="form.requireDividends" class="toggle toggle-success toggle-lg" />
                </label>
              </div>

              <div class="divider mt-8">Advanced Rules</div>

              <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="form-control">
                    <label class="label"><span class="label-text font-semibold">Max Stocks per Sector</span></label>
                    <input v-model.number="form.maxStocksPerSector" type="number" class="input input-bordered" placeholder="Unlimited" />
                  </div>
                  <div class="form-control">
                    <label class="label"><span class="label-text font-semibold">Trade Frequency</span></label>
                    <select v-model="form.tradeFrequency" class="select select-bordered">
                      <option value="unlimited">Unlimited</option>
                      <option value="once_per_day">Once per Day</option>
                      <option value="once_per_week">Once per Week</option>
                      <option value="once_per_month">Once per Month</option>
                    </select>
                  </div>
                </div>

                <div class="form-control">
                  <label class="label">
                    <span class="label-text font-semibold">Blocked Tickers</span>
                    <span class="label-text-alt">Comma separated</span>
                  </label>
                  <input v-model="blockedTickersInput" type="text" class="input input-bordered w-full font-mono uppercase" placeholder="e.g. TSLA, GME" />
                </div>

                <div class="form-control bg-base-200/30 p-4 rounded-lg">
                  <label class="label cursor-pointer justify-between">
                    <div>
                      <span class="label-text font-bold">Require Trade Rationale</span>
                      <p class="text-xs text-base-content/60">Students must write a justification for every trade</p>
                    </div>
                    <input type="checkbox" v-model="form.requireRationale" class="checkbox checkbox-primary" />
                  </label>
                </div>
              </div>

              <div class="card-actions justify-end mt-8 pt-4 border-t border-base-200">
                <button v-if="activeFundNum !== 'global' && fundRestrictions[activeFundNum]" class="btn btn-ghost btn-sm text-error" @click="resetToGlobal">
                  Reset to Global Defaults
                </button>
                <button class="btn btn-primary px-8" @click="saveRestrictions">
                  {{ activeFundNum === 'global' ? 'Save Global Defaults' : `Save Fund ${activeFundNum} Settings` }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useTeacherStore } from '../../stores/teacher'
import { supabase } from '../../lib/supabase'

const teacher = useTeacherStore()
const loading = ref(true)
const activeFundNum = ref('global')
const availableFunds = ref([1])
const fundRestrictions = ref({})
const globalRestrictions = ref({})
const saved = ref(false)
const savedMessage = ref('')
const customCode = ref('')
const currentClass = ref(null)

const form = reactive({
  universe: 'sp500',
  maxStocksPerPortfolio: 5,
  maxStocksPerSector: null,
  maxSectorPct: null,
  minSectors: null,
  maxPositionPct: null,
  requireDividends: false,
  blockedTickers: [],
  tradeFrequency: 'unlimited',
  requireRationale: true
})

const groupModeLocal = ref('student_choice')
const currentApprovalCode = ref(null)

onMounted(async () => {
  await teacher.loadTeacherData()
  currentClass.value = teacher.classes[0] || null

  if (currentClass.value) {
    groupModeLocal.value = currentClass.value.group_mode || 'student_choice'
    currentApprovalCode.value = currentClass.value.approval_code || null

    const restrictions = currentClass.value.restrictions || {}
    globalRestrictions.value = {
      universe: restrictions.universe || 'sp500',
      maxStocksPerPortfolio: restrictions.maxStocksPerPortfolio || 5,
      maxStocksPerSector: restrictions.maxStocksPerSector || null,
      maxSectorPct: restrictions.maxSectorPct || null,
      minSectors: restrictions.minSectors || null,
      maxPositionPct: restrictions.maxPositionPct || null,
      requireDividends: !!restrictions.requireDividends,
      blockedTickers: restrictions.blockedTickers || [],
      tradeFrequency: restrictions.tradeFrequency || 'unlimited',
      requireRationale: restrictions.requireRationale !== false
    }
    fundRestrictions.value = restrictions.byFund || {}

    // Discover funds from portfolios
    const { data: fundPorts } = await supabase
      .from('portfolios')
      .select('fund_number')
      .eq('owner_type', 'group')
    const nums = [...new Set((fundPorts || []).map(p => p.fund_number).filter(Boolean))].sort((a,b) => a-b)
    availableFunds.value = nums.length ? nums : [1]

    // Default to last fund if global not preferred? Let's default to global for visibility.
    setScope('global')
  }

  loading.value = false
})

const blockedTickersInput = computed({
  get: () => form.blockedTickers.join(', '),
  set: (val) => {
    form.blockedTickers = val.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
  }
})

function setScope(scope) {
  activeFundNum.value = scope
  loadScopeForm()
}

function loadScopeForm() {
  let target = globalRestrictions.value
  if (activeFundNum.value !== 'global') {
    target = fundRestrictions.value[activeFundNum.value] || globalRestrictions.value
  }

  form.universe = target.universe || 'sp500'
  form.maxStocksPerPortfolio = target.maxStocksPerPortfolio || 5
  form.maxStocksPerSector = target.maxStocksPerSector || null
  form.maxSectorPct = target.maxSectorPct || null
  form.minSectors = target.minSectors || null
  form.maxPositionPct = target.maxPositionPct || null
  form.requireDividends = !!target.requireDividends
  form.blockedTickers = [...(target.blockedTickers || [])]
  form.tradeFrequency = target.tradeFrequency || 'unlimited'
  form.requireRationale = target.requireRationale !== false
}

function toggleSPY() {
  form.universe = form.universe === 'sp500' ? 'any' : 'sp500'
}

function resetToGlobal() {
  if (activeFundNum.value === 'global') return
  delete fundRestrictions.value[activeFundNum.value]
  loadScopeForm()
  saveRestrictions()
}

function showSaved(message) {
  savedMessage.value = message
  saved.value = true
  setTimeout(() => { saved.value = false }, 3000)
}

async function saveGroupMode() {
  if (!currentClass.value) return
  await teacher.updateGroupMode(currentClass.value.id, groupModeLocal.value)
  showSaved('Group assignment mode updated!')
}

async function autoGenerateCode() {
  if (!currentClass.value) return
  const code = teacher.generateApprovalCode()
  await teacher.setApprovalCode(currentClass.value.id, code)
  currentApprovalCode.value = code
  showSaved('Trade approval code generated!')
}

async function setCustomCode() {
  if (!currentClass.value) return
  const code = customCode.value.trim().toUpperCase()
  await teacher.setApprovalCode(currentClass.value.id, code)
  currentApprovalCode.value = code
  customCode.value = ''
  showSaved('Trade approval code set!')
}

async function removeCode() {
  if (!currentClass.value) return
  await teacher.setApprovalCode(currentClass.value.id, null)
  currentApprovalCode.value = null
  showSaved('Trade approval code removed.')
}

async function saveRestrictions() {
  if (!currentClass.value) return

  const currentSettings = {
    universe: form.universe,
    maxStocksPerPortfolio: form.maxStocksPerPortfolio,
    maxStocksPerSector: form.maxStocksPerSector,
    maxSectorPct: form.maxSectorPct,
    minSectors: form.minSectors,
    maxPositionPct: form.maxPositionPct,
    requireDividends: form.requireDividends,
    blockedTickers: [...form.blockedTickers],
    tradeFrequency: form.tradeFrequency,
    requireRationale: form.requireRationale
  }

  let finalRestrictions = {
    ...globalRestrictions.value,
    byFund: { ...fundRestrictions.value }
  }

  if (activeFundNum.value === 'global') {
    // Update top level and global state
    Object.assign(finalRestrictions, currentSettings)
    globalRestrictions.value = { ...currentSettings }
  } else {
    // Update fund specific
    finalRestrictions.byFund[activeFundNum.value] = currentSettings
    fundRestrictions.value[activeFundNum.value] = currentSettings
  }

  await teacher.updateRestrictions(currentClass.value.id, finalRestrictions)
  showSaved(`${activeFundNum.value === 'global' ? 'Global defaults' : 'Fund ' + activeFundNum.value} saved!`)
}
</script>
