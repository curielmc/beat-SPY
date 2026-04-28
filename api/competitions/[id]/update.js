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
import { MATERIAL_FIELDS, detectMaterialChanges } from '../../../src/lib/competitionFields.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PATCHABLE_FIELDS = [
  'name', 'description', 'sponsor', 'sponsor_logo_url',
  'benchmark_ticker', 'starting_cash',
  'registration_open', 'registration_close', 'start_date', 'end_date',
  'status', 'rules', 'is_public',
  'slug', 'share_token', 'universe', 'email_domain_allowlist',
  'prize_pool_amount', 'prize_pool_currency', 'prize_allocation',
  'unfilled_bucket_policy', 'payout_provider', 'payout_mode', 'default_charity',
  'convert_to_individual_on_complete', 'show_real_names', 'sms_enabled',
  'late_join_allowed', 'digest_frequency'
]

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
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const url = new URL(req.url)
  const m = url.pathname.match(/\/api\/competitions\/([^/]+)\/update/)
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
  const rawUpdates = body.updates || {}
  const updates = Object.fromEntries(
    Object.entries(rawUpdates).filter(([k]) => PATCHABLE_FIELDS.includes(k))
  )
  if (Object.keys(updates).length === 0) {
    return jsonResponse({ error: 'no_patchable_fields' }, 400)
  }
  const reason = body.reason || null

  // Load current row
  const before = (await sbFetch(`/competitions?id=eq.${competitionId}&select=*&limit=1`))?.[0]
  if (!before) return jsonResponse({ error: 'not_found' }, 404)

  // Apply update
  const res = await fetch(`${SUPABASE_URL}/rest/v1/competitions?id=eq.${competitionId}`, {
    method: 'PATCH',
    headers: authHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(updates)
  })
  if (!res.ok) {
    const txt = await res.text()
    console.error('[competition update] update_failed', txt)
    return jsonResponse({ error: 'update_failed' }, 500)
  }
  const updated = await res.json()
  const after = updated?.[0] || null

  // Diff: full snapshot of changed material fields, plus 'reason' if mid-challenge.
  const materialChanges = detectMaterialChanges(before, updates)
  const isMaterialMidChallenge = before.status === 'active' && Object.keys(materialChanges).length > 0

  // Audit log
  await writeAudit({
    competitionId,
    actorId: profile.id,
    action: isMaterialMidChallenge ? 'competition_rules_changed' : 'competition_updated',
    before: { ...materialChanges, _reason: reason || null, _status_before: before.status },
    after
  })

  // Notification dispatch (Plan 5 will implement). For now, log a placeholder
  // so the wiring is visible. Gate behind NOTIFY_RULE_CHANGES env flag.
  if (isMaterialMidChallenge && process.env.NOTIFY_RULE_CHANGES === 'true') {
    // TODO(plan-5): call sendChallengeNotification(competitionId, 'rule_change', { changes: materialChanges, reason })
    console.log('[notify TODO] rule_change', {
      competitionId,
      fields: Object.keys(materialChanges),
      reason
    })
  }

  return jsonResponse({ ok: true, competition: after, material_changes: Object.keys(materialChanges) })
}

// Re-export for downstream consumers / tests.
export { MATERIAL_FIELDS }
