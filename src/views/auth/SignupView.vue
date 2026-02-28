<template>
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title justify-center text-2xl mb-2">Sign Up</h2>

      <!-- Step indicator -->
      <ul class="steps steps-horizontal w-full mb-6">
        <li class="step" :class="{ 'step-primary': step >= 1 }">Class Code</li>
        <li class="step" :class="{ 'step-primary': step >= 2 }">Your Info</li>
        <li class="step" :class="{ 'step-primary': step >= 3 }">Group</li>
      </ul>

      <!-- Step 1: Teacher Code -->
      <div v-if="step === 1" class="space-y-4">
        <GoogleSignInButton v-if="!isGoogleFlow" @credential="handleGoogleCredential" />
        <div v-if="!isGoogleFlow" class="divider text-xs">OR</div>

        <div class="form-control">
          <label class="label"><span class="label-text">Enter your class code</span></label>
          <input v-model="teacherCode" type="text" placeholder="e.g. ECON2025" class="input input-bordered w-full uppercase" @keyup.enter="validateCode" />
        </div>
        <p v-if="codeError" class="text-error text-sm">Invalid code. Please check with your teacher.</p>
        <p v-if="validTeacher" class="text-success text-sm">{{ validTeacher.className }} - {{ validTeacher.teacherName }}, {{ validTeacher.school }}</p>
        <button class="btn btn-primary btn-block" :disabled="!validTeacher" @click="step = isGoogleFlow ? 3 : 2">Continue</button>
      </div>

      <!-- Step 2: Student Info -->
      <div v-if="step === 2" class="space-y-4">
        <div class="form-control">
          <label class="label"><span class="label-text">Full Name</span></label>
          <input v-model="name" type="text" placeholder="Your full name" class="input input-bordered w-full" />
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Email</span></label>
          <input v-model="email" type="email" placeholder="you@school.edu" class="input input-bordered w-full" />
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Password</span></label>
          <input v-model="password" type="password" placeholder="Min 6 characters" class="input input-bordered w-full" />
        </div>
        <p v-if="infoError" class="text-error text-sm">{{ infoError }}</p>
        <div class="flex gap-2">
          <button class="btn btn-ghost flex-1" @click="step = 1">Back</button>
          <button class="btn btn-primary flex-1" @click="validateInfo">Continue</button>
        </div>
      </div>

      <!-- Step 3: Group -->
      <div v-if="step === 3" class="space-y-4">
        <!-- Teacher assigns groups -->
        <template v-if="validTeacher?.groupMode === 'teacher_assign'">
          <div class="alert alert-info">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>Your teacher will assign you to a group. You can start exploring stocks while you wait!</span>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-ghost flex-1" @click="step = isGoogleFlow ? 1 : 2">Back</button>
            <button class="btn btn-primary flex-1" @click="completeSignup">Create Account</button>
          </div>
        </template>

        <!-- Students choose groups -->
        <template v-else>
          <p class="text-sm text-base-content/70">Join an existing group or create a new one. Groups have up to 3 members.</p>

          <div v-for="group in availableGroups" :key="group.id" class="card bg-base-200 cursor-pointer hover:bg-base-300 transition-colors" :class="{ 'ring-2 ring-primary': selectedGroupId === group.id }" @click="selectedGroupId = group.id; newGroupName = ''">
            <div class="card-body p-4">
              <div class="flex justify-between items-center">
                <span class="font-semibold">{{ group.name }}</span>
                <span class="badge" :class="group.memberIds.length < 3 ? 'badge-success' : 'badge-error'">{{ group.memberIds.length }}/3</span>
              </div>
              <p class="text-sm text-base-content/60">{{ getMemberNames(group) }}</p>
            </div>
          </div>

          <div class="divider">OR</div>

          <div class="form-control">
            <label class="label"><span class="label-text">Create a new group</span></label>
            <input v-model="newGroupName" type="text" placeholder="Group name" class="input input-bordered w-full" @focus="selectedGroupId = null" />
          </div>

          <p v-if="groupError" class="text-error text-sm">{{ groupError }}</p>
          <div class="flex gap-2">
            <button class="btn btn-ghost flex-1" @click="step = isGoogleFlow ? 1 : 2">Back</button>
            <button class="btn btn-primary flex-1" :disabled="!selectedGroupId && !newGroupName" @click="completeSignup">Create Account</button>
          </div>
        </template>
      </div>

      <div class="text-center mt-4">
        <RouterLink to="/login" class="link link-primary text-sm">Already have an account? Log in</RouterLink>
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
import { ref, computed, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import GoogleSignInButton from '../../components/GoogleSignInButton.vue'
import GoogleRoleModal from '../../components/GoogleRoleModal.vue'

const router = useRouter()
const auth = useAuthStore()

const step = ref(1)
const teacherCode = ref('')
const validTeacher = ref(null)
const codeError = ref(false)
const name = ref('')
const email = ref('')
const password = ref('')
const infoError = ref('')
const selectedGroupId = ref(null)
const newGroupName = ref('')
const groupError = ref('')
const isGoogleFlow = ref(false)
const showRoleModal = ref(false)
const googleName = ref('')
const googleEmail = ref('')

// Pre-fill from pending Google data if redirected from role modal
if (auth.pendingGoogleData) {
  name.value = auth.pendingGoogleData.name
  email.value = auth.pendingGoogleData.email
  isGoogleFlow.value = true
}

watch(teacherCode, () => {
  codeError.value = false
  validTeacher.value = auth.validateTeacherCode(teacherCode.value)
})

const availableGroups = computed(() => {
  if (!validTeacher.value) return []
  return auth.getGroupsForCode(teacherCode.value)
})

function getMemberNames(group) {
  return auth.students.filter(s => group.memberIds.includes(s.id)).map(s => s.name).join(', ')
}

function validateCode() {
  validTeacher.value = auth.validateTeacherCode(teacherCode.value)
  if (!validTeacher.value) {
    codeError.value = true
  } else {
    step.value = isGoogleFlow.value ? 3 : 2
  }
}

function validateInfo() {
  if (!name.value.trim()) { infoError.value = 'Name is required'; return }
  if (!email.value.includes('@')) { infoError.value = 'Enter a valid email'; return }
  if (password.value.length < 6) { infoError.value = 'Password must be at least 6 characters'; return }
  infoError.value = ''
  step.value = 3
}

function completeSignup() {
  const isTeacherAssign = validTeacher.value?.groupMode === 'teacher_assign'

  if (!isTeacherAssign) {
    if (selectedGroupId.value) {
      const group = availableGroups.value.find(g => g.id === selectedGroupId.value)
      if (group && group.memberIds.length >= 3) {
        groupError.value = 'This group is full. Choose another or create a new one.'
        return
      }
    }
    if (!selectedGroupId.value && !newGroupName.value.trim()) {
      groupError.value = 'Select a group or create a new one'
      return
    }
  }

  if (isGoogleFlow.value) {
    auth.googleSignupStudent({
      teacherCode: teacherCode.value,
      groupId: isTeacherAssign ? null : selectedGroupId.value,
      newGroupName: isTeacherAssign ? null : (newGroupName.value.trim() || null)
    })
  } else {
    auth.signup({
      name: name.value,
      email: email.value,
      password: password.value,
      teacherCode: teacherCode.value,
      groupId: isTeacherAssign ? null : selectedGroupId.value,
      newGroupName: isTeacherAssign ? null : (newGroupName.value.trim() || null)
    })
  }
  router.push('/home')
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
    // Already on signup page, just pre-fill
    name.value = auth.pendingGoogleData?.name || googleName.value
    email.value = auth.pendingGoogleData?.email || googleEmail.value
    isGoogleFlow.value = true
  } else {
    router.push('/teacher-signup')
  }
}
</script>
