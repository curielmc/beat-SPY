<template>
  <div v-if="options.length > 1" class="form-control" :class="compact ? '' : 'w-full'">
    <label v-if="!compact" class="label py-1">
      <span class="label-text text-xs text-base-content/60">Switch class</span>
    </label>
    <select
      class="select select-bordered select-sm"
      :class="compact ? 'max-w-[16rem]' : 'w-full'"
      :value="currentKey"
      aria-label="Switch class"
      @change="go($event.target.value)"
    >
      <option v-for="opt in options" :key="opt.key" :value="opt.key">
        {{ opt.name }} · {{ opt.role === 'teacher' ? 'Teacher' : 'Student' }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'

// Every class the signed-in user belongs to — as teacher or as student — so someone
// like a student who also teaches a club can hop between them without signing out.
defineProps({ compact: { type: Boolean, default: false } })

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const teaching = ref([])

async function loadTeaching() {
  const uid = auth.currentUser?.id
  if (!uid) { teaching.value = []; return }
  const { data } = await supabase.from('classes').select('id, class_name').eq('teacher_id', uid).order('class_name')
  teaching.value = data || []
}

onMounted(async () => {
  await Promise.all([loadTeaching(), auth.getCurrentMembership()])
})
watch(() => auth.currentUser?.id, () => { loadTeaching(); auth.getCurrentMembership(true) })

// Plain students can't open teacher pages, so only list taught classes for teacher/admin accounts.
const canTeach = computed(() => auth.userType === 'teacher' || auth.userType === 'admin')

const options = computed(() => {
  const opts = canTeach.value
    ? teaching.value.map(c => ({ key: `teacher:${c.id}`, id: c.id, role: 'teacher', name: c.class_name }))
    : []
  for (const m of auth.allMemberships) {
    opts.push({ key: `student:${m.class_id}`, id: m.class_id, role: 'student', name: m.class?.class_name || m.class?.name || 'Class' })
  }
  return opts
})

const inTeacherView = computed(() => route.path.startsWith('/teacher'))
const currentKey = computed(() => {
  const id = inTeacherView.value ? (route.query.class_id || auth.activeClassId) : auth.activeClassId
  const key = `${inTeacherView.value ? 'teacher' : 'student'}:${id}`
  if (options.value.some(o => o.key === key)) return key
  return options.value.find(o => o.role === (inTeacherView.value ? 'teacher' : 'student'))?.key || ''
})

function go(key) {
  const opt = options.value.find(o => o.key === key)
  if (!opt) return
  auth.setActiveClass(opt.id)
  if (opt.role === 'teacher') {
    router.push({ path: inTeacherView.value ? route.path : '/teacher', query: { class_id: opt.id } })
  } else if (inTeacherView.value) {
    router.push('/leaderboard')
  }
}
</script>
