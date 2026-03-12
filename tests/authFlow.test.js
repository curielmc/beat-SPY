import test from 'node:test'
import assert from 'node:assert/strict'

import { getRouteForRole, validateCredentials } from '../src/lib/authFlow.js'

test('getRouteForRole sends admins to admin area', () => {
  assert.equal(getRouteForRole('admin'), '/admin')
})

test('getRouteForRole sends teachers to teacher area', () => {
  assert.equal(getRouteForRole('teacher'), '/teacher')
})

test('getRouteForRole defaults students and unknown roles to leaderboard', () => {
  assert.equal(getRouteForRole('student'), '/leaderboard')
  assert.equal(getRouteForRole(null), '/leaderboard')
})

test('validateCredentials rejects malformed login email', () => {
  assert.equal(validateCredentials('bad-email', 'secret123', { allowShortPassword: true }), 'Enter a valid email')
})

test('validateCredentials requires password for login', () => {
  assert.equal(validateCredentials('student@example.com', '', { allowShortPassword: true }), 'Enter your password')
})

test('validateCredentials enforces password length for signup', () => {
  assert.equal(validateCredentials('student@example.com', '12345'), 'Password must be at least 6 characters')
})

test('validateCredentials allows short-password bypass for login validation only', () => {
  assert.equal(validateCredentials('student@example.com', '12345', { allowShortPassword: true }), '')
})
