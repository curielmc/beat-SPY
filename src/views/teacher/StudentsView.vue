<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          Student Progress
        </h1>
        <p class="text-base-content/70">View each group's performance, holdings, and allocation</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-outline btn-sm gap-2" @click="showCreateGroupModal = true">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Create Group
        </button>
        <button class="btn btn-primary btn-sm gap-2" @click="showOpenFundModal = true">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Open New Fund for Class
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <!-- Unassigned Students -->
      <div v-if="teacher.unassignedStudents.length > 0" class="card bg-warning/10 shadow border border-warning/30">
        <div class="card-body">
          <h2 class="card-title text-lg flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
            Unassigned Students ({{ teacher.unassignedStudents.length }})
          </h2>
          <p class="text-sm text-base-content/60 mb-3">These students signed up but haven't been assigned to a group yet.</p>
          <div v-if="assignError" class="alert alert-error text-sm mb-3">⚠️ {{ assignError }}</div>

          <div class="space-y-2">
            <div v-for="student in teacher.unassignedStudents" :key="student.id" class="flex items-center gap-3 bg-base-100 rounded-lg p-3">
              <span class="font-medium flex-1">{{ student.name }}</span>
              <select v-model="assignTargets[student.id]" class="select select-bordered select-sm w-48">
                <option value="">Select group...</option>
                <option v-for="group in teacher.groups" :key="group.id" :value="group.id">{{ group.name }}</option>
                <option value="__new__">+ Create new group</option>
              </select>
              <input
                v-if="assignTargets[student.id] === '__new__'"
                v-model="newGroupNames[student.id]"
                type="text"
                class="input input-bordered input-sm w-40"
                placeholder="Group name"
              />
              <button
                class="btn btn-primary btn-sm"
                :disabled="!assignTargets[student.id] || (assignTargets[student.id] === '__new__' && !newGroupNames[student.id]?.trim())"
                @click="handleAssign(student)"
              >Assign</button>
              <button class="btn btn-ghost btn-sm text-error" @click="openKickModal(student)" title="Remove student">X</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Kick Confirm Modal -->
      <dialog class="modal" :class="{ 'modal-open': showKickModal }">
        <div class="modal-box">
          <h3 class="font-bold text-lg mb-2">Remove Student</h3>
          <p class="text-base-content/60 mb-4">What would you like to do with <strong>{{ kickStudentName }}</strong>?</p>
          <div class="flex flex-col gap-2">
            <button class="btn btn-warning" @click="confirmKickFromGroup">Kick from Group</button>
            <p class="text-xs text-base-content/50 text-center">Removes from their group but they can be reassigned or rejoin</p>
            <div class="divider my-0"></div>
            <button class="btn btn-error" @click="confirmKick">Remove Permanently</button>
            <p class="text-xs text-base-content/50 text-center">Removes from the class entirely and blocks their email from rejoining</p>
          </div>
          <div class="modal-action">
            <button class="btn btn-ghost" @click="showKickModal = false">Cancel</button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop" @click="showKickModal = false"><button>close</button></form>
      </dialog>

      <!-- Award Cash Modal -->
      <dialog class="modal" :class="{ 'modal-open': showAwardModal }">
        <div class="modal-box">
          <h3 class="font-bold text-lg mb-4">Adjust Cash — {{ awardGroupName }}</h3>
          <!-- Target selector: group portfolio or a student's fund -->
          <div v-if="awardFundOptions.length > 0" class="form-control mb-4">
            <label class="label"><span class="label-text">Target</span></label>
            <select v-model="awardTargetId" class="select select-bordered w-full">
              <option :value="null">Group Portfolio</option>
              <option v-for="f in awardFundOptions" :key="f.id" :value="f.id">
                {{ f.studentName }} — {{ f.fund_name || 'Fund ' + (f.fund_number || 1) }}
              </option>
            </select>
          </div>
          <div class="flex gap-2 mb-4">
            <button class="btn flex-1" :class="awardType === 'add' ? 'btn-success' : 'btn-ghost'" @click="awardType = 'add'">+ Add Cash</button>
            <button class="btn flex-1" :class="awardType === 'subtract' ? 'btn-error' : 'btn-ghost'" @click="awardType = 'subtract'">− Subtract Cash</button>
          </div>
          <div class="form-control mb-4">
            <label class="label"><span class="label-text">Amount ($)</span></label>
            <input v-model.number="awardAmount" type="number" min="1" step="100" class="input input-bordered w-full" placeholder="e.g. 5000" />
          </div>
          <div class="modal-action">
            <button class="btn btn-ghost" @click="showAwardModal = false">Cancel</button>
            <button class="btn" :class="awardType === 'add' ? 'btn-success' : 'btn-error'" :disabled="!awardAmount || awardAmount <= 0" @click="confirmAward">
              {{ awardType === 'add' ? 'Add Cash' : 'Subtract Cash' }}
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop" @click="showAwardModal = false"><button>close</button></form>
      </dialog>

      <!-- Open New Fund for Class Modal -->
      <dialog class="modal" :class="{ 'modal-open': showOpenFundModal }">
        <div class="modal-box">
          <h3 class="font-bold text-lg mb-4">Open New Fund for Entire Class</h3>
          <p class="text-sm text-base-content/60 mb-4">This creates a new fund for every group in the class simultaneously.</p>
          <div class="form-control mb-3">
            <label class="label"><span class="label-text">Fund Name</span></label>
            <input v-model="openFundForm.name" type="text" placeholder="e.g. Sector Rotation Fund" class="input input-bordered" maxlength="50" />
          </div>
          <div class="form-control mb-3">
            <label class="label"><span class="label-text">Investment Thesis (optional)</span></label>
            <textarea v-model="openFundForm.thesis" placeholder="Describe the fund's strategy..." class="textarea textarea-bordered" rows="2" maxlength="280"></textarea>
          </div>
          <div class="form-control mb-3">
            <label class="label"><span class="label-text">Starting Cash ($)</span></label>
            <input v-model.number="openFundForm.cash" type="number" min="1000" step="1000" class="input input-bordered" />
          </div>
          <div class="modal-action">
            <button class="btn btn-ghost" @click="showOpenFundModal = false">Cancel</button>
            <button class="btn btn-primary" @click="handleOpenClassFund" :disabled="!openFundForm.name.trim() || openingFund">
              <span v-if="openingFund" class="loading loading-spinner loading-sm"></span>
              Open Fund
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop" @click="showOpenFundModal = false"><button>close</button></form>
      </dialog>

      <!-- Create Group Modal -->
      <dialog class="modal" :class="{ 'modal-open': showCreateGroupModal }">
        <div class="modal-box">
          <h3 class="font-bold text-lg mb-4">Create New Group</h3>
          <div class="form-control mb-4">
            <label class="label"><span class="label-text">Group Name</span></label>
            <input v-model="createGroupName" type="text" placeholder="e.g. Team Alpha" class="input input-bordered w-full" @keydown.enter="handleCreateGroup" />
          </div>
          <p v-if="createGroupError" class="text-error text-sm mb-2">{{ createGroupError }}</p>
          <div class="modal-action">
            <button class="btn btn-ghost" @click="showCreateGroupModal = false">Cancel</button>
            <button class="btn btn-primary" :disabled="!createGroupName.trim()" @click="handleCreateGroup">Create</button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop" @click="showCreateGroupModal = false"><button>close</button></form>
      </dialog>

      <!-- Delete Group Modal -->
      <dialog class="modal" :class="{ 'modal-open': showDeleteGroupModal }">
        <div class="modal-box">
          <h3 class="font-bold text-lg text-error mb-2">Delete Group</h3>
          <p class="mb-2">This will permanently delete <strong>{{ deleteGroupTarget?.name }}</strong> and its portfolio/holdings.</p>
          <p v-if="deleteGroupTarget?.members?.length" class="text-sm text-base-content/60 mb-4">{{ deleteGroupTarget.members.length }} member(s) will become unassigned.</p>
          <div class="modal-action">
            <button class="btn btn-ghost" @click="showDeleteGroupModal = false">Cancel</button>
            <button class="btn btn-error" :disabled="deletingGroup" @click="handleDeleteGroup">
              <span v-if="deletingGroup" class="loading loading-spinner loading-sm"></span>
              Delete Group
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop" @click="showDeleteGroupModal = false"><button>close</button></form>
      </dialog>

      <div v-if="awardSuccess" class="alert alert-success">
        <span>{{ awardSuccess }}</span>
      </div>
      <div v-if="lessonSuccess" class="alert alert-info">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
        <span>{{ lessonSuccess }}</span>
      </div>

      <!-- Per-group sections -->
      <div v-for="group in rankedGroups" :key="group.id" class="bg-base-100 shadow rounded-xl overflow-hidden">
        <div class="p-4 cursor-pointer select-none flex items-center justify-between" @click="toggleGroupExpand(group.id)">
          <div class="flex items-center justify-between pr-4">
            <div class="flex items-center gap-2">
              <!-- Inline rename -->
              <span v-if="editingGroupId === group.id" class="flex items-center gap-1" @click.stop>
                <input
                  v-model="editingGroupName"
                  type="text"
                  class="input input-bordered input-sm w-36 font-bold"
                  @keydown.enter.stop.prevent="saveGroupName(group)"
                  @click.stop
                  ref="groupNameInput"
                  autofocus
                />
                <button class="btn btn-primary btn-sm" @click.stop.prevent="saveGroupName(group)">Save</button>
                <button class="btn btn-ghost btn-sm" @click.stop.prevent="editingGroupId = null">✕</button>
              </span>
              <span v-else class="flex items-center gap-1">
                <span class="font-bold">{{ group.name }}</span>
                <button class="btn btn-ghost btn-xs px-1" @click.stop.prevent="startEditingName(group)" title="Rename group">✏️</button>
              </span>
              <span class="badge badge-sm" :class="group.returnPct >= 0 ? 'badge-success' : 'badge-error'">
                {{ group.returnPct >= 0 ? '+' : '' }}{{ group.returnPct.toFixed(2) }}%
              </span>
              <!-- Student configure toggle -->
              <label class="flex items-center gap-1 ml-2" @click.stop>
                <span class="text-xs text-base-content/60">Student edit</span>
                <input
                  type="checkbox"
                  class="toggle toggle-xs toggle-primary"
                  :checked="group.allow_student_configure"
                  @click.stop
                  @change="toggleStudentConfigure(group, $event.target.checked)"
                />
              </label>
            </div>
            <span class="text-sm text-base-content/60">{{ group.memberNames?.join(', ') }}</span>
          </div>
          <span class="text-base-content/40 text-lg">{{ expandedGroups.has(group.id) ? '▲' : '▼' }}</span>
        </div>
        <div v-show="expandedGroups.has(group.id)" class="px-4 pb-4">
          <!-- Members with transfer -->
          <div class="mb-3">
            <span class="text-sm text-base-content/60">Members: </span>
            <div class="flex flex-wrap gap-2 mt-1">
              <div v-for="s in group.members" :key="s.id" class="flex items-center gap-1 bg-base-200 rounded-lg px-2 py-1">
                <span class="text-sm font-medium">{{ s.name }}</span>
                <button
                  class="btn btn-ghost btn-xs text-info px-1"
                  :disabled="sendingLessonId === (s.user_id || s.id)"
                  @click="sendLesson(s.user_id || s.id, 'user')"
                  title="Send lesson to this student"
                >
                  <span v-if="sendingLessonId === (s.user_id || s.id)" class="loading loading-spinner loading-xs"></span>
                  <span v-else>📖</span>
                </button>
                <select
                  class="select select-ghost select-xs w-auto min-w-0 pl-1"
                  @change="handleTransfer(s, group.id, $event.target.value); $event.target.value = ''"
                >
                  <option value="" selected>Move...</option>
                  <option v-for="g in otherGroups(group.id)" :key="g.id" :value="g.id">{{ g.name }}</option>
                </select>
                <button class="btn btn-ghost btn-xs text-error px-1" @click="openKickModal(s)" title="Remove student">X</button>
              </div>
            </div>
          </div>

          <!-- Stats -->
          <div class="stats stats-vertical sm:stats-horizontal bg-base-200 rounded-lg w-full mb-4">
            <div class="stat py-2">
              <div class="stat-title text-xs">Portfolio Value</div>
              <div class="stat-value text-lg">${{ group.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
            </div>
            <div class="stat py-2">
              <div class="stat-title text-xs">Cash</div>
              <div class="stat-value text-lg">${{ (group.cash || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
            </div>
            <div class="stat py-2">
              <div class="stat-title text-xs">Return</div>
              <div class="stat-value text-lg" :class="group.returnPct >= 0 ? 'text-success' : 'text-error'">{{ group.returnPct >= 0 ? '+' : '' }}{{ group.returnPct.toFixed(2) }}%</div>
            </div>
          </div>

          <div class="flex gap-2 mb-4">
            <button class="btn btn-sm btn-success btn-outline" @click="openAwardModal(group)">$ Adjust Cash</button>
            <button
              class="btn btn-sm btn-info btn-outline gap-1"
              :disabled="sendingLessonId === group.id"
              @click="sendLesson(group.id, 'group')"
            >
              <span v-if="sendingLessonId === group.id" class="loading loading-spinner loading-xs"></span>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              Send Lesson
            </button>
            <button class="btn btn-sm btn-error btn-outline" @click="openDeleteGroupModal(group)">Delete Group</button>
          </div>

          <!-- Holdings Table -->
          <div class="overflow-x-auto">
            <table class="table table-sm table-zebra">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Ticker</th>
                  <th>Shares</th>
                  <th class="text-right">Avg Cost</th>
                  <th class="text-right">Current</th>
                  <th class="text-right">Market Value</th>
                  <th class="text-right">Gain/Loss</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in groupHoldings[group.id] || []" :key="h.ticker">
                  <td class="max-w-[150px] truncate font-semibold" :title="h.companyName">{{ h.companyName }}</td>
                  <td class="font-mono font-bold">{{ h.ticker }}</td>
                  <td>{{ Number(h.shares).toFixed(4) }}</td>
                  <td class="text-right font-mono">${{ Number(h.avg_cost).toFixed(2) }}</td>
                  <td class="text-right font-mono">${{ h.currentPrice.toFixed(2) }}</td>
                  <td class="text-right font-mono">${{ h.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                  <td class="text-right font-mono" :class="h.gainLoss >= 0 ? 'text-success' : 'text-error'">
                    {{ h.gainLoss >= 0 ? '+' : '' }}${{ h.gainLoss.toFixed(2) }}
                  </td>
                </tr>
                <tr v-if="!groupHoldings[group.id]?.length">
                  <td colspan="7" class="text-center text-base-content/50">No holdings yet</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Student Personal Funds -->
          <div v-if="studentFunds[group.id]?.length" class="mt-4">
            <h4 class="font-semibold text-sm mb-2">Student Personal Funds</h4>
            <div class="overflow-x-auto">
              <table class="table table-sm table-zebra">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Fund</th>
                    <th>Thesis</th>
                    <th class="text-right">Value</th>
                    <th class="text-right">Return</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="sf in studentFunds[group.id]" :key="sf.id">
                    <td class="text-sm">{{ sf.studentName }}</td>
                    <td class="text-sm font-semibold">{{ sf.fund_name || 'Fund ' + (sf.fund_number || 1) }}</td>
                    <td class="text-xs text-base-content/60 max-w-[200px] truncate">{{ sf.fund_thesis || '-' }}</td>
                    <td class="text-right font-mono">${{ Number(sf.cash_balance || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</td>
                    <td class="text-right font-mono text-base-content/50">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useTeacherStore } from '../../stores/teacher'
import { supabase } from '../../lib/supabase'

const teacher = useTeacherStore()

const loading = ref(true)
const rankedGroups = ref([])
const groupHoldings = reactive({})
const studentFunds = reactive({})
const assignTargets = reactive({})
const assignError = ref("")
const newGroupNames = reactive({})

// Inline group rename
const editingGroupId = ref(null)
const expandedGroups = ref(new Set())
function toggleGroupExpand(groupId) {
  if (expandedGroups.value.has(groupId)) {
    expandedGroups.value.delete(groupId)
  } else {
    expandedGroups.value.add(groupId)
  }
  expandedGroups.value = new Set(expandedGroups.value) // trigger reactivity
}
const editingGroupName = ref('')

function startEditingName(group) {
  editingGroupId.value = group.id
  editingGroupName.value = group.name
}

async function saveGroupName(group) {
  const newName = editingGroupName.value.trim()
  if (newName && newName !== group.name) {
    await supabase.from('groups').update({ name: newName }).eq('id', group.id)
    rankedGroups.value = await teacher.getRankedGroups()
  }
  editingGroupId.value = null
}

async function toggleStudentConfigure(group, checked) {
  await supabase.from('groups').update({ allow_student_configure: checked }).eq('id', group.id)
  group.allow_student_configure = checked
}

// Kick student
const showKickModal = ref(false)
const kickTarget = ref(null)
const kickStudentName = ref('')

// Award cash
const showAwardModal = ref(false)
const awardGroupId = ref(null)
const awardGroupName = ref('')
const awardType = ref("add")
const awardAmount = ref(null)
const awardSuccess = ref('')
const awardTargetId = ref(null)
const awardFundOptions = ref([])

// Create Group
const showCreateGroupModal = ref(false)
const createGroupName = ref('')
const createGroupError = ref('')

async function handleCreateGroup() {
  createGroupError.value = ''
  const currentClass = teacher.classes[0]
  if (!currentClass) return
  const result = await teacher.createGroup(currentClass.id, createGroupName.value.trim())
  if (result.error) {
    createGroupError.value = result.error
    return
  }
  showCreateGroupModal.value = false
  createGroupName.value = ''
  rankedGroups.value = await teacher.getRankedGroups()
}

// Send Lesson
const sendingLessonId = ref(null)
const lessonSuccess = ref('')

async function sendLesson(ownerId, ownerType) {
  sendingLessonId.value = ownerId
  lessonSuccess.value = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/send-lesson', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ owner_id: ownerId, owner_type: ownerType })
    })
    const result = await res.json()
    if (res.ok) {
      lessonSuccess.value = `Lesson sent: "${result.lesson_title}" (${result.difficulty})`
    } else {
      lessonSuccess.value = `Error: ${result.error || 'Failed to send lesson'}`
    }
    setTimeout(() => { lessonSuccess.value = '' }, 5000)
  } finally {
    sendingLessonId.value = null
  }
}

// Delete Group
const showDeleteGroupModal = ref(false)
const deleteGroupTarget = ref(null)
const deletingGroup = ref(false)

function openDeleteGroupModal(group) {
  deleteGroupTarget.value = group
  showDeleteGroupModal.value = true
}

async function handleDeleteGroup() {
  if (!deleteGroupTarget.value) return
  deletingGroup.value = true
  try {
    const groupId = deleteGroupTarget.value.id

    // Unassign members
    await supabase
      .from('class_memberships')
      .update({ group_id: null })
      .eq('group_id', groupId)

    // Delete group portfolio + holdings
    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('id')
      .eq('owner_type', 'group')
      .eq('owner_id', groupId)
      .maybeSingle()

    if (portfolio) {
      await supabase.from('holdings').delete().eq('portfolio_id', portfolio.id)
      await supabase.from('portfolios').delete().eq('id', portfolio.id)
    }

    // Delete the group
    await supabase.from('groups').delete().eq('id', groupId)

    showDeleteGroupModal.value = false
    await teacher.loadTeacherData()
    rankedGroups.value = await teacher.getRankedGroups()
  } finally {
    deletingGroup.value = false
  }
}

// Open New Fund for Class
const showOpenFundModal = ref(false)
const openingFund = ref(false)
const openFundForm = ref({ name: '', thesis: '', cash: 100000 })

async function handleOpenClassFund() {
  const currentClass = teacher.classes[0]
  if (!currentClass) return
  openingFund.value = true
  try {
    const { error } = await supabase.rpc('open_class_fund', {
      p_class_id: currentClass.id,
      p_fund_name: openFundForm.value.name.trim(),
      p_thesis: openFundForm.value.thesis.trim() || null,
      p_starting_cash: openFundForm.value.cash || 100000
    })
    if (error) {
      awardSuccess.value = `Error: ${error.message}`
      setTimeout(() => { awardSuccess.value = '' }, 5000)
      return
    }
    showOpenFundModal.value = false
    openFundForm.value = { name: '', thesis: '', cash: 100000 }
    awardSuccess.value = 'New fund opened for all groups!'
    setTimeout(() => { awardSuccess.value = '' }, 5000)
    // Reload data
    rankedGroups.value = await teacher.getRankedGroups()
  } finally {
    openingFund.value = false
  }
}

onMounted(async () => {
  await teacher.loadTeacherData()
  rankedGroups.value = await teacher.getRankedGroups()

  // Load holdings and student funds for each group
  for (const group of rankedGroups.value) {
    groupHoldings[group.id] = await teacher.getGroupHoldings(group.id)

    // Load personal funds for each member
    const funds = []
    for (const member of (group.members || [])) {
      const { data: memberFunds } = await supabase
        .from('portfolios')
        .select('*')
        .eq('owner_type', 'user')
        .eq('owner_id', member.user_id || member.id)
        .or('status.eq.active,status.is.null')
        .order('fund_number', { ascending: true })
      for (const f of (memberFunds || [])) {
        funds.push({ ...f, studentName: member.name })
      }
    }
    studentFunds[group.id] = funds
  }

  loading.value = false
})

function openKickModal(student) {
  kickTarget.value = student
  kickStudentName.value = student.name
  showKickModal.value = true
}

async function confirmKickFromGroup() {
  if (kickTarget.value) {
    await teacher.kickFromGroup(kickTarget.value.id)
    rankedGroups.value = await teacher.getRankedGroups()
  }
  showKickModal.value = false
  kickTarget.value = null
}

async function confirmKick() {
  if (kickTarget.value) {
    await teacher.kickStudent(kickTarget.value.id, kickTarget.value.class_id, kickTarget.value.email)
    rankedGroups.value = await teacher.getRankedGroups()
  }
  showKickModal.value = false
  kickTarget.value = null
}

function openAwardModal(group) {
  awardGroupId.value = group.id
  awardGroupName.value = group.name
  awardType.value = "add"
  awardAmount.value = null
  awardTargetId.value = null
  awardFundOptions.value = studentFunds[group.id] || []
  showAwardModal.value = true
}

async function confirmAward() {
  if (!awardAmount.value || awardAmount.value <= 0) return
  const finalAmount = awardType.value === "subtract" ? -awardAmount.value : awardAmount.value

  if (awardTargetId.value) {
    // Award to a specific student fund
    const { data: fundData } = await supabase
      .from('portfolios')
      .select('cash_balance')
      .eq('id', awardTargetId.value)
      .single()
    if (fundData) {
      await supabase
        .from('portfolios')
        .update({ cash_balance: Number(fundData.cash_balance) + finalAmount })
        .eq('id', awardTargetId.value)
    }
    awardSuccess.value = `${awardType.value === 'add' ? 'Added' : 'Subtracted'} $${awardAmount.value.toLocaleString()} ${awardType.value === 'add' ? 'to' : 'from'} student fund!`
  } else {
    // Award to group portfolio
    await teacher.awardBonusCash(awardGroupId.value, finalAmount)
    awardSuccess.value = `${awardType.value === 'add' ? 'Added' : 'Subtracted'} $${awardAmount.value.toLocaleString()} ${awardType.value === 'add' ? 'to' : 'from'} ${awardGroupName.value}!`
  }
  showAwardModal.value = false
  rankedGroups.value = await teacher.getRankedGroups()
  setTimeout(() => { awardSuccess.value = '' }, 5000)
}

async function handleAssign(student) {
  const target = assignTargets[student.id]
  if (!target) return
  assignError.value = ""

  if (target === '__new__') {
    const name = newGroupNames[student.id]?.trim()
    if (!name) return
    const currentClass = teacher.classes[0]
    if (!currentClass) return
    const result = await teacher.createGroup(currentClass.id, name)
    if (result.error) { assignError.value = result.error; return }
    const r2 = await teacher.assignStudentToGroup(student.id, result.group.id)
    if (r2?.error) { assignError.value = r2.error; return }
    delete newGroupNames[student.id]
  } else {
    const result = await teacher.assignStudentToGroup(student.id, target)
    if (result?.error) {
      console.error("Assign failed:", result.error)
      assignError.value = result.error
      return
    }
  }

  delete assignTargets[student.id]
  rankedGroups.value = await teacher.getRankedGroups()
}

function otherGroups(currentGroupId) {
  return teacher.groups.filter(g => g.id !== currentGroupId)
}

async function handleTransfer(student, fromGroupId, toGroupId) {
  if (!toGroupId) return
  await teacher.moveStudentToGroup(student.id, toGroupId)
  rankedGroups.value = await teacher.getRankedGroups()
}
</script>
