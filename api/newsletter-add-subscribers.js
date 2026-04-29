export const config = { runtime: 'edge' }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, sbFetch, jsonResponse } from './_lib/supabase.js'

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

  const profile = await sbFetch(`/profiles?id=eq.${user.id}&select=role`)
  const role = profile?.[0]?.role
  if (role !== 'teacher' && role !== 'admin') return jsonResponse({ error: 'Forbidden' }, 403)

  const { class_id, subscribers } = await req.json().catch(() => ({}))
  if (!class_id) return jsonResponse({ error: 'class_id required' }, 400)
  if (!Array.isArray(subscribers) || subscribers.length === 0) {
    return jsonResponse({ error: 'subscribers array required' }, 400)
  }

  const cls = await sbFetch(`/classes?id=eq.${class_id}&select=id,teacher_id`)
  const klass = cls?.[0]
  if (!klass) return jsonResponse({ error: 'Class not found' }, 404)
  if (role !== 'admin' && klass.teacher_id !== user.id) {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }

  const now = new Date().toISOString()
  const added = []
  const reactivated = []
  const skipped = []
  const invalid = []

  for (const raw of subscribers) {
    const email = String(raw?.email || '').trim().toLowerCase()
    if (!isEmail(email)) {
      invalid.push({ email: raw?.email, reason: 'invalid_email' })
      continue
    }
    const parent_name = raw?.parent_name ? String(raw.parent_name).trim() : null
    const student_name = raw?.student_name ? String(raw.student_name).trim() : null

    try {
      const existing = await sbFetch(
        `/newsletter_parent_subscribers?class_id=eq.${class_id}&email=eq.${encodeURIComponent(email)}&select=id,confirmed_at,unsubscribed_at`
      )
      const row = existing?.[0]

      if (row) {
        if (row.confirmed_at && !row.unsubscribed_at) {
          skipped.push({ email, reason: 'already_confirmed' })
          continue
        }
        await sbFetch(`/newsletter_parent_subscribers?id=eq.${row.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            confirmed_at: row.confirmed_at || now,
            unsubscribed_at: null,
            parent_name: parent_name || undefined,
            student_name: student_name || undefined
          })
        })
        reactivated.push({ email })
      } else {
        await sbFetch(`/newsletter_parent_subscribers`, {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            class_id,
            email,
            parent_name,
            student_name,
            confirmed_at: now
          })
        })
        added.push({ email })
      }
    } catch (e) {
      invalid.push({ email, reason: e.message || 'insert_failed' })
    }
  }

  return jsonResponse({
    added: added.length,
    reactivated: reactivated.length,
    skipped: skipped.length,
    invalid: invalid.length,
    details: { added, reactivated, skipped, invalid }
  })
}
