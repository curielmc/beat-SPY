<template>
  <div class="flex h-[calc(100vh-64px)] overflow-hidden">

    <!-- Left panel: recipients list -->
    <div class="w-64 flex-shrink-0 border-r border-base-300 flex flex-col bg-base-100">
      <div class="p-3 border-b border-base-300">
        <h2 class="font-bold text-sm">Messages</h2>
      </div>

      <div class="overflow-y-auto flex-1 p-2 space-y-1">
        <!-- Broadcast to class -->
        <button
          class="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
          :class="selected?.type === 'class' ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
          @click="selectRecipient({ type: 'class', id: currentClassId, label: '📢 All Students' })"
        >
          <span>📢</span>
          <span class="font-medium">All Students</span>
        </button>

        <!-- Groups -->
        <div class="pt-2">
          <p class="text-xs text-base-content/40 px-3 pb-1 uppercase tracking-wide">Groups</p>
          <button
            v-for="g in groups"
            :key="g.id"
            class="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
            :class="selected?.id === g.id && selected?.type === 'group' ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
            @click="selectRecipient({ type: 'group', id: g.id, label: g.name })"
          >
            <span>👥</span>
            <span>{{ g.name }}</span>
          </button>
        </div>

        <!-- Individuals -->
        <div class="pt-2">
          <p class="text-xs text-base-content/40 px-3 pb-1 uppercase tracking-wide">Students</p>
          <button
            v-for="s in students"
            :key="s.id"
            class="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
            :class="selected?.id === s.user_id && selected?.type === 'user' ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
            @click="selectRecipient({ type: 'user', id: s.user_id, label: s.name })"
          >
            <span>👤</span>
            <span class="truncate">{{ s.name }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Right panel: conversation -->
    <div class="flex-1 flex flex-col bg-base-50 min-w-0">
      <!-- Header -->
      <div v-if="selected" class="p-4 border-b border-base-300 bg-base-100 flex items-center gap-3">
        <div>
          <p class="font-bold">{{ selected.label }}</p>
          <p class="text-xs text-base-content/50">
            {{ selected.type === 'class' ? 'Message visible to all students' :
               selected.type === 'group' ? 'Message visible to all group members' :
               'Direct message' }}
          </p>
        </div>
      </div>
      <div v-else class="p-4 border-b border-base-300 bg-base-100">
        <p class="text-base-content/50 text-sm">Select a recipient to start messaging</p>
      </div>

      <!-- Messages thread -->
      <div ref="threadEl" class="flex-1 overflow-y-auto p-4 space-y-3">
        <div v-if="loadingMessages" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md"></span>
        </div>
        <template v-else-if="thread.length">
          <div
            v-for="msg in thread"
            :key="msg.id"
            class="flex"
            :class="msg.sender_id === currentTeacherId ? 'justify-end' : 'justify-start'"
          >
            <div class="max-w-xs lg:max-w-md">
              <div
                class="rounded-2xl px-4 py-2 text-sm"
                :class="msg.sender_id === currentTeacherId
                  ? 'bg-primary text-primary-content rounded-tr-sm'
                  : 'bg-base-200 text-base-content rounded-tl-sm'"
              >
                <p v-if="msg.sender_id !== currentTeacherId" class="text-xs font-semibold mb-1 opacity-60">
                  {{ memberNames[msg.sender_id] || 'Student' }}
                </p>
                <p>{{ msg.content }}</p>
              </div>
              <p class="text-xs text-base-content/40 mt-1 px-1"
                :class="msg.sender_id === currentTeacherId ? 'text-right' : 'text-left'">
                {{ formatTime(msg.created_at) }}
              </p>
            </div>
          </div>
        </template>
        <p v-else-if="selected" class="text-center text-base-content/40 text-sm py-8">No messages yet. Send one below.</p>
      </div>

      <!-- Compose box -->
      <div v-if="selected" class="p-3 border-t border-base-300 bg-base-100">
        <div class="flex gap-2">
          <textarea
            v-model="draft"
            rows="2"
            class="textarea textarea-bordered flex-1 resize-none text-sm"
            :placeholder="`Message ${selected.label}...`"
            @keydown.enter.exact.prevent="send"
          ></textarea>
          <button
            class="btn btn-primary btn-sm self-end"
            :disabled="!draft.trim() || sending"
            @click="send"
          >
            <span v-if="sending" class="loading loading-spinner loading-xs"></span>
            <span v-else>Send</span>
          </button>
        </div>
        <p class="text-xs text-base-content/40 mt-1">Enter to send</p>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const route = useRoute()
const currentTeacherId = computed(() => auth.currentUser?.id)
const currentClassId = computed(() => route.query.class_id || auth.activeClassId || auth.membership?.class_id || null)

const groups = ref([])
const students = ref([])
const selected = ref(null)
const thread = ref([])
const draft = ref('')
const sending = ref(false)
const loadingMessages = ref(false)
const threadEl = ref(null)
const memberNames = ref({})
let realtimeSub = null

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

async function loadRecipients() {
  if (!currentClassId.value) {
    groups.value = []
    students.value = []
    return
  }
  const [{ data: groupData }, { data: memberData }] = await Promise.all([
    supabase.from('groups').select('id, name').eq('class_id', currentClassId.value),
    supabase.from('class_memberships').select('user_id, profiles:profiles(full_name, email)').eq('class_id', currentClassId.value)
  ])
  groups.value = groupData || []
  students.value = (memberData || []).map(m => ({
    user_id: m.user_id,
    name: m.profiles?.full_name || m.profiles?.email || 'Unknown'
  })).sort((a, b) => a.name.localeCompare(b.name))
}

async function selectRecipient(r) {
  selected.value = r
  await loadThread()
  subscribeRealtime()
}

async function loadThread() {
  if (!selected.value) return
  if (!currentClassId.value) return
  loadingMessages.value = true
  thread.value = []

  let msgs = []

  if (selected.value.type === 'class') {
    const { data } = await supabase.from('messages').select('id, content, created_at, recipient_type, recipient_id, sender_id')
      .eq('class_id', currentClassId.value).eq('recipient_type', 'class').order('created_at', { ascending: true })
    msgs = data || []
  } else if (selected.value.type === 'group') {
    // Teacher → group messages + student → teacher messages from group members
    const { data: toGroup } = await supabase.from('messages').select('id, content, created_at, recipient_type, recipient_id, sender_id')
      .eq('class_id', currentClassId.value).eq('recipient_type', 'group').eq('recipient_id', selected.value.id)
    // Get group member ids
    const { data: members } = await supabase.from('class_memberships').select('user_id, profiles:profiles(full_name)').eq('group_id', selected.value.id)
    const memberIds = (members || []).map(m => m.user_id)
    memberNames.value = Object.fromEntries((members || []).map(m => [m.user_id, m.profiles?.full_name || 'Student']))
    const { data: fromGroup } = memberIds.length
      ? await supabase.from('messages').select('id, content, created_at, recipient_type, recipient_id, sender_id')
          .eq('class_id', currentClassId.value).in('sender_id', memberIds)
      : { data: [] }
    msgs = [...(toGroup || []), ...(fromGroup || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  } else {
    // Direct: teacher → student + student → teacher
    const { data: toUser } = await supabase.from('messages').select('id, content, created_at, recipient_type, recipient_id, sender_id')
      .eq('class_id', currentClassId.value).eq('recipient_type', 'user').eq('recipient_id', selected.value.id)
    const { data: fromUser } = await supabase.from('messages').select('id, content, created_at, recipient_type, recipient_id, sender_id')
      .eq('class_id', currentClassId.value).eq('sender_id', selected.value.id)
    msgs = [...(toUser || []), ...(fromUser || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  }

  thread.value = msgs
  loadingMessages.value = false
  scrollToBottom()
}

function subscribeRealtime() {
  if (realtimeSub) supabase.removeChannel(realtimeSub)

  realtimeSub = supabase
    .channel('messages-teacher')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `class_id=eq.${currentClassId.value}`
    }, (payload) => {
      const msg = payload.new
      const s = selected.value
      if (!s) return
      const matches =
        (s.type === 'class' && msg.recipient_type === 'class') ||
        (s.type !== 'class' && msg.recipient_type === s.type && msg.recipient_id === s.id)
      if (matches) {
        thread.value.push(msg)
        scrollToBottom()
      }
    })
    .subscribe()
}

async function send() {
  if (!draft.value.trim() || !selected.value) return
  sending.value = true
  const content = draft.value.trim()
  draft.value = ''

  await supabase.from('messages').insert({
    class_id: currentClassId.value,
    sender_id: auth.currentUser.id,
    recipient_type: selected.value.type,
    recipient_id: selected.value.type === 'class' ? null : selected.value.id,
    content
  })

  sending.value = false
}

function scrollToBottom() {
  nextTick(() => {
    if (threadEl.value) threadEl.value.scrollTop = threadEl.value.scrollHeight
  })
}

async function hydrateFromRoute() {
  await loadRecipients()
  if (route.query.recipient === 'class' && currentClassId.value) {
    await selectRecipient({ type: 'class', id: currentClassId.value, label: '📢 All Students' })
    return
  }
  const groupId = route.query.group_id
  if (groupId) {
    const group = groups.value.find(g => g.id === groupId)
    if (group) {
      await selectRecipient({ type: 'group', id: group.id, label: group.name })
      return
    }
  }
}

onMounted(hydrateFromRoute)
watch(() => [route.query.class_id, route.query.group_id, route.query.recipient], async () => {
  selected.value = null
  thread.value = []
  await hydrateFromRoute()
})
onUnmounted(() => { if (realtimeSub) supabase.removeChannel(realtimeSub) })
</script>
