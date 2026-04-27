<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const slug = route.params.slug
const email = ref('')
const parentName = ref('')
const studentName = ref('')
const status = ref('idle') // idle | submitting | success | error
const errorMsg = ref('')

async function submit() {
  status.value = 'submitting'
  errorMsg.value = ''
  try {
    const res = await fetch('/api/newsletter-parent-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        class_slug: slug,
        email: email.value.trim(),
        parent_name: parentName.value.trim(),
        student_name: studentName.value.trim()
      })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Failed to subscribe')
    status.value = 'success'
  } catch (e) {
    status.value = 'error'
    errorMsg.value = e.message
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-200 flex items-center justify-center p-6">
    <div class="card bg-base-100 shadow-lg max-w-md w-full">
      <div class="card-body">
        <h1 class="card-title text-2xl">Beat the S&amp;P 500 — Parent Newsletter</h1>
        <p class="text-sm opacity-70">Sign up to receive monthly performance updates from your student's class.</p>

        <div v-if="status === 'success'" class="alert alert-success mt-4">
          <span>Check your email — we sent a confirmation link to {{ email }}. You'll start receiving newsletters once you confirm.</span>
        </div>

        <form v-else @submit.prevent="submit" class="space-y-3 mt-4">
          <div>
            <label class="label"><span class="label-text">Your email <span class="text-error">*</span></span></label>
            <input v-model="email" type="email" required class="input input-bordered w-full" placeholder="parent@example.com" />
          </div>
          <div>
            <label class="label"><span class="label-text">Your name</span></label>
            <input v-model="parentName" type="text" class="input input-bordered w-full" />
          </div>
          <div>
            <label class="label"><span class="label-text">Student's name (optional)</span></label>
            <input v-model="studentName" type="text" class="input input-bordered w-full" />
          </div>
          <button type="submit" class="btn btn-primary w-full" :disabled="status === 'submitting'">
            {{ status === 'submitting' ? 'Sending…' : 'Subscribe' }}
          </button>
          <p v-if="errorMsg" class="text-error text-sm">{{ errorMsg }}</p>
        </form>

        <p class="text-xs opacity-60 mt-4">We'll only email you class newsletters. You can unsubscribe at any time.</p>
      </div>
    </div>
  </div>
</template>
