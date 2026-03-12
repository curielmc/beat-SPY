import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getAvailableCashForQueuedBuys,
  getImmediateExecutionPrice,
  getQueuedExecutionPrice
} from '../src/lib/tradePricing.js'

test('getImmediateExecutionPrice prefers the current market price', () => {
  assert.equal(getImmediateExecutionPrice({ price: 102.5, previousClose: 101.2 }), 102.5)
})

test('getImmediateExecutionPrice falls back to previous close', () => {
  assert.equal(getImmediateExecutionPrice({ price: null, previousClose: 101.2 }), 101.2)
})

test('getQueuedExecutionPrice uses the official session open only', () => {
  assert.equal(getQueuedExecutionPrice({ open: 99.75, price: 104.1 }), 99.75)
})

test('getQueuedExecutionPrice returns null when no open is available yet', () => {
  assert.equal(getQueuedExecutionPrice({ open: null, price: 104.1 }), null)
})

test('getAvailableCashForQueuedBuys subtracts queued and processing buy reservations', () => {
  assert.equal(getAvailableCashForQueuedBuys(1000, [
    { side: 'buy', status: 'queued', dollars: 250 },
    { side: 'buy', status: 'processing', dollars: 100 },
    { side: 'sell', status: 'queued', dollars: 500 },
    { side: 'buy', status: 'failed', dollars: 50 }
  ]), 650)
})
