<template>
  <div class="space-y-4">
    <div v-if="store.loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="!store.currentStep" class="text-center py-16 space-y-3">
      <div class="text-5xl">&#128533;</div>
      <p class="text-base-content/50">Step not found.</p>
      <RouterLink to="/training" class="btn btn-primary btn-sm">Back to Tutorials</RouterLink>
    </div>

    <template v-else>
      <!-- Breadcrumbs -->
      <div class="text-sm breadcrumbs">
        <ul>
          <li><RouterLink to="/training">Tutorials</RouterLink></li>
          <li><RouterLink :to="`/training/${route.params.slug}`">{{ store.currentTutorial?.title }}</RouterLink></li>
          <li>{{ store.currentStep.title }}</li>
        </ul>
      </div>

      <!-- Step content -->
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <h1 class="text-2xl font-bold mb-1">{{ store.currentStep.title }}</h1>
          <div class="flex items-center gap-3 text-sm text-base-content/50 mb-4">
            <span v-if="store.currentStep.duration_minutes">{{ store.currentStep.duration_minutes }} min read</span>
            <span>Step {{ stepIndex + 1 }} of {{ store.currentTutorial?.steps?.length }}</span>
          </div>

          <!-- Rendered HTML content -->
          <div class="prose max-w-none" v-html="store.currentStep.content"></div>
        </div>
      </div>

      <!-- Completion toggle and navigation -->
      <div class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <!-- Mark complete button -->
            <button
              v-if="!isCompleted"
              class="btn btn-success btn-sm gap-2"
              @click="markComplete"
              :disabled="marking"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              Mark as Complete
            </button>
            <button
              v-else
              class="btn btn-ghost btn-sm gap-2 text-success"
              @click="markIncomplete"
              :disabled="marking"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Completed
            </button>

            <!-- Navigation arrows -->
            <div class="flex gap-2">
              <RouterLink
                v-if="prevStep"
                :to="`/training/${route.params.slug}/${prevStep.slug}`"
                class="btn btn-ghost btn-sm gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                Previous
              </RouterLink>
              <RouterLink
                v-if="nextStep"
                :to="`/training/${route.params.slug}/${nextStep.slug}`"
                class="btn btn-primary btn-sm gap-1"
              >
                Next
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
              </RouterLink>
              <RouterLink
                v-else
                :to="`/training/${route.params.slug}`"
                class="btn btn-primary btn-sm gap-1"
              >
                Back to Tutorial
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useTrainingStore } from '../../stores/training'

const route = useRoute()
const store = useTrainingStore()
const marking = ref(false)

const stepIndex = computed(() => {
  if (!store.currentTutorial?.steps || !store.currentStep) return -1
  return store.currentTutorial.steps.findIndex(s => s.id === store.currentStep.id)
})

const prevStep = computed(() => {
  if (stepIndex.value <= 0) return null
  return store.currentTutorial.steps[stepIndex.value - 1]
})

const nextStep = computed(() => {
  if (!store.currentTutorial?.steps || stepIndex.value >= store.currentTutorial.steps.length - 1) return null
  return store.currentTutorial.steps[stepIndex.value + 1]
})

const isCompleted = computed(() => {
  return store.currentStep && store.progress[store.currentStep.id]?.completed
})

async function markComplete() {
  if (!store.currentStep) return
  marking.value = true
  await store.markStepCompleted(store.currentStep.id)
  marking.value = false
}

async function markIncomplete() {
  if (!store.currentStep) return
  marking.value = true
  await store.markStepIncomplete(store.currentStep.id)
  marking.value = false
}

async function loadStep() {
  await store.fetchStep(route.params.slug, route.params.moduleSlug)
}

onMounted(loadStep)
watch(() => route.params.moduleSlug, loadStep)
</script>
