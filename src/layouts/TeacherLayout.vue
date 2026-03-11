<template>
  <div class="min-h-screen bg-base-200">
    <!-- Admin preview banner -->
    <div v-if="auth.isAdmin" class="bg-error text-error-content text-center py-2 px-4 text-sm font-semibold flex items-center justify-center gap-3">
      <span>Viewing as Teacher</span>
      <RouterLink to="/admin/classes" class="btn btn-xs btn-ghost bg-error-content/20 hover:bg-error-content/30">Back to Admin</RouterLink>
    </div>

    <div class="navbar bg-base-100 shadow-sm">
      <div class="max-w-6xl mx-auto w-full flex items-center gap-4">
        <div class="flex-none flex items-center gap-3">
          <LogoIcon size="sm" />
          <span class="text-sm font-bold text-primary">Beat the S&P 500</span>
          <span class="badge badge-secondary badge-outline text-[10px] h-4 uppercase">Teacher</span>
        </div>
        <div class="flex-1 flex justify-center gap-1">
          <RouterLink to="/teacher" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher' }">Dashboard</RouterLink>
          <RouterLink to="/teacher/students" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/students' }">Students</RouterLink>
          <RouterLink to="/teacher/restrictions" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/restrictions' }">Settings</RouterLink>
          <RouterLink to="/teacher/classes" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/classes' }">Classes</RouterLink>
          <RouterLink to="/teacher/tutorials" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/tutorials' }">📚 Tutorials</RouterLink>
          <RouterLink to="/teacher/portfolio" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/portfolio' }">📈 My Investments</RouterLink>
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
import LogoIcon from '../components/LogoIcon.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

function logout() {
  auth.logout()
  router.push({ name: 'landing' })
}
</script>
