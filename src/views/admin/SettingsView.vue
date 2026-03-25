<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold">Platform Settings</h1>
      <p class="text-base-content/70">Manage platform-wide configuration</p>
    </div>

    <div v-if="successMsg" class="alert alert-success">
      <span>{{ successMsg }}</span>
    </div>

    <div v-if="errorMsg" class="alert alert-error">
      <span>{{ errorMsg }}</span>
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

    <div class="card bg-base-100 shadow">
      <div class="card-body space-y-5">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="card-title text-lg">Jasper API Tokens</h2>
            <p class="text-sm text-base-content/60">Create a persistent token for Claude Code, Gemini CLI, or any other tool that should import tutorials through Jasper.</p>
          </div>
          <button class="btn btn-ghost btn-sm" :disabled="tokensLoading" @click="loadJasperTokens">Refresh</button>
        </div>

        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div class="space-y-3">
            <div v-if="tokensLoading" class="flex justify-center py-8">
              <span class="loading loading-spinner loading-md"></span>
            </div>

            <div v-else-if="jasperTokens.length === 0" class="rounded-lg border border-dashed border-base-300 px-4 py-8 text-sm text-base-content/50">
              No Jasper tokens created yet.
            </div>

            <div v-else class="space-y-3">
              <div v-for="token in jasperTokens" :key="token.id" class="rounded-lg border border-base-300 bg-base-200/40 p-4 space-y-3">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="font-semibold">{{ token.label }}</div>
                    <div class="text-xs text-base-content/50">Created {{ formatDate(token.created_at) }}</div>
                  </div>
                  <span class="badge badge-sm" :class="token.revoked_at ? 'badge-error' : 'badge-success'">
                    {{ token.revoked_at ? 'Revoked' : 'Active' }}
                  </span>
                </div>

                <div class="flex flex-wrap gap-2">
                  <span v-for="scope in token.scopes || []" :key="scope" class="badge badge-outline badge-sm">{{ scope }}</span>
                </div>

                <div class="text-xs text-base-content/60">
                  Last used: {{ token.last_used_at ? formatDate(token.last_used_at) : 'Never' }}
                </div>

                <div class="flex gap-2">
                  <button
                    class="btn btn-sm"
                    :class="token.revoked_at ? 'btn-outline' : 'btn-error btn-outline'"
                    :disabled="tokenMutatingId === token.id"
                    @click="toggleTokenRevocation(token)"
                  >
                    <span v-if="tokenMutatingId === token.id" class="loading loading-spinner loading-xs"></span>
                    <span v-else>{{ token.revoked_at ? 'Reactivate' : 'Revoke' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-base-300 p-4 space-y-4">
            <h3 class="font-semibold">Create Token</h3>

            <div class="form-control">
              <label class="label"><span class="label-text">Label</span></label>
              <input v-model="jasperLabel" type="text" class="input input-bordered" placeholder="Claude Code" />
            </div>

            <div class="space-y-2">
              <label class="label px-0"><span class="label-text">Scopes</span></label>
              <label class="label cursor-pointer justify-start gap-3">
                <input v-model="jasperScopes" type="checkbox" class="checkbox checkbox-sm" value="tutorials:create" />
                <span class="label-text">Create tutorials</span>
              </label>
              <label class="label cursor-pointer justify-start gap-3">
                <input v-model="jasperScopes" type="checkbox" class="checkbox checkbox-sm" value="tutorials:assign" />
                <span class="label-text">Assign tutorials to classes</span>
              </label>
              <label class="label cursor-pointer justify-start gap-3">
                <input v-model="jasperScopes" type="checkbox" class="checkbox checkbox-sm" value="tutorials:publish" />
                <span class="label-text">Publish imported tutorials</span>
              </label>
            </div>

            <button class="btn btn-primary w-full" :disabled="creatingToken || !jasperLabel.trim() || jasperScopes.length === 0" @click="createJasperToken">
              <span v-if="creatingToken" class="loading loading-spinner loading-xs"></span>
              <span v-else>Create Jasper Token</span>
            </button>

            <div v-if="newJasperToken" class="space-y-2">
              <div class="alert alert-warning text-sm">
                <span>Copy this token now. It will not be shown again.</span>
              </div>
              <textarea class="textarea textarea-bordered h-28 font-mono text-xs" readonly :value="newJasperToken"></textarea>
              <button class="btn btn-outline btn-sm w-full" @click="copyNewToken">
                {{ copiedNewToken ? 'Copied' : 'Copy Token' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase, getAccessToken } from '../../lib/supabase'

const hasFmpKey = !!import.meta.env.VITE_FMP_API_KEY
const defaultCash = ref(100000)
const admins = ref([])
const promoteEmail = ref('')
const promoteError = ref('')
const successMsg = ref('')
const errorMsg = ref('')
const jasperTokens = ref([])
const tokensLoading = ref(false)
const creatingToken = ref(false)
const tokenMutatingId = ref('')
const jasperLabel = ref('Claude Code')
const jasperScopes = ref(['tutorials:create'])
const newJasperToken = ref('')
const copiedNewToken = ref(false)

onMounted(async () => {
  const { data } = await supabase.from('profiles').select('*').eq('role', 'admin')
  admins.value = data || []
  await loadJasperTokens()
})

async function promoteToAdmin() {
  clearMessages()
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

function clearMessages() {
  successMsg.value = ''
  errorMsg.value = ''
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

async function getAdminHeaders() {
  const accessToken = await getAccessToken()
  if (!accessToken) {
    throw new Error('Your admin session expired. Please sign in again.')
  }

  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
}

async function loadJasperTokens() {
  tokensLoading.value = true
  try {
    const headers = await getAdminHeaders()
    const res = await fetch('/api/jasper/tokens', { headers })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(payload?.error || 'Failed to load Jasper tokens')
    }
    jasperTokens.value = payload.tokens || []
  } catch (error) {
    errorMsg.value = error.message || 'Failed to load Jasper tokens'
  } finally {
    tokensLoading.value = false
  }
}

async function createJasperToken() {
  clearMessages()
  creatingToken.value = true
  copiedNewToken.value = false
  newJasperToken.value = ''
  try {
    const headers = await getAdminHeaders()
    const res = await fetch('/api/jasper/tokens', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        label: jasperLabel.value,
        scopes: jasperScopes.value
      })
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(payload?.error || 'Failed to create Jasper token')
    }
    newJasperToken.value = payload.token || ''
    successMsg.value = `Created Jasper token "${payload.label}".`
    await loadJasperTokens()
  } catch (error) {
    errorMsg.value = error.message || 'Failed to create Jasper token'
  } finally {
    creatingToken.value = false
  }
}

async function copyNewToken() {
  if (!newJasperToken.value) return
  await navigator.clipboard.writeText(newJasperToken.value)
  copiedNewToken.value = true
}

async function toggleTokenRevocation(token) {
  clearMessages()
  tokenMutatingId.value = token.id
  try {
    const headers = await getAdminHeaders()
    const res = await fetch('/api/jasper/tokens', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        token_id: token.id,
        revoked: !!token.revoked_at ? false : true
      })
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(payload?.error || 'Failed to update Jasper token')
    }
    successMsg.value = token.revoked_at ? `Reactivated "${token.label}".` : `Revoked "${token.label}".`
    jasperTokens.value = jasperTokens.value.map(entry => entry.id === token.id ? payload.token : entry)
  } catch (error) {
    errorMsg.value = error.message || 'Failed to update Jasper token'
  } finally {
    tokenMutatingId.value = ''
  }
}
</script>
