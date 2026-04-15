<template>
  <dialog v-if="isOpen && group" class="modal" :class="{ 'modal-open': isOpen }">
    <div class="modal-box max-w-4xl max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="font-bold text-lg">Performance Attribution</h3>
          <p class="text-sm text-base-content/60">
            <strong>{{ group?.name }}</strong> — what helped, what hurt, and why
          </p>
        </div>
        <button type="button" class="btn btn-sm btn-circle btn-ghost" @click="$emit('close')">✕</button>
      </div>

      <!-- Time Range Selector -->
      <div class="flex items-center gap-3 mb-6">
        <span class="text-xs text-base-content/50 font-semibold">Period:</span>
        <div class="join">
          <button
            type="button"
            v-for="range in ranges"
            :key="range"
            class="btn btn-xs join-item"
            :class="selectedRange === range ? 'btn-primary' : 'btn-ghost border border-base-300'"
            @click="selectedRange = range"
          >
            {{ range }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="flex flex-col gap-4 py-8">
        <div class="skeleton h-20 w-full"></div>
        <div class="skeleton h-48 w-full"></div>
        <div class="skeleton h-48 w-full"></div>
      </div>

      <template v-else-if="attributions.length">
        <!-- Summary stats -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div class="card bg-success/10 border border-success/20 p-4 text-center">
            <div class="text-xs text-base-content/60 mb-1">Biggest Help</div>
            <div class="font-mono font-bold text-lg text-success">{{ topHelper?.ticker || '—' }}</div>
            <div class="text-success font-semibold">{{ formatSignedPct(topHelper?.contribution) }}</div>
          </div>
          <div class="card bg-base-100 border border-base-300 p-4 text-center">
            <div class="text-xs text-base-content/60 mb-1">Total Return ({{ selectedRange }})</div>
            <div class="text-2xl font-bold" :class="totalReturn >= 0 ? 'text-success' : 'text-error'">
              {{ totalReturn >= 0 ? '+' : '' }}{{ totalReturn.toFixed(2) }}%
            </div>
            <div class="text-xs text-base-content/40">vs SPY {{ spyReturn >= 0 ? '+' : '' }}{{ spyReturn.toFixed(2) }}%</div>
          </div>
          <div class="card bg-error/10 border border-error/20 p-4 text-center">
            <div class="text-xs text-base-content/60 mb-1">Biggest Drag</div>
            <div class="font-mono font-bold text-lg text-error">{{ topDrag?.ticker || '—' }}</div>
            <div class="text-error font-semibold">{{ formatSignedPct(topDrag?.contribution) }}</div>
          </div>
        </div>

        <!-- AI Explanation -->
        <div class="card bg-base-200/50 p-4 mb-6">
          <div class="flex items-center gap-3 flex-wrap mb-3">
            <button type="button" class="btn btn-primary btn-sm gap-2" @click="explainPortfolio" :disabled="explaining">
              <span v-if="explaining" class="loading loading-spinner loading-xs"></span>
              <span v-else>💡</span>
              {{ explaining ? 'Analyzing...' : 'Explain Performance' }}
            </button>
            <span class="text-xs text-base-content/50 italic">Claude analyzes news to explain the drivers of this group's performance.</span>
          </div>
          <div v-if="explanation" class="text-sm leading-relaxed p-3 bg-base-100 rounded-lg border border-base-300">
            {{ explanation }}
          </div>
        </div>

        <!-- Detail Table -->
        <div class="overflow-x-auto">
          <table class="table table-xs table-zebra w-full">
            <thead>
              <tr>
                <th class="cursor-pointer hover:bg-base-300" @click="toggleSort('ticker')">
                  Stock {{ getSortIcon('ticker') }}
                </th>
                <th class="cursor-pointer hover:bg-base-300" @click="toggleSort('sector')">
                  Sector {{ getSortIcon('sector') }}
                </th>
                <th class="cursor-pointer hover:bg-base-300 text-right" @click="toggleSort('weight')">
                  Weight {{ getSortIcon('weight') }}
                </th>
                <th class="cursor-pointer hover:bg-base-300 text-right" @click="toggleSort('stockReturn')">
                  Stock Return {{ getSortIcon('stockReturn') }}
                </th>
                <th class="cursor-pointer hover:bg-base-300 text-right" @click="toggleSort('contribution')">
                  Contribution {{ getSortIcon('contribution') }}
                </th>
                <th class="cursor-pointer hover:bg-base-300" @click="toggleSort('funds')">
                  Fund(s) {{ getSortIcon('funds') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in sortedAttributions" :key="a.ticker">
                <td>
                  <div class="font-mono font-bold leading-none">{{ a.ticker }}</div>
                  <div class="text-[10px] text-base-content/50">{{ a.companyName }}</div>
                </td>
                <td class="text-[10px] opacity-70">{{ a.sector }}</td>
                <td class="text-right font-mono">{{ a.weight.toFixed(1) }}%</td>
                <td class="text-right font-mono" :class="a.stockReturn >= 0 ? 'text-success' : 'text-error'">
                  {{ a.stockReturn >= 0 ? '+' : '' }}{{ a.stockReturn.toFixed(2) }}%
                </td>
                <td class="text-right font-mono font-bold" :class="a.contribution >= 0 ? 'text-success' : 'text-error'">
                  {{ a.contribution >= 0 ? '+' : '' }}{{ a.contribution.toFixed(2) }}%
                </td>
                <td class="text-xs">{{ a.funds.join(', ') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <div v-else class="py-20 text-center text-base-content/40">
        <div class="text-4xl mb-2">📊</div>
        <p>No trade data available for this period.</p>
      </div>

      <div class="modal-action">
        <button type="button" class="btn" @click="$emit('close')">Close</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="$emit('close')"><button>close</button></form>
  </dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { useMarketDataStore } from '../stores/marketData'
import { reconstructHoldingsAsOf, reconstructCashAsOf } from '../utils/leaderboardMetrics'

const props = defineProps({
  group: Object,
  isOpen: Boolean
})

const emit = defineEmits(['close'])

const market = useMarketDataStore()
const loading = ref(false)
const selectedRange = ref('All')
const ranges = ['1D', '1W', '1M', '3M', '1Y', 'All']

const attributions = ref([])
const totalReturn = ref(0)
const spyReturn = ref(0)
const explaining = ref(false)
const explanation = ref('')
const sortBy = ref('contribution')
const sortDesc = ref(true)

const topHelper = computed(() => attributions.value[0] || null)
const topDrag = computed(() => [...attributions.value].sort((a, b) => a.contribution - b.contribution)[0] || null)

const sortedAttributions = computed(() => {
  const sorted = [...attributions.value]
  sorted.sort((a, b) => {
    let aVal = a[sortBy.value]
    let bVal = b[sortBy.value]

    if (sortBy.value === 'funds') {
      aVal = a.funds.join(', ')
      bVal = b.funds.join(', ')
    }

    if (typeof aVal === 'string') {
      return sortDesc.value ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal)
    }
    return sortDesc.value ? bVal - aVal : aVal - bVal
  })
  return sorted
})

function toggleSort(col) {
  if (sortBy.value === col) {
    sortDesc.value = !sortDesc.value
  } else {
    sortBy.value = col
    sortDesc.value = true
  }
}

function getSortIcon(col) {
  if (sortBy.value !== col) return '⇅'
  return sortDesc.value ? '↓' : '↑'
}

function formatSignedPct(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`
}

function getPeriodStartDate(range) {
  const now = new Date()
  const map = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '1Y': 365, 'All': 3650 }
  return new Date(now.getTime() - (map[range] || 30) * 86400000)
}

function getFundStartDate(fund, requestedStartDate) {
  const fundCreatedAt = fund?.created_at ? new Date(fund.created_at) : null
  if (!fundCreatedAt || Number.isNaN(fundCreatedAt.getTime())) return requestedStartDate
  return fundCreatedAt > requestedStartDate ? fundCreatedAt : requestedStartDate
}

async function loadAttribution() {
  if (!props.group || !props.isOpen) return
  loading.value = true
  explanation.value = ''
  
  try {
    const requestedStartDate = getPeriodStartDate(selectedRange.value)
    const portfolioIds = (props.group.funds || []).map(f => f.id)

    if (portfolioIds.length === 0) {
      attributions.value = []
      loading.value = false
      return
    }

    // Fetch ALL trades for these portfolios to reconstruct past state
    const { data: trades } = await supabase
      .from('trades')
      .select('*')
      .in('portfolio_id', portfolioIds)
      .order('executed_at', { ascending: false })

    const tradesByPortfolio = {}
    portfolioIds.forEach(id => tradesByPortfolio[id] = (trades || []).filter(t => t.portfolio_id === id))

    const allTickers = new Set(['SPY'])
    
    // For each fund, reconstruct past holdings using the later of the selected period
    // start or the fund's own inception date.
    const fundAnalysis = props.group.funds.map(fund => {
      const fundStartDate = getFundStartDate(fund, requestedStartDate)
      const fundTrades = tradesByPortfolio[fund.id] || []
      const currentHoldings = fund.holdings || []
      const currentCash = fund.cash_balance || 0
      
      const pastHoldings = reconstructHoldingsAsOf(currentHoldings, fundTrades, fundStartDate)
      const pastCash = reconstructCashAsOf(currentCash, fundTrades, fundStartDate)
      
      // Tickers: held at start + held now + traded during period
      const tradesInPeriod = fundTrades.filter(t => new Date(t.executed_at) > fundStartDate)
      const periodTickers = new Set([
        ...pastHoldings.map(h => h.ticker),
        ...currentHoldings.map(h => h.ticker),
        ...tradesInPeriod.map(t => t.ticker)
      ])
      
      periodTickers.forEach(t => allTickers.add(t))
      
      return {
        fund,
        fundStartDate,
        fundStartDateStr: fundStartDate.toISOString().split('T')[0],
        pastHoldings,
        pastCash,
        currentHoldings,
        currentCash,
        tradesInPeriod
      }
    })

    const tickerList = Array.from(allTickers)
    const uniqueStartDates = [...new Set(fundAnalysis.map(a => a.fundStartDateStr))]
    const historicalPricesByDate = {}

    await Promise.all([
      market.fetchBatchQuotes(tickerList),
      market.fetchBatchProfiles(tickerList),
      ...uniqueStartDates.map(dateStr =>
        market.fetchHistoricalCloseForTickers(tickerList, dateStr).then(prices => {
          historicalPricesByDate[dateStr] = prices || {}
        })
      )
    ])
    const currentPrices = {}
    tickerList.forEach(t => currentPrices[t] = market.getCachedPrice(t) || 0)

    // Aggregate analysis across all funds
    const aggregateTickers = {} // ticker -> { weightedReturn, startValue }
    let totalStartValue = 0
    let totalCurrentValue = 0
    let aggregateSpyStartValue = 0
    let aggregateSpyCurrentValue = 0

    fundAnalysis.forEach(analysis => {
      const startPrices = historicalPricesByDate[analysis.fundStartDateStr] || {}
      // Use actual fund starting capital (ground truth from DB)
      const fundStartValue = Number(analysis.fund.startingCash || 100000)

      let fundCurrentValue = Number(analysis.currentCash || 0)
      analysis.currentHoldings.forEach(h => {
        fundCurrentValue += Number(h.shares || 0) * Number(currentPrices[h.ticker] || 0)
      })

      totalStartValue += fundStartValue
      totalCurrentValue += fundCurrentValue
      const spyStart = startPrices.SPY || 0
      const spyNow = currentPrices.SPY || 0
      if (spyStart > 0 && spyNow > 0) {
        aggregateSpyStartValue += fundStartValue
        aggregateSpyCurrentValue += fundStartValue * (spyNow / spyStart)
      }

      // Collect all tickers in this fund's period
      const tickers = new Set([
        ...analysis.pastHoldings.map(h => h.ticker),
        ...analysis.currentHoldings.map(h => h.ticker),
        ...analysis.tradesInPeriod.map(t => t.ticker)
      ])

      tickers.forEach(ticker => {
        const startShares = analysis.pastHoldings.find(h => h.ticker === ticker)?.shares || 0
        const endShares = analysis.currentHoldings.find(h => h.ticker === ticker)?.shares || 0
        const sp = startPrices[ticker] || 0
        const ep = currentPrices[ticker] || 0
        
        let stockReturn = 0
        let weightInFund = 0

        if (startShares > 0) {
          weightInFund = (startShares * sp) / fundStartValue
          stockReturn = sp > 0 ? ((ep / sp) - 1) * 100 : 0
        } else {
          // New position during period
          const costBasis = analysis.tradesInPeriod
            .filter(t => t.ticker === ticker && t.side === 'buy')
            .reduce((sum, t) => sum + Number(t.dollars), 0)
          
          if (costBasis > 0) {
            weightInFund = costBasis / fundStartValue
            stockReturn = (((endShares * ep) / costBasis) - 1) * 100
          }
        }

        if (!aggregateTickers[ticker]) {
          aggregateTickers[ticker] = { weightedReturn: 0, startValue: 0, funds: new Set() }
        }

        aggregateTickers[ticker].funds.add(analysis.fund.fundName || `Fund ${analysis.fund.fundNumber || 1}`)
        aggregateTickers[ticker].startValue += (weightInFund * fundStartValue)
        aggregateTickers[ticker].weightedReturn += (weightInFund * fundStartValue) * stockReturn
      })
    })

    spyReturn.value = aggregateSpyStartValue > 0
      ? ((aggregateSpyCurrentValue - aggregateSpyStartValue) / aggregateSpyStartValue) * 100
      : 0

    const finalAttributions = Object.entries(aggregateTickers).map(([ticker, data]) => {
      const weight = totalStartValue > 0 ? (data.startValue / totalStartValue) * 100 : 0
      const contribution = totalStartValue > 0 ? (data.weightedReturn / totalStartValue) : 0
      const stockReturn = data.startValue > 0 ? (data.weightedReturn / data.startValue) : 0

      const profile = market.profilesCache[ticker]?.data || {}

      return {
        ticker,
        weight,
        contribution,
        stockReturn,
        companyName: profile.companyName || profile.name || ticker,
        sector: profile.sector || 'N/A',
        funds: Array.from(data.funds || []).sort()
      }
    })
    .filter(a => Math.abs(a.contribution) > 0.001 || Math.abs(a.weight) > 0.01)
    .sort((a, b) => b.contribution - a.contribution)

    attributions.value = finalAttributions
    totalReturn.value = totalStartValue > 0
      ? ((totalCurrentValue - totalStartValue) / totalStartValue) * 100
      : 0

    if (finalAttributions.length > 0) {
      await explainPortfolio(finalAttributions)
    } else {
      explanation.value = 'No holdings with enough recent data to explain for this period.'
    }

  } catch (err) {
    console.error('Error loading group attribution:', err)
    explanation.value = 'Could not load attribution details for this group.'
  } finally {
    loading.value = false
  }
}

async function explainPortfolio(rows = attributions.value) {
  explaining.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      explanation.value = 'Please sign in again to generate the explanation.'
      return
    }

    const tickers = rows.slice(0, 10).map(a => a.ticker)
    if (tickers.length === 0) {
      explanation.value = 'No positions are available to explain for this period.'
      return
    }

    const changes = Object.fromEntries(rows.map(a => [a.ticker, a.stockReturn]))
    const best = rows[0]?.ticker || 'N/A'
    const worst = [...rows].sort((a, b) => a.contribution - b.contribution)[0]?.ticker || 'N/A'
    const summary = `Group portfolio return (${selectedRange.value}): ${totalReturn.value.toFixed(2)}%. Best: ${best}. Worst: ${worst}. vs SPY: ${(totalReturn.value - spyReturn.value).toFixed(2)}%.`
    
    const res = await fetch('/api/explain-attribution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ tickers, changes, portfolioSummary: summary, mode: 'portfolio' })
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      explanation.value = data.error || 'Explanation service is unavailable right now.'
      return
    }

    explanation.value = data.explanation || 'No explanation was returned for this portfolio.'
  } catch (err) {
    explanation.value = 'Could not load explanation. Please try again.'
  } finally {
    explaining.value = false
  }
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) loadAttribution()
})

watch(selectedRange, () => {
  loadAttribution()
})
</script>
