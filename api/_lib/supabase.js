export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
export const FMP_KEY = process.env.VITE_FMP_API_KEY

export async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  if (!res.ok) {
    throw new Error(await res.text())
  }

  if (res.status === 204) return null
  return res.json()
}

export async function sbRpc(fn, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    throw new Error(await res.text())
  }

  return res.json()
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function fetchUserFromToken(token) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`
    }
  })
  if (!res.ok) return null
  return res.json().catch(() => null)
}

export async function loadProfile(userId) {
  const data = await sbFetch(
    `/profiles?id=eq.${userId}&select=id,role,email,full_name,date_of_birth,parent_email,parent_language,parental_consent_status,parental_consent_at,parental_consent_expires_at&limit=1`
  )
  return data?.[0] || null
}
