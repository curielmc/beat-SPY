export const config = { runtime: 'edge' }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, jsonResponse } from '../_lib/supabase.js'
import { verifyTwilioSignature } from '../../src/lib/twilio.js'

const STOP_WORDS = new Set(['STOP', 'STOPALL', 'CANCEL', 'UNSUBSCRIBE', 'QUIT', 'END'])
const START_WORDS = new Set(['START', 'YES', 'UNSTOP'])

// Twilio inbound SMS webhook — mirrors STOP keyword to profiles.sms_opt_in=false.
// Twilio also handles STOP carrier-side, but we mirror it for defense-in-depth.
//
// Configure in Twilio console: Phone Numbers → your number → Messaging → A MESSAGE COMES IN
//   → POST https://<host>/api/webhooks/twilio-status
export default async function handler(req) {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  // Twilio sends application/x-www-form-urlencoded.
  const raw = await req.text()
  const params = Object.fromEntries(new URLSearchParams(raw))

  // Verify signature. Twilio signs against the exact URL it called.
  const signature = req.headers.get('x-twilio-signature') || ''
  // Reconstruct the public URL Twilio used. Vercel/edge: req.url has the full URL.
  const fullUrl = req.url
  const ok = await verifyTwilioSignature(fullUrl, params, signature)
  if (!ok && process.env.TWILIO_WEBHOOK_SKIP_VERIFY !== 'true') {
    return jsonResponse({ error: 'invalid_signature' }, 403)
  }

  const from = params.From
  const body = String(params.Body || '').trim().toUpperCase()
  if (!from || !body) {
    return new Response('<Response/>', { status: 200, headers: { 'Content-Type': 'text/xml' } })
  }

  let action = null
  if (STOP_WORDS.has(body)) action = 'opt_out'
  else if (START_WORDS.has(body)) action = 'opt_in'

  if (action) {
    const patch = action === 'opt_out'
      ? { sms_opt_in: false }
      : { sms_opt_in: true, sms_opt_in_at: new Date().toISOString() }

    await fetch(`${SUPABASE_URL}/rest/v1/profiles?phone_e164=eq.${encodeURIComponent(from)}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(patch)
    }).catch((e) => console.error('[twilio-webhook] profile update failed', e))
  }

  // Twilio expects a TwiML response. Empty <Response/> means "no auto-reply"
  // (Twilio handles STOP/START confirmations carrier-side).
  return new Response('<Response/>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' }
  })
}
