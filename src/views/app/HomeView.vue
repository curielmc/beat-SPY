<template>
  <div v-if="loading" class="flex justify-center py-20">
    <span class="loading loading-spinner loading-lg"></span>
  </div>

  <!-- Independent user: no portfolio yet -->
  <div v-else-if="!membership && !portfolioStore.portfolio" class="flex flex-col items-center justify-center py-20 space-y-4">
    <div class="text-6xl">&#128200;</div>
    <h2 class="text-2xl font-bold">Welcome to Beat the S&P 500!</h2>
    <p class="text-base-content/60 text-center max-w-md">Start with $100,000 in virtual cash and see if you can beat the market. Or join a class to compete with classmates.</p>
    <div class="flex gap-3">
      <button class="btn btn-primary" @click="handleStartInvesting" :disabled="creatingPortfolio">
        <span v-if="creatingPortfolio" class="loading loading-spinner loading-sm"></span>
        Start Investing
      </button>
      <RouterLink to="/join" class="btn btn-outline">Join a Class</RouterLink>
    </div>
  </div>

  <!-- Waiting for group assignment (teacher_assign mode) -->
  <div v-else-if="membership && !membership.group_id" class="flex flex-col items-center justify-center py-20 space-y-4">
    <div class="text-6xl">&#9203;</div>
    <h2 class="text-2xl font-bold">Waiting for Group Assignment</h2>
    <p class="text-base-content/60 text-center max-w-md">Your teacher hasn't assigned you to a group yet. Check back soon or explore the stocks page in the meantime!</p>
    <RouterLink to="/stocks" class="btn btn-primary">Browse Stocks</RouterLink>
  </div>

  <!-- Bonus Cash Notification Modal -->
  <dialog ref="bonusModal" class="modal" :class="{ 'modal-open': showBonusModal }">
    <div class="modal-box text-center">
      <div class="text-6xl mb-4">&#127881;</div>
      <h3 class="font-bold text-2xl mb-2">Congratulations!</h3>
      <p class="text-lg text-base-content/70 mb-4">Your team received a bonus of</p>
      <p class="text-4xl font-bold text-success mb-4">${{ bonusTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
      <p class="text-base-content/50 mb-6">from your teacher! Use it wisely.</p>
      <button class="btn btn-primary btn-block" @click="dismissBonus">Awesome!</button>
    </div>
    <form method="dialog" class="modal-backdrop" @click="dismissBonus"><button>close</button></form>
  </dialog>

  <div v-if="!loading && membership?.group_id" class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold">{{ membership?.group?.name || 'My Portfolio' }}</h1>
        <p class="text-sm text-base-content/60">{{ auth.profile?.full_name }}</p>
      </div>
      <RouterLink v-if="isIndependent" to="/join" class="btn btn-ghost btn-xs gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
        Join a Class
      </RouterLink>
      <div class="flex gap-2 flex-wrap">
        <div v-for="member in groupMembers" :key="member.id" class="badge badge-sm" :class="member.id === auth.currentUser?.id ? 'badge-primary' : 'badge-ghost'">
          {{ member.full_name?.split(' ')[0] }}
        </div>
      </div>
    </div>

    <!-- Two Key Stats -->
    <div class="grid grid-cols-2 gap-3">
      <div class="card bg-base-100 shadow">
        <div class="card-body p-3">
          <p class="text-xs text-base-content/60">Total Gain/Loss</p>
          <p class="text-xl font-bold" :class="portfolioStore.totalReturnDollar >= 0 ? 'text-success' : 'text-error'">
            {{ portfolioStore.totalReturnDollar >= 0 ? '+' : '-' }}${{ Math.abs(portfolioStore.totalReturnDollar).toLocaleString('en-US', { maximumFractionDigits: 0 }) }}
          </p>
          <p class="text-xs" :class="portfolioStore.totalReturnPct >= 0 ? 'text-success' : 'text-error'">
            {{ portfolioStore.totalReturnPct >= 0 ? '+' : '' }}{{ portfolioStore.totalReturnPct.toFixed(2) }}%
          </p>
        </div>
      </div>
      <div class="card bg-base-100 shadow">
        <div class="card-body p-3">
          <p class="text-xs text-base-content/60">vs {{ portfolioStore.benchmarkTicker }}</p>
          <p class="text-xl font-bold" :class="vsSP500 >= 0 ? 'text-success' : 'text-error'">
            {{ vsSP500 >= 0 ? '+' : '' }}{{ vsSP500.toFixed(2) }}%
          </p>
          <p class="text-xs text-base-content/50">
            {{ portfolioStore.isBeatingSP500 ? 'Beating the market' : 'Behind the market' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Portfolio Summary -->
    <div class="stats shadow bg-base-100 w-full">
      <div class="stat py-2">
        <div class="stat-title text-xs">Portfolio Value</div>
        <div class="stat-value text-lg">${{ portfolioStore.totalMarketValue.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}</div>
      </div>
      <div class="stat py-2">
        <div class="stat-title text-xs">Cash Available</div>
        <div class="stat-value text-lg">${{ portfolioStore.cashBalance.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}</div>
      </div>
      <div class="stat py-2">
        <div class="stat-title text-xs">Benchmark ({{ portfolioStore.benchmarkTicker }})</div>
        <div class="stat-value text-lg" :class="portfolioStore.benchmarkReturnPct >= 0 ? 'text-success' : 'text-error'">
          {{ portfolioStore.benchmarkReturnPct >= 0 ? '+' : '' }}{{ portfolioStore.benchmarkReturnPct.toFixed(2) }}%
        </div>
      </div>
    </div>

    <!-- Holdings -->
    <div class="card bg-base-100 shadow">
      <div class="card-body p-4">
        <h3 class="font-semibold mb-2">Holdings</h3>
        <div v-if="portfolioStore.holdings.length === 0" class="text-base-content/50 text-center py-6 text-lg">
          No holdings yet. <RouterLink to="/stocks" class="link link-primary">Buy some stocks, ETFs, or other investments!</RouterLink>
        </div>
        <div class="overflow-x-auto" v-else>
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Ticker</th>
                <th class="text-right">Shares</th>
                <th class="text-right">Price</th>
                <th class="text-right">Value</th>
                <th class="text-right">Gain/Loss</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in portfolioStore.holdings" :key="h.ticker">
                <td>
                  <RouterLink :to="`/stocks/${h.ticker}`" class="font-mono font-bold link link-hover">{{ h.ticker }}</RouterLink>
                </td>
                <td class="text-right font-mono">{{ Number(h.shares).toFixed(2) }}</td>
                <td class="text-right font-mono">${{ h.currentPrice.toFixed(2) }}</td>
                <td class="text-right font-mono">${{ h.marketValue.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}</td>
                <td class="text-right font-mono" :class="h.gainLoss >= 0 ? 'text-success' : 'text-error'">
                  {{ h.gainLoss >= 0 ? '+' : '' }}{{ h.gainLossPct.toFixed(2) }}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Portfolio Settings -->
    <div class="card bg-base-100 shadow" v-if="portfolioStore.portfolio">
      <div class="card-body p-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold">Portfolio Settings</h3>
          <button class="btn btn-xs btn-ghost" @click="showSettings = !showSettings">
            {{ showSettings ? 'Hide' : 'Show' }}
          </button>
        </div>
        <div v-if="showSettings" class="space-y-3">
          <!-- Name & Description -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div class="form-control">
              <label class="label py-1"><span class="label-text text-xs">Portfolio Name</span></label>
              <input v-model="settingsForm.name" type="text" class="input input-bordered input-sm" placeholder="My Portfolio" />
            </div>
            <div class="form-control">
              <label class="label py-1"><span class="label-text text-xs">Description</span></label>
              <input v-model="settingsForm.description" type="text" class="input input-bordered input-sm" placeholder="Growth strategy..." />
            </div>
          </div>

          <!-- Benchmark -->
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-xs">Benchmark Index</span></label>
            <div class="flex gap-2">
              <input v-model="settingsForm.benchmark" type="text" class="input input-bordered input-sm flex-1 font-mono uppercase" placeholder="SPY" />
              <button class="btn btn-sm btn-outline" @click="saveBenchmark" :disabled="!settingsForm.benchmark">Update</button>
            </div>
            <p class="text-xs text-base-content/40 mt-1">Enter any ETF/index ticker (e.g. SPY, QQQ, IWM, DIA)</p>
          </div>

          <!-- Visibility -->
          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-3">
              <input type="checkbox" class="toggle toggle-primary toggle-sm" v-model="settingsForm.isPublic" @change="toggleVisibility" />
              <span class="label-text text-sm">Public portfolio (visible on leaderboard)</span>
            </label>
          </div>

          <!-- Save Name/Description -->
          <button class="btn btn-sm btn-primary" @click="saveMeta">Save Name & Description</button>

          <!-- Reset -->
          <div v-if="portfolioStore.portfolio?.allow_reset" class="divider text-xs text-base-content/40">Danger Zone</div>
          <div v-if="portfolioStore.portfolio?.allow_reset" class="flex items-center gap-2">
            <button class="btn btn-sm btn-error btn-outline" @click="showResetConfirm = true">Reset Portfolio</button>
            <span class="text-xs text-base-content/40">Start fresh with ${{ portfolioStore.startingCash.toLocaleString() }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Reset Confirmation Modal -->
    <dialog class="modal" :class="{ 'modal-open': showResetConfirm }">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Reset Portfolio?</h3>
        <p class="py-4 text-base-content/70">This will snapshot your current portfolio and start fresh with ${{ portfolioStore.startingCash.toLocaleString() }}.</p>
        <label class="label cursor-pointer justify-start gap-3">
          <input type="checkbox" class="checkbox checkbox-sm" v-model="keepVisible" />
          <span class="label-text">Keep track record visible publicly</span>
        </label>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showResetConfirm = false">Cancel</button>
          <button class="btn btn-error" @click="handleReset">Reset</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showResetConfirm = false"><button>close</button></form>
    </dialog>

    <!-- Settings Feedback -->
    <div v-if="settingsMsg" class="toast toast-end">
      <div class="alert" :class="settingsMsgType === 'success' ? 'alert-success' : 'alert-error'">
        <span>{{ settingsMsg }}</span>
      </div>
    </div>

    <!-- Recent Trades -->
    <div class="card bg-base-100 shadow" v-if="portfolioStore.trades.length > 0">
      <div class="card-body p-4">
        <h3 class="font-semibold mb-2">Recent Trades</h3>
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Ticker</th>
                <th>Side</th>
                <th class="text-right">Amount</th>
                <th class="text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in portfolioStore.trades.slice(0, 10)" :key="t.id">
                <td class="text-sm">{{ new Date(t.executed_at).toLocaleDateString() }}</td>
                <td class="font-mono font-bold">{{ t.ticker }}</td>
                <td><span class="badge badge-xs" :class="t.side === 'buy' ? 'badge-success' : 'badge-error'">{{ t.side }}</span></td>
                <td class="text-right font-mono">${{ Number(t.dollars).toFixed(2) }}</td>
                <td class="text-right font-mono">${{ Number(t.price).toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { usePortfolioStore } from '../../stores/portfolio'
import { supabase } from '../../lib/supabase'

const auth = useAuthStore()
const portfolioStore = usePortfolioStore()

const loading = ref(true)
const creatingPortfolio = ref(false)
const membership = ref(null)
const groupMembers = ref([])
const showBonusModal = ref(false)
const bonusTotal = ref(0)
const showSettings = ref(false)
const showResetConfirm = ref(false)
const keepVisible = ref(true)
const settingsMsg = ref('')
const settingsMsgType = ref('success')
const settingsForm = ref({ name: '', description: '', benchmark: '', isPublic: true })

const vsSP500 = computed(() => portfolioStore.totalReturnPct - portfolioStore.benchmarkReturnPct)
const isIndependent = computed(() => membership.value?.group_id === 'personal')

onMounted(async () => {
  // Get current membership
  membership.value = await auth.getCurrentMembership()

  if (membership.value?.group_id) {
    // Load group members
    groupMembers.value = await auth.getGroupMembers(membership.value.group_id)

    // Load portfolio
    await portfolioStore.loadPortfolio('group', membership.value.group_id)

    // Check for bonus notifications
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('group_id', membership.value.group_id)
      .not('seen_by', 'cs', `{${auth.currentUser.id}}`)

    if (notifications?.length > 0) {
      bonusTotal.value = notifications.reduce((sum, n) => sum + Number(n.amount), 0)
      showBonusModal.value = true
    }
  } else if (!membership.value) {
    // Independent user - check for personal portfolio
    await portfolioStore.loadPortfolio('user', auth.currentUser?.id)
    if (portfolioStore.portfolio) {
      // Has personal portfolio, treat as having a "group"
      membership.value = { group_id: 'personal', group: { name: 'My Portfolio' } }
      groupMembers.value = [{ id: auth.currentUser.id, full_name: auth.profile?.full_name }]
    }
  }

  // Populate settings form
  if (portfolioStore.portfolio) {
    settingsForm.value = {
      name: portfolioStore.portfolio.name || '',
      description: portfolioStore.portfolio.description || '',
      benchmark: portfolioStore.benchmarkTicker,
      isPublic: portfolioStore.portfolio.is_public ?? true
    }
  }

  loading.value = false
})

async function handleStartInvesting() {
  creatingPortfolio.value = true
  const result = await portfolioStore.createPersonalPortfolio()
  if (result.error) {
    creatingPortfolio.value = false
    return
  }
  await portfolioStore.loadPortfolio('user', auth.currentUser?.id)
  membership.value = { group_id: 'personal', group: { name: 'My Portfolio' } }
  groupMembers.value = [{ id: auth.currentUser.id, full_name: auth.profile?.full_name }]
  settingsForm.value = {
    name: portfolioStore.portfolio?.name || '',
    description: portfolioStore.portfolio?.description || '',
    benchmark: portfolioStore.benchmarkTicker,
    isPublic: portfolioStore.portfolio?.is_public ?? true
  }
  creatingPortfolio.value = false
}

function showFeedback(msg, type = 'success') {
  settingsMsg.value = msg
  settingsMsgType.value = type
  setTimeout(() => { settingsMsg.value = '' }, 3000)
}

async function saveBenchmark() {
  const ticker = settingsForm.value.benchmark.toUpperCase().trim()
  if (!ticker) return
  const result = await portfolioStore.changeBenchmark(ticker)
  if (result.error) return showFeedback(result.error, 'error')
  showFeedback(`Benchmark changed to ${ticker}`)
}

async function toggleVisibility() {
  const result = await portfolioStore.setPublic(settingsForm.value.isPublic)
  if (result.error) return showFeedback(result.error, 'error')
  showFeedback(settingsForm.value.isPublic ? 'Portfolio is now public' : 'Portfolio is now private')
}

async function saveMeta() {
  const result = await portfolioStore.updatePortfolioMeta(
    settingsForm.value.name,
    settingsForm.value.description
  )
  if (result.error) return showFeedback(result.error, 'error')
  showFeedback('Portfolio info saved')
}

async function handleReset() {
  showResetConfirm.value = false
  const result = await portfolioStore.resetPortfolio(keepVisible.value)
  if (result.error) return showFeedback(result.error, 'error')
  settingsForm.value.benchmark = portfolioStore.benchmarkTicker
  showFeedback('Portfolio has been reset!')
}

async function dismissBonus() {
  showBonusModal.value = false
  if (membership.value?.group_id) {
    // Mark notifications as seen
    const { data: notifications } = await supabase
      .from('notifications')
      .select('id, seen_by')
      .eq('group_id', membership.value.group_id)

    for (const n of (notifications || [])) {
      const seenBy = n.seen_by || []
      if (!seenBy.includes(auth.currentUser.id)) {
        await supabase
          .from('notifications')
          .update({ seen_by: [...seenBy, auth.currentUser.id] })
          .eq('id', n.id)
      }
    }
  }
}
</script>
