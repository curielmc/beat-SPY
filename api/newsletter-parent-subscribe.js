export const config = { runtime: 'edge' }

import { sbFetch, jsonResponse } from './_lib/supabase.js'

const APP_BASE = process.env.APP_BASE_URL || 'https://beat-snp.com'
const AGENTMAIL_INBOX = 'beat-snp@agentmail.to'

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ''))
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const body = await req.json().catch(() => ({}))
  const { class_slug, email, parent_name, student_name } = body

  if (!class_slug || !isEmail(email)) {
    return jsonResponse({ error: 'class_slug and valid email required' }, 400)
  }

  const classes = await sbFetch(`/classes?public_slug=eq.${encodeURIComponent(class_slug)}&select=id,class_name`)
  const klass = classes?.[0]
  if (!klass) return jsonResponse({ error: 'Class not found' }, 404)

  // Upsert subscriber row
  const existing = await sbFetch(
    `/newsletter_parent_subscribers?class_id=eq.${klass.id}&email=eq.${encodeURIComponent(email.toLowerCase())}&select=id,token,confirmed_at`
  )
  let row = existing?.[0]
  if (!row) {
    const inserted = await sbFetch(`/newsletter_parent_subscribers`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        class_id: klass.id,
        email: email.toLowerCase(),
        parent_name: parent_name || null,
        student_name: student_name || null
      })
    })
    row = inserted?.[0]
  } else if (row.confirmed_at) {
    return jsonResponse({ ok: true, already_confirmed: true })
  }

  if (!row?.token) return jsonResponse({ error: 'Failed to create subscription' }, 500)

  // Send confirmation email
  const AGENTMAIL_KEY = process.env.AGENTMAIL_API_KEY
  if (AGENTMAIL_KEY) {
    const confirmUrl = `${APP_BASE}/api/newsletter-parent-confirm?token=${encodeURIComponent(row.token)}`
    const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="color:#6366f1;">Confirm your newsletter subscription</h2>
      <p>You requested newsletter updates for <strong>${escapeHtml(klass.class_name)}</strong>.</p>
      <p style="margin:24px 0;"><a href="${confirmUrl}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Confirm subscription</a></p>
      <p style="color:#6b7280;font-size:12px;">If you didn't request this, you can ignore this email.</p>
    </div>`
    await fetch(`https://api.agentmail.to/v0/inboxes/${AGENTMAIL_INBOX}/messages/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AGENTMAIL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: [email], subject: `Confirm subscription — ${klass.class_name}`, html })
    }).catch(() => null)
  }

  return jsonResponse({ ok: true, sent_confirmation: true })
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
