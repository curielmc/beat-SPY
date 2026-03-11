<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          Dashboard
        </h1>
        <p class="text-sm text-base-content/60 mt-1">Overview of <strong>{{ currentClass?.class_name }}</strong> &mdash; {{ currentClass?.school }}</p>
      </div>
      <button class="btn btn-primary btn-sm gap-2" @click="showNotesModal = true" :disabled="loading">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        Generate Class Notes
      </button>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <div class="stats shadow bg-base-100 w-full border border-base-200">
        <div class="stat">
          <div class="stat-figure text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <div class="stat-title">Groups</div>
          <div class="stat-value text-primary">{{ teacher.groups.length }}</div>
        </div>
        <div class="stat">
          <div class="stat-figure text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </div>
          <div class="stat-title">Students</div>
          <div class="stat-value text-secondary">{{ teacher.students.length }}</div>
        </div>
        <div class="stat">
          <div class="stat-figure text-success">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </div>
          <div class="stat-title">Benchmark (SPY)</div>
          <div class="stat-value text-success">Live</div>
        </div>
      </div>

      <!-- Leaderboard Table -->
      <div class="card bg-base-100 shadow border border-base-200">
        <div class="card-body">
          <h2 class="card-title flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            Group Leaderboard
          </h2>
          <div class="overflow-x-auto mt-2">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Group</th>
                  <th>Members</th>
                  <th class="text-right">Return %</th>
                  <th class="text-right">Portfolio Value</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(group, i) in rankedGroups" :key="group.id">
                  <td>
                    <span class="badge" :class="i === 0 ? 'badge-warning' : 'badge-ghost'">{{ i + 1 }}</span>
                  </td>
                  <td class="font-medium">{{ group.name }}</td>
                  <td>
                    <div class="flex flex-wrap gap-1">
                      <span v-for="name in group.memberNames" :key="name" class="badge badge-sm badge-outline">{{ name.split(' ')[0] }}</span>
                    </div>
                  </td>
                  <td class="text-right font-mono" :class="group.returnPct >= 0 ? 'text-success' : 'text-error'">
                    {{ group.returnPct >= 0 ? '+' : '' }}{{ group.returnPct.toFixed(2) }}%
                  </td>
                  <td class="text-right font-mono">${{ group.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                </tr>
                <tr v-if="rankedGroups.length === 0">
                  <td colspan="5" class="text-center text-base-content/50">No groups yet</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <!-- Class Notes Modal -->
    <dialog :class="['modal', showNotesModal && 'modal-open']">
      <div class="modal-box max-w-3xl max-h-[85vh]">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" @click="closeNotesModal">X</button>
        <h3 class="font-bold text-lg flex items-center gap-2 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Generate Class Notes
        </h3>

        <!-- Options (only show before generating) -->
        <div v-if="!classNotes" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text font-medium">Start Date</span></label>
              <input type="date" v-model="notesDateStart" class="input input-bordered input-sm" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text font-medium">End Date</span></label>
              <input type="date" v-model="notesDateEnd" class="input input-bordered input-sm" />
            </div>
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text font-medium">Focus on Group</span></label>
            <select v-model="notesGroupId" class="select select-bordered select-sm">
              <option value="">All Groups</option>
              <option v-for="g in teacher.groups" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text font-medium">Custom Instructions <span class="text-base-content/40">(optional)</span></span></label>
            <textarea v-model="notesCustomInstructions" class="textarea textarea-bordered textarea-sm" rows="2" placeholder="e.g. Focus on risk management, mention upcoming earnings..."></textarea>
          </div>

          <div class="flex gap-2 mt-2">
            <button class="btn btn-sm btn-ghost" @click="setDateRange(7)">Last 7 days</button>
            <button class="btn btn-sm btn-ghost" @click="setDateRange(14)">Last 14 days</button>
            <button class="btn btn-sm btn-ghost" @click="setDateRange(30)">Last 30 days</button>
          </div>

          <button
            class="btn btn-primary w-full"
            :disabled="generatingNotes"
            @click="generateNotes"
          >
            <span v-if="generatingNotes" class="loading loading-spinner loading-sm"></span>
            <span v-else>Generate Notes</span>
          </button>

          <p v-if="notesError" class="text-error text-sm">{{ notesError }}</p>
        </div>

        <!-- Generated Notes -->
        <div v-else class="space-y-4">
          <div class="flex items-center justify-between">
            <p class="text-sm text-base-content/60">{{ notesMeta }}</p>
            <div class="flex flex-wrap gap-2">
              <button class="btn btn-sm btn-outline" @click="copyNotes">
                {{ copied ? 'Copied!' : 'Copy' }}
              </button>
              <button class="btn btn-sm btn-outline btn-primary" @click="exportPDF">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                PDF
              </button>
              <button class="btn btn-sm btn-outline btn-secondary" @click="exportDOCX">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                DOCX
              </button>
              <button class="btn btn-sm btn-ghost" @click="classNotes = null">Regenerate</button>
            </div>
          </div>
          <div class="prose prose-sm max-w-none overflow-y-auto max-h-[55vh] bg-base-200/50 rounded-lg p-4" v-html="renderedNotes"></div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="closeNotesModal"><button>close</button></form>
    </dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useTeacherStore } from '../../stores/teacher'
import { supabase } from '../../lib/supabase'
import { downloadPDF, downloadDOCX } from '../../lib/notesExport'

const route = useRoute()
const teacher = useTeacherStore()
const loading = ref(true)
const rankedGroups = ref([])

const currentClass = computed(() => {
  const qid = route.query.class_id
  if (qid) {
    const match = teacher.classes.find(c => c.id === qid)
    if (match) return match
  }
  return teacher.classes[0] || null
})

// Class Notes state
const showNotesModal = ref(false)
const generatingNotes = ref(false)
const classNotes = ref(null)
const notesMeta = ref('')
const notesError = ref('')
const copied = ref(false)

// Default: last 7 days
const today = new Date()
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
const notesDateStart = ref(sevenDaysAgo.toISOString().split('T')[0])
const notesDateEnd = ref(today.toISOString().split('T')[0])
const notesGroupId = ref('')
const notesCustomInstructions = ref('')

function setDateRange(days) {
  const end = new Date()
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  notesDateStart.value = start.toISOString().split('T')[0]
  notesDateEnd.value = end.toISOString().split('T')[0]
}

function closeNotesModal() {
  showNotesModal.value = false
  // Don't clear notes so user can re-open and see them
}

async function generateNotes() {
  if (!currentClass.value) return
  generatingNotes.value = true
  notesError.value = ''
  classNotes.value = null

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { notesError.value = 'Not logged in'; generatingNotes.value = false; return }

  try {
    const body = {
      class_id: currentClass.value.id,
      date_start: new Date(notesDateStart.value).toISOString(),
      date_end: new Date(notesDateEnd.value + 'T23:59:59').toISOString()
    }
    if (notesGroupId.value) body.group_id = notesGroupId.value
    if (notesCustomInstructions.value.trim()) body.custom_instructions = notesCustomInstructions.value.trim()

    const res = await fetch('/api/generate-class-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      notesError.value = data.error || 'Failed to generate notes'
    } else {
      // Stream the response
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      classNotes.value = ''
      notesMeta.value = `${res.headers.get('X-Notes-Period') || ''} | ${res.headers.get('X-Notes-Groups') || '?'} groups | ${res.headers.get('X-Notes-Tickers') || '?'} stocks tracked`
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        classNotes.value += decoder.decode(value, { stream: true })
      }
    }
  } catch (err) {
    notesError.value = 'Server error — the request may have timed out. Try a shorter date range or a single group.'
  }

  generatingNotes.value = false
}

function copyNotes() {
  if (classNotes.value) {
    navigator.clipboard.writeText(classNotes.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

function exportPDF() {
  if (classNotes.value) downloadPDF(classNotes.value, notesMeta.value)
}

function exportDOCX() {
  if (classNotes.value) downloadDOCX(classNotes.value, notesMeta.value)
}

// Simple markdown to HTML renderer
const renderedNotes = computed(() => {
  if (!classNotes.value) return ''
  return classNotes.value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
})

onMounted(async () => {
  await teacher.loadTeacherData()
  rankedGroups.value = await teacher.getRankedGroups()
  loading.value = false
})
</script>
