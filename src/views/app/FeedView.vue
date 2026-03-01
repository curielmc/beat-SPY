<template>
  <div class="space-y-4">
    <h1 class="text-2xl font-bold">Feed</h1>
    <p class="text-sm text-base-content/60">Recent takes from people you follow</p>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <!-- Empty state -->
      <div v-if="!social.myFollowing.length" class="text-center py-16 space-y-3">
        <div class="text-5xl">👀</div>
        <h2 class="text-xl font-bold">No one followed yet</h2>
        <p class="text-base-content/60 text-sm">Follow users from the leaderboard or stock pages to see their takes here.</p>
        <RouterLink to="/leaderboard" class="btn btn-primary btn-sm">Browse Leaderboard</RouterLink>
      </div>

      <div v-else-if="!takes.length" class="text-center py-16 space-y-3">
        <div class="text-5xl">📭</div>
        <h2 class="text-xl font-bold">No takes yet</h2>
        <p class="text-base-content/60 text-sm">People you follow haven't posted any takes yet.</p>
      </div>

      <!-- Feed list -->
      <div v-else class="space-y-3">
        <TakeCard
          v-for="take in takes"
          :key="take.id"
          :take="take"
          :showTicker="true"
          :showFollowButton="false"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useSocialStore } from '../../stores/social'
import TakeCard from '../../components/TakeCard.vue'

const social = useSocialStore()
const loading = ref(true)
const takes = ref([])

onMounted(async () => {
  if (!social.followingLoaded) {
    await social.loadMyFollowing()
  }
  takes.value = await social.fetchFeed()
  loading.value = false
})
</script>
