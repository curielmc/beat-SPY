<template>
  <div class="max-w-md mx-auto space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Join a Class</h1>
      <p class="text-base-content/60 text-sm">Enter a class code from your teacher to join their class.</p>
    </div>

    <!-- Step 1: Enter code -->
    <div v-if="!validClass" class="card bg-base-100 shadow">
      <div class="card-body">
        <div class="form-control">
          <label class="label"><span class="label-text">Class Code</span></label>
          <input v-model="classCode" type="text" placeholder="e.g. ECON2025" class="input input-bordered w-full uppercase" @keyup.enter="validateCode" />
        </div>
        <p v-if="codeError" class="text-error text-sm">{{ codeError }}</p>
        <button class="btn btn-primary btn-block mt-2" :disabled="!classCode.trim() || validating" @click="validateCode">
          <span v-if="validating" class="loading loading-spinner loading-sm"></span>
          Validate Code
        </button>
      </div>
    </div>

    <!-- Step 2: Choose group or confirm -->
    <div v-else class="space-y-4">
      <div class="alert alert-success">
        <span>{{ validClass.class_name }} &mdash; {{ validClass.teacher?.full_name }}</span>
      </div>

      <!-- Teacher assigns groups -->
      <template v-if="validClass.group_mode === 'teacher_assign'">
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <p class="text-sm text-base-content/70">Your teacher will assign you to a group after you join.</p>
            <button class="btn btn-primary btn-block" :disabled="joining" @click="handleJoin(null, null)">
              <span v-if="joining" class="loading loading-spinner loading-sm"></span>
              Join Class
            </button>
          </div>
        </div>
      </template>

      <!-- Students choose groups -->
      <template v-else>
        <div class="card bg-base-100 shadow">
          <div class="card-body space-y-3">
            <p class="text-sm text-base-content/70">Join an existing group or create a new one.</p>

            <div v-if="loadingGroups" class="flex justify-center py-4">
              <span class="loading loading-spinner"></span>
            </div>

            <div v-for="group in availableGroups" :key="group.id" class="card bg-base-200 cursor-pointer hover:bg-base-300 transition-colors" :class="{ 'ring-2 ring-primary': selectedGroupId === group.id }" @click="selectedGroupId = group.id; newGroupName = ''">
              <div class="card-body p-3">
                <div class="flex justify-between items-center">
                  <span class="font-semibold">{{ group.name }}</span>
                  <span class="badge badge-sm" :class="(group.memberships?.length || 0) < 3 ? 'badge-success' : 'badge-error'">{{ group.memberships?.length || 0 }}/3</span>
                </div>
              </div>
            </div>

            <div class="divider text-xs">OR</div>

            <div class="form-control">
              <input v-model="newGroupName" type="text" placeholder="Create a new group..." class="input input-bordered input-sm w-full" @focus="selectedGroupId = null" />
            </div>

            <button class="btn btn-primary btn-block" :disabled="(!selectedGroupId && !newGroupName.trim()) || joining" @click="handleJoin(selectedGroupId, newGroupName.trim() || null)">
              <span v-if="joining" class="loading loading-spinner loading-sm"></span>
              Join Class
            </button>
          </div>
        </div>
      </template>

      <button class="btn btn-ghost btn-sm" @click="validClass = null; codeError = ''">Use a different code</button>
    </div>

    <p v-if="joinError" class="text-error text-sm">{{ joinError }}</p>

    <RouterLink to="/home" class="btn btn-ghost btn-block btn-sm">Back to Portfolio</RouterLink>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const classCode = ref('')
const validClass = ref(null)
const codeError = ref('')
const validating = ref(false)
const joining = ref(false)
const joinError = ref('')
const selectedGroupId = ref(null)
const newGroupName = ref('')
const availableGroups = ref([])
const loadingGroups = ref(false)

async function validateCode() {
  validating.value = true
  codeError.value = ''
  const result = await auth.validateClassCode(classCode.value)
  if (!result) {
    codeError.value = 'Invalid code. Please check with your teacher.'
  } else {
    validClass.value = result
    if (result.group_mode !== 'teacher_assign') {
      loadingGroups.value = true
      availableGroups.value = await auth.getGroupsForClass(result.id)
      loadingGroups.value = false
    }
  }
  validating.value = false
}

async function handleJoin(groupId, groupName) {
  joining.value = true
  joinError.value = ''
  const result = await auth.joinClass(classCode.value, groupId, groupName)
  if (result.error) {
    joinError.value = result.error
    joining.value = false
    return
  }
  joining.value = false
  if (result.classData?.id) {
    auth.setActiveClass(result.classData.id)
  }
  router.push('/active-class')
}
</script>
