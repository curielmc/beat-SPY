<template>
  <div class="border border-base-300 rounded-lg p-3 space-y-2">
    <p class="font-semibold text-sm">Manage participants</p>

    <div v-if="loading" class="text-xs text-base-content/50">Loading…</div>

    <div v-else-if="!entries.length" class="text-xs text-base-content/50">No entries.</div>

    <table v-else class="table table-xs">
      <thead><tr><th>Participant</th><th>Status</th><th></th></tr></thead>
      <tbody>
        <tr v-for="e in entries" :key="e.id">
          <td>
            <div class="font-medium">{{ e.profiles?.full_name || e.profiles?.username || e.user_id }}</div>
          </td>
          <td>
            <span class="badge badge-xs" :class="e.status === 'removed' ? 'badge-error' : 'badge-success'">{{ e.status || 'active' }}</span>
          </td>
          <td>
            <button v-if="e.status !== 'removed'" class="btn btn-ghost btn-xs text-error" @click="remove(e)">
              Remove
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="error" class="text-error text-xs">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { supabase, getAccessToken } from '../../lib/supabase'

const props = defineProps({ competitionId: { type: String, required: true } })
const entries = ref([])
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  const { data, error: err } = await supabase
    .from('competition_entries')
    .select('*, profiles:profiles(id, full_name, username)')
    .eq('competition_id', props.competitionId)
  if (err) error.value = err.message
  else entries.value = data || []
  loading.value = false
}

onMounted(load)
watch(() => props.competitionId, load)

async function remove(entry) {
  const reason = window.prompt('Reason for removing this participant (required):', '')
  if (reason === null) return
  if (!reason.trim()) { error.value = 'Reason is required'; return }
  error.value = ''
  try {
    const token = await getAccessToken()
    const res = await fetch(`/api/competitions/${props.competitionId}/remove-entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entry_id: entry.id, removed_reason: reason.trim() })
    })
    const body = await res.json()
    if (!res.ok) { error.value = body.error || 'Remove failed'; return }
    await load()
  } catch (e) { error.value = e.message }
}
</script>
