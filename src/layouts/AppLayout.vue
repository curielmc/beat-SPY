<template>
  <div class="min-h-screen bg-base-200 flex flex-col">
    <!-- Admin preview banner -->
    <div v-if="viewingAs" class="bg-error text-error-content text-center py-2 px-4 text-sm font-semibold flex items-center justify-center gap-3 shrink-0">
      <span>Viewing as {{ viewingAs.full_name }} ({{ viewingAs.email }})</span>
      <RouterLink to="/admin/users" class="btn btn-xs btn-ghost bg-error-content/20 hover:bg-error-content/30">Back to Admin</RouterLink>
    </div>

    <div class="flex flex-1 min-h-0">
    <!-- Mobile overlay -->
    <div v-if="sidebarOpen" class="fixed inset-0 bg-black/40 z-30 lg:hidden" @click="sidebarOpen = false"></div>

    <!-- Sidebar -->
    <aside class="fixed lg:sticky top-0 left-0 z-40 h-screen w-56 bg-base-100 border-r border-base-300 flex flex-col transition-transform lg:translate-x-0" :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'">
      <div class="p-4 border-b border-base-300 flex items-start justify-between">
        <div>
          <h1 class="text-lg font-bold text-primary">Beat the S&P 500</h1>
          <p class="text-xs text-base-content/50">{{ auth.currentUser?.name }}</p>
        </div>
        <button class="btn btn-ghost btn-xs btn-square hidden lg:flex" @click="handleLogout" title="Log out">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>
      </div>
      <nav class="flex-1 p-3 space-y-1">
        <RouterLink to="/home" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/home' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" /></svg>
          My Portfolio
        </RouterLink>
        <RouterLink to="/my-funds" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/my-funds' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          My Funds
        </RouterLink>
        <RouterLink to="/portfolio-history" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/portfolio-history' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Portfolio History
        </RouterLink>
        <RouterLink v-if="hasActiveClass" to="/active-class" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/active-class' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          My Classes
        </RouterLink>
        <RouterLink to="/leaderboard" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/leaderboard' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          Leaderboard
        </RouterLink>
        <RouterLink to="/stocks" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/stocks' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          Stocks & Securities
        </RouterLink>
        <RouterLink to="/sp500" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/sp500' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
          S&P 500
        </RouterLink>
        <RouterLink to="/competitions" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path.startsWith('/competitions') }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Competitions
        </RouterLink>
        <RouterLink to="/messages" class="btn btn-ghost btn-sm justify-start w-full gap-2 relative" :class="{ 'btn-active': route.path === '/messages' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          Messages
          <span v-if="unreadMessages > 0" class="badge badge-xs badge-primary ml-auto">{{ unreadMessages }}</span>
        </RouterLink>
        <RouterLink to="/feed" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/feed' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
          Feed
        </RouterLink>
      </nav>
      <div class="p-3 border-t border-base-300 space-y-1">
        <RouterLink to="/settings" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/settings' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Profile Settings
        </RouterLink>
        <RouterLink v-if="hasActiveClass" to="/team-settings" class="btn btn-ghost btn-sm justify-start w-full gap-2" :class="{ 'btn-active': route.path === '/team-settings' }" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Team Settings
        </RouterLink>
        <button class="btn btn-ghost btn-sm w-full justify-start gap-2" @click="handleLogout">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          Log out
        </button>
      </div>
    </aside>

    <!-- Main content -->
    <div class="flex-1 min-w-0">
      <!-- Mobile header -->
      <div class="lg:hidden sticky top-0 z-20 bg-base-100 border-b border-base-300 px-4 py-2 flex items-center gap-3">
        <button class="btn btn-ghost btn-sm btn-square" @click="sidebarOpen = !sidebarOpen">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <span class="font-bold text-primary text-sm flex-1">Beat the S&P 500</span>
        <button class="btn btn-ghost btn-sm btn-square" @click="handleLogout" title="Log out">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>
      </div>
      <div class="p-4">
        <RouterView />
      </div>
    </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const sidebarOpen = ref(false)
const hasActiveClass = ref(false)
const unreadMessages = ref(0)
const viewingAs = ref(null)

onMounted(async () => {
  // Admin "View as Student" mode
  if (auth.isAdmin && route.query.viewAs) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', route.query.viewAs)
      .maybeSingle()
    if (data) viewingAs.value = data
  }

  const membership = await auth.getCurrentMembership()
  hasActiveClass.value = !!membership?.class_id

  // Load unread message count
  if (auth.currentUser) {
    const { data: msgs } = await supabase.from('messages').select('id')
    const { data: reads } = await supabase.from('message_reads').select('message_id').eq('user_id', auth.currentUser.id)
    const readSet = new Set((reads || []).map(r => r.message_id))
    unreadMessages.value = (msgs || []).filter(m => !readSet.has(m.id)).length
  }
})

async function handleLogout() {
  await auth.logout()
  router.push('/')
}

// iOS Safari fix: refresh session when app returns from background
function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Session expired while backgrounded — redirect to login
        router.push({ name: 'login' })
      }
    })
  }
}

// iOS bfcache fix: force reload if page is restored from cache
function handlePageShow(e) {
  if (e.persisted) {
    // Page was restored from bfcache — iOS freezes JS timers/state
    // Force a clean reload so Vue reactivity works correctly
    window.location.reload()
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('pageshow', handlePageShow)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('pageshow', handlePageShow)
})
</script>
