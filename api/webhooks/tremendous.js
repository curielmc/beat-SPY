export const config = { runtime: 'edge' }

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  sbFetch
} from '../_lib/supabase.js'

// Tremendous webhook receiver.
//
// Signature header is `Tremendous-Webhook-Signature` (HMAC-SHA256, hex)
// of the raw request body, keyed with TREMENDOUS_WEBHOOK_SECRET.
// Constant-time comparison via Web Crypto (Edge runtime).

async function hmacSha256Hex(secret, raw) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(raw))
  const bytes = new Uint8Array(sig)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0')
  return hex
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function verifySig(req, raw) {
  const secret = process.env.TREMENDOUS_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[tremendous-webhook] TREMENDOUS_WEBHOOK_SECRET not set — rejecting')
    return false
  }
  const header = req.headers.get('tremendous-webhook-signature')
    || req.headers.get('x-tremendous-signature')
    || ''
  if (!header) return false
  // Tremendous sometimes prefixes the hex digest, e.g. "sha256=<hex>".
  const provided = header.includes('=') ? header.split('=').pop() : header
  const expected = await hmacSha256Hex(secret, raw)
  return constantTimeEqual(expected, provided)
}

// Map Tremendous event_type → competition_payouts.status
function statusFromEvent(eventType) {
  const t = String(eventType || '').toUpperCase()
  if (t.includes('DELIVERED') || t.includes('REDEEMED')) return 'delivered'
  if (t.includes('FAILED') || t.includes('REJECTED')) return 'failed'
  if (t.includes('CANCELED') || t.includes('CANCELLED')) return 'canceled'
  return null
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  const raw = await req.text()
  const ok = await verifySig(req, raw)
  if (!ok) return new Response('bad sig', { status: 401 })

  let evt
  try {
    evt = JSON.parse(raw)
  } catch {
    return new Response('bad json', { status: 400 })
  }

  const eventType = evt.event_type || evt.event || evt.type
  const rewardId = evt.payload?.reward?.id
    || evt.payload?.id
    || evt.reward?.id
    || evt.data?.reward?.id

  const newStatus = statusFromEvent(eventType)
  if (!newStatus || !rewardId) {
    // Acknowledge unknown events (don't make Tremendous retry).
    return new Response(JSON.stringify({ ok: true, ignored: true, eventType }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Look up the matching payout row by provider_payout_id.
  const rows = await sbFetch(
    `/competition_payouts?provider_payout_id=eq.${encodeURIComponent(rewardId)}&select=id,status&limit=1`
  )
  const row = rows?.[0]
  if (!row) {
    console.warn('[tremendous-webhook] no payout row for reward', rewardId)
    return new Response(JSON.stringify({ ok: true, matched: false }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Don't downgrade terminal states.
  if (row.status === newStatus) {
    return new Response(JSON.stringify({ ok: true, unchanged: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const patch = { status: newStatus }
  if (newStatus === 'delivered') patch.paid_at = new Date().toISOString()
  if (newStatus === 'failed') patch.error = `webhook: ${eventType}`

  const res = await fetch(`${SUPABASE_URL}/rest/v1/competition_payouts?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(patch)
  })
  if (!res.ok) {
    console.error('[tremendous-webhook] PATCH failed', res.status, await res.text())
    return new Response('patch failed', { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true, status: newStatus }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
