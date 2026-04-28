// Thin Tremendous REST API wrapper.
//
// Sandbox vs production: set TREMENDOUS_BASE_URL to
//   https://testflight.tremendous.com/api/v2 (sandbox)
//   https://www.tremendous.com/api/v2        (production, default)
// and provide a matching TREMENDOUS_API_KEY.
//
// Required env:
//   TREMENDOUS_API_KEY        — Bearer token
//   TREMENDOUS_CAMPAIGN_ID    — campaign for cash/gift card rewards
//   TREMENDOUS_BASE_URL       — optional; defaults to production
//   TREMENDOUS_FUNDING_SOURCE — optional; funding_source_id (defaults to 'balance')
//   TREMENDOUS_CHARITY_PRODUCT_ID — optional; product id used for charity orders
//                                   (Tremendous offers a 'charity' product type;
//                                   the exact id depends on the merchant's catalog)

const DEFAULT_BASE = 'https://www.tremendous.com/api/v2'

function base() { return process.env.TREMENDOUS_BASE_URL || DEFAULT_BASE }
function key() { return process.env.TREMENDOUS_API_KEY }
function campaignId() { return process.env.TREMENDOUS_CAMPAIGN_ID }
function fundingSourceId() { return process.env.TREMENDOUS_FUNDING_SOURCE || 'balance' }
function charityProductId() { return process.env.TREMENDOUS_CHARITY_PRODUCT_ID || null }

function requireConfig() {
  if (!key()) throw new Error('tremendous_not_configured')
}

function authHeaders() {
  return {
    Authorization: `Bearer ${key()}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
}

export async function getFundingBalance() {
  requireConfig()
  const r = await fetch(`${base()}/funding_sources`, { headers: authHeaders() })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`tremendous funding ${r.status}: ${JSON.stringify(data)}`)
  const sources = data.funding_sources || []
  const primary = sources.find(s => s.method === 'balance') || sources[0]
  // Tremendous returns either available_cents or available.amount; check both.
  const cents = primary?.meta?.available_cents
    ?? primary?.available_cents
    ?? (primary?.available?.amount != null ? Math.round(Number(primary.available.amount) * 100) : null)
  return Number(cents || 0) / 100
}

/**
 * Create a Tremendous order (one reward per call).
 *
 * @param {object} opts
 * @param {string} opts.recipientName
 * @param {string} opts.recipientEmail
 * @param {number} opts.amount
 * @param {string} [opts.currency='USD']
 * @param {string} [opts.externalId]
 * @param {'EMAIL'|'CHARITY'} [opts.deliveryType='EMAIL']
 * @param {{ein?: string, name?: string, id?: string}} [opts.charity]
 *        For deliveryType='CHARITY', the charity record. The donor record
 *        (recipientName/email) still needs to be present for receipts.
 *
 * NOTE: Tremendous's exact charity-order payload shape (charity_id vs ein,
 * product id requirements) varies by account configuration. The shape below
 * is a best-effort placeholder consistent with public docs as of 2025
 * (products[] containing the charity product id, and a `charity` object
 * with `ein` or `id` on the reward). Tune against live API after pilot. See
 * https://developers.tremendous.com — search for "Donations / Charity".
 */
export async function createOrder({
  recipientName,
  recipientEmail,
  amount,
  currency = 'USD',
  externalId,
  deliveryType = 'EMAIL',
  charity = null
}) {
  requireConfig()

  const reward = {
    value: { denomination: Number(amount), currency_code: currency },
    recipient: { name: recipientName, email: recipientEmail },
    delivery: { method: deliveryType }
  }

  if (deliveryType === 'CHARITY') {
    // TODO(tremendous-charity): confirm the live API shape. Two patterns observed:
    //   (a) reward.products = [TREMENDOUS_CHARITY_PRODUCT_ID] + reward.charity = { ein }
    //   (b) reward.campaign_id = <charity-campaign> with charity_id at the root
    // We send (a) as the default; flip via TREMENDOUS_CHARITY_PRODUCT_ID env.
    const cpid = charityProductId()
    if (cpid) reward.products = [cpid]
    reward.charity = {
      ...(charity?.ein ? { ein: charity.ein } : {}),
      ...(charity?.id ? { id: charity.id } : {}),
      ...(charity?.name ? { name: charity.name } : {})
    }
  } else {
    reward.campaign_id = campaignId()
  }

  const body = {
    payment: { funding_source_id: fundingSourceId() },
    rewards: [reward],
    ...(externalId ? { external_id: externalId } : {})
  }

  const r = await fetch(`${base()}/orders`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body)
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    throw new Error(`tremendous order ${r.status}: ${JSON.stringify(data)}`)
  }
  const orderId = data?.order?.id
  const rewardId = data?.order?.rewards?.[0]?.id
  return { orderId, rewardId, raw: data }
}
