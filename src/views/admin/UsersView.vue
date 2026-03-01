<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Users</h1>
        <p class="text-base-content/70">Manage all platform users</p>
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

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else class="card bg-base-100 shadow">
      <div class="card-body p-0">
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in filteredUsers" :key="user.id">
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
                <td colspan="5" class="text-center text-base-content/50">No users found</td>
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

    <div v-if="successMsg" class="alert alert-success">
      <span>{{ successMsg }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'

const users = ref([])
const search = ref('')
const roleFilter = ref('')
const loading = ref(true)
const showDeleteModal = ref(false)
const deleteTarget = ref(null)
const successMsg = ref('')

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

function showSuccess(msg) {
  successMsg.value = msg
  setTimeout(() => { successMsg.value = '' }, 3000)
}
</script>
