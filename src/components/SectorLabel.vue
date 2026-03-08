<template>
  <span class="inline-flex items-center gap-1.5 min-w-0 align-middle">
    <span class="inline-flex items-center justify-center rounded-full bg-current/10 flex-shrink-0" :class="iconSizeClass" :style="iconStyle" aria-hidden="true">
      <svg class="stroke-current fill-none" :class="svgSizeClass" viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <template v-if="iconName === 'chip'">
          <rect x="7" y="7" width="10" height="10" rx="2" />
          <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" />
        </template>
        <template v-else-if="iconName === 'factory'">
          <path d="M3 21h18" />
          <path d="M5 21V10l6 3V10l6 3v8" />
          <path d="M8 21v-4M12 21v-4M16 21v-4" />
        </template>
        <template v-else-if="iconName === 'bank'">
          <path d="M3 10h18" />
          <path d="M4 10l8-5 8 5" />
          <path d="M6 10v8M10 10v8M14 10v8M18 10v8" />
          <path d="M3 21h18" />
        </template>
        <template v-else-if="iconName === 'broadcast'">
          <path d="M4 18a8 8 0 0 1 8-8" />
          <path d="M4 12a14 14 0 0 1 14-14" transform="translate(0 8)" />
          <path d="M12 18h.01" />
          <path d="M11 21h2" />
        </template>
        <template v-else-if="iconName === 'shield'">
          <path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z" />
          <path d="M9 12h6" />
        </template>
        <template v-else-if="iconName === 'cart'">
          <circle cx="9" cy="19" r="1.5" />
          <circle cx="17" cy="19" r="1.5" />
          <path d="M3 5h2l2.2 9h9.8l2-6H7.5" />
        </template>
        <template v-else-if="iconName === 'bolt'">
          <path d="M13 2L6 13h5l-1 9 7-11h-5l1-9z" />
        </template>
        <template v-else-if="iconName === 'home'">
          <path d="M3 11l9-7 9 7" />
          <path d="M5 10v10h14V10" />
          <path d="M10 20v-5h4v5" />
        </template>
        <template v-else-if="iconName === 'cross'">
          <path d="M12 5v14M5 12h14" />
          <rect x="4" y="4" width="16" height="16" rx="3" />
        </template>
        <template v-else-if="iconName === 'cube'">
          <path d="M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z" />
          <path d="M12 22V11.5M20 6.5l-8 5-8-5" />
        </template>
        <template v-else-if="iconName === 'plug'">
          <path d="M9 3v6M15 3v6M7 9h10v2a5 5 0 0 1-5 5h0a5 5 0 0 1-5-5V9z" />
          <path d="M12 16v5" />
        </template>
        <template v-else-if="iconName === 'wallet'">
          <path d="M3 7h15a3 3 0 0 1 3 3v7a2 2 0 0 1-2 2H3z" />
          <path d="M3 7V5a2 2 0 0 1 2-2h11" />
          <path d="M16 13h3" />
        </template>
        <template v-else>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 2.5" />
        </template>
      </svg>
    </span>
    <span v-if="showLabel" class="truncate">{{ sector || 'Unknown' }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  sector: { type: String, default: 'Unknown' },
  showLabel: { type: Boolean, default: true },
  size: { type: String, default: 'sm' },
  color: { type: String, default: null }
})

const normalizedSector = computed(() => {
  const value = (props.sector || 'Unknown').trim().toLowerCase()
  if (!value) return 'unknown'
  return value
})

const iconName = computed(() => {
  const sector = normalizedSector.value
  if (sector === 'technology') return 'chip'
  if (sector === 'industrials') return 'factory'
  if (sector === 'financial services') return 'bank'
  if (sector === 'communication services') return 'broadcast'
  if (sector === 'consumer defensive') return 'shield'
  if (sector === 'consumer cyclical') return 'cart'
  if (sector === 'energy') return 'bolt'
  if (sector === 'real estate') return 'home'
  if (sector === 'healthcare') return 'cross'
  if (sector === 'basic materials') return 'cube'
  if (sector === 'utilities') return 'plug'
  if (sector === 'cash') return 'wallet'
  return 'clock'
})

const iconSizeClass = computed(() => {
  if (props.size === 'xs') return 'w-4 h-4'
  if (props.size === 'lg') return 'w-7 h-7'
  return 'w-5 h-5'
})

const svgSizeClass = computed(() => {
  if (props.size === 'xs') return 'w-2.5 h-2.5'
  if (props.size === 'lg') return 'w-4 h-4'
  return 'w-3 h-3'
})

const iconStyle = computed(() => (props.color ? { color: props.color } : {}))
</script>
