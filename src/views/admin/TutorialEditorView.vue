<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <div class="flex items-center gap-4">
        <button @click="router.back()" class="btn btn-ghost btn-sm btn-square">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 class="text-xl font-bold">{{ isNew ? 'Create Tutorial' : 'Edit Tutorial' }}</h1>
          <p class="text-sm text-base-content/60">{{ isNew ? 'Set up a new lesson' : tutorial.title }}</p>
        </div>
      </div>
      <button @click="handleSaveTutorial" class="btn btn-primary btn-sm" :disabled="saving">
        <span v-if="saving" class="loading loading-spinner loading-xs"></span>
        Save Changes
      </button>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Sidebar Settings -->
      <div class="space-y-4">
        <div class="card bg-base-100 shadow-sm">
          <div class="card-body p-4 space-y-4">
            <h3 class="font-bold border-b pb-2">Tutorial Info</h3>
            
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Title</span></label>
              <input v-model="tutorial.title" type="text" placeholder="e.g. Intro to Dividends" class="input input-bordered input-sm" />
            </div>

            <div class="form-control w-full">
              <label class="label"><span class="label-text">Slug</span></label>
              <input v-model="tutorial.slug" type="text" placeholder="intro-to-dividends" class="input input-bordered input-sm" />
            </div>

            <div class="form-control w-full">
              <label class="label"><span class="label-text">Category</span></label>
              <select v-model="tutorial.category" class="select select-bordered select-sm">
                <option value="investments">Investments</option>
                <option value="trading">Trading</option>
                <option value="economics">Economics</option>
                <option value="personal-finance">Personal Finance</option>
              </select>
            </div>

            <div class="form-control w-full">
              <label class="label"><span class="label-text">Status</span></label>
              <select v-model="tutorial.status" class="select select-bordered select-sm">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div class="form-control w-full">
              <label class="label"><span class="label-text">Description</span></label>
              <textarea v-model="tutorial.description" class="textarea textarea-bordered h-24 text-sm" placeholder="Brief summary for the library..."></textarea>
            </div>

            <div class="form-control w-full">
              <label class="label"><span class="label-text">Slides PDF</span></label>
              <div class="space-y-2">
                <input
                  v-model="tutorial.deck_pdf_url"
                  type="url"
                  placeholder="https://...pdf"
                  class="input input-bordered input-sm"
                />
                <div class="flex flex-wrap gap-2">
                  <input
                    ref="deckFileInput"
                    type="file"
                    accept="application/pdf,.pdf"
                    class="file-input file-input-bordered file-input-sm w-full"
                    @change="handleDeckSelected"
                  />
                  <button class="btn btn-outline btn-sm" :disabled="uploadingDeck || !selectedDeckFile" @click="handleDeckUpload">
                    <span v-if="uploadingDeck" class="loading loading-spinner loading-xs"></span>
                    Upload PDF
                  </button>
                  <a
                    v-if="tutorial.deck_pdf_url"
                    :href="tutorial.deck_pdf_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn btn-ghost btn-sm"
                  >
                    Open Current PDF
                  </a>
                  <button v-if="tutorial.deck_pdf_url" class="btn btn-ghost btn-sm text-error" @click="clearDeckUrl">
                    Remove PDF
                  </button>
                </div>
                <p class="text-xs text-base-content/50">Upload a PDF to replace the slide deck, or paste a direct PDF URL.</p>
                <p v-if="deckMessage" class="text-xs" :class="deckMessageType === 'error' ? 'text-error' : 'text-success'">{{ deckMessage }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content / Steps -->
      <div class="lg:col-span-2 space-y-4">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-bold">Steps ({{ tutorial.steps?.length || 0 }})</h2>
          <button @click="addStep" class="btn btn-outline btn-sm gap-2" :disabled="isNew">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
            Add Step
          </button>
        </div>

        <div v-if="isNew" class="alert alert-info shadow-sm text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span>Save the tutorial details first to start adding steps.</span>
        </div>

        <div v-else class="space-y-3">
          <div v-for="(step, index) in tutorial.steps" :key="step.id || index" class="collapse collapse-arrow bg-base-100 border border-base-200 shadow-sm">
            <input type="checkbox" /> 
            <div class="collapse-title font-medium flex items-center gap-3">
              <span class="badge badge-sm badge-neutral">{{ index + 1 }}</span>
              {{ step.title || 'Untitled Step' }}
            </div>
            <div class="collapse-content space-y-4">
              <div class="grid grid-cols-2 gap-4 pt-4">
                <div class="form-control w-full">
                  <label class="label"><span class="label-text">Step Title</span></label>
                  <input v-model="step.title" type="text" class="input input-bordered input-sm" />
                </div>
                <div class="form-control w-full">
                  <label class="label"><span class="label-text">Step Slug</span></label>
                  <input v-model="step.slug" type="text" class="input input-bordered input-sm" />
                </div>
              </div>
              
              <div class="form-control w-full">
                <label class="label"><span class="label-text">HTML Content</span></label>
                <textarea v-model="step.content" class="textarea textarea-bordered h-64 font-mono text-sm" placeholder="<p>Content goes here...</p>"></textarea>
                <label class="label">
                  <span class="label-text-alt text-base-content/50">Basic HTML supported. Use DaisyUI/Tailwind classes for styling.</span>
                </label>
              </div>

              <div class="flex justify-between items-center border-t pt-4">
                <button @click="handleDeleteStep(step.id, index)" class="btn btn-ghost btn-sm text-error">Delete Step</button>
                <button @click="handleSaveStep(step)" class="btn btn-primary btn-sm">Save Step</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTrainingStore } from '../../stores/training'
