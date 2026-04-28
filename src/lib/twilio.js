// Twilio SMS helper. Safe no-ops when env vars are not configured.
//
// Required env vars (all three to actually send):
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_FROM_NUMBER  (E.164, e.g. +15551234567)
//
// Optional:
//   TWILIO_WEBHOOK_AUTH_TOKEN  — defaults to TWILIO_AUTH_TOKEN. Used to verify
//                                X-Twilio-Signature on inbound webhooks.

const SID = () => process.env.TWILIO_ACCOUNT_SID
const TOKEN = () => process.env.TWILIO_AUTH_TOKEN
const FROM = () => process.env.TWILIO_FROM_NUMBER

function b64(s) {
  // Cross-runtime base64 (edge + node).
  if (typeof btoa === 'function') return btoa(s)
  return Buffer.from(s, 'utf-8').toString('base64')
}

export async function sendSms(to, body) {
  const sid = SID()
  const token = TOKEN()
  const from = FROM()
  if (!sid || !token || !from) {
    console.warn('Twilio not configured; skipping SMS')
    return { skipped: true }
  }
  if (!to) return { skipped: true, reason: 'no_to' }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
  const auth = b64(`${sid}:${token}`)
  const params = new URLSearchParams({ From: from, To: to, Body: body })
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`twilio ${res.status}: ${data.message || JSON.stringify(data)}`)
  }
  return data
}

// Twilio Lookup v2 — validate that a phone number is real and (optionally) mobile.
// Returns:
//   { valid: null }                  — Twilio not configured (caller should accept as-is)
//   { valid: false }                 — definitely invalid / lookup error
//   { valid: true, type: 'mobile' }  — valid, with carrier line type when available
export async function lookupPhone(phoneE164) {
  const sid = SID()
  const token = TOKEN()
  if (!sid || !token) return { valid: null }
  if (!phoneE164) return { valid: false }

  const auth = b64(`${sid}:${token}`)
  const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phoneE164)}?Fields=line_type_intelligence`
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } })
  if (!res.ok) return { valid: false }
  const j = await res.json().catch(() => ({}))
  return { valid: j.valid === true, type: j.line_type_intelligence?.type || null }
}

// Verify Twilio's X-Twilio-Signature for an inbound webhook.
// fullUrl: the full request URL Twilio called (https://host/path?query)
// params:  the form-encoded POST params as an object
// signature: the X-Twilio-Signature header value
// Returns true on match.
export async function verifyTwilioSignature(fullUrl, params, signature) {
  const token = process.env.TWILIO_WEBHOOK_AUTH_TOKEN || TOKEN()
  if (!token || !signature) return false

  // Twilio: concatenate URL + sorted (key+value) pairs, HMAC-SHA1 with auth token, base64.
  const sortedKeys = Object.keys(params).sort()
  let data = fullUrl
  for (const k of sortedKeys) data += k + (params[k] == null ? '' : String(params[k]))

  const enc = new TextEncoder()
  const keyBuf = enc.encode(token)
  const dataBuf = enc.encode(data)

  let expected
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const key = await crypto.subtle.importKey(
      'raw',
      keyBuf,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, dataBuf)
    expected = b64(String.fromCharCode(...new Uint8Array(sig)))
    // Constant-time compare (Web Crypto / edge path).
    const a = enc.encode(expected)
    const b = enc.encode(signature)
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    return diff === 0
  } else {
    // Node fallback
    const { createHmac, timingSafeEqual } = await import('node:crypto')
    expected = createHmac('sha1', token).update(data).digest('base64')
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(signature, 'utf8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  }
}
