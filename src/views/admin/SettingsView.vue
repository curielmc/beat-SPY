<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Platform Settings</h1>
      <p class="text-base-content/70">Manage platform-wide configuration</p>
    </div>

    <div v-if="successMsg" class="alert alert-success">
      <span>{{ successMsg }}</span>
    </div>

    <!-- FMP API Key -->
    <div class="card bg-base-100 shadow">
      <div class="card-body space-y-4">
        <h2 class="card-title text-lg">FMP API Key</h2>
        <p class="text-sm text-base-content/60">The Financial Modeling Prep API key is set via the <code>VITE_FMP_API_KEY</code> environment variable. Update your <code>.env</code> file to change it.</p>
        <div class="flex items-center gap-2">
          <span class="text-sm">Status:</span>
          <span v-if="hasFmpKey" class="badge badge-success">Configured</span>
          <span v-else class="badge badge-warning">Not set</span>
        </div>
      </div>
    </div>

    <!-- Default Starting Cash -->
    <div class="card bg-base-100 shadow">
      <div class="card-body space-y-4">
        <h2 class="card-title text-lg">Default Starting Cash</h2>
        <p class="text-sm text-base-content/60">Default starting cash for new portfolios. Currently $100,000.</p>
        <div class="form-control">
          <input v-model.number="defaultCash" type="number" class="input input-bordered w-64" />
        </div>
        <p class="text-xs text-base-content/50">Note: This only affects new portfolios. Changing this value requires updating the default in the database.</p>
      </div>
    </div>

    <!-- Manage Admins -->
    <div class="card bg-base-100 shadow">
      <div class="card-body space-y-4">
        <h2 class="card-title text-lg">Admin Accounts</h2>
        <p class="text-sm text-base-content/60">Current admin users on the platform.</p>

        <div v-if="admins.length === 0" class="text-base-content/50">No admin accounts found</div>
        <div v-for="admin in admins" :key="admin.id" class="flex items-center justify-between bg-base-200 rounded-lg p-3">
          <div>
            <span class="font-medium">{{ admin.full_name }}</span>
            <span class="text-sm text-base-content/60 ml-2">{{ admin.email }}</span>
          </div>
          <span class="badge badge-error badge-sm">admin</span>
        </div>

        <div class="divider"></div>

        <h3 class="font-semibold text-sm">Promote User to Admin</h3>
        <div class="flex gap-2">
          <input v-model="promoteEmail" type="email" class="input input-bordered flex-1" placeholder="user@email.com" />
          <button class="btn btn-primary btn-sm" :disabled="!promoteEmail" @click="promoteToAdmin">Promote</button>
        </div>
        <p v-if="promoteError" class="text-error text-sm">{{ promoteError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'

const hasFmpKey = !!import.meta.env.VITE_FMP_API_KEY
const defaultCash = ref(100000)
const admins = ref([])
const promoteEmail = ref('')
const promoteError = ref('')
const successMsg = ref('')

onMounted(async () => {
  const { data } = await supabase.from('profiles').select('*').eq('role', 'admin')
  admins.value = data || []
})

async function promoteToAdmin() {
  promoteError.value = ''
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('email', promoteEmail.value)
    .select()
    .single()

  if (error || !data) {
    promoteError.value = 'User not found or update failed'
    return
  }

  admins.value.push(data)
  promoteEmail.value = ''
  successMsg.value = `${data.full_name} promoted to admin`
  setTimeout(() => { successMsg.value = '' }, 3000)
}
</script>
