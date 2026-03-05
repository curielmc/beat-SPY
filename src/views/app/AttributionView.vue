<template>
  <div class="space-y-5 pb-10">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Performance Attribution</h1>
        <p class="text-base-content/60 text-sm mt-1">What helped, what hurt, and why</p>
      </div>
      <div class="text-right">
        <div class="text-xs text-base-content/50">Portfolio return</div>
        <div class="text-2xl font-bold" :class="totalReturn >= 0 ? 'text-success' : 'text-error'">
          {{ totalReturn >= 0 ? '+' : '' }}{{ totalReturn.toFixed(2) }}%
        </div>
        <div class="text-xs text-base-content/50">vs SPY {{ spyReturn >= 0 ? '+' : '' }}{{ spyReturn.toFixed(2) }}%</div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 5" :key="i" class="card bg-base-100 shadow p-4">
        <div class="skeleton h-12 w-full rounded"></div>
      </div>
    </div>

    <template v-else-if="attributions.length">
      <!-- Summary cards -->
      <div class="grid grid-cols-3 gap-3">
        <div class="card bg-success/10 border border-success/20 p-4 text-center">
          <div class="text-xs text-base-content/60 mb-1">Biggest Help</div>
          <div class="font-mono font-bold text-lg text-success">{{ topHelper?.ticker }}</div>
          <div class="text-success font-semibold">{{ topHelper?.contribution >= 0 ? '+' : '' }}{{ topHelper?.contribution.toFixed(2) }}%</div>
          <div class="text-xs text-base-content/50">added to return</div>
        </div>
        <div class="card bg-base-100 border border-base-300 p-4 text-center">
          <div class="text-xs text-base-content/60 mb-1">Beat SPY by</div>
          <div class="text-2xl font-bold" :class="alpha >= 0 ? 'text-success' : 'text-error'">
            {{ alpha >= 0 ? '+' : '' }}{{ alpha.toFixed(2) }}%
          </div>
          <div class="text-xs text-base-content/50">selection effect</div>
        </div>
        <div class="card bg-error/10 border border-error/20 p-4 text-center">
          <div class="text-xs text-base-content/60 mb-1">Biggest Drag</div>
          <div class="font-mono font-bold text-lg text-error">{{ topDrag?.ticker }}</div>
          <div class="text-error font-semibold">{{ topDrag?.contribution >= 0 ? '+' : '' }}{{ topDrag?.contribution.toFixed(2) }}%</div>
          <div class="text-xs text-base-content/50">from return</div>
        </div>
      </div>

      <!-- AI Explain button -->
      <div class="card bg-base-100 shadow p-4">
        <div class="flex items-center gap-3 flex-wrap">
          <button class="btn btn-primary btn-sm gap-2" @click="explainPortfolio" :disabled="explaining">
            <span v-if="explaining && !explainTicker" class="loading loading-spinner loading-xs"></span>
            <span v-else>💡</span>
            {{ explaining && !explainTicker ? 'Reading news...' : 'Explain my portfolio today' }}
          </button>
          <span class="text-xs text-base-content/40">Claude reads recent news and explains what moved your stocks</span>
        </div>
        <div v-if="explanation && !explainTicker" class="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm leading-relaxed">
          {{ explanation }}
        </div>
      </div>

      <!-- Waterfall chart -->
      <div class="card bg-base-100 shadow p-5">
        <h2 class="font-semibold mb-4">Contribution to Return (Today)</h2>
        <div class="space-y-3">
          <div v-for="a in attributions" :key="a.ticker">
            <div class="flex items-center gap-3">
              <!-- Ticker + name -->
              <div class="w-28 shrink-0">
                <div class="font-mono font-bold text-sm">{{ a.ticker }}</div>
                <div class="text-xs text-base-content/50 truncate">{{ a.companyName }}</div>
              </div>
              <!-- Bar -->
              <div class="flex-1 relative h-8 flex items-center">
                <div class="absolute left-1/2 w-px h-full bg-base-300"></div>
                <div
                  class="h-6 rounded transition-all duration-500 flex items-center"
                  :class="a.contribution >= 0 ? 'bg-success ml-auto' : 'bg-error'"
                  :style="barStyle(a.contribution)"
                >
                  <span class="text-xs font-bold text-white px-1 whitespace-nowrap"
                    :class="a.contribution >= 0 ? 'text-right' : 'text-left'">
                    {{ a.contribution >= 0 ? '+' : '' }}{{ a.contribution.toFixed(2) }}%
                  </span>
                </div>
              </div>
              <!-- Stock return + weight -->
              <div class="w-24 shrink-0 text-right">
                <div class="text-sm font-semibold" :class="a.stockReturn >= 0 ? 'text-success' : 'text-error'">
                  {{ a.stockReturn >= 0 ? '+' : '' }}{{ a.stockReturn.toFixed(2) }}%
                </div>
                <div class="text-xs text-base-content/40">{{ a.weight.toFixed(1) }}% wt</div>
              </div>
            </div>
          </div>

          <!-- Cash row if any -->
          <div v-if="cashPct > 0" class="flex items-center gap-3 opacity-50">
            <div class="w-28 shrink-0">
              <div class="font-mono font-bold text-sm">CASH</div>
              <div class="text-xs text-base-content/50">No return</div>
            </div>
            <div class="flex-1 relative h-8 flex items-center">
              <div class="absolute left-1/2 w-px h-full bg-base-300"></div>
              <div class="h-6 rounded bg-base-300 flex items-center px-2" style="width:2px; min-width:40px;">
                <span class="text-xs">0.00%</span>
              </div>
            </div>
            <div class="w-24 shrink-0 text-right">
              <div class="text-sm">0.00%</div>
              <div class="text-xs text-base-content/40">{{ cashPct.toFixed(1) }}% wt</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stock-by-stock detail cards -->
      <div class="card bg-base-100 shadow p-5">
        <h2 class="font-semibold mb-4">Stock Detail</h2>
        <div class="overflow-x-auto">
          <table class="table table-sm w-full">
            <thead>
              <tr class="text-base-content/50 text-xs">
                <th>Stock</th>
                <th class="text-right">Weight</th>
                <th class="text-right">Today's Return</th>
                <th class="text-right">Contribution</th>
                <th class="text-right">vs SPY</th>
                <th class="text-right">Gain/Loss $</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in attributions" :key="a.ticker" class="hover">
                <td>
                  <RouterLink :to="`/stocks/${a.ticker}`" class="link link-hover">
                    <span class="font-mono font-bold">{{ a.ticker }}</span>
                    <span v-if="a.companyName" class="block text-xs text-base-content/50">{{ a.companyName }}</span>
                  </RouterLink>
                  <button class="btn btn-ghost btn-xs text-base-content/40 hover:text-primary mt-0.5" @click="explainStock(a)" :disabled="explaining">
                    <span v-if="explaining && explainTicker === a.ticker" class="loading loading-spinner loading-xs"></span>
                    <span v-else>💡</span> why?
                  </button>
                  <div v-if="explanation && explainTicker === a.ticker" class="mt-1 p-2 bg-primary/5 border border-primary/20 rounded text-xs leading-relaxed max-w-xs">{{ explanation }}</div>
                </td>
                <td class="text-right font-mono">{{ a.weight.toFixed(1) }}%</td>
                <td class="text-right font-mono" :class="a.stockReturn >= 0 ? 'text-success' : 'text-error'">
                  {{ a.stockReturn >= 0 ? '+' : '' }}{{ a.stockReturn.toFixed(2) }}%
                </td>
                <td class="text-right font-mono font-bold" :class="a.contribution >= 0 ? 'text-success' : 'text-error'">
                  {{ a.contribution >= 0 ? '+' : '' }}{{ a.contribution.toFixed(2) }}%
                </td>
                <td class="text-right font-mono" :class="a.vsSpy >= 0 ? 'text-success' : 'text-error'">
                  {{ a.vsSpy >= 0 ? '+' : '' }}{{ a.vsSpy.toFixed(2) }}%
                </td>
                <td class="text-right font-mono" :class="a.dollarGain >= 0 ? 'text-success' : 'text-error'">
                  {{ a.dollarGain >= 0 ? '+' : '' }}${{ Math.abs(a.dollarGain).toLocaleString('en-US', {maximumFractionDigits: 0}) }}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="font-bold border-t border-base-300">
                <td>Portfolio Total</td>
                <td class="text-right font-mono">100%</td>
                <td class="text-right"></td>
                <td class="text-right font-mono" :class="totalReturn >= 0 ? 'text-success' : 'text-error'">
                  {{ totalReturn >= 0 ? '+' : '' }}{{ totalReturn.toFixed(2) }}%
                </td>
                <td class="text-right font-mono" :class="alpha >= 0 ? 'text-success' : 'text-error'">
                  {{ alpha >= 0 ? '+' : '' }}{{ alpha.toFixed(2) }}%
                </td>
                <td class="text-right font-mono" :class="totalDollarGain >= 0 ? 'text-success' : 'text-error'">
                  {{ totalDollarGain >= 0 ? '+' : '' }}${{ Math.abs(totalDollarGain).toLocaleString('en-US', {maximumFractionDigits: 0}) }}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Counterfactuals -->
      <div class="card bg-base-100 shadow p-5">
        <h2 class="font-semibold mb-3">🤔 What If?</h2>
        <div class="space-y-2">
          <div v-for="a in counterfactuals" :key="a.ticker" class="flex items-center justify-between py-2 border-b border-base-200 last:border-0">
            <div class="text-sm">
              <span class="text-base-content/60">Without </span>
              <span class="font-mono font-bold">{{ a.ticker }}</span>
              <span class="text-base-content/60">, your return would be </span>
              <span class="font-bold" :class="a.returnWithout >= 0 ? 'text-success' : 'text-error'">
                {{ a.returnWithout >= 0 ? '+' : '' }}{{ a.returnWithout.toFixed(2) }}%
              </span>
            </div>
            <div class="badge" :class="a.contribution < 0 ? 'badge-error' : 'badge-success'">
              {{ a.contribution < 0 ? '🔴 drag' : '🟢 boost' }}
            </div>
          </div>
        </div>
      </div>

      <!-- How attribution works -->
      <div class="card bg-base-200/50 p-4">
        <p class="text-xs text-base-content/50">
          <strong>How this works:</strong> Contribution = ($ in stock ÷ portfolio total) × stock's return today.
          A stock with 30% weight that's up 2% contributes +0.6% to your total return.
          "vs SPY" shows how much each stock beat or missed the S&P 500's return today.
        </p>
      </div>
    </template>

    <!-- No holdings -->
    <div v-else class="text-center py-20 text-base-content/50">
      <div class="text-5xl mb-4">📊</div>
      <p>No holdings yet — make some trades to see attribution analysis.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePortfolioStore } from '../../stores/portfolio'
