export const config = { runtime: 'edge' }

const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 10
const requestLog = new Map()

function getClientIp(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

function checkRateLimit(req) {
  const now = Date.now()
  const key = getClientIp(req)
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  const entries = (requestLog.get(key) || []).filter(ts => ts > windowStart)
  if (entries.length >= RATE_LIMIT_MAX) return false
  entries.push(now)
  requestLog.set(key, entries)
  return true
}

async function requireTeacherOrAdmin(req) {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: authHeader
    }
  })
  if (!userRes.ok) return null
  const user = await userRes.json()
  if (!user?.id) return null

  const roleRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=role`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: authHeader
    }
  })
  if (!roleRes.ok) return null
  const rows = await roleRes.json()
  const role = rows?.[0]?.role
  return role === 'teacher' || role === 'admin' ? user : null
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }
  if (!checkRateLimit(req)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })
  }

  const user = await requireTeacherOrAdmin(req)
  if (!user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const { groups, individualTrades } = await req.json()

  const callAI = async (prompt) => {
    // OpenRouter Support
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
          max_tokens: 2048
        })
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error('OpenRouter API Error:', errData)
        throw new Error(`AI provider error: ${res.status} ${errData?.error?.message || ''}`)
      }
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content || '[]'
      const cleaned = text.replace(/```json\n?|```\n?/g, '').trim()
      try {
        return JSON.parse(cleaned)
      } catch (e) {
        console.error('JSON Parse Error for AI output:', cleaned)
        throw new Error('AI returned invalid JSON: ' + e.message)
      }
    }

    // Anthropic Fallback
    const apiKey = process.env.ANTHROPIC_KEY
    if (apiKey) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        console.error('Anthropic API Error:', errData)
        throw new Error(`AI provider error: ${response.status} ${errData?.error?.message || ''}`)
      }
      const data = await response.json()
      const text = data.content?.[0]?.text || '[]'
      const cleaned = text.replace(/```json\n?|```\n?/g, '').trim()
      try {
        return JSON.parse(cleaned)
      } catch (e) {
        console.error('JSON Parse Error for Claude output:', cleaned)
        throw new Error('Claude returned invalid JSON: ' + e.message)
      }
    }

    throw new Error('No AI provider configured')
  }

  // ── 1. Fund-level scoring ──
  const groupSummaries = (groups || []).map(g => {
    const tradeLines = (g.trades || [])
      .filter(t => t.rationale)
      .map(t => `  - ${t.side === 'buy' ? 'Bought' : 'Sold'} ${t.ticker}: "${t.rationale}"`)
      .join('\n')
    return `**${g.name}**
Fund Thesis: ${g.fund_thesis || '(none provided)'}
Trade Rationales:
${tradeLines || '  (no rationales provided)'}`
  }).join('\n\n---\n\n')

  const fundPrompt = `You are evaluating high school student investment fund theses for an educational stock competition.

Score each group's OVERALL FUND THESIS and trade rationales (1-10):
- clarity: Is it clearly written and easy to understand?
- specificity: Do they mention specific reasons, data, or metrics?
- reasoning: Is the investment logic sound and fundamentals-based?

Return raw JSON array only (no markdown):
[{ "group": "Group Name", "clarity": 7, "specificity": 5, "reasoning": 8, "overall": 6.7, "feedback": "One sentence of constructive feedback." }]

Groups:
${groupSummaries}`

  // ── 2. Individual stock pick scoring ──
  const tradeSummaries = (individualTrades || [])
    .filter(t => t.rationale && t.rationale.trim().length > 2)
    .map(t => `ID:${t.id} | ${t.group} | ${t.ticker} ($${Number(t.dollars).toLocaleString()}): "${t.rationale}"`)
    .join('\n')

  const stockPrompt = `You are evaluating high school student investment rationales for individual stock picks in an educational competition.

For each trade below, score the SPECIFIC STOCK RATIONALE (1-10):
- insight: Does it show real understanding of the company or industry?
- specificity: Is there a specific catalyst, metric, or fact mentioned?
- conviction: Does the reasoning show genuine conviction and research?

Identify the TOP 5 best individual stock rationales. Return raw JSON array only (no markdown):
[{ "id": "trade-id", "group": "Group Name", "ticker": "AAPL", "rationale": "their exact rationale", "insight": 8, "specificity": 7, "conviction": 9, "overall": 8.0, "badge": "🏆 Best Pick" or "⭐ Most Specific" or "💡 Best Insight" or "🔥 Most Conviction" or "📊 Best Research" }]

Only return the top 5. Assign a unique badge to each.

Trades:
${tradeSummaries}`

  try {
    const [fundScores, stockScores] = await Promise.all([
      groupSummaries ? callAI(fundPrompt) : Promise.resolve([]),
      tradeSummaries ? callAI(stockPrompt) : Promise.resolve([])
    ])

    return new Response(JSON.stringify({ fundScores, stockScores }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e) {
    console.error('AI Analysis failed:', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
