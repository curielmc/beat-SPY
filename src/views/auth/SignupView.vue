<template>
  <div class="space-y-6">
    <div class="flex flex-col items-center gap-4">
      <LogoIcon size="lg" />
      <h1 class="text-2xl font-bold text-primary">Beat the S&P 500</h1>
    </div>

    <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title justify-center text-2xl mb-2">Sign Up</h2>

      <!-- Step indicator -->
      <ul class="steps steps-horizontal w-full mb-6">
        <li class="step" :class="{ 'step-primary': step >= 1 }">Class Code</li>
        <li class="step" :class="{ 'step-primary': step >= 2 }">Your Info</li>
        <li class="step" :class="{ 'step-primary': step >= 3 }">Group</li>
      </ul>

      <!-- Step 1: Class Code -->
      <div v-if="step === 1" class="space-y-4">
        <div class="form-control">
          <label class="label"><span class="label-text">Enter your class code</span></label>
          <input v-model="teacherCode" type="text" placeholder="e.g. ECON2025" class="input input-bordered w-full uppercase" @keyup.enter="validateCode" />
        </div>
        <p v-if="codeError" class="text-error text-sm">Invalid code. Please check with your teacher.</p>
        <p v-if="validClass" class="text-success text-sm">Code accepted! {{ validClass.class_name }} &mdash; {{ validClass.teacher?.full_name }}</p>
        <button class="btn btn-primary btn-block" :disabled="!validClass" @click="step = 2">Continue</button>

        <div class="divider text-xs">NO CLASS CODE?</div>
        <button class="btn btn-ghost btn-block btn-sm" @click="startIndependent">Sign Up Without a Class</button>
      </div>

      <!-- Step 2: Student Info -->
      <div v-if="step === 2" class="space-y-4">
        <div class="form-control">
          <label class="label"><span class="label-text">Full Name</span></label>
          <input v-model="name" type="text" placeholder="Your full name" class="input input-bordered w-full" />
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Email</span></label>
          <input v-model="email" type="email" placeholder="you@school.edu" class="input input-bordered w-full" @blur="checkInvite" />
        </div>
        <div v-if="inviteMatch" class="alert alert-success text-sm py-2">
          <span>We found your invite to {{ inviteMatch.class_name }}!</span>
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Password</span></label>
          <input v-model="password" type="password" placeholder="Min 6 characters" class="input input-bordered w-full" />
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Date of Birth</span></label>
          <input v-model="dateOfBirth" type="date" class="input input-bordered w-full" />
        </div>

        <template v-if="needsParent">
          <div class="alert alert-warning text-sm py-2">
            <span>Because you're under 18, we need a parent/guardian email to request consent.</span>
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Parent / Guardian Email</span></label>
            <input v-model="parentEmail" type="email" placeholder="parent@example.com" class="input input-bordered w-full" />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Parent's Preferred Language</span></label>
            <select v-model="parentLanguage" class="select select-bordered w-full">
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>
        </template>

        <p v-if="infoError" class="text-error text-sm">{{ infoError }}</p>
        <div class="flex gap-2">
          <button class="btn btn-ghost flex-1" @click="step = 1">Back</button>
          <button class="btn btn-primary flex-1" @click="validateInfo">Continue</button>
        </div>
      </div>

      <!-- Step 2.5: Charity picker (only when joining a challenge with charity-required mode) -->
      <div v-if="step === 25" class="space-y-4">
        <h3 class="font-semibold">Choose your charity</h3>
        <p class="text-sm text-base-content/70">If you win prize money in this challenge, where should it be donated?</p>

        <div v-if="challengeMeta?.default_charity?.name" class="alert alert-info text-sm py-2">
          <span>Organizer's pick: <strong>{{ challengeMeta.default_charity.name }}</strong></span>
        </div>

        <button
          class="btn btn-outline btn-block"
          :class="{ 'btn-primary': pickedOption === 'organizer_default' }"
          @click="pickedOption = 'organizer_default'; useOrganizerDefault = true; charityChoice = null"
        >
          Let the organizer pick<span v-if="challengeMeta?.default_charity?.name"> (donates to {{ challengeMeta.default_charity.name }})</span>
        </button>

        <div class="divider text-xs">OR PICK YOUR OWN</div>

        <div class="form-control">
          <input
            v-model="charityQuery"
            type="text"
            placeholder="Search 501(c)(3) charities..."
            class="input input-bordered w-full"
            @input="onCharitySearch"
          />
        </div>

        <div v-if="charityResults.length" class="space-y-1 max-h-64 overflow-y-auto">
          <button
            v-for="c in charityResults"
            :key="c.ein"
            class="btn btn-ghost btn-sm btn-block justify-start"
            :class="{ 'btn-primary': pickedOption === 'specific_charity' && charityChoice?.ein === c.ein }"
            @click="pickedOption = 'specific_charity'; charityChoice = c; useOrganizerDefault = false"
          >
            <div class="text-left">
              <div class="font-semibold">{{ c.name }}</div>
              <div class="text-xs opacity-60">EIN {{ c.ein }}</div>
            </div>
          </button>
        </div>

        <p v-if="pickedOption === 'specific_charity' && charityChoice" class="text-sm text-success">
          Selected: <strong>{{ charityChoice.name }}</strong>
        </p>

        <template v-if="challengeMeta?.payout_mode === 'charity_or_cash'">
          <div class="divider text-xs">OR</div>
          <button
            class="btn btn-outline btn-block"
            :class="{ 'btn-primary': pickedOption === 'self' }"
            @click="pickedOption = 'self'; charityChoice = null; useOrganizerDefault = false"
          >
            Keep prize for myself if I win
          </button>
        </template>

        <div class="flex gap-2">
          <button class="btn btn-ghost flex-1" @click="step = 2">Back</button>
          <button
            class="btn btn-primary flex-1"
            :disabled="pickedOption === 'specific_charity' && !charityChoice"
            @click="step = 3"
          >
            Continue
          </button>
        </div>
      </div>

      <!-- Step 3: Group -->
      <div v-if="step === 3" class="space-y-4">
        <!-- Independent signup (no class) -->
        <template v-if="isIndependent">
          <div class="alert alert-info">
            <span>You'll get a personal portfolio with $100,000 to invest. No class required!</span>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-ghost flex-1" @click="step = 2">Back</button>
            <button class="btn btn-primary flex-1" :class="{ 'loading': submitting }" :disabled="submitting" @click="completeSignup">Create Account</button>
          </div>
        </template>

        <!-- Teacher assigns groups -->
        <template v-else-if="validClass?.group_mode === 'teacher_assign'">
          <div class="alert alert-info">
            <span>Your teacher will assign you to a group. You can start exploring stocks while you wait!</span>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-ghost flex-1" @click="step = 2">Back</button>
            <button class="btn btn-primary flex-1" :class="{ 'loading': submitting }" :disabled="submitting" @click="completeSignup">Create Account</button>
          </div>
        </template>

        <!-- Students choose groups -->
        <template v-else>
          <p class="text-sm text-base-content/70">Join an existing group or create a new one.</p>

          <div v-if="loadingGroups" class="flex justify-center py-4">
            <span class="loading loading-spinner"></span>
          </div>

          <div v-for="group in availableGroups" :key="group.id" class="card bg-base-200 cursor-pointer hover:bg-base-300 transition-colors" :class="{ 'ring-2 ring-primary': selectedGroupId === group.id }" @click="selectedGroupId = group.id; newGroupName = ''">
            <div class="card-body p-4">
              <div class="flex justify-between items-center">
                <span class="font-semibold">{{ group.name }}</span>
                <span class="badge" :class="(group.memberships?.length || 0) < 3 ? 'badge-success' : 'badge-error'">{{ group.memberships?.length || 0 }}/3</span>
              </div>
              <p class="text-sm text-base-content/60">{{ getGroupMemberNames(group) }}</p>
            </div>
          </div>

          <div class="divider">OR</div>

          <div class="form-control">
            <label class="label"><span class="label-text">Create a new group</span></label>
            <input v-model="newGroupName" type="text" placeholder="Group name" class="input input-bordered w-full" @focus="selectedGroupId = null" />
          </div>

          <p v-if="groupError" class="text-error text-sm">{{ groupError }}</p>
          <div class="flex gap-2">
            <button class="btn btn-ghost flex-1" @click="step = 2">Back</button>
            <button class="btn btn-primary flex-1" :class="{ 'loading': submitting }" :disabled="(!selectedGroupId && !newGroupName) || submitting" @click="completeSignup">Create Account</button>
          </div>
        </template>
      </div>

      <div class="text-center mt-4">
        <RouterLink to="/login" class="link link-primary text-sm">Already have an account? Log in</RouterLink>
      </div>
      <p class="text-center text-xs text-base-content/50 mt-2">
        By signing up, you agree to our <RouterLink to="/terms" class="link link-primary">Terms &amp; Conditions</RouterLink>
      </p>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { supabase, getAccessToken } from '../../lib/supabase'
