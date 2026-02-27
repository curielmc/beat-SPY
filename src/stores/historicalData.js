import { defineStore } from 'pinia'
import { generateGroupHistory, generateSP500History, generateStockHistory } from '../mock/historicalData'

export const useHistoricalDataStore = defineStore('historicalData', () => {
  const sp500History = generateSP500History()

  const groupHistories = {
    g1: generateGroupHistory('g1'),
    g2: generateGroupHistory('g2'),
    g3: generateGroupHistory('g3'),
    g4: generateGroupHistory('g4'),
    g5: generateGroupHistory('g5'),
  }

  const stockHistories = {}

  function getGroupHistory(groupId) {
    return groupHistories[groupId] || []
  }

  function getStockHistory(ticker, currentPrice) {
    if (!stockHistories[ticker]) {
      stockHistories[ticker] = generateStockHistory(ticker, currentPrice)
    }
    return stockHistories[ticker]
  }

  return { sp500History, getGroupHistory, getStockHistory }
})
