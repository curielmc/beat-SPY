<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">Competitions</h1>
    <p class="text-sm text-base-content/60">Time-bound investing challenges with sponsors, benchmarks, and prizes.</p>

    <!-- Status filter tabs -->
    <div class="tabs tabs-boxed">
      <button class="tab" :class="{ 'tab-active': statusFilter === null }" @click="filterByStatus(null)">All</button>
      <button class="tab" :class="{ 'tab-active': statusFilter === 'registration' }" @click="filterByStatus('registration')">Open</button>
      <button class="tab" :class="{ 'tab-active': statusFilter === 'active' }" @click="filterByStatus('active')">Active</button>
      <button class="tab" :class="{ 'tab-active': statusFilter === 'completed' }" @click="filterByStatus('completed')">Completed</button>
    </div>

    <div v-if="store.loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="filtered.length === 0" class="text-center py-16 space-y-3">
      <div class="text-5xl">&#127942;</div>
      <p class="text-base-content/50">No competitions{{ statusFilter ? ' with this status' : '' }} right now.</p>
    </div>

    <div v-else class="space-y-3">
      <RouterLink
        v-for="comp in filtered"
        :key="comp.id"
        :to="`/competitions/${comp.id}`"
        class="card bg-base-100 shadow hover:shadow-md transition-shadow block"
      >
        <div class="card-body p-4">
          <div class="flex items-start gap-4">
            <img v-if="comp.sponsor_logo_url" :src="comp.sponsor_logo_url" :alt="comp.sponsor" class="w-12 h-12 rounded object-contain flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <span class="badge badge-sm" :class="statusBadgeClass(comp.status)">{{ statusLabel(comp.status) }}</span>
                <span v-if="comp.sponsor" class="badge badge-sm badge-outline">{{ comp.sponsor }}</span>
              </div>
              <h2 class="font-bold text-lg truncate">{{ comp.name }}</h2>
              <p v-if="comp.description" class="text-sm text-base-content/60 line-clamp-2">{{ comp.description }}</p>
              <div class="flex flex-wrap gap-3 mt-2 text-xs text-base-content/50">
                <span>Benchmark: <strong class="text-base-content">{{ comp.benchmark_ticker }}</strong></span>
                <span>Cash: <strong class="text-base-content">${{ Number(comp.starting_cash).toLocaleString() }}</strong></span>
                <span>{{ new Date(comp.start_date).toLocaleDateString() }} - {{ new Date(comp.end_date).toLocaleDateString() }}</span>
              </div>
              <!-- Prizes summary -->
              <div v-if="comp.prizes?.length > 0" class="flex flex-wrap gap-1 mt-2">
                <span v-for="prize in comp.prizes.slice(0, 3)" :key="prize.place" class="badge badge-xs" :class="prize.place === 1 ? 'badge-warning' : 'badge-ghost'">
                  #{{ prize.place }}: {{ prize.description }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useCompetitionsStore } from '../../stores/competitions'

const store = useCompetitionsStore()
const statusFilter = ref(null)

const filtered = computed(() => {
  if (!statusFilter.value) {
    // Show registration + active first, then completed — hide drafts/cancelled for students
    return store.competitions.filter(c => ['registration', 'active', 'completed'].includes(c.status))
  }
  return store.competitions.filter(c => c.status === statusFilter.value)
})

onMounted(() => store.fetchCompetitions())

function filterByStatus(status) {
  statusFilter.value = status
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
