export const config = { runtime: 'edge' }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, sbFetch, jsonResponse } from '../_lib/supabase.js'
import { sendChallengeNotification } from '../../src/notifications/dispatch.js'

const APP_BASE = process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || 'https://beat-snp.com'

// Lifecycle cron — runs daily near market open. Handles:
//   1. Snapshotting SPY universe at challenge start
//   2. Notification #2 — start_tomorrow (T-24h before start)
//   3. Notification #3 — started (when status flips to active)
//   4. Notification #4 — digest (daily/weekly per challenge.digest_frequency)
//   5. Notification #5 — end_tomorrow (T-24h before end)

export default async function handler(req) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }
  const now = new Date()
  const nowIso = now.toISOString()

  const snapshot = await snapshotUniversesForStartingChallenges(nowIso)
  const startReminders = await emitStartReminders(now)
  const started = await emitStartedNotifications(now)
  const endReminders = await emitEndReminders(now)
  const digests = await emitDigests(now)

  return jsonResponse({
    ok: true,
    snapshot,
    start_reminders: startReminders,
    started,
    end_reminders: endReminders,
    digests
  })
}

async function snapshotUniversesForStartingChallenges(nowIso) {
  const all = await sbFetch(
    `/competitions?status=in.(registration,active)&select=id,start_date,universe,status`
  )
  const due = (all || []).filter(c => c.universe?.mode === 'sp500_via_spy')
  if (!due.length) return { snapshotted: 0, failed: 0 }

  const latestRow = (await sbFetch(`/spy_constituents?select=as_of_date&order=as_of_date.desc&limit=1`))?.[0]
  if (!latestRow) return { snapshotted: 0, failed: 0, warning: 'no_spy_constituents_yet' }
  const snapshotDate = latestRow.as_of_date

  let snapshotted = 0
  let failed = 0
  for (const c of due) {
    if (c.universe?.snapshot_date) continue
    if (c.start_date && c.start_date > nowIso) continue
    const newU = { ...c.universe, snapshot_date: snapshotDate }
    const patchBody = c.status === 'registration'
      ? { universe: newU, status: 'active' }
      : { universe: newU }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/competitions?id=eq.${c.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(patchBody)
    })
    if (res.ok) snapshotted += 1
    else {
      failed += 1
      console.error(`[lifecycle] PATCH failed for competition ${c.id}: ${res.status} ${await res.text()}`)
    }
  }
  return { snapshotted, failed, snapshot_date: snapshotDate }
}

// Returns active entrants for a competition (status='active' so we don't spam removed).
async function loadActiveEntrants(competitionId) {
  return (await sbFetch(
    `/competition_entries?competition_id=eq.${competitionId}&status=eq.active&select=user_id`
  )) || []
}

// Build a deps object for sendChallengeNotification that returns the
// already-fetched competition without re-querying. Cuts ~half the queries
// in the per-entrant emit loop. (TODO: the deeper N+1 — loading each
// entrant's profile one at a time — is a bigger refactor; defer.)
function depsWithComp(comp) {
  return {
    loadCompetition: async () => comp || null
  }
}

// #2 — start_tomorrow. Window: 22h–26h until start.
async function emitStartReminders(now) {
  const comps = await sbFetch(
    `/competitions?status=in.(registration,active)&select=id,name,start_date,sms_enabled,digest_frequency`
  )
  let sent = 0
  for (const c of (comps || [])) {
    if (!c.start_date) continue
    const start = new Date(c.start_date)
    const hoursUntil = (start.getTime() - now.getTime()) / 3_600_000
    if (hoursUntil > 22 && hoursUntil <= 26) {
      const entrants = await loadActiveEntrants(c.id)
      const deps = depsWithComp(c)
      for (const e of entrants) {
        try {
          await sendChallengeNotification('start_tomorrow', c.id, e.user_id, {
            competitionName: c.name,
            startDate: c.start_date,
            competitionUrl: `${APP_BASE}/competitions/${c.id}`
          }, deps)
          sent += 1
        } catch (err) { console.error('[lifecycle] start_tomorrow failed', err) }
      }
    }
  }
  return { sent }
}

