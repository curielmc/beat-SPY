<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          Users
        </h1>
        <p class="text-base-content/70">Manage all platform users</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-outline" @click="exportEmails">Export Emails</button>
        <button class="btn btn-sm btn-outline" @click="exportCSV">Export CSV</button>
      </div>
    </div>

    <!-- Search & Filter -->
    <div class="flex gap-3 flex-wrap">
      <input v-model="search" type="text" placeholder="Search by name or email..." class="input input-bordered flex-1 min-w-[200px]" />
      <select v-model="roleFilter" class="select select-bordered">
        <option value="">All Roles</option>
        <option value="student">Students</option>
        <option value="teacher">Teachers</option>
        <option value="admin">Admins</option>
      </select>
    </div>

    <div v-if="errorMsg" class="alert alert-error">
      <span>{{ errorMsg }}</span>
    </div>

    <!-- Bulk Action Bar -->
    <div v-if="selectedIds.size > 0" class="flex items-center gap-3 bg-primary/10 rounded-lg px-4 py-2">
      <span class="font-semibold text-sm">{{ selectedIds.size }} selected</span>
      <select v-model="bulkRole" class="select select-bordered select-sm">
        <option value="" disabled>Change role to...</option>
        <option value="student">Student</option>
        <option value="teacher">Teacher</option>
        <option value="admin">Admin</option>
      </select>
      <button class="btn btn-primary btn-sm" :disabled="!bulkRole || bulkUpdating" @click="applyBulkRole">
        {{ bulkUpdating ? 'Applying...' : 'Apply' }}
      </button>
      <button class="btn btn-warning btn-sm" :disabled="selectedIds.size !== 2" @click="openMergeModal">
        Merge Selected
      </button>
      <button class="btn btn-ghost btn-sm" @click="clearSelection">Clear</button>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else class="card bg-base-100 shadow border border-base-200">
      <div class="card-body p-0">
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th class="w-10">
                  <input type="checkbox" class="checkbox checkbox-sm" :checked="allSelected" :indeterminate="someSelected && !allSelected" @change="toggleAll" />
                </th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in filteredUsers" :key="user.id" :class="{ 'bg-primary/5': selectedIds.has(user.id) }">
                <td>
                  <input type="checkbox" class="checkbox checkbox-sm" :checked="selectedIds.has(user.id)" @change="toggleUser(user.id)" />
                </td>
                <td class="font-medium">
                  <span class="inline-flex items-center gap-1.5">
                    <span v-if="user.role === 'admin'" class="text-error" title="Admin">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
                    </span>
                    <span v-else-if="user.role === 'teacher'" class="text-secondary" title="Teacher">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z" /></svg>
                    </span>
                    <span v-else class="text-base-content/30" title="Student">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" /></svg>
                    </span>
                    {{ user.full_name }}
                  </span>
                  <div v-if="user.is_disabled" class="text-xs text-warning mt-1">
                    Merged / disabled{{ user.merge_note ? `: ${user.merge_note}` : '' }}
                  </div>
                </td>
                <td class="text-sm">{{ user.email }}</td>
                <td>
                  <select :value="user.role" class="select select-bordered select-xs" :disabled="user.is_disabled" @change="changeRole(user.id, $event.target.value)">
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td class="text-sm text-base-content/60">{{ new Date(user.created_at).toLocaleDateString() }}</td>
                <td class="flex gap-1">
                  <button v-if="!user.is_disabled && (user.role === 'student' || user.role === 'teacher')" class="btn btn-ghost btn-xs text-primary gap-1" :disabled="masquerading" @click="masqueradeAs(user)">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    View as {{ user.full_name?.split(' ')[0] }}
                  </button>
                  <button
                    v-if="!user.is_disabled && user.role === 'student'"
                    class="btn btn-ghost btn-xs text-info gap-1"
                    @click="openLessonModal(user)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    Send Lesson
                  </button>
                  <button class="btn btn-ghost btn-xs text-error" :disabled="user.is_disabled" @click="confirmDelete(user)">Delete</button>
                </td>
              </tr>
              <tr v-if="filteredUsers.length === 0">
                <td colspan="6" class="text-center text-base-content/50">No users found</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Delete confirmation -->
    <dialog class="modal" :class="{ 'modal-open': showDeleteModal }">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Delete User</h3>
        <p class="py-4">Are you sure you want to delete <strong>{{ deleteTarget?.full_name }}</strong> ({{ deleteTarget?.email }})?</p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showDeleteModal = false">Cancel</button>
          <button class="btn btn-error" @click="deleteUser">Delete</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showDeleteModal = false"><button>close</button></form>
    </dialog>

    <dialog class="modal" :class="{ 'modal-open': showMergeModal }">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Merge User Accounts</h3>
        <p class="py-2 text-sm text-base-content/70">
          Move the source account's memberships, portfolios, trades, progress, and most user-linked records into the target account, then disable the source account.
        </p>
        <div class="space-y-4">
          <label class="form-control">
            <span class="label-text font-medium mb-1">Source account to merge from</span>
            <select v-model="mergeSourceId" class="select select-bordered">
              <option disabled value="">Select source account</option>
              <option v-for="user in mergeCandidates" :key="user.id" :value="user.id">
                {{ user.full_name }} · {{ user.email }}
              </option>
            </select>
          </label>
          <label class="form-control">
            <span class="label-text font-medium mb-1">Target account to keep</span>
            <select v-model="mergeTargetId" class="select select-bordered">
              <option disabled value="">Select target account</option>
              <option v-for="user in mergeCandidates" :key="user.id" :value="user.id">
                {{ user.full_name }} · {{ user.email }}
              </option>
            </select>
          </label>
          <label class="form-control">
            <span class="label-text font-medium mb-1">Admin note</span>
            <textarea v-model="mergeNote" class="textarea textarea-bordered" rows="3" placeholder="Optional note about why these accounts were merged"></textarea>
          </label>
          <div class="text-xs text-base-content/60">
            The source account will be disabled after merge. The auth login itself is not deleted automatically.
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="closeMergeModal">Cancel</button>
          <button class="btn btn-warning" :disabled="!canSubmitMerge || mergeLoading" @click="mergeUsers">
            {{ mergeLoading ? 'Merging...' : 'Merge Accounts' }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="closeMergeModal"><button>close</button></form>
    </dialog>

    <!-- Send Lesson Modal -->
    <dialog class="modal" :class="{ 'modal-open': showLessonModal }">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-1">Send Investment Lesson</h3>
        <p class="text-sm text-base-content/60 mb-4">
          Sending to: <strong>{{ lessonTargetName }}</strong>
        </p>

        <div class="flex gap-2 mb-3">
          <input
            v-model="lessonSearch"
            type="text"
            placeholder="Search lessons..."
            class="input input-bordered input-sm flex-1"
          />
          <select v-model="lessonTypeFilter" class="select select-bordered select-sm">
            <option value="">All Categories</option>
            <option v-for="t in lessonTypes" :key="t" :value="t">{{ formatLessonType(t) }}</option>
          </select>
          <select v-model="lessonDifficultyFilter" class="select select-bordered select-sm">
            <option value="">All Levels</option>
            <option value="basic">Basic</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div class="max-h-72 overflow-y-auto border border-base-300 rounded-lg mb-4">
          <div
            v-for="lesson in filteredLessons"
            :key="lesson.id"
            class="px-3 py-2 border-b border-base-200 cursor-pointer hover:bg-base-200 transition-colors"
            :class="{ 'bg-info/10 border-info/30': selectedLessonId === lesson.id }"
            @click="selectedLessonId = selectedLessonId === lesson.id ? null : lesson.id"
          >
            <div class="flex items-center gap-2">
              <span class="font-medium text-sm flex-1">{{ lesson.title }}</span>
              <span class="badge badge-xs" :class="lesson.difficulty === 'advanced' ? 'badge-warning' : 'badge-success'">{{ lesson.difficulty }}</span>
              <span class="badge badge-xs badge-ghost">{{ formatLessonType(lesson.lesson_type) }}</span>
            </div>
            <p class="text-xs text-base-content/50 mt-1 line-clamp-2">{{ lesson.content }}</p>
          </div>
          <div v-if="filteredLessons.length === 0" class="p-4 text-center text-base-content/50 text-sm">
            No lessons match your search.
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="showLessonModal = false">Cancel</button>
          <button
            class="btn btn-outline btn-info"
            :disabled="sendingLessonId"
            @click="confirmSendLesson(null)"
          >
            <span v-if="sendingLessonId && !selectedLessonId" class="loading loading-spinner loading-xs"></span>
            Send Random Lesson
          </button>
          <button
            class="btn btn-info"
            :disabled="!selectedLessonId || sendingLessonId"
            @click="confirmSendLesson(selectedLessonId)"
          >
            <span v-if="sendingLessonId && selectedLessonId" class="loading loading-spinner loading-xs"></span>
            Send Selected Lesson
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showLessonModal = false"><button>close</button></form>
    </dialog>

    <div v-if="successMsg" class="alert alert-success fixed bottom-4 right-4 w-auto z-50">
      <span>{{ successMsg }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { supabase } from '../../lib/supabase'
import { downloadCSV, downloadText } from '../../utils/csvExport'

const users = ref([])
const search = ref('')
const roleFilter = ref('')
const loading = ref(true)
const showDeleteModal = ref(false)
const showMergeModal = ref(false)
const deleteTarget = ref(null)
const successMsg = ref('')
const selectedIds = ref(new Set())
const bulkRole = ref('')
const bulkUpdating = ref(false)
const mergeSourceId = ref('')
const mergeTargetId = ref('')
const mergeNote = ref('')
const mergeLoading = ref(false)
const errorMsg = ref('')
const sendingLessonId = ref(null)
const showLessonModal = ref(false)
const allLessons = ref([])
const lessonSearch = ref('')
const lessonTypeFilter = ref('')
const lessonDifficultyFilter = ref('')
const selectedLessonId = ref(null)
const lessonTargetUser = ref(null)
const lessonTargetName = ref('')

const lessonTypes = computed(() => {
  const types = new Set(allLessons.value.map(l => l.lesson_type))
  return [...types].sort()
})

const filteredLessons = computed(() => {
  let result = allLessons.value
  if (lessonTypeFilter.value) result = result.filter(l => l.lesson_type === lessonTypeFilter.value)
  if (lessonDifficultyFilter.value) result = result.filter(l => l.difficulty === lessonDifficultyFilter.value)
  if (lessonSearch.value) {
    const q = lessonSearch.value.toLowerCase()
    result = result.filter(l => l.title.toLowerCase().includes(q) || l.content.toLowerCase().includes(q))
  }
  return result
})

function formatLessonType(type) {
  return type.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

async function loadLessons() {
  if (allLessons.value.length > 0) return
  const { data } = await supabase.from('investment_lessons').select('*').order('lesson_type').order('title')
  allLessons.value = data || []
}

function openLessonModal(user) {
  lessonTargetUser.value = user
  lessonTargetName.value = user.full_name
  selectedLessonId.value = null
  lessonSearch.value = ''
  lessonTypeFilter.value = ''
  lessonDifficultyFilter.value = ''
  loadLessons()
  showLessonModal.value = true
}

async function confirmSendLesson(lessonId) {
  const user = lessonTargetUser.value
  if (!user) return
  sendingLessonId.value = user.id
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const body = { owner_id: user.id, owner_type: 'user' }
    if (lessonId) body.lesson_id = lessonId

    let res = await fetch('/api/send-lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body)
    })

    // If no personal portfolio, try their group portfolio
    if (!res.ok) {
      const { data: membership } = await supabase
        .from('class_memberships')
        .select('group_id')
        .eq('user_id', user.id)
        .not('group_id', 'is', null)
        .maybeSingle()

      if (membership?.group_id) {
        const groupBody = { owner_id: membership.group_id, owner_type: 'group' }
        if (lessonId) groupBody.lesson_id = lessonId
        res = await fetch('/api/send-lesson', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(groupBody)
        })
      }
    }

    const result = await res.json()
    if (res.ok) {
      showLessonModal.value = false
      showSuccess(`Lesson sent to ${user.full_name}: "${result.lesson_title}" (${result.difficulty})`)
    } else {
      showSuccess(`Error: ${result.error || 'Failed to send lesson'}`)
    }
  } finally {
    sendingLessonId.value = null
  }
}

