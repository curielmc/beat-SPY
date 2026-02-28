<template>
  <div ref="buttonRef"></div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { GOOGLE_CLIENT_ID } from '../config'

const emit = defineEmits(['credential'])
const buttonRef = ref(null)

onMounted(() => {
  if (!GOOGLE_CLIENT_ID || typeof google === 'undefined') return

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => {
      emit('credential', response.credential)
    }
  })

  google.accounts.id.renderButton(buttonRef.value, {
    theme: 'outline',
    size: 'large',
    width: '100%',
    text: 'signin_with'
  })
})
</script>
