<template>
  <div class="min-h-screen bg-base-200">
    <div class="max-w-4xl mx-auto p-4 space-y-6">
      <!-- Nav -->
      <div class="flex items-center justify-between pt-4">
        <RouterLink to="/explore" class="btn btn-ghost btn-sm">Back to Leaderboard</RouterLink>
        <div class="flex gap-2">
          <RouterLink to="/login" class="btn btn-ghost btn-sm">Log In</RouterLink>
          <RouterLink to="/signup" class="btn btn-primary btn-sm">Sign Up</RouterLink>
        </div>
      </div>

      <div v-if="loading" class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
      </div>

      <div v-else-if="!profile" class="text-center py-20 space-y-4">
        <div class="text-6xl">&#128566;</div>
        <h2 class="text-2xl font-bold">Profile Not Found</h2>
        <p class="text-base-content/60">This user doesn't exist or their profile is private.</p>
        <RouterLink to="/explore" class="btn btn-primary">Back to Leaderboard</RouterLink>
      </div>

      <template v-else>
        <!-- Profile Header -->
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <div class="flex items-center gap-4">
              <div class="avatar placeholder">
                <div class="bg-primary text-primary-content rounded-full w-16 h-16">
                  <span v-if="profile.avatar_url">
                    <img :src="profile.avatar_url" :alt="profile.full_name" class="rounded-full" />
                  </span>
                  <span v-else class="text-2xl">{{ (profile.full_name || '?')[0].toUpperCase() }}</span>
                </div>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-3">
                  <h1 class="text-2xl font-bold">{{ profile.full_name }}</h1>
                  <FollowButton v-if="profile.id" :userId="profile.id" />
                </div>
                <p v-if="profile.username" class="text-base-content/50">@{{ profile.username }}</p>
                <div class="flex items-center gap-3 mt-1">
                  <p class="text-xs text-base-content/40">Member since {{ new Date(profile.created_at).toLocaleDateString() }}</p>
                  <span v-if="profile.follower_count > 0" class="text-xs text-base-content/50">{{ profile.follower_count }} follower{{ profile.follower_count !== 1 ? 's' : '' }}</span>
                  <span v-if="profile.following_count > 0" class="text-xs text-base-content/50">{{ profile.following_count }} following</span>
                </div>
              </div>
            </div>
            <p v-if="profile.bio" class="mt-4 text-base-content/80">{{ profile.bio }}</p>
            <div v-if="profile.investment_philosophy" class="mt-3 p-3 bg-base-200 rounded-lg">
              <p class="text-xs font-semibold text-base-content/50 mb-1">Investment Philosophy</p>
              <p class="text-sm text-base-content/80">{{ profile.investment_philosophy }}</p>
            </div>
          </div>
        </div>

        <!-- Portfolios -->
        <div v-if="portfolios.length > 0" class="space-y-4">
          <h2 class="text-xl font-bold">Public Portfolios</h2>
          <div v-for="p in portfolios" :key="p.id" class="card bg-base-100 shadow">
            <div class="card-body">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-semibold">{{ p.name || 'Portfolio' }}</h3>
                  <p v-if="p.description" class="text-sm text-base-content/60">{{ p.description }}</p>
                </div>
                <div class="text-right">
                  <p class="font-bold text-lg" :class="p.returnPct >= 0 ? 'text-success' : 'text-error'">
                    {{ p.returnPct >= 0 ? '+' : '' }}{{ p.returnPct.toFixed(2) }}%
                  </p>
                  <p class="text-xs text-base-content/50">${{ p.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</p>
                </div>
              </div>

              <!-- Holdings -->
              <div v-if="p.holdings?.length > 0" class="mt-3">
                <div class="overflow-x-auto">
                  <table class="table table-sm">
                    <thead>
                      <tr>
                        <th>Ticker</th>
                        <th class="text-right">Shares</th>
                        <th class="text-right">Avg Cost</th>
                        <th class="text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="h in p.holdings" :key="h.ticker">
                        <td class="font-mono font-bold">{{ h.ticker }}</td>
                        <td class="text-right font-mono">{{ Number(h.shares).toFixed(2) }}</td>
                        <td class="text-right font-mono">${{ Number(h.avg_cost).toFixed(2) }}</td>
                        <td class="text-right font-mono">${{ h.marketValue.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <p v-else class="text-sm text-base-content/50 mt-2">No holdings in this portfolio.</p>
            </div>
          </div>
        </div>

        <!-- Public Baskets -->
        <div v-if="publicBaskets.length > 0" class="space-y-4">
          <h2 class="text-xl font-bold">Custom Baskets</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div v-for="basket in publicBaskets" :key="basket.id" class="card bg-base-100 shadow">
              <div class="card-body p-4">
                <h3 class="font-semibold">{{ basket.name }}</h3>
                <p v-if="basket.description" class="text-sm text-base-content/60">{{ basket.description }}</p>
                <div class="flex flex-wrap gap-1 mt-2">
                  <span v-for="ticker in basket.tickers" :key="ticker" class="badge badge-sm badge-outline font-mono">{{ ticker }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Takes -->
        <div v-if="userTakes.length > 0" class="space-y-4">
          <h2 class="text-xl font-bold">Takes</h2>
          <TakeCard
            v-for="take in userTakes"
            :key="take.id"
            :take="take"
            :showTicker="true"
            :showFollowButton="false"
          />
        </div>

        <!-- Investment Theses (long-form, no side) -->
        <div v-if="longFormTheses.length > 0" class="space-y-4">
          <h2 class="text-xl font-bold">Investment Theses</h2>
          <div v-for="thesis in longFormTheses" :key="thesis.id" class="card bg-base-100 shadow">
            <div class="card-body">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold">{{ thesis.title }}</h3>
                <span v-if="thesis.ticker" class="badge badge-sm badge-primary font-mono">{{ thesis.ticker }}</span>
              </div>
              <p class="text-sm text-base-content/70 whitespace-pre-wrap">{{ thesis.body }}</p>
              <p class="text-xs text-base-content/40">{{ new Date(thesis.created_at).toLocaleDateString() }}</p>
            </div>
          </div>
        </div>

        <!-- Reset History -->
        <div v-if="resetHistory.length > 0" class="space-y-4">
          <h2 class="text-xl font-bold">Past Track Records</h2>
          <div v-for="reset in resetHistory" :key="reset.id" class="card bg-base-100 shadow">
            <div class="card-body p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-base-content/60">Ended {{ new Date(reset.reset_at).toLocaleDateString() }}</p>
                  <p class="text-xs text-base-content/40">Starting cash: ${{ Number(reset.starting_cash).toLocaleString() }} | Benchmark: {{ reset.benchmark_ticker }}</p>
                </div>
                <div class="text-right">
                  <p class="font-bold" :class="Number(reset.final_return_pct) >= 0 ? 'text-success' : 'text-error'">
                    {{ Number(reset.final_return_pct) >= 0 ? '+' : '' }}{{ Number(reset.final_return_pct).toFixed(2) }}%
                  </p>
                  <p class="text-xs text-base-content/50">${{ Number(reset.final_value).toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { supabase } from '../../lib/supabase'
import { useMarketDataStore } from '../../stores/marketData'
import TakeCard from '../../components/TakeCard.vue'
import FollowButton from '../../components/FollowButton.vue'
import { useBasketsStore } from '../../stores/baskets'

const route = useRoute()
const market = useMarketDataStore()

const basketsStore = useBasketsStore()

const loading = ref(true)
const profile = ref(null)
const portfolios = ref([])
const theses = ref([])
const resetHistory = ref([])
const publicBaskets = ref([])

const userTakes = computed(() => theses.value.filter(t => t.side != null).map(t => ({
  ...t,
  profiles: { full_name: profile.value?.full_name, username: profile.value?.username, avatar_url: profile.value?.avatar_url }
})))
const longFormTheses = computed(() => theses.value.filter(t => t.side == null))

onMounted(async () => {
  const username = route.params.username

  // Fetch public profile
  let { data: prof } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, bio, investment_philosophy, is_public, created_at, follower_count, following_count')
    .eq('username', username)
    .eq('is_public', true)
    .maybeSingle()

  if (!prof) {
    loading.value = false
    return
  }
  profile.value = prof

  // Fetch public portfolios
  const { data: pData } = await supabase
    .from('portfolios')
    .select('*')
    .eq('owner_type', 'user')
    .eq('owner_id', prof.id)
    .eq('is_public', true)

  if (pData?.length) {
    const enriched = []
    for (const p of pData) {
      const { data: hData } = await supabase
        .from('holdings')
        .select('*')
        .eq('portfolio_id', p.id)

      const tickers = (hData || []).map(h => h.ticker)
      if (tickers.length > 0) {
        await market.fetchBatchQuotes(tickers)
      }

      const holdingsEnriched = (hData || []).map(h => {
        const price = market.getCachedPrice(h.ticker) || Number(h.avg_cost)
        return { ...h, marketValue: Number(h.shares) * price }
      })

      const holdingsValue = holdingsEnriched.reduce((sum, h) => sum + h.marketValue, 0)
      const totalValue = holdingsValue + Number(p.cash_balance)
      const startCash = Number(p.starting_cash)
      const returnPct = startCash > 0 ? ((totalValue - startCash) / startCash) * 100 : 0

      enriched.push({ ...p, totalValue, returnPct, holdings: holdingsEnriched })

      // Fetch reset history for this portfolio
      const { data: resets } = await supabase
        .from('portfolio_resets')
        .select('*')
        .eq('portfolio_id', p.id)
        .eq('kept_visible', true)
        .order('reset_at', { ascending: false })

      if (resets?.length) {
        resetHistory.value.push(...resets)
      }
    }
    portfolios.value = enriched
  }

  // Fetch public baskets
  publicBaskets.value = await basketsStore.fetchPublicBaskets(prof.id)

  // Fetch public theses
  const { data: tData } = await supabase
    .from('investment_theses')
    .select('*')
    .eq('user_id', prof.id)
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  theses.value = tData || []
  loading.value = false
})
</script>
