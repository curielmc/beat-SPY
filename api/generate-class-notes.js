export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  })
  if (!res.ok) return null
  return res.json()
}

async function generateAIAnalysis(prompt) {
  if (process.env.OPENROUTER_API_KEY) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://beat-snp.com',
        'X-Title': 'Beat the S&P 500'
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000
      })
    })
    const data = await res.json()
    return data.choices?.[0]?.message?.content
  }

  if (process.env.DEEPSEEK_API_KEY) {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000
      })
    })
    const data = await res.json()
    return data.choices?.[0]?.message?.content
  }

  if (process.env.KIMI_API_KEY) {
    const res = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.KIMI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'moonshot-v1-8k',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000
      })
    })
    const data = await res.json()
    return data.choices?.[0]?.message?.content
  }

  if (process.env.ANTHROPIC_KEY) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    const data = await res.json()
    return data.content?.[0]?.text
  }

  return null
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Verify teacher/admin role
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY }
  })
  if (!userRes.ok) return new Response('Unauthorized', { status: 401 })

  const user = await userRes.json()
  const profile = await sbFetch(`/profiles?id=eq.${user.id}&select=role`)
  const role = profile?.[0]?.role
  if (role !== 'teacher' && role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }

  const { class_id, date_start, date_end, group_id } = await req.json()
  if (!class_id) {
    return new Response(JSON.stringify({ error: 'class_id required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  const endDate = date_end || new Date().toISOString()
  const startDate = date_start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch groups and memberships in parallel
  let groupsQuery = `/groups?class_id=eq.${class_id}&select=id,name`
  if (group_id) groupsQuery += `&id=eq.${group_id}`

  const [groups, memberships] = await Promise.all([
    sbFetch(groupsQuery),
    sbFetch(`/class_memberships?class_id=eq.${class_id}&select=user_id,group_id,profiles:profiles(full_name)`)
  ])

  if (!groups?.length) {
    return new Response(JSON.stringify({ error: 'No groups found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Batch fetch all portfolios, holdings, and trades
  const groupIds = groups.map(g => g.id)
  const portfolios = await sbFetch(`/portfolios?owner_type=eq.group&owner_id=in.(${groupIds.join(',')})&status=eq.active&select=id,owner_id,cash_balance,starting_cash`)

  const portfolioIds = (portfolios || []).map(p => p.id)
  const [allHoldings, allTrades] = portfolioIds.length > 0 ? await Promise.all([
    sbFetch(`/holdings?portfolio_id=in.(${portfolioIds.join(',')})&select=portfolio_id,ticker,shares,avg_cost`),
    sbFetch(`/trades?portfolio_id=in.(${portfolioIds.join(',')})&executed_at=gte.${startDate}&executed_at=lte.${endDate}&select=portfolio_id,ticker,side,shares,dollars,price,executed_at,user_id&order=executed_at.desc`)
  ]) : [[], []]

  // Build a simple snapshot per group
  const groupSnapshots = groups.map(group => {
    const p = (portfolios || []).find(p => p.owner_id === group.id)
    if (!p) return null

    const holdings = (allHoldings || []).filter(h => h.portfolio_id === p.id)
    const trades = (allTrades || []).filter(t => t.portfolio_id === p.id)
    const members = (memberships || [])
      .filter(m => m.group_id === group.id)
      .map(m => m.profiles?.full_name || 'Unknown')

    const holdingsValue = holdings.reduce((sum, h) => sum + (h.shares * h.avg_cost), 0)
    const totalValue = holdingsValue + p.cash_balance
    const returnPct = ((totalValue - p.starting_cash) / p.starting_cash) * 100

    const holdingsText = holdings.length > 0
      ? holdings.map(h => `${h.ticker}: ${h.shares} shares, avg cost $${h.avg_cost.toFixed(2)}`).join('\n    ')
      : 'No holdings'

    const tradesText = trades.length > 0
      ? trades.slice(0, 10).map(t => {
          const date = new Date(t.executed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          return `${date}: ${t.side.toUpperCase()} ${t.ticker} — ${t.shares} shares @ $${t.price.toFixed(2)} ($${t.dollars.toFixed(0)})`
        }).join('\n    ')
      : 'No trades this period'

    return `${group.name} (Members: ${members.join(', ')})
   Portfolio: $${totalValue.toFixed(0)} | Return: ${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}% | Cash: $${p.cash_balance.toFixed(0)}
   Holdings:
    ${holdingsText}
   Trades (${trades.length} in period):
    ${tradesText}`
  }).filter(Boolean)

  const dateLabel = `${new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  const prompt = `You are "Market Spy AI", a financial education assistant for a high school investing class.

Generate class discussion notes for the teacher based on the data below. The teacher will use these to lead an engaging class discussion.

Period: ${dateLabel}
${group_id ? 'Focused on one group.' : `${groupSnapshots.length} groups in the class.`}

=== GROUP SNAPSHOTS (ranked by return) ===
${groupSnapshots.join('\n\n')}

=== INSTRUCTIONS ===
Write structured class notes in markdown with these sections:

1. **Leaderboard Recap** — Quick ranking with returns. Who's winning and why? Who fell behind?

2. **Smart Moves** — Highlight specific trades that were well-timed or strategic. Name the group and what they did.

3. **Watch Out** — Any risky positions, over-concentration, or missed opportunities? Be constructive.

4. **Discussion Questions** — 3-4 thought-provoking questions the teacher can ask the class based on what's happening in their portfolios.

5. **Teaching Moment** — One key investing concept illustrated by something happening in their portfolios right now. Make it concrete with a real example from the data.

Keep it practical, specific, and reference actual tickers, prices, and group names. Write for a teacher who wants to lead a 10-minute discussion. Use a conversational but informative tone.`

  const notes = await generateAIAnalysis(prompt)

  if (!notes) {
    return new Response(JSON.stringify({ error: 'AI generation failed. Check API keys.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({
    notes,
    period: dateLabel,
    groups_analyzed: groupSnapshots.length,
    tickers_tracked: [...new Set([...(allHoldings || []).map(h => h.ticker), ...(allTrades || []).map(t => t.ticker)])].length
  }), { headers: { 'Content-Type': 'application/json' } })
}
