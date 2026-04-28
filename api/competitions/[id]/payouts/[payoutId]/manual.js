export const config = { runtime: 'edge' }

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  sbFetch,
  jsonResponse,
  fetchUserFromToken,
  loadProfile
} from '../../../../_lib/supabase.js'
import { writeAudit } from '../../../../_lib/auditLog.js'
import { sendChallengeNotification } from '../../../../../src/notifications/dispatch.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TERMINAL_STATUSES = new Set(['delivered', 'paid_manually', 'canceled'])

function svcHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  }
}

async function requireOrganizer(profile, competitionId) {
  if (profile.role === 'admin') return true
  const orgs = await sbFetch(
    `/competition_organizers?competition_id=eq.${competitionId}&user_id=eq.${profile.id}&select=role&limit=1`
  )
  const role = orgs?.[0]?.role
  return role === 'owner' || role === 'organizer'
}

export default async function handler(req) {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const url = new URL(req.url)
  const m = url.pathname.match(/\/api\/competitions\/([^/]+)\/payouts\/([^/]+)\/manual/)
  const competitionId = m?.[1]
  const payoutId = m?.[2]
  if (!competitionId || !UUID_RE.test(competitionId) || !payoutId || !UUID_RE.test(payoutId)) {
    return jsonResponse({ error: 'invalid_id' }, 400)
  }

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const user = await fetchUserFromToken(token)
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)
  const profile = await loadProfile(user.id)
  if (!profile) return jsonResponse({ error: 'profile_not_found' }, 404)
  if (!(await requireOrganizer(profile, competitionId))) {
    return jsonResponse({ error: 'forbidden' }, 403)
  }

  const body = await req.json().catch(() => ({}))
  const manualNote = String(body.manual_note || '').slice(0, 1000)

  const rows = await sbFetch(
    `/competition_payouts?id=eq.${payoutId}&competition_id=eq.${competitionId}&select=*&limit=1`
  )
  const before = rows?.[0]
  if (!before) return jsonResponse({ error: 'not_found' }, 404)

  // Refuse to overwrite a terminal status (e.g. delivered via webhook,
  // already paid_manually, or canceled). Manual fallback is for unresolved rows only.
  if (TERMINAL_STATUSES.has(before.status)) {
    return jsonResponse({ error: 'already_terminal', status: before.status }, 422)
  }

  const patch = {
    status: 'paid_manually',
    manual_note: manualNote || before.manual_note || null,
    paid_at: new Date().toISOString()
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/competition_payouts?id=eq.${payoutId}`, {
    method: 'PATCH',
    headers: svcHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(patch)
  })
  if (!res.ok) {
    const txt = await res.text()
    console.error('[payouts/manual] patch failed', txt)
    return jsonResponse({ error: 'update_failed' }, 500)
  }
  const after = (await res.json())?.[0]

  const comp = (await sbFetch(`/competitions?id=eq.${competitionId}&select=name&limit=1`))?.[0]

  await writeAudit({
    competitionId,
    actorId: profile.id,
    action: 'payout_marked_manual',
    before,
    after
  })

  try {
    await sendChallengeNotification('won_payout', competitionId, before.user_id, {
      amount: before.amount,
      competitionName: comp?.name,
      claimUrl: null,
      destination: before.destination,
      charity: before.charity?.name || null,
      manualNote: manualNote || null
    })
  } catch (e) {
    console.error('[payouts/manual] notify failed', e)
  }

  return jsonResponse({ ok: true, payout: after })
}
