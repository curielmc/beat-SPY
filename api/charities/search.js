export const config = { runtime: 'edge' }

import { jsonResponse } from '../_lib/supabase.js'

const STATIC_CHARITIES = [
  { ein: '35-1044585', name: "St. Jude Children's Research Hospital" },
  { ein: '86-0481941', name: 'Make-A-Wish Foundation of America' },
  { ein: '53-0196605', name: 'American Red Cross' },
  { ein: '13-3433452', name: 'Doctors Without Borders USA' },
  { ein: '53-0225390', name: 'The Humane Society of the United States' },
  { ein: '13-1788491', name: 'American Cancer Society' },
  { ein: '91-1914868', name: 'Habitat for Humanity International' },
  { ein: '36-3673599', name: 'Feeding America' },
  { ein: '52-1693387', name: 'World Wildlife Fund' },
  { ein: '53-0242652', name: 'The Nature Conservancy' },
  { ein: '13-5613797', name: 'American Heart Association' },
  { ein: '13-1760110', name: 'UNICEF USA' },
  { ein: '22-2406433', name: 'Salvation Army' },
  { ein: '13-1624019', name: 'Boys & Girls Clubs of America' },
  { ein: '36-3258696', name: 'YMCA of the USA' },
  { ein: '47-3061129', name: 'Girls Who Code' },
  { ein: '26-1544963', name: 'Khan Academy' },
  { ein: '20-0049703', name: 'Wikimedia Foundation' },
  { ein: '13-1644147', name: 'Planned Parenthood Federation' },
  { ein: '13-6213516', name: 'ACLU Foundation' }
]

const TREMENDOUS_KEY = process.env.TREMENDOUS_API_KEY
const TREMENDOUS_BASE = process.env.TREMENDOUS_API_BASE || 'https://www.tremendous.com/api/v2'

export default async function handler(req) {
  if (req.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()

  if (TREMENDOUS_KEY) {
    try {
      const tr = await fetch(`${TREMENDOUS_BASE}/charities?search=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${TREMENDOUS_KEY}`, Accept: 'application/json' }
      })
      if (tr.ok) {
        const body = await tr.json()
        const list = body?.charities || body?.data || []
        const results = list.slice(0, 20).map((c) => ({
          ein: c.ein || c.tax_id || '',
          name: c.name || c.title || '',
          source: 'tremendous'
        }))
        return jsonResponse({ results })
      }
      // fall through to static on error
    } catch {
      // fall through
    }
  }

  const ql = q.toLowerCase()
  const results = (ql ? STATIC_CHARITIES.filter((c) => c.name.toLowerCase().includes(ql)) : STATIC_CHARITIES)
    .slice(0, 20)
    .map((c) => ({ ...c, source: 'static' }))

  return jsonResponse({ results })
}
