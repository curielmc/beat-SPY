<template>
  <div class="min-h-screen bg-gradient-to-br from-base-300 to-base-100 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <RouterView />
    </div>
  </div>
</template>

<script setup>
import { RouterView } from 'vue-router'
</script>
