<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Stock Restrictions</h1>
      <p class="text-base-content/70">Set trading rules for your students</p>
    </div>

    <div v-if="saved" class="alert alert-success">
      <span>Restrictions saved successfully!</span>
    </div>

    <div class="card bg-base-100 shadow">
      <div class="card-body space-y-4">
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

const blockedTickersInput = computed({
  get: () => form.blockedTickers.join(', '),
  set: (val) => {
    form.blockedTickers = val.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
  }
})

function saveRestrictions() {
  teacher.updateRestrictions({
    maxStocksPerPortfolio: form.maxStocksPerPortfolio,
    allowedSectors: [...form.allowedSectors],
    blockedTickers: [...form.blockedTickers],
    maxDollarsPerStock: form.maxDollarsPerStock
  })
  saved.value = true
  setTimeout(() => { saved.value = false }, 3000)
}
</script>