import { useMarketDataStore } from '../../stores/marketData'
import { supabase } from '../../lib/supabase'

const portfolioStore = usePortfolioStore()
const market = useMarketDataStore()
const loading = ref(true)
const prevPrices = ref({})
const spyPrevClose = ref(0)

const MAX_BAR = 50
const explaining = ref(false)
const explanation = ref('')
const explainTicker = ref('')

async function explainPortfolio() {
  explaining.value = true
  explainTicker.value = ''
  explanation.value = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) throw new Error('Login required')
    const tickers = attributions.value.map(a => a.ticker)
    const changes = Object.fromEntries(attributions.value.map(a => [a.ticker, a.stockReturn]))
    const summary = `Portfolio return: ${totalReturn.value.toFixed(2)}%. Best: ${topHelper.value?.ticker}. Worst: ${topDrag.value?.ticker}. vs SPY: ${alpha.value.toFixed(2)}%.`
    const res = await fetch('/api/explain-attribution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ tickers, changes, portfolioSummary: summary, mode: 'portfolio' })
    })
    const data = await res.json()
    explanation.value = data.explanation
  } catch(e) { explanation.value = 'Could not load explanation. Try again.' }
  finally { explaining.value = false }
}

async function explainStock(a) {
  explaining.value = true
  explainTicker.value = a.ticker
  explanation.value = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) throw new Error('Login required')
    const res = await fetch('/api/explain-attribution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ tickers: [a.ticker], changes: { [a.ticker]: a.stockReturn }, mode: 'stock' })
    })
    const data = await res.json()
    explanation.value = data.explanation
  } catch(e) { explanation.value = 'Could not load explanation. Try again.' }
  finally { explaining.value = false }
}

