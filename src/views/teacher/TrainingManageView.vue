<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold">Tutorials</h1>
      <p class="text-sm text-base-content/60">Select tutorials from the library to make available to students in your classes.</p>
    </div>

    <!-- Class selector (if teacher has multiple classes) -->
    <div v-if="teacherStore.classes.length > 1" class="form-control w-full max-w-xs">
      <label class="label"><span class="label-text font-medium">Select Class</span></label>
      <select class="select select-bordered select-sm" v-model="selectedClassId">
        <option v-for="cls in teacherStore.classes" :key="cls.id" :value="cls.id">{{ cls.class_name }}</option>
      </select>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <!-- Assigned tutorials -->
      <div>
        <h2 class="text-lg font-semibold mb-3">Assigned Tutorials</h2>
        <div v-if="assignedTutorials.length === 0" class="text-center py-8 bg-base-100 rounded-lg">
          <p class="text-base-content/50">No tutorials assigned yet. Add tutorials from the library below.</p>
        </div>
        <div v-else class="space-y-2">
          <div v-for="at in assignedTutorials" :key="at.id" class="card bg-base-100 shadow-sm">
            <div class="card-body p-4 flex-row items-center gap-4">
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold">{{ at.training_tutorial?.title }}</h3>
                <p class="text-sm text-base-content/60 truncate">{{ at.training_tutorial?.description }}</p>
                <span v-if="at.training_tutorial?.category" class="badge badge-xs badge-outline mt-1">{{ formatCategory(at.training_tutorial.category) }}</span>
              </div>
              <button class="btn btn-ghost btn-sm btn-square text-error" @click="removeTutorial(at.training_tutorial_id)" title="Remove from class">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Available tutorials (not yet assigned) -->
      <div>
        <h2 class="text-lg font-semibold mb-3">Tutorial Library</h2>
        <div v-if="availableTutorials.length === 0" class="text-center py-8 bg-base-100 rounded-lg">
          <p class="text-base-content/50">All available tutorials have been assigned.</p>
        </div>
        <div v-else class="space-y-2">
          <div v-for="tutorial in availableTutorials" :key="tutorial.id" class="card bg-base-100 shadow-sm">
            <div class="card-body p-4 flex-row items-center gap-4">
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold">{{ tutorial.title }}</h3>
                <p class="text-sm text-base-content/60 truncate">{{ tutorial.description }}</p>
                <span v-if="tutorial.category" class="badge badge-xs badge-outline mt-1">{{ formatCategory(tutorial.category) }}</span>
              </div>
              <button class="btn btn-primary btn-sm" @click="addTutorial(tutorial.id)">
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useTeacherStore } from '../../stores/teacher'
import { useTrainingStore } from '../../stores/training'

const teacherStore = useTeacherStore()
const trainingStore = useTrainingStore()
const loading = ref(true)
const selectedClassId = ref(null)

const assignedTutorials = computed(() => trainingStore.classTutorials)

const assignedTutorialIds = computed(() =>
  new Set(trainingStore.classTutorials.map(ct => ct.training_tutorial_id))
)

const availableTutorials = computed(() =>
  trainingStore.tutorials.filter(t => !assignedTutorialIds.value.has(t.id))
)

function formatCategory(cat) {
  return cat.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

async function addTutorial(tutorialId) {
  if (!selectedClassId.value) return
  await trainingStore.assignTutorialToClass(selectedClassId.value, tutorialId)
}

async function removeTutorial(tutorialId) {
  if (!selectedClassId.value) return
  await trainingStore.removeTutorialFromClass(selectedClassId.value, tutorialId)
}

async function loadData() {
  loading.value = true
  await trainingStore.fetchTutorials()
  if (selectedClassId.value) {
    await trainingStore.fetchClassTutorials(selectedClassId.value)
  }
  loading.value = false
}

onMounted(async () => {
  await teacherStore.loadTeacherData()
  if (teacherStore.classes.length > 0) {
    selectedClassId.value = teacherStore.classes[0].id
  }
  await loadData()
})

watch(selectedClassId, async (newId) => {
  if (newId) {
    loading.value = true
    await trainingStore.fetchClassTutorials(newId)
    loading.value = false
  }
})
</script>
