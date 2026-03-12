import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('../layouts/AuthLayout.vue'),
      children: [
        { path: '', name: 'login', component: () => import('../views/auth/LoginView.vue') },
        { path: 'login', redirect: { name: 'login' } },
        { path: 'signup', name: 'signup', component: () => import('../views/auth/SignupView.vue') },
        { path: 'teacher-signup', name: 'teacher-signup', component: () => import('../views/auth/TeacherSignupView.vue') }
      ]
    },
    {
      path: '/',
      component: () => import('../layouts/AppLayout.vue'),
      meta: { requiresAuth: true, role: 'student' },
      children: [
        { path: '', redirect: { name: 'leaderboard' } },
        { path: 'home', name: 'home', component: () => import('../views/app/HomeView.vue') },
        { path: 'attribution', name: 'attribution', component: () => import('../views/app/AttributionView.vue'), meta: { requiresAuth: true } },
      { path: 'leaderboard', name: 'leaderboard', component: () => import('../views/app/LeaderboardView.vue') },
        { path: 'stocks', name: 'stocks', component: () => import('../views/app/StocksView.vue') },
        { path: 'screener', name: 'screener', component: () => import('../views/app/AdvancedScreenerView.vue') },
        { path: 'stocks/:ticker', name: 'stock-detail', component: () => import('../views/app/StockDetailView.vue') },
        { path: 'feed', name: 'feed', component: () => import('../views/app/FeedView.vue') },
        { path: 'competitions', name: 'competitions', component: () => import('../views/app/CompetitionsView.vue') },
        { path: 'competitions/:id', name: 'competition-detail', component: () => import('../views/app/CompetitionDetailView.vue') },
        { path: 'join', name: 'join-class', component: () => import('../views/app/JoinClassView.vue') },
        { path: 'active-class', name: 'active-class', component: () => import('../views/app/ActiveClassView.vue') },
        { path: 'my-funds', name: 'my-funds', component: () => import('../views/app/MyFundsView.vue') },
        { path: 'portfolio-history', name: 'portfolio-history', component: () => import('../views/app/PortfolioHistoryView.vue') },
        { path: 'sp500', name: 'sp500', component: () => import('../views/app/SP500View.vue') },
        { path: 'messages', name: 'student-messages', component: () => import('../views/app/MessagesView.vue') },
        { path: 'training', name: 'training', component: () => import('../views/app/TrainingView.vue') },
        { path: 'training/:slug', name: 'training-detail', component: () => import('../views/app/TrainingCourseView.vue') },
        { path: 'training/:slug/:moduleSlug', name: 'training-module', component: () => import('../views/app/TrainingModuleView.vue') },
        { path: 'settings', name: 'profile-settings', component: () => import('../views/app/ProfileSettingsView.vue') },
        { path: 'team-settings', name: 'team-settings', component: () => import('../views/app/TeamSettingsView.vue') }
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
        { path: 'fund-analytics', name: 'teacher-fund-analytics', component: () => import('../views/teacher/FundAnalyticsView.vue') },
        { path: 'tutorials', name: 'teacher-tutorials', component: () => import('../views/teacher/TrainingManageView.vue') },
        { path: 'messages', name: 'teacher-messages', component: () => import('../views/teacher/MessagesView.vue') },
        { path: 'stocks/:ticker', name: 'teacher-stock-detail', component: () => import('../views/app/StockDetailView.vue') },
        { path: 'portfolio', name: 'teacher-portfolio', component: () => import('../views/app/HomeView.vue') },
        { path: 'stocks', name: 'teacher-stocks', component: () => import('../views/app/StocksView.vue') },
        { path: 'screener', name: 'teacher-screener', component: () => import('../views/app/AdvancedScreenerView.vue') }
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
      path: '/terms',
      name: 'terms',
      component: () => import('../views/public/TermsView.vue')
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
        { path: 'competitions', name: 'admin-competitions', component: () => import('../views/admin/CompetitionsAdminView.vue') },
        { path: 'tutorials', name: 'admin-tutorials', component: () => import('../views/admin/TutorialsAdminView.vue') },
        { path: 'tutorials/new', name: 'admin-tutorial-new', component: () => import('../views/admin/TutorialEditorView.vue') },
        { path: 'tutorials/edit/:id', name: 'admin-tutorial-edit', component: () => import('../views/admin/TutorialEditorView.vue') },
        { path: 'trades', name: 'admin-trades', component: () => import('../views/admin/TradesView.vue') },
        { path: 'portfolio', name: 'admin-portfolio', component: () => import('../views/app/HomeView.vue') }
      ]
    }
  ]
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Wait for auth to initialize before making routing decisions
  if (!auth.initialized) {
    await auth.init()
  }

  const isLoggedIn = auth.isLoggedIn
  const userRole = auth.userType

  // Redirect unauthenticated users away from protected routes
  if (to.matched.some(r => r.meta.requiresAuth) && !isLoggedIn) {
    return { name: 'login' }
  }

  // Role-based access control
  if (to.matched.some(r => r.meta.role === 'admin') && userRole !== 'admin') {
    if (userRole === 'teacher') return { name: 'teacher-dashboard' }
    return { name: 'leaderboard' }
  }

  if (to.matched.some(r => r.meta.role === 'teacher') && userRole !== 'teacher' && userRole !== 'admin') {
    return { name: 'leaderboard' }
  }

  if (to.matched.some(r => r.meta.role === 'student') && userRole === 'teacher') {
    return { name: 'teacher-dashboard' }
  }

  // Admins can access student routes (for viewing student experience)
  // if (to.matched.some(r => r.meta.role === 'student') && userRole === 'admin') {
  //   return { name: 'admin-dashboard' }
  // }

  // Redirect logged-in users away from auth pages
  const authPages = ['login', 'signup', 'teacher-signup']
  if (authPages.includes(to.name) && isLoggedIn) {
    if (userRole === 'admin') return { name: 'admin-dashboard' }
    if (userRole === 'teacher') return { name: 'teacher-dashboard' }
    return { name: 'leaderboard' }
  }
})

export default router
