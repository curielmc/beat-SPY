<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
        Class Codes
      </h1>
      <p class="text-base-content/70">Manage class codes students use to sign up</p>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <!-- Existing Classes -->
      <div v-for="cls in classesWithCounts" :key="cls.id" class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="card-title">
                <code class="badge badge-lg badge-primary badge-outline font-mono">{{ cls.code }}</code>
                {{ cls.class_name }}
              </h2>
              <p class="text-sm text-base-content/60">{{ cls.school || 'No school' }} &middot; {{ cls.groupCount }} groups &middot; {{ cls.studentCount }} students</p>
            </div>
            <button class="btn btn-sm btn-ghost" @click="toggleClassSettings(cls.id)">
              {{ expandedClass === cls.id ? 'Hide Settings' : 'Settings' }}
            </button>
          </div>

          <div v-if="expandedClass === cls.id" class="mt-4 space-y-3 border-t pt-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="form-control">
                <label class="label py-1"><span class="label-text text-xs">Starting Cash ($)</span></label>
                <input type="number" class="input input-bordered input-sm" :value="cls.starting_cash" @change="updateSetting(cls.id, 'starting_cash', Number($event.target.value))" />
              </div>
              <div class="form-control">
                <label class="label py-1"><span class="label-text text-xs">Max Portfolios</span></label>
                <input type="number" class="input input-bordered input-sm" :value="cls.max_portfolios" @change="updateSetting(cls.id, 'max_portfolios', Number($event.target.value))" min="1" />
              </div>
              <div class="form-control">
                <label class="label cursor-pointer justify-start gap-3 mt-6">
                  <input type="checkbox" class="toggle toggle-sm" :checked="cls.allow_reset" @change="updateSetting(cls.id, 'allow_reset', $event.target.checked)" />
                  <span class="label-text text-sm">Allow Portfolio Reset</span>
                </label>
              </div>
            </div>
            <p class="text-xs text-base-content/40">Note: Starting cash only applies to new groups created after this change.</p>

            <!-- Pre-load Students -->
            <div class="border-t pt-4 mt-4">
              <h3 class="font-semibold mb-2">Pre-load Students</h3>
              <p class="text-xs text-base-content/60 mb-2">Paste or upload a CSV: <code>First Name, Last Name, Email, Grade, Group</code></p>
              <textarea v-model="invitePasteText" rows="4" class="textarea textarea-bordered w-full font-mono text-sm" placeholder="John, Smith, john@school.edu, 10, Team Alpha&#10;Jane, Doe, jane@school.edu, 11, Team Beta"></textarea>
              <div class="flex gap-2 mt-2">
                <label class="btn btn-sm btn-outline">
                  Upload CSV
                  <input type="file" accept=".csv,.txt" class="hidden" @change="handleCSVUpload" />
                </label>
                <button class="btn btn-sm btn-primary" @click="handleAddInvites(cls.id)" :disabled="!invitePasteText.trim()">Add Students</button>
              </div>
              <p v-if="inviteError" class="text-error text-sm mt-1">{{ inviteError }}</p>
              <p v-if="inviteSuccess" class="text-success text-sm mt-1">{{ inviteSuccess }}</p>

              <!-- Existing invites table -->
              <div v-if="classInvites[cls.id]?.length" class="mt-4">
                <div class="flex items-center gap-2 mb-2">
                  <label class="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="checkbox" class="checkbox checkbox-sm" :checked="isAllSelected(cls.id)" @change="toggleSelectAll(cls.id, $event.target.checked)" />
                    Select All
                  </label>
                  <button v-if="selectedInvites[cls.id]?.size > 0" class="btn btn-xs btn-error btn-outline" @click="handleBulkRemove(cls.id)">
                    Delete Selected ({{ selectedInvites[cls.id]?.size }})
                  </button>
                </div>
                <table class="table table-sm table-zebra">
                  <thead>
                    <tr>
                      <th class="w-8"></th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Grade</th>
                      <th>Group</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="inv in classInvites[cls.id]" :key="inv.id">
                      <td><input type="checkbox" class="checkbox checkbox-sm" :checked="selectedInvites[cls.id]?.has(inv.id)" @change="toggleSelectInvite(cls.id, inv.id, $event.target.checked)" /></td>
                      <td>{{ inv.full_name }}</td>
                      <td class="font-mono text-xs">{{ inv.email || '-' }}</td>
                      <td>{{ inv.grade || '-' }}</td>
                      <td>{{ inv.group_name || '-' }}</td>
                      <td>
                        <span class="badge badge-sm" :class="inv.status === 'joined' ? 'badge-success' : 'badge-warning'">{{ inv.status }}</span>
                      </td>
                      <td>
                        <button v-if="inv.status === 'pending'" class="btn btn-xs btn-ghost text-error" @click="handleRemoveInvite(cls.id, inv.id)">Remove</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Reset Class -->
            <div class="border-t pt-4 mt-4">
              <button class="btn btn-error btn-sm btn-outline" @click="openResetModal(cls)">Reset Class</button>
              <p class="text-xs text-base-content/40 mt-1">Removes all students, groups, portfolios, and holdings. Invites are kept.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Reset Class Confirmation Modal -->
      <dialog class="modal" :class="{ 'modal-open': showResetModal }">
        <div class="modal-box">
          <h3 class="font-bold text-lg text-error mb-2">Reset Class</h3>
          <p class="mb-2">This will permanently delete all <strong>groups</strong>, <strong>student memberships</strong>, <strong>portfolios</strong>, and <strong>holdings</strong> for <strong>{{ resetClass?.class_name }}</strong>.</p>
          <p class="text-sm text-base-content/60 mb-4">Pre-loaded student invites will be kept and reset to "pending" so students can re-join.</p>
          <p class="text-sm mb-4">Type <code class="font-mono bg-base-200 px-1">{{ resetClass?.code }}</code> to confirm:</p>
          <input v-model="resetConfirmText" type="text" class="input input-bordered w-full uppercase" placeholder="Type class code" />
          <div class="modal-action">
            <button class="btn btn-ghost" @click="showResetModal = false">Cancel</button>
            <button class="btn btn-error" :disabled="resetConfirmText.toUpperCase() !== resetClass?.code || resetting" @click="handleResetClass">
              <span v-if="resetting" class="loading loading-spinner loading-sm"></span>
              Reset Class
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop" @click="showResetModal = false"><button>close</button></form>
      </dialog>

      <div v-if="classesWithCounts.length === 0" class="card bg-base-100 shadow">
        <div class="card-body text-center text-base-content/50">No classes yet. Create one below.</div>
      </div>

      <!-- Create New Class -->
      <div class="card bg-base-100 shadow">
        <div class="card-body space-y-4">
          <h2 class="card-title">Create New Class Code</h2>

          <div v-if="error" class="alert alert-error"><span>{{ error }}</span></div>
          <div v-if="success" class="alert alert-success"><span>{{ success }}</span></div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="form-control">
              <label class="label"><span class="label-text">Class Code</span></label>
              <input v-model="newCode" type="text" class="input input-bordered w-full" placeholder="e.g. ECON2026" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Class Name</span></label>
              <input v-model="newClassName" type="text" class="input input-bordered w-full" placeholder="e.g. AP Economics" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="form-control">
              <label class="label"><span class="label-text">Starting Cash ($)</span></label>
              <input v-model.number="newStartingCash" type="number" class="input input-bordered w-full" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Max Portfolios</span></label>
              <input v-model.number="newMaxPortfolios" type="number" class="input input-bordered w-full" min="1" />
            </div>
            <div class="form-control">
              <label class="label cursor-pointer justify-start gap-3 mt-8">
                <input type="checkbox" class="toggle" v-model="newAllowReset" />
                <span class="label-text">Allow Reset</span>
              </label>
            </div>
          </div>

          <button class="btn btn-primary" @click="handleCreate" :disabled="!newCode || !newClassName">Create Code</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTeacherStore } from '../../stores/teacher'
