export const config = { runtime: 'edge' }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, sbFetch, jsonResponse } from './_lib/supabase.js'
import { renderNewsletterHtml } from './_lib/newsletterRender.js'

const AGENTMAIL_INBOX = 'beat-snp@agentmail.to'
const APP_BASE = process.env.APP_BASE_URL || 'https://beat-snp.com'

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

  const profile = await sbFetch(`/profiles?id=eq.${user.id}&select=role`)
  const role = profile?.[0]?.role
  if (role !== 'teacher' && role !== 'admin') return jsonResponse({ error: 'Forbidden' }, 403)

  const { newsletter_id, subject, intro_html } = await req.json().catch(() => ({}))
  if (!newsletter_id) return jsonResponse({ error: 'newsletter_id required' }, 400)

  const rows = await sbFetch(`/newsletters?id=eq.${newsletter_id}&select=*`)
  const nl = rows?.[0]
  if (!nl) return jsonResponse({ error: 'Newsletter not found' }, 404)

  const cls = await sbFetch(`/classes?id=eq.${nl.class_id}&select=id,class_name,teacher_id,public_slug`)
  const klass = cls?.[0]
  if (!klass) return jsonResponse({ error: 'Class not found' }, 404)
  if (role !== 'admin' && klass.teacher_id !== user.id) return jsonResponse({ error: 'Forbidden' }, 403)

  if (nl.status === 'sent') return jsonResponse({ error: 'Newsletter already sent' }, 409)

  const AGENTMAIL_KEY = process.env.AGENTMAIL_API_KEY
  if (!AGENTMAIL_KEY) return jsonResponse({ error: 'AgentMail not configured' }, 500)

  // Apply edits
  const finalSubject = (subject || nl.subject || '').trim()
  const finalIntro = intro_html || nl.intro_html || ''

  // Recipients: students minus unsubscribes + confirmed parents minus unsubscribes
  const memberships = await sbFetch(
    `/class_memberships?class_id=eq.${nl.class_id}&select=user_id,profiles:profiles(email,full_name,newsletter_token)`
  ) || []
  const unsubs = await sbFetch(
    `/newsletter_unsubscribes?class_id=eq.${nl.class_id}&select=user_id`
  ) || []
  const unsubSet = new Set(unsubs.map(u => u.user_id))

  const studentRecipients = memberships
    .map(m => ({
      email: m.profiles?.email,
      token: m.profiles?.newsletter_token,
      kind: 'student',
      user_id: m.user_id
    }))
    .filter(r => r.email && r.token && !unsubSet.has(r.user_id))

  const parentSubs = await sbFetch(
    `/newsletter_parent_subscribers?class_id=eq.${nl.class_id}&confirmed_at=not.is.null&unsubscribed_at=is.null&select=email,token`
  ) || []
  const parentRecipients = parentSubs.map(p => ({
    email: p.email,
    token: p.token,
    kind: 'parent'
  }))

  // De-dupe by email (in case a parent uses the student's email)
  const seenEmails = new Set()
  const recipients = [...studentRecipients, ...parentRecipients].filter(r => {
    const e = r.email.toLowerCase()
    if (seenEmails.has(e)) return false
    seenEmails.add(e)
    return true
  })

  if (!recipients.length) {
    return jsonResponse({ error: 'No eligible recipients' }, 400)
  }

  const classSignupUrl = klass.public_slug ? `${APP_BASE}/newsletter/subscribe/${klass.public_slug}` : null

  // Send (sequential to avoid bursting AgentMail; could batch in parallel chunks)
  let sentCount = 0
  const errors = []
  for (const r of recipients) {
    const unsubscribeUrl = `${APP_BASE}/api/newsletter-unsubscribe?token=${encodeURIComponent(r.token)}&class_id=${nl.class_id}`
    const html = renderNewsletterHtml({
      subject: finalSubject,
      introHtml: finalIntro,
      payload: nl.payload,
      unsubscribeUrl,
      classSignupUrl
    })
    try {
      const res = await fetch(`https://api.agentmail.to/v0/inboxes/${AGENTMAIL_INBOX}/messages/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${AGENTMAIL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: [r.email], subject: finalSubject, html })
      })
      if (res.ok) sentCount++
      else errors.push({ email: r.email, status: res.status })
    } catch (e) {
      errors.push({ email: r.email, error: e.message })
    }
  }

  // Mark sent
  await sbFetch(`/newsletters?id=eq.${newsletter_id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'sent',
      sent_at: new Date().toISOString(),
      subject: finalSubject,
      intro_html: finalIntro,
      recipients_count: sentCount
    })
  })

  return jsonResponse({ sent: sentCount, total: recipients.length, errors })
}
