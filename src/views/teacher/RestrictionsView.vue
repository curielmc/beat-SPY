<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Settings & Restrictions</h1>
      <p class="text-base-content/70">Configure trading rules, group mode, and approval codes</p>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else-if="currentClass">
      <div v-if="saved" class="alert alert-success">
        <span>{{ savedMessage }}</span>
      </div>

      <!-- Group Assignment Mode -->
      <div class="card bg-base-100 shadow">
        <div class="card-body space-y-4">
          <h2 class="card-title text-lg">Group Assignment Mode</h2>
          <div class="flex flex-col gap-2">
            <label class="label cursor-pointer justify-start gap-3">
              <input type="radio" v-model="groupModeLocal" value="student_choice" class="radio radio-primary" />
              <div>
                <span class="label-text font-medium">Students choose their own group</span>
                <p class="text-xs text-base-content/50">Students select or create a group during signup</p>
              </div>
            </label>
            <label class="label cursor-pointer justify-start gap-3">
              <input type="radio" v-model="groupModeLocal" value="teacher_assign" class="radio radio-primary" />
              <div>
                <span class="label-text font-medium">I will assign students to groups</span>
                <p class="text-xs text-base-content/50">Students sign up without a group; you assign them in the Students page</p>
              </div>
            </label>
          </div>
          <button class="btn btn-primary btn-sm" @click="saveGroupMode">Save Mode</button>
        </div>
      </div>

      <!-- Trade Approval Code -->
      <div class="card bg-base-100 shadow">
        <div class="card-body space-y-4">
          <h2 class="card-title text-lg">Trade Approval Code</h2>
          <p class="text-sm text-base-content/60">Students must enter this code before buying or selling stocks. Leave empty to allow unrestricted trading.</p>

          <div class="flex items-center gap-3">
            <span class="text-sm text-base-content/60">Current code:</span>
            <span v-if="currentApprovalCode" class="badge badge-lg badge-primary font-mono text-lg px-4 py-3">{{ currentApprovalCode }}</span>
            <span v-else class="badge badge-lg badge-ghost">None (unrestricted)</span>
          </div>

          <div class="flex flex-wrap gap-2">
            <button class="btn btn-sm btn-outline" @click="autoGenerateCode">Generate Code</button>
            <button v-if="currentApprovalCode" class="btn btn-sm btn-error btn-outline" @click="removeCode">Remove Code</button>
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text">Or set a custom code</span></label>
            <div class="flex gap-2">
              <input v-model="customCode" type="text" class="input input-bordered flex-1 uppercase" placeholder="e.g. TRADE1" />
              <button class="btn btn-primary btn-sm" :disabled="!customCode.trim()" @click="setCustomCode">Set</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Stock Restrictions -->
      <div class="card bg-base-100 shadow">
        <div class="card-body space-y-4">
          <h2 class="card-title text-lg">Stock Restrictions</h2>

          <div class="form-control">
            <label class="label"><span class="label-text">Max stocks per portfolio</span></label>
            <input v-model.number="form.maxStocksPerPortfolio" type="number" min="1" max="30" class="input input-bordered w-full" />
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text">Max dollars invested per stock</span></label>
            <input v-model.number="form.maxDollarsPerStock" type="number" min="1" class="input input-bordered w-full" placeholder="e.g. 20000" />
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text">Blocked tickers (comma separated)</span></label>
            <input v-model="blockedTickersInput" type="text" class="input input-bordered w-full" placeholder="e.g. TSLA, GME, AMC" />
          </div>

          <button class="btn btn-primary" @click="saveRestrictions">Save Restrictions</button>
        </div>
      </div>

      <!-- Trade Rationale -->
      <div class="card bg-base-100 shadow">
        <div class="card-body space-y-4">
          <h2 class="card-title text-lg">Trade Rationale</h2>
          <label class="label cursor-pointer justify-start gap-3">
            <input type="checkbox" v-model="form.requireRationale" class="toggle toggle-primary" />
            <div>
              <span class="label-text font-medium">Require students to explain their trades</span>
              <p class="text-xs text-base-content/50">Students must provide a rationale before buying or selling</p>
            </div>
          </label>
          <button class="btn btn-primary" @click="saveRestrictions">Save Restrictions</button>
        </div>
      </div>

      <!-- Trading Frequency -->
      <div class="card bg-base-100 shadow">
        <div class="card-body space-y-4">
          <h2 class="card-title text-lg">Trading Frequency</h2>
          <p class="text-sm text-base-content/60">Limit how often students can trade the same stock. This applies per ticker per portfolio.</p>

          <div class="form-control">
            <label class="label"><span class="label-text">Frequency limit</span></label>
            <select v-model="form.tradeFrequency" class="select select-bordered w-full">
              <option value="unlimited">Unlimited (no restriction)</option>
              <option value="once_per_day">Once per day</option>
              <option value="once_per_week">Once per week</option>
              <option value="once_per_month">Once per month</option>
            </select>
          </div>

          <button class="btn btn-primary" @click="saveRestrictions">Save Restrictions</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useTeacherStore } from '../../stores/teacher'

const teacher = useTeacherStore()
const loading = ref(true)
const saved = ref(false)
const savedMessage = ref('')
const customCode = ref('')
const currentClass = ref(null)

const form = reactive({
  maxStocksPerPortfolio: 10,
  maxDollarsPerStock: 20000,
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
    form.maxStocksPerPortfolio = restrictions.maxStocksPerPortfolio || 10
    form.maxDollarsPerStock = restrictions.maxDollarsPerStock || 20000
    form.blockedTickers = restrictions.blockedTickers || []
    form.tradeFrequency = restrictions.tradeFrequency || 'unlimited'
    form.requireRationale = restrictions.requireRationale !== false
  }

  loading.value = false
})

const blockedTickersInput = computed({
  get: () => form.blockedTickers.join(', '),
  set: (val) => {
    form.blockedTickers = val.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
  }
})

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
  showSaved('Trade approval code generated: ' + code)
}

async function setCustomCode() {
  if (!currentClass.value) return
  const code = customCode.value.trim().toUpperCase()
  await teacher.setApprovalCode(currentClass.value.id, code)
  currentApprovalCode.value = code
  customCode.value = ''
  showSaved('Trade approval code set: ' + code)
}

async function removeCode() {
  if (!currentClass.value) return
  await teacher.setApprovalCode(currentClass.value.id, null)
  currentApprovalCode.value = null
  showSaved('Trade approval code removed. Students can trade freely.')
}

async function saveRestrictions() {
  if (!currentClass.value) return
  await teacher.updateRestrictions(currentClass.value.id, {
    maxStocksPerPortfolio: form.maxStocksPerPortfolio,
    maxDollarsPerStock: form.maxDollarsPerStock,
    blockedTickers: [...form.blockedTickers],
    tradeFrequency: form.tradeFrequency,
    requireRationale: form.requireRationale
  })
  showSaved('Restrictions saved successfully!')
}
</script>
