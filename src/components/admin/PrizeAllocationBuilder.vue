<template>
  <div class="space-y-3">
    <!-- Pool input row -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div class="form-control">
        <label class="label py-1"><span class="label-text text-sm">Prize Pool Amount</span></label>
        <input :value="pool" @input="$emit('update:pool', Number($event.target.value) || 0)"
               type="number" min="0" step="0.01" class="input input-bordered w-full" />
      </div>
      <div class="form-control">
        <label class="label py-1"><span class="label-text text-sm">Currency</span></label>
        <select :value="currency" @change="$emit('update:currency', $event.target.value)" class="select select-bordered w-full">
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
          <option value="BOB">BOB</option>
        </select>
      </div>
      <div class="form-control">
        <label class="label py-1"><span class="label-text text-sm">Unfilled Bucket Policy</span></label>
        <select :value="unfilledPolicy" @change="$emit('update:unfilledPolicy', $event.target.value)" class="select select-bordered w-full">
          <option value="redistribute">Redistribute to charity</option>
          <option value="rollover">Rollover to next bucket</option>
          <option value="return_to_sponsor">Return to sponsor</option>
        </select>
      </div>
    </div>

    <!-- Preset picker -->
    <div class="flex flex-wrap gap-2">
      <button class="btn btn-sm" :class="activePreset === 'winner' ? 'btn-primary' : 'btn-ghost'" @click="applyPreset('winner')">Winner takes all</button>
      <button class="btn btn-sm" :class="activePreset === 'top3' ? 'btn-primary' : 'btn-ghost'" @click="applyPreset('top3')">Top 3 (50/30/20)</button>
      <button class="btn btn-sm" :class="activePreset === 'beat_spy' ? 'btn-primary' : 'btn-ghost'" @click="applyPreset('beat_spy')">All who beat SPY</button>
      <button class="btn btn-sm" :class="activePreset === 'hybrid' ? 'btn-primary' : 'btn-ghost'" @click="applyPreset('hybrid')">Hybrid 25/25/50</button>
      <button class="btn btn-sm" :class="activePreset === 'custom' ? 'btn-primary' : 'btn-ghost'" @click="activePreset = 'custom'">Custom</button>
    </div>

    <!-- Bucket cards -->
    <div class="space-y-2">
      <div v-for="(bucket, i) in buckets" :key="i" class="border border-base-300 rounded-lg p-3 space-y-2 bg-base-200/40">
        <div class="flex items-center justify-between">
          <div class="font-semibold text-sm">Bucket {{ i + 1 }}</div>
          <div class="flex gap-1">
            <button class="btn btn-ghost btn-xs" :disabled="i === 0" @click="moveBucket(i, -1)">↑</button>
            <button class="btn btn-ghost btn-xs" :disabled="i === buckets.length - 1" @click="moveBucket(i, 1)">↓</button>
            <button class="btn btn-ghost btn-xs text-error" @click="removeBucket(i)">&#10005;</button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div class="form-control">
            <label class="label py-0.5"><span class="label-text text-xs">Eligibility</span></label>
            <select :value="bucket.eligibility" @change="updateBucket(i, 'eligibility', $event.target.value)" class="select select-bordered select-sm w-full">
              <option value="place">Specific place(s)</option>
              <option value="top_n">Top N</option>
              <option value="top_n_who_beat_benchmark">Top N who beat benchmark</option>
              <option value="all_who_beat_benchmark">All who beat benchmark</option>
            </select>
          </div>
          <div v-if="bucket.eligibility === 'place'" class="form-control">
            <label class="label py-0.5"><span class="label-text text-xs">Place range (e.g. 1 to 1, 2 to 3)</span></label>
            <div class="flex items-center gap-1">
              <input type="number" min="1" :value="bucket.place_range?.[0]"
                     @input="updatePlaceRange(i, 0, $event.target.value)"
                     class="input input-bordered input-sm w-20" />
              <span class="text-xs">to</span>
              <input type="number" min="1" :value="bucket.place_range?.[1]"
                     @input="updatePlaceRange(i, 1, $event.target.value)"
                     class="input input-bordered input-sm w-20" />
            </div>
          </div>
          <div v-if="bucket.eligibility === 'top_n' || bucket.eligibility === 'top_n_who_beat_benchmark'" class="form-control">
            <label class="label py-0.5"><span class="label-text text-xs">N</span></label>
            <input type="number" min="1" :value="bucket.n"
                   @input="updateBucket(i, 'n', Number($event.target.value) || 1)"
                   class="input input-bordered input-sm w-full" />
          </div>
          <div class="form-control">
            <label class="label py-0.5"><span class="label-text text-xs">Allocation</span></label>
            <div class="flex items-center gap-1">
              <select :value="bucket.allocation?.type" @change="updateAllocation(i, 'type', $event.target.value)"
                      class="select select-bordered select-sm w-32">
                <option value="percent_of_pool">% of pool</option>
                <option value="fixed_amount">Fixed</option>
              </select>
              <input type="number" min="0" step="0.01" :value="bucket.allocation?.value"
                     @input="updateAllocation(i, 'value', Number($event.target.value) || 0)"
                     class="input input-bordered input-sm flex-1" />
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div class="form-control">
            <label class="label py-0.5"><span class="label-text text-xs">Split</span></label>
            <select :value="bucket.split" @change="updateBucket(i, 'split', $event.target.value)" class="select select-bordered select-sm w-full">
              <option value="winner_take_all">Winner take all</option>
              <option value="weighted_by_rank">Weighted by rank</option>
              <option value="equal_split">Equal split</option>
            </select>
          </div>
          <div v-if="bucket.split === 'weighted_by_rank'" class="form-control">
            <label class="label py-0.5"><span class="label-text text-xs">Weights (comma-separated)</span></label>
            <input type="text" :value="(bucket.weights || []).join(',')"
                   @input="updateWeights(i, $event.target.value)"
                   class="input input-bordered input-sm w-full" placeholder="50, 30, 20" />
          </div>
        </div>

        <div class="form-control">
          <label class="label py-0.5"><span class="label-text text-xs">Exclude ranks (optional, comma-separated)</span></label>
          <input type="text" :value="(bucket.exclude_ranks || []).join(',')"
                 @input="updateExclude(i, $event.target.value)"
                 class="input input-bordered input-sm w-full" placeholder="1, 2, 3" />
        </div>
      </div>

      <button class="btn btn-sm btn-ghost" @click="addBucket">+ Add Bucket</button>
    </div>

    <!-- Validation -->
    <div v-if="validation.errors.length" class="alert alert-error text-xs py-2">
      <ul class="list-disc ml-4">
        <li v-for="(err, idx) in validation.errors" :key="idx">{{ err }}</li>
      </ul>
    </div>
    <div v-else-if="validation.warnings.length" class="alert alert-warning text-xs py-2">
      <ul class="list-disc ml-4">
        <li v-for="(w, idx) in validation.warnings" :key="idx">{{ w }}</li>
      </ul>
    </div>

    <!-- Live preview -->
    <div class="border border-base-300 rounded-lg p-3 bg-base-100">
      <p class="font-semibold text-sm mb-2">Live preview (10 simulated participants, 3 beat SPY)</p>
      <div v-if="preview.payouts.length" class="text-xs space-y-1">
        <div v-for="p in preview.payouts" :key="p.user_id" class="flex justify-between">
          <span>{{ p.user_id }}</span>
          <span class="font-mono">{{ currency }} {{ p.amount.toFixed(2) }}</span>
        </div>
      </div>
      <div v-else class="text-xs text-base-content/50">No payouts (no buckets, or all unfilled)</div>
      <div v-if="preview.unfilled.length" class="mt-2 text-xs text-warning">
        <p class="font-semibold">Unfilled:</p>
        <div v-for="(u, ui) in preview.unfilled" :key="ui">
          Bucket #{{ ui + 1 }}: {{ currency }} {{ Number(u.unallocated).toFixed(2) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { resolvePrizeBuckets } from '../../lib/prizeAllocation'

