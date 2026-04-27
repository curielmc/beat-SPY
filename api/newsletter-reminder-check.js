export const config = { runtime: 'edge' }

// Daily cron. For each active class (end_date in the future), email the teacher
// if it's been >=90 days since the last newsletter (or since the class started
// if none have been sent), and the last reminder for this class was >7 days ago.

import { sbFetch } from './_lib/supabase.js'

const AGENTMAIL_INBOX = 'beat-snp@agentmail.to'
const APP_BASE = process.env.APP_BASE_URL || 'https://beat-snp.com'
const REMINDER_INTERVAL_DAYS = 90
const COOLDOWN_DAYS = 7

function daysBetween(a, b) {
  return (new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24)
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default async function handler(req) {
  // Vercel cron requests carry a x-vercel-cron header; also accept manual cron secret.
  const isCron = req.headers.get('x-vercel-cron') !== null
  const secret = req.headers.get('x-cron-secret')
  if (!isCron && secret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const AGENTMAIL_KEY = process.env.AGENTMAIL_API_KEY
  if (!AGENTMAIL_KEY) return new Response('AgentMail not configured', { status: 500 })

  const today = new Date()
  const todayDate = today.toISOString().split('T')[0]

  // Active classes: end_date in the future.
  const classes = await sbFetch(
    `/classes?end_date=gte.${todayDate}&select=id,class_name,teacher_id,end_date,created_at,last_newsletter_reminder_at`
  ) || []

  const sent = []
  const skipped = []

  for (const c of classes) {
    // Cooldown
    if (c.last_newsletter_reminder_at &&
        daysBetween(c.last_newsletter_reminder_at, today) < COOLDOWN_DAYS) {
      skipped.push({ class_id: c.id, reason: 'cooldown' })
      continue
    }

    // Last newsletter sent for this class
    const lastNL = await sbFetch(
      `/newsletters?class_id=eq.${c.id}&status=eq.sent&select=sent_at&order=sent_at.desc&limit=1`
    )
    const lastSentAt = lastNL?.[0]?.sent_at

    // Determine "since" — last send, or oldest portfolio in class, or class created_at.
    let sinceDate = lastSentAt
    if (!sinceDate) {
      const groups = await sbFetch(`/groups?class_id=eq.${c.id}&select=id`)
      const groupCsv = (groups || []).map(g => encodeURIComponent(g.id)).join(',')
      if (groupCsv) {
        const oldest = await sbFetch(
          `/portfolios?owner_type=eq.group&owner_id=in.(${groupCsv})&select=created_at&order=created_at.asc&limit=1`
        )
        sinceDate = oldest?.[0]?.created_at
      }
      if (!sinceDate) sinceDate = c.created_at
    }

    const daysSince = daysBetween(sinceDate, today)
    if (daysSince < REMINDER_INTERVAL_DAYS) {
      skipped.push({ class_id: c.id, reason: 'not_due', daysSince: Math.round(daysSince) })
      continue
    }

    // Look up teacher email
    const teacher = await sbFetch(`/profiles?id=eq.${c.teacher_id}&select=email,full_name`)
    const teacherEmail = teacher?.[0]?.email
    if (!teacherEmail) {
      skipped.push({ class_id: c.id, reason: 'no_teacher_email' })
      continue
    }

    const daysRemaining = Math.max(0, Math.ceil(daysBetween(today, c.end_date + 'T23:59:59Z')))
    const lastSentLabel = lastSentAt
      ? `Your last newsletter went out on ${new Date(lastSentAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`
      : `You haven't sent a newsletter for this class yet.`

    const html = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="color:#6366f1;margin:0 0 12px;">Time for a class newsletter</h2>
      <p style="font-size:15px;color:#111827;">Hi ${escapeHtml(teacher[0].full_name || 'there')},</p>
      <p style="font-size:15px;color:#111827;">It's been about ${Math.round(daysSince)} days for <strong>${escapeHtml(c.class_name)}</strong>. ${lastSentLabel} A quarterly update keeps students and parents engaged with the class.</p>
      <p style="font-size:14px;color:#374151;">${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remain before the class closes.</p>
      <p style="margin:24px 0;"><a href="${APP_BASE}/teacher/newsletter" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Open Newsletter →</a></p>
      <p style="color:#6b7280;font-size:12px;">You'll get this reminder every ~90 days while the class is active.</p>
    </div>`

    try {
      const res = await fetch(`https://api.agentmail.to/v0/inboxes/${AGENTMAIL_INBOX}/messages/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${AGENTMAIL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: [teacherEmail],
          subject: `Reminder: send a newsletter for ${c.class_name}`,
          html
        })
      })
      if (res.ok) {
        await sbFetch(`/classes?id=eq.${c.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ last_newsletter_reminder_at: today.toISOString() })
        })
        sent.push({ class_id: c.id, teacher: teacherEmail })
      } else {
        skipped.push({ class_id: c.id, reason: 'agentmail_error', status: res.status })
      }
    } catch (e) {
      skipped.push({ class_id: c.id, reason: 'exception', error: e.message })
    }
  }

  return new Response(JSON.stringify({ checked: classes.length, sent, skipped }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
