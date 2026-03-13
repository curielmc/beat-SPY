<template>
  <div class="min-h-screen bg-base-200">
    <!-- Admin preview banner -->
    <div v-if="auth.isAdmin" class="bg-error text-error-content text-center py-2 px-4 text-sm font-semibold flex items-center justify-center gap-3">
      <span>Viewing as Teacher</span>
      <RouterLink to="/admin/classes" class="btn btn-xs btn-ghost bg-error-content/20 hover:bg-error-content/30">Back to Admin</RouterLink>
    </div>

    <div class="navbar bg-base-100 shadow-sm">
      <div class="max-w-6xl mx-auto w-full flex flex-wrap items-center gap-3 px-4 py-2 lg:flex-nowrap">
        <div class="flex-none flex items-center gap-3 min-w-0">
          <LogoIcon size="sm" />
          <span class="truncate text-sm font-bold text-primary">Beat the S&amp;P 500</span>
          <span class="badge badge-secondary badge-outline gap-1 px-2" title="Teacher view" aria-label="Teacher view">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0112 20.055a12.083 12.083 0 01-6.16-9.477L12 14zm0 0v6" />
            </svg>
          </span>
        </div>
        <div class="flex min-w-0 flex-1 flex-wrap justify-center gap-1">
          <RouterLink to="/teacher" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher' }">Dashboard</RouterLink>
          <RouterLink to="/teacher/students" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/students' }">Students</RouterLink>
          <RouterLink to="/teacher/restrictions" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/restrictions' }">Settings</RouterLink>
          <RouterLink to="/teacher/classes" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/classes' }">Classes</RouterLink>
          <RouterLink to="/teacher/tutorials" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/tutorials' }">📚 Tutorials</RouterLink>
          <RouterLink to="/teacher/portfolio" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/portfolio' }">📈 My Investments</RouterLink>
          <RouterLink to="/teacher/fund-analytics" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/fund-analytics' }">📊 Analytics</RouterLink>
          <RouterLink to="/teacher/messages" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/messages' }">💬 Messages</RouterLink>
        </div>
        <div class="ml-auto flex-none">
          <button class="btn btn-ghost btn-sm" @click="logout">Logout</button>
        </div>
      </div>
    </div>
    <div class="max-w-6xl mx-auto p-4">
      <RouterView />
    </div>
  </div>
</template>

<script setup>
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import LogoIcon from '../components/LogoIcon.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

function logout() {
  auth.logout()
  router.push({ name: 'landing' })
}
</script>
