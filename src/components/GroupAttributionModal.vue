<template>
  <dialog class="modal" :class="{ 'modal-open': isOpen }">
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
            <div class="font-mono font-bold text-lg text-success">{{ topHelper?.ticker }}</div>
            <div class="text-success font-semibold">{{ topHelper?.contribution >= 0 ? '+' : '' }}{{ topHelper?.contribution.toFixed(2) }}%</div>
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
            <div class="font-mono font-bold text-lg text-error">{{ topDrag?.ticker }}</div>
            <div class="text-error font-semibold">{{ topDrag?.contribution >= 0 ? '+' : '' }}{{ topDrag?.contribution.toFixed(2) }}%</div>
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

        <!-- Waterfall chart -->
        <div class="space-y-4 mb-8">
          <h4 class="font-bold text-sm uppercase tracking-wider text-base-content/40">Contribution to Return</h4>
          <div class="space-y-2">
            <div v-for="a in attributions.slice(0, 10)" :key="a.ticker" class="flex items-center gap-3">
              <div class="w-24 shrink-0">
                <div class="font-mono font-bold text-sm leading-none">{{ a.ticker }}</div>
                <div class="text-[10px] text-base-content/50 truncate max-w-full mt-0.5">{{ a.companyName }}</div>
              </div>
              <div class="flex-1 relative h-6 flex items-center bg-base-200/30 rounded overflow-hidden">
                <div class="absolute left-1/2 w-px h-full bg-base-300 z-10"></div>
                <div
                  class="h-full transition-all duration-700"
                  :class="a.contribution >= 0 ? 'bg-success ml-auto' : 'bg-error'"
                  :style="barStyle(a.contribution)"
                ></div>
              </div>
              <div class="w-16 shrink-0 text-right font-mono text-sm" :class="a.contribution >= 0 ? 'text-success' : 'text-error'">
                {{ a.contribution >= 0 ? '+' : '' }}{{ a.contribution.toFixed(2) }}%
              </div>
            </div>
            <div v-if="attributions.length > 10" class="text-center text-xs text-base-content/40 pt-1">
              + {{ attributions.length - 10 }} more positions
            </div>
          </div>
        </div>

        <!-- Detail Table -->
        <div class="overflow-x-auto">
          <table class="table table-xs table-zebra w-full">
            <thead>
              <tr>
                <th>Stock</th>
                <th>Sector</th>
                <th class="text-right">Weight</th>
                <th class="text-right">Stock Return</th>
                <th class="text-right">Contribution</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in attributions" :key="a.ticker">
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
const selectedRange = ref('1M')
const ranges = ['1W', '1M', '3M', '1Y', 'All']

const attributions = ref([])
const totalReturn = ref(0)
const spyReturn = ref(0)
const explaining = ref(false)
const explanation = ref('')

const topHelper = computed(() => attributions.value[0] || null)
const topDrag = computed(() => [...attributions.value].sort((a, b) => a.contribution - b.contribution)[0] || null)

const maxContrib = computed(() => Math.max(...attributions.value.map(a => Math.abs(a.contribution)), 0.1))

function barStyle(contribution) {
  const pct = (Math.abs(contribution) / maxContrib.value) * 50
  if (contribution >= 0) {
    return { width: `${pct}%`, marginLeft: '50%' }
  } else {
    return { width: `${pct}%`, marginRight: '50%', marginLeft: 'auto' }
  }
}

function getPeriodStartDate(range) {
  const now = new Date()
  const map = { '1W': 7, '1M': 30, '3M': 90, '1Y': 365, 'All': 3650 }
  return new Date(now.getTime() - (map[range] || 30) * 86400000)
}

