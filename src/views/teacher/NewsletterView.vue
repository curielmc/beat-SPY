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
const endDate = ref('')
const savingEndDate = ref(false)
const generating = ref(false)
const sending = ref(false)
const sendingTest = ref(false)
const savingDraft = ref(false)
const savedAt = ref('')
const testEmail = ref('')
const testResult = ref('')
const draft = ref(null) // { id, subject, intro_html, payload }
const subject = ref('')
const introHtml = ref('')
const sendResult = ref(null)
const errorMsg = ref('')
const history = ref([])
const parentSubs = ref([])
const studentUnsubs = ref([])
const studentRoster = ref([])
const addEmail = ref('')
const addParentName = ref('')
const addStudentName = ref('')
const addingSub = ref(false)
const importingCsv = ref(false)
const addResult = ref('')
const addError = ref('')
const csvFileInput = ref(null)

const signupUrl = computed(() => publicSlug.value ? `${window.location.origin}/newsletter/subscribe/${publicSlug.value}` : '')

async function loadClass() {
  if (!currentClassId.value) return
  const { data } = await supabase.from('classes').select('class_name, public_slug, end_date').eq('id', currentClassId.value).single()
  if (data) {
    className.value = data.class_name
    publicSlug.value = data.public_slug
    endDate.value = data.end_date || ''
  }
}

async function saveEndDate() {
  if (!currentClassId.value) return
  savingEndDate.value = true
  await supabase.from('classes').update({ end_date: endDate.value || null }).eq('id', currentClassId.value)
  savingEndDate.value = false
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

async function postSubscribers(subscribers) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/newsletter-add-subscribers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ class_id: currentClassId.value, subscribers })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to add subscribers')
  return data
}

function summarizeAdd(data) {
  const parts = []
  if (data.added) parts.push(`${data.added} added`)
  if (data.reactivated) parts.push(`${data.reactivated} reactivated`)
  if (data.skipped) parts.push(`${data.skipped} already confirmed`)
  if (data.invalid) parts.push(`${data.invalid} invalid`)
  return parts.join(' · ') || 'No changes'
}

async function addSubscriber() {
  if (!currentClassId.value || !addEmail.value.trim()) return
  addingSub.value = true
  addError.value = ''
  addResult.value = ''
  try {
    const data = await postSubscribers([{
      email: addEmail.value.trim(),
      parent_name: addParentName.value.trim() || null,
      student_name: addStudentName.value.trim() || null
    }])
    addResult.value = summarizeAdd(data)
    if (data.invalid && data.details?.invalid?.length) {
      addError.value = data.details.invalid.map(i => `${i.email || '(blank)'}: ${i.reason}`).join('; ')
    }
    addEmail.value = ''
    addParentName.value = ''
    addStudentName.value = ''
    await loadSubscribers()
  } catch (e) {
    addError.value = e.message
  } finally {
    addingSub.value = false
  }
}

function parseCsv(text) {
  // Minimal CSV: handles quoted values with commas. No multi-line quoted fields.
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return []
  const splitLine = (line) => {
    const out = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
        else if (c === '"') { inQ = false }
        else cur += c
      } else {
        if (c === '"') inQ = true
        else if (c === ',') { out.push(cur); cur = '' }
        else cur += c
      }
    }
    out.push(cur)
    return out.map(s => s.trim())
  }
  const headers = splitLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z]/g, '_'))
  const emailIdx = headers.findIndex(h => h.includes('email'))
  const parentIdx = headers.findIndex(h => h.includes('parent'))
  const studentIdx = headers.findIndex(h => h.includes('student'))

  // If first row doesn't look like a header (no "email" column), treat all rows as data with email in col 0.
  const startRow = emailIdx >= 0 ? 1 : 0
  const eIdx = emailIdx >= 0 ? emailIdx : 0
  const pIdx = parentIdx
  const sIdx = studentIdx

  const rows = []
  for (let i = startRow; i < lines.length; i++) {
    const cols = splitLine(lines[i])
    const email = (cols[eIdx] || '').trim()
    if (!email) continue
    rows.push({
      email,
      parent_name: pIdx >= 0 ? (cols[pIdx] || '').trim() : null,
      student_name: sIdx >= 0 ? (cols[sIdx] || '').trim() : null
    })
  }
  return rows
}

