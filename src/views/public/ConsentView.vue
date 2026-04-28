<template>
  <div class="min-h-screen bg-base-200 py-8 px-4">
    <div class="max-w-2xl mx-auto">
      <div class="flex justify-end mb-2">
        <button class="btn btn-ghost btn-sm" @click="toggleLang">{{ tr('page.language_toggle_es') }}</button>
      </div>

      <div v-if="loading" class="card bg-base-100 shadow">
        <div class="card-body items-center"><span class="loading loading-spinner"></span></div>
      </div>

      <div v-else-if="loadError" class="card bg-base-100 shadow">
        <div class="card-body">
          <p class="text-error">{{ loadError === 'used' ? tr('page.used') : loadError === 'expired' ? tr('page.expired', { student_name: studentName }) : loadError }}</p>
        </div>
      </div>

      <div v-else-if="submitted" class="card bg-success/10 shadow">
        <div class="card-body">
          <h2 class="card-title text-success">✓</h2>
          <p>{{ tr('page.success', { student_name: studentName }) }}</p>
        </div>
      </div>

      <div v-else class="card bg-base-100 shadow-xl">
        <div class="card-body space-y-4">
          <h1 class="text-2xl font-bold">{{ tr('page.title') }}</h1>
          <p>{{ tr('page.intro', { student_name: studentName }) }}</p>

          <ul class="list-disc pl-6 space-y-1 text-sm">
            <li v-for="(item, i) in tr('page.what_we_do')" :key="i">{{ item }}</li>
          </ul>

          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-3">
              <input v-model="checkParticipate" type="checkbox" class="checkbox checkbox-primary" />
              <span class="label-text">{{ tr('page.checkbox_participate') }}</span>
            </label>
          </div>
          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-3">
              <input v-model="checkEmail" type="checkbox" class="checkbox" />
              <span class="label-text">{{ tr('page.checkbox_email') }}</span>
            </label>
          </div>
          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-3">
              <input v-model="checkSms" type="checkbox" class="checkbox" />
              <span class="label-text">{{ tr('page.checkbox_sms') }}</span>
            </label>
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text">{{ tr('page.parent_name') }}</span></label>
            <input v-model="parentName" type="text" class="input input-bordered" />
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text">{{ tr('page.relationship') }}</span></label>
            <select v-model="relationship" class="select select-bordered">
              <option v-for="opt in tr('page.relationship_options')" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text">{{ tr('page.parent_phone') }}</span></label>
            <input v-model="parentPhone" type="tel" class="input input-bordered" placeholder="+1..." />
          </div>

          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-3">
              <input v-model="parentCopyOptIn" type="checkbox" class="checkbox" />
              <span class="label-text">{{ tr('page.parent_copy_optin') }}</span>
            </label>
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text">{{ tr('page.signature') }}</span></label>
            <input v-model="signature" type="text" class="input input-bordered" />
          </div>

          <div v-if="submitError" class="text-error text-sm">{{ submitError }}</div>

          <button class="btn btn-primary btn-block" :disabled="!canSubmit || submitting" @click="submit">
            <span v-if="submitting" class="loading loading-spinner loading-sm"></span>
            {{ tr('page.submit') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { t } from '../../i18n/parent/index.js'

const route = useRoute()

const lang = ref(route.query.lang === 'es' ? 'es' : 'en')
const loading = ref(true)
const loadError = ref('')
const studentName = ref('')
const submitted = ref(false)
const submitting = ref(false)
const submitError = ref('')

const checkParticipate = ref(false)
const checkEmail = ref(false)
const checkSms = ref(false)
const parentName = ref('')
const relationship = ref('')
const parentPhone = ref('')
const parentCopyOptIn = ref(false)
const signature = ref('')

function tr(key, vars) {
  return t(lang.value, key, vars)
}

function toggleLang() {
  lang.value = lang.value === 'en' ? 'es' : 'en'
  const url = new URL(window.location.href)
  url.searchParams.set('lang', lang.value)
  window.history.replaceState({}, '', url)
}

const canSubmit = computed(() => {
  return checkParticipate.value && parentName.value.trim() && signature.value.trim() && relationship.value
})

async function load() {
  loading.value = true
  try {
    const res = await fetch(`/api/consent/${route.params.token}`)
    const body = await res.json()
    if (!res.ok) {
      loadError.value = body.error || 'unknown_error'
      studentName.value = body.student_name || ''
      return
    }
    studentName.value = body.student_name || ''
    if (body.parent_language) lang.value = body.parent_language
    if (route.query.lang) lang.value = route.query.lang === 'es' ? 'es' : 'en'
  } catch (e) {
    loadError.value = e.message
  } finally {
    loading.value = false
  }
}

async function submit() {
  submitError.value = ''
  submitting.value = true
  try {
    const res = await fetch(`/api/consent/${route.params.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parent_name: parentName.value.trim(),
        relationship: relationship.value,
        signature_text: signature.value.trim(),
        consent_locale: lang.value,
        parent_phone: parentPhone.value.trim() || null,
        parent_copy_opt_in: parentCopyOptIn.value,
        consents: {
          participate: checkParticipate.value,
          email: checkEmail.value,
          sms: checkSms.value
        }
      })
    })
    const body = await res.json()
    if (!res.ok) {
      submitError.value = body.error || 'submission_failed'
      return
    }
    submitted.value = true
  } catch (e) {
    submitError.value = e.message
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>