// #3 — started. Competitions whose status is active and start_date is within the
// last 24h. We use the competition's last_digest_sent_at? No — separate signal:
// the snapshot above flips status to active. We can detect "newly started" by
// comparing start_date against now (within last 24h).
async function emitStartedNotifications(now) {
  const comps = await sbFetch(
    `/competitions?status=eq.active&select=id,name,start_date,sms_enabled,digest_frequency`
  )
  let sent = 0
  for (const c of (comps || [])) {
    if (!c.start_date) continue
    const start = new Date(c.start_date)
    const hoursSince = (now.getTime() - start.getTime()) / 3_600_000
    if (hoursSince >= 0 && hoursSince <= 24) {
      const entrants = await loadActiveEntrants(c.id)
      const deps = depsWithComp(c)
      for (const e of entrants) {
        try {
          await sendChallengeNotification('started', c.id, e.user_id, {
            competitionName: c.name,
            competitionUrl: `${APP_BASE}/competitions/${c.id}`
          }, deps)
          sent += 1
        } catch (err) { console.error('[lifecycle] started failed', err) }
      }
    }
  }
  return { sent }
}

// #5 — end_tomorrow. Window: 22h–26h until end.
async function emitEndReminders(now) {
  const comps = await sbFetch(
    `/competitions?status=eq.active&select=id,name,end_date,sms_enabled,digest_frequency`
  )
  let sent = 0
  for (const c of (comps || [])) {
    if (!c.end_date) continue
    const end = new Date(c.end_date)
    const hoursUntil = (end.getTime() - now.getTime()) / 3_600_000
    if (hoursUntil > 22 && hoursUntil <= 26) {
      const entrants = await loadActiveEntrants(c.id)
      const deps = depsWithComp(c)
      for (const e of entrants) {
        try {
          await sendChallengeNotification('end_tomorrow', c.id, e.user_id, {
            competitionName: c.name,
            endDate: c.end_date,
            competitionUrl: `${APP_BASE}/competitions/${c.id}`
          }, deps)
          sent += 1
        } catch (err) { console.error('[lifecycle] end_tomorrow failed', err) }
      }
    }
  }
  return { sent }
}

// #4 — digest. Per challenge.digest_frequency (daily / weekly). Gated by
// last_digest_sent_at to avoid re-sending if cron runs more than once.
async function emitDigests(now) {
  const comps = await sbFetch(
    `/competitions?status=eq.active&digest_frequency=in.(daily,weekly)&select=id,name,end_date,digest_frequency,last_digest_sent_at`
  )
  let sent = 0
  let competitions = 0
  for (const c of (comps || [])) {
    const cadenceMs = c.digest_frequency === 'daily' ? 22 * 3_600_000 : 6.5 * 24 * 3_600_000
    const last = c.last_digest_sent_at ? new Date(c.last_digest_sent_at).getTime() : 0
    if (now.getTime() - last < cadenceMs) continue

    const entrants = await loadActiveEntrants(c.id)
    const daysRemaining = c.end_date
      ? Math.max(0, Math.ceil((new Date(c.end_date).getTime() - now.getTime()) / (24 * 3_600_000)))
      : null

    const deps = depsWithComp(c)
    for (const e of entrants) {
      try {
        await sendChallengeNotification('digest', c.id, e.user_id, {
          competitionName: c.name,
          daysRemaining,
          competitionUrl: `${APP_BASE}/competitions/${c.id}`
        }, deps)
        sent += 1
      } catch (err) { console.error('[lifecycle] digest failed', err) }
    }

    // Mark as sent.
    await fetch(`${SUPABASE_URL}/rest/v1/competitions?id=eq.${c.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ last_digest_sent_at: now.toISOString() })
    }).catch(e => console.error('[lifecycle] digest timestamp PATCH failed', e))
    competitions += 1
  }
  return { sent, competitions }
}
