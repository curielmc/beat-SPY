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

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps({
  segments: Array,
  title: String,
  height: { type: String, default: '180px' }
})

const PALETTE = [
  '#570df8', '#f000b8', '#37cdbe', '#3abff8', '#36d399',
  '#fbbd23', '#f87272', '#6366f1', '#f59e0b', '#10b981',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
]

const chartData = computed(() => ({
  labels: (props.segments || []).map(s => s.label),
  datasets: [{
    data: (props.segments || []).map(s => s.value),
    backgroundColor: (props.segments || []).map((s, i) => s.color || PALETTE[i % PALETTE.length]),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)'
  }]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '55%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        boxWidth: 10,
        padding: 4,
        font: { size: 9 },
        generateLabels: (chart) => {
          const data = chart.data
          const total = data.datasets[0].data.reduce((a, b) => a + b, 0)
          return data.labels.map((label, i) => {
            const val = data.datasets[0].data[i]
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0
            return {
              text: `${label} ${pct}%`,
              fillStyle: data.datasets[0].backgroundColor[i],
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
</script>
