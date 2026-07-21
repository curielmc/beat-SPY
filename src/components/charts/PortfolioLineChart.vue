<template>
  <div :style="{ height: height, position: 'relative' }">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { themeColors, chartPalette, withAlpha } from '../../lib/chartTheme'

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Title, Tooltip, Legend, Filler)

const props = defineProps({
  datasets: Array,
  timeRange: { type: String, default: '3M' },
  showPercentage: { type: Boolean, default: false },
  height: { type: String, default: '220px' }
})

// Map named series keys to live theme colors; extra/neutral series fall back to the
// ordered palette so charts track the brand theme instead of hard-coded hex.
function seriesColors() {
  const c = themeColors()
  const pal = chartPalette()
  return {
    primary: c.primary,
    secondary: c.secondary,
    accent: c.accent,
    info: c.info,
    success: c.success,
    warning: c.warning,
    error: c.error,
    sp500: c.sp500,
    neutral1: pal[7],
    neutral2: c.warning,
    neutral3: c.success,
    neutral4: c.error,
  }
}

function getCutoffDate(range) {
  const now = new Date()
  switch (range) {
    case '1D': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    case '1W': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
    case '3W': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 21)
    case '1M': return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    case '3M': return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
    case '1Y': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    case '5Y': return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate())
    default: return new Date('2021-01-04')
  }
}

const filteredDatasets = computed(() => {
  const cutoff = getCutoffDate(props.timeRange)
  return (props.datasets || []).map(ds => {
    const filtered = ds.data.filter(d => d.date >= cutoff)
    return { ...ds, data: filtered }
  })
})

const chartData = computed(() => {
  const COLORS = seriesColors()
  return {
  datasets: filteredDatasets.value.map(ds => {
    const colorKey = ds.color || 'primary'
    const color = COLORS[colorKey] || colorKey
    let data
    if (props.showPercentage) {
      const baseline = Number(ds.baseline ?? ds.data?.[0]?.value ?? 100000)
      data = ds.data.map(d => ({ x: d.date, y: ((d.value - baseline) / baseline) * 100 }))
    } else {
      data = ds.data.map(d => ({ x: d.date, y: d.value }))
    }
    return {
      label: ds.label,
      data,
      borderColor: color,
      backgroundColor: withAlpha(color, 0.09),
      borderWidth: ds.color === 'sp500' ? 1.5 : 2,
      pointRadius: 0,
      pointHitRadius: 8,
      tension: 0.1,
      borderDash: ds.color === 'sp500' ? [5, 3] : [],
      fill: false
    }
  })
  }
})

const chartOptions = computed(() => {
  const c = themeColors()
  const reduceMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return {
  responsive: true,
  maintainAspectRatio: false,
  animation: reduceMotion ? false : { duration: 300 },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      position: 'bottom',
      labels: { boxWidth: 12, padding: 6, font: { size: 10 }, color: c.baseContent }
    },
    tooltip: {
      callbacks: {
        title: (items) => {
          if (!items.length) return ''
          const d = new Date(items[0].parsed.x)
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        },
        label: (ctx) => {
          const val = ctx.parsed.y
          if (props.showPercentage) {
            return `${ctx.dataset.label}: ${val >= 0 ? '+' : ''}${val.toFixed(1)}%`
          }
          return `${ctx.dataset.label}: $${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
        }
      }
    }
  },
  scales: {
    x: {
      type: 'time',
      time: { tooltipFormat: 'MMM d, yyyy' },
      ticks: { maxTicksLimit: 6, font: { size: 10 }, color: c.baseContent },
      grid: { display: false }
    },
    y: {
      ticks: {
        font: { size: 10 }, color: c.baseContent,
        callback: (v) => {
          if (props.showPercentage) return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
          return v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
        }
      },
      grid: { color: withAlpha(c.base300, 0.4) }
    }
  }
  }
})
</script>
