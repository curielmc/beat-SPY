import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sendChallengeNotification } from '../src/notifications/dispatch.js'

function makeDeps({ profile, competition }) {
  const calls = { email: [], sms: [], inApp: [] }
  const deps = {
    loadProfile: async () => profile,
    loadCompetition: async () => competition,
    insertInApp: async (row) => { calls.inApp.push(row); return { ok: true } },
    sendEmail: async (args) => { calls.email.push(args); return { ok: true } },
    sendSms: async (to, body) => { calls.sms.push({ to, body }); return { ok: true } },
    fetch: async () => ({ ok: true, json: async () => [] })
  }
  return { deps, calls }
}

const baseProfile = {
  id: 'u1',
  email: 'student@example.com',
  full_name: 'Sam Student',
  phone_e164: '+15551234567',
  sms_opt_in: false,
  parent_language: 'en'
}

test('registered: email + in-app, no SMS even with phone', async () => {
  const { deps, calls } = makeDeps({
    profile: { ...baseProfile, sms_opt_in: true },
    competition: { id: 'c1', name: 'Test Cup', sms_enabled: true }
  })
  await sendChallengeNotification('registered', 'c1', 'u1', {
    competitionName: 'Test Cup',
    startDate: '2026-05-01'
  }, deps)
  assert.equal(calls.email.length, 1)
  assert.equal(calls.inApp.length, 1)
  assert.equal(calls.sms.length, 0, 'registered template has no SMS channel')
})

test('start_tomorrow: SMS gated by user opt-in', async () => {
  // opt-out → no SMS
  {
    const { deps, calls } = makeDeps({
      profile: { ...baseProfile, sms_opt_in: false },
      competition: { id: 'c1', name: 'Test Cup', sms_enabled: true }
    })
    await sendChallengeNotification('start_tomorrow', 'c1', 'u1', {
      competitionName: 'Test Cup'
    }, deps)
    assert.equal(calls.sms.length, 0)
    assert.equal(calls.email.length, 1)
  }
  // opt-in → SMS
  {
    const { deps, calls } = makeDeps({
      profile: { ...baseProfile, sms_opt_in: true },
      competition: { id: 'c1', name: 'Test Cup', sms_enabled: true }
    })
    await sendChallengeNotification('start_tomorrow', 'c1', 'u1', {
      competitionName: 'Test Cup'
    }, deps)
    assert.equal(calls.sms.length, 1)
  }
})

test('SMS gated by competition.sms_enabled=false', async () => {
  const { deps, calls } = makeDeps({
    profile: { ...baseProfile, sms_opt_in: true },
    competition: { id: 'c1', name: 'Test Cup', sms_enabled: false }
  })
  await sendChallengeNotification('start_tomorrow', 'c1', 'u1', {
    competitionName: 'Test Cup'
  }, deps)
  assert.equal(calls.sms.length, 0)
})

test('critical types (won_payout, removed) bypass opt-out', async () => {
  // won_payout: no opt-in, sms_enabled=false — should still send.
  {
    const { deps, calls } = makeDeps({
      profile: { ...baseProfile, sms_opt_in: false },
      competition: { id: 'c1', name: 'Test Cup', sms_enabled: false }
    })
    await sendChallengeNotification('won_payout', 'c1', 'u1', {
      competitionName: 'Test Cup',
      amount: 100,
      claimBy: '2026-06-01',
      claimUrl: 'https://x/y'
    }, deps)
    assert.equal(calls.sms.length, 1, 'won_payout is critical')
    assert.equal(calls.email.length, 1)
  }
  // removed: critical
  {
    const { deps, calls } = makeDeps({
      profile: { ...baseProfile, sms_opt_in: false },
      competition: { id: 'c1', name: 'Test Cup', sms_enabled: false }
    })
    await sendChallengeNotification('removed', 'c1', 'u1', {
      competitionName: 'Test Cup',
      reason: 'roster cleanup'
    }, deps)
    assert.equal(calls.sms.length, 1, 'removed is critical')
    assert.equal(calls.email.length, 1)
  }
})

test('no phone → no SMS regardless of critical', async () => {
  const { deps, calls } = makeDeps({
    profile: { ...baseProfile, phone_e164: null },
    competition: { id: 'c1', name: 'Test Cup', sms_enabled: true }
  })
  await sendChallengeNotification('won_payout', 'c1', 'u1', {
    competitionName: 'Test Cup', amount: 50, claimBy: '2026-06-01', claimUrl: 'https://x/y'
  }, deps)
  assert.equal(calls.sms.length, 0)
})

test('unknown type throws', async () => {
  const { deps } = makeDeps({ profile: baseProfile, competition: null })
  await assert.rejects(
    () => sendChallengeNotification('not_a_type', 'c1', 'u1', {}, deps),
    /Unknown notification type/
  )
})

test('language fallback uses profile.parent_language', async () => {
  const { deps, calls } = makeDeps({
    profile: { ...baseProfile, parent_language: 'es' },
    competition: { id: 'c1', name: 'Copa', sms_enabled: true }
  })
  await sendChallengeNotification('registered', 'c1', 'u1', {
    competitionName: 'Copa', startDate: '2026-05-01'
  }, deps)
  assert.match(calls.email[0].subject, /Registrado/)
})
