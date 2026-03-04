<template>
  <div class="p-4 space-y-6">
    <div>
      <h1 class="text-xl font-bold">Fund Analytics</h1>
      <p class="text-sm text-base-content/60">Sector exposure and stock overlap across all groups</p>
    </div>

    <div v-if="loading" class="flex justify-center py-16">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <!-- ── AGGREGATE SECTOR EXPOSURE ── -->
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body p-4 space-y-4">
          <h2 class="font-bold text-base">📊 Aggregate Sector Exposure — All Groups</h2>
          <div class="flex flex-col md:flex-row gap-6 items-start">
            <!-- Pie chart -->
            <div class="w-full md:w-64 h-64 flex-shrink-0">
              <PortfolioPieChart v-if="aggregatePieData" :chart-data="aggregatePieData" />
            </div>
            <!-- Table -->
            <div class="flex-1 w-full overflow-x-auto">
              <table class="table table-sm w-full">
                <thead>
                  <tr>
                    <th>Sector</th>
                    <th class="text-right">$ Invested</th>
                    <th class="text-right">%</th>
                    <th class="text-right"># Stocks</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in aggregateSectors" :key="row.sector">
                    <td class="flex items-center gap-2">
                      <span class="inline-block w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: row.color }"></span>
                      {{ row.sector }}
                    </td>
                    <td class="text-right">${{ row.dollars.toLocaleString() }}</td>
                    <td class="text-right font-semibold">{{ row.pct.toFixed(1) }}%</td>
                    <td class="text-right text-base-content/60">{{ row.count }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- ── PER-GROUP BREAKDOWN ── -->
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body p-4 space-y-4">
          <h2 class="font-bold text-base">🏦 Sector Breakdown by Group</h2>

          <!-- Group tabs -->
          <div class="flex flex-wrap gap-2">
            <button
              v-for="g in groupBreakdowns"
              :key="g.id"
              class="btn btn-sm"
              :class="activeGroup === g.id ? 'btn-primary' : 'btn-ghost'"
              @click="activeGroup = g.id"
            >{{ g.name }}</button>
          </div>

          <!-- Active group breakdown -->
          <div v-if="activeGroupData" class="space-y-2">
            <div v-for="row in activeGroupData.sectors" :key="row.sector" class="space-y-1">
              <div class="flex justify-between text-sm">
                <span class="flex items-center gap-2">
                  <span class="inline-block w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: row.color }"></span>
                  {{ row.sector }}
                </span>
                <span class="text-base-content/60">${{ row.dollars.toLocaleString() }} · {{ row.pct.toFixed(1) }}%</span>
              </div>
              <div class="w-full bg-base-200 rounded-full h-2">
                <div class="h-2 rounded-full transition-all" :style="{ width: row.pct + '%', backgroundColor: row.color }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── STOCK OVERLAP ── -->
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body p-4 space-y-4">
          <h2 class="font-bold text-base">🔁 Stock Overlap</h2>

          <!-- Stocks in multiple groups -->
          <div v-if="overlappingStocks.length">
            <p class="text-sm text-base-content/60 mb-2">Held by 2+ groups</p>
            <table class="table table-sm w-full">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Sector</th>
                  <th>Groups</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in overlappingStocks" :key="s.ticker">
                  <td class="font-bold">{{ s.ticker }}</td>
                  <td class="text-base-content/60 text-xs">{{ s.sector }}</td>
                  <td>
                    <div class="flex flex-wrap gap-1">
                      <span v-for="g in s.groups" :key="g" class="badge badge-sm badge-primary badge-outline">{{ g }}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-sm text-base-content/50">No stocks are held by more than one group.</p>

          <!-- Unique stocks -->
          <div v-if="uniqueStocks.length">
            <p class="text-sm text-base-content/60 mb-2">Unique picks (only 1 group)</p>
            <div class="flex flex-wrap gap-2">
              <span v-for="s in uniqueStocks" :key="s.ticker" class="badge badge-ghost gap-1">
                <span class="font-bold">{{ s.ticker }}</span>
                <span class="opacity-60">{{ s.groups[0] }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../../lib/supabase'
import { getBatchProfiles } from '../../services/fmpApi'
import PortfolioPieChart from '../../components/charts/PortfolioPieChart.vue'

const loading = ref(true)
const groupBreakdowns = ref([])
const activeGroup = ref(null)
const aggregateSectors = ref([])
const overlappingStocks = ref([])
const uniqueStocks = ref([])

const COLORS = [
  '#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6',
  '#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16',
  '#64748b'
]

const SECTOR_COLORS = {}
function colorForSector(sector, index) {
  if (!SECTOR_COLORS[sector]) {
    SECTOR_COLORS[sector] = COLORS[Object.keys(SECTOR_COLORS).length % COLORS.length]
  }
  return SECTOR_COLORS[sector]
}

const activeGroupData = computed(() => groupBreakdowns.value.find(g => g.id === activeGroup.value))

const aggregatePieData = computed(() => {
  if (!aggregateSectors.value.length) return null
  return {
    labels: aggregateSectors.value.map(r => r.sector),
    datasets: [{
      data: aggregateSectors.value.map(r => r.pct),
      backgroundColor: aggregateSectors.value.map(r => r.color)
    }]
  }
})

function buildSectorRows(sectorMap, totalDollars) {
  return Object.entries(sectorMap)
    .map(([sector, { dollars, tickers }]) => ({
      sector,
      dollars: Math.round(dollars),
      pct: totalDollars > 0 ? (dollars / totalDollars) * 100 : 0,
      count: tickers.size,
      color: colorForSector(sector)
    }))
    .sort((a, b) => b.dollars - a.dollars)
}

onMounted(async () => {
  const CLASS_ID = 'c0ee1de7-bf4d-4598-8285-44c8f89f3b22'

  // Fetch groups, portfolios, holdings
  const [{ data: groups }, { data: ports }, { data: allHoldings }] = await Promise.all([
    supabase.from('groups').select('id, name').eq('class_id', CLASS_ID),
    supabase.from('portfolios').select('id, owner_id, cash_balance').eq('owner_type', 'group'),
    supabase.from('holdings').select('portfolio_id, ticker, shares, avg_cost')
  ])

  const portByOwner = {}
  for (const p of (ports || [])) portByOwner[p.owner_id] = p

  const holdingsByPort = {}
  for (const h of (allHoldings || [])) {
    if (!holdingsByPort[h.portfolio_id]) holdingsByPort[h.portfolio_id] = []
    holdingsByPort[h.portfolio_id].push(h)
  }

  // Collect all unique tickers
  const allTickers = [...new Set((allHoldings || []).map(h => h.ticker))]

  // Fetch sector data from FMP
  let profiles = {}
  if (allTickers.length) {
    const profileList = await getBatchProfiles(allTickers)
    for (const p of (profileList || [])) {
      profiles[p.symbol] = p
    }
  }

  // Build per-group breakdowns
  const breakdowns = []
  const aggregateMap = {} // sector -> { dollars, tickers: Set }
  const tickerGroupMap = {} // ticker -> [group names]

  for (const g of (groups || [])) {
    const port = portByOwner[g.id]
    if (!port) continue

    const holdings = holdingsByPort[port.id] || []
    const cash = Number(port.cash_balance || 0)
    const sectorMap = {}

    for (const h of holdings) {
      const dollars = Number(h.shares) * Number(h.avg_cost)
      const sector = profiles[h.ticker]?.sector || 'Unknown'
      const ticker = h.ticker

      if (!sectorMap[sector]) sectorMap[sector] = { dollars: 0, tickers: new Set() }
      sectorMap[sector].dollars += dollars
      sectorMap[sector].tickers.add(ticker)

      if (!aggregateMap[sector]) aggregateMap[sector] = { dollars: 0, tickers: new Set() }
      aggregateMap[sector].dollars += dollars
      aggregateMap[sector].tickers.add(ticker)

      if (!tickerGroupMap[ticker]) tickerGroupMap[ticker] = []
      if (!tickerGroupMap[ticker].includes(g.name)) tickerGroupMap[ticker].push(g.name)
    }

    // Add cash
    if (cash > 0) {
      if (!sectorMap['Cash']) sectorMap['Cash'] = { dollars: 0, tickers: new Set() }
      sectorMap['Cash'].dollars += cash
      sectorMap['Cash'].tickers.add('CASH')
      if (!aggregateMap['Cash']) aggregateMap['Cash'] = { dollars: 0, tickers: new Set() }
      aggregateMap['Cash'].dollars += cash
    }

    const totalDollars = Object.values(sectorMap).reduce((s, v) => s + v.dollars, 0)
    breakdowns.push({
      id: g.id,
      name: g.name,
      sectors: buildSectorRows(sectorMap, totalDollars)
    })
  }

  groupBreakdowns.value = breakdowns
  if (breakdowns.length) activeGroup.value = breakdowns[0].id

  // Aggregate
  const aggTotal = Object.values(aggregateMap).reduce((s, v) => s + v.dollars, 0)
  aggregateSectors.value = buildSectorRows(aggregateMap, aggTotal)

  // Stock overlap
  const overlap = []
  const unique = []
  for (const [ticker, gs] of Object.entries(tickerGroupMap)) {
    const sector = profiles[ticker]?.sector || 'Unknown'
    const entry = { ticker, sector, groups: gs }
    if (gs.length > 1) overlap.push(entry)
    else unique.push(entry)
  }
  overlappingStocks.value = overlap.sort((a, b) => b.groups.length - a.groups.length)
  uniqueStocks.value = unique.sort((a, b) => a.ticker.localeCompare(b.ticker))

  loading.value = false
})
</script>
