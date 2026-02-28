<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Student Progress</h1>
      <p class="text-base-content/70">View each group's performance, holdings, and allocation</p>
    </div>

    <!-- Unassigned Students -->
    <div v-if="teacher.unassignedStudents.length > 0" class="card bg-warning/10 shadow border border-warning/30">
      <div class="card-body">
        <h2 class="card-title text-lg">Unassigned Students ({{ teacher.unassignedStudents.length }})</h2>
        <p class="text-sm text-base-content/60 mb-3">These students signed up but haven't been assigned to a group yet.</p>

        <div class="space-y-2">
          <div v-for="student in teacher.unassignedStudents" :key="student.id" class="flex items-center gap-3 bg-base-100 rounded-lg p-3">
            <span class="font-medium flex-1">{{ student.name }}</span>
            <select v-model="assignTargets[student.id]" class="select select-bordered select-sm w-48">
              <option value="">Select group...</option>
              <option v-for="group in teacher.teacherGroups" :key="group.id" :value="group.id">{{ group.name }}</option>
              <option value="__new__">+ Create new group</option>
            </select>
            <input
              v-if="assignTargets[student.id] === '__new__'"
              v-model="newGroupNames[student.id]"
              type="text"
              class="input input-bordered input-sm w-40"
              placeholder="Group name"
            />
            <button
              class="btn btn-primary btn-sm"
              :disabled="!assignTargets[student.id] || (assignTargets[student.id] === '__new__' && !newGroupNames[student.id]?.trim())"
              @click="handleAssign(student.id)"
            >Assign</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Award Cash Modal -->
    <dialog class="modal" :class="{ 'modal-open': showAwardModal }">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Award Bonus Cash</h3>
        <p class="text-base-content/60 mb-4">Award bonus cash to <strong>{{ awardGroupName }}</strong></p>
        <div class="form-control mb-4">
          <label class="label"><span class="label-text">Amount ($)</span></label>
          <input v-model.number="awardAmount" type="number" min="1" step="100" class="input input-bordered w-full" placeholder="e.g. 5000" />
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showAwardModal = false">Cancel</button>
          <button class="btn btn-success" :disabled="!awardAmount || awardAmount <= 0" @click="confirmAward">Award</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showAwardModal = false"><button>close</button></form>
    </dialog>

    <div v-if="awardSuccess" class="alert alert-success">
      <span>{{ awardSuccess }}</span>
    </div>

    <!-- Per-group sections -->
    <div v-for="group in teacher.rankedGroups" :key="group.id" class="collapse collapse-arrow bg-base-100 shadow">
      <input type="checkbox" />
      <div class="collapse-title">
        <div class="flex items-center justify-between pr-4">
          <div class="flex items-center gap-2">
            <span class="font-bold">{{ group.name }}</span>
            <span class="badge badge-sm" :class="group.returnPct >= 0 ? 'badge-success' : 'badge-error'">
              {{ group.returnPct >= 0 ? '+' : '' }}{{ group.returnPct.toFixed(2) }}%
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn btn-xs btn-success btn-outline" @click.stop="openAwardModal(group)">$ Award Cash</button>
            <span class="text-sm text-base-content/60">{{ getGroupMembers(group).map(s => s.name.split(' ')[0]).join(', ') }}</span>
          </div>
        </div>
      </div>
      <div class="collapse-content">
        <!-- Members with transfer -->
        <div class="mb-3">
          <span class="text-sm text-base-content/60">Members: </span>
          <div class="flex flex-wrap gap-2 mt-1">
            <div v-for="s in getGroupMembers(group)" :key="s.id" class="flex items-center gap-1 bg-base-200 rounded-lg px-2 py-1">
              <span class="text-sm font-medium">{{ s.name }}</span>
              <select
                class="select select-ghost select-xs w-auto min-w-0 pl-1"
                @change="handleTransfer(s.id, group.id, $event.target.value); $event.target.value = ''"
              >
                <option value="" selected>Move...</option>
                <option v-for="g in otherGroups(group.id)" :key="g.id" :value="g.id">→ {{ g.name }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div class="stats stats-vertical sm:stats-horizontal bg-base-200 rounded-lg w-full mb-4">
          <div class="stat py-2">
            <div class="stat-title text-xs">Portfolio Value</div>
            <div class="stat-value text-lg">${{ group.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
          </div>
          <div class="stat py-2">
            <div class="stat-title text-xs">Cash</div>
            <div class="stat-value text-lg">${{ (getPortfolioData(group.id)?.cashBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
          </div>
          <div class="stat py-2">
            <div class="stat-title text-xs">Return</div>
            <div class="stat-value text-lg" :class="group.returnPct >= 0 ? 'text-success' : 'text-error'">{{ group.returnPct >= 0 ? '+' : '' }}{{ group.returnPct.toFixed(2) }}%</div>
          </div>
        </div>

        <!-- Performance Chart -->
        <div class="card bg-base-200 mb-4">
          <div class="card-body p-3">
            <div class="flex items-center justify-between mb-1">
              <h3 class="font-semibold text-sm">Performance vs S&P 500</h3>
              <TimeRangeSelector v-model="timeRanges[group.id]" />
            </div>
            <PortfolioLineChart :datasets="getGroupChartDatasets(group)" :time-range="timeRanges[group.id] || '3M'" height="220px" />
          </div>
        </div>

        <!-- 4 Pie Charts -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <PortfolioPieChart title="By Stock" :segments="getStockSegments(group.id)" height="150px" />
          <PortfolioPieChart title="By Sector" :segments="getSectorSegments(group.id)" height="150px" />
          <PortfolioPieChart title="By Country" :segments="getCountrySegments(group.id)" height="150px" />
          <PortfolioPieChart title="By Asset Class" :segments="getAssetClassSegments(group.id)" height="150px" />
        </div>

        <!-- Holdings Table -->
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Shares</th>
                <th class="text-right">Avg Cost</th>
                <th class="text-right">Current</th>
                <th class="text-right">Market Value</th>
                <th class="text-right">Gain/Loss</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in getHoldings(group.id)" :key="h.ticker">
                <td class="font-mono font-bold">{{ h.ticker }}</td>
                <td>{{ h.shares }}</td>
                <td class="text-right font-mono">${{ h.avgCost.toFixed(2) }}</td>
                <td class="text-right font-mono">${{ h.currentPrice.toFixed(2) }}</td>
                <td class="text-right font-mono">${{ h.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                <td class="text-right font-mono" :class="h.gainLoss >= 0 ? 'text-success' : 'text-error'">
                  {{ h.gainLoss >= 0 ? '+' : '' }}${{ h.gainLoss.toFixed(2) }}
                </td>
              </tr>
              <tr v-if="getHoldings(group.id).length === 0">
                <td colspan="6" class="text-center text-base-content/50">No holdings yet</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useTeacherStore } from '../../stores/teacher'
import { useAuthStore } from '../../stores/auth'
import { useHistoricalDataStore } from '../../stores/historicalData'
import { usePortfolioStore } from '../../stores/portfolio'
import stocksData from '../../mock/stocks.json'

const portfolioStore = usePortfolioStore()
import PortfolioLineChart from '../../components/charts/PortfolioLineChart.vue'
import PortfolioPieChart from '../../components/charts/PortfolioPieChart.vue'
import TimeRangeSelector from '../../components/charts/TimeRangeSelector.vue'

const teacher = useTeacherStore()
const auth = useAuthStore()
const histStore = useHistoricalDataStore()

const timeRanges = reactive({})
const assignTargets = reactive({})
const newGroupNames = reactive({})

// Award cash
const showAwardModal = ref(false)
const awardGroupId = ref(null)
const awardGroupName = ref('')
const awardAmount = ref(null)
const awardSuccess = ref('')

function openAwardModal(group) {
  awardGroupId.value = group.id
  awardGroupName.value = group.name
  awardAmount.value = null
  showAwardModal.value = true
}

function confirmAward() {
  if (!awardGroupId.value || !awardAmount.value || awardAmount.value <= 0) return
  teacher.awardBonusCash(awardGroupId.value, awardAmount.value)
  awardSuccess.value = `Awarded $${awardAmount.value.toLocaleString()} to ${awardGroupName.value}!`
  showAwardModal.value = false
  setTimeout(() => { awardSuccess.value = '' }, 5000)
}

// Assignment
function handleAssign(studentId) {
  const target = assignTargets[studentId]
  if (!target) return
  let groupId = target
  if (target === '__new__') {
    const name = newGroupNames[studentId]?.trim()
    if (!name) return
    const newGroup = teacher.createGroupForTeacher(name)
    if (!newGroup) return
    groupId = newGroup.id
    delete newGroupNames[studentId]
  }
  teacher.assignStudentToGroup(studentId, groupId)
  delete assignTargets[studentId]
}

// Transfers
function otherGroups(currentGroupId) {
  return teacher.teacherGroups.filter(g => g.id !== currentGroupId)
}

function handleTransfer(studentId, fromGroupId, toGroupId) {
  if (!toGroupId) return
  teacher.moveStudentToGroup(studentId, fromGroupId, toGroupId)
}

function getGroupMembers(group) {
  return auth.students.filter(s => group.memberIds.includes(s.id))
}

function getPortfolioData(groupId) {
  return portfolioStore.portfolios[groupId] || null
}

function getHoldings(groupId) {
  const p = portfolioStore.portfolios[groupId]
  if (!p) return []
  return p.holdings.map(h => {
    const stock = stocksData.find(s => s.ticker === h.ticker)
    const currentPrice = stock?.price || 0
    const marketValue = h.shares * currentPrice
    const costBasis = h.shares * h.avgCost
    return { ...h, currentPrice, marketValue, gainLoss: marketValue - costBasis }
  })
}

function getGroupChartDatasets(group) {
  return [
    { label: group.name, data: histStore.getGroupHistory(group.id), color: 'primary' },
    { label: 'S&P 500', data: histStore.sp500History, color: 'sp500' }
  ]
}

function getEnrichedHoldings(groupId) {
  const p = portfolioStore.portfolios[groupId]
  if (!p) return []
  return p.holdings.map(h => {
    const stock = stocksData.find(s => s.ticker === h.ticker)
    return {
      ticker: h.ticker,
      marketValue: h.shares * (stock?.price || 0),
      sector: stock?.sector || 'Unknown',
      country: stock?.country || 'Unknown',
      assetType: stock?.assetType || 'Stock'
    }
  })
}

function getStockSegments(groupId) {
  return getEnrichedHoldings(groupId).map(h => ({ label: h.ticker, value: h.marketValue }))
}

function getSectorSegments(groupId) {
  const map = {}
  getEnrichedHoldings(groupId).forEach(h => { map[h.sector] = (map[h.sector] || 0) + h.marketValue })
  return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}

function getCountrySegments(groupId) {
  const map = {}
  getEnrichedHoldings(groupId).forEach(h => { map[h.country] = (map[h.country] || 0) + h.marketValue })
  return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}

function getAssetClassSegments(groupId) {
  const p = portfolioStore.portfolios[groupId]
  const map = { Cash: p?.cashBalance || 0 }
  getEnrichedHoldings(groupId).forEach(h => { map[h.assetType] = (map[h.assetType] || 0) + h.marketValue })
  return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}
</script>
