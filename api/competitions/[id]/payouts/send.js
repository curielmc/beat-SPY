export const config = { runtime: 'edge' }

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  sbFetch,
  jsonResponse,
  fetchUserFromToken,
  loadProfile
} from '../../../_lib/supabase.js'
import { getFundingBalance, createOrder } from '../../../../src/lib/tremendous.js'
import { sendChallengeNotification } from '../../../../src/notifications/dispatch.js'
import { writeAudit } from '../../../_lib/auditLog.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function svcHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  }
}

async function requireOrganizer(profile, competitionId) {
  if (profile.role === 'admin') return true
  const orgs = await sbFetch(
    `/competition_organizers?competition_id=eq.${competitionId}&user_id=eq.${profile.id}&select=role&limit=1`
  )
  const role = orgs?.[0]?.role
  return role === 'owner' || role === 'organizer'
}

export default async function handler(req) {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const url = new URL(req.url)
  const m = url.pathname.match(/\/api\/competitions\/([^/]+)\/payouts\/send/)
  const competitionId = m?.[1]
  if (!competitionId || !UUID_RE.test(competitionId)) {
    return jsonResponse({ error: 'invalid_competition_id' }, 400)
  }

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const user = await fetchUserFromToken(token)
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)
  const profile = await loadProfile(user.id)
  if (!profile) return jsonResponse({ error: 'profile_not_found' }, 404)
  if (!(await requireOrganizer(profile, competitionId))) {
    return jsonResponse({ error: 'forbidden' }, 403)
  }

  const comp = (await sbFetch(
    `/competitions?id=eq.${competitionId}&select=name,prize_pool_currency&limit=1`
  ))?.[0]
  if (!comp) return jsonResponse({ error: 'not_found' }, 404)

  // Pending payouts only — idempotent against double-clicks.
  const pending = await sbFetch(
    `/competition_payouts?competition_id=eq.${competitionId}&status=eq.pending` +
      `&select=id,user_id,amount,currency,destination,charity,` +
      `profiles!inner(full_name,email,parent_email,parental_consent_status,date_of_birth)`
  )
  if (!pending?.length) return jsonResponse({ ok: true, sent: 0, results: [] })

  const need = pending.reduce((a, p) => a + Number(p.amount), 0)
  let balance
  try {
    balance = await getFundingBalance()
  } catch (e) {
    return jsonResponse({ error: 'tremendous_balance_failed', detail: String(e.message) }, 502)
  }
  if (balance < need) {
    return jsonResponse({ error: 'insufficient_balance', balance, need }, 422)
  }

  const results = []
  for (const p of pending) {
    try {
      // Atomic CAS claim — only the first concurrent send-payouts call wins.
      // claimed_at doubles as the in-flight lock; combined with the WHERE
      // status=pending AND claimed_at IS NULL filter, PostgREST returns the
      // row only if THIS request transitioned it. Tremendous's
      // external_id: payout-${p.id} provides additional idempotency at their end.
      const claimRes = await fetch(
        `${SUPABASE_URL}/rest/v1/competition_payouts?id=eq.${p.id}&status=eq.pending&claimed_at=is.null`,
        {
          method: 'PATCH',
          headers: svcHeaders({ Prefer: 'return=representation' }),
          body: JSON.stringify({ claimed_at: new Date().toISOString() })
        }
      )
      const claimed = await claimRes.json().catch(() => null)
      if (!Array.isArray(claimed) || claimed.length === 0) {
        results.push({ id: p.id, ok: false, error: 'already_claimed' })
        continue
      }

      const prof = p.profiles || {}
      // Minor routing: when self-payout and the student is consented as a minor,
      // route the cash gift to the parent's email.
      const isMinorWithParent =
        prof.parental_consent_status === 'consented' && !!prof.parent_email
      const recipientEmail =
        p.destination === 'self' && isMinorWithParent ? prof.parent_email : prof.email
      const recipientName = prof.full_name || prof.email || 'Recipient'

      const deliveryType = p.destination === 'charity' ? 'CHARITY' : 'EMAIL'
      if (deliveryType === 'CHARITY' && !p.charity) {
        // Mark failed without calling Tremendous.
        await fetch(`${SUPABASE_URL}/rest/v1/competition_payouts?id=eq.${p.id}`, {
          method: 'PATCH',
          headers: svcHeaders({ Prefer: 'return=minimal' }),
          body: JSON.stringify({ status: 'failed', error: 'no_charity_resolved' })
        })
        results.push({ id: p.id, ok: false, error: 'no_charity_resolved' })
        continue
      }

      const { orderId, rewardId } = await createOrder({
        recipientName,
        recipientEmail,
        amount: Number(p.amount),
        currency: p.currency || comp.prize_pool_currency || 'USD',
        externalId: `payout-${p.id}`,
        deliveryType,
        charity: p.charity || null
      })

      await fetch(`${SUPABASE_URL}/rest/v1/competition_payouts?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: svcHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({
          status: 'sent',
          provider_payout_id: rewardId || orderId
        })
      })

      try {
        // Derive the claim host from TREMENDOUS_BASE_URL so sandbox/staging
        // users land on the correct domain (testflight vs production).
        const tremendousHost = (process.env.TREMENDOUS_BASE_URL || 'https://www.tremendous.com/api/v2')
          .replace(/\/api\/v2\/?$/, '')
          .replace(/\/$/, '')
        const claimUrl = rewardId ? `${tremendousHost}/rewards/${rewardId}` : null
        await sendChallengeNotification('won_payout', competitionId, p.user_id, {
          amount: p.amount,
          competitionName: comp.name,
          claimUrl,
          destination: p.destination,
          charity: p.charity?.name || null
        })
      } catch (e) {
        console.error('[payouts/send] notify failed', e)
      }

      results.push({ id: p.id, ok: true, rewardId, orderId })
    } catch (e) {
      console.error('[payouts/send] order failed', p.id, e)
      // Clear claimed_at so manual retry remains possible.
      await fetch(`${SUPABASE_URL}/rest/v1/competition_payouts?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: svcHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ status: 'failed', error: String(e.message).slice(0, 500), claimed_at: null })
      })
      results.push({ id: p.id, ok: false, error: String(e.message) })
    }
  }

  await writeAudit({
    competitionId,
    actorId: profile.id,
    action: 'payouts_sent',
    after: { results }
  })

  return jsonResponse({
    ok: true,
    sent: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results
  })
}
