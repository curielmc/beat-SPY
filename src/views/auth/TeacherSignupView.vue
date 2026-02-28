<template>
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title justify-center text-2xl mb-2">Teacher Sign Up</h2>

      <!-- Step indicator -->
      <ul class="steps steps-horizontal w-full mb-6">
        <li class="step" :class="{ 'step-primary': step >= 1 }">Your Info</li>
        <li class="step" :class="{ 'step-primary': step >= 2 }">Class Code</li>
      </ul>

      <!-- Step 1: Teacher Info -->
      <div v-if="step === 1" class="space-y-4">
        <GoogleSignInButton v-if="!isGoogleFlow" @credential="handleGoogleCredential" />
        <div v-if="!isGoogleFlow" class="divider text-xs">OR</div>

        <div class="form-control">
          <label class="label"><span class="label-text">Full Name</span></label>
          <input v-model="name" type="text" placeholder="Your full name" class="input input-bordered w-full" :disabled="isGoogleFlow" />
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Email</span></label>
          <input v-model="email" type="email" placeholder="teacher@school.edu" class="input input-bordered w-full" :disabled="isGoogleFlow" />
        </div>
        <div v-if="!isGoogleFlow" class="form-control">
          <label class="label"><span class="label-text">Password</span></label>
          <input v-model="password" type="password" placeholder="Min 6 characters" class="input input-bordered w-full" />
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">School Name</span></label>
          <input v-model="school" type="text" placeholder="Your school" class="input input-bordered w-full" />
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Class Name</span></label>
          <input v-model="className" type="text" placeholder="e.g. Economics 101" class="input input-bordered w-full" />
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">How should students join groups?</span></label>
          <div class="flex flex-col gap-2">
            <label class="label cursor-pointer justify-start gap-3">
              <input type="radio" v-model="groupMode" value="student_choice" class="radio radio-sm radio-primary" />
              <span class="label-text">Students choose their own group</span>
            </label>
            <label class="label cursor-pointer justify-start gap-3">
              <input type="radio" v-model="groupMode" value="teacher_assign" class="radio radio-sm radio-primary" />
              <span class="label-text">I will assign students to groups</span>
            </label>
          </div>
        </div>

        <p v-if="error" class="text-error text-sm">{{ error }}</p>
        <button class="btn btn-primary btn-block" @click="handleSubmit">Create Account</button>
      </div>

      <!-- Step 2: Show Generated Code -->
      <div v-if="step === 2" class="space-y-4 text-center">
        <div class="alert alert-success">
          <span>Account created successfully!</span>
        </div>

        <p class="text-base-content/70">Share this class code with your students so they can join:</p>

        <div class="bg-base-200 rounded-xl p-6">
          <p class="text-4xl font-mono font-bold tracking-wider text-primary">{{ generatedCode }}</p>
        </div>

        <p class="text-sm text-base-content/50">You can also find this code in your Classes page.</p>

        <button class="btn btn-primary btn-block" @click="goToDashboard">Go to Dashboard</button>
      </div>

      <div class="text-center mt-4">
        <RouterLink to="/teacher-login" class="link link-primary text-sm">Already have an account? Log in</RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import GoogleSignInButton from '../../components/GoogleSignInButton.vue'

const router = useRouter()
const auth = useAuthStore()

const step = ref(1)
const name = ref('')
const email = ref('')
const password = ref('')
const school = ref('')
const className = ref('')
const error = ref('')
const generatedCode = ref('')
const groupMode = ref('student_choice')
const isGoogleFlow = ref(false)

// Pre-fill from pending Google data if redirected from role modal
if (auth.pendingGoogleData) {
  name.value = auth.pendingGoogleData.name
  email.value = auth.pendingGoogleData.email
  isGoogleFlow.value = true
}

function handleGoogleCredential(credential) {
  const result = auth.googleLogin(credential)
  if (result.status === 'logged_in') {
    router.push(result.userType === 'teacher' ? '/teacher' : '/home')
    return
  }
  if (result.status === 'new_user') {
    name.value = result.name
    email.value = result.email
    isGoogleFlow.value = true
  }
}

function handleSubmit() {
  error.value = ''
  if (!name.value.trim()) { error.value = 'Name is required'; return }
  if (!email.value.includes('@')) { error.value = 'Enter a valid email'; return }
  if (!isGoogleFlow.value && password.value.length < 6) { error.value = 'Password must be at least 6 characters'; return }
  if (!school.value.trim()) { error.value = 'School name is required'; return }
  if (!className.value.trim()) { error.value = 'Class name is required'; return }

  let result
  if (isGoogleFlow.value) {
    result = auth.googleSignupTeacher({ school: school.value, className: className.value })
  } else {
    result = auth.teacherSignup({
      name: name.value,
      email: email.value,
      password: password.value,
      school: school.value,
      className: className.value,
      groupMode: groupMode.value
    })
  }

  if (result) {
    generatedCode.value = result.generatedCode || result.code
    step.value = 2
  }
}

function goToDashboard() {
  router.push({ name: 'teacher-dashboard' })
}
</script>
