<template>
  <div class="space-y-4">
    <button class="btn btn-ghost btn-sm gap-1" @click="router.push('/competitions')">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
      Back to Competitions
    </button>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="!comp" class="text-center py-12 text-base-content/50">Competition not found.</div>

    <template v-else>
      <!-- Header -->
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex items-start gap-4">
            <img v-if="comp.sponsor_logo_url" :src="comp.sponsor_logo_url" :alt="comp.sponsor" class="w-16 h-16 rounded object-contain" />
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="badge badge-sm" :class="statusBadgeClass(comp.status)">{{ statusLabel(comp.status) }}</span>
                <span v-if="comp.sponsor" class="badge badge-sm badge-outline">Sponsored by {{ comp.sponsor }}</span>
              </div>
              <h1 class="text-2xl font-bold">{{ comp.name }}</h1>
              <p v-if="comp.description" class="text-base-content/70 mt-1">{{ comp.description }}</p>
              <div class="flex flex-wrap gap-4 mt-3 text-sm text-base-content/50">
                <span>Benchmark: <strong class="text-base-content">{{ comp.benchmark_ticker }}</strong></span>
                <span>Starting Cash: <strong class="text-base-content">${{ Number(comp.starting_cash).toLocaleString() }}</strong></span>
                <span>{{ new Date(comp.start_date).toLocaleDateString() }} - {{ new Date(comp.end_date).toLocaleDateString() }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Rules -->
      <div v-if="hasRules" class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <h3 class="font-semibold mb-2">Rules</h3>
          <ul class="space-y-1 text-sm">
            <li v-if="comp.rules.min_stocks" class="flex items-center gap-2">
              <span class="badge badge-xs badge-info">Min</span>
              Hold at least {{ comp.rules.min_stocks }} different securities
            </li>
            <li v-if="comp.rules.max_position_pct" class="flex items-center gap-2">
              <span class="badge badge-xs badge-warning">Max</span>
              No single position over {{ comp.rules.max_position_pct }}% of portfolio
            </li>
            <li v-if="comp.rules.require_thesis" class="flex items-center gap-2">
              <span class="badge badge-xs badge-primary">Req</span>
              Thesis required at registration
            </li>
            <li v-if="comp.rules.restricted_tickers?.length" class="flex items-center gap-2">
              <span class="badge badge-xs badge-error">Restricted</span>
              {{ comp.rules.restricted_tickers.join(', ') }}
            </li>
          </ul>
        </div>
      </div>

      <!-- Prizes -->
      <div v-if="comp.prizes?.length > 0" class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <h3 class="font-semibold mb-2">Prizes</h3>
          <div class="space-y-2">
            <div v-for="prize in comp.prizes" :key="prize.place" class="flex items-center gap-3">
              <span class="badge badge-lg" :class="prize.place === 1 ? 'badge-warning' : prize.place === 2 ? 'badge-ghost' : 'badge-outline'">
                #{{ prize.place }}
              </span>
              <span>{{ prize.description }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Registration -->
      <div v-if="comp.status === 'registration' && !myEntry" class="card bg-base-100 shadow">
        <div class="card-body p-4 space-y-3">
          <h3 class="font-semibold">Register</h3>
          <div v-if="comp.rules?.require_thesis" class="form-control">
            <label class="label py-1"><span class="label-text text-sm">Investment Thesis (required)</span></label>
            <textarea v-model="registrationThesis" class="textarea textarea-bordered w-full" rows="3" placeholder="Describe your investment strategy for this competition..."></textarea>
          </div>
          <div v-if="registerError" class="text-error text-sm">{{ registerError }}</div>
          <button class="btn btn-primary btn-block" :disabled="registering || (comp.rules?.require_thesis && !registrationThesis.trim())" @click="register">
            <span v-if="registering" class="loading loading-spinner loading-sm"></span>
            Join Competition
          </button>
        </div>
      </div>

      <!-- My entry info -->
      <div v-if="myEntry" class="card bg-primary/10 shadow">
        <div class="card-body p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-semibold">You're registered!</p>
              <p class="text-sm text-base-content/60">Portfolio: {{ myEntry.portfolio_id?.slice(0, 8) }}...</p>
            </div>
            <RouterLink :to="`/stocks`" class="btn btn-sm btn-primary">Trade</RouterLink>
          </div>
          <p v-if="myEntry.thesis" class="text-sm mt-2 p-2 bg-base-200 rounded">{{ myEntry.thesis }}</p>
        </div>
      </div>

      <!-- Tabs: Leaderboard -->
      <div class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <h3 class="font-semibold mb-3">Leaderboard</h3>

          <div v-if="leaderboardLoading" class="flex justify-center py-4">
            <span class="loading loading-spinner loading-sm"></span>
          </div>

          <div v-else-if="leaderboard.length === 0" class="text-center py-6 text-base-content/40 text-sm">
            No participants yet.
          </div>

          <div v-else class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Participant</th>
                  <th class="text-right">Return</th>
                  <th class="text-right">Value</th>
                  <th class="text-right">Holdings</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(entry, idx) in leaderboard" :key="entry.id" :class="{ 'bg-primary/5': entry.user_id === auth.currentUser?.id }">
                  <td class="font-bold">{{ entry.final_rank || idx + 1 }}</td>
                  <td>
                    <RouterLink v-if="entry.profiles?.username" :to="`/u/${entry.profiles.username}`" class="link link-hover">
                      {{ entry.profiles.full_name }}
                    </RouterLink>
                    <span v-else>{{ entry.profiles?.full_name || 'Unknown' }}</span>
                  </td>
                  <td class="text-right font-mono" :class="entry.returnPct >= 0 ? 'text-success' : 'text-error'">
                    {{ entry.returnPct >= 0 ? '+' : '' }}{{ entry.returnPct.toFixed(2) }}%
                  </td>
                  <td class="text-right font-mono">${{ entry.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</td>
                  <td class="text-right">{{ entry.holdingsCount }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Theses -->
          <div v-if="entriesWithThesis.length > 0" class="mt-4 space-y-2">
            <h4 class="font-semibold text-sm">Participant Theses</h4>
            <div v-for="entry in entriesWithThesis" :key="entry.id" class="p-2 bg-base-200 rounded">
              <p class="text-xs font-semibold text-base-content/60">{{ entry.profiles?.full_name || 'Unknown' }}</p>
              <p class="text-sm">{{ entry.thesis }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useCompetitionsStore } from '../../stores/competitions'
import { useAuthStore } from '../../stores/auth'

const route = useRoute()
const router = useRouter()
const store = useCompetitionsStore()
const auth = useAuthStore()

const loading = ref(true)
const comp = ref(null)
const leaderboard = ref([])
const leaderboardLoading = ref(true)
const registrationThesis = ref('')
const registerError = ref('')
const registering = ref(false)

const myEntry = computed(() => {
  if (!auth.currentUser || !comp.value?.entries) return null
  return comp.value.entries.find(e => e.user_id === auth.currentUser.id)
})

const hasRules = computed(() => {
  if (!comp.value?.rules) return false
  const r = comp.value.rules
  return r.min_stocks || r.max_position_pct || r.require_thesis || r.restricted_tickers?.length
})

const entriesWithThesis = computed(() => {
  return leaderboard.value.filter(e => e.thesis)
})

onMounted(async () => {
  const data = await store.fetchCompetition(route.params.id)
  comp.value = data
  loading.value = false

  if (data) {
    leaderboard.value = await store.getCompetitionLeaderboard(data.id)
    leaderboardLoading.value = false
  }
})

async function register() {
  registerError.value = ''
  registering.value = true
  const result = await store.registerForCompetition(comp.value.id, registrationThesis.value || null)
  registering.value = false

  if (result.error) {
    registerError.value = result.error
    return
  }

  // Reload competition data
  comp.value = await store.fetchCompetition(comp.value.id)
  leaderboard.value = await store.getCompetitionLeaderboard(comp.value.id)
}

function statusBadgeClass(status) {
  const map = { draft: 'badge-ghost', registration: 'badge-info', active: 'badge-success', completed: 'badge-neutral', cancelled: 'badge-error' }
  return map[status] || 'badge-ghost'
}

function statusLabel(status) {
  const map = { draft: 'Draft', registration: 'Registration Open', active: 'Active', completed: 'Completed', cancelled: 'Cancelled' }
  return map[status] || status
}
</script>
