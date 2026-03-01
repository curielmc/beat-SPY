<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Admin Dashboard</h1>
      <p class="text-base-content/70">Platform overview and statistics</p>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <div class="stats shadow bg-base-100 w-full flex-wrap">
        <div class="stat">
          <div class="stat-title">Total Users</div>
          <div class="stat-value">{{ stats.totalUsers }}</div>
          <div class="stat-desc">{{ stats.students }} students, {{ stats.teachers }} teachers</div>
        </div>
        <div class="stat">
          <div class="stat-title">Classes</div>
          <div class="stat-value">{{ stats.totalClasses }}</div>
        </div>
        <div class="stat">
          <div class="stat-title">Portfolios</div>
          <div class="stat-value">{{ stats.totalPortfolios }}</div>
        </div>
        <div class="stat">
          <div class="stat-title">Trades Executed</div>
          <div class="stat-value">{{ stats.totalTrades }}</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h2 class="card-title text-lg">Users by Role</h2>
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <span>Students</span>
                <span class="badge badge-primary">{{ stats.students }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span>Teachers</span>
                <span class="badge badge-secondary">{{ stats.teachers }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span>Admins</span>
                <span class="badge badge-error">{{ stats.admins }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h2 class="card-title text-lg">Recent Activity</h2>
            <div v-if="recentTrades.length === 0" class="text-base-content/50">No trades yet</div>
            <div v-for="trade in recentTrades" :key="trade.id" class="flex justify-between items-center text-sm border-b border-base-200 pb-1">
              <div>
                <span class="font-mono font-bold">{{ trade.ticker }}</span>
                <span class="badge badge-xs ml-1" :class="trade.side === 'buy' ? 'badge-success' : 'badge-error'">{{ trade.side }}</span>
              </div>
              <span class="font-mono">${{ Number(trade.dollars).toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'

const loading = ref(true)
const stats = ref({ totalUsers: 0, students: 0, teachers: 0, admins: 0, totalClasses: 0, totalPortfolios: 0, totalTrades: 0 })
const recentTrades = ref([])

onMounted(async () => {
  try {
    const [profiles, classesRes, portfoliosRes, tradesRes, recentRes] = await Promise.all([
      supabase.from('profiles').select('role'),
      supabase.from('classes').select('id', { count: 'exact', head: true }),
      supabase.from('portfolios').select('id', { count: 'exact', head: true }),
      supabase.from('trades').select('id', { count: 'exact', head: true }),
      supabase.from('trades').select('*').order('executed_at', { ascending: false }).limit(10)
    ])

    const roles = (profiles.data || [])
    stats.value = {
      totalUsers: roles.length,
      students: roles.filter(p => p.role === 'student').length,
      teachers: roles.filter(p => p.role === 'teacher').length,
      admins: roles.filter(p => p.role === 'admin').length,
      totalClasses: classesRes.count || 0,
      totalPortfolios: portfoliosRes.count || 0,
      totalTrades: tradesRes.count || 0
    }

    recentTrades.value = recentRes.data || []
  } finally {
    loading.value = false
  }
})
</script>
