<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/auth'
import { buildNameDisplayMap } from '../../utils/formatName'

const auth = useAuthStore()
const route = useRoute()
const currentClassId = computed(() => route.query.class_id || auth.activeClassId || auth.membership?.class_id || null)

const className = ref('')
const publicSlug = ref('')
const generating = ref(false)
const sending = ref(false)
const sendingTest = ref(false)
const testEmail = ref('')
const testResult = ref('')
const draft = ref(null) // { id, subject, intro_html, payload }
const subject = ref('')
const introHtml = ref('')
const sendResult = ref(null)
const errorMsg = ref('')
const history = ref([])

const signupUrl = computed(() => publicSlug.value ? `${window.location.origin}/newsletter/subscribe/${publicSlug.value}` : '')

async function loadClass() {
  if (!currentClassId.value) return
  const { data } = await supabase.from('classes').select('class_name, public_slug').eq('id', currentClassId.value).single()
  if (data) {
    className.value = data.class_name
    publicSlug.value = data.public_slug
  }
}

async function loadHistory() {
  if (!currentClassId.value) return
  const { data } = await supabase
    .from('newsletters')
    .select('id, subject, status, sent_at, recipients_count, created_at')
    .eq('class_id', currentClassId.value)
    .order('created_at', { ascending: false })
    .limit(20)
  history.value = data || []
}

async function generate() {
  if (!currentClassId.value) return
  generating.value = true
  errorMsg.value = ''
  sendResult.value = null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/newsletter-generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ class_id: currentClassId.value })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to generate')
    draft.value = { id: data.newsletter?.id, subject: data.subject, intro_html: data.intro_html, payload: data.payload }
    subject.value = data.subject
    introHtml.value = stripHtml(data.intro_html)
    await loadHistory()
  } catch (e) {
    errorMsg.value = e.message
  } finally {
    generating.value = false
  }
}

async function send() {
  if (!draft.value?.id) return
  if (!confirm('Send this newsletter to all students and confirmed parents?')) return
  sending.value = true
  errorMsg.value = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/newsletter-send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        newsletter_id: draft.value.id,
        subject: subject.value,
        intro_html: `<p>${escapeHtml(introHtml.value).replace(/\n+/g, '</p><p>')}</p>`
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to send')
    sendResult.value = data
    draft.value = null
    await loadHistory()
  } catch (e) {
    errorMsg.value = e.message
  } finally {
    sending.value = false
  }
}

async function sendTest() {
  if (!draft.value?.id) return
  sendingTest.value = true
  testResult.value = ''
  errorMsg.value = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/newsletter-test-send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        newsletter_id: draft.value.id,
        subject: subject.value,
        intro_html: `<p>${escapeHtml(introHtml.value).replace(/\n+/g, '</p><p>')}</p>`,
        to: testEmail.value.trim() || undefined
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to send test')
    testResult.value = `Test sent to ${data.sent_to}`
  } catch (e) {
    errorMsg.value = e.message
  } finally {
    sendingTest.value = false
  }
}

function copySignupUrl() {
  navigator.clipboard.writeText(signupUrl.value)
}

