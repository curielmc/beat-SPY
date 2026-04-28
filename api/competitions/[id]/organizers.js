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

async function requireMutator(profile, competitionId) {
  if (profile.role === 'admin') return { allowed: true, role: 'admin' }
  const orgs = await sbFetch(
    `/competition_organizers?competition_id=eq.${competitionId}&user_id=eq.${profile.id}&select=role&limit=1`
  )
  const role = orgs?.[0]?.role
  if (role === 'owner') return { allowed: true, role }
  return { allowed: false }
}

export default async function handler(req) {
  // Vercel edge: dynamic param `id` lives in URL pathname.
  const url = new URL(req.url)
  const m = url.pathname.match(/\/api\/competitions\/([^/]+)\/organizers/)
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

  const auth = await requireMutator(profile, competitionId)
  if (!auth.allowed) return jsonResponse({ error: 'forbidden' }, 403)

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}))
    const { user_id, role } = body
    if (!user_id || !UUID_RE.test(user_id)) return jsonResponse({ error: 'invalid_user_id' }, 400)
    if (!['owner', 'organizer', 'viewer'].includes(role)) return jsonResponse({ error: 'invalid_role' }, 400)

    // Look up existing row
    const existing = await sbFetch(
      `/competition_organizers?competition_id=eq.${competitionId}&user_id=eq.${user_id}&select=*&limit=1`
    )
    const before = existing?.[0] || null

    let action
    let after
    if (before) {
      // Role change
      if (before.role === role) {
        return jsonResponse({ ok: true, organizer: before, unchanged: true })
      }
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/competition_organizers?competition_id=eq.${competitionId}&user_id=eq.${user_id}`,
        {
          method: 'PATCH',
          headers: authHeaders({ Prefer: 'return=representation' }),
          body: JSON.stringify({ role })
        }
      )
      if (!res.ok) {
        const txt = await res.text()
        return jsonResponse({ error: 'update_failed', detail: txt }, 500)
      }
      const updated = await res.json()
      after = updated?.[0] || null
      action = 'organizer_role_changed'
    } else {
      // Add
      const res = await fetch(`${SUPABASE_URL}/rest/v1/competition_organizers`, {
        method: 'POST',
        headers: authHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify({ competition_id: competitionId, user_id, role })
      })
      if (!res.ok) {
        const txt = await res.text()
        return jsonResponse({ error: 'insert_failed', detail: txt }, 500)
      }
      const inserted = await res.json()
      after = inserted?.[0] || null
      action = 'organizer_added'
    }

    await writeAudit({
      competitionId,
      actorId: profile.id,
      action,
      before,
      after
    })

    return jsonResponse({ ok: true, organizer: after })
  }

  if (req.method === 'DELETE') {
    const body = await req.json().catch(() => ({}))
    const { user_id } = body
    if (!user_id || !UUID_RE.test(user_id)) return jsonResponse({ error: 'invalid_user_id' }, 400)

    const existing = await sbFetch(
      `/competition_organizers?competition_id=eq.${competitionId}&user_id=eq.${user_id}&select=*&limit=1`
    )
    const before = existing?.[0]
    if (!before) return jsonResponse({ error: 'not_found' }, 404)
    if (before.role === 'owner') {
      return jsonResponse({ error: 'cannot_remove_owner' }, 422)
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/competition_organizers?competition_id=eq.${competitionId}&user_id=eq.${user_id}`,
      { method: 'DELETE', headers: authHeaders({ Prefer: 'return=minimal' }) }
    )
    if (!res.ok) {
      const txt = await res.text()
      return jsonResponse({ error: 'delete_failed', detail: txt }, 500)
    }

    await writeAudit({
      competitionId,
      actorId: profile.id,
      action: 'organizer_removed',
      before,
      after: null
    })

    return jsonResponse({ ok: true })
  }

  return jsonResponse({ error: 'method_not_allowed' }, 405)
}
