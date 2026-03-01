<template>
  <div class="space-y-4 max-w-lg">
    <h1 class="text-xl font-bold">Team Settings</h1>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="!group" class="alert alert-warning">
      You are not assigned to a team yet.
    </div>

    <div v-else-if="!group.allow_student_configure" class="alert alert-info">
      Your teacher has not enabled team editing yet.
    </div>

    <template v-else>
      <!-- Avatar -->
      <div class="flex items-center gap-4">
        <div :class="['avatar cursor-pointer', !(avatarPreview || form.avatar_url) && 'placeholder']" @click="$refs.avatarInput.click()">
          <div class="bg-primary text-primary-content rounded-full w-16 h-16 relative group/av">
            <img v-if="avatarPreview || form.avatar_url" :src="avatarPreview || form.avatar_url" :alt="form.name" class="rounded-full object-cover w-full h-full" />
            <span v-else class="text-2xl">{{ (form.name || '?')[0].toUpperCase() }}</span>
            <div class="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover/av:opacity-100 flex items-center justify-center transition-opacity">
              <span v-if="uploading" class="loading loading-spinner loading-sm text-white"></span>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            </div>
          </div>
        </div>
        <input ref="avatarInput" type="file" accept="image/*" class="hidden" @change="onAvatarSelected" />
        <div>
          <p class="font-semibold">{{ group.name }}</p>
          <p class="text-xs text-base-content/40 mt-0.5">Click avatar to change</p>
        </div>
      </div>

      <!-- Form -->
      <div class="space-y-3">
        <div class="form-control">
          <label class="label py-1"><span class="label-text text-sm">Team Name</span></label>
          <input v-model="form.name" type="text" class="input input-bordered w-full" maxlength="100" />
        </div>

        <div class="form-control">
          <label class="label py-1"><span class="label-text text-sm">Bio</span></label>
          <textarea v-model="form.bio" class="textarea textarea-bordered w-full" rows="3" maxlength="280" placeholder="Describe your team"></textarea>
          <label class="label py-0.5"><span class="label-text-alt" :class="(form.bio?.length || 0) > 250 ? 'text-warning' : 'text-base-content/40'">{{ form.bio?.length || 0 }}/280</span></label>
        </div>

        <div v-if="error" class="text-error text-sm">{{ error }}</div>
        <div v-if="success" class="text-success text-sm">Team profile updated!</div>

        <button class="btn btn-primary btn-block" :disabled="saving" @click="save">
          <span v-if="saving" class="loading loading-spinner loading-sm"></span>
          Save Changes
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { supabase, uploadGroupAvatar } from '../../lib/supabase'

const auth = useAuthStore()

const loading = ref(true)
const group = ref(null)
const avatarPreview = ref(null)
const uploading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref(false)

const form = reactive({
  name: '',
  bio: '',
  avatar_url: ''
})

onMounted(async () => {
  const membership = await auth.getCurrentMembership()
  if (membership?.group) {
    group.value = membership.group
    form.name = group.value.name || ''
    form.bio = group.value.bio || ''
    form.avatar_url = group.value.avatar_url || ''
  }
  loading.value = false
})

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
    const url = await uploadGroupAvatar(group.value.id, file)
    form.avatar_url = url
  } catch (err) {
    error.value = 'Failed to upload avatar. ' + (err.message || '')
    avatarPreview.value = null
  } finally {
    uploading.value = false
  }
}

async function save() {
  error.value = ''
  success.value = false
  saving.value = true

  const { error: updateError } = await supabase
    .from('groups')
    .update({
      name: form.name.trim() || group.value.name,
      bio: form.bio.trim() || null,
      avatar_url: form.avatar_url || null
    })
    .eq('id', group.value.id)

  saving.value = false

  if (updateError) {
    error.value = updateError.message
    return
  }

  success.value = true
  setTimeout(() => { success.value = false }, 3000)
}
</script>
