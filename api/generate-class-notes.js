export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const FMP_KEY = process.env.VITE_FMP_API_KEY

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

  // Default date range: last 7 days
  const endDate = date_end || new Date().toISOString()
  const startDate = date_start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Get groups for the class
  let groupsQuery = `/groups?class_id=eq.${class_id}&select=id,name`
  if (group_id) groupsQuery += `&id=eq.${group_id}`
  const groups = await sbFetch(groupsQuery)
  if (!groups?.length) {
    return new Response(JSON.stringify({ error: 'No groups found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Get class memberships for member names
  const memberships = await sbFetch(`/class_memberships?class_id=eq.${class_id}&select=user_id,group_id,profiles:profiles(full_name)`)

  // Build portfolio data for each group
  const groupData = []
  const allTickers = new Set()

  for (const group of groups) {
    const portfolio = await sbFetch(`/portfolios?owner_type=eq.group&owner_id=eq.${group.id}&status=eq.active&select=id,cash_balance,starting_cash`)
    const p = portfolio?.[0]
    if (!p) continue

    const holdings = await sbFetch(`/holdings?portfolio_id=eq.${p.id}&select=ticker,shares,avg_cost`)
    const trades = await sbFetch(`/trades?portfolio_id=eq.${p.id}&executed_at=gte.${startDate}&executed_at=lte.${endDate}&select=ticker,side,shares,dollars,price,executed_at,user_id&order=executed_at.desc`)

    const members = (memberships || [])
      .filter(m => m.group_id === group.id)
      .map(m => m.profiles?.full_name || 'Unknown')

    for (const h of (holdings || [])) allTickers.add(h.ticker)
    for (const t of (trades || [])) allTickers.add(t.ticker)

    groupData.push({
      name: group.name,
      members,
      startingCash: p.starting_cash,
      cashBalance: p.cash_balance,
      holdings: holdings || [],
      trades: trades || []
    })
  }

  // Fetch live market data for all tickers
  const tickerList = [...allTickers]
  let quotesMap = {}
  let newsItems = []

  if (FMP_KEY && tickerList.length > 0) {
    const [quotes, news] = await Promise.all([
      fetch(`https://financialmodelingprep.com/api/v3/quote/${tickerList.join(',')}?apikey=${FMP_KEY}`).then(r => r.json()).catch(() => []),
      fetch(`https://financialmodelingprep.com/api/v3/stock_news?tickers=${tickerList.join(',')}&limit=15&apikey=${FMP_KEY}`).then(r => r.json()).catch(() => [])
    ])

    for (const q of (quotes || [])) {
      quotesMap[q.symbol] = q
    }
    newsItems = news || []
  }

  // Calculate portfolio values and returns
  const groupSummaries = groupData.map(g => {
    const holdingsValue = g.holdings.reduce((sum, h) => {
      const price = quotesMap[h.ticker]?.price || h.avg_cost
      return sum + (h.shares * price)
    }, 0)
    const totalValue = holdingsValue + g.cashBalance
    const returnPct = ((totalValue - g.startingCash) / g.startingCash) * 100

    const holdingDetails = g.holdings.map(h => {
      const q = quotesMap[h.ticker]
      const price = q?.price || h.avg_cost
      const marketValue = h.shares * price
      const costBasis = h.shares * h.avg_cost
      const gainPct = costBasis > 0 ? ((marketValue - costBasis) / costBasis) * 100 : 0
      return `${h.ticker}: ${h.shares} shares @ $${price.toFixed(2)} (${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)}%), ${q?.changesPercentage != null ? 'today ' + (q.changesPercentage >= 0 ? '+' : '') + q.changesPercentage.toFixed(2) + '%' : ''}`
    }).join('\n    ')

    const tradeDetails = g.trades.slice(0, 10).map(t => {
      const date = new Date(t.executed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return `${date}: ${t.side.toUpperCase()} ${t.ticker} — ${t.shares} shares @ $${t.price.toFixed(2)} ($${t.dollars.toFixed(0)})`
    }).join('\n    ')

    return {
      name: g.name,
      members: g.members.join(', '),
      totalValue: totalValue.toFixed(2),
      returnPct: returnPct.toFixed(2),
      cashBalance: g.cashBalance.toFixed(2),
      holdingDetails: holdingDetails || 'No holdings',
      tradeDetails: tradeDetails || 'No trades in this period',
      tradeCount: g.trades.length
    }
  }).sort((a, b) => parseFloat(b.returnPct) - parseFloat(a.returnPct))

  // Format news
  const newsContext = newsItems.length > 0
    ? newsItems.slice(0, 10).map(n =>
        `- ${n.symbol}: "${n.title}" (${new Date(n.publishedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})${n.text ? '\n  ' + n.text.slice(0, 150) : ''}`
      ).join('\n')
    : 'No recent news found for these stocks.'

  // Format group summaries for the prompt
  const groupsText = groupSummaries.map((g, i) => `
  ${i + 1}. ${g.name} (Members: ${g.members})
     Portfolio Value: $${Number(g.totalValue).toLocaleString()} | Return: ${g.returnPct}% | Cash: $${Number(g.cashBalance).toLocaleString()}
     Holdings:
    ${g.holdingDetails}
     Recent Trades (${g.tradeCount} in period):
    ${g.tradeDetails}`).join('\n')

  const dateLabel = `${new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  const prompt = `You are "Market Spy AI", a financial education assistant for a high school investing class.

Generate class discussion notes for the teacher based on the data below. The teacher will use these to lead an engaging class discussion.

Period: ${dateLabel}
${group_id ? 'Focused on one group.' : `${groupSummaries.length} groups in the class.`}

=== PORTFOLIO STANDINGS (ranked by return) ===
${groupsText}

=== RELEVANT NEWS FOR THEIR STOCKS ===
${newsContext}

=== INSTRUCTIONS ===
Write structured class notes in markdown with these sections:

1. **🏆 Leaderboard Recap** — Quick ranking with returns. Who's winning and why? Who fell behind?

2. **📈 Market Movers** — What happened in the market this period that affected their stocks? Reference specific news items and price movements.

3. **🔥 Smart Moves** — Highlight specific trades that were well-timed or strategic. Name the group and what they did.

4. **⚠️ Watch Out** — Any risky positions, over-concentration, or missed opportunities? Be constructive.

5. **💡 Discussion Questions** — 3-4 thought-provoking questions the teacher can ask the class based on what's happening in their portfolios and the market.

6. **📚 Teaching Moment** — One key investing concept illustrated by something happening in their portfolios right now. Make it concrete with a real example from the data.

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
    groups_analyzed: groupSummaries.length,
    tickers_tracked: tickerList.length
  }), { headers: { 'Content-Type': 'application/json' } })
}
