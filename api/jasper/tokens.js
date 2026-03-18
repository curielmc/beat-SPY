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
  const admin = await verifyAdminBearer(req.headers.get('authorization'))
  if (admin.error) return admin.error

  if (req.method === 'GET') {
    const lookup = await sbFetch('/jasper_api_tokens?select=id,label,owner_user_id,scopes,last_used_at,revoked_at,created_at&order=created_at.desc')
    if (!lookup.res.ok) {
      return json({ error: 'Failed to load Jasper tokens', details: lookup.data }, 500)
    }

    return json({ tokens: lookup.data || [] })
  }

  if (req.method === 'PATCH') {
    const body = await req.json().catch(() => null)
    const tokenId = typeof body?.token_id === 'string' ? body.token_id.trim() : ''
    if (!tokenId) {
      return json({ error: 'token_id is required' }, 400)
    }

    const revoked = body?.revoked !== false
    const update = await sbFetch(`/jasper_api_tokens?id=eq.${tokenId}`, {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        revoked_at: revoked ? new Date().toISOString() : null
      })
    })

    if (!update.res.ok) {
      return json({ error: 'Failed to update Jasper token', details: update.data }, 500)
    }

    return json({ token: update.data?.[0] || null })
  }

  if (req.method === 'POST') {
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

  return json({ error: 'Method not allowed' }, 405)
}