onMounted(async () => {
  // Ensure holdings are loaded from the store's current active portfolio
  const tickers = portfolioStore.holdings.map(h => h.ticker)
  if (!tickers.length) { loading.value = false; return }

  // Fetch current quotes + prev close for each ticker + SPY
  const all = [...new Set([...tickers, 'SPY'])]
  try {
    const FMP_KEY = import.meta.env.VITE_FMP_API_KEY
    const res = await fetch(`https://financialmodelingprep.com/api/v3/quote/${all.join(',')}?apikey=${FMP_KEY}`)
    const quotes = await res.json()
    quotes.forEach(q => {
      prevPrices.value[q.symbol] = q.previousClose || q.price
      if (q.symbol === 'SPY') spyPrevClose.value = q.previousClose || q.price
    })
    // Keep quote cache warm for current prices + SPY
    await market.fetchBatchQuotes(all)
    await market.fetchBatchProfiles(tickers)
  } catch (e) {
    console.warn('Attribution fetch error', e)
  }
  loading.value = false
})

const spyReturn = computed(() => {
  const cur = market.getCachedPrice('SPY') || 0
  const prev = prevPrices.value['SPY'] || cur
  return prev ? (cur / prev - 1) * 100 : 0
})

const portfolioTotal = computed(() => {
  const stockVal = portfolioStore.holdings.reduce((s, h) => s + h.marketValue, 0)
  return stockVal + (portfolioStore.portfolio?.cash_balance || 0)
})