async function loadAttribution() {
  if (!props.group || !props.isOpen) return
  loading.value = true
  explanation.value = ''
  
  try {
    const asOfDate = getPeriodStartDate(selectedRange.value)
    const asOfDateStr = asOfDate.toISOString().split('T')[0]
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
    
    // For each fund, reconstruct past holdings and collect all tickers involved
    const fundAnalysis = props.group.funds.map(fund => {
      const fundTrades = tradesByPortfolio[fund.id] || []
      const currentHoldings = fund.holdings || []
      const currentCash = fund.cash_balance || 0
      
      const pastHoldings = reconstructHoldingsAsOf(currentHoldings, fundTrades, asOfDate)
      const pastCash = reconstructCashAsOf(currentCash, fundTrades, asOfDate)
      
      // Tickers: held at start + held now + traded during period
      const tradesInPeriod = fundTrades.filter(t => new Date(t.executed_at) > asOfDate)
      const periodTickers = new Set([
        ...pastHoldings.map(h => h.ticker),
        ...currentHoldings.map(h => h.ticker),
        ...tradesInPeriod.map(t => t.ticker)
      ])
      
      periodTickers.forEach(t => allTickers.add(t))
      
      return { fund, pastHoldings, pastCash, currentHoldings, currentCash, tradesInPeriod }
    })

    const tickerList = Array.from(allTickers)
    const [historicalPrices] = await Promise.all([
      market.fetchHistoricalCloseForTickers(tickerList, asOfDateStr),
      market.fetchBatchQuotes(tickerList),
      market.fetchBatchProfiles(tickerList)
    ])

    const startPrices = historicalPrices
    const currentPrices = {}
    tickerList.forEach(t => currentPrices[t] = market.getCachedPrice(t) || 0)

    spyReturn.value = startPrices['SPY'] > 0 
      ? ((currentPrices['SPY'] / startPrices['SPY']) - 1) * 100 
      : 0

    // Aggregate analysis across all funds
    const aggregateTickers = {} // ticker -> { weightContrib, dollarGain, stockReturn }
    let totalStartValue = 0

    fundAnalysis.forEach(analysis => {
      let fundStartValue = analysis.pastCash
      analysis.pastHoldings.forEach(h => {
        fundStartValue += h.shares * (startPrices[h.ticker] || 0)
      })
      
      // If fund didn't exist at start, use its current starting_cash or 100k
      if (fundStartValue <= 0) {
        fundStartValue = analysis.fund.starting_cash || analysis.fund.fund_starting_cash || 100000
      }
      
      totalStartValue += fundStartValue

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
          aggregateTickers[ticker] = { weightedReturn: 0, startValue: 0 }
        }
        
        aggregateTickers[ticker].startValue += (weightInFund * fundStartValue)
        aggregateTickers[ticker].weightedReturn += (weightInFund * fundStartValue) * stockReturn
      })
    })

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
        sector: profile.sector || 'N/A'
      }
    })
    .filter(a => Math.abs(a.contribution) > 0.001 || Math.abs(a.weight) > 0.01)
    .sort((a, b) => b.contribution - a.contribution)

    attributions.value = finalAttributions
    totalReturn.value = finalAttributions.reduce((sum, a) => sum + a.contribution, 0)

  } catch (err) {
    console.error('Error loading group attribution:', err)
  } finally {
    loading.value = false
  }
}

async function explainPortfolio() {
  explaining.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    
    const tickers = attributions.value.slice(0, 10).map(a => a.ticker)
    const changes = Object.fromEntries(attributions.value.map(a => [a.ticker, a.stockReturn]))
    const summary = `Group portfolio return (${selectedRange.value}): ${totalReturn.value.toFixed(2)}%. Best: ${topHelper.value?.ticker}. Worst: ${topDrag.value?.ticker}. vs SPY: ${(totalReturn.value - spyReturn.value).toFixed(2)}%.`
    
    const res = await fetch('/api/explain-attribution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ tickers, changes, portfolioSummary: summary, mode: 'portfolio' })
    })
    const data = await res.json()
    explanation.value = data.explanation
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
