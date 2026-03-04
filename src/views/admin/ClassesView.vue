<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Classes</h1>
      <p class="text-base-content/70">View and manage all classes</p>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else class="space-y-3">
      <div v-for="cls in classes" :key="cls.id" class="collapse collapse-arrow bg-base-100 shadow">
        <input type="checkbox" />
        <div class="collapse-title">
          <div class="flex items-center justify-between pr-4">
            <div class="flex items-center gap-3">
              <code class="badge badge-primary badge-outline font-mono">{{ cls.code }}</code>
              <span class="font-bold">{{ cls.class_name }}</span>
            </div>
            <div class="flex gap-2 text-sm text-base-content/60">
              <span>{{ cls.teacher?.full_name }}</span>
              <span class="badge badge-ghost badge-sm">{{ cls.groups?.length || 0 }} groups</span>
              <span class="badge badge-ghost badge-sm">{{ cls.memberships?.length || 0 }} students</span>
            </div>
          </div>
        </div>
        <div class="collapse-content">
          <div class="space-y-4">
            <!-- Inline Settings -->
            <div class="card bg-base-200 p-4">
              <h3 class="font-semibold mb-3">Class Settings</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div class="form-control">
                  <label class="label label-text text-xs">Starting Cash</label>
                  <div class="flex gap-2">
                    <input type="number" v-model.number="editState[cls.id].starting_cash" class="input input-bordered input-sm flex-1" />
                  </div>
                </div>
                <div class="form-control">
                  <label class="label label-text text-xs">Max Portfolios</label>
                  <input type="number" v-model.number="editState[cls.id].max_portfolios" class="input input-bordered input-sm" />
                </div>
                <div class="form-control">
                  <label class="label label-text text-xs">Group Mode</label>
                  <select v-model="editState[cls.id].group_mode" class="select select-bordered select-sm">
                    <option value="individual">Individual</option>
                    <option value="group">Group</option>
                  </select>
                </div>
                <div class="form-control">
                  <label class="label label-text text-xs">Approval Code</label>
                  <input type="text" v-model="editState[cls.id].approval_code" class="input input-bordered input-sm" placeholder="None" />
                </div>
                <div class="form-control">
                  <label class="label label-text text-xs cursor-pointer gap-2 justify-start">
                    <input type="checkbox" v-model="editState[cls.id].allow_reset" class="checkbox checkbox-sm" />
                    <span>Allow Reset</span>
                  </label>
                </div>
              </div>

              <!-- Restrictions -->
              <h4 class="font-semibold mt-4 mb-2 text-sm">Restrictions</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="form-control">
                  <label class="label label-text text-xs cursor-pointer gap-2 justify-start">
                    <input type="checkbox" v-model="editState[cls.id].restrictions.requireRationale" class="checkbox checkbox-sm" />
                    <span>Require Rationale</span>
                  </label>
                </div>
                <div class="form-control">
                  <label class="label label-text text-xs">Trade Frequency</label>
                  <select v-model="editState[cls.id].restrictions.tradeFrequency" class="select select-bordered select-sm">
                    <option value="">No Limit</option>
                    <option value="1_per_day">1 per day</option>
                    <option value="3_per_day">3 per day</option>
                    <option value="5_per_day">5 per day</option>
                    <option value="1_per_week">1 per week</option>
                    <option value="3_per_week">3 per week</option>
                  </select>
                </div>
              </div>

              <div class="mt-3 flex gap-2">
                <button class="btn btn-primary btn-sm" @click="saveClassSettings(cls)" :disabled="savingClass === cls.id">
                  {{ savingClass === cls.id ? 'Saving...' : 'Save Settings' }}
                </button>
              </div>
            </div>

            <!-- Groups -->
            <div v-if="cls.groups?.length" class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Members</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="group in cls.groups" :key="group.id">
                    <td class="font-medium">{{ group.name }}</td>
                    <td>
                      <div class="flex gap-1 flex-wrap">
                        <span v-for="m in getGroupMembers(cls, group.id)" :key="m.user_id" class="badge badge-sm badge-outline">
                          {{ m.profiles?.full_name?.split(' ')[0] }}
                        </span>
                      </div>
                    </td>
                    <td class="text-sm text-base-content/60">{{ new Date(group.created_at).toLocaleDateString() }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Invites -->
            <div class="card bg-base-200 p-4">
              <div class="flex items-center justify-between mb-2">
                <h3 class="font-semibold">Pending Invites</h3>
                <span class="badge badge-sm">{{ (invites[cls.id] || []).length }}</span>
              </div>
              <div v-if="!invitesLoaded[cls.id]">
                <button class="btn btn-xs btn-outline" @click="loadInvites(cls.id)">Load Invites</button>
              </div>
              <div v-else-if="(invites[cls.id] || []).length === 0" class="text-sm text-base-content/50">No pending invites</div>
              <table v-else class="table table-xs">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="inv in invites[cls.id]" :key="inv.id">
                    <td class="text-sm">{{ inv.email }}</td>
                    <td><span class="badge badge-xs" :class="inv.status === 'pending' ? 'badge-warning' : 'badge-success'">{{ inv.status }}</span></td>
                    <td class="text-sm text-base-content/60">{{ new Date(inv.created_at).toLocaleDateString() }}</td>
                    <td>
                      <button class="btn btn-ghost btn-xs text-error" @click="deleteInvite(cls.id, inv.id)">Delete</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="flex gap-2">
              <button class="btn btn-sm btn-outline btn-primary" @click="viewAsTeacher(cls)">View as Teacher</button>
              <button class="btn btn-error btn-sm btn-outline" @click="confirmDelete(cls)">Delete Class</button>
            </div>
          </div>
        </div>
      </div>

      <p v-if="classes.length === 0" class="text-center text-base-content/50 py-8">No classes found</p>
    </div>

    <!-- Delete Modal -->
    <dialog class="modal" :class="{ 'modal-open': showDeleteModal }">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Delete Class</h3>
        <p class="py-4">Are you sure you want to delete <strong>{{ deleteTarget?.class_name }}</strong> ({{ deleteTarget?.code }})? This will also delete all associated groups and memberships.</p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showDeleteModal = false">Cancel</button>
          <button class="btn btn-error" @click="deleteClass">Delete</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showDeleteModal = false"><button>close</button></form>
    </dialog>

    <div v-if="successMsg" class="alert alert-success fixed bottom-4 right-4 w-auto z-50">
      <span>{{ successMsg }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase'

const router = useRouter()

const classes = ref([])
const loading = ref(true)
const showDeleteModal = ref(false)
const deleteTarget = ref(null)
const savingClass = ref(null)
const successMsg = ref('')
const editState = reactive({})
const invites = reactive({})
const invitesLoaded = reactive({})

onMounted(async () => {
  await fetchClasses()
})

async function fetchClasses() {
  loading.value = true
  const { data } = await supabase
    .from('classes')
    .select('*, teacher:profiles!classes_teacher_id_fkey(full_name, email), groups(*), memberships:class_memberships(*, profiles:profiles(full_name))')
    .order('created_at', { ascending: false })
  classes.value = data || []

  // Initialize edit state for each class
  for (const cls of classes.value) {
    const restrictions = cls.restrictions || {}
    editState[cls.id] = {
      starting_cash: cls.starting_cash,
      allow_reset: cls.allow_reset ?? false,
      max_portfolios: cls.max_portfolios ?? 1,
      group_mode: cls.group_mode || 'individual',
      approval_code: cls.approval_code || '',
      restrictions: {
        requireRationale: restrictions.requireRationale ?? false,
        tradeFrequency: restrictions.tradeFrequency || ''
      }
    }
  }
  loading.value = false
}

function getGroupMembers(cls, groupId) {
  return (cls.memberships || []).filter(m => m.group_id === groupId)
}

async function saveClassSettings(cls) {
  savingClass.value = cls.id
  const state = editState[cls.id]
  const restrictions = { ...state.restrictions }
  if (!restrictions.tradeFrequency) delete restrictions.tradeFrequency

  const { error } = await supabase.from('classes').update({
    starting_cash: state.starting_cash,
    allow_reset: state.allow_reset,
    max_portfolios: state.max_portfolios,
    group_mode: state.group_mode,
    approval_code: state.approval_code || null,
    restrictions
  }).eq('id', cls.id)

  savingClass.value = null
  if (!error) {
    showSuccess('Settings saved')
    // Update local data
    Object.assign(cls, {
      starting_cash: state.starting_cash,
      allow_reset: state.allow_reset,
      max_portfolios: state.max_portfolios,
      group_mode: state.group_mode,
      approval_code: state.approval_code || null,
      restrictions
    })
  }
}

async function loadInvites(classId) {
  const { data } = await supabase
    .from('class_invites')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
  invites[classId] = data || []
  invitesLoaded[classId] = true
}

async function deleteInvite(classId, inviteId) {
  await supabase.from('class_invites').delete().eq('id', inviteId)
  invites[classId] = (invites[classId] || []).filter(i => i.id !== inviteId)
  showSuccess('Invite deleted')
}

function viewAsTeacher(cls) {
  router.push({ path: '/teacher', query: { class_id: cls.id } })
}

function confirmDelete(cls) {
  deleteTarget.value = cls
  showDeleteModal.value = true
}

async function deleteClass() {
  if (!deleteTarget.value) return
  await supabase.from('classes').delete().eq('id', deleteTarget.value.id)
  classes.value = classes.value.filter(c => c.id !== deleteTarget.value.id)
  showDeleteModal.value = false
}

function showSuccess(msg) {
  successMsg.value = msg
  setTimeout(() => { successMsg.value = '' }, 3000)
}
</script>
