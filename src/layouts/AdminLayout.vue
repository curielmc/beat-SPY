<template>
  <div class="min-h-screen bg-base-200 flex">
    <!-- Mobile overlay -->
    <div v-if="sidebarOpen" class="fixed inset-0 bg-black/40 z-30 lg:hidden" @click="sidebarOpen = false"></div>

    <!-- Sidebar -->
    <aside class="fixed lg:sticky top-0 left-0 z-40 h-screen w-56 bg-base-100 border-r border-base-300 flex flex-col transition-transform lg:translate-x-0" :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'">
      <div class="p-4 border-b border-base-300 flex items-start justify-between">
        <div class="flex flex-col gap-3">
          <LogoIcon size="sm" />
          <div>
            <h1 class="text-sm font-bold text-primary">Beat the S&P 500</h1>
            <p class="text-[10px] uppercase tracking-wider text-error font-semibold">Admin Panel</p>
          </div>
        </div>
        <button class="btn btn-ghost btn-xs btn-square hidden lg:flex" @click="handleLogout" title="Log out">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>
      </div>

      <nav class="flex-1 p-3 space-y-1">
        <RouterLink to="/admin" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/admin' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          Dashboard
        </RouterLink>
        <RouterLink to="/admin/users" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/admin/users' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          Users
        </RouterLink>
        <RouterLink to="/admin/classes" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/admin/classes' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          Classes
        </RouterLink>
        <RouterLink to="/admin/trades" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/admin/trades' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
          Trades
        </RouterLink>
        <RouterLink to="/admin/tutorials" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/admin/tutorials' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5 5.754 5 4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18c1.746 0 3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          Tutorials
        </RouterLink>
        <RouterLink to="/admin/portfolios" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/admin/portfolios' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          Portfolios
        </RouterLink>
        <RouterLink to="/admin/competitions" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/admin/competitions' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Challenges
        </RouterLink>
        <RouterLink to="/home" class="btn btn-outline btn-sm justify-start w-full gap-2 border-primary/30 text-primary" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          View as Student
        </RouterLink>
        <button class="btn btn-outline btn-sm justify-start w-full gap-2 border-secondary/30 text-secondary" @click="openTeacherModal">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          VUS teacher
        </button>
        <RouterLink to="/admin/portfolio" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/admin/portfolio' }" @click="sidebarOpen = false">
          <span>📈</span> My Portfolio
        </RouterLink>
        <RouterLink to="/admin/settings" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/admin/settings' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Settings
        </RouterLink>
      </nav>
      <div class="p-3 border-t border-base-300">
        <button class="btn btn-ghost btn-sm w-full justify-start gap-2" @click="handleLogout">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          Log out
        </button>
      </div>
    </aside>

    <!-- Main content -->
    <div class="flex-1 min-w-0">
      <div class="lg:hidden sticky top-0 z-20 bg-base-100 border-b border-base-300 px-4 py-2 flex items-center gap-3">
        <button class="btn btn-ghost btn-sm btn-square" @click="sidebarOpen = !sidebarOpen">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <span class="font-bold text-primary text-sm flex-1">Admin Panel</span>
        <button class="btn btn-ghost btn-sm btn-square" @click="handleLogout" title="Log out">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>
      </div>
      <div class="p-4 lg:p-6">
        <RouterView />
      </div>
    </div>

    <!-- Teacher Selection Modal -->
    <dialog class="modal" :class="{ 'modal-open': showTeacherModal }">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Select Class to View as Teacher</h3>
        <p class="py-2 text-sm text-base-content/60">Choose which class you want to see through its teacher's eyes.</p>
        
        <div v-if="loadingClasses" class="flex justify-center py-6">
          <span class="loading loading-spinner loading-md"></span>
        </div>
        <div v-else-if="allClasses.length === 0" class="py-6 text-center text-base-content/50">
          No classes found.
        </div>
        <div v-else class="space-y-2 mt-4 max-h-96 overflow-y-auto">
          <button v-for="cls in allClasses" :key="cls.id" 
            class="btn btn-ghost w-full justify-between h-auto py-3 px-4 border border-base-300"
            :disabled="masquerading"
            @click="viewAsTeacher(cls)">
            <div class="text-left">
              <div class="font-bold">{{ cls.class_name }}</div>
              <div class="text-xs text-base-content/60">{{ cls.code }} · {{ cls.teacher?.full_name || 'No Teacher' }}</div>
            </div>
            <span>&rarr;</span>
          </button>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="showTeacherModal = false">Cancel</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showTeacherModal = false"><button>close</button></form>
    </dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'
import LogoIcon from '../components/LogoIcon.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const sidebarOpen = ref(false)

const showTeacherModal = ref(false)
const allClasses = ref([])
const loadingClasses = ref(false)
const masquerading = ref(false)

async function openTeacherModal() {
  sidebarOpen.value = false
  showTeacherModal.value = true
  loadingClasses.value = true
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('id, class_name, code, teacher_id, teacher:profiles!classes_teacher_id_fkey(id, full_name, email)')
      .order('created_at', { ascending: false })
    if (!error) allClasses.value = data
  } finally {
    loadingClasses.value = false
  }
}

async function viewAsTeacher(cls) {
  if (!cls.teacher) {
    alert('No teacher found for this class.')
    return
  }
  masquerading.value = true
  const result = await auth.startMasquerade(cls.teacher)
  masquerading.value = false
  if (result?.error) {
    alert('Masquerade failed: ' + result.error)
    return
  }
  // Set the active class for the teacher view
  auth.setActiveClass(cls.id)
  router.push('/teacher')
}

async function handleLogout() {
  await auth.logout()
  router.push('/')
}
</script>
