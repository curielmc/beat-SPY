import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import stocksData from '../mock/stocks.json'

export const useStocksStore = defineStore('stocks', () => {
  const allStocks = ref(stocksData)
  const searchQuery = ref('')
  const selectedSector = ref(null)

  const sectors = computed(() => [...new Set(allStocks.value.map(s => s.sector))])

  const filteredStocks = computed(() => {
    let result = allStocks.value
    if (selectedSector.value) {
      result = result.filter(s => s.sector === selectedSector.value)
    }
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(s =>
        s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
      )
    }
    return result
  })

  function clearFilters() {
    searchQuery.value = ''
    selectedSector.value = null
  }

  return { allStocks, searchQuery, selectedSector, sectors, filteredStocks, clearFilters }
})
