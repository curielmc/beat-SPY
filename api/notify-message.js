export const config = { runtime: 'edge' }

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  // Verify it's from Supabase webhook
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) return new Response('Webhook not configured', { status: 500 })
  const sig = req.headers.get('x-webhook-secret')
  if (sig !== secret) return new Response('Unauthorized', { status: 401 })

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://omrfqisqsqgidcqellzy.supabase.co'
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
  const AGENTMAIL_KEY = process.env.AGENTMAIL_API_KEY
  const INBOX_ID = 'beat-snp@agentmail.to' // Your AgentMail inbox

  if (!SUPABASE_KEY || !AGENTMAIL_KEY) {
    return new Response('Server not configured', { status: 500 })
  }

  const payload = await req.json()
  const msg = payload.record // the new messages row

  if (!msg?.id) return new Response('No record', { status: 400 })

  const sbFetch = (path) => fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  }).then(r => r.json())

  // Get recipient emails based on recipient_type
  let emails = []
  let recipientLabel = ''

  if (msg.recipient_type === 'class') {
    const members = await sbFetch(`/class_memberships?class_id=eq.${msg.class_id}&select=profiles:profiles(email,full_name)`)
    emails = (members || []).map(m => ({ email: m.profiles?.email, name: m.profiles?.full_name })).filter(e => e.email)
    recipientLabel = 'your class'
  } else if (msg.recipient_type === 'group') {
    const members = await sbFetch(`/class_memberships?group_id=eq.${msg.recipient_id}&select=profiles:profiles(email,full_name)`)
    const group = await sbFetch(`/groups?id=eq.${msg.recipient_id}&select=name`)
    emails = (members || []).map(m => ({ email: m.profiles?.email, name: m.profiles?.full_name })).filter(e => e.email)
    recipientLabel = group?.[0]?.name || 'your group'
  } else if (msg.recipient_type === 'user') {
    const profile = await sbFetch(`/profiles?id=eq.${msg.recipient_id}&select=email,full_name`)
    if (profile?.[0]?.email) emails = [{ email: profile[0].email, name: profile[0].full_name }]
    recipientLabel = 'you'
  }

  if (!emails.length) return new Response(JSON.stringify({ skipped: 'no emails found' }), { status: 200 })

  // Send via AgentMail
  const subject = msg.sender_id 
    ? `[Msg: ${msg.id}] New message from your teacher`
    : `[Insight] Weekly Portfolio Analysis & Lesson`
  const results = await Promise.all(emails.map(({ email, name }) =>
    fetch(`https://api.agentmail.to/v0/inboxes/${INBOX_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AGENTMAIL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: [email],
        subject,
        html: `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
            <div style="background: #6366f1; padding: 24px; border-radius: 12px 12px 0 0;">
              <h2 style="color: white; margin: 0;">Beat the S&P 500 🏆</h2>
            </div>
            <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;">Message to ${escapeHtml(recipientLabel)}</p>
              <div style="background: white; border-left: 4px solid #6366f1; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 15px; color: #111827;">${escapeHtml(msg.content)}</p>
              </div>
              <p style="margin: 0 0 24px; color: #4b5563; font-size: 14px;">
                Reply to this email to message back!
              </p>
              <a href="https://beat-snp.com/messages" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                Open App →
              </a>
              <p style="margin: 24px 0 0; font-size: 12px; color: #9ca3af;">
                You're receiving this because you're enrolled in a Beat the S&P 500 class.
              </p>
            </div>
          </div>
        `
      })
    }).then(r => r.json())
  ))

  return new Response(JSON.stringify({ sent: emails.length, results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