import { supabase, uploadTutorialDeck } from '../../lib/supabase'

const route = useRoute()
const router = useRouter()
const store = useTrainingStore()

const loading = ref(false)
const saving = ref(false)
const uploadingDeck = ref(false)
const selectedDeckFile = ref(null)
const deckFileInput = ref(null)
const deckMessage = ref('')
const deckMessageType = ref('success')
const isNew = computed(() => !route.params.id)

const tutorial = ref({
  title: '',
  slug: '',
  description: '',
  category: 'investments',
  status: 'draft',
  deck_pdf_url: '',
  steps: []
})

async function loadTutorial() {
  if (isNew.value) return
  
  loading.value = true
  // Fetch tutorial data
  const { data, error } = await supabase
    .from('training_tutorials')
    .select('*, steps:training_steps(*)')
    .eq('id', route.params.id)
    .single()
    
  if (!error && data) {
    // Sort steps by position
    data.steps.sort((a, b) => a.position - b.position)
    tutorial.value = data
  }
  loading.value = false
}

async function handleSaveTutorial() {
  saving.value = true
  const { data, error } = await store.saveTutorial(tutorial.value, { includeInactive: true })
  if (!error && data) {
    if (isNew.value) {
      router.replace(`/admin/tutorials/edit/${data.id}`)
    }
  }
  saving.value = false
}

function handleDeckSelected(event) {
  const [file] = event.target.files || []
  selectedDeckFile.value = file || null
  deckMessage.value = ''
}

async function handleDeckUpload() {
  if (!selectedDeckFile.value) return

  uploadingDeck.value = true
  deckMessage.value = ''
  try {
    if (selectedDeckFile.value.type && selectedDeckFile.value.type !== 'application/pdf') {
      throw new Error('Please choose a PDF file.')
    }

    const slug = tutorial.value.slug || tutorial.value.title
    const publicUrl = await uploadTutorialDeck(slug, selectedDeckFile.value)
    tutorial.value.deck_pdf_url = publicUrl
    deckMessageType.value = 'success'
    deckMessage.value = 'PDF uploaded. Save changes to keep it on the tutorial.'
    selectedDeckFile.value = null
    if (deckFileInput.value) {
      deckFileInput.value.value = ''
    }
  } catch (error) {
    deckMessageType.value = 'error'
    deckMessage.value = error.message || 'Failed to upload PDF.'
  } finally {
    uploadingDeck.value = false
  }
}

function clearDeckUrl() {
  tutorial.value.deck_pdf_url = ''
  deckMessage.value = ''
  selectedDeckFile.value = null
  if (deckFileInput.value) {
    deckFileInput.value.value = ''
  }
}

function addStep() {
  const nextPos = tutorial.value.steps.length + 1
  tutorial.value.steps.push({
    training_tutorial_id: tutorial.value.id,
    title: 'New Step',
    slug: `step-${nextPos}`,
    content: '<div class="space-y-4"><p>New step content...</p></div>',
    position: nextPos
  })
}

async function handleSaveStep(step) {
  const { data, error } = await store.saveStep(step)
  if (!error && data) {
    // Update the ID if it was new
    if (!step.id) step.id = data.id
  }
}

async function handleDeleteStep(stepId, index) {
  if (!stepId) {
    tutorial.value.steps.splice(index, 1)
    return
  }
  
  if (confirm('Are you sure you want to delete this step?')) {
    const success = await store.deleteStep(stepId)
    if (success) {
      tutorial.value.steps.splice(index, 1)
    }
  }
}

onMounted(loadTutorial)

// Auto-generate slug from title
watch(() => tutorial.value.title, (newTitle) => {
  if (isNew.value && newTitle) {
    tutorial.value.slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }
})
</script>
