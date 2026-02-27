<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">Stocks</h1>

    <!-- Search -->
    <input v-model="stocks.searchQuery" type="text" placeholder="Search by ticker or name..." class="input input-bordered w-full" />

    <!-- Sector Filter -->
    <div class="flex gap-2 overflow-x-auto pb-1">
      <button class="badge badge-lg cursor-pointer" :class="!stocks.selectedSector ? 'badge-primary' : 'badge-outline'" @click="stocks.selectedSector = null">All</button>
      <button v-for="sector in stocks.sectors" :key="sector" class="badge badge-lg cursor-pointer whitespace-nowrap" :class="stocks.selectedSector === sector ? 'badge-primary' : 'badge-outline'" @click="stocks.selectedSector = stocks.selectedSector === sector ? null : sector">
        {{ sector }}
      </button>
    </div>

    <!-- Stock List -->
    <div class="space-y-2">
      <RouterLink v-for="stock in stocks.filteredStocks" :key="stock.ticker" :to="`/stocks/${stock.ticker}`" class="card bg-base-100 shadow hover:shadow-md transition-shadow cursor-pointer block">
        <div class="card-body p-4 flex-row justify-between items-center">
          <div>
            <p class="font-bold">{{ stock.ticker }}</p>
            <p class="text-xs text-base-content/60">{{ stock.name }}</p>
            <span class="badge badge-ghost badge-xs mt-1">{{ stock.sector }}</span>
          </div>
          <div class="text-right">
            <p class="font-semibold">${{ stock.price.toFixed(2) }}</p>
            <p class="text-sm" :class="stock.dayChange >= 0 ? 'text-success' : 'text-error'">
              {{ stock.dayChange >= 0 ? '+' : '' }}{{ stock.dayChange.toFixed(2) }}%
            </p>
          </div>
        </div>
      </RouterLink>
    </div>

    <p v-if="stocks.filteredStocks.length === 0" class="text-center text-base-content/50 py-8">No stocks match your search.</p>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
import { useStocksStore } from '../../stores/stocks'
const stocks = useStocksStore()
</script>
