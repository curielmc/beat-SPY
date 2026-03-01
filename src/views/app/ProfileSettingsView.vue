<template>
  <div class="space-y-4 max-w-lg">
    <h1 class="text-xl font-bold">Profile Settings</h1>

    <div v-if="!auth.profile" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <!-- Avatar -->
      <div class="flex items-center gap-4">
        <div class="avatar placeholder cursor-pointer" @click="$refs.avatarInput.click()">
          <div class="bg-primary text-primary-content rounded-full w-16 h-16 relative group">
            <img v-if="avatarPreview || form.avatar_url" :src="avatarPreview || form.avatar_url" :alt="auth.profile.full_name" class="rounded-full object-cover w-full h-full" />
            <span v-else class="text-2xl">{{ (auth.profile.full_name || '?')[0].toUpperCase() }}</span>
            <div class="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <span v-if="uploading" class="loading loading-spinner loading-sm text-white"></span>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            </div>
          </div>
        </div>
        <input ref="avatarInput" type="file" accept="image/*" class="hidden" @change="onAvatarSelected" />
        <div>
          <p class="font-semibold">{{ auth.profile.full_name }}</p>
          <p class="text-sm text-base-content/50">{{ auth.profile.email }}</p>
          <p class="text-xs text-base-content/40 mt-0.5">Click avatar to change</p>
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
import { uploadAvatar } from '../../lib/supabase'

const auth = useAuthStore()

const avatarPreview = ref(null)
const uploading = ref(false)

async function onAvatarSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return

  if (file.size > 2 * 1024 * 1024) {
    error.value = 'Image must be under 2 MB.'
    return
  }

  avatarPreview.value = URL.createObjectURL(file)
  uploading.value = true
  error.value = ''

  try {
    const url = await uploadAvatar(auth.profile.id, file)
    form.avatar_url = url
  } catch (err) {
    error.value = 'Failed to upload avatar. ' + (err.message || '')
    avatarPreview.value = null
  } finally {
    uploading.value = false
  }
}

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
