export const config = { runtime: 'edge' }

const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 20
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

async function requireUser(req) {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return null
  }
  // Simple auth: if they have a Bearer token, assume they're authenticated
  return { id: 'authenticated' }
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (!checkRateLimit(req)) return new Response('Too many requests', { status: 429 })

  const user = await requireUser(req)
  if (!user?.id) return new Response('Unauthorized', { status: 401 })

  const { tickers, changes, portfolioSummary, mode } = await req.json()
  if (!Array.isArray(tickers) || tickers.length === 0 || tickers.length > 25) {
    return new Response(JSON.stringify({ error: 'Invalid tickers payload' }), { status: 400 })
  }
  const FMP_KEY = process.env.VITE_FMP_API_KEY
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY
  
  if (!FMP_KEY || (!OPENROUTER_KEY && !ANTHROPIC_KEY)) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 })
  }

  // Fetch recent news for each ticker in parallel
  const newsResults = await Promise.all(
    tickers.map(ticker =>
      fetch(`https://financialmodelingprep.com/api/v3/stock_news?tickers=${ticker}&limit=4&apikey=${FMP_KEY}`)
        .then(r => r.json())
        .catch(() => [])
    )
  )

  // Build news context string
  let newsContext = ''
  tickers.forEach((ticker, i) => {
    const articles = Array.isArray(newsResults[i]) ? newsResults[i].slice(0, 3) : []
    const chg = changes[ticker]
    newsContext += `\n\n${ticker} (${chg >= 0 ? '+' : ''}${chg?.toFixed(2) ?? '?'}% today):`
    if (articles.length) {
      articles.forEach(a => { newsContext += `\n  • ${a.title}` })
    } else {
      newsContext += `\n  • No recent news found`
    }
  })

  const isSingle = mode === 'stock'
  const prompt = isSingle
    ? `You are a financial educator helping high school students understand investing.

A student owns ${tickers[0]} which moved ${changes[tickers[0]] >= 0 ? 'up' : 'down'} ${Math.abs(changes[tickers[0]] ?? 0).toFixed(2)}% today.

Recent news for ${tickers[0]}:${newsContext}

Write 2-3 clear sentences explaining WHY this stock moved today based on the news. Use plain language a high school student would understand. Be specific. If news is limited, explain what typically drives this type of stock. End with one short investing lesson.`
    : `You are a financial educator helping high school students understand investing.

${portfolioSummary}

Recent news for their holdings:${newsContext}

Write 3-4 engaging sentences explaining what drove today's portfolio performance. Use plain language a high school student would understand. Mention specific stocks and news. Be concrete about what went up and what went down. End with one investing lesson.`

  // AI Call Logic
  let explanation = null
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout (it's a smaller task)

  try {
    if (ANTHROPIC_KEY) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }]
        }),
        signal: controller.signal
      })

      if (response.ok) {
        const data = await response.json()
        explanation = data.content?.[0]?.text
      }
    } else if (OPENROUTER_KEY) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
          'HTTP-Referer': 'https://beat-snp.com',
          'X-Title': 'Beat the S&P 500'
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 400
        }),
        signal: controller.signal
      })

      if (response.ok) {
        const data = await response.json()
        explanation = data.choices?.[0]?.message?.content || explanation
      } else {
        console.error('OpenRouter Error:', await response.text())
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      explanation = 'AI analysis timed out. Please try again.'
    } else {
      console.error('AI Call Error:', err)
    }
  } finally {
    clearTimeout(timeoutId);
  }

  // Fallback if AI failed: use portfolio summary
  if (!explanation) {
    explanation = `Based on the holdings in your portfolio, here's what happened: ${portfolioSummary}. This summary reflects the combined performance of all your positions for the selected period.`
  }

  return new Response(JSON.stringify({ explanation }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
