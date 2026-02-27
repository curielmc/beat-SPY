<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Dashboard</h1>
      <p class="text-base-content/70">{{ teacher.currentTeacherData?.className }} &mdash; {{ teacher.currentTeacherData?.school }}</p>
    </div>

    <div class="stats shadow bg-base-100 w-full">
      <div class="stat">
        <div class="stat-title">Groups</div>
        <div class="stat-value">{{ teacher.teacherGroups.length }}</div>
      </div>
      <div class="stat">
        <div class="stat-title">Students</div>
        <div class="stat-value">{{ teacher.teacherStudents.length }}</div>
      </div>
      <div class="stat">
        <div class="stat-title">S&P 500 Benchmark</div>
        <div class="stat-value text-success">+{{ SP500_RETURN_PCT }}%</div>
      </div>
    </div>

    <!-- Performance Chart -->
    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <div class="flex items-center justify-between mb-2">
          <h2 class="card-title text-lg">Group Performance Over Time</h2>
          <TimeRangeSelector v-model="timeRange" />
        </div>
        <PortfolioLineChart :datasets="allGroupDatasets" :time-range="timeRange" height="320px" />
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
              <tr v-for="(group, i) in teacher.rankedGroups" :key="group.id">
                <td>
                  <span class="badge" :class="i === 0 ? 'badge-warning' : 'badge-ghost'">{{ i + 1 }}</span>
                </td>
                <td class="font-medium">{{ group.name }}</td>
                <td>
                  <div class="flex flex-wrap gap-1">
                    <span v-for="s in getGroupMembers(group)" :key="s.id" class="badge badge-sm badge-outline">{{ s.name.split(' ')[0] }}</span>
                  </div>
                </td>
                <td class="text-right font-mono" :class="group.returnPct >= 0 ? 'text-success' : 'text-error'">
                  {{ group.returnPct >= 0 ? '+' : '' }}{{ group.returnPct.toFixed(2) }}%
                </td>
                <td class="text-right font-mono">${{ group.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTeacherStore } from '../../stores/teacher'
import { usePortfolioStore } from '../../stores/portfolio'
import { useAuthStore } from '../../stores/auth'
import { useHistoricalDataStore } from '../../stores/historicalData'
import PortfolioLineChart from '../../components/charts/PortfolioLineChart.vue'
import TimeRangeSelector from '../../components/charts/TimeRangeSelector.vue'

const teacher = useTeacherStore()
const { SP500_RETURN_PCT } = usePortfolioStore()
const auth = useAuthStore()
const histStore = useHistoricalDataStore()

const timeRange = ref('3M')

const TEAM_COLORS = ['primary', 'secondary', 'accent', 'info', 'success']

const allGroupDatasets = computed(() => {
  const ds = teacher.teacherGroups.map((g, i) => ({
    label: g.name,
    data: histStore.getGroupHistory(g.id),
    color: TEAM_COLORS[i % TEAM_COLORS.length]
  }))
  ds.push({ label: 'S&P 500', data: histStore.sp500History, color: 'sp500' })
  return ds
})

function getGroupMembers(group) {
  return auth.students.filter(s => group.memberIds.includes(s.id))
}
</script>