async function importCsv(event) {
  const file = event.target.files?.[0]
  if (!file || !currentClassId.value) return
  importingCsv.value = true
  addError.value = ''
  addResult.value = ''
  try {
    const text = await file.text()
    const rows = parseCsv(text)
    if (!rows.length) {
      addError.value = 'No rows with email found in CSV'
      return
    }
    // Send in batches of 50 to keep edge requests small
    let totals = { added: 0, reactivated: 0, skipped: 0, invalid: 0 }
    for (let i = 0; i < rows.length; i += 50) {
      const data = await postSubscribers(rows.slice(i, i + 50))
      totals.added += data.added || 0
      totals.reactivated += data.reactivated || 0
      totals.skipped += data.skipped || 0
      totals.invalid += data.invalid || 0
    }
    addResult.value = `${rows.length} rows processed: ${summarizeAdd(totals)}`
    await loadSubscribers()
  } catch (e) {
    addError.value = e.message
  } finally {
    importingCsv.value = false
    if (csvFileInput.value) csvFileInput.value.value = ''
  }
}

async function loadSubscribers() {
  if (!currentClassId.value) return
  const [{ data: parents }, { data: unsubs }, { data: roster }] = await Promise.all([
    supabase
      .from('newsletter_parent_subscribers')
      .select('id, email, parent_name, student_name, confirmed_at, unsubscribed_at, created_at')
      .eq('class_id', currentClassId.value)
      .order('created_at', { ascending: false }),
    supabase
      .from('newsletter_unsubscribes')
      .select('user_id, unsubscribed_at, profiles:profiles(email, full_name)')
      .eq('class_id', currentClassId.value),
    supabase
      .from('class_memberships')
      .select('user_id, profiles:profiles(email, full_name)')
      .eq('class_id', currentClassId.value)
  ])
  parentSubs.value = parents || []
  studentUnsubs.value = unsubs || []
  studentRoster.value = roster || []
}

const confirmedParents = computed(() =>
  parentSubs.value.filter(p => p.confirmed_at && !p.unsubscribed_at)
)
const pendingParents = computed(() =>
  parentSubs.value.filter(p => !p.confirmed_at && !p.unsubscribed_at)
)
const unsubscribedParents = computed(() =>
  parentSubs.value.filter(p => p.unsubscribed_at)
)
const unsubscribedStudents = computed(() => studentUnsubs.value)
const unsubscribedStudentIds = computed(() => new Set(studentUnsubs.value.map(u => u.user_id)))
const activeStudentRecipients = computed(() =>
  studentRoster.value.filter(m => m.profiles?.email && !unsubscribedStudentIds.value.has(m.user_id))
)

