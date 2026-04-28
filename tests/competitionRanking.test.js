import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assignRanks } from '../src/lib/competitionRanking.js'

test('assignRanks gives ties equal rank, next rank skips', () => {
  const list = [
    { final_return_pct: 12 },
    { final_return_pct: 10 },
    { final_return_pct: 10 },
    { final_return_pct: 8 }
  ]
  assignRanks(list)
  assert.deepEqual(list.map(e => e.final_rank), [1, 2, 2, 4])
})

test('assignRanks handles all-tied list', () => {
  const list = [
    { final_return_pct: 5 },
    { final_return_pct: 5 },
    { final_return_pct: 5 }
  ]
  assignRanks(list)
  assert.deepEqual(list.map(e => e.final_rank), [1, 1, 1])
})

test('assignRanks handles strictly descending list', () => {
  const list = [
    { final_return_pct: 9 },
    { final_return_pct: 7 },
    { final_return_pct: 5 }
  ]
  assignRanks(list)
  assert.deepEqual(list.map(e => e.final_rank), [1, 2, 3])
})
