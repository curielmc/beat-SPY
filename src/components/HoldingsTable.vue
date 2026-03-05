<template>
  <div class="overflow-x-auto">
    <table class="table table-sm table-zebra">
      <thead>
        <tr class="text-base-content/60">
          <th class="text-left">Ticker</th>
          <th class="text-left">Name</th>
          <th class="text-right">Shares</th>
          <th class="text-right">Avg Cost</th>
          <th class="text-right">Price</th>
          <th class="text-right">Market Value</th>
          <th class="text-right">Gain/Loss</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="h in enrichedHoldings" :key="h.id">
          <td class="font-mono font-bold">{{ h.ticker }}</td>
          <td class="text-sm text-base-content/80">{{ h.companyName }}</td>
          <td class="text-right font-mono">{{ Number(h.shares).toFixed(2) }}</td>
          <td class="text-right font-mono">${{ Number(h.avg_cost).toFixed(2) }}</td>
          <td class="text-right font-mono">${{ Number(h.currentPrice).toFixed(2) }}</td>
          <td class="text-right font-mono">${{ Number(h.marketValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
          <td class="text-right font-mono" :class="h.gainLoss >= 0 ? 'text-success' : 'text-error'">
            {{ h.gainLoss >= 0 ? '+' : '' }}{{ h.gainLossPct.toFixed(2) }}%
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMarketDataStore } from '../stores/marketData'

const props = defineProps({
  holdings: {
    type: Array,
    default: () => []
  }
})

const market = useMarketDataStore()

const enrichedHoldings = computed(() => {
  return props.holdings.map(h => {
    const currentPrice = market.getCachedPrice(h.ticker) || Number(h.avg_cost)
    const marketValue = Number(h.shares) * currentPrice
    const costBasis = Number(h.shares) * Number(h.avg_cost)
    const gainLoss = marketValue - costBasis
    const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0
    
    // Get company name from cache
    const profile = market.profilesCache?.[h.ticker]?.data
    const companyName = profile?.companyName || profile?.name || '-'
    
    return {
      ...h,
      currentPrice,
      marketValue,
      costBasis,
      gainLoss,
      gainLossPct,
      companyName
    }
  })
})
</script>
