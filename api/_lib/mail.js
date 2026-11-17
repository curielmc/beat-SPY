// One send path for every email. Takes the AgentMail-shaped payload the call sites already build
// ({ to, cc, bcc, reply_to, subject, html, text, headers }) and returns the provider's fetch Response.
// Resend when RESEND_API_KEY is set; AgentMail otherwise.
// ponytail: AgentMail branch exists only for the cutover — delete it once Resend is live.

export const MAIL_FROM_ADDRESS = 'hello@mail.beat-snp.com'
const FROM = process.env.MAIL_FROM || `Beat S&P <${MAIL_FROM_ADDRESS}>`

export const mailConfigured = () => !!(process.env.RESEND_API_KEY || process.env.AGENTMAIL_API_KEY)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function sendMail(payload) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return fetch(`https://api.agentmail.to/v0/inboxes/${MAIL_FROM_ADDRESS}/messages/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  }
  const body = JSON.stringify({ from: FROM, ...payload })
  // Resend rate-limits per second; newsletter sends go out in parallel chunks, so retry 429s.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body
    })
    if (res.status !== 429 || attempt >= 4) return res
    await sleep((Number(res.headers.get('retry-after')) || 1) * 1000)
  }
}
