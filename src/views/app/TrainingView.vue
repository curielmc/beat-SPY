<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">Tutorials</h1>
    <p class="text-sm text-base-content/60">Learn the fundamentals of investing, trading, and personal finance.</p>

    <!-- Resources Card -->
    <div class="card bg-primary text-primary-content shadow-sm">
      <div class="card-body p-4 flex-row items-center justify-between gap-4">
        <div>
          <h2 class="font-bold">Presentation Slides</h2>
          <p class="text-xs opacity-80">Prefer to read at your own pace? Download the full slide deck.</p>
        </div>
        <a href="/Beat-the-SandP-500.pdf" download class="btn btn-sm btn-outline border-primary-content text-primary-content hover:bg-primary-content hover:text-primary gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Download PDF
        </a>
      </div>
    </div>

    <!-- Category filter tabs -->
    <div class="tabs tabs-boxed">
      <button class="tab" :class="{ 'tab-active': !categoryFilter }" @click="categoryFilter = null">All</button>
      <button class="tab" :class="{ 'tab-active': categoryFilter === 'investments' }" @click="categoryFilter = 'investments'">Investments</button>
      <button class="tab" :class="{ 'tab-active': categoryFilter === 'trading' }" @click="categoryFilter = 'trading'">Trading</button>
      <button class="tab" :class="{ 'tab-active': categoryFilter === 'economics' }" @click="categoryFilter = 'economics'">Economics</button>
      <button class="tab" :class="{ 'tab-active': categoryFilter === 'personal-finance' }" @click="categoryFilter = 'personal-finance'">Personal Finance</button>
    </div>

    <div v-if="store.loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="filtered.length === 0" class="text-center py-16 space-y-3">
      <div class="text-5xl">&#128218;</div>
      <p class="text-base-content/50">No tutorials{{ categoryFilter ? ' in this category' : '' }} available yet.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <RouterLink
        v-for="tutorial in filtered"
        :key="tutorial.id"
        :to="`/training/${tutorial.slug}`"
        class="card bg-base-100 shadow hover:shadow-md transition-shadow"
      >
        <div class="card-body p-4">
          <div class="flex items-center gap-2 mb-1">
            <span v-if="tutorial.category" class="badge badge-sm badge-outline">{{ formatCategory(tutorial.category) }}</span>
          </div>
          <h2 class="card-title text-lg">{{ tutorial.title }}</h2>
          <p v-if="tutorial.description" class="text-sm text-base-content/60 line-clamp-2">{{ tutorial.description }}</p>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useTrainingStore } from '../../stores/training'

const store = useTrainingStore()
const categoryFilter = ref(null)

const filtered = computed(() => {
  if (!categoryFilter.value) return store.tutorials
  return store.tutorials.filter(t => t.category === categoryFilter.value)
})

function formatCategory(cat) {
  return cat.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

onMounted(() => store.fetchTutorials())
</script>
