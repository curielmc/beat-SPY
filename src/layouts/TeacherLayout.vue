<template>
  <div class="min-h-screen bg-base-200">
    <div class="navbar bg-base-100 shadow-sm">
      <div class="max-w-6xl mx-auto w-full flex items-center">
        <div class="flex-none">
          <span class="text-lg font-bold text-primary">Beat the S&P 500</span>
          <span class="badge badge-ghost ml-2">Teacher</span>
        </div>
        <div class="flex-1 flex justify-center gap-1">
          <RouterLink to="/teacher" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher' }">Dashboard</RouterLink>
          <RouterLink to="/teacher/students" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/students' }">Students</RouterLink>
          <RouterLink to="/teacher/restrictions" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/restrictions' }">Settings</RouterLink>
          <RouterLink to="/teacher/classes" class="btn btn-ghost btn-sm" :class="{ 'btn-active': route.path === '/teacher/classes' }">Classes</RouterLink>
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
