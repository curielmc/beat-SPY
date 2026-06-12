<template>
  <div class="card bg-base-100 shadow h-full">
    <div class="card-body p-3">
      <h3 class="font-semibold text-sm text-center">{{ title }}</h3>
      <div :style="{ height: height, position: 'relative' }">
        <Doughnut :data="chartData" :options="chartOptions" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { themeColors, chartPalette, withAlpha } from '../../lib/chartTheme'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps({
  segments: Array,
  title: String,
  height: { type: String, default: '180px' }
})

const chartData = computed(() => {
  const PALETTE = chartPalette()
  return {
  labels: (props.segments || []).map(s => s.label),
  datasets: [{
    data: (props.segments || []).map(s => s.value),
    backgroundColor: (props.segments || []).map((s, i) => s.color || PALETTE[i % PALETTE.length]),
    borderWidth: 1,
    borderColor: withAlpha(themeColors().base300, 0.6)
  }]
  }
})

const chartOptions = computed(() => {
  const c = themeColors()
  return {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '55%',
  plugins: {
    legend: {
      position: 'right',
      align: 'center',
      labels: {
        boxWidth: 12,
        boxHeight: 12,
        padding: 8,
        font: { size: 11 },
        color: c.baseContent,
        generateLabels: (chart) => {
          const data = chart.data
          const total = data.datasets[0].data.reduce((a, b) => a + b, 0)
          return data.labels.map((label, i) => {
            const val = data.datasets[0].data[i]
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0
            return {
              text: `${label} ${pct}%`,
              fillStyle: data.datasets[0].backgroundColor[i],
              fontColor: c.baseContent,
              strokeStyle: 'transparent',
              hidden: false,
              index: i
            }
          })
        }
      }
    },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0)
          const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0
          return `${ctx.label}: $${ctx.parsed.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${pct}%)`
        }
      }
    }
  }
  }
})
</script>
