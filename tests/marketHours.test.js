import test from 'node:test'
import assert from 'node:assert/strict'

import { isMarketOpen, isUSMarketHoliday } from '../src/utils/marketHours.js'

// Helper: create a Date in Eastern Time for a specific date and time
function easternDate(year, month, day, hour = 12, minute = 0) {
  // Build an ISO string targeting Eastern Time
  const dt = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`)
  // Adjust from Eastern to UTC (EST = UTC-5, EDT = UTC-4)
  // We use a round-trip through toLocaleString to get the correct offset
  const eastern = new Date(dt.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const utcMs = dt.getTime() + (dt.getTime() - eastern.getTime())
  return new Date(utcMs)
}

// --- isMarketOpen ---

test('market is open on a Tuesday at 10:00 AM ET', () => {
  // 2026-03-24 is a Tuesday
  assert.equal(isMarketOpen(easternDate(2026, 3, 24, 10, 0)), true)
})

test('market is open at exactly 9:30 AM ET', () => {
  assert.equal(isMarketOpen(easternDate(2026, 3, 24, 9, 30)), true)
})

test('market is closed at 9:29 AM ET', () => {
  assert.equal(isMarketOpen(easternDate(2026, 3, 24, 9, 29)), false)
})

test('market is closed at exactly 4:00 PM ET', () => {
  assert.equal(isMarketOpen(easternDate(2026, 3, 24, 16, 0)), false)
})

test('market is open at 3:59 PM ET', () => {
  assert.equal(isMarketOpen(easternDate(2026, 3, 24, 15, 59)), true)
})

test('market is closed on Saturday', () => {
  // 2026-03-28 is a Saturday
  assert.equal(isMarketOpen(easternDate(2026, 3, 28, 12, 0)), false)
})

test('market is closed on Sunday', () => {
  // 2026-03-29 is a Sunday
  assert.equal(isMarketOpen(easternDate(2026, 3, 29, 12, 0)), false)
})

// --- isUSMarketHoliday ---

test('New Year\'s Day is a holiday', () => {
  assert.equal(isUSMarketHoliday(new Date(2026, 0, 1)), true)
})

test('Christmas is a holiday', () => {
  assert.equal(isUSMarketHoliday(new Date(2026, 11, 25)), true)
})

test('Independence Day is a holiday', () => {
  // July 4, 2026 is a Saturday — observed on Friday July 3
  assert.equal(isUSMarketHoliday(new Date(2026, 6, 3)), true)
})

test('MLK Day 2026 (3rd Monday in January)', () => {
  // January 19, 2026 is 3rd Monday
  assert.equal(isUSMarketHoliday(new Date(2026, 0, 19)), true)
})

test('Good Friday 2026', () => {
  // Easter 2026 is April 5, so Good Friday is April 3
  assert.equal(isUSMarketHoliday(new Date(2026, 3, 3)), true)
})

test('a regular Tuesday is not a holiday', () => {
  assert.equal(isUSMarketHoliday(new Date(2026, 2, 24)), false)
})

test('market is closed on Christmas during market hours', () => {
  // 2025-12-25 is a Thursday (Christmas)
  assert.equal(isMarketOpen(easternDate(2025, 12, 25, 12, 0)), false)
})
