export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Verify the user's JWT and get their user_id
  const token = authHeader.replace('Bearer ', '')
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY }
  })
  if (!userRes.ok) {
    return new Response('Unauthorized', { status: 401 })
  }
  const user = await userRes.json()
  const userId = user.id

  const { difficulty } = await req.json()
  if (!['basic', 'advanced'].includes(difficulty)) {
    return new Response(JSON.stringify({ error: 'Invalid difficulty. Must be "basic" or "advanced".' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
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
      difficulty,
      updated_at: new Date().toISOString()
    })
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(JSON.stringify({ error: err }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ success: true, difficulty }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
