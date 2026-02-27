<template>
  <div class="space-y-4">
    <!-- Back button -->
    <button class="btn btn-ghost btn-sm gap-1" @click="goBack">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
      Back to Stocks
    </button>

    <div v-if="!stock" class="text-center py-12 text-base-content/50">Stock not found.</div>

    <template v-if="stock">
      <!-- Header -->
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold">{{ stock.ticker }}</h1>
          <p class="text-base-content/60">{{ stock.name }}</p>
          <div class="flex gap-1 mt-1">
            <span class="badge badge-sm badge-ghost">{{ stock.sector }}</span>
            <span class="badge badge-sm badge-outline">{{ stock.country }}</span>
            <span class="badge badge-sm" :class="stock.assetType === 'Stock' ? 'badge-primary' : stock.assetType === 'Bond' ? 'badge-info' : 'badge-secondary'">{{ stock.assetType }}</span>
          </div>
        </div>
        <div class="text-right">
          <p class="text-3xl font-bold">${{ stock.price.toFixed(2) }}</p>
          <p class="text-lg" :class="stock.dayChange >= 0 ? 'text-success' : 'text-error'">
            {{ stock.dayChange >= 0 ? '+' : '' }}{{ dayChangeDollar.toFixed(2) }} ({{ stock.dayChange >= 0 ? '+' : '' }}{{ stock.dayChange.toFixed(2) }}%)
          </p>
        </div>
      </div>

      <!-- Trade Panel (students only) -->
      <div v-if="!auth.isTeacher" class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <!-- Tabs -->
          <div class="tabs tabs-boxed mb-3">
            <button class="tab" :class="{ 'tab-active': tradeMode === 'buy' }" @click="tradeMode = 'buy'">Buy</button>
            <button class="tab" :class="{ 'tab-active': tradeMode === 'sell' }" @click="tradeMode = 'sell'">Sell</button>
          </div>

          <!-- Current Position -->
          <div v-if="currentHolding" class="flex justify-between text-sm mb-2 bg-base-200 rounded-lg p-2">
            <span class="text-base-content/60">Your position</span>
            <span class="font-medium">{{ currentHolding.shares.toFixed(4) }} shares (${{ (currentHolding.shares * stock.price).toLocaleString('en-US', { maximumFractionDigits: 2 }) }})</span>
          </div>
          <div class="flex justify-between text-sm mb-3 bg-base-200 rounded-lg p-2">
            <span class="text-base-content/60">Cash available</span>
            <span class="font-medium">${{ cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
          </div>

          <!-- Dollar Input -->
          <div class="form-control mb-2">
            <label class="label py-1"><span class="label-text text-sm">Amount ($)</span></label>
            <input
              v-model.number="tradeAmount"
              type="number"
              min="0"
              :max="tradeMode === 'buy' ? cashBalance : maxSellDollars"
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
              <span class="font-mono">${{ stock.price.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-sm font-medium border-t border-base-300 pt-1">
              <span>Total</span>
              <span class="font-mono">${{ tradeAmount.toFixed(2) }}</span>
            </div>
          </div>

          <!-- Trade Result -->
          <div v-if="tradeResult" class="alert mb-3" :class="tradeResult.success ? 'alert-success' : 'alert-error'">
            <span>{{ tradeResult.message }}</span>
          </div>

          <!-- Execute Button -->
          <button
            class="btn btn-block"
            :class="tradeMode === 'buy' ? 'btn-success' : 'btn-error'"
            :disabled="!canTrade"
            @click="executeTrade"
          >
            {{ tradeMode === 'buy' ? 'Buy' : 'Sell' }} {{ stock.ticker }}
          </button>
        </div>
      </div>

      <!-- Price Chart -->
      <div class="card bg-base-100 shadow">
        <div class="card-body p-3">
          <div class="flex items-center justify-between mb-1">
            <h3 class="font-semibold text-sm">Price History</h3>
            <TimeRangeSelector v-model="timeRange" />
          </div>
          <PortfolioLineChart :datasets="chartDatasets" :time-range="timeRange" height="250px" />
        </div>
      </div>

      <!-- Key Statistics -->
      <div class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <h3 class="font-semibold mb-3">Key Statistics</h3>
          <div class="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
            <div class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">Previous Close</span>
              <span class="text-sm font-medium">${{ stock.previousClose.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">Open</span>
              <span class="text-sm font-medium">${{ stock.openPrice.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">Market Cap</span>
              <span class="text-sm font-medium">{{ stock.marketCap }}</span>
            </div>
            <div class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">P/E Ratio</span>
              <span class="text-sm font-medium">{{ stock.peRatio > 0 ? stock.peRatio.toFixed(1) : 'N/A' }}</span>
            </div>
            <div class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">EPS</span>
              <span class="text-sm font-medium">{{ stock.eps !== 0 ? '$' + stock.eps.toFixed(2) : 'N/A' }}</span>
            </div>
            <div class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">Dividend Yield</span>
              <span class="text-sm font-medium">{{ stock.dividend > 0 ? stock.dividend.toFixed(2) + '%' : 'None' }}</span>
            </div>
            <div class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">Beta</span>
              <span class="text-sm font-medium">{{ stock.beta.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">Volume</span>
              <span class="text-sm font-medium">{{ stock.volume }}</span>
            </div>
            <div class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">Avg Volume</span>
              <span class="text-sm font-medium">{{ stock.avgVolume }}</span>
            </div>
            <div class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">52-Week High</span>
              <span class="text-sm font-medium">${{ stock.high52w.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">52-Week Low</span>
              <span class="text-sm font-medium">${{ stock.low52w.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between border-b border-base-200 pb-1">
              <span class="text-sm text-base-content/60">52-Week Range</span>
              <span class="text-sm font-medium">${{ stock.low52w.toFixed(2) }} - ${{ stock.high52w.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 52-Week Range Bar -->
      <div class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <h3 class="font-semibold mb-2">52-Week Range</h3>
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono">${{ stock.low52w.toFixed(0) }}</span>
            <div class="flex-1 relative h-2 bg-base-300 rounded-full">
              <div class="absolute h-2 bg-primary rounded-full" :style="{ width: rangePosition + '%' }"></div>
              <div class="absolute w-3 h-3 bg-primary rounded-full -top-0.5 border-2 border-base-100" :style="{ left: rangePosition + '%', transform: 'translateX(-50%)' }"></div>
            </div>
            <span class="text-xs font-mono">${{ stock.high52w.toFixed(0) }}</span>
          </div>
        </div>
      </div>

      <!-- About -->
      <div class="card bg-base-100 shadow">
        <div class="card-body p-4">
          <h3 class="font-semibold mb-2">About {{ stock.name }}</h3>
          <p class="text-sm text-base-content/70 leading-relaxed">{{ stock.description }}</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import stocksData from '../../mock/stocks.json'
import { useHistoricalDataStore } from '../../stores/historicalData'
import { usePortfolioStore } from '../../stores/portfolio'
import { useAuthStore } from '../../stores/auth'
import PortfolioLineChart from '../../components/charts/PortfolioLineChart.vue'
import TimeRangeSelector from '../../components/charts/TimeRangeSelector.vue'

const route = useRoute()
const router = useRouter()
const histStore = useHistoricalDataStore()
const portfolioStore = usePortfolioStore()
const auth = useAuthStore()
const timeRange = ref('1Y')
const tradeMode = ref('buy')
const tradeAmount = ref(0)
const tradeResult = ref(null)

const stock = computed(() =>
  stocksData.find(s => s.ticker === route.params.ticker?.toUpperCase()) || null
)

const dayChangeDollar = computed(() => {
  if (!stock.value) return 0
  return stock.value.price - stock.value.previousClose
})

const rangePosition = computed(() => {
  if (!stock.value) return 50
  const range = stock.value.high52w - stock.value.low52w
  if (range === 0) return 50
  return ((stock.value.price - stock.value.low52w) / range) * 100
})

const chartDatasets = computed(() => {
  if (!stock.value) return []
  const history = histStore.getStockHistory(stock.value.ticker, stock.value.price)
  return [{ label: stock.value.ticker, data: history, color: 'primary' }]
})

const currentHolding = computed(() => {
  if (!stock.value) return null
  return portfolioStore.getHolding(stock.value.ticker)
})

const cashBalance = computed(() => portfolioStore.portfolio?.cashBalance || 0)

const maxSellDollars = computed(() => {
  if (!currentHolding.value || !stock.value) return 0
  return currentHolding.value.shares * stock.value.price
})

const previewShares = computed(() => {
  if (!stock.value || !tradeAmount.value) return 0
  return tradeAmount.value / stock.value.price
})

const canTrade = computed(() => {
  if (!tradeAmount.value || tradeAmount.value <= 0 || !stock.value) return false
  if (tradeMode.value === 'buy') return tradeAmount.value <= cashBalance.value
  return tradeAmount.value <= maxSellDollars.value + 0.01
})

function setQuickAmount(pct) {
  if (tradeMode.value === 'buy') {
    tradeAmount.value = Math.floor(cashBalance.value * (pct / 100) * 100) / 100
  } else {
    tradeAmount.value = Math.floor(maxSellDollars.value * (pct / 100) * 100) / 100
  }
}

function executeTrade() {
  tradeResult.value = null
  if (!stock.value) return

  let result
  if (tradeMode.value === 'buy') {
    result = portfolioStore.buyStock(stock.value.ticker, tradeAmount.value)
  } else {
    result = portfolioStore.sellStock(stock.value.ticker, tradeAmount.value)
  }

  if (result.success) {
    const action = tradeMode.value === 'buy' ? 'Bought' : 'Sold'
    tradeResult.value = {
      success: true,
      message: `${action} ${result.shares.toFixed(4)} shares of ${stock.value.ticker} at $${result.price.toFixed(2)}`
    }
    tradeAmount.value = 0
    setTimeout(() => { tradeResult.value = null }, 5000)
  } else {
    tradeResult.value = { success: false, message: result.error }
  }
}

function goBack() {
  router.back()
}
</script>
