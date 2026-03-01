<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Dashboard</h1>
      <p class="text-base-content/70">{{ currentClass?.class_name }} &mdash; {{ currentClass?.school }}</p>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <div class="stats shadow bg-base-100 w-full">
        <div class="stat">
          <div class="stat-title">Groups</div>
          <div class="stat-value">{{ teacher.groups.length }}</div>
        </div>
        <div class="stat">
          <div class="stat-title">Students</div>
          <div class="stat-value">{{ teacher.students.length }}</div>
        </div>
        <div class="stat">
          <div class="stat-title">Benchmark (SPY)</div>
          <div class="stat-value text-success">Live</div>
        </div>
      </div>

      <!-- Leaderboard Table -->
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <h2 class="card-title">Group Leaderboard</h2>
          <div class="overflow-x-auto">
            <table class="table">
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
import { useTeacherStore } from '../../stores/teacher'

const teacher = useTeacherStore()
const loading = ref(true)
const rankedGroups = ref([])

const currentClass = computed(() => teacher.classes[0] || null)

onMounted(async () => {
  await teacher.loadTeacherData()
  rankedGroups.value = await teacher.getRankedGroups()
  loading.value = false
})
</script>