onMounted(async () => {
  await fetchUsers()
})

const router = useRouter()
const auth = useAuthStore()

const masquerading = ref(false)
async function masqueradeAs(user) {
  masquerading.value = true
  const result = await auth.startMasquerade(user)
  masquerading.value = false
  if (result?.error) {
    alert('Masquerade failed: ' + result.error)
    return
  }
  router.push('/leaderboard')
}

async function fetchUsers() {
  loading.value = true
  errorMsg.value = ''

  try {
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) {
      throw new Error('Your admin session is missing. Please sign out and back in.')
    }

    const response = await fetch('/api/admin-users', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to load users')
    }

    users.value = payload.users || []
  } catch (error) {
    console.error('[Admin Users] fetchUsers failed:', error)
    users.value = []
    errorMsg.value = error.message || 'Failed to load users'
  } finally {
    loading.value = false
  }
}

const filteredUsers = computed(() => {
  let result = users.value
  if (roleFilter.value) {
    result = result.filter(u => u.role === roleFilter.value)
  }
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(u =>
      u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    )
  }
  return result
})

const allSelected = computed(() => filteredUsers.value.length > 0 && filteredUsers.value.every(u => selectedIds.value.has(u.id)))
const someSelected = computed(() => filteredUsers.value.some(u => selectedIds.value.has(u.id)))
const mergeCandidates = computed(() => users.value.filter(u => selectedIds.value.has(u.id) && !u.is_disabled))
const canSubmitMerge = computed(() =>
  mergeCandidates.value.length === 2 &&
  !!mergeSourceId.value &&
  !!mergeTargetId.value &&
  mergeSourceId.value !== mergeTargetId.value
)

function toggleAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(filteredUsers.value.map(u => u.id))
  }
}

function toggleUser(id) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedIds.value = next
}

function clearSelection() {
  selectedIds.value = new Set()
  bulkRole.value = ''
}

function openMergeModal() {
  const candidates = mergeCandidates.value
  if (candidates.length !== 2) return
  mergeSourceId.value = candidates[0].id
  mergeTargetId.value = candidates[1].id
  mergeNote.value = ''
  showMergeModal.value = true
}

function closeMergeModal() {
  showMergeModal.value = false
  mergeLoading.value = false
}

async function applyBulkRole() {
  if (!bulkRole.value || selectedIds.value.size === 0) return
  bulkUpdating.value = true
  const ids = [...selectedIds.value]
  const { error } = await supabase.from('profiles').update({ role: bulkRole.value }).in('id', ids)
  if (!error) {
    for (const u of users.value) {
      if (selectedIds.value.has(u.id)) u.role = bulkRole.value
    }
    showSuccess(`Updated ${ids.length} users to ${bulkRole.value}`)
    clearSelection()
  }
  bulkUpdating.value = false
}

async function changeRole(userId, newRole) {
  await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
  const user = users.value.find(u => u.id === userId)
  if (user) user.role = newRole
  showSuccess(`Role updated to ${newRole}`)
}

