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
        <div class="form-control">
          <label class="label"><span class="label-text">Invite Code</span></label>
          <input v-model="inviteCode" type="text" placeholder="Enter your teacher invite code"
            class="input input-bordered w-full font-mono tracking-widest uppercase"
            @input="inviteCode = inviteCode.toUpperCase()" />
          <label class="label"><span class="label-text-alt text-base-content/50">Contact your administrator to get an invite code.</span></label>
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Full Name</span></label>
          <input v-model="name" type="text" placeholder="Your full name" class="input input-bordered w-full" />
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Email</span></label>
          <input v-model="email" type="email" placeholder="teacher@school.edu" class="input input-bordered w-full" />
        </div>
        <div class="form-control">
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
        <button class="btn btn-primary btn-block" :class="{ 'loading': submitting }" :disabled="submitting" @click="handleSubmit">
          Create Account
        </button>
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
        <RouterLink to="/login" class="link link-primary text-sm">Already have an account? Log in</RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useTeacherStore } from '../../stores/teacher'
import { supabase } from '../../lib/supabase'

const router = useRouter()
const auth = useAuthStore()
const teacherStore = useTeacherStore()

const step = ref(1)
const inviteCode = ref('')
const name = ref('')
const email = ref('')
const password = ref('')
const school = ref('')
const className = ref('')
const error = ref('')
const generatedCode = ref('')
const groupMode = ref('student_choice')
const submitting = ref(false)

async function handleSubmit() {
  error.value = ''
  if (!inviteCode.value.trim()) { error.value = 'Invite code is required'; return }
  if (!name.value.trim()) { error.value = 'Name is required'; return }
  if (!email.value.includes('@')) { error.value = 'Enter a valid email'; return }
  if (password.value.length < 6) { error.value = 'Password must be at least 6 characters'; return }
  if (!school.value.trim()) { error.value = 'School name is required'; return }
  if (!className.value.trim()) { error.value = 'Class name is required'; return }

  submitting.value = true

  // 1. Validate invite code before creating account
  const { data: codeCheck, error: codeErr } = await supabase
    .from('teacher_invite_codes')
    .select('id, is_used, expires_at')
    .eq('code', inviteCode.value.toUpperCase())
    .single()

  if (codeErr || !codeCheck) {
    error.value = 'Invalid invite code. Please check with your administrator.'
    submitting.value = false
    return
  }

  if (codeCheck.is_used) {
    error.value = 'This invite code has already been used.'
    submitting.value = false
    return
  }

  if (codeCheck.expires_at && new Date(codeCheck.expires_at) < new Date()) {
    error.value = 'This invite code has expired.'
    submitting.value = false
    return
  }

  // 2. Create the auth account
  const signupResult = await auth.signup({
    email: email.value,
    password: password.value,
    fullName: name.value,
    role: 'teacher'
  })

  if (signupResult.error) {
    error.value = signupResult.error
    submitting.value = false
    return
  }

  // 3. Consume the invite code
  await supabase.rpc('use_teacher_invite_code', {
    invite_code: inviteCode.value.toUpperCase(),
    new_user_id: auth.currentUser.id
  })

  // 4. Create the class
  const code = teacherStore.generateClassCode(className.value)
  const classResult = await teacherStore.createClass({
    code,
    className: className.value,
    school: school.value,
    groupMode: groupMode.value
  })

  if (classResult.error) {
    error.value = classResult.error
    submitting.value = false
    return
  }

  generatedCode.value = code
  submitting.value = false
  step.value = 2
}

function goToDashboard() {
  router.push({ name: 'teacher-dashboard' })
}
</script>
