export const config = { runtime: 'edge' }

import {
  generateJasperToken,
  json,
  normalizeScopes,
  sbFetch,
  sha256Hex,
  verifyAdminBearer
} from '../_lib/jasper.js'

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const admin = await verifyAdminBearer(req.headers.get('authorization'))
  if (admin.error) return admin.error

  const body = await req.json().catch(() => null)
  const label = typeof body?.label === 'string' ? body.label.trim() : ''
  if (!label) {
    return json({ error: 'label is required' }, 400)
  }

  const scopes = normalizeScopes(body?.scopes?.length ? body.scopes : ['tutorials:create'])
  if (scopes.length === 0) {
    return json({ error: 'At least one valid scope is required' }, 400)
  }

  const rawToken = generateJasperToken()
  const tokenHash = await sha256Hex(rawToken)
  const insert = await sbFetch('/jasper_api_tokens', {
    method: 'POST',
    body: JSON.stringify({
      label,
      token_hash: tokenHash,
      owner_user_id: admin.user.id,
      scopes
    })
  })

  if (!insert.res.ok) {
    return json({ error: 'Failed to create Jasper token', details: insert.data }, 500)
  }

  const tokenRecord = insert.data?.[0]
  return json({
    token: rawToken,
    token_id: tokenRecord?.id || null,
    label,
    scopes
  }, 201)
}
