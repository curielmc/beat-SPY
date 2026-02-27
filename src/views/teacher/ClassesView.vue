<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Class Codes</h1>
      <p class="text-base-content/70">Manage class codes students use to sign up</p>
    </div>

    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title">Your Class Codes</h2>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Class Name</th>
                <th>Groups</th>
                <th>Students</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="cls in teacherClasses" :key="cls.code">
                <td><code class="badge badge-lg badge-primary badge-outline font-mono">{{ cls.code }}</code></td>
                <td>{{ cls.className }}</td>
                <td>{{ cls.groupCount }}</td>
                <td>{{ cls.studentCount }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow">
      <div class="card-body space-y-4">
        <h2 class="card-title">Create New Class Code</h2>

        <div v-if="error" class="alert alert-error"><span>{{ error }}</span></div>
        <div v-if="success" class="alert alert-success"><span>{{ success }}</span></div>

        <div class="form-control">
          <label class="label"><span class="label-text">Class Code</span></label>
          <input v-model="newCode" type="text" class="input input-bordered w-full" placeholder="e.g. ECON2026" />
        </div>

        <div class="form-control">
          <label class="label"><span class="label-text">Class Name</span></label>
          <input v-model="newClassName" type="text" class="input input-bordered w-full" placeholder="e.g. AP Economics" />
        </div>

        <button class="btn btn-primary" @click="handleCreate" :disabled="!newCode || !newClassName">Create Code</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTeacherStore } from '../../stores/teacher'
import { useAuthStore } from '../../stores/auth'

const teacher = useTeacherStore()
const auth = useAuthStore()

const newCode = ref('')
const newClassName = ref('')
const error = ref('')
const success = ref('')

const teacherClasses = computed(() => {
  if (!teacher.currentTeacherData) return []
  return teacher.teachers
    .filter(t => t.id === teacher.currentTeacherData.id)
    .map(t => ({
      code: t.code,
      className: t.className,
      groupCount: auth.groups.filter(g => g.teacherCode === t.code).length,
      studentCount: auth.students.filter(s => s.teacherCode === t.code).length
    }))
})

function handleCreate() {
  error.value = ''
  success.value = ''
  const result = teacher.createClassCode(newCode.value, newClassName.value)
  if (!result) {
    error.value = 'Code already exists. Choose a different code.'
    return
  }
  success.value = `Class code "${result.code}" created!`
  newCode.value = ''
  newClassName.value = ''
}
</script>
