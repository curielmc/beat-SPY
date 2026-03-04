<template>
  <div class="p-4 space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="font-bold text-lg">📬 Messages from Teacher</h2>
      <span v-if="unreadCount" class="badge badge-primary">{{ unreadCount }} new</span>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-md"></span>
    </div>

    <div v-else-if="messages.length" class="space-y-3">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="p-4 rounded-xl border transition-colors"
        :class="isUnread(msg) ? 'border-primary/40 bg-primary/5' : 'border-base-200 bg-base-100'"
        @click="markRead(msg)"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-semibold text-primary">
                {{ recipientLabel(msg) }}
              </span>
              <span v-if="isUnread(msg)" class="badge badge-xs badge-primary">New</span>
            </div>
            <p class="text-sm">{{ msg.content }}</p>
          </div>
          <p class="text-xs text-base-content/40 whitespace-nowrap flex-shrink-0">{{ formatTime(msg.created_at) }}</p>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-12 text-base-content/40">
      <p class="text-4xl mb-2">📭</p>
      <p class="text-sm">No messages yet</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const messages = ref([])
const readIds = ref(new Set())
const loading = ref(true)
let realtimeSub = null

const unreadCount = computed(() => messages.value.filter(m => isUnread(m)).length)

function isUnread(msg) { return !readIds.value.has(msg.id) }

function recipientLabel(msg) {
  if (msg.recipient_type === 'class') return '📢 Whole Class'
  if (msg.recipient_type === 'group') return '👥 Your Group'
  return '👤 You'
}

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

async function markRead(msg) {
  if (readIds.value.has(msg.id)) return
  readIds.value.add(msg.id)
  await supabase.from('message_reads').insert({ message_id: msg.id, user_id: auth.currentUser.id }).then(() => {})
}

async function markAllRead() {
  for (const msg of messages.value) await markRead(msg)
}

async function load() {
  loading.value = true
  const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false })
  messages.value = data || []

  // Load read receipts
  const { data: reads } = await supabase.from('message_reads').select('message_id').eq('user_id', auth.currentUser.id)
  readIds.value = new Set((reads || []).map(r => r.message_id))
  loading.value = false
}

function subscribeRealtime() {
  realtimeSub = supabase
    .channel('student-messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      messages.value.unshift(payload.new)
    })
    .subscribe()
}

onMounted(() => { load(); subscribeRealtime() })
onUnmounted(() => { if (realtimeSub) supabase.removeChannel(realtimeSub) })

defineExpose({ unreadCount, markAllRead })
</script>