import LogoIcon from '../../components/LogoIcon.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

// Pre-loaded challenge meta (when arriving from /c/<slug>)
const challengeSlug = ref(route.query.challenge_slug || null)
const challengeMeta = ref(null)

// Charity picker
const charityQuery = ref('')
const charityResults = ref([])
const charityChoice = ref(null)
const useOrganizerDefault = ref(false)
// 'organizer_default' | 'specific_charity' | 'self'
const pickedOption = ref('organizer_default')
let _charitySearchTimer = null

// DOB + parent fields
const dateOfBirth = ref('')
const parentEmail = ref('')
const parentLanguage = ref((typeof navigator !== 'undefined' && navigator.language?.startsWith('es')) ? 'es' : 'en')

function isUnder18(dob) {
  if (!dob) return false
  const d = new Date(dob)
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 18)
  return d > cutoff
}

const needsParent = computed(() => isUnder18(dateOfBirth.value))

const needsCharityStep = computed(() => {
  const m = challengeMeta.value?.payout_mode
  return m && m !== 'cash_required'
})

async function loadChallengeMeta() {
  if (!challengeSlug.value) return
  const { data } = await supabase
    .from('competitions')
    .select('id, slug, name, payout_mode, default_charity')
    .eq('slug', challengeSlug.value)
    .maybeSingle()
  challengeMeta.value = data || null
}

