<template>
  <div class="flex h-[calc(100vh-120px)] overflow-hidden">

    <!-- Left panel: conversations -->
    <div class="w-56 flex-shrink-0 border-r border-base-300 flex flex-col bg-base-100">
      <div class="p-3 border-b border-base-300">
        <h2 class="font-bold text-sm">Messages</h2>
      </div>
      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        <!-- Teacher inbox (messages received from teacher) -->
        <button
          class="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
          :class="activeThread === 'teacher-inbox' ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
          @click="activeThread = 'teacher-inbox'; loadThread()"
        >
          <span>👩‍🏫</span>
          <span class="flex-1">From Teacher</span>
          <span v-if="unreadCount > 0" class="badge badge-xs badge-primary">{{ unreadCount }}</span>
        </button>

        <!-- Message group -->
        <button
          v-if="myGroup"
          class="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
          :class="activeThread === 'group' ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
          @click="activeThread = 'group'; loadThread()"
        >
          <span>👥</span>
          <span class="truncate">{{ myGroup.name }}</span>
        </button>

        <!-- Message teacher -->
        <button
          v-if="teacherId"
          class="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
          :class="activeThread === 'teacher-dm' ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
          @click="activeThread = 'teacher-dm'; loadThread()"
        >
          <span>✉️</span>
          <span>Message Teacher</span>
        </button>
      </div>
    </div>

    <!-- Right panel: thread -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Header -->
      <div class="p-4 border-b border-base-300 bg-base-100">
        <p class="font-bold text-sm">
          {{ activeThread === 'teacher-inbox' ? '📬 Messages from Teacher' :
             activeThread === 'group' ? `👥 ${myGroup?.name}` :
             '✉️ Direct to Teacher' }}
        </p>
        <p class="text-xs text-base-content/50">
          {{ activeThread === 'teacher-inbox' ? 'Read-only — replies go via "Message Teacher"' :
             activeThread === 'group' ? 'Visible to all group members' :
             'Private — only teacher sees this' }}
        </p>
      </div>

      <!-- Thread -->
      <div ref="threadEl" class="flex-1 overflow-y-auto p-4 space-y-3">
        <div v-if="loadingMessages" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md"></span>
        </div>
        <template v-else-if="thread.length">
          <div
            v-for="msg in thread"
            :key="msg.id"
            class="flex"
            :class="msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'"
            @click="markRead(msg)"
          >
            <div class="max-w-xs lg:max-w-md">
              <div
                class="rounded-2xl px-4 py-2 text-sm"
                :class="msg.sender_id === currentUserId
                  ? 'bg-primary text-primary-content rounded-tr-sm'
                  : 'bg-base-200 text-base-content rounded-tl-sm'"
              >
                <p class="text-xs font-semibold mb-1 opacity-70">
                  {{ msg.sender_id === currentUserId ? 'You' : (msg.sender_id ? (senderNames[msg.sender_id] || 'Teacher') : 'Market Spy AI') }}
                </p>
                <p>{{ msg.content }}</p>
                <!-- Difficulty toggle for AI lesson messages -->
                <div v-if="!msg.sender_id && msg.content.includes('Weekly Lesson:')" class="flex gap-2 mt-2 pt-2 border-t border-base-content/10">
                  <button
                    class="btn btn-xs gap-1"
                    :class="lessonDifficulty === 'basic' ? 'btn-disabled opacity-50' : 'btn-outline btn-warning'"
                    :disabled="lessonDifficulty === 'basic' || updatingDifficulty"
                    @click.stop="setDifficulty('basic')"
                  >
                    <span v-if="updatingDifficulty === 'basic'" class="loading loading-spinner loading-xs"></span>
                    <span v-else>&#x1F4D6;</span> Too Advanced
                  </button>
                  <button
                    class="btn btn-xs gap-1"
                    :class="lessonDifficulty === 'advanced' ? 'btn-disabled opacity-50' : 'btn-outline btn-info'"
                    :disabled="lessonDifficulty === 'advanced' || updatingDifficulty"
                    @click.stop="setDifficulty('advanced')"
                  >
                    <span v-if="updatingDifficulty === 'advanced'" class="loading loading-spinner loading-xs"></span>
                    <span v-else>&#x1F680;</span> Too Basic
                  </button>
                  <span v-if="difficultyUpdated" class="text-xs text-success self-center ml-1">Updated!</span>
                </div>
              </div>
              <div class="flex items-center gap-1 mt-1 px-1"
                :class="msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'">
                <p class="text-xs text-base-content/40">{{ formatTime(msg.created_at) }}</p>
                <span v-if="isUnread(msg)" class="w-2 h-2 rounded-full bg-primary inline-block"></span>
              </div>
            </div>
          </div>
        </template>
        <p v-else class="text-center text-base-content/40 text-sm py-8">No messages yet.</p>
      </div>

      <!-- Compose (not shown for teacher-inbox read-only view) -->
      <div v-if="activeThread !== 'teacher-inbox'" class="p-3 border-t border-base-300 bg-base-100">
        <div class="flex gap-2">
          <textarea
            v-model="draft"
            rows="2"
            class="textarea textarea-bordered flex-1 resize-none text-sm"
            :placeholder="activeThread === 'group' ? 'Message your group...' : 'Message your teacher...'"
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
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const currentUserId = computed(() => auth.currentUser?.id)

const myGroup = ref(null)
const currentClassId = ref(null)
const teacherId = ref(null)
const senderNames = ref({})

