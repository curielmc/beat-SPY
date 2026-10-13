<template>
  <div class="space-y-3">
    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <div v-for="cls in visibleClasses" :key="cls.id" class="collapse collapse-arrow bg-base-100 shadow">
        <input type="checkbox" :checked="isOpen(cls.id)" @change="toggleOpen(cls.id)" />
        <div class="collapse-title">
          <div class="flex items-center justify-between gap-3 pr-4 flex-wrap">
            <div class="flex items-center gap-3 min-w-0">
              <code class="badge badge-primary badge-outline font-mono">{{ cls.code }}</code>
              <span class="font-bold truncate">{{ cls.class_name }}</span>
            </div>
            <div class="flex gap-2 text-sm text-base-content/60">
              <span>{{ cls.teacherProfile?.full_name || 'No teacher' }}</span>
              <span class="badge badge-ghost badge-sm">{{ cls.students.length }} student{{ cls.students.length === 1 ? '' : 's' }}</span>
            </div>
          </div>
        </div>
        <div class="collapse-content">
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role in class</th>
                  <th>Group</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <!-- Teacher -->
                <tr v-if="showRow(cls.teacherProfile)" class="bg-secondary/5">
                  <td class="font-medium">{{ cls.teacherProfile?.full_name || '—' }}</td>
                  <td class="text-sm">{{ cls.teacherProfile?.email || '' }}</td>
                  <td><span class="badge badge-secondary badge-sm">Teacher</span></td>
                  <td class="text-base-content/40">—</td>
                  <td class="text-right">
                    <select class="select select-bordered select-xs max-w-[12rem]" :disabled="busy" @change="changeTeacher(cls, $event.target.value); $event.target.value = ''">
                      <option value="">Change teacher…</option>
                      <option v-for="u in activeUsers" :key="u.id" :value="u.id" :disabled="u.id === cls.teacher_id">{{ u.full_name || u.email }}</option>
                    </select>
                  </td>
                </tr>

                <!-- Students -->
                <tr v-for="m in cls.students.filter(s => showRow(s.profile))" :key="m.id">
                  <td class="font-medium">{{ m.profile?.full_name || 'Unknown user' }}</td>
                  <td class="text-sm">{{ m.profile?.email }}</td>
                  <td><span class="badge badge-ghost badge-sm">Student</span></td>
                  <td>
                    <select class="select select-bordered select-xs" :value="m.group_id || ''" :disabled="busy" @change="changeGroup(m, $event.target.value)">
                      <option value="">No group</option>
                      <option v-for="g in cls.groups" :key="g.id" :value="g.id">{{ g.name }}</option>
                    </select>
                  </td>
                  <td class="text-right whitespace-nowrap">
                    <button v-if="m.profile" class="btn btn-ghost btn-xs text-primary" :disabled="busy" @click="$emit('view-as', m.profile)">View as</button>
                    <button
                      class="btn btn-ghost btn-xs"
                      :class="confirmRemoveId === m.id ? 'btn-error' : 'text-error'"
                      :disabled="busy"
                      @click="removeMember(m)"
                    >{{ confirmRemoveId === m.id ? 'Confirm remove' : 'Remove' }}</button>
                  </td>
                </tr>

                <tr v-if="!cls.teacherProfile && !cls.students.length">
                  <td colspan="5" class="text-center text-base-content/50">Nobody in this class yet</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Add someone -->
          <div class="flex flex-wrap items-end gap-2 mt-3 pt-3 border-t border-base-200">
            <div class="form-control flex-1 min-w-[12rem]">
              <label class="label py-1"><span class="label-text text-xs">Add a person</span></label>
              <select v-model="addForm[cls.id].userId" class="select select-bordered select-sm">
                <option value="">Choose a user…</option>
                <option v-for="u in addableUsers(cls)" :key="u.id" :value="u.id">{{ u.full_name || u.email }} — {{ u.email }}</option>
              </select>
            </div>
            <div class="form-control">
              <label class="label py-1"><span class="label-text text-xs">As</span></label>
              <select v-model="addForm[cls.id].role" class="select select-bordered select-sm">
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
            </div>
            <div v-if="addForm[cls.id].role === 'student'" class="form-control">
              <label class="label py-1"><span class="label-text text-xs">Group</span></label>
              <select v-model="addForm[cls.id].groupId" class="select select-bordered select-sm">
                <option value="">No group</option>
                <option v-for="g in cls.groups" :key="g.id" :value="g.id">{{ g.name }}</option>
              </select>
            </div>
            <button class="btn btn-primary btn-sm" :disabled="busy || !addForm[cls.id].userId" @click="addPerson(cls)">Add</button>
          </div>
          <p v-if="addForm[cls.id].role === 'teacher'" class="text-xs text-base-content/60 mt-1">A class has one teacher — this replaces {{ cls.teacherProfile?.full_name || 'the current teacher' }}.</p>
        </div>
      </div>

      <!-- People not in any class -->
      <div v-if="unplacedUsers.length" class="collapse collapse-arrow bg-base-100 shadow">
        <input type="checkbox" :checked="isOpen('none')" @change="toggleOpen('none')" />
        <div class="collapse-title">
          <div class="flex items-center justify-between pr-4">
            <span class="font-bold">Not in any class</span>
            <span class="badge badge-ghost badge-sm">{{ unplacedUsers.length }}</span>
          </div>
        </div>
        <div class="collapse-content">
          <table class="table table-sm">
            <thead><tr><th>Name</th><th>Email</th><th>Account role</th></tr></thead>
            <tbody>
              <tr v-for="u in unplacedUsers" :key="u.id">
                <td class="font-medium">{{ u.full_name }}</td>
                <td class="text-sm">{{ u.email }}</td>
                <td class="capitalize text-sm">{{ u.role }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p v-if="search && !visibleClasses.length && !unplacedUsers.length" class="text-center text-base-content/50 py-6">No one matches "{{ search }}"</p>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { supabase } from '../../lib/supabase'

const props = defineProps({
  users: { type: Array, required: true },
  search: { type: String, default: '' }
})
const emit = defineEmits(['view-as', 'message', 'error', 'roles-changed'])

const loading = ref(true)
const busy = ref(false)
const classes = ref([])
const openIds = ref(new Set())
const addForm = reactive({})
const confirmRemoveId = ref(null)

const usersById = computed(() => new Map(props.users.map(u => [u.id, u])))
const activeUsers = computed(() => props.users.filter(u => !u.is_disabled).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')))

const query = computed(() => props.search.trim().toLowerCase())
function matches(profile) {
  if (!query.value) return true
  if (!profile) return false
  return (profile.full_name || '').toLowerCase().includes(query.value) || (profile.email || '').toLowerCase().includes(query.value)
}
function showRow(profile) {
  return !!profile && matches(profile)
}

// Classes with resolved teacher + student profiles, students sorted by group then name.
const decoratedClasses = computed(() => classes.value.map(cls => {
  const groupName = id => cls.groups.find(g => g.id === id)?.name || '~'
  const students = (cls.memberships || [])
    .map(m => ({ ...m, profile: usersById.value.get(m.user_id) }))
    .sort((a, b) => groupName(a.group_id).localeCompare(groupName(b.group_id)) || (a.profile?.full_name || '').localeCompare(b.profile?.full_name || ''))
  return { ...cls, teacherProfile: usersById.value.get(cls.teacher_id), students }
}))

const visibleClasses = computed(() => {
  if (!query.value) return decoratedClasses.value
  return decoratedClasses.value.filter(c => matches(c.teacherProfile) || c.students.some(s => matches(s.profile)))
})

const unplacedUsers = computed(() => {
  const placed = new Set()
  for (const c of classes.value) {
    if (c.teacher_id) placed.add(c.teacher_id)
    for (const m of c.memberships || []) placed.add(m.user_id)
  }
  return activeUsers.value.filter(u => !placed.has(u.id) && matches(u))
})

// Searching opens every matching banner; otherwise banners follow the user's clicks.
function isOpen(id) {
  return !!query.value || openIds.value.has(id)
}
function toggleOpen(id) {
  const next = new Set(openIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  openIds.value = next
}

function addableUsers(cls) {
  const taken = new Set([cls.teacher_id, ...(cls.memberships || []).map(m => m.user_id)])
  return activeUsers.value.filter(u => !taken.has(u.id))
}

async function load() {
  const { data, error } = await supabase
    .from('classes')
    .select('id, class_name, code, teacher_id, groups(id, name), memberships:class_memberships(id, user_id, group_id)')
    .order('class_name')
  if (error) {
    emit('error', error.message)
  } else {
    classes.value = (data || []).map(c => ({ ...c, groups: (c.groups || []).sort((a, b) => a.name.localeCompare(b.name)) }))
    for (const c of classes.value) {
      if (!addForm[c.id]) addForm[c.id] = { userId: '', role: 'student', groupId: '' }
    }
  }
  loading.value = false
}

async function run(action, successMsg) {
  busy.value = true
  try {
    const error = await action()
    if (error) {
      emit('error', error.message || String(error))
    } else {
      if (successMsg) emit('message', successMsg)
      await load()
    }
  } finally {
    busy.value = false
  }
}

// Teacher pages require the teacher account role, so promote students who become a class teacher.
async function setTeacher(cls, userId) {
  const { error } = await supabase.from('classes').update({ teacher_id: userId }).eq('id', cls.id)
  if (error) return error
  const user = usersById.value.get(userId)
  if (user?.role === 'student') {
    const { error: roleError } = await supabase.from('profiles').update({ role: 'teacher' }).eq('id', userId)
    if (roleError) return roleError
    emit('roles-changed')
  }
  return null
}

function changeTeacher(cls, userId) {
  if (!userId) return
  const name = usersById.value.get(userId)?.full_name || 'User'
  run(() => setTeacher(cls, userId), `${name} is now the teacher of ${cls.class_name}`)
}

function changeGroup(member, groupId) {
  run(async () => {
    const { error } = await supabase.from('class_memberships').update({ group_id: groupId || null }).eq('id', member.id)
    return error
  }, 'Group updated')
}

function removeMember(member) {
  if (confirmRemoveId.value !== member.id) {
    confirmRemoveId.value = member.id
    setTimeout(() => { if (confirmRemoveId.value === member.id) confirmRemoveId.value = null }, 4000)
    return
  }
  confirmRemoveId.value = null
  run(async () => {
    const { error } = await supabase.from('class_memberships').delete().eq('id', member.id)
    return error
  }, `Removed ${member.profile?.full_name || 'user'} from the class`)
}

function addPerson(cls) {
  const form = addForm[cls.id]
  const name = usersById.value.get(form.userId)?.full_name || 'User'
  const action = form.role === 'teacher'
    ? () => setTeacher(cls, form.userId)
    : async () => {
      const { error } = await supabase.from('class_memberships').insert({ class_id: cls.id, user_id: form.userId, group_id: form.groupId || null })
      if (error) return error
      // Same as joining via sign-up: every student gets a personal portfolio.
      const { data: personal } = await supabase.from('portfolios').select('id')
        .eq('owner_type', 'user').eq('owner_id', form.userId).limit(1)
      if (!personal?.length) {
        const { error: portfolioError } = await supabase.from('portfolios').insert({
          owner_type: 'user', owner_id: form.userId, starting_cash: 100000, cash_balance: 100000, allow_reset: true
        })
        return portfolioError
      }
      return null
    }
  run(async () => {
    const error = await action()
    if (!error) addForm[cls.id] = { userId: '', role: 'student', groupId: '' }
    return error
  }, `Added ${name} to ${cls.class_name} as ${form.role}`)
}

onMounted(load)
</script>
