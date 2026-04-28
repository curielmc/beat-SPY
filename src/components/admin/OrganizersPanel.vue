<template>
  <div class="border border-base-300 rounded-lg p-3 space-y-2">
    <p class="font-semibold text-sm">Organizers</p>

    <div v-if="loading" class="text-xs text-base-content/50">Loading…</div>

    <div v-else-if="!organizers.length" class="text-xs text-base-content/50">No organizers yet.</div>

    <table v-else class="table table-xs">
      <thead><tr><th>User</th><th>Role</th><th></th></tr></thead>
      <tbody>
        <tr v-for="org in organizers" :key="org.user_id">
          <td>
            <div class="font-medium">{{ org.profile?.full_name || org.profile?.username || org.user_id }}</div>
            <div class="text-xs text-base-content/50">{{ org.profile?.email }}</div>
          </td>
          <td>
            <select :value="org.role" :disabled="org.role === 'owner'" class="select select-bordered select-xs"
                    @change="changeRole(org, $event.target.value)">
              <option value="owner">Owner</option>
              <option value="organizer">Organizer</option>
              <option value="viewer">Viewer</option>
            </select>
          </td>
          <td>
            <button class="btn btn-ghost btn-xs text-error" :disabled="org.role === 'owner'"
                    :title="org.role === 'owner' ? 'Owner cannot be removed' : 'Remove'"
                    @click="removeOrganizer(org)">
              &#10005;
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Add organizer -->
    <div class="space-y-1">
      <label class="label py-0.5"><span class="label-text text-xs">Add organizer (search by email or username)</span></label>
      <div class="flex gap-2">
        <input v-model="searchTerm" type="text" class="input input-bordered input-sm flex-1"
               placeholder="email@example.com or username"
               @input="searchProfiles" />
        <select v-model="newRole" class="select select-bordered select-sm">
          <option value="organizer">Organizer</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>
      <div v-if="searchResults.length" class="border border-base-300 rounded p-1 max-h-32 overflow-y-auto">
        <div v-for="r in searchResults" :key="r.id"
             class="px-2 py-1 hover:bg-base-200 cursor-pointer text-xs flex justify-between"
             @click="addOrganizer(r)">
          <span>{{ r.full_name || r.username || r.email }}</span>
          <span class="text-base-content/50">{{ r.email }}</span>
        </div>
      </div>
    </div>

    <div v-if="error" class="text-error text-xs">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { supabase, getAccessToken } from '../../lib/supabase'

const props = defineProps({
  competitionId: { type: String, required: true }
})

const organizers = ref([])
const loading = ref(false)
const searchTerm = ref('')
const searchResults = ref([])
const newRole = ref('organizer')
const error = ref('')

let searchTimer = null

async function load() {
  loading.value = true
  error.value = ''
  const { data, error: err } = await supabase
    .from('competition_organizers')
    .select('*, profile:profiles(id, email, username, full_name)')
    .eq('competition_id', props.competitionId)
  if (err) {
    error.value = err.message
    organizers.value = []
  } else {
    organizers.value = data || []
  }
  loading.value = false
}

onMounted(load)
watch(() => props.competitionId, load)

function searchProfiles() {
  clearTimeout(searchTimer)
  const term = searchTerm.value.trim()
  if (term.length < 2) { searchResults.value = []; return }
  const safeTerm = term.replace(/[%_]/g, m => '\\' + m)
  searchTimer = setTimeout(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, username, full_name')
      .or(`email.ilike.%${safeTerm}%,username.ilike.%${safeTerm}%,full_name.ilike.%${safeTerm}%`)
      .limit(8)
    searchResults.value = data || []
  }, 250)
}

async function addOrganizer(profile) {
  error.value = ''
  searchResults.value = []
  searchTerm.value = ''
  try {
    const token = await getAccessToken()
    const res = await fetch(`/api/competitions/${props.competitionId}/organizers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ user_id: profile.id, role: newRole.value })
    })
    const body = await res.json()
    if (!res.ok) { error.value = body.error || 'Add failed'; return }
    await load()
  } catch (e) { error.value = e.message }
}

async function changeRole(org, role) {
  error.value = ''
  try {
    const token = await getAccessToken()
    const res = await fetch(`/api/competitions/${props.competitionId}/organizers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ user_id: org.user_id, role })
    })
    const body = await res.json()
    if (!res.ok) { error.value = body.error || 'Change failed'; await load(); return }
    await load()
  } catch (e) { error.value = e.message }
}

async function removeOrganizer(org) {
  if (org.role === 'owner') return
  if (!confirm('Remove this organizer?')) return
  error.value = ''
  try {
    const token = await getAccessToken()
    const res = await fetch(`/api/competitions/${props.competitionId}/organizers`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ user_id: org.user_id })
    })
    const body = await res.json()
    if (!res.ok) { error.value = body.error || 'Remove failed'; return }
    await load()
  } catch (e) { error.value = e.message }
}
</script>
