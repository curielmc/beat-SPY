<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Classes</h1>
      <p class="text-base-content/70">View and manage all classes</p>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else class="space-y-3">
      <div v-for="cls in classes" :key="cls.id" class="collapse collapse-arrow bg-base-100 shadow">
        <input type="checkbox" />
        <div class="collapse-title">
          <div class="flex items-center justify-between pr-4">
            <div class="flex items-center gap-3">
              <code class="badge badge-primary badge-outline font-mono">{{ cls.code }}</code>
              <span class="font-bold">{{ cls.class_name }}</span>
            </div>
            <div class="flex gap-2 text-sm text-base-content/60">
              <span>{{ cls.teacher?.full_name }}</span>
              <span class="badge badge-ghost badge-sm">{{ cls.groups?.length || 0 }} groups</span>
              <span class="badge badge-ghost badge-sm">{{ cls.memberships?.length || 0 }} students</span>
            </div>
          </div>
        </div>
        <div class="collapse-content">
          <div class="space-y-4">
            <!-- Inline Settings -->
            <div class="card bg-base-200 p-4">
              <h3 class="font-semibold mb-3">Class Settings</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div class="form-control">
                  <label class="label label-text text-xs">Starting Cash</label>
                  <div class="flex gap-2">
                    <input type="number" v-model.number="editState[cls.id].starting_cash" class="input input-bordered input-sm flex-1" />
                  </div>
                </div>
                <div class="form-control">
                  <label class="label label-text text-xs">Max Portfolios</label>
                  <input type="number" v-model.number="editState[cls.id].max_portfolios" class="input input-bordered input-sm" />
                </div>
                <div class="form-control">
                  <label class="label label-text text-xs">Group Mode</label>
                  <select v-model="editState[cls.id].group_mode" class="select select-bordered select-sm">
                    <option value="individual">Individual</option>
                    <option value="group">Group</option>
                  </select>
                </div>
                <div class="form-control">
                  <label class="label label-text text-xs">Approval Code</label>
                  <input type="text" v-model="editState[cls.id].approval_code" class="input input-bordered input-sm" placeholder="None" />
                </div>
                <div class="form-control">
                  <label class="label label-text text-xs cursor-pointer gap-2 justify-start">
                    <input type="checkbox" v-model="editState[cls.id].allow_reset" class="checkbox checkbox-sm" />
                    <span>Allow Reset</span>
                  </label>
                </div>
              </div>

              <!-- Restrictions -->
              <h4 class="font-semibold mt-4 mb-2 text-sm">Restrictions</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="form-control">
                  <label class="label label-text text-xs cursor-pointer gap-2 justify-start">
                    <input type="checkbox" v-model="editState[cls.id].restrictions.requireRationale" class="checkbox checkbox-sm" />
                    <span>Require Rationale</span>
                  </label>
                </div>
                <div class="form-control">
                  <label class="label label-text text-xs">Trade Frequency</label>
                  <select v-model="editState[cls.id].restrictions.tradeFrequency" class="select select-bordered select-sm">
                    <option value="">No Limit</option>
                    <option value="1_per_day">1 per day</option>
                    <option value="3_per_day">3 per day</option>
                    <option value="5_per_day">5 per day</option>
                    <option value="1_per_week">1 per week</option>
                    <option value="3_per_week">3 per week</option>
                  </select>
                </div>
              </div>

              <div class="mt-3 flex gap-2">
                <button class="btn btn-primary btn-sm" @click="saveClassSettings(cls)" :disabled="savingClass === cls.id">
                  {{ savingClass === cls.id ? 'Saving...' : 'Save Settings' }}
                </button>
              </div>
            </div>

            <!-- Group Leaderboard -->
            <div v-if="cls.groups?.length" class="card bg-base-200 p-4">
              <div class="flex items-center justify-between mb-3">
                <h3 class="font-semibold">Group Leaderboard</h3>
                <button v-if="!leaderboards[cls.id]" class="btn btn-xs btn-outline btn-primary" :disabled="leaderboardLoading[cls.id]" @click="loadLeaderboard(cls)">
                  {{ leaderboardLoading[cls.id] ? 'Loading...' : 'Load Leaderboard' }}
                </button>
              </div>
              <div class="overflow-x-auto">
                <table class="table table-sm">
                  <thead>
                    <tr>
                      <th class="w-10">Rank</th>
                      <th>Group</th>
                      <th>Members</th>
                      <th class="text-right">Funds</th>
                      <th class="text-right">Return %</th>
                      <th class="text-right">Portfolio Value</th>
                    </tr>
                  </thead>
                  <tbody v-for="(group, i) in (leaderboards[cls.id] || cls.groups)" :key="group.id">
                    <tr class="cursor-pointer hover" @click="leaderboards[cls.id] && toggleGroupExpand(cls.id, group.id)">
                      <td>
                        <span v-if="leaderboards[cls.id]" class="badge badge-sm" :class="i === 0 ? 'badge-warning' : 'badge-ghost'">{{ i + 1 }}</span>
                        <span v-else class="text-base-content/30">-</span>
                      </td>
                      <td class="font-medium">
                        <span v-if="leaderboards[cls.id] && group.funds?.length" class="mr-1 text-xs">{{ expandedGroups[cls.id + ':' + group.id] ? '&#9660;' : '&#9654;' }}</span>
                        {{ group.name }}
                      </td>
                      <td>
                        <div class="flex gap-1 flex-wrap">
                          <span v-for="m in getGroupMembers(cls, group.id)" :key="m.user_id" class="badge badge-sm badge-outline">
                            {{ m.profiles?.full_name?.split(' ')[0] }}
                          </span>
                        </div>
                      </td>
                      <td class="text-right">
                        <span v-if="leaderboards[cls.id]" class="badge badge-sm badge-ghost">{{ group.funds?.length || 0 }}</span>
                      </td>
                      <td class="text-right font-mono" :class="group.returnPct > 0 ? 'text-success' : group.returnPct < 0 ? 'text-error' : ''">
                        <template v-if="leaderboards[cls.id]">{{ group.returnPct >= 0 ? '+' : '' }}{{ group.returnPct.toFixed(2) }}%</template>
                        <span v-else class="text-base-content/30">-</span>
                      </td>
                      <td class="text-right font-mono">
                        <template v-if="leaderboards[cls.id]">${{ group.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</template>
                        <span v-else class="text-base-content/30">-</span>
                      </td>
                    </tr>
                    <!-- Expanded fund details -->
                    <tr v-if="expandedGroups[cls.id + ':' + group.id] && group.funds?.length">
                      <td :colspan="6" class="p-0">
                        <div class="bg-base-300 p-3 space-y-3">
                          <!-- Fund tabs -->
                          <div class="tabs tabs-boxed tabs-sm bg-base-200">
                            <button v-for="fund in group.funds" :key="fund.id" class="tab" :class="{ 'tab-active': (activeFundTab[group.id] || group.funds[0]?.id) === fund.id }" @click.stop="activeFundTab[group.id] = fund.id">
                              {{ fund.name }}
                            </button>
                          </div>
                          <!-- Active fund details -->
                          <div v-for="fund in group.funds" :key="fund.id" v-show="(activeFundTab[group.id] || group.funds[0]?.id) === fund.id">
                            <div class="flex gap-4 text-sm mb-2">
                              <span>Cash: <strong class="font-mono">${{ fund.cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</strong></span>
                              <span>Starting: <strong class="font-mono">${{ fund.startingCash.toLocaleString('en-US', { minimumFractionDigits: 0 }) }}</strong></span>
                              <span>Value: <strong class="font-mono">${{ fund.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</strong></span>
                              <span :class="fund.returnPct >= 0 ? 'text-success' : 'text-error'">
                                {{ fund.returnPct >= 0 ? '+' : '' }}{{ fund.returnPct.toFixed(2) }}%
                              </span>
                            </div>
                            <div v-if="fund.holdings.length === 0" class="text-sm text-base-content/40">All cash — no holdings</div>
                            <table v-else class="table table-xs">
                              <thead>
                                <tr>
                                  <th>Ticker</th>
                                  <th class="text-right">Shares</th>
                                  <th class="text-right">Avg Cost</th>
                                  <th class="text-right">Price</th>
                                  <th class="text-right">Market Value</th>
                                  <th class="text-right">Gain/Loss</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr v-for="h in fund.holdings" :key="h.ticker">
                                  <td class="font-mono font-semibold">{{ h.ticker }}</td>
                                  <td class="text-right font-mono">{{ h.shares.toFixed(2) }}</td>
                                  <td class="text-right font-mono">${{ h.avgCost.toFixed(2) }}</td>
                                  <td class="text-right font-mono">${{ h.price.toFixed(2) }}</td>
                                  <td class="text-right font-mono">${{ h.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                                  <td class="text-right font-mono" :class="(h.price - h.avgCost) >= 0 ? 'text-success' : 'text-error'">
                                    {{ ((h.price - h.avgCost) / h.avgCost * 100).toFixed(2) }}%
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Invites -->
            <div class="card bg-base-200 p-4">
              <div class="flex items-center justify-between mb-2">
                <h3 class="font-semibold">Pending Invites</h3>
                <span class="badge badge-sm">{{ (invites[cls.id] || []).length }}</span>
              </div>
              <div v-if="!invitesLoaded[cls.id]">
                <button class="btn btn-xs btn-outline" @click="loadInvites(cls.id)">Load Invites</button>
              </div>
              <div v-else-if="(invites[cls.id] || []).length === 0" class="text-sm text-base-content/50">No pending invites</div>
              <table v-else class="table table-xs">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="inv in invites[cls.id]" :key="inv.id">
                    <td class="text-sm">{{ inv.email }}</td>
                    <td><span class="badge badge-xs" :class="inv.status === 'pending' ? 'badge-warning' : 'badge-success'">{{ inv.status }}</span></td>
                    <td class="text-sm text-base-content/60">{{ new Date(inv.created_at).toLocaleDateString() }}</td>
                    <td>
                      <button class="btn btn-ghost btn-xs text-error" @click="deleteInvite(cls.id, inv.id)">Delete</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="flex gap-2">
              <button class="btn btn-sm btn-outline btn-primary" @click="viewAsTeacher(cls)">View as Teacher</button>
              <button class="btn btn-error btn-sm btn-outline" @click="confirmDelete(cls)">Delete Class</button>
            </div>
          </div>
        </div>
      </div>

      <p v-if="classes.length === 0" class="text-center text-base-content/50 py-8">No classes found</p>
    </div>

    <!-- Delete Modal -->
    <dialog class="modal" :class="{ 'modal-open': showDeleteModal }">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Delete Class</h3>
        <p class="py-4">Are you sure you want to delete <strong>{{ deleteTarget?.class_name }}</strong> ({{ deleteTarget?.code }})? This will also delete all associated groups and memberships.</p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showDeleteModal = false">Cancel</button>
          <button class="btn btn-error" @click="deleteClass">Delete</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showDeleteModal = false"><button>close</button></form>
    </dialog>

    <div v-if="successMsg" class="alert alert-success fixed bottom-4 right-4 w-auto z-50">
      <span>{{ successMsg }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase'
import { useMarketDataStore } from '../../stores/marketData'

const router = useRouter()
const market = useMarketDataStore()

const classes = ref([])
const loading = ref(true)
const showDeleteModal = ref(false)
const deleteTarget = ref(null)
const savingClass = ref(null)
const successMsg = ref('')
const editState = reactive({})
const invites = reactive({})
const invitesLoaded = reactive({})
const leaderboards = reactive({})
const leaderboardLoading = reactive({})
const expandedGroups = reactive({})
const activeFundTab = reactive({})

function toggleGroupExpand(classId, groupId) {
  const key = classId + ':' + groupId
  expandedGroups[key] = !expandedGroups[key]
}

onMounted(async () => {
  await fetchClasses()
})

async function fetchClasses() {
  loading.value = true
  const { data } = await supabase
    .from('classes')
    .select('*, teacher:profiles!classes_teacher_id_fkey(full_name, email), groups(*), memberships:class_memberships(*, profiles:profiles(full_name))')
    .order('created_at', { ascending: false })
  classes.value = data || []

  // Initialize edit state for each class
  for (const cls of classes.value) {
    const restrictions = cls.restrictions || {}
    editState[cls.id] = {
      starting_cash: cls.starting_cash,
      allow_reset: cls.allow_reset ?? false,
      max_portfolios: cls.max_portfolios ?? 1,
      group_mode: cls.group_mode || 'individual',
      approval_code: cls.approval_code || '',
      restrictions: {
        requireRationale: restrictions.requireRationale ?? false,
        tradeFrequency: restrictions.tradeFrequency || ''
      }
    }
  }
  loading.value = false
}

function getGroupMembers(cls, groupId) {
  return (cls.memberships || []).filter(m => m.group_id === groupId)
}

async function saveClassSettings(cls) {
  savingClass.value = cls.id
  const state = editState[cls.id]
  const restrictions = { ...state.restrictions }
  if (!restrictions.tradeFrequency) delete restrictions.tradeFrequency

  const { error } = await supabase.from('classes').update({
    starting_cash: state.starting_cash,
    allow_reset: state.allow_reset,
    max_portfolios: state.max_portfolios,
    group_mode: state.group_mode,
    approval_code: state.approval_code || null,
    restrictions
  }).eq('id', cls.id)

  savingClass.value = null
  if (!error) {
    showSuccess('Settings saved')
    // Update local data
    Object.assign(cls, {
      starting_cash: state.starting_cash,
      allow_reset: state.allow_reset,
      max_portfolios: state.max_portfolios,
      group_mode: state.group_mode,
      approval_code: state.approval_code || null,
      restrictions
    })
  }
}

async function loadInvites(classId) {
  const { data } = await supabase
    .from('class_invites')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
  invites[classId] = data || []
  invitesLoaded[classId] = true
}

async function deleteInvite(classId, inviteId) {
  await supabase.from('class_invites').delete().eq('id', inviteId)
  invites[classId] = (invites[classId] || []).filter(i => i.id !== inviteId)
  showSuccess('Invite deleted')
}

async function loadLeaderboard(cls) {
  leaderboardLoading[cls.id] = true

  // Fetch ALL portfolios (funds) for all groups
  const groupIds = (cls.groups || []).map(g => g.id)
  const { data: portfolios } = await supabase
    .from('portfolios')
    .select('id, owner_id, cash_balance, starting_cash, fund_starting_cash, fund_name, fund_number, status')
    .eq('owner_type', 'group')
    .in('owner_id', groupIds)
    .or('status.eq.active,status.is.null')
    .order('fund_number', { ascending: true })

  // Group portfolios by owner_id (each group can have multiple funds)
  const fundsMap = {} // groupId -> [portfolio, ...]
  const portfolioIds = []
  for (const p of (portfolios || [])) {
    if (!fundsMap[p.owner_id]) fundsMap[p.owner_id] = []
    fundsMap[p.owner_id].push(p)
    portfolioIds.push(p.id)
  }

  // Fetch all holdings for these portfolios
  const holdingsMap = {}
  if (portfolioIds.length) {
    const { data: allHoldings } = await supabase
      .from('holdings')
      .select('portfolio_id, ticker, shares, avg_cost')
      .in('portfolio_id', portfolioIds)
    for (const h of (allHoldings || [])) {
      if (!holdingsMap[h.portfolio_id]) holdingsMap[h.portfolio_id] = []
      holdingsMap[h.portfolio_id].push(h)
    }
  }

  // Fetch current market prices for all tickers
  const allTickers = new Set()
  for (const holdings of Object.values(holdingsMap)) {
    for (const h of holdings) allTickers.add(h.ticker)
  }
  if (allTickers.size > 0) {
    await market.fetchBatchQuotes([...allTickers])
  }

  // Calculate per-fund and consolidated values
  const ranked = []
  for (const group of (cls.groups || [])) {
    const funds = fundsMap[group.id] || []
    let consolidatedValue = 0
    let consolidatedStarting = 0
    const fundDetails = []

    for (const fund of funds) {
      const startCash = Number(fund.fund_starting_cash || fund.starting_cash || cls.starting_cash || 100000)
      const holdings = holdingsMap[fund.id] || []
      const enrichedHoldings = holdings.map(h => {
        const price = market.getCachedPrice(h.ticker) || Number(h.avg_cost)
        const shares = Number(h.shares)
        return { ticker: h.ticker, shares, avgCost: Number(h.avg_cost), price, marketValue: shares * price }
      })
      const holdingsValue = enrichedHoldings.reduce((sum, h) => sum + h.marketValue, 0)
      const totalValue = holdingsValue + Number(fund.cash_balance)
      const returnPct = startCash > 0 ? ((totalValue - startCash) / startCash) * 100 : 0

      fundDetails.push({
        id: fund.id,
        name: fund.fund_name || `Fund ${fund.fund_number || 1}`,
        fundNumber: fund.fund_number || 1,
        cashBalance: Number(fund.cash_balance),
        startingCash: startCash,
        totalValue,
        returnPct,
        holdings: enrichedHoldings
      })

      consolidatedValue += totalValue
      consolidatedStarting += startCash
    }

    // If group has no funds, show starting cash as default
    if (funds.length === 0) {
      consolidatedStarting = cls.starting_cash || 100000
      consolidatedValue = consolidatedStarting
    }

    const returnPct = consolidatedStarting > 0 ? ((consolidatedValue - consolidatedStarting) / consolidatedStarting) * 100 : 0
    ranked.push({ ...group, totalValue: consolidatedValue, returnPct, funds: fundDetails })
  }
  ranked.sort((a, b) => b.returnPct - a.returnPct)
  leaderboards[cls.id] = ranked
  leaderboardLoading[cls.id] = false
}

function viewAsTeacher(cls) {
  router.push({ path: '/teacher', query: { class_id: cls.id } })
}

function confirmDelete(cls) {
  deleteTarget.value = cls
  showDeleteModal.value = true
}

async function deleteClass() {
  if (!deleteTarget.value) return
  await supabase.from('classes').delete().eq('id', deleteTarget.value.id)
  classes.value = classes.value.filter(c => c.id !== deleteTarget.value.id)
  showDeleteModal.value = false
}

function showSuccess(msg) {
  successMsg.value = msg
  setTimeout(() => { successMsg.value = '' }, 3000)
}
</script>
