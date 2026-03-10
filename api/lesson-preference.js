export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

export default async function handler(req) {
  const url = new URL(req.url)
  const userId = url.searchParams.get('user')
  const level = url.searchParams.get('level')
  const token = url.searchParams.get('token')

  if (!userId || !['basic', 'advanced'].includes(level)) {
    return new Response(errorPage('Invalid request.'), { status: 400, headers: { 'Content-Type': 'text/html' } })
  }

  // Simple token check: hash of user_id + secret
  const expectedToken = await hashToken(userId)
  if (token !== expectedToken) {
    return new Response(errorPage('Invalid or expired link.'), { status: 403, headers: { 'Content-Type': 'text/html' } })
  }

  // Upsert the preference
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_lesson_preferences`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      user_id: userId,
      difficulty: level,
      updated_at: new Date().toISOString()
    })
  })

  if (!res.ok) {
    return new Response(errorPage('Something went wrong. Please try again.'), { status: 500, headers: { 'Content-Type': 'text/html' } })
  }

  const label = level === 'advanced' ? 'Advanced' : 'Basic'
  return new Response(successPage(label), { status: 200, headers: { 'Content-Type': 'text/html' } })
}

async function hashToken(userId) {
  const secret = process.env.CRON_SECRET || 'beat-snp-lesson-pref'
  const data = new TextEncoder().encode(userId + secret)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

function successPage(level) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Preference Updated</title></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;">
<div style="text-align:center;max-width:400px;padding:40px;">
  <div style="font-size:48px;margin-bottom:16px;">✅</div>
  <h1 style="font-size:24px;color:#111827;margin:0 0 8px;">Got it!</h1>
  <p style="font-size:16px;color:#4b5563;margin:0 0 24px;">Your lessons are now set to <strong>${level}</strong>. Future insights will match this level.</p>
  <a href="https://beat-snp.com" style="background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Open Beat the S&P →</a>
</div>
</body></html>`
}

function errorPage(message) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Error</title></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;">
<div style="text-align:center;max-width:400px;padding:40px;">
  <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
  <h1 style="font-size:24px;color:#111827;margin:0 0 8px;">Oops</h1>
  <p style="font-size:16px;color:#4b5563;">${message}</p>
</div>
</body></html>`
}
