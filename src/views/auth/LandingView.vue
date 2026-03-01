<template>
  <div class="text-center space-y-6">

    <!-- Hero -->
    <div class="space-y-2">
      <h1 class="text-4xl font-bold text-primary">Beat the S&P</h1>
      <p class="text-base-content/60 text-sm">Build a portfolio. Compete with your class. Outperform the market.</p>
    </div>

    <!-- Primary card: sign-up actions -->
    <div class="card bg-base-100 shadow-lg">
      <div class="card-body gap-3 p-6">

        <!-- Email sign-up -->
        <div class="form-control">
          <input v-model="email" type="email" placeholder="Email" class="input input-bordered w-full" />
        </div>
        <div class="form-control">
          <input v-model="password" type="password" placeholder="Password" class="input input-bordered w-full" @keyup.enter="signUpWithEmail" />
        </div>
        <p v-if="emailError" class="text-error text-sm text-left -mt-1">{{ emailError }}</p>
        <button
          class="btn btn-primary btn-block"
          :class="{ 'loading': submitting }"
          :disabled="submitting"
          @click="signUpWithEmail"
        >
          Create Account
        </button>

        <!-- Divider -->
        <div class="divider my-0 text-xs text-base-content/40">or</div>

        <!-- Secondary sign-in options -->
        <button class="btn btn-outline btn-block gap-2" @click="signInWithGoogle">
          <svg class="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>

        <RouterLink to="/signup" class="btn btn-outline btn-block btn-sm">
          Join with a Class Code
        </RouterLink>

      </div>
    </div>

    <!-- Already have an account -->
    <p class="text-sm text-base-content/50">
      Already have an account?
      <RouterLink to="/login" class="text-base-content/80 hover:text-base-content underline underline-offset-2 transition-colors">
        Log in
      </RouterLink>
    </p>

    <!-- Tertiary links: teachers + explore -->
    <div class="flex items-center justify-center gap-6 text-xs text-base-content/40">
      <RouterLink to="/teacher-signup" class="hover:text-base-content/70 transition-colors">
        Teacher Sign Up
      </RouterLink>
      <span class="w-px h-3 bg-base-content/20"></span>
      <RouterLink to="/explore" class="hover:text-base-content/70 transition-colors">
        View Leaderboard
      </RouterLink>
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
