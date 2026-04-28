<template>
  <div class="alert alert-warning shadow flex flex-col items-start gap-3">
    <div>
      <h3 class="font-bold">Unfilled prize buckets</h3>
      <p class="text-sm">
        Some prize buckets couldn't be filled (e.g., not enough entrants beat the
        benchmark). Choose how to handle the unallocated amount:
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button class="btn btn-sm btn-primary" :disabled="busy" @click="decide('roll_forward')">
        Roll forward to winners
      </button>
      <button class="btn btn-sm" :disabled="busy" @click="decide('return_to_sponsor')">
        Return to sponsor
      </button>
      <button class="btn btn-sm btn-warning" :disabled="busy" @click="decide('distribute_anyway')">
        Distribute anyway (top-N)
      </button>
    </div>
    <p v-if="error" class="text-sm text-error">{{ error }}</p>
    <p v-if="result" class="text-sm text-success">
      Decision applied: {{ result.decision }} — {{ result.payouts?.length || 0 }} payouts created.
    </p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { supabase } from '../../lib/supabase'

const props = defineProps({
  competitionId: { type: String, required: true }
})
const emit = defineEmits(['decided'])

const busy = ref(false)
const error = ref('')
const result = ref(null)

async function decide(decision) {
  busy.value = true
  error.value = ''
  result.value = null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/competitions/${props.competitionId}/decide-unfilled`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token || ''}`
      },
      body: JSON.stringify({ decision })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    result.value = data
    emit('decided', data)
  } catch (e) {
    error.value = String(e.message || e)
  } finally {
    busy.value = false
  }
}
</script>
