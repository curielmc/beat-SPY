<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Student Progress</h1>
      <p class="text-base-content/70">View each group's performance, holdings, and allocation</p>
    </div>

    <div v-for="group in teacher.rankedGroups" :key="group.id" class="collapse collapse-arrow bg-base-100 shadow">
      <input type="checkbox" />
      <div class="collapse-title">
        <div class="flex items-center justify-between pr-4">
          <div>
            <span class="font-bold">{{ group.name }}</span>
            <span class="badge badge-sm ml-2" :class="group.returnPct >= 0 ? 'badge-success' : 'badge-error'">
              {{ group.returnPct >= 0 ? '+' : '' }}{{ group.returnPct.toFixed(2) }}%
            </span>
          </div>
          <span class="text-sm text-base-content/60">{{ getGroupMembers(group).map(s => s.name.split(' ')[0]).join(', ') }}</span>
        </div>
      </div>
      <div class="collapse-content">
        <!-- Members -->
        <div class="mb-3">
          <span class="text-sm text-base-content/60">Members: </span>
          <span v-for="(s, i) in getGroupMembers(group)" :key="s.id" class="text-sm">{{ s.name }}{{ i < getGroupMembers(group).length - 1 ? ', ' : '' }}</span>
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
import { reactive } from 'vue'
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
