import { createRouter, createWebHistory } from 'vue-router'

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
        { path: 'teacher-login', name: 'teacher-login', component: () => import('../views/auth/TeacherLoginView.vue') },
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
        { path: 'stocks/:ticker', name: 'stock-detail', component: () => import('../views/app/StockDetailView.vue') }
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
    }
  ]
})

router.beforeEach((to) => {
  const stored = localStorage.getItem('beatspy_user')
  const user = stored ? JSON.parse(stored) : null
  const isLoggedIn = !!user
  const userType = user?.userType || 'student'

  if (to.matched.some(r => r.meta.requiresAuth) && !isLoggedIn) {
    return { name: 'landing' }
  }

  if (to.matched.some(r => r.meta.role === 'teacher') && userType !== 'teacher') {
    return { name: 'home' }
  }

  if (to.matched.some(r => r.meta.role === 'student') && userType === 'teacher') {
    return { name: 'teacher-dashboard' }
  }

  const authPages = ['landing', 'login', 'signup', 'teacher-login', 'teacher-signup']
  if (authPages.includes(to.name) && isLoggedIn) {
    return userType === 'teacher' ? { name: 'teacher-dashboard' } : { name: 'home' }
  }
})

export default router