const props = defineProps({
  pool: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  buckets: { type: Array, default: () => [] },
  unfilledPolicy: { type: String, default: 'redistribute' }
})

const emit = defineEmits(['update:pool', 'update:currency', 'update:buckets', 'update:unfilledPolicy'])

import { ref } from 'vue'
const activePreset = ref('custom')

function emitBuckets(next) { emit('update:buckets', next) }

function applyPreset(name) {
  activePreset.value = name
  if (name === 'winner') {
    emitBuckets([{ eligibility: 'place', place_range: [1, 1], allocation: { type: 'percent_of_pool', value: 100 }, split: 'winner_take_all' }])
  } else if (name === 'top3') {
    emitBuckets([{ eligibility: 'top_n', n: 3, allocation: { type: 'percent_of_pool', value: 100 }, split: 'weighted_by_rank', weights: [50, 30, 20] }])
  } else if (name === 'beat_spy') {
    emitBuckets([{ eligibility: 'all_who_beat_benchmark', allocation: { type: 'percent_of_pool', value: 100 }, split: 'equal_split' }])
  } else if (name === 'hybrid') {
    emitBuckets([
      { eligibility: 'place', place_range: [1, 1], allocation: { type: 'percent_of_pool', value: 25 }, split: 'winner_take_all' },
      { eligibility: 'place', place_range: [2, 3], allocation: { type: 'percent_of_pool', value: 25 }, split: 'equal_split' },
      { eligibility: 'all_who_beat_benchmark', exclude_ranks: [1, 2, 3], allocation: { type: 'percent_of_pool', value: 50 }, split: 'equal_split' }
    ])
  }
}

