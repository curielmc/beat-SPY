export const config = { runtime: 'edge' }

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  sbFetch,
  jsonResponse
} from '../_lib/supabase.js'
import { sendEmail } from '../../src/lib/email.js'
import { t, consentTextVersion } from '../../src/i18n/parent/index.js'

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
  if (tk.used_at) return { error: 'used', status: 410, token: tk }
  if (new Date(tk.expires_at).getTime() < Date.now()) {
    return { error: 'expired', status: 410, token: tk }
  }
  const profiles = await sbFetch(
    `/profiles?id=eq.${tk.user_id}&select=id,full_name,email,parent_language,parental_consent_status&limit=1`
  )
  return { token: tk, profile: profiles?.[0] || null }
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
        { error: out.error, student_name: out.token ? null : null },
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

  const out = await loadTokenAndProfile(consentToken)
  if (out.error) return jsonResponse({ error: out.error }, out.status)
  const { token: tk, profile } = out
  if (!profile) return jsonResponse({ error: 'profile_not_found' }, 404)

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

  // 2. Update profile
  const expiresAt = new Date(Date.now() + 365 * 86400 * 1000).toISOString()
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

  // 4. Mark token used
  await fetch(`${SUPABASE_URL}/rest/v1/parental_consent_tokens?token=eq.${encodeURIComponent(consentToken)}`, {
    method: 'PATCH',
    headers: authHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ used_at: nowIso })
  })

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
