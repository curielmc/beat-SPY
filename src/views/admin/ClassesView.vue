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
          <div class="space-y-3">
            <div class="flex gap-4 text-sm">
              <span>School: <strong>{{ cls.school || 'N/A' }}</strong></span>
              <span>Mode: <strong>{{ cls.group_mode }}</strong></span>
              <span>Approval Code: <strong>{{ cls.approval_code || 'None' }}</strong></span>
            </div>

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

            <div class="flex gap-2">
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'

const classes = ref([])
const loading = ref(true)
const showDeleteModal = ref(false)
const deleteTarget = ref(null)

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
  loading.value = false
}

function getGroupMembers(cls, groupId) {
  return (cls.memberships || []).filter(m => m.group_id === groupId)
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
</script>
