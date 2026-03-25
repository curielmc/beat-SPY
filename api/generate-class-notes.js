export const config = { maxDuration: 60 }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, sbFetch as _sbFetch } from './_lib/supabase.js'

const SUPABASE_KEY = SUPABASE_SERVICE_KEY

async function sbFetch(path) {
  return _sbFetch(path).catch(() => null)
}

function getAIConfig(prompt) {
  if (process.env.OPENROUTER_API_KEY) {
    return {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://beat-snp.com',
        'X-Title': 'Beat the S&P 500'
      },
      body: {
        model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        stream: true
      },
      format: 'openai'
    }
  }

  if (process.env.DEEPSEEK_API_KEY) {
    return {
      url: 'https://api.deepseek.com/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        stream: true
      },
      format: 'openai'
    }
  }

  if (process.env.KIMI_API_KEY) {
    return {
      url: 'https://api.moonshot.cn/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.KIMI_API_KEY}`
      },
      body: {
        model: 'moonshot-v1-8k',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        stream: true
      },
      format: 'openai'
    }
  }

  if (process.env.ANTHROPIC_KEY) {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'x-api-key': process.env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: {
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
        stream: true
      },
      format: 'anthropic'
    }
  }

  return null
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

  const token = authHeader.replace('Bearer ', '')
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY }
  })
  if (!userRes.ok) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

  const user = await userRes.json()
  const profile = await sbFetch(`/profiles?id=eq.${user.id}&select=role`)
  const role = profile?.[0]?.role
  if (role !== 'teacher' && role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  }

  const { class_id, date_start, date_end, group_id, custom_instructions } = await req.json()
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

Keep it practical, specific, and reference actual tickers, prices, and group names. Write for a teacher who wants to lead a 10-minute discussion. Use a conversational but informative tone.${custom_instructions ? `\n\n=== ADDITIONAL TEACHER INSTRUCTIONS ===\n${custom_instructions}` : ''}`

  const aiConfig = getAIConfig(prompt)
  if (!aiConfig) {
    return new Response(JSON.stringify({ error: 'No AI provider configured.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Stream the LLM response to avoid Vercel Edge timeout
  const aiRes = await fetch(aiConfig.url, {
    method: 'POST',
    headers: aiConfig.headers,
    body: JSON.stringify(aiConfig.body)
  })

  if (!aiRes.ok) {
    const err = await aiRes.text()
    return new Response(JSON.stringify({ error: 'AI request failed: ' + err }), {
      status: 502, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Transform the upstream SSE stream into a plain text stream
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const readable = new ReadableStream({
    async start(controller) {
      const reader = aiRes.body.getReader()
      let buffer = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              let text = ''
              if (aiConfig.format === 'anthropic') {
                if (parsed.type === 'content_block_delta') {
                  text = parsed.delta?.text || ''
                }
              } else {
                text = parsed.choices?.[0]?.delta?.content || ''
              }
              if (text) {
                controller.enqueue(encoder.encode(text))
              }
            } catch {}
          }
        }
      } catch (err) {
        controller.error(err)
      } finally {
        controller.close()
      }
    }
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Notes-Period': dateLabel,
      'X-Notes-Groups': String(groupSnapshots.length),
      'X-Notes-Tickers': String([...new Set([...(allHoldings || []).map(h => h.ticker), ...(allTrades || []).map(t => t.ticker)])].length)
    }
  })
}
