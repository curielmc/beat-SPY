<template>
  <div class="form-control w-full">
    <label v-if="!compact" class="label pb-1">
      <span class="label-text font-medium">Student invite link</span>
      <span class="label-text-alt text-base-content/60">Students who open it sign up straight into this class</span>
    </label>
    <div class="join w-full">
      <input
        :value="url"
        readonly
        class="input input-bordered input-sm join-item flex-1 min-w-0 font-mono text-xs"
        aria-label="Student invite link"
        @focus="$event.target.select()"
      />
      <button class="btn btn-primary btn-sm join-item" @click="copy">{{ copied ? 'Copied!' : 'Copy link' }}</button>
      <a class="btn btn-outline btn-sm join-item" :href="mailto">Email it</a>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  code: { type: String, required: true },
  className: { type: String, default: '' },
  compact: { type: Boolean, default: false }
})

const url = computed(() => `${window.location.origin}/signup?class=${encodeURIComponent(props.code)}`)

const mailto = computed(() => {
  const name = props.className || 'our class'
  const subject = `Join ${name} on Beat the S&P 500`
  const body = `Hi,\n\nUse this link to create your account and join ${name}:\n${url.value}\n\nIf asked, the class code is ${props.code}.\n`
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
})

const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(url.value)
  } catch {
    return
  }
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>
