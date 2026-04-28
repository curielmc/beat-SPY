export const config = { runtime: 'edge' }

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  sbFetch,
  jsonResponse,
  fetchUserFromToken,
  loadProfile
} from '../_lib/supabase.js'

function authHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const user = await fetchUserFromToken(token)
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)
  const profile = await loadProfile(user.id)
  if (!profile) return jsonResponse({ error: 'profile_not_found' }, 404)

  const body = await req.json().catch(() => ({}))
  const { competition_id, rows } = body
  if (!competition_id || !Array.isArray(rows)) {
    return jsonResponse({ error: 'invalid_input' }, 400)
  }

  // Authorization: admin OR competition organizer/owner
  if (profile.role !== 'admin') {
    const orgs = await sbFetch(
      `/competition_organizers?competition_id=eq.${competition_id}&user_id=eq.${profile.id}&select=role&limit=1`
    )
    const role = orgs?.[0]?.role
    if (role !== 'owner' && role !== 'organizer') return jsonResponse({ error: 'forbidden' }, 403)
  }

  // Validate + dedupe
  const seen = new Set()
  const cleaned = []
  let skipped = 0
  for (const r of rows) {
    const email = String(r.email || '').trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skipped++; continue }
    if (seen.has(email)) { skipped++; continue }
    seen.add(email)
    cleaned.push({
      competition_id,
      email,
      full_name: String(r.full_name || '').trim() || null,
      status: 'invited',
      invited_at: new Date().toISOString()
    })
  }

  if (!cleaned.length) return jsonResponse({ error: 'no_valid_rows', skipped }, 422)

  // Upsert via PostgREST resolution=merge-duplicates on (competition_id, email)
  // The roster table has a unique on (competition_id, lower(email)) — emails are already lowered.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/competition_roster`, {
    method: 'POST',
    headers: authHeaders({
      Prefer: 'resolution=merge-duplicates,return=minimal'
    }),
    body: JSON.stringify(cleaned)
  })
  if (!res.ok) {
    const err = await res.text()
    return jsonResponse({ error: 'upsert_failed', detail: err }, 500)
  }

  // TODO: when sendChallengeNotification helper exists (Plan 5), trigger notification #10
  // (roster invitation email) for each new row.

  return jsonResponse({ ok: true, upserted: cleaned.length, skipped })
}