async function openDraft(id) {
  const { data, error } = await supabase
    .from('newsletters')
    .select('id, subject, intro_html, payload, status')
    .eq('id', id)
    .single()
  if (error || !data) {
    errorMsg.value = error?.message || 'Could not load newsletter'
    return
  }
  draft.value = { id: data.id, subject: data.subject, intro_html: data.intro_html, payload: data.payload, readOnly: data.status === 'sent' }
  subject.value = data.subject || ''
  introHtml.value = stripHtml(data.intro_html)
  errorMsg.value = ''
  sendResult.value = null
  savedAt.value = ''
  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function saveDraft() {
  if (!draft.value?.id || draft.value.readOnly) return
  savingDraft.value = true
  errorMsg.value = ''
  savedAt.value = ''
  try {
    const { error } = await supabase
      .from('newsletters')
      .update({
        subject: subject.value,
        intro_html: `<p>${escapeHtml(introHtml.value).replace(/\n+/g, '</p><p>')}</p>`
      })
      .eq('id', draft.value.id)
    if (error) throw error
    savedAt.value = new Date().toLocaleTimeString()
    await loadHistory()
  } catch (e) {
    errorMsg.value = e.message
  } finally {
    savingDraft.value = false
  }
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
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
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
  loadSubscribers()
})
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <h1 class="text-2xl font-bold mb-1">Newsletter</h1>
    <p class="text-sm opacity-70 mb-6">{{ className }}</p>

    <!-- Class end date -->
    <div class="card bg-base-100 shadow mb-4">
      <div class="card-body py-4 flex-row items-center gap-3">
        <span class="text-sm font-semibold">Class end date</span>
        <input v-model="endDate" type="date" class="input input-bordered input-sm" />
        <button class="btn btn-sm" :disabled="savingEndDate" @click="saveEndDate">
          {{ savingEndDate ? 'Saving…' : 'Save' }}
        </button>
        <span class="text-xs opacity-60">Newsletter shows a countdown to this date.</span>
      </div>
    </div>

    <!-- Parent signup link -->
    <div v-if="signupUrl" class="alert mb-6">
      <div class="flex-1">
        <p class="text-sm font-semibold">Parent signup link</p>
        <p class="text-xs opacity-70 break-all">{{ signupUrl }}</p>
      </div>
      <button class="btn btn-sm" @click="copySignupUrl">Copy</button>
    </div>

    <!-- Recipients & subscribers -->
    <div class="card bg-base-100 shadow mb-6">
      <div class="card-body">
        <h2 class="card-title">Recipients &amp; subscribers</h2>
        <p class="text-sm opacity-70">
          Newsletters go to every student in this class (minus unsubscribes) plus confirmed parents who signed up via the link above.
        </p>

        <div class="stats stats-vertical md:stats-horizontal shadow mt-2">
          <div class="stat">
            <div class="stat-title">Active students</div>
            <div class="stat-value text-2xl">{{ activeStudentRecipients.length }}</div>
            <div class="stat-desc">{{ studentRoster.length }} enrolled · {{ unsubscribedStudents.length }} unsubscribed</div>
          </div>
          <div class="stat">
            <div class="stat-title">Confirmed parents</div>
            <div class="stat-value text-2xl">{{ confirmedParents.length }}</div>
            <div class="stat-desc">{{ pendingParents.length }} pending confirmation</div>
          </div>
          <div class="stat">
            <div class="stat-title">Unsubscribed parents</div>
            <div class="stat-value text-2xl">{{ unsubscribedParents.length }}</div>
            <div class="stat-desc">Won't receive future sends</div>
          </div>
        </div>

        <div class="collapse collapse-arrow bg-base-200 mt-4">
          <input type="checkbox" />
          <div class="collapse-title text-sm font-semibold">
            Add subscribers manually
          </div>
          <div class="collapse-content">
            <p class="text-xs opacity-70 mb-3">
              Added subscribers are marked confirmed immediately (no double opt-in email).
              They can still unsubscribe from any newsletter they receive.
            </p>

            <form class="grid grid-cols-1 md:grid-cols-4 gap-2 items-end" @submit.prevent="addSubscriber">
              <div>
                <label class="label py-0"><span class="label-text text-xs">Email *</span></label>
                <input v-model="addEmail" type="email" required placeholder="parent@example.com" class="input input-bordered input-sm w-full" />
              </div>
              <div>
                <label class="label py-0"><span class="label-text text-xs">Parent name</span></label>
                <input v-model="addParentName" type="text" class="input input-bordered input-sm w-full" />
              </div>
              <div>
                <label class="label py-0"><span class="label-text text-xs">Student name</span></label>
                <input v-model="addStudentName" type="text" class="input input-bordered input-sm w-full" />
              </div>
              <button type="submit" class="btn btn-sm btn-primary" :disabled="addingSub || !addEmail.trim()">
                {{ addingSub ? 'Adding…' : 'Add' }}
              </button>
            </form>

            <div class="divider my-3 text-xs opacity-60">or</div>

            <div class="flex flex-wrap items-center gap-3">
              <div>
                <label class="label py-0"><span class="label-text text-xs">Bulk import from CSV</span></label>
                <input
                  ref="csvFileInput"
                  type="file"
                  accept=".csv,text/csv"
                  class="file-input file-input-bordered file-input-sm w-full max-w-xs"
                  :disabled="importingCsv"
                  @change="importCsv"
                />
              </div>
              <p class="text-xs opacity-70 max-w-md">
                CSV header: <code>email,parent_name,student_name</code>.
                Only <code>email</code> is required. Existing addresses are updated; previously unsubscribed entries are reactivated.
              </p>
            </div>

            <p v-if="importingCsv" class="text-sm opacity-70 mt-2">Importing…</p>
            <p v-if="addResult" class="text-success text-sm mt-2">{{ addResult }}</p>
            <p v-if="addError" class="text-error text-sm mt-2">{{ addError }}</p>
          </div>
        </div>

        <div class="collapse collapse-arrow bg-base-200 mt-2">
          <input type="checkbox" />
          <div class="collapse-title text-sm font-semibold">
            Confirmed parents ({{ confirmedParents.length }})
          </div>
          <div class="collapse-content">
            <table v-if="confirmedParents.length" class="table table-sm">
              <thead><tr><th>Email</th><th>Parent</th><th>Student</th><th>Confirmed</th></tr></thead>
              <tbody>
                <tr v-for="p in confirmedParents" :key="p.id">
                  <td>{{ p.email }}</td>
                  <td>{{ p.parent_name || '—' }}</td>
                  <td>{{ p.student_name || '—' }}</td>
                  <td>{{ new Date(p.confirmed_at).toLocaleDateString() }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="text-sm opacity-60">No confirmed parents yet.</p>
          </div>
        </div>

        <div class="collapse collapse-arrow bg-base-200 mt-2">
          <input type="checkbox" />
          <div class="collapse-title text-sm font-semibold">
            Pending parents ({{ pendingParents.length }})
          </div>
          <div class="collapse-content">
            <p class="text-xs opacity-70 mb-2">These parents signed up but haven't clicked the confirmation email yet.</p>
            <table v-if="pendingParents.length" class="table table-sm">
              <thead><tr><th>Email</th><th>Parent</th><th>Student</th><th>Signed up</th></tr></thead>
              <tbody>
                <tr v-for="p in pendingParents" :key="p.id">
                  <td>{{ p.email }}</td>
                  <td>{{ p.parent_name || '—' }}</td>
                  <td>{{ p.student_name || '—' }}</td>
                  <td>{{ new Date(p.created_at).toLocaleDateString() }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="text-sm opacity-60">No pending signups.</p>
          </div>
        </div>

        <div class="collapse collapse-arrow bg-base-200 mt-2">
          <input type="checkbox" />
          <div class="collapse-title text-sm font-semibold">
            Unsubscribed ({{ unsubscribedParents.length + unsubscribedStudents.length }})
          </div>
          <div class="collapse-content">
            <table v-if="unsubscribedParents.length || unsubscribedStudents.length" class="table table-sm">
              <thead><tr><th>Type</th><th>Email</th><th>Name</th><th>Unsubscribed</th></tr></thead>
              <tbody>
                <tr v-for="p in unsubscribedParents" :key="'p-' + p.id">
                  <td><span class="badge badge-ghost">Parent</span></td>
                  <td>{{ p.email }}</td>
                  <td>{{ p.parent_name || '—' }}</td>
                  <td>{{ new Date(p.unsubscribed_at).toLocaleDateString() }}</td>
                </tr>
                <tr v-for="u in unsubscribedStudents" :key="'s-' + u.user_id">
                  <td><span class="badge badge-ghost">Student</span></td>
                  <td>{{ u.profiles?.email || '—' }}</td>
                  <td>{{ u.profiles?.full_name || '—' }}</td>
                  <td>{{ new Date(u.unsubscribed_at).toLocaleDateString() }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="text-sm opacity-60">Nobody has unsubscribed.</p>
          </div>
        </div>
      </div>
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

        <div v-if="draft.payload?.daysRemaining != null" class="alert alert-info mt-2">
          <span><strong>{{ draft.payload.daysRemaining }} {{ draft.payload.daysRemaining === 1 ? 'day' : 'days' }} remaining</strong> until class ends ({{ draft.payload.endDate }})</span>
        </div>

        <label class="label"><span class="label-text font-semibold">Subject</span></label>
        <input v-model="subject" class="input input-bordered w-full" />

        <label class="label mt-4"><span class="label-text font-semibold">Intro paragraph</span></label>
        <textarea v-model="introHtml" rows="5" class="textarea textarea-bordered w-full text-sm"></textarea>
        <p class="text-xs opacity-60">Edit the AI-generated intro. Plain text — paragraphs separated by blank lines.</p>

        <div class="divider"></div>

        <!-- Rankings preview -->
        <div v-for="(win, key) in { oneMonth: 'Last 1 month', threeMonth: 'Last 3 months', allTime: 'All-time' }" :key="key" class="mb-6">
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

        <div v-if="draft.readOnly" class="alert alert-warning mt-2">
          <span>This newsletter has already been sent and is read-only.</span>
        </div>

        <div class="flex flex-wrap items-end gap-2 mt-4">
          <div v-if="!draft.readOnly">
            <label class="label py-0"><span class="label-text text-xs">Test recipient (optional — defaults to you)</span></label>
            <input v-model="testEmail" type="email" placeholder="you@example.com" class="input input-bordered input-sm w-64" />
          </div>
          <button v-if="!draft.readOnly" class="btn btn-sm" :disabled="sendingTest" @click="sendTest">
            {{ sendingTest ? 'Sending test…' : 'Send Test' }}
          </button>
          <button v-if="!draft.readOnly" class="btn btn-sm" :disabled="savingDraft" @click="saveDraft">
            {{ savingDraft ? 'Saving…' : 'Save Draft' }}
          </button>
          <div class="flex-1"></div>
          <button v-if="!draft.readOnly" class="btn btn-primary" :disabled="sending" @click="send">
            {{ sending ? 'Sending…' : 'Send Newsletter' }}
          </button>
          <button class="btn btn-ghost" @click="draft = null">Close</button>
        </div>
        <p v-if="savedAt" class="text-success text-sm mt-2">Draft saved at {{ savedAt }}</p>
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
            <tr v-for="h in history" :key="h.id" class="hover cursor-pointer" @click="openDraft(h.id)">
              <td class="link link-hover">{{ h.subject }}</td>
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