const activeThread = ref('teacher-inbox')
const thread = ref([])
const readIds = ref(new Set())
const draft = ref('')
const sending = ref(false)
const loadingMessages = ref(false)
const threadEl = ref(null)
const lessonDifficulty = ref('basic')
const updatingDifficulty = ref(null)
const difficultyUpdated = ref(false)
let realtimeSub = null

const unreadCount = computed(() =>
  thread.value.filter(m => activeThread.value === 'teacher-inbox' && isUnread(m)).length
)

function isUnread(msg) { return !readIds.value.has(msg.id) && msg.sender_id !== currentUserId.value }
function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

async function markRead(msg) {
  if (!isUnread(msg)) return
  readIds.value.add(msg.id)
  await supabase.from('message_reads').insert({ message_id: msg.id, user_id: currentUserId.value })
}

async function loadThread() {
  if (!currentClassId.value) return
  loadingMessages.value = true
  thread.value = []

  let data = []
  if (activeThread.value === 'teacher-inbox') {
    // Messages FROM teacher TO me, my group, or whole class
    const groupId = myGroup.value?.id
    const { data: msgs } = await supabase.from('messages').select('*')
      .eq('class_id', currentClassId.value)
      .order('created_at', { ascending: true })
    // Filter client-side (RLS handles actual access)
    data = (msgs || []).filter(m =>
      (m.recipient_type === 'class') ||
      (m.recipient_type === 'group' && m.recipient_id === groupId) ||
      (m.recipient_type === 'user' && m.recipient_id === currentUserId.value)
    )
  } else if (activeThread.value === 'group') {
    // Messages to/from this group
    const { data: msgs } = await supabase.from('messages').select('*')
      .eq('recipient_type', 'group')
      .eq('recipient_id', myGroup.value?.id)
      .order('created_at', { ascending: true })
    data = msgs || []
  } else if (activeThread.value === 'teacher-dm') {
    // Messages I sent to teacher + messages teacher sent to me directly
    const { data: sent } = await supabase.from('messages').select('*')
      .eq('sender_id', currentUserId.value)
      .eq('recipient_type', 'user')
      .eq('recipient_id', teacherId.value)
    const { data: received } = await supabase.from('messages').select('*')
      .eq('recipient_type', 'user')
      .eq('recipient_id', currentUserId.value)
    data = [...(sent || []), ...(received || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  }

  thread.value = data

  // Load read receipts
  const ids = data.map(m => m.id)
  if (ids.length) {
    const { data: reads } = await supabase.from('message_reads')
      .select('message_id').eq('user_id', currentUserId.value).in('message_id', ids)
    readIds.value = new Set((reads || []).map(r => r.message_id))
  }

  loadingMessages.value = false
  scrollToBottom()
}

async function send() {
  if (!draft.value.trim() || !currentClassId.value) return
  sending.value = true
  const content = draft.value.trim()
  draft.value = ''

  await supabase.from('messages').insert({
    class_id: currentClassId.value,
    sender_id: currentUserId.value,
    recipient_type: activeThread.value === 'group' ? 'group' : 'user',
    recipient_id: activeThread.value === 'group' ? myGroup.value?.id : teacherId.value,
    content
  })

  sending.value = false
}

function subscribeRealtime() {
  realtimeSub = supabase
    .channel('student-inbox')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const msg = payload.new
      const gid = myGroup.value?.id
      const relevant =
        (activeThread.value === 'teacher-inbox' && (
          msg.recipient_type === 'class' ||
          (msg.recipient_type === 'group' && msg.recipient_id === gid) ||
          (msg.recipient_type === 'user' && msg.recipient_id === currentUserId.value)
        )) ||
        (activeThread.value === 'group' && msg.recipient_type === 'group' && msg.recipient_id === gid) ||
        (activeThread.value === 'teacher-dm' && (
          (msg.sender_id === currentUserId.value && msg.recipient_id === teacherId.value) ||
          (msg.recipient_id === currentUserId.value)
        ))
      if (relevant) { thread.value.push(msg); scrollToBottom() }
    })
    .subscribe()
}

function scrollToBottom() {
  nextTick(() => { if (threadEl.value) threadEl.value.scrollTop = threadEl.value.scrollHeight })
}

async function loadLessonPreference() {
  const { data } = await supabase.from('user_lesson_preferences')
    .select('difficulty').eq('user_id', currentUserId.value).single()
  if (data) lessonDifficulty.value = data.difficulty
}

async function setDifficulty(level) {
  updatingDifficulty.value = level
  difficultyUpdated.value = false
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { updatingDifficulty.value = null; return }

  const res = await fetch('/api/lesson-difficulty', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ difficulty: level })
  })

  if (res.ok) {
    lessonDifficulty.value = level
    difficultyUpdated.value = true
    setTimeout(() => { difficultyUpdated.value = false }, 3000)
  }
  updatingDifficulty.value = null
}

async function loadMeta() {
  const membership = await auth.getCurrentMembership()
  if (membership?.class_id) {
    currentClassId.value = membership.class_id
    if (membership.group_id) {
       myGroup.value = membership.group
    }
  }

  // Get teacher id
  const { data: teacher } = await supabase.from('profiles')
    .select('id, full_name').eq('role', 'teacher').single()
  if (teacher) { teacherId.value = teacher.id; senderNames.value[teacher.id] = teacher.full_name || 'Teacher' }

  if (currentClassId.value) {
    await loadThread()
    subscribeRealtime()
  }
  await loadLessonPreference()
}

onMounted(loadMeta)
onUnmounted(() => { if (realtimeSub) supabase.removeChannel(realtimeSub) })

defineExpose({ unreadCount })
</script>
