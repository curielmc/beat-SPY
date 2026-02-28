<template>
  <div class="text-center space-y-6">
    <div class="space-y-2">
      <h1 class="text-3xl font-bold text-primary">Teacher Login</h1>
      <p class="text-base-content/70">Access your class dashboard</p>
    </div>

    <div class="card bg-base-100 shadow-xl">
      <div class="card-body space-y-4">
        <GoogleSignInButton @credential="handleGoogleCredential" />

        <div class="divider text-xs">OR</div>

        <div v-if="error" class="alert alert-error">
          <span>{{ error }}</span>
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Email</span></label>
          <input v-model="email" type="email" class="input input-bordered w-full" placeholder="teacher@school.edu" />
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Password</span></label>
          <input v-model="password" type="password" class="input input-bordered w-full" placeholder="Enter password" @keyup.enter="handleLogin" />
        </div>

        <button class="btn btn-primary btn-block" @click="handleLogin" :disabled="!email || !password">Log In</button>

        <div class="divider text-xs"></div>
        <RouterLink to="/teacher-signup" class="btn btn-outline btn-block btn-sm">Don't have an account? Sign up</RouterLink>
        <RouterLink to="/login" class="btn btn-ghost btn-block btn-sm">Student login instead</RouterLink>
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
</template>

<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import GoogleSignInButton from '../../components/GoogleSignInButton.vue'
import GoogleRoleModal from '../../components/GoogleRoleModal.vue'

const router = useRouter()
const auth = useAuthStore()
const email = ref('')
const password = ref('')
const error = ref('')
const showRoleModal = ref(false)
const googleName = ref('')
const googleEmail = ref('')

function handleLogin() {
  error.value = ''
  const result = auth.teacherLogin(email.value, password.value)
  if (!result) {
    error.value = 'Invalid email or password'
    return
  }
  router.push({ name: 'teacher-dashboard' })
}

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
