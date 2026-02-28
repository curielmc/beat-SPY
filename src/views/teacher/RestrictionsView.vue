<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Settings & Restrictions</h1>
      <p class="text-base-content/70">Configure trading rules, group mode, and approval codes</p>
    </div>

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
          <label class="label"><span class="label-text-alt text-base-content/50">Students can buy fractional shares to stay within this limit</span></label>
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Allowed sectors (leave empty for all)</span></label>
          <div class="flex flex-wrap gap-2">
            <label v-for="sector in allSectors" :key="sector" class="label cursor-pointer gap-2">
              <input type="checkbox" :value="sector" v-model="form.allowedSectors" class="checkbox checkbox-sm" />
              <span class="label-text">{{ sector }}</span>
            </label>
          </div>
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Blocked tickers (comma separated)</span></label>
          <input v-model="blockedTickersInput" type="text" class="input input-bordered w-full" placeholder="e.g. TSLA, GME, AMC" />
        </div>

        <button class="btn btn-primary" @click="saveRestrictions">Save Restrictions</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useTeacherStore } from '../../stores/teacher'
import stocksData from '../../mock/stocks.json'

const teacher = useTeacherStore()
const saved = ref(false)
const savedMessage = ref('')
const customCode = ref('')

const allSectors = [...new Set(stocksData.map(s => s.sector))]

const currentRestrictions = teacher.currentTeacherData?.restrictions || {
  maxStocksPerPortfolio: 10,
  allowedSectors: [],
  blockedTickers: [],
  maxDollarsPerStock: 20000
}

const form = reactive({
  maxStocksPerPortfolio: currentRestrictions.maxStocksPerPortfolio,
  allowedSectors: [...currentRestrictions.allowedSectors],
  blockedTickers: [...currentRestrictions.blockedTickers],
  maxDollarsPerStock: currentRestrictions.maxDollarsPerStock
})

const groupModeLocal = ref(teacher.currentTeacherData?.groupMode || 'student_choice')
const currentApprovalCode = ref(teacher.currentTeacherData?.tradeApprovalCode || null)

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

function saveGroupMode() {
  teacher.updateGroupMode(groupModeLocal.value)
  showSaved('Group assignment mode updated!')
}

function autoGenerateCode() {
  const code = teacher.generateApprovalCode()
  teacher.setTradeApprovalCode(code)
  currentApprovalCode.value = code
  showSaved('Trade approval code generated: ' + code)
}

function setCustomCode() {
  const code = customCode.value.trim().toUpperCase()
  teacher.setTradeApprovalCode(code)
  currentApprovalCode.value = code
  customCode.value = ''
  showSaved('Trade approval code set: ' + code)
}

function removeCode() {
  teacher.setTradeApprovalCode(null)
  currentApprovalCode.value = null
  showSaved('Trade approval code removed. Students can trade freely.')
}

function saveRestrictions() {
  teacher.updateRestrictions({
    maxStocksPerPortfolio: form.maxStocksPerPortfolio,
    allowedSectors: [...form.allowedSectors],
    blockedTickers: [...form.blockedTickers],
    maxDollarsPerStock: form.maxDollarsPerStock
  })
  showSaved('Restrictions saved successfully!')
}
</script>
