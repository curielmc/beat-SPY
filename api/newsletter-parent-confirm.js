export const config = { runtime: 'edge' }

import { sbFetch } from './_lib/supabase.js'

function htmlPage(title, message) {
  return new Response(`<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:-apple-system,sans-serif;max-width:480px;margin:80px auto;padding:24px;text-align:center;color:#111827}h1{color:#6366f1}</style>
</head><body><h1>Beat the S&amp;P 500</h1><p>${message}</p></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } })
}

export default async function handler(req) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) return htmlPage('Error', 'Missing token.')

  const rows = await sbFetch(`/newsletter_parent_subscribers?token=eq.${token}&select=id,email,confirmed_at,unsubscribed_at`)
  const row = rows?.[0]
  if (!row) return htmlPage('Error', 'Invalid or expired link.')

  if (row.unsubscribed_at) {
    return htmlPage('Already unsubscribed', 'This email has been unsubscribed. Please re-subscribe via the class signup page if you want to receive newsletters.')
  }

  if (!row.confirmed_at) {
    await sbFetch(`/newsletter_parent_subscribers?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ confirmed_at: new Date().toISOString() })
    })
  }

  return htmlPage('Subscribed', `You're all set. ${row.email} will receive newsletter updates.`)
}
