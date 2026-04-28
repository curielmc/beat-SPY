import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveCharityDestination } from '../src/lib/charityResolver.js'

test('prefers entry.charity_choice when present', () => {
  const r = resolveCharityDestination(
    { charity_choice: { name: 'A', ein: '1' } },
    { default_charity: { name: 'B' } },
    { name: 'C' }
  )
  assert.equal(r.name, 'A')
})

test('falls back to competition default_charity', () => {
  const r = resolveCharityDestination(
    { charity_choice: null },
    { default_charity: { name: 'B' } },
    { name: 'C' }
  )
  assert.equal(r.name, 'B')
})

test('falls back to system default', () => {
  const r = resolveCharityDestination({}, {}, { name: 'C' })
  assert.equal(r.name, 'C')
})

test('returns null when nothing resolved', () => {
  assert.equal(resolveCharityDestination({}, {}, null), null)
  assert.equal(resolveCharityDestination({ charity_choice: {} }, { default_charity: {} }, {}), null)
})

test('ignores empty objects in chain', () => {
  const r = resolveCharityDestination(
    { charity_choice: {} },
    { default_charity: { name: 'B' } },
    null
  )
  assert.equal(r.name, 'B')
})
