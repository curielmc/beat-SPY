export const config = { runtime: 'edge' }

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  sbFetch,
  jsonResponse,
  fetchUserFromToken,
  loadProfile
} from '../../_lib/supabase.js'
import { writeAudit } from '../../_lib/auditLog.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function authHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  }
}

async function isAuthorized(profile, competitionId) {
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
  const m = url.pathname.match(/\/api\/competitions\/([^/]+)\/remove-entry/)
  const competitionId = m?.[1]
  if (!competitionId || !UUID_RE.test(competitionId)) {
    return jsonResponse({ error: 'invalid_competition_id' }, 400)
  }

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const user = await fetchUserFromToken(token)
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)
  const profile = await loadProfile(user.id)
  if (!profile) return jsonResponse({ error: 'profile_not_found' }, 404)
  if (!(await isAuthorized(profile, competitionId))) {
    return jsonResponse({ error: 'forbidden' }, 403)
  }

  const body = await req.json().catch(() => ({}))
  const { entry_id, removed_reason } = body
  if (!entry_id || !UUID_RE.test(entry_id)) return jsonResponse({ error: 'invalid_entry_id' }, 400)
  if (!removed_reason || !String(removed_reason).trim()) {
    return jsonResponse({ error: 'reason_required' }, 422)
  }

  const existing = (await sbFetch(
    `/competition_entries?id=eq.${entry_id}&competition_id=eq.${competitionId}&select=*&limit=1`
  ))?.[0]
  if (!existing) return jsonResponse({ error: 'not_found' }, 404)
  if (existing.status === 'removed') return jsonResponse({ error: 'already_removed' }, 422)

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/competition_entries?id=eq.${entry_id}`,
    {
      method: 'PATCH',
      headers: authHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({
        status: 'removed',
        removed_reason: String(removed_reason).trim(),
        removed_at: new Date().toISOString(),
        removed_by: profile.id
      })
    }
  )
  if (!res.ok) {
    const txt = await res.text()
    return jsonResponse({ error: 'update_failed', detail: txt }, 500)
  }
  const updated = (await res.json())?.[0] || null

  await writeAudit({
    competitionId,
    actorId: profile.id,
    action: 'participant_removed',
    before: existing,
    after: updated
  })

  // Notification dispatch — Plan 5 will implement notification #9 (participant removed).
  if (process.env.NOTIFY_RULE_CHANGES === 'true') {
    // TODO(plan-5): call sendChallengeNotification(competitionId, 'participant_removed',
    //   { user_id: existing.user_id, reason: removed_reason })
    console.log('[notify TODO] participant_removed', {
      competitionId,
      user_id: existing.user_id,
      reason: removed_reason
    })
  }

  return jsonResponse({ ok: true, entry: updated })
}
