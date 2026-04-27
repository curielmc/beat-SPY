export const config = { runtime: 'edge' }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, sbFetch, jsonResponse } from './_lib/supabase.js'
import { renderNewsletterHtml } from './_lib/newsletterRender.js'

const AGENTMAIL_INBOX = 'beat-snp@agentmail.to'
const APP_BASE = process.env.APP_BASE_URL || 'https://beat-snp.com'

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ''))
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)
  const token = authHeader.replace('Bearer ', '')

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_SERVICE_KEY }
  })
  if (!userRes.ok) return jsonResponse({ error: 'Unauthorized' }, 401)
  const user = await userRes.json()

  const profile = await sbFetch(`/profiles?id=eq.${user.id}&select=role,email`)
  const role = profile?.[0]?.role
  if (role !== 'teacher' && role !== 'admin') return jsonResponse({ error: 'Forbidden' }, 403)

  const { newsletter_id, subject, intro_html, to } = await req.json().catch(() => ({}))
  if (!newsletter_id) return jsonResponse({ error: 'newsletter_id required' }, 400)

  const targetEmail = (to && to.trim()) || profile?.[0]?.email
  if (!isEmail(targetEmail)) return jsonResponse({ error: 'Valid recipient email required' }, 400)

  const rows = await sbFetch(`/newsletters?id=eq.${newsletter_id}&select=*`)
  const nl = rows?.[0]
  if (!nl) return jsonResponse({ error: 'Newsletter not found' }, 404)

  const cls = await sbFetch(`/classes?id=eq.${nl.class_id}&select=teacher_id,public_slug`)
  const klass = cls?.[0]
  if (!klass) return jsonResponse({ error: 'Class not found' }, 404)
  if (role !== 'admin' && klass.teacher_id !== user.id) return jsonResponse({ error: 'Forbidden' }, 403)

  const AGENTMAIL_KEY = process.env.AGENTMAIL_API_KEY
  if (!AGENTMAIL_KEY) return jsonResponse({ error: 'AgentMail not configured' }, 500)

  const finalSubject = `[TEST] ${(subject || nl.subject || '').trim()}`
  const finalIntro = intro_html || nl.intro_html || ''
  const classSignupUrl = klass.public_slug ? `${APP_BASE}/newsletter/subscribe/${klass.public_slug}` : null

  // Test unsubscribe link is harmless — it would unsubscribe whoever clicks it from this class
  // if their token matches. For test recipients without a token, the link will show "Invalid".
  const unsubscribeUrl = `${APP_BASE}/api/newsletter-unsubscribe?token=test&class_id=${nl.class_id}`

  const html = renderNewsletterHtml({
    subject: finalSubject,
    introHtml: finalIntro,
    payload: nl.payload,
    unsubscribeUrl,
    classSignupUrl
  })

  const res = await fetch(`https://api.agentmail.to/v0/inboxes/${AGENTMAIL_INBOX}/messages/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${AGENTMAIL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: [targetEmail], subject: finalSubject, html })
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    return jsonResponse({ error: `AgentMail rejected: ${errText || res.status}` }, 502)
  }

  return jsonResponse({ ok: true, sent_to: targetEmail })
}
