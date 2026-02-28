<template>
  <dialog ref="dialogRef" class="modal" :class="{ 'modal-open': show }">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-2">Welcome, {{ name }}!</h3>
      <p class="text-base-content/70 mb-6">We don't have an account for <strong>{{ email }}</strong>. Are you a student or a teacher?</p>

      <div class="flex gap-3">
        <button class="btn btn-primary flex-1" @click="$emit('select', 'student')">I'm a Student</button>
        <button class="btn btn-secondary flex-1" @click="$emit('select', 'teacher')">I'm a Teacher</button>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost btn-sm" @click="$emit('close')">Cancel</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="$emit('close')">
      <button>close</button>
    </form>
  </dialog>
</template>

<script setup>
defineProps({
  show: Boolean,
  name: String,
  email: String
})
defineEmits(['select', 'close'])
</script>
