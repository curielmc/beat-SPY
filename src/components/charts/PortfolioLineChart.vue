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

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Title, Tooltip, Legend, Filler)

const props = defineProps({
  datasets: Array,
  timeRange: { type: String, default: '3M' },
  showPercentage: { type: Boolean, default: false },
  height: { type: String, default: '220px' }
})

const COLORS = {
  primary: '#570df8',
  secondary: '#f000b8',
  accent: '#37cdbe',
  info: '#3abff8',
  success: '#36d399',
  warning: '#fbbd23',
  error: '#f87272',
  sp500: '#a0a0a0',
  neutral1: '#6366f1',
  neutral2: '#f59e0b',
  neutral3: '#10b981',
  neutral4: '#ef4444',
}

function getCutoffDate(range) {
  const now = new Date('2026-02-27')
  switch (range) {
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

const chartData = computed(() => ({
  datasets: filteredDatasets.value.map(ds => {
    const colorKey = ds.color || 'primary'
    const color = COLORS[colorKey] || colorKey
    let data
    if (props.showPercentage) {
      const baseline = ds.data.length > 0 ? ds.data[0].value : 100000
      data = ds.data.map(d => ({ x: d.date, y: ((d.value - baseline) / baseline) * 100 }))
    } else {
      data = ds.data.map(d => ({ x: d.date, y: d.value }))
    }
    return {
      label: ds.label,
      data,
      borderColor: color,
      backgroundColor: color + '18',
      borderWidth: ds.color === 'sp500' ? 1.5 : 2,
      pointRadius: 0,
      pointHitRadius: 8,
      tension: 0.1,
      borderDash: ds.color === 'sp500' ? [5, 3] : [],
      fill: false
    }
  })
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      position: 'bottom',
      labels: { boxWidth: 12, padding: 6, font: { size: 10 } }
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
            return `${ctx.dataset.label}: ${val >= 0 ? '+' : ''}${val.toFixed(2)}%`
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
      ticks: { maxTicksLimit: 6, font: { size: 10 } },
      grid: { display: false }
    },
    y: {
      ticks: {
        font: { size: 10 },
        callback: (v) => {
          if (props.showPercentage) return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
          return v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
        }
      },
      grid: { color: 'rgba(128,128,128,0.1)' }
    }
  }
}))
</script>
