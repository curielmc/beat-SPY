<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
        Dashboard
      </h1>
      <p class="text-sm text-base-content/60 mt-1">Overview of <strong>{{ currentClass?.class_name }}</strong> &mdash; {{ currentClass?.school }}</p>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <div class="stats shadow bg-base-100 w-full border border-base-200">
        <div class="stat">
          <div class="stat-figure text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <div class="stat-title">Groups</div>
          <div class="stat-value text-primary">{{ teacher.groups.length }}</div>
        </div>
        <div class="stat">
          <div class="stat-figure text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </div>
          <div class="stat-title">Students</div>
          <div class="stat-value text-secondary">{{ teacher.students.length }}</div>
        </div>
        <div class="stat">
          <div class="stat-figure text-success">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </div>
          <div class="stat-title">Benchmark (SPY)</div>
          <div class="stat-value text-success">Live</div>
        </div>
      </div>

      <!-- Leaderboard Table -->
      <div class="card bg-base-100 shadow border border-base-200">
        <div class="card-body">
          <h2 class="card-title flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            Group Leaderboard
          </h2>
          <div class="overflow-x-auto mt-2">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Group</th>
                  <th>Members</th>
                  <th class="text-right">Return %</th>
                  <th class="text-right">Portfolio Value</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(group, i) in rankedGroups" :key="group.id">
                  <td>
                    <span class="badge" :class="i === 0 ? 'badge-warning' : 'badge-ghost'">{{ i + 1 }}</span>
                  </td>
                  <td class="font-medium">{{ group.name }}</td>
                  <td>
                    <div class="flex flex-wrap gap-1">
                      <span v-for="name in group.memberNames" :key="name" class="badge badge-sm badge-outline">{{ name.split(' ')[0] }}</span>
                    </div>
                  </td>
                  <td class="text-right font-mono" :class="group.returnPct >= 0 ? 'text-success' : 'text-error'">
                    {{ group.returnPct >= 0 ? '+' : '' }}{{ group.returnPct.toFixed(2) }}%
                  </td>
                  <td class="text-right font-mono">${{ group.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                </tr>
                <tr v-if="rankedGroups.length === 0">
                  <td colspan="5" class="text-center text-base-content/50">No groups yet</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useTeacherStore } from '../../stores/teacher'

const route = useRoute()
const teacher = useTeacherStore()
const loading = ref(true)
const rankedGroups = ref([])

const currentClass = computed(() => {
  const qid = route.query.class_id
  if (qid) {
    const match = teacher.classes.find(c => c.id === qid)
    if (match) return match
  }
  return teacher.classes[0] || null
})

onMounted(async () => {
  await teacher.loadTeacherData()
  rankedGroups.value = await teacher.getRankedGroups()
  loading.value = false
})
</script>