import { supabase } from '../../lib/supabase'

const teacher = useTeacherStore()

const loading = ref(true)
const newCode = ref('')
const newClassName = ref('')
const newStartingCash = ref(100000)
const newMaxPortfolios = ref(1)
const newAllowReset = ref(false)
const error = ref('')
const success = ref('')
const expandedClass = ref(null)
const invitePasteText = ref('')
const inviteError = ref('')
const inviteSuccess = ref('')
const classInvites = ref({})
const selectedInvites = ref({})
const showResetModal = ref(false)
const resetClass = ref(null)
const resetConfirmText = ref('')
const resetting = ref(false)

onMounted(async () => {
  await teacher.loadTeacherData()
  loading.value = false
})

const classesWithCounts = computed(() => {
  return teacher.classes.map(cls => ({
    ...cls,
    groupCount: teacher.groups.filter(g => g.class_id === cls.id).length,
    studentCount: teacher.students.filter(s => s.class_id === cls.id).length
  }))
})

async function toggleClassSettings(classId) {
  if (expandedClass.value === classId) {
    expandedClass.value = null
  } else {
    expandedClass.value = classId
    // Load invites when expanding
    classInvites.value[classId] = await teacher.loadInvites(classId)
  }
}

async function updateSetting(classId, key, value) {
  const result = await teacher.updateClassSettings(classId, { [key]: value })
  if (result.error) {
    error.value = result.error
    setTimeout(() => { error.value = '' }, 3000)
  }
}

