// Lightweight email helper over the shared send path in api/_lib/mail.js.
import { sendMail, mailConfigured } from '../../api/_lib/mail.js'

export async function sendEmail({ to, subject, text, html }) {
  if (!mailConfigured()) throw new Error('Email not configured (RESEND_API_KEY)')
  const payload = { to: Array.isArray(to) ? to : [to], subject }
  if (html) payload.html = html
  if (text) payload.text = text
  if (!html && text) {
    payload.html = `<pre style="font-family:system-ui,-apple-system,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`
  }
  const res = await sendMail(payload)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Email send failed: ${res.status} ${body}`)
  }
  return res.json().catch(() => ({}))
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
