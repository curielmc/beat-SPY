export const config = { runtime: 'edge' }

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  jsonResponse,
  fetchUserFromToken,
  loadProfile
} from '../_lib/supabase.js'
import { lookupPhone, sendSms } from '../../src/lib/twilio.js'

const E164_RE = /^\+[1-9]\d{6,14}$/

function authHeaders() {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
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
  const { phone_e164, sms_opt_in } = body

  // Opt-out path: just clear flags.
  if (sms_opt_in === false) {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ sms_opt_in: false })
    })
    return jsonResponse({ ok: true, sms_opt_in: false })
  }

  // Opt-in path: validate phone.
  if (!phone_e164 || !E164_RE.test(phone_e164)) {
    return jsonResponse({ error: 'invalid_phone_format' }, 422)
  }

  const lookup = await lookupPhone(phone_e164)
  // valid === null → Twilio not configured; accept as-is.
  // valid === false → reject.
  if (lookup.valid === false) {
    return jsonResponse({ error: 'invalid_phone' }, 422)
  }

  const nowIso = new Date().toISOString()
  const patch = {
    phone_e164,
    sms_opt_in: true,
    sms_opt_in_at: nowIso
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`, {
    method: 'PATCH',
    headers: { ...authHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(patch)
  })
  if (!res.ok) {
    return jsonResponse({ error: 'update_failed', detail: await res.text() }, 500)
  }

  // Confirmation SMS — required by TCPA. Don't fail the request if Twilio errors.
  try {
    await sendSms(phone_e164, "You're opted in to beat-SPY texts. Reply STOP to opt out. Msg & data rates may apply.")
  } catch (e) {
    console.error('[sms-optin] confirmation send failed', e)
  }

  return jsonResponse({ ok: true, sms_opt_in: true, phone_e164 })
}
