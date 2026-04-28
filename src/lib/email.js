// Lightweight email helper. Wraps AgentMail (the project's existing transactional provider).
// Used by serverless API routes; safe to import in edge runtimes.

const AGENTMAIL_INBOX = process.env.AGENTMAIL_INBOX || 'beat-snp@agentmail.to'
const AGENTMAIL_KEY = process.env.AGENTMAIL_API_KEY

export async function sendEmail({ to, subject, text, html }) {
  if (!AGENTMAIL_KEY) {
    throw new Error('AGENTMAIL_API_KEY not configured')
  }
  const payload = { to: Array.isArray(to) ? to : [to], subject }
  if (html) payload.html = html
  if (text) payload.text = text
  if (!html && text) {
    // AgentMail accepts plain text; if not, render minimal HTML fallback
    payload.html = `<pre style="font-family:system-ui,-apple-system,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`
  }
  const res = await fetch(`https://api.agentmail.to/v0/inboxes/${AGENTMAIL_INBOX}/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AGENTMAIL_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
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
