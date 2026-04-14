export const config = { runtime: 'edge' }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, sbFetch } from './_lib/supabase.js'

const SUPABASE_KEY = SUPABASE_SERVICE_KEY

function encodeIn(values) {
  return values.map(v => encodeURIComponent(String(v))).join(',')
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY
    }
  })
  if (!userRes.ok) return new Response('Unauthorized', { status: 401 })

  const user = await userRes.json()
  const profile = await sbFetch(`/profiles?id=eq.${user.id}&select=role`)
  const role = profile?.[0]?.role
  if (role !== 'teacher' && role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }

  const { group_ids: rawGroupIds, class_id: classId } = await req.json().catch(() => ({}))
  const groupIds = Array.isArray(rawGroupIds)
    ? rawGroupIds.map(String).filter(Boolean)
    : []

  if (!groupIds.length || !classId) {
    return new Response(JSON.stringify({
      portfolios: [],
      user_portfolios: [],
      holdings: [],
      trades: [],
      memberships: []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const groupIdFilter = encodeIn(groupIds)
    const portfolios = await sbFetch(
      `/portfolios?owner_type=eq.group&owner_id=in.(${groupIdFilter})&and=(or(hidden.eq.false,hidden.is.null),or(status.eq.active,status.is.null))&select=*`
    )

    const memberships = await sbFetch(
      `/class_memberships?class_id=eq.${classId}&select=user_id,group_id`
    )
    const userIds = [...new Set((memberships || []).map(m => m.user_id).filter(Boolean))]

    let userPortfolios = []
    if (userIds.length) {
      const userIdFilter = encodeIn(userIds)
      userPortfolios = await sbFetch(
        `/portfolios?owner_type=eq.user&owner_id=in.(${userIdFilter})&or=(status.eq.active,status.is.null)&select=*`
      )
    }

    const portfolioIds = [
      ...(portfolios || []).map(p => p.id).filter(Boolean),
      ...(userPortfolios || []).map(p => p.id).filter(Boolean)
    ]

    let holdings = []
    let trades = []
    if (portfolioIds.length) {
      const portfolioIdFilter = encodeIn(portfolioIds)
      ;[holdings, trades] = await Promise.all([
        sbFetch(`/holdings?portfolio_id=in.(${portfolioIdFilter})&select=*`),
        sbFetch(`/trades?portfolio_id=in.(${portfolioIdFilter})&select=portfolio_id,ticker,side,dollars,shares,price,executed_at&order=executed_at.desc`)
      ])
    }

    return new Response(JSON.stringify({
      portfolios: portfolios || [],
      user_portfolios: userPortfolios || [],
      holdings: holdings || [],
      trades: trades || [],
      memberships: memberships || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message || 'Failed to load teacher dashboard data'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
