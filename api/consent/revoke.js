export const config = { runtime: 'edge' }

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  sbFetch
} from '../_lib/supabase.js'
import { t } from '../../src/i18n/parent/index.js'
import { sendChallengeNotification } from '../../src/notifications/dispatch.js'

function authHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function htmlPage({ title, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 540px; margin: 4rem auto; padding: 0 1.25rem; color: #111; line-height: 1.5; }
  h1 { font-size: 1.5rem; margin-bottom: 1rem; }
  p { color: #333; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(body)}</p>
  <p style="margin-top:2rem;color:#888;font-size:0.875rem">— beat-SPY</p>
</body>
</html>`
}

function htmlResponse(html, status = 200) {
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response('method not allowed', { status: 405 })
  }
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const langOverride = url.searchParams.get('lang')

  if (!token) {
    return htmlResponse(htmlPage({ title: 'Missing token', body: 'No revocation token was provided.' }), 400)
  }

  // Look up the token (may be already used — that's fine; revocation is allowed
  // even after consent was previously submitted).
  const tokens = await sbFetch(`/parental_consent_tokens?token=eq.${encodeURIComponent(token)}&select=*&limit=1`)
  const tk = tokens?.[0]
  if (!tk) {
    const lang = langOverride === 'es' ? 'es' : 'en'
    return htmlResponse(htmlPage({
      title: t(lang, 'revoke.not_found_title'),
      body: t(lang, 'revoke.not_found_body')
    }), 404)
  }

  // Load the user's profile.
  const profiles = await sbFetch(
    `/profiles?id=eq.${tk.user_id}&select=id,full_name,parent_language,parental_consent_status&limit=1`
  )
  const profile = profiles?.[0]
  const lang = (langOverride === 'es' || langOverride === 'en')
    ? langOverride
    : (profile?.parent_language || 'en')

  // Pull the most recent consent for this user (to copy parent_name etc).
  const recent = (await sbFetch(
    `/parental_consents?user_id=eq.${tk.user_id}&order=consented_at.desc&limit=1`
  ))?.[0] || null

  // 1. Append revocation row to parental_consents.
  await fetch(`${SUPABASE_URL}/rest/v1/parental_consents`, {
    method: 'POST',
    headers: authHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({
      user_id: tk.user_id,
      parent_name: recent?.parent_name || tk.parent_email || 'unknown',
      parent_email: tk.parent_email || recent?.parent_email || 'unknown',
      parent_phone_e164: recent?.parent_phone_e164 || null,
      relationship: recent?.relationship || 'parent',
      consented_at: new Date().toISOString(),
      consent_text_version: recent?.consent_text_version || 'v1-2026-04-27',
      consent_locale: lang,
      signature_text: recent?.signature_text || '',
      revoked_at: new Date().toISOString(),
      revoked_reason: 'parent_revoked_via_email_link'
    })
  }).catch((e) => console.error('[revoke] consent insert failed', e))

  // 2. Flip profile to revoked.
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${tk.user_id}`, {
    method: 'PATCH',
    headers: authHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ parental_consent_status: 'revoked' })
  }).catch((e) => console.error('[revoke] profile patch failed', e))

  // 3. Remove user from active competition entries.
  const activeEntries = await sbFetch(
    `/competition_entries?user_id=eq.${tk.user_id}&status=eq.active&select=id,competition_id`
  )
  for (const e of (activeEntries || [])) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/competition_entries?id=eq.${e.id}`, {
      method: 'PATCH',
      headers: authHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ status: 'removed', removed_reason: 'parental_consent_revoked' })
    })
    if (!r.ok) {
      console.error('[revoke] entry patch failed', await r.text())
      continue
    }
    // Notification #9 — removed (critical, bypasses opt-out).
    try {
      const comp = (await sbFetch(`/competitions?id=eq.${e.competition_id}&select=name&limit=1`))?.[0]
      await sendChallengeNotification('removed', e.competition_id, tk.user_id, {
        competitionName: comp?.name || 'a challenge',
        reason: 'parental_consent_revoked'
      })
    } catch (err) {
      console.error('[revoke] notification failed', err)
    }
  }

  return htmlResponse(htmlPage({
    title: t(lang, 'revoke.page_title'),
    body: t(lang, 'revoke.page_body', { student_name: profile?.full_name || '' })
  }))
}