function confirmDelete(user) {
  deleteTarget.value = user
  showDeleteModal.value = true
}

async function deleteUser() {
  if (!deleteTarget.value) return
  await supabase.from('profiles').delete().eq('id', deleteTarget.value.id)
  users.value = users.value.filter(u => u.id !== deleteTarget.value.id)
  showDeleteModal.value = false
  showSuccess('User deleted')
}

async function mergeUsers() {
  if (!canSubmitMerge.value) return
  mergeLoading.value = true
  const { data, error } = await supabase.rpc('merge_user_accounts', {
    p_source_user_id: mergeSourceId.value,
    p_target_user_id: mergeTargetId.value,
    p_note: mergeNote.value.trim() || null
  })

  mergeLoading.value = false
  if (error) {
    showSuccess(`Merge failed: ${error.message}`)
    return
  }

  await fetchUsers()
  clearSelection()
  closeMergeModal()
  showSuccess(`Merged account successfully${data?.trades_reassigned != null ? ` · ${data.trades_reassigned} trades reassigned` : ''}`)
}

function exportCSV() {
  const columns = [
    { key: 'full_name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'username', label: 'Username' },
    { key: 'created_at', label: 'Created' }
  ]
  downloadCSV(filteredUsers.value, columns, 'users_export')
}

function exportEmails() {
  const emails = filteredUsers.value.map(u => u.email).filter(Boolean).join('\n')
  downloadText(emails, 'user_emails.txt')
}

function showSuccess(msg) {
  successMsg.value = msg
  setTimeout(() => { successMsg.value = '' }, 3000)
}
</script>
