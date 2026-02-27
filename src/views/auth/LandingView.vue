<template>
  <div class="text-center space-y-8">
    <div class="space-y-2">
      <h1 class="text-4xl font-bold text-primary">Beat the S&P</h1>
      <p class="text-base-content/70">Build a portfolio. Compete with your class. Outperform the market.</p>
    </div>

    <div class="card bg-base-100 shadow-xl">
      <div class="card-body space-y-4">
        <div class="stats stats-vertical bg-base-200 rounded-xl">
          <div class="stat">
            <div class="stat-title">S&P 500 YTD Return</div>
            <div class="stat-value text-success">+8.42%</div>
            <div class="stat-desc">Can you beat it?</div>
          </div>
        </div>

        <RouterLink to="/signup" class="btn btn-primary btn-block">Sign Up with Class Code</RouterLink>
        <RouterLink to="/login" class="btn btn-ghost btn-block">Log In</RouterLink>

        <div class="divider text-xs">OR</div>
        <RouterLink to="/teacher-login" class="btn btn-outline btn-sm btn-block">Are you a teacher? Log in here</RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>
