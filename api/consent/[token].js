export const config = { runtime: 'edge' }

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  sbFetch,
  jsonResponse
} from '../_lib/supabase.js'
import { sendEmail } from '../../src/lib/email.js'
import { t, consentTextVersion } from '../../src/i18n/parent/index.js'
import { lookupPhone } from '../../src/lib/twilio.js'

const APP_BASE = process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || 'https://beat-snp.com'

function authHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  }
}

async function loadTokenAndProfile(token) {
  const rows = await sbFetch(`/parental_consent_tokens?token=eq.${encodeURIComponent(token)}&select=*&limit=1`)
  const tk = rows?.[0]
  if (!tk) return { error: 'not_found', status: 404 }
  // Always look up profile so error responses can include the student name.
  const profiles = await sbFetch(
    `/profiles?id=eq.${tk.user_id}&select=id,full_name,email,parent_language,parental_consent_status&limit=1`
  )
  const profile = profiles?.[0] || null
  if (tk.used_at) return { error: 'used', status: 410, token: tk, profile }
  if (new Date(tk.expires_at).getTime() < Date.now()) {
    return { error: 'expired', status: 410, token: tk, profile }
  }
  return { token: tk, profile }
}

export default async function handler(req) {
  // Extract :token from URL: /api/consent/<token>
  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const consentToken = decodeURIComponent(parts[parts.length - 1] || '')
  if (!consentToken) return jsonResponse({ error: 'token_missing' }, 400)

  if (req.method === 'GET') {
    const out = await loadTokenAndProfile(consentToken)
    if (out.error) {
      return jsonResponse(
        { error: out.error, student_name: out.profile?.full_name || null },
        out.status
      )
    }
    return jsonResponse({
      ok: true,
      student_name: out.profile?.full_name || '',
      parent_language: out.profile?.parent_language || 'en',
      consent_text_version: consentTextVersion()
    })
  }

  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const body = await req.json().catch(() => ({}))
  const {
    parent_name,
    relationship,
    signature_text,
    consent_locale,
    parent_phone,
    parent_copy_opt_in,
    consents
  } = body

  if (!parent_name || !signature_text || !relationship) {
    return jsonResponse({ error: 'missing_fields' }, 422)
  }
  if (!consents?.participate) {
    return jsonResponse({ error: 'participation_consent_required' }, 422)
  }
  const locale = consent_locale === 'es' ? 'es' : 'en'

  // Twilio phone validation. valid===null when Twilio not configured (accept).
  if (parent_phone) {
    const lookup = await lookupPhone(parent_phone)
    if (lookup.valid === false) {
      return jsonResponse({ error: 'invalid_phone' }, 422)
    }
  }

  // Atomic claim of the token — fails (returns []) if already used or expired.
  // PostgREST compare-and-swap: PATCH only matches rows where used_at IS NULL
  // and expires_at is in the future.
  const claimRes = await fetch(`${SUPABASE_URL}/rest/v1/parental_consent_tokens?token=eq.${encodeURIComponent(consentToken)}&used_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`, {
    method: 'PATCH',
    headers: authHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify({ used_at: new Date().toISOString() })
  })
  const claimed = await claimRes.json().catch(() => [])
  if (!Array.isArray(claimed) || claimed.length === 0) {
    return jsonResponse({ error: 'token_unavailable' }, 410)
  }
  const tk = claimed[0]

  // Load profile for this user
  const profiles = await sbFetch(
    `/profiles?id=eq.${tk.user_id}&select=id,full_name,email,parent_language,parental_consent_status&limit=1`
  )
  const profile = profiles?.[0]
  if (!profile) return jsonResponse({ error: 'profile_not_found' }, 404)
  // NOTE: Known eventual-consistency edge: if the consent insert or profile
  // patch below fails after the CAS above, the token is consumed without a
  // matching parental_consents row. Acceptable for v1.
  // TODO(v2): wrap in a transactional retry / Postgres function.

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const ua = req.headers.get('user-agent') || null
  const nowIso = new Date().toISOString()

  // 1. Append parental_consents row
  const consentInsert = await fetch(`${SUPABASE_URL}/rest/v1/parental_consents`, {
    method: 'POST',
    headers: authHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify({
      user_id: profile.id,
      parent_name,
      parent_email: tk.parent_email,
      parent_phone_e164: parent_phone || null,
      relationship,
      consented_at: nowIso,
      ip,
      user_agent: ua,
      consent_text_version: consentTextVersion(),
      consent_locale: locale,
      signature_text
    })
  })
  if (!consentInsert.ok) {
    const err = await consentInsert.text()
    return jsonResponse({ error: 'consent_insert_failed', detail: err }, 500)
  }

  // 2. Update profile (consent valid for 12 calendar months)
  const consentedAt = new Date()
  const expires = new Date(consentedAt)
  expires.setUTCMonth(expires.getUTCMonth() + 12)
  const expiresAt = expires.toISOString()
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profile.id}`, {
    method: 'PATCH',
    headers: authHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({
      parental_consent_status: 'consented',
      parental_consent_at: nowIso,
      parental_consent_expires_at: expiresAt
    })
  })

  // 3. Optional parent subscription
  if (parent_copy_opt_in) {
    await fetch(`${SUPABASE_URL}/rest/v1/parent_subscriptions`, {
      method: 'POST',
      headers: authHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        parent_email: tk.parent_email,
        user_id: profile.id,
        notify_email: !!consents?.email,
        notify_sms: !!consents?.sms,
        parent_phone_e164: parent_phone || null,
        language: locale
      })
    }).catch(() => {})
  }

  // 4. Token already marked used by atomic CAS at the top of POST.

  // 5. Receipt email
  try {
    const revokeUrl = `${APP_BASE}/consent/revoke?token=${encodeURIComponent(consentToken)}`
    const subject = t(locale, 'email.receipt_subject', { student_name: profile.full_name || '' })
    const text = t(locale, 'email.receipt_body', {
      student_name: profile.full_name || '',
      revoke_url: revokeUrl
    })
    await sendEmail({ to: tk.parent_email, subject, text })
  } catch (e) {
    // non-fatal
  }

  return jsonResponse({ ok: true })
}
