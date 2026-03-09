<template>
  <div :class="['inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 shadow-xl ring-1 ring-white/20 relative overflow-hidden group', sizeClass]">
    <!-- Background patterns -->
    <div class="absolute inset-0 opacity-20 pointer-events-none">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" stroke-width="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>

    <!-- Main Icon -->
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      stroke-width="2.2" 
      stroke-linecap="round" 
      stroke-linejoin="round" 
      class="text-white relative z-10 filter drop-shadow-md"
    >
      <!-- Chart line -->
      <path d="M3 17l6-6 4 4 8-8" class="animate-pulse-subtle" />
      <!-- Arrow tip -->
      <path d="M17 7h4v4" />
      <!-- Base baseline -->
      <path d="M3 21h18" stroke-opacity="0.5" stroke-width="1.5" />
    </svg>
    
    <!-- Gloss effect -->
    <div class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-y-full group-hover:translate-y-[-200%] transition-transform duration-1000 ease-in-out"></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  size: {
    type: String,
    default: 'md' // sm, md, lg, xl
  }
})

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'w-10 h-10 rounded-xl p-2'
    case 'md': return 'w-14 h-14 rounded-2xl p-3'
    case 'lg': return 'w-20 h-20 rounded-[1.5rem] p-4'
    case 'xl': return 'w-24 h-24 rounded-[1.75rem] p-5'
    default: return 'w-14 h-14'
  }
})
</script>

<style scoped>
@keyframes pulse-subtle {
  0%, 100% { opacity: 1; stroke-width: 2.2; }
  50% { opacity: 0.8; stroke-width: 2.5; }
}
.animate-pulse-subtle {
  animation: pulse-subtle 3s infinite ease-in-out;
}
</style>
