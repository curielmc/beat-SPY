export const config = { runtime: 'edge' }

import { getQueuedExecutionPrice } from '../src/lib/tradePricing.js'
import { isMarketOpen } from '../src/utils/marketHours.js'
import { FMP_KEY, sbFetch, sbRpc } from './_lib/supabase.js'
import { OWNER_EMAIL, AGENTMAIL_INBOX } from './_lib/constants.js'

async function fetchQuotes(tickers) {
  const quoteMap = {}
  if (!FMP_KEY || tickers.length === 0) return quoteMap

  for (let i = 0; i < tickers.length; i += 50) {
    const batch = tickers.slice(i, i + 50)
    try {
      const quotes = await fetch(`https://financialmodelingprep.com/api/v3/quote/${batch.join(',')}?apikey=${FMP_KEY}`).then(r => r.json())
      for (const quote of (quotes || [])) {
        quoteMap[quote.symbol] = quote
      }
    } catch (err) {
      // Partial quote fetches are acceptable; failed symbols will fail execution individually.
    }
  }

  return quoteMap
}

async function notifyAdmin(subject, body) {
  const AGENTMAIL_KEY = process.env.AGENTMAIL_API_KEY
  if (!AGENTMAIL_KEY) return
  try {
    await fetch(`https://api.agentmail.to/v0/inboxes/${AGENTMAIL_INBOX}/messages/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AGENTMAIL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: [OWNER_EMAIL],
        subject,
        html: `<div style="font-family:sans-serif;padding:20px;">
          <h2 style="color:#dc2626;">${subject}</h2>
          <pre style="background:#f3f4f6;padding:16px;border-radius:8px;overflow:auto;">${body}</pre>
          <p style="color:#9ca3af;font-size:12px;margin-top:16px;">Automated alert from Beat the S&amp;P 500 pending orders cron.</p>
        </div>`
      })
    })
  } catch (e) { /* best effort */ }
}

function formatTradeDollars(dollars) {
  return `$${Number(dollars || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function formatExecutionPrice(price) {
  const value = Number(price || 0)
  return value > 0 ? `$${value.toFixed(2)}` : 'an unavailable price'
}

function formatOrderLabel(order) {
  const fundNumber = order.portfolios?.fund_number
  const fundName = order.portfolios?.fund_name
  if (fundName) return fundName
  if (fundNumber != null) return `Fund ${fundNumber}`
  return 'portfolio'
}

async function getNotificationTarget(order) {
  const portfolio = order.portfolios || {}
  const ownerType = portfolio.owner_type
  const ownerId = portfolio.owner_id

  if (ownerType === 'group' && ownerId) {
    const groups = await sbFetch(`/groups?id=eq.${ownerId}&select=id,class_id,name&limit=1`).catch(() => [])
    const group = groups?.[0]
    if (group?.class_id) {
      return {
        classId: group.class_id,
        recipientType: 'group',
        recipientId: group.id,
        recipientName: group.name || 'your group'
      }
    }
  }

  if ((ownerType === 'user' || ownerType === 'competition') && ownerId) {
    const memberships = await sbFetch(`/class_memberships?user_id=eq.${ownerId}&select=class_id&order=joined_at.desc&limit=1`).catch(() => [])
    const membership = memberships?.[0]
    if (membership?.class_id) {
      return {
        classId: membership.class_id,
        recipientType: 'user',
        recipientId: ownerId,
        recipientName: 'you'
      }
    }
  }

  return null
}

async function sendOrderNotification(order, kind, details = {}) {
  const target = await getNotificationTarget(order)
  if (!target?.classId || !target?.recipientType) return

  const side = String(order.side || '').toUpperCase()
  const ticker = order.ticker || 'Unknown ticker'
  const dollars = formatTradeDollars(order.dollars)
  const fundLabel = formatOrderLabel(order)

  let content = ''
  if (kind === 'executed') {
    const shares = Number(details.shares || 0)
    const sharesText = shares > 0 ? ` for ${shares.toFixed(4)} shares` : ''
    content = `Order executed: ${side} ${ticker} in ${fundLabel} for ${dollars} at ${formatExecutionPrice(details.executionPrice)}${sharesText}.`
  } else if (kind === 'failed') {
    const reason = details.reason || 'Unknown error'
    content = `Order failed: ${side} ${ticker} in ${fundLabel} for ${dollars}. Reason: ${reason}.`
  } else {
    return
  }

  await sbFetch('/messages', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      class_id: target.classId,
      sender_id: null,
      recipient_type: target.recipientType,
      recipient_id: target.recipientId,
      content
    })
  }).catch(() => {})
}

export default async function handler(req) {
  const auth = req.headers.get('authorization')
  const cronSecret = req.headers.get('x-cron-secret')
  const vercelSecret = auth?.startsWith('Bearer ') ? auth.slice(7) : null

  // Support both standard Vercel auth and custom header
  if (cronSecret !== process.env.CRON_SECRET && vercelSecret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!isMarketOpen()) {
    return new Response(JSON.stringify({ processed: 0, skipped: true, reason: 'market_closed' }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const nowIso = new Date().toISOString()
  // Select orders where attempts < 10 to prevent infinite retries of broken tickers
  const path = `/pending_trade_orders?status=in.(queued,processing)&execute_after=lte.${encodeURIComponent(nowIso)}&attempts=lt.10&select=id,ticker,side,dollars,portfolio_id,user_id,placed_by_user_id,placed_by_role,attempts,portfolios(benchmark_ticker,owner_type,owner_id,fund_name,fund_number)&order=requested_at.asc&limit=100`
  const orders = await sbFetch(path).catch(() => [])

  if (!orders.length) {
    return new Response(JSON.stringify({ processed: 0, queued: 0 }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const tickers = new Set()
  for (const order of orders) {
    if (order.ticker) tickers.add(order.ticker)
    tickers.add(order.portfolios?.benchmark_ticker || 'SPY')
  }

  const quotes = await fetchQuotes([...tickers])
  const results = []
  let skipped = 0

  for (const order of orders) {
    const benchmarkTicker = order.portfolios?.benchmark_ticker || 'SPY'
    const executionPrice = getQueuedExecutionPrice(quotes[order.ticker])
    const benchmarkExecutionPrice = getQueuedExecutionPrice(quotes[benchmarkTicker])

    if (!executionPrice || !benchmarkExecutionPrice) {
      skipped += 1

      // Increment attempts and update execute_after by 5 minutes to move to back of queue
      const nextExecution = new Date(Date.now() + 300000).toISOString()
      const newAttempts = (order.attempts || 0) + 1
      const isPermanentlyFailed = newAttempts >= 10

      await sbFetch(`/pending_trade_orders?id=eq.${order.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          attempts: newAttempts,
          execute_after: nextExecution,
          error_message: 'opening_price_unavailable',
          status: isPermanentlyFailed ? 'failed' : order.status
        })
      }).catch(e => console.error('Failed to update pending order:', order.id, e.message))

      results.push({
        id: order.id,
        success: false,
        skipped: true,
        reason: 'opening_price_unavailable',
        attempts: newAttempts,
        permanently_failed: isPermanentlyFailed
      })
      if (isPermanentlyFailed) {
        await sendOrderNotification(order, 'failed', {
          reason: 'The market opening price was unavailable after multiple retries.'
        })
      }
      continue
    }

    try {
      const data = await sbRpc('execute_pending_trade_order', {
        p_order_id: order.id,
        p_price: executionPrice,
        p_benchmark_price: benchmarkExecutionPrice
      })
      if (data?.trade_id && order.placed_by_user_id && order.placed_by_role) {
        await sbFetch(`/trades?id=eq.${data.trade_id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            placed_by_user_id: order.placed_by_user_id,
            placed_by_role: order.placed_by_role
          })
        }).catch(e => console.error('Failed to annotate trade actor:', data.trade_id, e.message))
      }
      await sendOrderNotification(order, 'executed', {
        executionPrice,
        shares: data?.shares
      })
      results.push({ id: order.id, success: true, status: data?.status || 'executed' })
    } catch (error) {
      await sendOrderNotification(order, 'failed', { reason: error.message })
      results.push({ id: order.id, success: false, error: error.message })
    }
  }

  const summary = {
    processed: results.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success && !r.skipped).length,
    skipped,
    results
  }

  if (skipped > 5 || summary.failed > 0) {
    await notifyAdmin(
      `⚠️ Pending Orders: ${summary.failed} failure(s), ${skipped} skip(s)`,
      JSON.stringify(summary, null, 2)
    )
  }

  return new Response(JSON.stringify(summary), {
    headers: { 'Content-Type': 'application/json' }
  })
}
