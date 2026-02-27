<template>
  <div class="p-4 space-y-6">
    <div>
      <h1 class="text-xl font-bold">Leaderboard</h1>
      <p class="text-sm text-base-content/60">See how every group is performing</p>
    </div>

    <!-- S&P 500 Benchmark -->
    <div class="card bg-primary/10 border border-primary/30">
      <div class="card-body p-4 flex-row justify-between items-center">
        <div>
          <p class="font-semibold text-primary">S&P 500 Benchmark</p>
          <p class="text-xs text-base-content/60">The index to beat</p>
        </div>
        <span class="text-lg font-bold text-primary">+{{ SP500_RETURN_PCT }}%</span>
      </div>
    </div>

    <!-- Rankings -->
    <div class="space-y-2">
      <div v-for="(group, index) in rankedGroups" :key="group.id" class="card shadow" :class="group.id === auth.currentUser?.groupId ? 'bg-primary/5 ring-1 ring-primary' : 'bg-base-100'">
        <div class="card-body p-4">
          <div class="flex items-center gap-3">
            <!-- Rank -->
            <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg" :class="rankClass(index)">
              {{ index + 1 }}
            </div>

            <!-- Group Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="font-semibold truncate">{{ group.name }}</p>
                <span v-if="group.id === auth.currentUser?.groupId" class="badge badge-primary badge-xs">You</span>
              </div>
              <p class="text-xs text-base-content/60">{{ getMemberNames(group) }}</p>
            </div>

            <!-- Performance -->
            <div class="text-right flex-shrink-0">
              <p class="font-bold" :class="group.returnPct >= 0 ? 'text-success' : 'text-error'">
                {{ group.returnPct >= 0 ? '+' : '' }}{{ group.returnPct.toFixed(2) }}%
              </p>
              <p class="text-xs text-base-content/50">${{ group.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</p>
              <span v-if="group.returnPct > SP500_RETURN_PCT" class="badge badge-success badge-xs mt-1">Beating S&P</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { usePortfolioStore } from '../../stores/portfolio'

const auth = useAuthStore()
const portfolio = usePortfolioStore()
const SP500_RETURN_PCT = portfolio.SP500_RETURN_PCT

const rankedGroups = computed(() => {
  return auth.groups.map(g => ({
    ...g,
    totalValue: portfolio.getPortfolioValue(g.id),
    returnPct: portfolio.getPortfolioReturn(g.id)
  })).sort((a, b) => b.returnPct - a.returnPct)
})

function getMemberNames(group) {
  return auth.students.filter(s => group.memberIds.includes(s.id)).map(s => s.name.split(' ')[0]).join(', ')
}

function rankClass(index) {
  if (index === 0) return 'bg-warning text-warning-content'
  if (index === 1) return 'bg-base-300 text-base-content'
  if (index === 2) return 'bg-accent/30 text-accent-content'
  return 'bg-base-200 text-base-content/60'
}
</script>