async function onCharitySearch() {
  clearTimeout(_charitySearchTimer)
  const q = charityQuery.value.trim()
  if (!q) { charityResults.value = []; return }
  _charitySearchTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/charities/search?q=${encodeURIComponent(q)}`)
      if (!res.ok) { charityResults.value = []; return }
      const body = await res.json()
      charityResults.value = body.results || []
    } catch {
      charityResults.value = []
    }
  }, 250)
}

onMounted(loadChallengeMeta)

const step = ref(1)
const teacherCode = ref('')
const validClass = ref(null)
const codeError = ref(false)
const name = ref('')
const email = ref('')
const password = ref('')
const infoError = ref('')
const selectedGroupId = ref(null)
const newGroupName = ref('')
const groupError = ref('')
const submitting = ref(false)
const isIndependent = ref(false)
const availableGroups = ref([])
const loadingGroups = ref(false)
const inviteMatch = ref(null)

watch(teacherCode, () => {
  codeError.value = false
  validClass.value = null
})

async function validateCode() {
  const result = await auth.validateClassCode(teacherCode.value)
  if (!result) {
    codeError.value = true
    validClass.value = null
  } else {
    validClass.value = result
    codeError.value = false
    step.value = 2
  }
}

function startIndependent() {
  isIndependent.value = true
  validClass.value = null
  step.value = 2
}

async function checkInvite() {
  if (!email.value || !email.value.includes('@')) return
  const invite = await auth.checkEmailInvite(email.value)
  if (invite) {
    inviteMatch.value = invite
    // Auto-fill name if blank
    if (!name.value.trim()) {
      name.value = invite.full_name
    }
    // Auto-set class from invite if not already set
    if (!validClass.value) {
      const cls = await auth.validateClassCode(invite.class_code)
      if (cls) {
        validClass.value = cls
        teacherCode.value = invite.class_code
        isIndependent.value = false
      }
    }
  } else {
    inviteMatch.value = null
  }
}

function validateInfo() {
  if (!name.value.trim()) { infoError.value = 'Name is required'; return }
  if (!email.value.includes('@')) { infoError.value = 'Enter a valid email'; return }
  if (password.value.length < 6) { infoError.value = 'Password must be at least 6 characters'; return }
  if (!dateOfBirth.value) { infoError.value = 'Date of birth is required'; return }
  if (needsParent.value) {
    if (!parentEmail.value.includes('@')) { infoError.value = 'Parent email is required'; return }
    if (parentEmail.value.toLowerCase() === email.value.toLowerCase()) {
      infoError.value = 'Parent email must be different from your email'
      return
    }
  }
  infoError.value = ''

  // Branch: charity step required when joining a challenge that uses charity payouts
  if (needsCharityStep.value) {
    step.value = 25
    return
  }

  step.value = 3

  // Load groups if needed
  if (validClass.value && validClass.value.group_mode !== 'teacher_assign') {
    loadGroups()
  }
}

async function loadGroups() {
  if (!validClass.value) return
  loadingGroups.value = true
  availableGroups.value = await auth.getGroupsForClass(validClass.value.id)
  loadingGroups.value = false
}

function getGroupMemberNames(group) {
  return (group.memberships || [])
    .map(m => m.profiles?.full_name?.split(' ')[0])
    .filter(Boolean)
    .join(', ')
}

async function completeSignup() {
  submitting.value = true
  groupError.value = ''

  // 1. Create the auth account
  const signupResult = await auth.signup({
    email: email.value,
    password: password.value,
    fullName: name.value,
    role: 'student'
  })

  if (signupResult.error) {
    groupError.value = signupResult.error
    submitting.value = false
    return
  }

  // 2. If independent user, create personal portfolio
  if (isIndependent.value) {
    await supabase.from('portfolios').insert({
      owner_type: 'user',
      owner_id: auth.currentUser.id,
      starting_cash: 100000,
      cash_balance: 100000
    })
    submitting.value = false
    router.push('/leaderboard')
    return
  }

  // 3. Join class
  if (validClass.value) {
    const joinResult = await auth.joinClass(
      teacherCode.value,
      selectedGroupId.value,
      newGroupName.value.trim() || null,
      inviteMatch.value?.id || null
    )

    if (joinResult.error) {
      groupError.value = joinResult.error
      submitting.value = false
      return
    }
  }

  // 4. Persist DOB + parent fields on profile
  try {
    const updates = {
      date_of_birth: dateOfBirth.value,
      parent_email: needsParent.value ? parentEmail.value : null,
      parent_language: needsParent.value ? parentLanguage.value : 'en',
      parental_consent_status: needsParent.value ? 'pending' : 'not_required'
    }
    await supabase.from('profiles').update(updates).eq('id', auth.currentUser.id)
  } catch (e) {
    // Non-fatal; user can update from settings
    console.warn('Profile DOB update failed:', e)
  }

  // 5. Trigger parent consent email if under-18
  if (needsParent.value) {
    try {
      const token = await getAccessToken()
      await fetch('/api/consent/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      })
    } catch (e) {
      console.warn('Consent request failed:', e)
    }
  }

  // 6. Auto-register for challenge if slug present
  if (challengeSlug.value) {
    try {
      const token = await getAccessToken()
      const res = await fetch('/api/competitions/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          slug: challengeSlug.value,
          charity_choice: pickedOption.value === 'self' ? null : (pickedOption.value === 'organizer_default' ? null : charityChoice.value),
          payout_destination: pickedOption.value === 'self' ? 'self' : undefined
        })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok && body.error === 'consent_required') {
        groupError.value = 'Account created. Your parent has been emailed to provide consent before you can join the challenge.'
        submitting.value = false
        setTimeout(() => router.push('/leaderboard'), 2500)
        return
      }
    } catch (e) {
      console.warn('Auto-register failed:', e)
    }
  }

  submitting.value = false
  router.push('/leaderboard')
}
</script>