function addBucket() {
  emitBuckets([...props.buckets, { eligibility: 'place', place_range: [1, 1], allocation: { type: 'percent_of_pool', value: 0 }, split: 'winner_take_all' }])
}
function removeBucket(i) {
  const next = [...props.buckets]; next.splice(i, 1); emitBuckets(next)
}
function moveBucket(i, dir) {
  const next = [...props.buckets]
  const j = i + dir
  if (j < 0 || j >= next.length) return
  ;[next[i], next[j]] = [next[j], next[i]]
  emitBuckets(next)
}
function updateBucket(i, field, val) {
  const next = props.buckets.map((b, idx) => idx === i ? { ...b, [field]: val } : b)
  emitBuckets(next)
}
function updatePlaceRange(i, idx, raw) {
  const v = Number(raw) || 1
  const cur = props.buckets[i].place_range || [1, 1]
  const range = [...cur]; range[idx] = v
  updateBucket(i, 'place_range', range)
}
function updateAllocation(i, field, val) {
  const cur = props.buckets[i].allocation || { type: 'percent_of_pool', value: 0 }
  updateBucket(i, 'allocation', { ...cur, [field]: val })
}
function updateWeights(i, raw) {
  const weights = String(raw).split(',').map(s => Number(s.trim())).filter(n => !Number.isNaN(n))
  updateBucket(i, 'weights', weights)
}
function updateExclude(i, raw) {
  const ranks = String(raw).split(',').map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n > 0)
  updateBucket(i, 'exclude_ranks', ranks)
}

// Validation
const validation = computed(() => {
  const errors = []
  const warnings = []
  if (!props.buckets.length) {
    errors.push('At least one bucket is required.')
    return { errors, warnings }
  }

  let pctSum = 0
  let fixedSum = 0
  for (const b of props.buckets) {
    const v = Number(b.allocation?.value) || 0
    if (b.allocation?.type === 'percent_of_pool') pctSum += v
    else fixedSum += v
  }
  if (pctSum > 100) errors.push(`Percent allocations sum to ${pctSum}% (must be ≤ 100%)`)
  else if (pctSum > 0 && pctSum < 100) warnings.push(`Percent allocations sum to ${pctSum}% (under 100% — leftover will follow unfilled-bucket policy).`)
  if (fixedSum > Number(props.pool || 0)) errors.push(`Fixed allocations (${fixedSum}) exceed pool (${props.pool}).`)

  // Place ranges don't overlap
  const ranges = props.buckets
    .filter(b => b.eligibility === 'place' && Array.isArray(b.place_range))
    .map(b => b.place_range)
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const [a1, a2] = ranges[i]; const [b1, b2] = ranges[j]
      if (Math.max(a1, b1) <= Math.min(a2, b2)) {
        errors.push(`Place ranges overlap: [${a1}-${a2}] and [${b1}-${b2}].`)
      }
    }
  }

  return { errors, warnings }
})

defineExpose({ validation })

// Preview
const previewRanking = computed(() => {
  const out = []
  for (let i = 1; i <= 10; i++) {
    out.push({ user_id: `sim${i}`, final_rank: i, final_return_pct: 12 - i, beat_benchmark: i <= 3 })
  }
  return out
})
const preview = computed(() => {
  try {
    return resolvePrizeBuckets(props.buckets || [], previewRanking.value, Number(props.pool || 0))
  } catch {
    return { payouts: [], unfilled: [] }
  }
})
</script>
