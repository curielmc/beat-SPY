<template>
  <button
    v-if="show"
    class="btn gap-1"
    :class="[sizeClass, following ? 'btn-ghost' : 'btn-primary']"
    :disabled="loading"
    @click="toggle"
  >
    <span v-if="loading" class="loading loading-spinner" :class="spinnerSize"></span>
    <template v-else>{{ following ? 'Following' : 'Follow' }}</template>
  </button>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSocialStore } from '../stores/social'
import { useAuthStore } from '../stores/auth'

const props = defineProps({
  userId: String,
  size: { type: String, default: 'sm' }
})

const social = useSocialStore()
const auth = useAuthStore()
const loading = ref(false)

const show = computed(() => {
  return auth.isLoggedIn && auth.currentUser?.id !== props.userId
})

const following = computed(() => social.isFollowing(props.userId))

const sizeClass = computed(() => `btn-${props.size}`)
const spinnerSize = computed(() => props.size === 'xs' ? 'loading-xs' : 'loading-sm')

onMounted(async () => {
  if (!social.followingLoaded) {
    await social.loadMyFollowing()
  }
})

async function toggle() {
  loading.value = true
  if (following.value) {
    await social.unfollowUser(props.userId)
  } else {
    await social.followUser(props.userId)
  }
  loading.value = false
}
</script>
