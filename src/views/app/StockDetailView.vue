<template>
  <div class="space-y-4">
    <!-- Back button -->
    <button class="btn btn-ghost btn-sm gap-1" @click="goBack">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
      Back to Stocks
    </button>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-if="!loading && !quote" class="text-center py-12 text-base-content/50">Stock not found.</div>

    <template v-if="!loading && quote">
      <!-- Header -->
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold">{{ ticker }}</h1>
          <p class="text-base-content/60">{{ companyProfile?.companyName || quote.name || ticker }}</p>
          <div class="flex gap-1 mt-1">
            <span v-if="companyProfile?.sector" class="badge badge-sm badge-ghost">{{ companyProfile.sector }}</span>
            <span v-if="companyProfile?.country" class="badge badge-sm badge-outline">{{ companyProfile.country }}</span>
            <span v-if="quote.exchange" class="badge badge-sm badge-primary">{{ quote.exchange }}</span>
          </div>
        </div>
        <div class="text-right">
          <p class="text-3xl font-bold">${{ Number(quote.price).toFixed(2) }}</p>
          <p class="text-lg" :class="quote.change >= 0 ? 'text-success' : 'text-error'">
            {{ quote.change >= 0 ? '+' : '' }}{{ Number(quote.change).toFixed(2) }} ({{ quote.changesPercentage >= 0 ? '+' : '' }}{{ Number(quote.changesPercentage).toFixed(2) }}%)
          </p>
        </div>
      </div>

      <!-- Competition Context Banner -->
      <div v-if="activeComp" class="alert alert-info">
        <div>
          <p class="font-semibold text-sm">Active Competition: {{ activeComp.name }}</p>
          <p class="text-xs">Trades are subject to competition rules. Benchmark: {{ activeComp.benchmark_ticker }}</p>
        </div>
      </div>

      <!-- Competition Rule Warnings -->
      <div v-if="compRuleErrors.length > 0" class="alert alert-warning">
        <ul class="text-sm list-disc list-inside">
          <li v-for="err in compRuleErrors" :key="err">{{ err }}</li>
        </ul>
      </div>

      <!-- Trade Panel (students only) -->
      <div v-if="!auth.isTeacher && !auth.isAdmin" class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <!-- Tabs -->
          <div class="tabs tabs-boxed mb-3">
            <button class="tab" :class="{ 'tab-active': tradeMode === 'buy' }" @click="tradeMode = 'buy'">Buy</button>
            <button class="tab" :class="{ 'tab-active': tradeMode === 'sell' }" @click="tradeMode = 'sell'">Sell</button>
          </div>

          <!-- Current Position -->
          <div v-if="currentHolding" class="flex justify-between text-sm mb-2 bg-base-200 rounded-lg p-2">
            <span class="text-base-content/60">Your position</span>
            <span class="font-medium">{{ Number(currentHolding.shares).toFixed(4) }} shares (${{ (currentHolding.shares * quote.price).toLocaleString('en-US', { maximumFractionDigits: 2 }) }})</span>
          </div>
          <div class="flex justify-between text-sm mb-3 bg-base-200 rounded-lg p-2">
            <span class="text-base-content/60">Cash available</span>
            <span class="font-medium">${{ portfolioStore.cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
          </div>

          <!-- Dollar Input -->
          <div class="form-control mb-2">
            <label class="label py-1"><span class="label-text text-sm">Amount ($)</span></label>
            <input
              v-model.number="tradeAmount"
              type="number"
              min="0"
              :max="tradeMode === 'buy' ? portfolioStore.cashBalance : maxSellDollars"
              step="0.01"
              class="input input-bordered w-full"
              :placeholder="tradeMode === 'buy' ? 'Enter $ to invest' : 'Enter $ to sell'"
            />
          </div>

          <!-- Quick Amount Buttons -->
          <div class="flex gap-1 mb-3">
            <button v-for="pct in [25, 50, 75, 100]" :key="pct" class="btn btn-xs btn-ghost flex-1" @click="setQuickAmount(pct)">{{ pct }}%</button>
          </div>

          <!-- Order Preview -->
          <div v-if="tradeAmount > 0" class="bg-base-200 rounded-lg p-3 mb-3 space-y-1">
            <div class="flex justify-between text-sm">
              <span class="text-base-content/60">{{ tradeMode === 'buy' ? 'Buying' : 'Selling' }}</span>
              <span class="font-mono">{{ previewShares.toFixed(4) }} shares</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-base-content/60">Price per share</span>
              <span class="font-mono">${{ Number(quote.price).toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-sm font-medium border-t border-base-300 pt-1">
              <span>Total</span>
              <span class="font-mono">${{ tradeAmount.toFixed(2) }}</span>
            </div>
          </div>

          <!-- Approval Code -->
          <div v-if="requiresApproval" class="form-control mb-3">
            <label class="label py-1"><span class="label-text text-sm">Teacher Approval Code</span></label>
            <input v-model="approvalCode" type="text" class="input input-bordered w-full uppercase" placeholder="Enter approval code" />
          </div>

          <!-- Trade Result -->
          <div v-if="tradeResult" class="alert mb-3" :class="tradeResult.success ? 'alert-success' : 'alert-error'">
            <span>{{ tradeResult.message }}</span>
          </div>

          <!-- Execute Button -->
          <button
            class="btn btn-block"
            :class="tradeMode === 'buy' ? 'btn-success' : 'btn-error'"
            :disabled="!canTrade || executing"
            @click="executeTrade"
          >
            <span v-if="executing" class="loading loading-spinner loading-sm"></span>
            {{ tradeMode === 'buy' ? 'Buy' : 'Sell' }} {{ ticker }}
          </button>
        </div>
      </div>

      <!-- Key Statistics -->
      <div class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <h3 class="font-semibold mb-3">Key Statistics</h3>
          <div class="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
            <div v-if="quote.previousClose" class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">Previous Close</span>
              <span class="text-sm font-medium">${{ Number(quote.previousClose).toFixed(2) }}</span>
            </div>
            <div v-if="quote.open" class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">Open</span>
              <span class="text-sm font-medium">${{ Number(quote.open).toFixed(2) }}</span>
            </div>
            <div v-if="quote.marketCap" class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">Market Cap</span>
              <span class="text-sm font-medium">{{ formatMarketCap(quote.marketCap) }}</span>
            </div>
            <div v-if="quote.pe" class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">P/E Ratio</span>
              <span class="text-sm font-medium">{{ Number(quote.pe).toFixed(1) }}</span>
            </div>
            <div v-if="quote.eps" class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">EPS</span>
              <span class="text-sm font-medium">${{ Number(quote.eps).toFixed(2) }}</span>
            </div>
            <div v-if="quote.volume" class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">Volume</span>
              <span class="text-sm font-medium">{{ Number(quote.volume).toLocaleString() }}</span>
            </div>
            <div v-if="quote.avgVolume" class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">Avg Volume</span>
              <span class="text-sm font-medium">{{ Number(quote.avgVolume).toLocaleString() }}</span>
            </div>
            <div v-if="quote.yearHigh" class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">52-Week High</span>
              <span class="text-sm font-medium">${{ Number(quote.yearHigh).toFixed(2) }}</span>
            </div>
            <div v-if="quote.yearLow" class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">52-Week Low</span>
              <span class="text-sm font-medium">${{ Number(quote.yearLow).toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 52-Week Range Bar -->
      <div v-if="quote.yearHigh && quote.yearLow" class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <h3 class="font-semibold mb-2">52-Week Range</h3>
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono">${{ Number(quote.yearLow).toFixed(0) }}</span>
            <div class="flex-1 relative h-2 bg-base-300 rounded-full">
              <div class="absolute h-2 bg-primary rounded-full" :style="{ width: rangePosition + '%' }"></div>
              <div class="absolute w-3 h-3 bg-primary rounded-full -top-0.5 border-2 border-base-100" :style="{ left: rangePosition + '%', transform: 'translateX(-50%)' }"></div>
            </div>
            <span class="text-xs font-mono">${{ Number(quote.yearHigh).toFixed(0) }}</span>
          </div>
        </div>
      </div>

      <!-- About -->
      <div v-if="companyProfile?.description" class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <h3 class="font-semibold mb-2">About {{ companyProfile.companyName }}</h3>
          <p class="text-sm text-base-content/70 leading-relaxed">{{ companyProfile.description }}</p>
        </div>
      </div>

      <!-- Community Takes -->
      <div class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold">Community Takes</h3>
            <button
              v-if="auth.isLoggedIn && auth.profile?.username && canPostTake && !showTakeForm"
              class="btn btn-primary btn-sm"
              @click="showTakeForm = true"
            >Post Take</button>
          </div>

          <!-- No username warning -->
          <p v-if="auth.isLoggedIn && !auth.profile?.username" class="text-sm text-warning mb-3">
            Set a username in your profile to post takes.
          </p>

          <!-- Already posted today -->
          <p v-if="auth.isLoggedIn && auth.profile?.username && !canPostTake && !showTakeForm" class="text-xs text-base-content/40 mb-3">
            You already posted a take on {{ ticker }} today.
          </p>

          <!-- Take Form -->
          <div v-if="showTakeForm" class="space-y-3 mb-4 p-3 bg-base-200 rounded-lg">
            <div class="flex gap-2">
              <button class="btn btn-sm flex-1" :class="takeSide === 'bull' ? 'btn-success' : 'btn-ghost'" @click="takeSide = 'bull'">Bull</button>
              <button class="btn btn-sm flex-1" :class="takeSide === 'bear' ? 'btn-error' : 'btn-ghost'" @click="takeSide = 'bear'">Bear</button>
            </div>
            <div class="form-control">
              <textarea
                v-model="takeBody"
                class="textarea textarea-bordered w-full"
                :maxlength="280"
                rows="3"
                placeholder="What's your thesis? (280 chars max)"
              ></textarea>
              <label class="label py-0.5">
                <span></span>
                <span class="label-text-alt" :class="takeBody.length > 260 ? 'text-warning' : ''">{{ takeBody.length }}/280</span>
              </label>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="form-control">
                <label class="label py-0.5"><span class="label-text text-xs">Target Price ($)</span></label>
                <input v-model.number="takeTargetPrice" type="number" min="0" step="0.01" class="input input-bordered input-sm w-full" />
              </div>
              <div class="form-control">
                <label class="label py-0.5"><span class="label-text text-xs">Target Date</span></label>
                <input v-model="takeTargetDate" type="date" :min="tomorrowDate" class="input input-bordered input-sm w-full" />
              </div>
            </div>
            <div v-if="takeError" class="text-error text-sm">{{ takeError }}</div>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-ghost" @click="showTakeForm = false; takeError = ''">Cancel</button>
              <button class="btn btn-sm btn-primary flex-1" :disabled="!canSubmitTake || postingTake" @click="submitTake">
                <span v-if="postingTake" class="loading loading-spinner loading-xs"></span>
                Post
              </button>
            </div>
          </div>

          <!-- Takes list -->
          <div v-if="takesLoading" class="flex justify-center py-4">
            <span class="loading loading-spinner loading-sm"></span>
          </div>
          <div v-else-if="takes.length === 0" class="text-center py-6 text-base-content/40 text-sm">
            No takes yet. Be the first to share your view on {{ ticker }}.
          </div>
          <div v-else class="space-y-3">
            <TakeCard
              v-for="take in takes"
              :key="take.id"
              :take="take"
              :showTicker="false"
              :showFollowButton="true"
              :currentPrice="quote?.price"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMarketDataStore } from '../../stores/marketData'
import { usePortfolioStore } from '../../stores/portfolio'
import { useAuthStore } from '../../stores/auth'
import { useSocialStore } from '../../stores/social'
import { useCompetitionsStore } from '../../stores/competitions'
import TakeCard from '../../components/TakeCard.vue'

const route = useRoute()
const router = useRouter()
const market = useMarketDataStore()
const portfolioStore = usePortfolioStore()
const auth = useAuthStore()
const social = useSocialStore()
const competitionsStore = useCompetitionsStore()

const ticker = route.params.ticker?.toUpperCase()
const loading = ref(true)
const quote = ref(null)
const companyProfile = ref(null)
const tradeMode = ref('buy')
const tradeAmount = ref(0)
const tradeResult = ref(null)
const approvalCode = ref('')
const executing = ref(false)
const requiresApproval = ref(false)
const membership = ref(null)

// Takes state
const takes = ref([])
const takesLoading = ref(true)
const showTakeForm = ref(false)
const canPostTake = ref(false)
const takeSide = ref('bull')
const takeBody = ref('')
const takeTargetPrice = ref(null)
const takeTargetDate = ref('')
const takeError = ref('')
const postingTake = ref(false)
const activeCompEntry = ref(null)
const activeComp = ref(null)
const compRuleErrors = ref([])

const tomorrowDate = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
})

const canSubmitTake = computed(() =>
  takeSide.value && takeBody.value.trim().length > 0 && takeBody.value.length <= 280 && takeTargetPrice.value > 0 && takeTargetDate.value
)

onMounted(async () => {
  const [quoteData, profileData] = await Promise.all([
    market.fetchQuote(ticker),
    market.fetchCompanyProfile(ticker)
  ])
  quote.value = quoteData
  companyProfile.value = profileData

  // Check if approval is required
  membership.value = await auth.getCurrentMembership()
  if (membership.value?.class?.approval_code) {
    requiresApproval.value = true
  }

  loading.value = false

  // Check if user is in an active competition
  if (auth.isLoggedIn) {
    const comps = await competitionsStore.fetchCompetitions('active')
    for (const comp of comps) {
      const detail = await competitionsStore.fetchCompetition(comp.id)
      const entry = detail?.entries?.find(e => e.user_id === auth.currentUser.id)
      if (entry) {
        activeComp.value = comp
        activeCompEntry.value = entry
        break
      }
    }
  }

  // Load takes
  takes.value = await social.fetchTakesForTicker(ticker)
  takesLoading.value = false
  if (auth.isLoggedIn && auth.profile?.username) {
    canPostTake.value = await social.checkCanPost(ticker)
  }
})

async function submitTake() {
  takeError.value = ''
  postingTake.value = true
  const result = await social.postTake({
    ticker,
    side: takeSide.value,
    body: takeBody.value.trim(),
    targetPrice: takeTargetPrice.value,
    targetDate: takeTargetDate.value,
    priceAtCreation: quote.value?.price || null
  })
  postingTake.value = false

  if (result.error) {
    takeError.value = result.error
    return
  }

  // Prepend new take and reset form
  takes.value.unshift(result.data)
  showTakeForm.value = false
  canPostTake.value = false
  takeBody.value = ''
  takeTargetPrice.value = null
  takeTargetDate.value = ''
  takeSide.value = 'bull'
}

const currentHolding = computed(() => portfolioStore.getHolding(ticker))

const maxSellDollars = computed(() => {
  if (!currentHolding.value || !quote.value) return 0
  return currentHolding.value.shares * quote.value.price
})

const previewShares = computed(() => {
  if (!quote.value || !tradeAmount.value) return 0
  return tradeAmount.value / quote.value.price
})

const canTrade = computed(() => {
  if (!tradeAmount.value || tradeAmount.value <= 0 || !quote.value) return false
  if (requiresApproval.value && !approvalCode.value.trim()) return false
  if (tradeMode.value === 'buy') return tradeAmount.value <= portfolioStore.cashBalance
  return tradeAmount.value <= maxSellDollars.value + 0.01
})

const rangePosition = computed(() => {
  if (!quote.value?.yearHigh || !quote.value?.yearLow) return 50
  const range = quote.value.yearHigh - quote.value.yearLow
  if (range === 0) return 50
  return ((quote.value.price - quote.value.yearLow) / range) * 100
})

function setQuickAmount(pct) {
  if (tradeMode.value === 'buy') {
    tradeAmount.value = Math.floor(portfolioStore.cashBalance * (pct / 100) * 100) / 100
  } else {
    tradeAmount.value = Math.floor(maxSellDollars.value * (pct / 100) * 100) / 100
  }
}

async function executeTrade() {
  tradeResult.value = null
  compRuleErrors.value = []
  if (!quote.value) return

  // Validate competition rules if in a competition
  if (activeComp.value) {
    const validation = competitionsStore.validateTradeAgainstRules(
      activeComp.value,
      portfolioStore.holdings,
      ticker,
      tradeAmount.value,
      tradeMode.value
    )
    if (!validation.valid) {
      compRuleErrors.value = validation.errors
      return
    }
  }

  executing.value = true
  const code = approvalCode.value.trim() || undefined
  let result

  if (tradeMode.value === 'buy') {
    result = await portfolioStore.buyStock(ticker, tradeAmount.value, code)
  } else {
    result = await portfolioStore.sellStock(ticker, tradeAmount.value, code)
  }

  executing.value = false

  if (result.success) {
    const action = tradeMode.value === 'buy' ? 'Bought' : 'Sold'
    tradeResult.value = {
      success: true,
      message: `${action} ${result.shares.toFixed(4)} shares of ${ticker} at $${result.price.toFixed(2)}`
    }
    tradeAmount.value = 0
    // Refresh quote
    quote.value = await market.fetchQuote(ticker)
    setTimeout(() => { tradeResult.value = null }, 5000)
  } else {
    tradeResult.value = { success: false, message: result.error }
  }
}

function formatMarketCap(value) {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  return `$${Number(value).toLocaleString()}`
}

function goBack() {
  router.back()
}
</script>
