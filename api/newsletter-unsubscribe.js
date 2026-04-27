export const config = { runtime: 'edge' }

import { sbFetch } from './_lib/supabase.js'

function htmlPage(message) {
  return new Response(`<!doctype html>
<html><head><meta charset="utf-8"><title>Unsubscribed</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:-apple-system,sans-serif;max-width:480px;margin:80px auto;padding:24px;text-align:center;color:#111827}h1{color:#6366f1}</style>
</head><body><h1>Beat the S&amp;P 500</h1><p>${message}</p></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } })
}

export default async function handler(req) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const classId = url.searchParams.get('class_id')

  if (!token) return htmlPage('Missing token.')

  // Try parent subscriber first.
  const parent = await sbFetch(`/newsletter_parent_subscribers?token=eq.${token}&select=id,email,unsubscribed_at`)
  if (parent?.[0]) {
    if (!parent[0].unsubscribed_at) {
      await sbFetch(`/newsletter_parent_subscribers?id=eq.${parent[0].id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ unsubscribed_at: new Date().toISOString() })
      })
    }
    return htmlPage(`You've been unsubscribed (${parent[0].email}). You won't receive future newsletters.`)
  }

  // Otherwise treat as student token (profile.newsletter_token).
  const profile = await sbFetch(`/profiles?newsletter_token=eq.${token}&select=id,email`)
  const user = profile?.[0]
  if (!user) return htmlPage('Invalid or expired link.')

  if (!classId) return htmlPage('Missing class reference.')

  // Idempotent insert
  await sbFetch(`/newsletter_unsubscribes`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: user.id, class_id: classId })
  }).catch(() => null)

  return htmlPage(`You've been unsubscribed from this class's newsletter.`)
}
