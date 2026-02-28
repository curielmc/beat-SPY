<template>
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title justify-center text-2xl mb-4">Log In</h2>

      <div class="space-y-4">
        <GoogleSignInButton @credential="handleGoogleCredential" />

        <div class="divider text-xs">OR</div>

        <div class="form-control">
          <label class="label"><span class="label-text">Email</span></label>
          <input v-model="email" type="email" placeholder="you@school.edu" class="input input-bordered w-full" @keyup.enter="handleLogin" />
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Password</span></label>
          <input v-model="password" type="password" placeholder="Your password" class="input input-bordered w-full" @keyup.enter="handleLogin" />
        </div>

        <p v-if="error" class="text-error text-sm">Invalid email or password.</p>

        <button class="btn btn-primary btn-block" @click="handleLogin">Log In</button>
      </div>

      <div class="text-center mt-4">
        <RouterLink to="/signup" class="link link-primary text-sm">Don't have an account? Sign up</RouterLink>
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
const error = ref(false)
const showRoleModal = ref(false)
const googleName = ref('')
const googleEmail = ref('')

function handleLogin() {
  const user = auth.login(email.value, password.value)
  if (user) {
    router.push('/home')
  } else {
    error.value = true
  }
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