const cashPct = computed(() => {
  const cash = portfolioStore.portfolio?.cash_balance || 0
  return portfolioTotal.value > 0 ? (cash / portfolioTotal.value) * 100 : 0
})

const attributions = computed(() => {
  if (!portfolioTotal.value) return []
  return portfolioStore.holdings.map(h => {
    const currentPrice = h.currentPrice || h.avg_cost
    const prevClose = prevPrices.value[h.ticker] || currentPrice
    const stockReturn = prevClose ? (currentPrice / prevClose - 1) * 100 : 0
    const weight = (h.marketValue / portfolioTotal.value) * 100
    const contribution = (weight / 100) * stockReturn
    const vsSpy = stockReturn - spyReturn.value
    const prevValue = h.shares * prevClose
    const dollarGain = h.marketValue - prevValue
    const profile = market.profilesCache?.[h.ticker]?.data
    return {
      ticker: h.ticker,
      companyName: profile?.companyName || profile?.name || '',
      weight,
      stockReturn,
      contribution,
      vsSpy,
      dollarGain,
      marketValue: h.marketValue,
    }
  }).sort((a, b) => b.contribution - a.contribution)
})

const totalReturn = computed(() => attributions.value.reduce((s, a) => s + a.contribution, 0))
const totalDollarGain = computed(() => attributions.value.reduce((s, a) => s + a.dollarGain, 0))
const alpha = computed(() => totalReturn.value - spyReturn.value)
const topHelper = computed(() => attributions.value[0] || null)
const topDrag = computed(() => [...attributions.value].sort((a, b) => a.contribution - b.contribution)[0] || null)

const counterfactuals = computed(() => {
  return attributions.value.map(a => ({
    ticker: a.ticker,
    contribution: a.contribution,
    returnWithout: totalReturn.value - a.contribution
  })).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 5)
})

const maxContrib = computed(() => Math.max(...attributions.value.map(a => Math.abs(a.contribution)), 0.1))

function barStyle(contribution) {
  const pct = (Math.abs(contribution) / maxContrib.value) * MAX_BAR
  if (contribution >= 0) {
    return { width: `${pct}%`, maxWidth: '50%', marginLeft: 'auto' }
  } else {
    return { width: `${pct}%`, maxWidth: '50%', marginRight: 'auto' }
  }
}
</script>
