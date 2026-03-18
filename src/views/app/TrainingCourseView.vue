<template>
  <div class="space-y-4">
    <div v-if="store.loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="!store.currentTutorial" class="text-center py-16 space-y-3">
      <div class="text-5xl">&#128533;</div>
      <p class="text-base-content/50">Tutorial not found.</p>
      <RouterLink to="/training" class="btn btn-primary btn-sm">Back to Tutorials</RouterLink>
    </div>

    <template v-else>
      <!-- Breadcrumbs -->
      <div class="text-sm breadcrumbs">
        <ul>
          <li><RouterLink to="/training">Tutorials</RouterLink></li>
          <li>{{ store.currentTutorial.title }}</li>
        </ul>
      </div>

      <!-- Tutorial header -->
      <div class="card bg-base-100 shadow">
        <div class="card-body p-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <span v-if="store.currentTutorial.category" class="badge badge-sm badge-outline mb-2">{{ formatCategory(store.currentTutorial.category) }}</span>
              <h1 class="text-2xl font-bold">{{ store.currentTutorial.title }}</h1>
              <p v-if="store.currentTutorial.description" class="text-base-content/60 mt-1">{{ store.currentTutorial.description }}</p>
            </div>
            <a
              v-if="store.currentTutorial.deck_pdf_url"
              :href="store.currentTutorial.deck_pdf_url"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-outline btn-sm"
            >
              Download Slides PDF
            </a>
          </div>

          <!-- Progress bar -->
          <div v-if="store.currentTutorial.steps?.length" class="mt-4">
            <div class="flex items-center justify-between text-sm mb-1">
              <span class="text-base-content/60">Progress</span>
              <span class="font-semibold">{{ completedCount }} / {{ store.currentTutorial.steps.length }} steps</span>
            </div>
            <progress class="progress progress-primary w-full" :value="completedCount" :max="store.currentTutorial.steps.length"></progress>
          </div>
        </div>
      </div>

      <!-- Steps list -->
      <div class="space-y-2">
        <RouterLink
          v-for="(step, index) in store.currentTutorial.steps"
          :key="step.id"
          :to="`/training/${store.currentTutorial.slug}/${step.slug}`"
          class="card bg-base-100 shadow-sm hover:shadow transition-shadow block"
        >
          <div class="card-body p-4 flex-row items-center gap-4">
            <!-- Step number / completion indicator -->
            <div class="flex-shrink-0">
              <div v-if="isCompleted(step.id)" class="w-8 h-8 rounded-full bg-success text-success-content flex items-center justify-center text-sm font-bold">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              </div>
              <div v-else class="w-8 h-8 rounded-full bg-base-200 text-base-content/60 flex items-center justify-center text-sm font-bold">
                {{ index + 1 }}
              </div>
            </div>

            <div class="flex-1 min-w-0">
              <h3 class="font-semibold">{{ step.title }}</h3>
              <p v-if="step.description" class="text-sm text-base-content/60 truncate">{{ step.description }}</p>
            </div>

            <div class="flex-shrink-0 flex items-center gap-2">
              <span v-if="step.duration_minutes" class="text-xs text-base-content/40">{{ step.duration_minutes }} min</span>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
        </RouterLink>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useTrainingStore } from '../../stores/training'

const route = useRoute()
const store = useTrainingStore()

const completedCount = computed(() => {
  if (!store.currentTutorial?.steps) return 0
  return store.currentTutorial.steps.filter(s => store.progress[s.id]?.completed).length
})

function isCompleted(stepId) {
  return store.progress[stepId]?.completed
}

function formatCategory(cat) {
  return cat.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

onMounted(() => store.fetchTutorial(route.params.slug))
</script>
