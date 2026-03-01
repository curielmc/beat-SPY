<template>
  <div class="card shadow" :class="isMe ? 'bg-primary/5 ring-1 ring-primary' : 'bg-base-100'">
    <div class="card-body p-4">
      <div class="flex items-center gap-3">
        <!-- Rank -->
        <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg" :class="rankClass">
          {{ rank }}
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <RouterLink v-if="entry.username" :to="`/u/${entry.username}`" class="font-semibold truncate link link-hover">
              {{ displayName }}
            </RouterLink>
            <span v-else class="font-semibold truncate">{{ displayName }}</span>
            <span v-if="entry.username" class="text-xs text-base-content/50">@{{ entry.username }}</span>
            <span v-if="isMe" class="badge badge-primary badge-xs">You</span>
            <span v-if="entry.owner_type" class="badge badge-xs" :class="entry.owner_type === 'group' ? 'badge-primary' : 'badge-secondary'">{{ entry.owner_type }}</span>
            <span v-if="entry.follower_count > 0" class="badge badge-ghost badge-xs">{{ entry.follower_count }} follower{{ entry.follower_count !== 1 ? 's' : '' }}</span>
          </div>
          <p class="text-xs text-base-content/60">{{ subtitle }}</p>
        </div>

        <!-- Performance -->
        <div class="text-right flex-shrink-0">
          <template v-if="metricLoading">
            <span class="loading loading-dots loading-xs"></span>
          </template>
          <template v-else-if="metricValue === null">
            <span class="text-xs text-base-content/40">N/A</span>
          </template>
          <template v-else>
            <p class="font-bold" :class="metricValue >= 0 ? 'text-success' : 'text-error'">
              {{ metricValue >= 0 ? '+' : '' }}{{ metricValue.toFixed(2) }}%
            </p>
          </template>
          <p class="text-xs text-base-content/50">${{ totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</p>
          <span v-if="isBeatingSP && !metricLoading && metricValue !== null" class="badge badge-success badge-xs mt-1">Beating S&P</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  rank: Number,
  entry: Object,
  activeMetric: { type: String, default: 'sinceInception' },
  isMe: Boolean,
  benchmarkValue: Number,
  metricLoading: Boolean
})

const displayName = computed(() =>
  props.entry.name || props.entry.full_name || props.entry.group_name || props.entry.portfolio_name || 'Anonymous'
)

const subtitle = computed(() => {
  if (props.entry.memberNames?.length) return props.entry.memberNames.join(', ')
  if (props.entry.portfolio_name) return props.entry.portfolio_name
  return ''
})

const metricValue = computed(() => {
  const metrics = props.entry.metrics
  if (!metrics) return props.entry.returnPct ?? 0
  const val = metrics[props.activeMetric]
  return val === undefined ? null : val
})

const totalValue = computed(() => props.entry.totalValue || 0)

const isBeatingSP = computed(() => {
  if (metricValue.value === null || props.benchmarkValue === null || props.benchmarkValue === undefined) return false
  return metricValue.value > props.benchmarkValue
})

const rankClass = computed(() => {
  if (props.rank === 1) return 'bg-warning text-warning-content'
  if (props.rank === 2) return 'bg-base-300 text-base-content'
  if (props.rank === 3) return 'bg-accent/30 text-accent-content'
  return 'bg-base-200 text-base-content/60'
})
</script>
