export const config = { runtime: 'edge' }

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  jsonResponse,
  fetchUserFromToken,
  loadProfile
} from '../_lib/supabase.js'
import { sendEmail } from '../../src/lib/email.js'
import { t } from '../../src/i18n/parent/index.js'

const APP_BASE = process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || 'https://beat-snp.com'

function genToken() {
  // 64 hex chars, edge-runtime-friendly
  const a = crypto.randomUUID().replace(/-/g, '')
  const b = crypto.randomUUID().replace(/-/g, '')
  return a + b
}

export default async function handler(req) {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const user = await fetchUserFromToken(token)
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)

  const profile = await loadProfile(user.id)
  if (!profile) return jsonResponse({ error: 'profile_not_found' }, 404)
  if (!profile.parent_email) return jsonResponse({ error: 'no_parent_email' }, 422)
  if (profile.parent_email.toLowerCase() === (profile.email || '').toLowerCase()) {
    return jsonResponse({ error: 'parent_email_cannot_match_student' }, 422)
  }

  const consentToken = genToken()
  const expires = new Date(Date.now() + 14 * 86400 * 1000).toISOString()

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/parental_consent_tokens`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      token: consentToken,
      user_id: profile.id,
      parent_email: profile.parent_email,
      expires_at: expires
    })
  })
  if (!insertRes.ok) {
    const err = await insertRes.text()
    return jsonResponse({ error: 'token_insert_failed', detail: err }, 500)
  }

  const lang = profile.parent_language || 'en'
  const url = `${APP_BASE}/consent/${consentToken}?lang=${lang}`
  const subject = t(lang, 'email.request_subject', { student_name: profile.full_name || 'your child' })
  const localBody = t(lang, 'email.request_body', {
    student_name: profile.full_name || 'your child',
    consent_url: url
  })
  // Bilingual stack: include EN + native lang together when lang != en
  const stacked = lang === 'en'
    ? localBody
    : `${t('en', 'email.request_body', { student_name: profile.full_name || 'your child', consent_url: url })}\n\n---\n\n${localBody}`

  try {
    await sendEmail({ to: profile.parent_email, subject, text: stacked })
  } catch (e) {
    return jsonResponse({ error: 'email_send_failed', detail: e.message }, 500)
  }

  return jsonResponse({ ok: true, expires_at: expires })
}
