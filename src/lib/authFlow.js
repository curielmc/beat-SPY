export function getRouteForRole(role) {
  if (role === 'admin') return '/admin'
  if (role === 'teacher') return '/teacher'
  return '/leaderboard'
}

export function validateCredentials(email, password, { allowShortPassword = false } = {}) {
  if (!email?.includes('@')) return 'Enter a valid email'
  if (!password) return 'Enter your password'
  if (!allowShortPassword && password.length < 6) return 'Password must be at least 6 characters'
  return ''
}
