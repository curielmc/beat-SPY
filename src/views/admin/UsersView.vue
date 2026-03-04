<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 class="text-2xl font-bold">Users</h1>
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
      <button class="btn btn-ghost btn-sm" @click="clearSelection">Clear</button>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else class="card bg-base-100 shadow">
      <div class="card-body p-0">
        <div class="overflow-x-auto">
          <table class="table">
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
                <td class="font-medium">{{ user.full_name }}</td>
                <td class="text-sm">{{ user.email }}</td>
                <td>
                  <select :value="user.role" class="select select-bordered select-xs" @change="changeRole(user.id, $event.target.value)">
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td class="text-sm text-base-content/60">{{ new Date(user.created_at).toLocaleDateString() }}</td>
                <td>
                  <button class="btn btn-ghost btn-xs text-error" @click="confirmDelete(user)">Delete</button>
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

    <div v-if="successMsg" class="alert alert-success fixed bottom-4 right-4 w-auto z-50">
      <span>{{ successMsg }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'
import { downloadCSV, downloadText } from '../../utils/csvExport'

const users = ref([])
const search = ref('')
const roleFilter = ref('')
const loading = ref(true)
const showDeleteModal = ref(false)
const deleteTarget = ref(null)
const successMsg = ref('')
const selectedIds = ref(new Set())
const bulkRole = ref('')
const bulkUpdating = ref(false)

onMounted(async () => {
  await fetchUsers()
})

async function fetchUsers() {
  loading.value = true
  const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
  users.value = data || []
  loading.value = false
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
