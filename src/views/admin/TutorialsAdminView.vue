<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-xl font-bold">Tutorial Library</h1>
        <p class="text-sm text-base-content/60">Manage your investment curriculum and interactive lessons.</p>
      </div>
      <button @click="createNew" class="btn btn-primary btn-sm gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
        Create New
      </button>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else class="grid grid-cols-1 gap-4">
      <div v-for="tutorial in tutorials" :key="tutorial.id" class="card bg-base-100 shadow-sm">
        <div class="card-body p-4 flex-row items-center gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="badge badge-xs" :class="tutorial.status === 'active' ? 'badge-success' : 'badge-ghost'">{{ tutorial.status }}</span>
              <span v-if="tutorial.category" class="badge badge-xs badge-outline">{{ formatCategory(tutorial.category) }}</span>
            </div>
            <h3 class="font-bold">{{ tutorial.title }}</h3>
            <p class="text-sm text-base-content/60 truncate">{{ tutorial.description }}</p>
          </div>
          
          <div class="flex gap-2">
            <button @click="toggleStatus(tutorial)" class="btn btn-ghost btn-sm" :title="tutorial.status === 'active' ? 'Move to Draft' : 'Publish'">
              <svg v-if="tutorial.status === 'active'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            </button>
            <button @click="editTutorial(tutorial)" class="btn btn-ghost btn-sm text-primary">Edit</button>
            <button @click="confirmDelete(tutorial)" class="btn btn-ghost btn-sm text-error">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTrainingStore } from '../../stores/training'

const router = useRouter()
const store = useTrainingStore()
const loading = ref(true)

const tutorials = computed(() => store.tutorials)

function createNew() {
  router.push('/admin/tutorials/new')
}

function editTutorial(tutorial) {
  router.push(`/admin/tutorials/edit/${tutorial.id}`)
}

async function toggleStatus(tutorial) {
  const newStatus = tutorial.status === 'active' ? 'draft' : 'active'
  await store.saveTutorial({ ...tutorial, status: newStatus })
}

function formatCategory(cat) {
  return cat.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

async function confirmDelete(tutorial) {
  if (confirm(`Are you sure you want to delete "${tutorial.title}"? This cannot be undone.`)) {
    await store.deleteTutorial(tutorial.id)
  }
}

onMounted(async () => {
  loading.value = true
  await store.fetchTutorials()
  loading.value = false
})
</script>
