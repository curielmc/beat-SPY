import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../lib/supabase'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('../layouts/AuthLayout.vue'),
      children: [
        { path: '', name: 'landing', component: () => import('../views/auth/LandingView.vue') },
        { path: 'signup', name: 'signup', component: () => import('../views/auth/SignupView.vue') },
        { path: 'login', name: 'login', component: () => import('../views/auth/LoginView.vue') },
        { path: 'teacher-signup', name: 'teacher-signup', component: () => import('../views/auth/TeacherSignupView.vue') }
      ]
    },
    {
      path: '/',
      component: () => import('../layouts/AppLayout.vue'),
      meta: { requiresAuth: true, role: 'student' },
      children: [
        { path: 'home', name: 'home', component: () => import('../views/app/HomeView.vue') },
        { path: 'leaderboard', name: 'leaderboard', component: () => import('../views/app/LeaderboardView.vue') },
        { path: 'stocks', name: 'stocks', component: () => import('../views/app/StocksView.vue') },
        { path: 'stocks/:ticker', name: 'stock-detail', component: () => import('../views/app/StockDetailView.vue') },
        { path: 'feed', name: 'feed', component: () => import('../views/app/FeedView.vue') },
        { path: 'competitions', name: 'competitions', component: () => import('../views/app/CompetitionsView.vue') },
        { path: 'competitions/:id', name: 'competition-detail', component: () => import('../views/app/CompetitionDetailView.vue') },
        { path: 'join', name: 'join-class', component: () => import('../views/app/JoinClassView.vue') },
        { path: 'settings', name: 'profile-settings', component: () => import('../views/app/ProfileSettingsView.vue') }
      ]
    },
    {
      path: '/teacher',
      component: () => import('../layouts/TeacherLayout.vue'),
      meta: { requiresAuth: true, role: 'teacher' },
      children: [
        { path: '', name: 'teacher-dashboard', component: () => import('../views/teacher/DashboardView.vue') },
        { path: 'students', name: 'teacher-students', component: () => import('../views/teacher/StudentsView.vue') },
        { path: 'restrictions', name: 'teacher-restrictions', component: () => import('../views/teacher/RestrictionsView.vue') },
        { path: 'classes', name: 'teacher-classes', component: () => import('../views/teacher/ClassesView.vue') },
        { path: 'stocks/:ticker', name: 'teacher-stock-detail', component: () => import('../views/app/StockDetailView.vue') }
      ]
    },
    {
      path: '/explore',
      name: 'public-leaderboard',
      component: () => import('../views/public/PublicLeaderboardView.vue')
    },
    {
      path: '/u/:username',
      name: 'public-profile',
      component: () => import('../views/public/PublicProfileView.vue')
    },
    {
      path: '/admin',
      component: () => import('../layouts/AdminLayout.vue'),
      meta: { requiresAuth: true, role: 'admin' },
      children: [
        { path: '', name: 'admin-dashboard', component: () => import('../views/admin/AdminDashboardView.vue') },
        { path: 'users', name: 'admin-users', component: () => import('../views/admin/UsersView.vue') },
        { path: 'classes', name: 'admin-classes', component: () => import('../views/admin/ClassesView.vue') },
        { path: 'portfolios', name: 'admin-portfolios', component: () => import('../views/admin/PortfoliosView.vue') },
        { path: 'settings', name: 'admin-settings', component: () => import('../views/admin/SettingsView.vue') },
        { path: 'competitions', name: 'admin-competitions', component: () => import('../views/admin/CompetitionsAdminView.vue') }
      ]
    }
  ]
})

router.beforeEach(async (to) => {
  const { data: { session } } = await supabase.auth.getSession()
  const isLoggedIn = !!session?.user
  let userRole = null

  if (isLoggedIn) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()
    userRole = profile?.role || 'student'
  }

  // Redirect unauthenticated users away from protected routes
  if (to.matched.some(r => r.meta.requiresAuth) && !isLoggedIn) {
    return { name: 'landing' }
  }

  // Role-based access control
  if (to.matched.some(r => r.meta.role === 'admin') && userRole !== 'admin') {
    if (userRole === 'teacher') return { name: 'teacher-dashboard' }
    return { name: 'home' }
  }

  if (to.matched.some(r => r.meta.role === 'teacher') && userRole !== 'teacher' && userRole !== 'admin') {
    return { name: 'home' }
  }

  if (to.matched.some(r => r.meta.role === 'student') && userRole === 'teacher') {
    return { name: 'teacher-dashboard' }
  }

  if (to.matched.some(r => r.meta.role === 'student') && userRole === 'admin') {
    return { name: 'admin-dashboard' }
  }

  // Redirect logged-in users away from auth pages
  const authPages = ['landing', 'login', 'signup', 'teacher-signup']
  if (authPages.includes(to.name) && isLoggedIn) {
    if (userRole === 'admin') return { name: 'admin-dashboard' }
    if (userRole === 'teacher') return { name: 'teacher-dashboard' }
    return { name: 'home' }
  }
})

export default router
