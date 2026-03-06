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
      <!-- Header Area -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-2">
        <div class="flex items-center gap-4">
          <div class="avatar">
            <div class="w-14 h-14 rounded-xl bg-base-200 flex items-center justify-center overflow-hidden border border-base-300 shadow-sm">
              <img v-if="companyProfile?.image" :src="companyProfile.image" :alt="ticker" />
              <span v-else class="text-xl font-bold text-base-content/20">{{ ticker }}</span>
            </div>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-3xl font-bold leading-none">{{ ticker }}</h1>
              <span v-if="quote.exchange" class="badge badge-sm badge-primary opacity-80">{{ quote.exchange }}</span>
            </div>
            <p class="text-base-content/60 font-medium">{{ companyProfile?.companyName || quote.name || ticker }}</p>
          </div>
        </div>

        <!-- Quick Trade Actions -->
        <div class="flex gap-2">
          <div 
            class="bg-success/10 border border-success/20 px-4 py-2 rounded-xl flex flex-col cursor-pointer hover:bg-success/20 transition-all min-w-[140px]"
            @click="tradeMode = 'buy'; scrollToTrade()"
          >
            <span class="text-[10px] font-bold text-success uppercase tracking-wider">Buy</span>
            <span class="text-lg font-bold text-success">${{ Number(quote.price).toFixed(2) }}</span>
          </div>
          <div 
            class="bg-error/10 border border-error/20 px-4 py-2 rounded-xl flex flex-col cursor-pointer hover:bg-error/20 transition-all min-w-[140px]"
            :class="{ 'opacity-50 grayscale pointer-events-none': !currentHolding }"
            @click="tradeMode = 'sell'; scrollToTrade()"
          >
            <span class="text-[10px] font-bold text-error uppercase tracking-wider">Sell</span>
            <span class="text-lg font-bold text-error">${{ Number(quote.price).toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <!-- LEFT COLUMN: Chart, Trade, Stats -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Main Chart -->
          <div class="card bg-base-100 shadow-sm border border-base-200 overflow-hidden">
            <div class="p-4 border-b border-base-200 flex justify-between items-center bg-base-200/30">
              <div class="flex flex-col">
                <span class="text-3xl font-bold">${{ Number(quote.price).toFixed(2) }}</span>
                <span class="text-sm font-medium" :class="quote.change >= 0 ? 'text-success' : 'text-error'">
                  {{ quote.change >= 0 ? '+' : '' }}{{ Number(quote.change).toFixed(2) }} 
                  ({{ Number(quote.changesPercentage).toFixed(2) }}%) 
                  <span class="text-base-content/40 text-xs ml-1 font-normal">Today</span>
                </span>
              </div>
              <div class="flex gap-1">
                <span v-if="companyProfile?.sector" class="badge badge-ghost">{{ companyProfile.sector }}</span>
              </div>
            </div>
            <StockChart
              :ticker="ticker"
              :current-price="Number(quote.price)"
              :change="Number(quote.change)"
              :change-pct="Number(quote.changesPercentage)"
              :is-positive="quote.change >= 0"
            />
          </div>

          <!-- Trade Panel -->
          <div ref="tradePanel" class="card shadow-md border-2 overflow-hidden" :class="isGroupPortfolio ? 'border-secondary/30 bg-secondary/5' : 'border-primary/20 bg-base-100'">
            <div class="p-4 bg-base-200/50 border-b border-base-200 flex justify-between items-center">
              <h2 class="font-bold flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                Place Order
              </h2>
              <div v-if="isGroupPortfolio" class="badge badge-secondary gap-1 font-bold">
                Group: {{ membership?.group?.name }}
              </div>
              <div v-else class="badge badge-primary font-bold">Personal Portfolio</div>
            </div>

            <div class="card-body p-4 space-y-4">
              <!-- Educator Mode Warning -->
              <div v-if="auth.isTeacher || auth.isAdmin" class="alert alert-warning py-2 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span class="text-xs font-semibold">Educator Mode: Execution Disabled</span>
              </div>

              <!-- Competition Context Banner -->
              <div v-if="activeComp" class="alert alert-info py-2 rounded-lg text-xs">
                <span class="font-bold">Active Challenge:</span> {{ activeComp.name }} (Subject to Rules)
              </div>

              <!-- Portfolio Switcher -->
              <div v-if="canSwitchPortfolio" class="flex justify-end">
                <button class="btn btn-ghost btn-xs underline text-primary" :disabled="switchingPortfolio" @click="switchPortfolio">
                  Switch to {{ isGroupPortfolio ? 'Personal' : 'Group' }}
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Inputs Side -->
                <div class="space-y-4">
                  <div class="tabs tabs-boxed w-full">
                    <button class="tab flex-1" :class="{ 'tab-active': tradeMode === 'buy' }" @click="tradeMode = 'buy'">Buy</button>
                    <button class="tab flex-1" :class="{ 'tab-active': tradeMode === 'sell' }" @click="tradeMode = 'sell'">Sell</button>
                  </div>

                  <div class="form-control">
                    <label class="label py-1"><span class="label-text text-sm font-bold">Amount to {{ tradeMode }}</span></label>
                    <div class="relative">
                      <span class="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-base-content/40">$</span>
                      <input
                        v-model.number="tradeAmount"
                        type="number"
                        min="0"
                        :max="tradeMode === 'buy' ? portfolioStore.cashBalance : maxSellDollars"
                        step="0.01"
                        class="input input-bordered w-full pl-7 font-mono text-lg"
                        placeholder="0.00"
                      />
                    </div>
                    <div class="flex gap-1 mt-2">
                      <button v-for="pct in [25, 50, 75, 100]" :key="pct" class="btn btn-xs btn-ghost border border-base-300 flex-1" @click="setQuickAmount(pct)">{{ pct }}%</button>
                    </div>
                  </div>

                  <div v-if="tradeAmount > 0" class="bg-base-200 rounded-lg p-3 space-y-1 text-sm border border-base-300">
                    <div class="flex justify-between">
                      <span class="text-base-content/60">Estimated Shares</span>
                      <span class="font-bold font-mono">{{ previewShares.toFixed(4) }}</span>
                    </div>
                    <div class="flex justify-between border-t border-base-300 pt-1 mt-1">
                      <span class="text-base-content/60 font-bold">Total Cost</span>
                      <span class="font-bold font-mono">${{ tradeAmount.toFixed(2) }}</span>
                    </div>
                  </div>
                </div>

                <!-- Context & Rationale Side -->
                <div class="space-y-4">
                  <div class="bg-base-200/50 p-3 rounded-lg space-y-2 text-xs border border-base-300">
                    <div class="flex justify-between">
                      <span class="text-base-content/60">Cash Available</span>
                      <span class="font-bold text-success">${{ portfolioStore.cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-base-content/60">Current Position</span>
                      <span class="font-bold">{{ Number(currentHolding?.shares || 0).toFixed(2) }} shares</span>
                    </div>
                  </div>

                  <div class="form-control">
                    <label class="label py-1"><span class="label-text text-sm font-bold">Trade Rationale{{ rationaleRequired ? '' : ' (Optional)' }}</span></label>
                    <textarea
                      v-model="tradeRationale"
                      class="textarea textarea-bordered w-full h-24 text-sm"
                      placeholder="Why are you making this trade?"
                    ></textarea>
                    <p v-if="rationaleError" class="text-error text-[10px] mt-1 font-bold uppercase">{{ rationaleError }}</p>
                  </div>
                </div>
              </div>

              <!-- Approval Code -->
              <div v-if="requiresApproval" class="form-control">
                <label class="label py-1"><span class="label-text text-xs font-bold uppercase">Teacher Approval Code</span></label>
                <input v-model="approvalCode" type="text" class="input input-bordered input-sm w-full uppercase font-mono" placeholder="Enter code" />
              </div>

              <!-- Execute Button -->
              <div class="pt-2">
                <button
                  class="btn btn-block shadow-lg"
                  :class="tradeMode === 'buy' ? 'btn-success' : 'btn-error'"
                  :disabled="!canTrade || executing || auth.isTeacher || auth.isAdmin"
                  @click="executeTrade"
                >
                  <span v-if="executing" class="loading loading-spinner loading-sm"></span>
                  <template v-if="auth.isTeacher || auth.isAdmin">Trading Disabled for Educators</template>
                  <template v-else>{{ tradeMode === 'buy' ? 'Execute Buy Order' : 'Execute Sell Order' }}</template>
                </button>
                <div v-if="tradeResult" class="alert mt-3 py-2" :class="tradeResult.success ? 'alert-success' : 'alert-error'">
                  <span class="text-sm font-medium">{{ tradeResult.message }}</span>
                </div>
                <!-- Rule Errors -->
                <div v-if="compRuleErrors.length > 0" class="mt-3 text-error text-xs space-y-1">
                  <p v-for="err in compRuleErrors" :key="err" class="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                    {{ err }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Stats & About Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="card bg-base-100 shadow-sm border border-base-200">
              <div class="card-body p-4">
                <h3 class="font-bold text-sm uppercase tracking-wider text-base-content/50 mb-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  Key Statistics
                </h3>
                <div class="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div class="flex flex-col border-b border-base-200 pb-1">
                    <span class="text-[10px] text-base-content/50 uppercase">Open</span>
                    <span class="font-mono text-sm">${{ Number(quote.open).toFixed(2) }}</span>
                  </div>
                  <div class="flex flex-col border-b border-base-200 pb-1">
                    <span class="text-[10px] text-base-content/50 uppercase">Prev Close</span>
                    <span class="font-mono text-sm">${{ Number(quote.previousClose).toFixed(2) }}</span>
                  </div>
                  <div class="flex flex-col border-b border-base-200 pb-1">
                    <span class="text-[10px] text-base-content/50 uppercase">Market Cap</span>
                    <span class="font-mono text-sm">{{ formatMarketCap(quote.marketCap) }}</span>
                  </div>
                  <div class="flex flex-col border-b border-base-200 pb-1">
                    <span class="text-[10px] text-base-content/50 uppercase">P/E Ratio</span>
                    <span class="font-mono text-sm">{{ Number(quote.pe || 0).toFixed(1) }}</span>
                  </div>
                  <div class="flex flex-col border-b border-base-200 pb-1">
                    <span class="text-[10px] text-base-content/50 uppercase">Volume</span>
                    <span class="font-mono text-sm">{{ Number(quote.volume || 0).toLocaleString() }}</span>
                  </div>
                  <div class="flex flex-col border-b border-base-200 pb-1">
                    <span class="text-[10px] text-base-content/50 uppercase">Avg Vol</span>
                    <span class="font-mono text-sm">{{ Number(quote.avgVolume || 0).toLocaleString() }}</span>
                  </div>
                </div>
                <!-- 52-Week Range inside Stats -->
                <div class="mt-4 pt-2 border-t border-base-200">
                  <span class="text-[10px] text-base-content/50 uppercase block mb-1">52-Week Range</span>
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] font-mono">${{ Number(quote.yearLow).toFixed(0) }}</span>
                    <div class="flex-1 relative h-1.5 bg-base-300 rounded-full">
                      <div class="absolute h-1.5 bg-primary rounded-full" :style="{ width: rangePosition + '%' }"></div>
                      <div class="absolute w-2.5 h-2.5 bg-primary rounded-full -top-0.5 border border-base-100" :style="{ left: rangePosition + '%', transform: 'translateX(-50%)' }"></div>
                    </div>
                    <span class="text-[10px] font-mono">${{ Number(quote.yearHigh).toFixed(0) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="card bg-base-100 shadow-sm border border-base-200">
              <div class="card-body p-4 overflow-hidden">
                <h3 class="font-bold text-sm uppercase tracking-wider text-base-content/50 mb-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  About {{ ticker }}
                </h3>
                <div class="max-h-40 overflow-y-auto pr-2 custom-scrollbar text-xs leading-relaxed text-base-content/70">
                  {{ companyProfile?.description || 'No description available for this stock.' }}
                </div>
                <div v-if="companyProfile?.industry" class="mt-3 flex flex-wrap gap-1">
                  <span class="badge badge-xs badge-outline opacity-50">{{ companyProfile.industry }}</span>
                  <span class="badge badge-xs badge-outline opacity-50">{{ companyProfile.country }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN: Community Takes Sidebar -->
        <div class="lg:col-span-1 space-y-6 lg:sticky lg:top-4">
          <div class="card bg-base-100 shadow-md border border-base-200">
            <div class="card-body p-4">
              <div class="flex items-center justify-between mb-4 pb-2 border-b border-base-200">
                <h3 class="font-bold text-base flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                  Community Takes
                </h3>
                <button
                  v-if="auth.isLoggedIn && auth.profile?.username && canPostTake && !showTakeForm"
                  class="btn btn-primary btn-xs"
                  @click="showTakeForm = true"
                >Post Take</button>
              </div>

              <!-- Take Form -->
              <div v-if="showTakeForm" class="space-y-3 mb-6 p-3 bg-base-200 rounded-xl border border-base-300 shadow-inner">
                <div class="flex gap-2">
                  <button class="btn btn-xs flex-1 font-bold" :class="takeSide === 'bull' ? 'btn-success' : 'btn-ghost'" @click="takeSide = 'bull'">Bull</button>
                  <button class="btn btn-xs flex-1 font-bold" :class="takeSide === 'bear' ? 'btn-error' : 'btn-ghost'" @click="takeSide = 'bear'">Bear</button>
                </div>
                <div class="form-control">
                  <textarea
                    v-model="takeBody"
                    class="textarea textarea-bordered w-full text-xs"
                    :maxlength="280"
                    rows="3"
                    placeholder="Your thesis..."
                  ></textarea>
                  <label class="label py-0.5"><span class="label-text-alt text-[10px] opacity-50">{{ takeBody.length }}/280</span></label>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div class="form-control">
                    <label class="label py-0.5"><span class="label-text text-[10px] font-bold uppercase">Target $</span></label>
                    <input v-model.number="takeTargetPrice" type="number" min="0" step="0.01" class="input input-bordered input-xs w-full font-mono" />
                  </div>
                  <div class="form-control">
                    <label class="label py-0.5"><span class="label-text text-[10px] font-bold uppercase">Date</span></label>
                    <input v-model="takeTargetDate" type="date" :min="tomorrowDate" class="input input-bordered input-xs w-full" />
                  </div>
                </div>
                <div v-if="takeError" class="text-error text-[10px] font-bold">{{ takeError }}</div>
                <div class="flex gap-2">
                  <button class="btn btn-xs btn-ghost" @click="showTakeForm = false">Cancel</button>
                  <button class="btn btn-xs btn-primary flex-1 shadow-sm" :disabled="!canSubmitTake || postingTake" @click="submitTake">Post Take</button>
                </div>
              </div>

              <!-- Takes List (Scrollable) -->
              <div class="max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                <div v-if="takesLoading" class="flex justify-center py-8">
                  <span class="loading loading-spinner loading-md"></span>
                </div>
                <div v-else-if="takes.length === 0" class="text-center py-12 text-base-content/30 text-xs italic">
                  Be the first to share your view.
                </div>
                <div v-else class="space-y-4">
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
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import StockChart from '../../components/StockChart.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
const tradeRationale = ref('')
const rationaleError = ref('')
const rationaleRequired = ref(true)
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
const switchingPortfolio = ref(false)
const groupFunds = ref([])

// Refs
const tradePanel = ref(null)

function scrollToTrade() {
  if (tradePanel.value) {
    tradePanel.value.scrollIntoView({ behavior: 'smooth' })
  }
}

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

  // Check if approval is required and rationale settings
  membership.value = await auth.getCurrentMembership()
  if (membership.value?.class?.approval_code) {
    requiresApproval.value = true
  }
  rationaleRequired.value = membership.value?.class?.restrictions?.requireRationale !== false

  // Set initial trade mode from query param
  if (route.query.mode === 'buy' || route.query.mode === 'sell') {
    tradeMode.value = route.query.mode
  }

  // Ensure portfolio is loaded (handles direct navigation / page refresh)
  if (!portfolioStore.portfolio && auth.isLoggedIn) {
    if (membership.value?.group_id) {
      await portfolioStore.loadPortfolio('group', membership.value.group_id)
    } else if (auth.currentUser?.id) {
      await portfolioStore.loadPortfolio('user', auth.currentUser.id)
    }
  }

  // Load group funds for switching
  if (membership.value?.group_id) {
    groupFunds.value = await portfolioStore.loadGroupFunds(membership.value.group_id)
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

const isGroupPortfolio = computed(() => portfolioStore.portfolio?.owner_type === 'group')

const canSwitchPortfolio = computed(() => {
  if (!membership.value?.group_id) return false
  if (isGroupPortfolio.value) return true
  return groupFunds.value.length > 0
})

async function switchPortfolio() {
  switchingPortfolio.value = true
  tradeResult.value = null
  tradeAmount.value = 0
  try {
    if (isGroupPortfolio.value) {
      await portfolioStore.loadPersonalPortfolio()
    } else {
      // Load the first active group fund
      if (groupFunds.value.length > 0) {
        await portfolioStore.loadPortfolioById(groupFunds.value[0].id)
      }
    }
  } finally {
    switchingPortfolio.value = false
  }
}

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
  rationaleError.value = ''
  if (!quote.value) return

  // Client-side rationale validation
  if (rationaleRequired.value && !tradeRationale.value.trim()) {
    rationaleError.value = 'Please explain your reasoning before trading'
    return
  }

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
  const rationale = tradeRationale.value.trim() || undefined
  let result

  if (tradeMode.value === 'buy') {
    result = await portfolioStore.buyStock(ticker, tradeAmount.value, code, rationale)
  } else {
    result = await portfolioStore.sellStock(ticker, tradeAmount.value, code, rationale)
  }

  executing.value = false

  if (result.success) {
    const action = tradeMode.value === 'buy' ? 'Bought' : 'Sold'
    tradeResult.value = {
      success: true,
      message: `${action} ${result.shares.toFixed(4)} shares of ${ticker} at $${result.price.toFixed(2)}`
    }
    tradeAmount.value = 0
    tradeRationale.value = ''
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

onUnmounted(() => {
  // cleanup
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: hsl(var(--bc) / 0.1);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--bc) / 0.2);
}
</style>