function pct(n) {
  const v = Number(n || 0)
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function nameMapFor(payload) {
  const all = new Set()
  for (const w of [payload?.allTime, payload?.threeMonth, payload?.oneMonth]) {
    for (const i of (w?.individuals || [])) all.add(i.name)
  }
  return buildNameDisplayMap([...all])
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function stripHtml(s) {
  return String(s || '').replace(/<\/p>\s*<p>/g, '\n\n').replace(/<[^>]+>/g, '').trim()
}

onMounted(() => {
  loadClass()
  loadHistory()
})
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <h1 class="text-2xl font-bold mb-1">Newsletter</h1>
    <p class="text-sm opacity-70 mb-6">{{ className }}</p>

    <!-- Parent signup link -->
    <div v-if="signupUrl" class="alert mb-6">
      <div class="flex-1">
        <p class="text-sm font-semibold">Parent signup link</p>
        <p class="text-xs opacity-70 break-all">{{ signupUrl }}</p>
      </div>
      <button class="btn btn-sm" @click="copySignupUrl">Copy</button>
    </div>

    <!-- Generate -->
    <div v-if="!draft" class="card bg-base-100 shadow mb-6">
      <div class="card-body">
        <h2 class="card-title">Generate a newsletter</h2>
        <p class="text-sm opacity-70">Pulls rankings for all-time, 3-month, and 1-month windows, plus an AI-written intro paragraph. You'll preview and edit before sending.</p>
        <button class="btn btn-primary mt-2" :disabled="generating" @click="generate">
          {{ generating ? 'Generating…' : 'Generate Newsletter' }}
        </button>
        <p v-if="errorMsg" class="text-error text-sm mt-2">{{ errorMsg }}</p>
      </div>
    </div>

    <!-- Preview / edit -->
    <div v-if="draft" class="card bg-base-100 shadow mb-6">
      <div class="card-body">
        <h2 class="card-title">Preview &amp; edit</h2>

        <label class="label"><span class="label-text font-semibold">Subject</span></label>
        <input v-model="subject" class="input input-bordered w-full" />

        <label class="label mt-4"><span class="label-text font-semibold">Intro paragraph</span></label>
        <textarea v-model="introHtml" rows="5" class="textarea textarea-bordered w-full text-sm"></textarea>
        <p class="text-xs opacity-60">Edit the AI-generated intro. Plain text — paragraphs separated by blank lines.</p>

        <div class="divider"></div>

        <!-- Rankings preview -->
        <div v-for="(win, key) in { allTime: 'All-time', threeMonth: 'Last 3 months', oneMonth: 'Last 1 month' }" :key="key" class="mb-6">
          <h3 class="font-bold text-lg">{{ win }}</h3>
          <p class="text-xs opacity-70 mb-2">S&amp;P 500: <strong>{{ pct(draft.payload[key]?.spyReturnPct) }}</strong></p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p class="font-semibold text-sm mb-1">🏆 Groups</p>
              <ol class="text-sm space-y-0.5">
                <li v-for="(g, i) in draft.payload[key]?.groups?.slice(0, 5)" :key="g.id">
                  <span class="opacity-50">{{ i + 1 }}.</span> {{ g.name }} — <span :class="g.returnPct > draft.payload[key].spyReturnPct ? 'text-success' : 'text-error'">{{ pct(g.returnPct) }}</span>
                </li>
              </ol>
            </div>
            <div>
              <p class="font-semibold text-sm mb-1">📊 Funds</p>
              <ol class="text-sm space-y-0.5">
                <li v-for="(f, i) in draft.payload[key]?.funds?.slice(0, 5)" :key="f.id">
                  <span class="opacity-50">{{ i + 1 }}.</span> {{ f.fundName }} ({{ f.groupName }}) — <span :class="f.returnPct > draft.payload[key].spyReturnPct ? 'text-success' : 'text-error'">{{ pct(f.returnPct) }}</span>
                </li>
              </ol>
            </div>
            <div>
              <p class="font-semibold text-sm mb-1">⭐ Individuals</p>
              <ol class="text-sm space-y-0.5">
                <li v-for="(s, i) in draft.payload[key]?.individuals?.slice(0, 5)" :key="s.id">
                  <span class="opacity-50">{{ i + 1 }}.</span> {{ nameMapFor(draft.payload).get(s.name) || s.name }} — <span :class="s.returnPct > draft.payload[key].spyReturnPct ? 'text-success' : 'text-error'">{{ pct(s.returnPct) }}</span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-end gap-2 mt-4">
          <div>
            <label class="label py-0"><span class="label-text text-xs">Test recipient (optional — defaults to you)</span></label>
            <input v-model="testEmail" type="email" placeholder="you@example.com" class="input input-bordered input-sm w-64" />
          </div>
          <button class="btn btn-sm" :disabled="sendingTest" @click="sendTest">
            {{ sendingTest ? 'Sending test…' : 'Send Test' }}
          </button>
          <div class="flex-1"></div>
          <button class="btn btn-primary" :disabled="sending" @click="send">
            {{ sending ? 'Sending…' : 'Send Newsletter' }}
          </button>
          <button class="btn btn-ghost" @click="draft = null">Discard</button>
        </div>
        <p v-if="testResult" class="text-success text-sm mt-2">{{ testResult }}</p>
        <p v-if="errorMsg" class="text-error text-sm mt-2">{{ errorMsg }}</p>
      </div>
    </div>

    <!-- Send result -->
    <div v-if="sendResult" class="alert alert-success mb-6">
      Sent to {{ sendResult.sent }} of {{ sendResult.total }} recipients.
    </div>

    <!-- History -->
    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title">History</h2>
        <table v-if="history.length" class="table table-sm">
          <thead><tr><th>Subject</th><th>Status</th><th>Recipients</th><th>Date</th></tr></thead>
          <tbody>
            <tr v-for="h in history" :key="h.id">
              <td>{{ h.subject }}</td>
              <td><span class="badge" :class="h.status === 'sent' ? 'badge-success' : 'badge-ghost'">{{ h.status }}</span></td>
              <td>{{ h.recipients_count || '—' }}</td>
              <td>{{ new Date(h.sent_at || h.created_at).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="text-sm opacity-60">No newsletters yet.</p>
      </div>
    </div>
  </div>
</template>
