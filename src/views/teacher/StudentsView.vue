<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Student Progress</h1>
      <p class="text-base-content/70">View each group's performance, holdings, and allocation</p>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <!-- Unassigned Students -->
      <div v-if="teacher.unassignedStudents.length > 0" class="card bg-warning/10 shadow border border-warning/30">
        <div class="card-body">
          <h2 class="card-title text-lg">Unassigned Students ({{ teacher.unassignedStudents.length }})</h2>
          <p class="text-sm text-base-content/60 mb-3">These students signed up but haven't been assigned to a group yet.</p>

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
          <h3 class="font-bold text-lg mb-4">Award Bonus Cash</h3>
          <p class="text-base-content/60 mb-4">Award bonus cash to <strong>{{ awardGroupName }}</strong></p>
          <div class="form-control mb-4">
            <label class="label"><span class="label-text">Amount ($)</span></label>
            <input v-model.number="awardAmount" type="number" min="1" step="100" class="input input-bordered w-full" placeholder="e.g. 5000" />
          </div>
          <div class="modal-action">
            <button class="btn btn-ghost" @click="showAwardModal = false">Cancel</button>
            <button class="btn btn-success" :disabled="!awardAmount || awardAmount <= 0" @click="confirmAward">Award</button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop" @click="showAwardModal = false"><button>close</button></form>
      </dialog>

      <div v-if="awardSuccess" class="alert alert-success">
        <span>{{ awardSuccess }}</span>
      </div>

      <!-- Per-group sections -->
      <div v-for="group in rankedGroups" :key="group.id" class="collapse collapse-arrow bg-base-100 shadow">
        <input type="checkbox" />
        <div class="collapse-title">
          <div class="flex items-center justify-between pr-4">
            <div class="flex items-center gap-2">
              <!-- Inline rename -->
              <input
                v-if="editingGroupId === group.id"
                v-model="editingGroupName"
                type="text"
                class="input input-bordered input-sm w-40 font-bold"
                @blur="saveGroupName(group)"
                @keydown.enter="$event.target.blur()"
                @click.stop
                ref="groupNameInput"
              />
              <span v-else class="font-bold cursor-pointer hover:underline" @click.stop="startEditingName(group)">{{ group.name }}</span>
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
                  @change="toggleStudentConfigure(group, $event.target.checked)"
                />
              </label>
            </div>
            <span class="text-sm text-base-content/60">{{ group.memberNames?.join(', ') }}</span>
          </div>
        </div>
        <div class="collapse-content">
          <!-- Members with transfer -->
          <div class="mb-3">
            <span class="text-sm text-base-content/60">Members: </span>
            <div class="flex flex-wrap gap-2 mt-1">
              <div v-for="s in group.members" :key="s.id" class="flex items-center gap-1 bg-base-200 rounded-lg px-2 py-1">
                <span class="text-sm font-medium">{{ s.name }}</span>
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

          <button class="btn btn-sm btn-success btn-outline mb-4" @click="openAwardModal(group)">$ Award Bonus Cash</button>

          <!-- Holdings Table -->
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
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
                  <td colspan="6" class="text-center text-base-content/50">No holdings yet</td>
                </tr>
              </tbody>
            </table>
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
const assignTargets = reactive({})
const newGroupNames = reactive({})

// Inline group rename
const editingGroupId = ref(null)
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
const awardAmount = ref(null)
const awardSuccess = ref('')

onMounted(async () => {
  await teacher.loadTeacherData()
  rankedGroups.value = await teacher.getRankedGroups()

  // Load holdings for each group
  for (const group of rankedGroups.value) {
    groupHoldings[group.id] = await teacher.getGroupHoldings(group.id)
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
  awardAmount.value = null
  showAwardModal.value = true
}

async function confirmAward() {
  if (!awardGroupId.value || !awardAmount.value || awardAmount.value <= 0) return
  await teacher.awardBonusCash(awardGroupId.value, awardAmount.value)
  awardSuccess.value = `Awarded $${awardAmount.value.toLocaleString()} to ${awardGroupName.value}!`
  showAwardModal.value = false
  rankedGroups.value = await teacher.getRankedGroups()
  setTimeout(() => { awardSuccess.value = '' }, 5000)
}

async function handleAssign(student) {
  const target = assignTargets[student.id]
  if (!target) return

  if (target === '__new__') {
    const name = newGroupNames[student.id]?.trim()
    if (!name) return
    const currentClass = teacher.classes[0]
    if (!currentClass) return
    const result = await teacher.createGroup(currentClass.id, name)
    if (result.error) return
    await teacher.assignStudentToGroup(student.id, result.group.id)
    delete newGroupNames[student.id]
  } else {
    await teacher.assignStudentToGroup(student.id, target)
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
