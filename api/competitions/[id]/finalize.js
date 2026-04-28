export const config = { runtime: 'edge' }

import {
  sbFetch,
  jsonResponse,
  fetchUserFromToken,
  loadProfile
} from '../../_lib/supabase.js'
import { finalizeCompetition } from '../../_lib/finalizeCompetition.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireFinalizer(profile, competitionId) {
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
  const m = url.pathname.match(/\/api\/competitions\/([^/]+)\/finalize/)
  const competitionId = m?.[1]
  if (!competitionId || !UUID_RE.test(competitionId)) {
    return jsonResponse({ error: 'invalid_competition_id' }, 400)
  }

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const user = await fetchUserFromToken(token)
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)
  const profile = await loadProfile(user.id)
  if (!profile) return jsonResponse({ error: 'profile_not_found' }, 404)

  const allowed = await requireFinalizer(profile, competitionId)
  if (!allowed) return jsonResponse({ error: 'forbidden' }, 403)

  const result = await finalizeCompetition({
    competitionId,
    actorId: profile.id,
    source: 'manual'
  })

  if (!result.ok) {
    return jsonResponse({ error: result.error }, result.status || 500)
  }
  return jsonResponse(result)
}
