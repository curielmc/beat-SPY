<template>
  <div class="text-center space-y-8">
    <div class="space-y-2">
      <h1 class="text-4xl font-bold text-primary">Beat the S&P</h1>
      <p class="text-base-content/70">Build a portfolio. Compete with your class. Outperform the market.</p>
    </div>

    <div class="card bg-base-100 shadow-xl">
      <div class="card-body space-y-4">
        <div class="stats stats-vertical bg-base-200 rounded-xl">
          <div class="stat">
            <div class="stat-title">S&P 500 Benchmark</div>
            <div class="stat-value text-success">Can you beat it?</div>
            <div class="stat-desc">Track your performance against SPY in real-time</div>
          </div>
        </div>

        <button class="btn btn-outline btn-block gap-2" @click="signInWithGoogle">
          <svg class="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Sign in with Google
        </button>

        <button class="btn btn-outline btn-block gap-2" @click="signInWithApple">
          <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
          Sign in with Apple
        </button>

        <div class="divider text-xs">OR</div>

        <!-- Email/Password Sign Up -->
        <div class="space-y-3">
          <div class="form-control">
            <input v-model="email" type="email" placeholder="Email" class="input input-bordered w-full" />
          </div>
          <div class="form-control">
            <input v-model="password" type="password" placeholder="Password" class="input input-bordered w-full" @keyup.enter="signUpWithEmail" />
          </div>
          <p v-if="emailError" class="text-error text-sm">{{ emailError }}</p>
          <button class="btn btn-primary btn-block" :class="{ 'loading': submitting }" :disabled="submitting" @click="signUpWithEmail">Sign Up with Email</button>
        </div>

        <RouterLink to="/signup" class="btn btn-outline btn-block btn-sm">Have a Class Code?</RouterLink>
        <RouterLink to="/login" class="btn btn-ghost btn-block btn-sm">Already have an account? Log In</RouterLink>

        <div class="divider text-xs">TEACHERS</div>
        <RouterLink to="/teacher-signup" class="btn btn-outline btn-sm btn-block">Teacher Sign Up</RouterLink>

        <div class="divider text-xs">EXPLORE</div>
        <RouterLink to="/explore" class="btn btn-ghost btn-sm btn-block gap-2">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h18v18H3V3zm3 12l4-4 3 3 5-5" /></svg>
          View Public Leaderboard
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const emailError = ref('')
const submitting = ref(false)

async function signInWithGoogle() {
  const result = await auth.signInWithOAuth('google')
  if (result.error) {
    console.error('Google sign-in error:', result.error)
  }
}

async function signInWithApple() {
  const result = await auth.signInWithOAuth('apple')
  if (result.error) {
    console.error('Apple sign-in error:', result.error)
  }
}

async function signUpWithEmail() {
  emailError.value = ''
  if (!email.value.includes('@')) { emailError.value = 'Enter a valid email'; return }
  if (password.value.length < 6) { emailError.value = 'Password must be at least 6 characters'; return }

  submitting.value = true
  const result = await auth.signup({
    email: email.value,
    password: password.value,
    fullName: email.value.split('@')[0],
    role: 'student'
  })

  if (result.error) {
    emailError.value = result.error
    submitting.value = false
    return
  }

  submitting.value = false
  router.push('/home')
}
</script>
