<template>
  <div class="space-y-2">
    <!-- Price display (updates on hover) -->
    <div class="px-1">
      <p class="text-3xl font-bold tabular-nums">${{ displayPrice }}</p>
      <p class="text-sm font-medium" :class="displayChange >= 0 ? 'text-success' : 'text-error'">
        {{ displayChange >= 0 ? '+' : '' }}{{ displayChange.toFixed(2) }}
        ({{ displayChangePct >= 0 ? '+' : '' }}{{ displayChangePct.toFixed(2) }}%)
        <span class="text-base-content/40 font-normal ml-1">{{ hoverDate || periodLabel }}</span>
      </p>
    </div>

    <!-- Chart container -->
    <div ref="chartEl" class="w-full rounded-xl overflow-hidden" style="height: 220px;"></div>

    <!-- Period selector -->
    <div class="flex gap-1 px-1">
      <button
        v-for="p in periods"
        :key="p.key"
        class="btn btn-xs flex-1 font-semibold"
        :class="activePeriod === p.key ? 'btn-primary' : 'btn-ghost'"
        @click="setPeriod(p.key)"
      >{{ p.label }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { createChart, LineSeries, AreaSeries } from 'lightweight-charts'

const props = defineProps({
  ticker: { type: String, required: true },
  currentPrice: { type: Number, default: 0 },
  change: { type: Number, default: 0 },
  changePct: { type: Number, default: 0 },
  isPositive: { type: Boolean, default: true }
})

const FMP_KEY = import.meta.env.VITE_FMP_API_KEY

const chartEl = ref(null)
let chart = null
let areaSeries = null

const activePeriod = ref('1D')
const hoverDate = ref('')
const hoverPrice = ref(null)

const displayPrice = computed(() => hoverPrice.value !== null ? hoverPrice.value.toFixed(2) : props.currentPrice.toFixed(2))
const displayChange = computed(() => {
  if (hoverPrice.value !== null && periodOpen.value !== null) return hoverPrice.value - periodOpen.value
  return props.change
})
const displayChangePct = computed(() => {
  if (hoverPrice.value !== null && periodOpen.value !== null && periodOpen.value !== 0)
    return ((hoverPrice.value - periodOpen.value) / periodOpen.value) * 100
  return props.changePct
})

const periodOpen = ref(null)

const periods = [
  { key: '1D', label: '1D' },
  { key: '1W', label: '1W' },
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '1Y', label: '1Y' },
  { key: '5Y', label: '5Y' },
]

const periodLabel = computed(() => {
  const p = periods.find(p => p.key === activePeriod.value)
  return p?.label || ''
})

function getColor() {
  return displayChange.value >= 0 ? '#22c55e' : '#ef4444'
}

async function fetchData(period) {
  const now = new Date()
  let url = ''

  if (period === '1D') {
    url = `https://financialmodelingprep.com/api/v3/historical-chart/5min/${props.ticker}?apikey=${FMP_KEY}`
  } else {
    const days = { '1W': 7, '1M': 30, '3M': 90, '1Y': 365, '5Y': 1825 }
    const from = new Date(now - days[period] * 86400000).toISOString().split('T')[0]
    url = `https://financialmodelingprep.com/api/v3/historical-price-full/${props.ticker}?from=${from}&apikey=${FMP_KEY}`
  }

  const res = await fetch(url)
  const data = await res.json()

  if (period === '1D') {
    const today = now.toISOString().split('T')[0]
    const raw = (data || []).filter(d => d.date?.startsWith(today)).reverse()
    return raw.map(d => ({ time: Math.floor(new Date(d.date.replace(' ', 'T')).getTime() / 1000), value: d.close }))
  } else {
    const raw = (data?.historical || []).reverse()
    return raw.map(d => ({ time: d.date, value: d.close }))
  }
}

async function setPeriod(period) {
  activePeriod.value = period
  hoverPrice.value = null
  hoverDate.value = ''
  await loadChart()
}

async function loadChart() {
  const points = await fetchData(activePeriod.value)
  if (!points.length) return

  periodOpen.value = points[0].value

  const color = displayChange.value >= 0 ? '#22c55e' : '#ef4444'
  const fillColor = displayChange.value >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'

  if (areaSeries) {
    areaSeries.setData(points)
    areaSeries.applyOptions({ lineColor: color, topColor: fillColor, bottomColor: 'rgba(0,0,0,0)' })
  }

  chart?.timeScale().fitContent()
}

function initChart() {
  if (!chartEl.value) return

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    window.matchMedia('(prefers-color-scheme: dark)').matches

  chart = createChart(chartEl.value, {
    width: chartEl.value.clientWidth,
    height: 220,
    layout: {
      background: { color: 'transparent' },
      textColor: isDark ? '#9ca3af' : '#6b7280',
      fontSize: 11,
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
    },
    rightPriceScale: {
      borderVisible: false,
      scaleMargins: { top: 0.1, bottom: 0.1 },
    },
    timeScale: {
      borderVisible: false,
      fixLeftEdge: true,
      fixRightEdge: true,
    },
    crosshair: {
      vertLine: { color: '#9ca3af', width: 1, style: 3, labelVisible: true },
      horzLine: { color: '#9ca3af', width: 1, style: 3, labelVisible: true },
    },
    handleScroll: false,
    handleScale: false,
  })

  areaSeries = chart.addSeries(AreaSeries, {
    lineColor: '#22c55e',
    topColor: 'rgba(34,197,94,0.15)',
    bottomColor: 'rgba(0,0,0,0)',
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 5,
  })

  chart.subscribeCrosshairMove((param) => {
    if (!param.time || !param.seriesData) {
      hoverPrice.value = null
      hoverDate.value = ''
      return
    }
    const val = param.seriesData.get(areaSeries)
    if (val) {
      hoverPrice.value = val.value
      const d = typeof param.time === 'number'
        ? new Date(param.time * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : new Date(param.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      hoverDate.value = d
    }
  })

  const ro = new ResizeObserver(() => {
    chart?.applyOptions({ width: chartEl.value?.clientWidth || 400 })
  })
  ro.observe(chartEl.value)
}

onMounted(async () => {
  await nextTick()
  initChart()
  await loadChart()
})

onUnmounted(() => {
  chart?.remove()
})

watch(() => props.ticker, async () => {
  hoverPrice.value = null
  hoverDate.value = ''
  await loadChart()
})
</script>
