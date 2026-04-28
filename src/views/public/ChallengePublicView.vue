<template>
  <div class="min-h-screen bg-base-200 py-8 px-4">
    <div class="max-w-3xl mx-auto space-y-4">
      <div v-if="loading" class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
      <div v-else-if="!comp" class="text-center py-12 text-base-content/50">
        Challenge not found.
      </div>

      <template v-else>
        <!-- Header -->
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <div class="flex items-start gap-4">
              <img v-if="comp.sponsor_logo_url" :src="comp.sponsor_logo_url" :alt="comp.sponsor" class="w-16 h-16 rounded object-contain" />
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="badge badge-sm" :class="statusBadgeClass(comp.status)">{{ statusLabel(comp.status) }}</span>
                  <span v-if="comp.sponsor" class="badge badge-sm badge-outline">Sponsored by {{ comp.sponsor }}</span>
                </div>
                <h1 class="text-2xl font-bold">{{ comp.name }}</h1>
                <p v-if="comp.description" class="text-base-content/70 mt-1">{{ comp.description }}</p>
                <div class="flex flex-wrap gap-4 mt-3 text-sm text-base-content/50">
                  <span>Benchmark: <strong class="text-base-content">{{ comp.benchmark_ticker || 'SPY' }}</strong></span>
                  <span>Starting Cash: <strong class="text-base-content">${{ Number(comp.starting_cash || 0).toLocaleString() }}</strong></span>
                  <span v-if="comp.start_date">{{ new Date(comp.start_date).toLocaleDateString() }} - {{ new Date(comp.end_date).toLocaleDateString() }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Prize pool -->
        <div v-if="comp.prize_pool_amount" class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <h3 class="font-semibold flex items-center gap-2">Prize Pool</h3>
            <p class="text-2xl font-bold text-warning">${{ Number(comp.prize_pool_amount).toLocaleString() }} {{ comp.prize_pool_currency || 'USD' }}</p>
          </div>
        </div>

        <!-- Rules -->
        <div v-if="hasRules" class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <h3 class="font-semibold mb-2">Rules</h3>
            <ul class="space-y-1 text-sm">
              <li v-if="comp.rules?.min_stocks">Hold at least {{ comp.rules.min_stocks }} different securities</li>
              <li v-if="comp.rules?.max_position_pct">No single position over {{ comp.rules.max_position_pct }}% of portfolio</li>
              <li v-if="comp.rules?.require_thesis">Thesis required at registration</li>
              <li v-if="comp.universe?.mode === 'sp500_via_spy'">S&amp;P 500 stocks only</li>
            </ul>
          </div>
        </div>

        <!-- Join CTA -->
        <div class="card bg-primary text-primary-content shadow-xl">
          <div class="card-body">
            <h3 class="card-title">Ready to compete?</h3>
            <p v-if="comp.email_domain_allowlist?.length" class="text-sm opacity-90">
              Open to: {{ comp.email_domain_allowlist.join(', ') }}
            </p>
            <div v-if="joinError" class="alert alert-warning text-sm">{{ joinError }}</div>
            <div class="card-actions justify-end mt-2">
              <button class="btn btn-secondary" :disabled="joining" @click="join">
                <span v-if="joining" class="loading loading-spinner loading-sm"></span>
                {{ auth.isLoggedIn ? 'Join Challenge' : 'Sign Up to Join' }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase, getAccessToken } from '../../lib/supabase'
import { useAuthStore } from '../../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const comp = ref(null)
const loading = ref(true)
const joining = ref(false)
const joinError = ref('')

const hasRules = computed(() => {
  const r = comp.value?.rules || {}
  return r.min_stocks || r.max_position_pct || r.require_thesis || comp.value?.universe?.mode === 'sp500_via_spy'
})

function statusBadgeClass(s) {
  return {
    draft: 'badge-ghost',
    registration: 'badge-info',
    active: 'badge-success',
    completed: 'badge-neutral',
    finalized: 'badge-neutral',
    cancelled: 'badge-error'
  }[s] || 'badge-ghost'
}
function statusLabel(s) {
  return { registration: 'Open for Registration', active: 'Live', finalized: 'Final Results' }[s] || s
}

async function loadCompetition() {
  loading.value = true
  const slug = route.params.slug
  const { data } = await supabase
    .from('competitions')
    .select('id, slug, name, description, sponsor, sponsor_logo_url, status, benchmark_ticker, starting_cash, start_date, end_date, rules, universe, prize_pool_amount, prize_pool_currency, email_domain_allowlist, late_join_allowed, payout_mode, default_charity')
    .eq('slug', slug)
    .maybeSingle()
  comp.value = data || null
  loading.value = false
}

async function join() {
  joinError.value = ''
  if (!auth.isLoggedIn) {
    router.push({ name: 'signup', query: { challenge_slug: route.params.slug } })
    return
  }
  joining.value = true
  try {
    const token = await getAccessToken()
    const res = await fetch('/api/competitions/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ slug: route.params.slug })
    })
    const body = await res.json()
    if (!res.ok) {
      joinError.value = mapJoinError(body.error)
      return
    }
    router.push({ name: 'competition-detail', params: { id: comp.value.id } })
  } catch (e) {
    joinError.value = e.message
  } finally {
    joining.value = false
  }
}

function mapJoinError(code) {
  return {
    registration_closed: 'Registration is closed for this challenge.',
    domain_not_allowed: 'This challenge is restricted to specific email domains. Please contact the organizer.',
    not_on_roster: 'Your email is not on the invitation list for this challenge.',
    already_registered: 'You are already registered for this challenge.',
    consent_required: 'Your account is created, but needs parent consent before you can join. We have emailed your parent.',
    consent_revoked: 'Parental consent has been revoked. Contact your parent or guardian.',
    default_charity_unavailable: 'This challenge requires a charity but none is configured.',
    not_found: 'Challenge not found.'
  }[code] || code || 'Could not join. Try again.'
}

onMounted(loadCompetition)
</script>