async function handleCreate() {
  error.value = ''
  success.value = ''

  const result = await teacher.createClass({
    code: newCode.value,
    className: newClassName.value,
    school: teacher.classes[0]?.school || '',
    startingCash: newStartingCash.value,
    allowReset: newAllowReset.value,
    maxPortfolios: newMaxPortfolios.value
  })

  if (result.error) {
    error.value = result.error
    return
  }

  success.value = `Class code "${result.class.code}" created!`
  newCode.value = ''
  newClassName.value = ''
  newStartingCash.value = 100000
  newMaxPortfolios.value = 1
  newAllowReset.value = false
}

function openResetModal(cls) {
  resetClass.value = cls
  resetConfirmText.value = ''
  showResetModal.value = true
}

async function handleResetClass() {
  if (!resetClass.value) return
  resetting.value = true
  try {
    const classId = resetClass.value.id

    // Get all groups for this class
    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('class_id', classId)
    const groupIds = (groupData || []).map(g => g.id)

    // Delete group portfolios + their holdings
    if (groupIds.length > 0) {
      const { data: portfolios } = await supabase
        .from('portfolios')
        .select('id')
        .eq('owner_type', 'group')
        .in('owner_id', groupIds)
      const portfolioIds = (portfolios || []).map(p => p.id)

      if (portfolioIds.length > 0) {
        await supabase.from('holdings').delete().in('portfolio_id', portfolioIds)
        await supabase.from('portfolios').delete().in('id', portfolioIds)
      }
    }

    // Get memberships to find student user IDs for personal portfolios
    const { data: memberships } = await supabase
      .from('class_memberships')
      .select('user_id')
      .eq('class_id', classId)
    const userIds = (memberships || []).map(m => m.user_id)

    // Delete personal portfolios + holdings for these students
    if (userIds.length > 0) {
      const { data: userPortfolios } = await supabase
        .from('portfolios')
        .select('id')
        .eq('owner_type', 'user')
        .in('owner_id', userIds)
      const userPortfolioIds = (userPortfolios || []).map(p => p.id)

      if (userPortfolioIds.length > 0) {
        await supabase.from('holdings').delete().in('portfolio_id', userPortfolioIds)
        await supabase.from('portfolios').delete().in('id', userPortfolioIds)
      }
    }

    // Delete memberships
    await supabase.from('class_memberships').delete().eq('class_id', classId)

    // Delete groups
    await supabase.from('groups').delete().eq('class_id', classId)

    // Delete blocked emails so students can re-join
    await supabase.from('blocked_emails').delete().eq('class_id', classId)

    // Reset invites back to pending
    await supabase
      .from('class_invites')
      .update({ status: 'pending', joined_at: null })
      .eq('class_id', classId)

    showResetModal.value = false
    success.value = `Class "${resetClass.value.class_name}" has been reset.`
    await teacher.loadTeacherData()
    classInvites.value[classId] = await teacher.loadInvites(classId)
    setTimeout(() => { success.value = '' }, 5000)
  } finally {
    resetting.value = false
  }
}

