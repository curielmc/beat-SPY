<template>
  <!-- Masquerade banner -->
  <div v-if="auth.isMasquerading" class="sticky top-0 z-50 flex flex-col gap-2 bg-warning px-3 py-2 text-sm font-medium text-warning-content sm:flex-row sm:items-center sm:justify-between sm:px-4">
    <div class="flex min-w-0 items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
      <span class="min-w-0 truncate">Viewing as <strong class="ml-1">{{ auth.profile?.full_name || auth.masqueradeUser?.email }}</strong></span>
    </div>
    <button class="btn btn-xs btn-warning border border-warning-content/30 self-start sm:self-auto" @click="exitMasquerade">✕ Exit</button>
  </div>
  <div class="min-h-screen bg-base-200 flex flex-col">
    <!-- Admin preview banner -->
    <div v-if="viewingAs" class="shrink-0 bg-error px-3 py-2 text-sm font-semibold text-error-content sm:px-4">
      <div class="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-3">
      <span class="min-w-0 truncate">Viewing as {{ viewingAs.full_name }} ({{ viewingAs.email }})</span>
      <RouterLink to="/admin/users" class="btn btn-xs btn-ghost bg-error-content/20 hover:bg-error-content/30">Back to Admin</RouterLink>
      </div>
    </div>

    <div class="flex flex-1 min-h-0">
    <!-- Mobile overlay -->
    <div v-if="sidebarOpen" class="fixed inset-0 bg-black/40 z-30 lg:hidden" @click="sidebarOpen = false"></div>

    <!-- Sidebar -->
    <aside class="fixed left-0 top-0 z-40 flex h-dvh max-h-dvh w-56 flex-col border-r border-base-300 bg-base-100 transition-transform lg:sticky lg:translate-x-0" :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'">
      <div class="p-4 border-b border-base-300 flex items-start justify-between">
        <div class="flex flex-col gap-3">
          <LogoIcon size="sm" />
          <div>
            <h1 class="text-sm font-bold text-primary">Beat the S&P 500</h1>
            <p class="text-[10px] uppercase tracking-wider text-base-content/40 font-semibold">{{ auth.isMasquerading ? 'Masquerading' : (auth.profile?.role || 'User') }}</p>
          </div>
        </div>
        <button class="btn btn-ghost btn-xs btn-square hidden lg:flex" @click="handleLogout" title="Log out">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>
      </div>
      <nav class="flex-1 p-3 space-y-1">
        <!-- Admin Access Link -->
        <RouterLink v-if="auth.isAdmin" to="/admin" class="btn btn-error btn-sm justify-start w-full gap-2 mb-4" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Admin Dashboard
        </RouterLink>

        <RouterLink to="/leaderboard" class="btn btn-sm justify-start w-full gap-2" :class="route.path === '/leaderboard' ? 'btn-primary' : 'btn-ghost'" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          Leaderboard
        </RouterLink>
        <RouterLink to="/home" class="btn btn-sm justify-start w-full gap-2" :class="route.path === '/home' ? 'btn-primary' : 'btn-ghost'" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" /></svg>
          My Investments
        </RouterLink>
        <RouterLink to="/my-funds" class="btn btn-sm justify-start w-full gap-2" :class="route.path === '/my-funds' ? 'btn-primary' : 'btn-ghost'" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          Group Funds
        </RouterLink>
        <RouterLink to="/stocks" class="btn btn-sm justify-start w-full gap-2" :class="route.path === '/stocks' || route.path.startsWith('/stocks/') ? 'btn-primary' : 'btn-ghost'" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          Investment Screener
        </RouterLink>
        <RouterLink to="/sp500" class="btn btn-sm justify-start w-full gap-2" :class="route.path === '/sp500' ? 'btn-primary' : 'btn-ghost'" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
          S&P 500
        </RouterLink>
        <RouterLink to="/messages" class="btn btn-sm justify-start w-full gap-2 relative" :class="route.path === '/messages' ? 'btn-primary' : 'btn-ghost'" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          Messages
          <span v-if="unreadMessages > 0" class="badge badge-xs badge-primary ml-auto">{{ unreadMessages }}</span>
        </RouterLink>
      </nav>
      <div class="p-3 border-t border-base-300 space-y-1">
        <RouterLink to="/settings" class="btn btn-sm justify-start w-full gap-2" :class="route.path === '/settings' ? 'btn-primary' : 'btn-ghost'" @click="sidebarOpen = false">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Profile Settings
        </RouterLink>
        <RouterLink v-if="hasActiveClass" to="/team-settings" class="btn btn-sm justify-start w-full gap-2" :class="route.path === '/team-settings' ? 'btn-primary' : 'btn-ghost'" @click="sidebarOpen = false">
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
        <LogoIcon size="sm" />
        <span class="font-bold text-primary text-sm flex-1">Beat the S&P 500</span>
        <button class="btn btn-ghost btn-sm btn-square" @click="handleLogout" title="Log out">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>
      </div>
      <div class="p-3 sm:p-4">
        <RouterView />
      </div>
    </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'
