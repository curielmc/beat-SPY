<template>
  <div class="min-h-screen bg-base-200">
    <!-- Admin preview banner -->
    <div v-if="auth.isAdmin" class="bg-error text-error-content text-center py-2 px-4 text-sm font-semibold flex items-center justify-center gap-3">
      <span>Viewing as Teacher</span>
      <RouterLink to="/admin/classes" class="btn btn-xs btn-ghost bg-error-content/20 hover:bg-error-content/30">Back to Admin</RouterLink>
    </div>

    <div class="navbar bg-base-100 shadow-sm">
      <div class="max-w-6xl mx-auto w-full flex items-center">
        <div class="flex-none flex items-center gap-2">
          <img src="/logo.jpg" alt="Beat the S&P 500" class="h-8 w-8 rounded-lg" />
          <span class="text-lg font-bold text-primary">Beat the S&P 500</span>
          <span class="badge badge-ghost ml-2">Teacher</span>
        </div>
        <div class="flex-1 flex justify-center gap-1">
          <RouterLink to="/teacher" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher' }">Dashboard</RouterLink>
          <RouterLink to="/teacher/students" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/students' }">Students</RouterLink>
          <RouterLink to="/teacher/restrictions" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/restrictions' }">Settings</RouterLink>
          <RouterLink to="/teacher/classes" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/classes' }">Classes</RouterLink>
          <RouterLink to="/teacher/portfolio" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/portfolio' }">📈 My Portfolio</RouterLink>
          <RouterLink to="/teacher/fund-analytics" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/fund-analytics' }">📊 Analytics</RouterLink>
          <RouterLink to="/teacher/messages" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/messages' }">💬 Messages</RouterLink>
        </div>
        <div class="flex-none">
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

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

function logout() {
  auth.logout()
  router.push({ name: 'landing' })
}
</script>
