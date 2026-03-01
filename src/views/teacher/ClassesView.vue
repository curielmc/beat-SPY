<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Class Codes</h1>
      <p class="text-base-content/70">Manage class codes students use to sign up</p>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <!-- Existing Classes -->
      <div v-for="cls in classesWithCounts" :key="cls.id" class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="card-title">
                <code class="badge badge-lg badge-primary badge-outline font-mono">{{ cls.code }}</code>
                {{ cls.class_name }}
              </h2>
              <p class="text-sm text-base-content/60">{{ cls.school || 'No school' }} &middot; {{ cls.groupCount }} groups &middot; {{ cls.studentCount }} students</p>
            </div>
            <button class="btn btn-sm btn-ghost" @click="toggleClassSettings(cls.id)">
              {{ expandedClass === cls.id ? 'Hide Settings' : 'Settings' }}
            </button>
          </div>

          <div v-if="expandedClass === cls.id" class="mt-4 space-y-3 border-t pt-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="form-control">
                <label class="label py-1"><span class="label-text text-xs">Starting Cash ($)</span></label>
                <input type="number" class="input input-bordered input-sm" :value="cls.starting_cash" @change="updateSetting(cls.id, 'starting_cash', Number($event.target.value))" />
              </div>
              <div class="form-control">
                <label class="label py-1"><span class="label-text text-xs">Max Portfolios</span></label>
                <input type="number" class="input input-bordered input-sm" :value="cls.max_portfolios" @change="updateSetting(cls.id, 'max_portfolios', Number($event.target.value))" min="1" />
              </div>
              <div class="form-control">
                <label class="label cursor-pointer justify-start gap-3 mt-6">
                  <input type="checkbox" class="toggle toggle-sm" :checked="cls.allow_reset" @change="updateSetting(cls.id, 'allow_reset', $event.target.checked)" />
                  <span class="label-text text-sm">Allow Portfolio Reset</span>
                </label>
              </div>
            </div>
            <p class="text-xs text-base-content/40">Note: Starting cash only applies to new groups created after this change.</p>
          </div>
        </div>
      </div>

      <div v-if="classesWithCounts.length === 0" class="card bg-base-100 shadow">
        <div class="card-body text-center text-base-content/50">No classes yet. Create one below.</div>
      </div>

      <!-- Create New Class -->
      <div class="card bg-base-100 shadow">
        <div class="card-body space-y-4">
          <h2 class="card-title">Create New Class Code</h2>

          <div v-if="error" class="alert alert-error"><span>{{ error }}</span></div>
          <div v-if="success" class="alert alert-success"><span>{{ success }}</span></div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="form-control">
              <label class="label"><span class="label-text">Class Code</span></label>
              <input v-model="newCode" type="text" class="input input-bordered w-full" placeholder="e.g. ECON2026" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Class Name</span></label>
              <input v-model="newClassName" type="text" class="input input-bordered w-full" placeholder="e.g. AP Economics" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="form-control">
              <label class="label"><span class="label-text">Starting Cash ($)</span></label>
              <input v-model.number="newStartingCash" type="number" class="input input-bordered w-full" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Max Portfolios</span></label>
              <input v-model.number="newMaxPortfolios" type="number" class="input input-bordered w-full" min="1" />
            </div>
            <div class="form-control">
              <label class="label cursor-pointer justify-start gap-3 mt-8">
                <input type="checkbox" class="toggle" v-model="newAllowReset" />
                <span class="label-text">Allow Reset</span>
              </label>
            </div>
          </div>

          <button class="btn btn-primary" @click="handleCreate" :disabled="!newCode || !newClassName">Create Code</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTeacherStore } from '../../stores/teacher'

const teacher = useTeacherStore()

const loading = ref(true)
const newCode = ref('')
const newClassName = ref('')
const newStartingCash = ref(100000)
const newMaxPortfolios = ref(1)
const newAllowReset = ref(false)
const error = ref('')
const success = ref('')
const expandedClass = ref(null)

onMounted(async () => {
  await teacher.loadTeacherData()
  loading.value = false
})

const classesWithCounts = computed(() => {
  return teacher.classes.map(cls => ({
    ...cls,
    groupCount: teacher.groups.filter(g => g.class_id === cls.id).length,
    studentCount: teacher.students.filter(s => s.class_id === cls.id).length
  }))
})

function toggleClassSettings(classId) {
  expandedClass.value = expandedClass.value === classId ? null : classId
}

async function updateSetting(classId, key, value) {
  const result = await teacher.updateClassSettings(classId, { [key]: value })
  if (result.error) {
    error.value = result.error
    setTimeout(() => { error.value = '' }, 3000)
  }
}

async function handleCreate() {
  error.value = ''
  success.value = ''

  const result = await teacher.createClass({
    code: newCode.value,
    className: newClassName.value,
    school: teacher.classes[0]?.school || '',
    startingCash: newStartingCash.value,
    allowReset: newAllowReset.value,
    maxPortfolios: newMaxPortfolios.value
  })

  if (result.error) {
    error.value = result.error
    return
  }

  success.value = `Class code "${result.class.code}" created!`
  newCode.value = ''
  newClassName.value = ''
  newStartingCash.value = 100000
  newMaxPortfolios.value = 1
  newAllowReset.value = false
}
</script>