import LogoIcon from '../components/LogoIcon.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// Redirect if logged out while on protected route
watch(() => auth.isLoggedIn, (loggedIn) => {
  if (!loggedIn) {
    console.log('[AppLayout] User logged out, redirecting to login...')
    router.push('/')
  }
})
const sidebarOpen = ref(false)
const hasActiveClass = ref(false)
const unreadMessages = ref(0)
const viewingAs = ref(null)

onMounted(async () => {
  console.log('[AppLayout] mounted. User:', auth.currentUser?.email, 'Role:', auth.profile?.role, 'isAdmin:', auth.isAdmin)
  
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
    const membership = await auth.getCurrentMembership()
    const classId = membership?.class_id
    const groupId = membership?.group_id
    
    // Guard against user being signed out during the await above
    if (auth.currentUser) {
      const userId = auth.currentUser.id

      if (classId) {
        // Fetch messages relevant to this user's class context
        const { data: msgs } = await supabase.from('messages')
          .select('id, recipient_type, recipient_id, sender_id')
          .eq('class_id', classId)

        // Filter messages intended for this specific user/group/class
        const myMsgs = (msgs || []).filter(m => 
          (m.recipient_type === 'class') ||
          (m.recipient_type === 'group' && m.recipient_id === groupId) ||
          (m.recipient_type === 'user' && m.recipient_id === userId) ||
          (m.sender_id === userId) // Messages I sent
        )

        const { data: reads } = await supabase.from('message_reads')
          .select('message_id')
          .eq('user_id', userId)
        
        const readSet = new Set((reads || []).map(r => r.message_id))
        
        // Count as unread if not in readSet AND I am not the sender
        unreadMessages.value = myMsgs.filter(m => 
          !readSet.has(m.id) && m.sender_id !== userId
        ).length
      }
    }
  }
})

async function handleLogout() {
  await auth.logout()
  router.push('/')
}

async function exitMasquerade() {
  await auth.stopMasquerade()
  router.push({ name: 'admin-users' })
}

// iOS Safari fix: refresh session when app returns from background
let visibilityCheckInFlight = false
async function handleVisibilityChange() {
  if (document.visibilityState !== 'visible' || visibilityCheckInFlight) return

  visibilityCheckInFlight = true
  try {
    console.log('[AUTH] visibilitychange: visible, checking session...')
    const { data: { session } } = await supabase.auth.getSession()
    console.log('[AUTH] visibilitychange: getSession =', !!session)
    if (session) return

    // Wait and retry — don't force logout on transient null
    await new Promise(r => setTimeout(r, 1500))
    const { data: { session: retrySession } } = await supabase.auth.getSession()
    console.log('[AUTH] visibilitychange: retry getSession =', !!retrySession)
    if (retrySession) return

    // Last resort — try refresh
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
    console.log('[AUTH] visibilitychange: refreshSession =', !!refreshed?.session, 'error:', refreshErr?.message)
    if (!refreshed?.session && auth.isLoggedIn) {
      console.log('[AUTH] visibilitychange: LOGGING OUT — no session recovered')
      await auth.logout()
      router.push({ name: 'login' })
    }
  } finally {
    visibilityCheckInFlight = false
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