function parseInviteLines(text) {
  const headerWords = ['first', 'last', 'name', 'email', 'grade', 'group']
  return text.split('\n')
    .map(line => line.trim())
    .filter(line => line && line.includes(','))
    .map(line => {
      const parts = line.split(',').map(p => p.trim())
      // Skip header rows
      if (headerWords.includes(parts[0].toLowerCase())) return null

      if (parts.length >= 5) {
        // Format: First, Last, Email, Grade, Group
        return {
          full_name: parts[0] + ' ' + parts[1],
          email: parts[2] || null,
          grade: parts[3] || null,
          group_name: parts[4] || null
        }
      } else if (parts.length === 4) {
        // Format: First, Last, Email, Grade (no group)
        const hasEmail = parts[2].includes('@')
        return {
          full_name: parts[0] + ' ' + parts[1],
          email: hasEmail ? parts[2] : null,
          grade: hasEmail ? parts[3] : parts[2],
          group_name: hasEmail ? null : parts[3]
        }
      } else if (parts.length >= 2) {
        // Fallback: Name, Email
        const email = parts.find(p => p.includes('@'))
        const nameParts = parts.filter(p => !p.includes('@'))
        return { full_name: nameParts.join(' '), email: email || null }
      }
      return null
    })
    .filter(Boolean)
}

async function handleAddInvites(classId) {
  inviteError.value = ''
  inviteSuccess.value = ''
  const rows = parseInviteLines(invitePasteText.value)
  if (rows.length === 0) {
    inviteError.value = 'No valid rows found. Use format: First, Last, Email, Grade, Group'
    return
  }
  const result = await teacher.addInvites(classId, rows)
  if (result.error) {
    inviteError.value = result.error
    return
  }
  const parts = [`Added ${result.data.added} student(s)`]
  if (result.data.assigned) parts.push(`assigned ${result.data.assigned} to groups`)
  inviteSuccess.value = parts.join(', ')
  invitePasteText.value = ''
  classInvites.value[classId] = await teacher.loadInvites(classId)
  setTimeout(() => { inviteSuccess.value = '' }, 3000)
}

function handleCSVUpload(event) {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    invitePasteText.value = e.target.result
  }
  reader.readAsText(file)
  event.target.value = ''
}

async function handleRemoveInvite(classId, inviteId) {
  await teacher.removeInvite(inviteId)
  selectedInvites.value[classId]?.delete(inviteId)
  classInvites.value[classId] = await teacher.loadInvites(classId)
}

function toggleSelectInvite(classId, inviteId, checked) {
  if (!selectedInvites.value[classId]) selectedInvites.value[classId] = new Set()
  if (checked) {
    selectedInvites.value[classId].add(inviteId)
  } else {
    selectedInvites.value[classId].delete(inviteId)
  }
  // Force reactivity
  selectedInvites.value = { ...selectedInvites.value }
}

function toggleSelectAll(classId, checked) {
  if (checked) {
    selectedInvites.value[classId] = new Set((classInvites.value[classId] || []).map(i => i.id))
  } else {
    selectedInvites.value[classId] = new Set()
  }
  selectedInvites.value = { ...selectedInvites.value }
}

function isAllSelected(classId) {
  const invites = classInvites.value[classId] || []
  return invites.length > 0 && selectedInvites.value[classId]?.size === invites.length
}

async function handleBulkRemove(classId) {
  const ids = [...(selectedInvites.value[classId] || [])]
  if (ids.length === 0) return
  for (const id of ids) {
    await teacher.removeInvite(id)
  }
  selectedInvites.value[classId] = new Set()
  classInvites.value[classId] = await teacher.loadInvites(classId)
}
</script>
