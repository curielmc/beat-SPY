import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolvePrizeBuckets } from '../src/lib/prizeAllocation.js'

const ranking = [
  { user_id: 'u1', final_rank: 1, final_return_pct: 12, beat_benchmark: true },
  { user_id: 'u2', final_rank: 2, final_return_pct: 9,  beat_benchmark: true },
  { user_id: 'u3', final_rank: 3, final_return_pct: 7,  beat_benchmark: true },
  { user_id: 'u4', final_rank: 4, final_return_pct: 5,  beat_benchmark: true },
  { user_id: 'u5', final_rank: 5, final_return_pct: 2,  beat_benchmark: false }
]

test('winner takes all', () => {
  const out = resolvePrizeBuckets(
    [{ eligibility: 'place', place_range: [1,1], allocation: { type: 'percent_of_pool', value: 100 }, split: 'winner_take_all' }],
    ranking, 1000)
  assert.deepEqual(out.payouts, [{ user_id: 'u1', amount: 1000 }])
  assert.equal(out.unfilled.length, 0)
})

test('top-3 weighted 50/30/20', () => {
  const out = resolvePrizeBuckets(
    [{ eligibility: 'top_n', n: 3, allocation: { type: 'percent_of_pool', value: 100 }, split: 'weighted_by_rank', weights: [50,30,20] }],
    ranking, 1000)
  assert.deepEqual(out.payouts.map(p => p.amount), [500, 300, 200])
})

test('all who beat SPY equal split', () => {
  const out = resolvePrizeBuckets(
    [{ eligibility: 'all_who_beat_benchmark', allocation: { type: 'percent_of_pool', value: 100 }, split: 'equal_split' }],
    ranking, 1000)
  assert.equal(out.payouts.length, 4)
  out.payouts.forEach(p => assert.equal(p.amount, 250))
})

test('hybrid 25/25/50', () => {
  const out = resolvePrizeBuckets([
    { eligibility: 'place', place_range: [1,1], allocation: { type: 'percent_of_pool', value: 25 }, split: 'winner_take_all' },
    { eligibility: 'place', place_range: [2,3], allocation: { type: 'percent_of_pool', value: 25 }, split: 'equal_split' },
    { eligibility: 'all_who_beat_benchmark', exclude_ranks: [1,2,3], allocation: { type: 'percent_of_pool', value: 50 }, split: 'equal_split' }
  ], ranking, 1000)
  const m = Object.fromEntries(out.payouts.map(p => [p.user_id, p.amount]))
  assert.equal(m.u1, 250)
  assert.equal(m.u2, 125)
  assert.equal(m.u3, 125)
  assert.equal(m.u4, 500)
})

test('unfilled bucket reported', () => {
  const noOneBeat = ranking.map(r => ({ ...r, beat_benchmark: false }))
  const out = resolvePrizeBuckets(
    [{ eligibility: 'all_who_beat_benchmark', allocation: { type: 'percent_of_pool', value: 100 }, split: 'equal_split' }],
    noOneBeat, 1000)
  assert.equal(out.payouts.length, 0)
  assert.equal(out.unfilled.length, 1)
  assert.equal(out.unfilled[0].unallocated, 1000)
})
