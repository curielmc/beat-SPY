<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <button class="btn btn-ghost btn-xs" @click="$router.back()">← Back</button>
        <h1 class="text-xl font-bold inline-block ml-2">Audit log</h1>
        <p v-if="competition" class="text-xs text-base-content/60">{{ competition.name }}</p>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="error" class="alert alert-error text-sm">{{ error }}</div>

    <div v-else-if="!rows.length" class="text-sm text-base-content/60">No audit entries yet.</div>

    <div v-else class="overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>When</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Diff</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td class="text-xs whitespace-nowrap">{{ formatDate(row.created_at) }}</td>
            <td class="text-xs">{{ row.actor?.full_name || row.actor?.email || row.actor_id || 'system' }}</td>
            <td class="text-xs"><span class="badge badge-sm">{{ row.action }}</span></td>
            <td class="text-xs">
              <details>
                <summary class="cursor-pointer">view</summary>
                <div class="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <p class="font-semibold text-xs">Before</p>
                    <pre class="text-xs bg-base-200 p-1 rounded overflow-x-auto max-w-xs">{{ pretty(row.before) }}</pre>
                  </div>
                  <div>
                    <p class="font-semibold text-xs">After</p>
                    <pre class="text-xs bg-base-200 p-1 rounded overflow-x-auto max-w-xs">{{ pretty(row.after) }}</pre>
                  </div>
                </div>
              </details>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../../lib/supabase'

const route = useRoute()
const rows = ref([])
const competition = ref(null)
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  loading.value = true
  const id = route.params.id
  try {
    const { data: comp } = await supabase
      .from('competitions')
      .select('id, name')
      .eq('id', id)
      .maybeSingle()
    competition.value = comp

    const { data, error: err } = await supabase
      .from('competition_audit_log')
      .select('*, actor:profiles(id, email, full_name)')
      .eq('competition_id', id)
      .order('created_at', { ascending: false })
      .limit(500)
    if (err) error.value = err.message
    else rows.value = data || []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

function formatDate(s) {
  try { return new Date(s).toLocaleString() } catch { return s }
}
function pretty(v) {
  if (v == null) return ''
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}
</script>
