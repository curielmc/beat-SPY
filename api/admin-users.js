export const config = { runtime: 'edge' }

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  })
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers })
  const data = await res.json().catch(() => null)
  return { res, data }
}

export default async function handler(req) {
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Missing bearer token' }, 401)
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'Server auth is not configured' }, 500)
  }

  const userLookup = await fetchJson(`${supabaseUrl}/auth/v1/user`, {
    apikey: anonKey,
    Authorization: authHeader
  })

  if (!userLookup.res.ok || !userLookup.data?.id) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const requesterId = userLookup.data.id
  const requesterProfile = await fetchJson(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${requesterId}&select=role,email`,
    {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    }
  )

  const requesterRole = requesterProfile.data?.[0]?.role
  if (requesterRole !== 'admin') {
    return json({ error: 'Forbidden' }, 403)
  }

  const usersLookup = await fetchJson(
    `${supabaseUrl}/rest/v1/profiles?select=*&order=created_at.desc.nullslast`,
    {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    }
  )

  if (!usersLookup.res.ok) {
    return json({ error: 'Failed to load users' }, 500)
  }

  return json({ users: usersLookup.data || [] })
}
