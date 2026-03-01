<template>
  <div class="min-h-screen bg-gradient-to-br from-base-300 to-base-100 flex items-center justify-center p-4">
    <RouterLink to="/login" class="btn btn-ghost btn-sm absolute top-4 right-4">Log In</RouterLink>
    <div class="w-full max-w-md">
      <RouterView />
    </div>
  </div>
</template>

<script setup>
import { RouterView, RouterLink } from 'vue-router'
</script>
