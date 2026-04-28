export const config = { runtime: 'edge' }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, sbFetch, jsonResponse } from '../_lib/supabase.js'

// Lifecycle cron — runs daily near market open. Currently only handles the
// "snapshot SPY universe at challenge start" step. Will grow to handle
// reminders, finalization, consent renewals, account purges in later plans.

export default async function handler(req) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }
  const now = new Date().toISOString()
  const result = await snapshotUniversesForStartingChallenges(now)
  return jsonResponse({ ok: true, ...result })
}

async function snapshotUniversesForStartingChallenges(nowIso) {
  // Find competitions in registration/active status with sp500_via_spy universe.
  // We snapshot once start_date has passed and no snapshot_date is set.
  const due = await sbFetch(
    `/competitions?status=in.(registration,active)&select=id,start_date,universe,status&universe->>mode=eq.sp500_via_spy`
  )
  if (!due?.length) return { snapshotted: 0 }

  const latestRow = (await sbFetch(`/spy_constituents?select=as_of_date&order=as_of_date.desc&limit=1`))?.[0]
  if (!latestRow) return { snapshotted: 0, warning: 'no_spy_constituents_yet' }
  const snapshotDate = latestRow.as_of_date

  let snapshotted = 0
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
  }
  return { snapshotted, snapshot_date: snapshotDate }
}
