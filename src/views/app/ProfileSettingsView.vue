<template>
  <div class="space-y-4 max-w-lg">
    <h1 class="text-xl font-bold">Profile Settings</h1>

    <div v-if="!auth.profile" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <!-- Avatar -->
      <div class="flex items-center gap-4">
        <div class="avatar placeholder">
          <div class="bg-primary text-primary-content rounded-full w-16 h-16">
            <img v-if="auth.profile.avatar_url" :src="auth.profile.avatar_url" :alt="auth.profile.full_name" class="rounded-full" />
            <span v-else class="text-2xl">{{ (auth.profile.full_name || '?')[0].toUpperCase() }}</span>
          </div>
        </div>
        <div>
          <p class="font-semibold">{{ auth.profile.full_name }}</p>
          <p class="text-sm text-base-content/50">{{ auth.profile.email }}</p>
        </div>
      </div>

      <!-- Form -->
      <div class="space-y-3">
        <div class="form-control">
          <label class="label py-1"><span class="label-text text-sm">Full Name</span></label>
          <input v-model="form.full_name" type="text" class="input input-bordered w-full" maxlength="100" />
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text text-sm">Username</span></label>
          <input v-model="form.username" type="text" class="input input-bordered w-full" maxlength="30" placeholder="Choose a username" />
          <label class="label py-0.5"><span class="label-text-alt text-base-content/40">Letters, numbers, underscores. Used for your public profile URL.</span></label>
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text text-sm">Bio</span></label>
          <textarea v-model="form.bio" class="textarea textarea-bordered w-full" rows="2" maxlength="280" placeholder="Tell people about yourself"></textarea>
          <label class="label py-0.5"><span class="label-text-alt" :class="(form.bio?.length || 0) > 250 ? 'text-warning' : 'text-base-content/40'">{{ form.bio?.length || 0 }}/280</span></label>
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text text-sm">Investment Philosophy</span></label>
          <textarea v-model="form.investment_philosophy" class="textarea textarea-bordered w-full" rows="3" maxlength="500" placeholder="What's your approach to investing?"></textarea>
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text text-sm">Avatar URL</span></label>
          <input v-model="form.avatar_url" type="text" class="input input-bordered w-full" placeholder="https://..." />
        </div>

        <label class="label cursor-pointer justify-start gap-2">
          <input type="checkbox" v-model="form.is_public" class="checkbox checkbox-sm" />
          <span class="label-text text-sm">Public profile (visible at /u/{{ form.username || 'username' }})</span>
        </label>

        <div v-if="error" class="text-error text-sm">{{ error }}</div>
        <div v-if="success" class="text-success text-sm">Profile updated!</div>

        <button class="btn btn-primary btn-block" :disabled="saving || !hasChanges" @click="save">
          <span v-if="saving" class="loading loading-spinner loading-sm"></span>
          Save Changes
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()

const form = reactive({
  full_name: '',
  username: '',
  bio: '',
  investment_philosophy: '',
  avatar_url: '',
  is_public: true
})
const saving = ref(false)
const error = ref('')
const success = ref(false)
let original = {}

onMounted(() => {
  if (auth.profile) loadForm()
})

function loadForm() {
  const p = auth.profile
  form.full_name = p.full_name || ''
  form.username = p.username || ''
  form.bio = p.bio || ''
  form.investment_philosophy = p.investment_philosophy || ''
  form.avatar_url = p.avatar_url || ''
  form.is_public = p.is_public !== false
  original = { ...form }
}

const hasChanges = computed(() => {
  return form.full_name !== original.full_name ||
    form.username !== original.username ||
    form.bio !== original.bio ||
    form.investment_philosophy !== original.investment_philosophy ||
    form.avatar_url !== original.avatar_url ||
    form.is_public !== original.is_public
})

async function save() {
  error.value = ''
  success.value = false

  // Basic username validation
  if (form.username && !/^[a-zA-Z0-9_]+$/.test(form.username)) {
    error.value = 'Username can only contain letters, numbers, and underscores.'
    return
  }

  saving.value = true
  const updates = {
    full_name: form.full_name.trim() || null,
    username: form.username.trim() || null,
    bio: form.bio.trim() || null,
    investment_philosophy: form.investment_philosophy.trim() || null,
    avatar_url: form.avatar_url.trim() || null,
    is_public: form.is_public
  }

  const result = await auth.updateProfile(updates)
  saving.value = false

  if (result.error) {
    if (result.error.includes('unique') || result.error.includes('duplicate')) {
      error.value = 'That username is already taken.'
    } else {
      error.value = result.error
    }
    return
  }

  original = { ...form }
  success.value = true
  setTimeout(() => { success.value = false }, 3000)
}
</script>
