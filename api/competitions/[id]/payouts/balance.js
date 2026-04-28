export const config = { runtime: 'edge' }

import {
  sbFetch,
  jsonResponse,
  fetchUserFromToken,
  loadProfile
} from '../../../_lib/supabase.js'
import { getFundingBalance } from '../../../../src/lib/tremendous.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireOrganizer(profile, competitionId) {
  if (profile.role === 'admin') return true
  const orgs = await sbFetch(
    `/competition_organizers?competition_id=eq.${competitionId}&user_id=eq.${profile.id}&select=role&limit=1`
  )
  const role = orgs?.[0]?.role
  return role === 'owner' || role === 'organizer' || role === 'viewer'
}

export default async function handler(req) {
  if (req.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405)
  const url = new URL(req.url)
  const m = url.pathname.match(/\/api\/competitions\/([^/]+)\/payouts\/balance/)
  const competitionId = m?.[1]
  if (!competitionId || !UUID_RE.test(competitionId)) {
    return jsonResponse({ error: 'invalid_competition_id' }, 400)
  }

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const user = await fetchUserFromToken(token)
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)
  const profile = await loadProfile(user.id)
  if (!profile) return jsonResponse({ error: 'profile_not_found' }, 404)
  if (!(await requireOrganizer(profile, competitionId))) {
    return jsonResponse({ error: 'forbidden' }, 403)
  }

  try {
    const balance = await getFundingBalance()
    return jsonResponse({ ok: true, balance })
  } catch (e) {
    console.error('[payouts/balance] tremendous balance fetch failed', e)
    return jsonResponse({ ok: false, error: 'tremendous_balance_failed' }, 502)
  }
}
