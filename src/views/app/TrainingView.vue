<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">Tutorials</h1>
    <p class="text-sm text-base-content/60">Learn the fundamentals of investing, trading, and personal finance.</p>

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
