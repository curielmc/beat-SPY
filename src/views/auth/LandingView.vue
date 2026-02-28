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
            <div class="stat-title">S&P 500 YTD Return</div>
            <div class="stat-value text-success">+8.42%</div>
            <div class="stat-desc">Can you beat it?</div>
          </div>
        </div>

        <GoogleSignInButton @credential="handleGoogleCredential" />

        <div class="divider text-xs">OR</div>

        <RouterLink to="/signup" class="btn btn-primary btn-block">Sign Up with Class Code</RouterLink>
        <RouterLink to="/login" class="btn btn-ghost btn-block">Log In</RouterLink>

        <div class="divider text-xs">TEACHERS</div>
        <div class="flex gap-2">
          <RouterLink to="/teacher-login" class="btn btn-outline btn-sm flex-1">Teacher Login</RouterLink>
          <RouterLink to="/teacher-signup" class="btn btn-outline btn-sm flex-1">Teacher Sign Up</RouterLink>
        </div>
      </div>
    </div>

    <GoogleRoleModal
      :show="showRoleModal"
      :name="googleName"
      :email="googleEmail"
      @select="handleRoleSelect"
      @close="showRoleModal = false"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import GoogleSignInButton from '../../components/GoogleSignInButton.vue'
import GoogleRoleModal from '../../components/GoogleRoleModal.vue'

const router = useRouter()
const auth = useAuthStore()

const showRoleModal = ref(false)
const googleName = ref('')
const googleEmail = ref('')

function handleGoogleCredential(credential) {
  const result = auth.googleLogin(credential)
  if (result.status === 'logged_in') {
    router.push(result.userType === 'teacher' ? '/teacher' : '/home')
  } else if (result.status === 'new_user') {
    googleName.value = result.name
    googleEmail.value = result.email
    showRoleModal.value = true
  }
}

function handleRoleSelect(role) {
  showRoleModal.value = false
  if (role === 'student') {
    router.push('/signup')
  } else {
    router.push('/teacher-signup')
  }
}
</script>
