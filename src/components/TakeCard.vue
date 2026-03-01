<template>
  <div class="card bg-base-100 shadow">
    <div class="card-body p-4">
      <!-- Header: author + time -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="avatar placeholder">
            <div class="bg-primary text-primary-content rounded-full w-8 h-8">
              <img v-if="take.profiles?.avatar_url" :src="take.profiles.avatar_url" :alt="authorName" class="rounded-full" />
              <span v-else class="text-sm">{{ (authorName || '?')[0].toUpperCase() }}</span>
            </div>
          </div>
          <div>
            <RouterLink v-if="take.profiles?.username" :to="`/u/${take.profiles.username}`" class="font-semibold text-sm link link-hover">
              {{ authorName }}
            </RouterLink>
            <span v-else class="font-semibold text-sm">{{ authorName }}</span>
            <span v-if="take.profiles?.username" class="text-xs text-base-content/50 ml-1">@{{ take.profiles.username }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-base-content/40">{{ timeAgo }}</span>
          <FollowButton v-if="showFollowButton && take.user_id" :userId="take.user_id" size="xs" />
        </div>
      </div>

      <!-- Badges: side + ticker -->
      <div class="flex items-center gap-2 mt-2">
        <span class="badge badge-sm font-bold" :class="take.side === 'bull' ? 'badge-success' : 'badge-error'">
          {{ take.side === 'bull' ? 'Bull' : 'Bear' }}
        </span>
        <RouterLink v-if="showTicker && take.ticker" :to="`/stocks/${take.ticker}`" class="badge badge-sm badge-primary font-mono link link-hover">
          {{ take.ticker }}
        </RouterLink>
        <span v-else-if="take.ticker" class="badge badge-sm badge-primary font-mono">{{ take.ticker }}</span>
      </div>

      <!-- Body -->
      <p class="text-sm text-base-content/80 mt-1 whitespace-pre-wrap">{{ take.body }}</p>

      <!-- Target info -->
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/50 mt-2">
        <span v-if="take.target_price">Target: ${{ Number(take.target_price).toFixed(2) }}</span>
        <span v-if="take.target_date">by {{ new Date(take.target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}</span>
        <span v-if="take.price_at_creation">Posted at ${{ Number(take.price_at_creation).toFixed(2) }}</span>
        <span v-if="daysLeft !== null && daysLeft > 0">{{ daysLeft }}d left</span>
        <span v-if="daysLeft !== null && daysLeft <= 0" class="text-warning">Expired</span>
      </div>

      <!-- Outcome badge -->
      <div v-if="take.outcome && take.outcome !== 'pending'" class="mt-2">
        <span class="badge badge-sm" :class="outcomeBadgeClass">{{ take.outcome }}</span>
      </div>
      <div v-else-if="isExpired && take.outcome === 'pending'" class="mt-2">
        <span class="badge badge-sm badge-warning">Awaiting resolution</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useSocialStore } from '../stores/social'
import FollowButton from './FollowButton.vue'

const props = defineProps({
  take: Object,
  showTicker: { type: Boolean, default: false },
  showFollowButton: { type: Boolean, default: false },
  currentPrice: { type: Number, default: null }
})

const social = useSocialStore()

const authorName = computed(() =>
  props.take.profiles?.full_name || 'Anonymous'
)

const timeAgo = computed(() => {
  const diff = Date.now() - new Date(props.take.created_at).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(props.take.created_at).toLocaleDateString()
})

const daysLeft = computed(() => {
  if (!props.take.target_date) return null
  const target = new Date(props.take.target_date + 'T23:59:59')
  const diff = target.getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
})

const isExpired = computed(() => daysLeft.value !== null && daysLeft.value <= 0)

const outcomeBadgeClass = computed(() => {
  if (props.take.outcome === 'correct') return 'badge-success'
  if (props.take.outcome === 'incorrect') return 'badge-error'
  return 'badge-ghost'
})

onMounted(() => {
  if (isExpired.value && props.take.outcome === 'pending' && props.currentPrice) {
    social.resolveTake(props.take.id, props.currentPrice)
  }
})
</script>
