export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const FMP_KEY = process.env.VITE_FMP_API_KEY

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  })
  if (!res.ok) return null
  return res.json()
}

async function generateAIAnalysis(prompt) {
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
        max_tokens: 150
      })
    })
    const data = await res.json()
    return data.choices?.[0]?.message?.content
  }

  // DeepSeek Support (Direct)
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
        max_tokens: 150
      })
    })
    const data = await res.json()
    return data.choices?.[0]?.message?.content
  }

  // Kimi (Moonshot) Support
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
        max_tokens: 150
      })
    })
    const data = await res.json()
    return data.choices?.[0]?.message?.content
  }

  // Anthropic Default
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
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    const data = await res.json()
    return data.content?.[0]?.text
  }

  return null
}

export default async function handler(req) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const portfolios = await sbFetch('/portfolios?status=eq.active&select=id,owner_id,owner_type,cash_balance,starting_cash,holdings(ticker,shares)')
  if (!portfolios) return new Response('No portfolios found', { status: 200 })

  const lessons = await sbFetch('/investment_lessons?select=*')
  let results = { processed: 0, messagesSent: 0, errors: [] }

  for (const portfolio of portfolios) {
    try {
      if (!portfolio.holdings || portfolio.holdings.length === 0) continue

      // Get context for the AI with live market data
      const tickers = portfolio.holdings.map(h => h.ticker)
      let newsContext = ''
      let priceContext = ''

      if (FMP_KEY && tickers.length > 0) {
        const [news, quotes] = await Promise.all([
          fetch(`https://financialmodelingprep.com/api/v3/stock_news?tickers=${tickers.join(',')}&limit=5&apikey=${FMP_KEY}`).then(r => r.json()).catch(() => []),
          fetch(`https://financialmodelingprep.com/api/v3/quote/${tickers.join(',')}?apikey=${FMP_KEY}`).then(r => r.json()).catch(() => [])
        ])

        if (news?.length > 0) {
          newsContext = 'Recent headlines:\n' + news.slice(0, 5).map(n =>
            `- ${n.symbol}: "${n.title}"${n.text ? ' — ' + n.text.slice(0, 120) : ''}`
          ).join('\n')
        }

        if (quotes?.length > 0) {
          priceContext = 'Current performance:\n' + quotes.map(q =>
            `- ${q.symbol}: $${q.price} (${q.changesPercentage >= 0 ? '+' : ''}${q.changesPercentage?.toFixed(2)}% today, ${q.yearHigh ? 'Year high: $' + q.yearHigh : ''})`
          ).join('\n')
        }
      }

      // Get student's preferred difficulty level
      const prefs = await sbFetch(`/user_lesson_preferences?user_id=eq.${portfolio.owner_id}&select=difficulty`)
      const difficulty = prefs?.[0]?.difficulty || 'basic'

      const sentLessons = await sbFetch(`/sent_lessons?recipient_id=eq.${portfolio.owner_id}&select=lesson_id`)
      const seenIds = (sentLessons || []).map(s => s.lesson_id)
      const availableLessons = lessons.filter(l => l.difficulty === difficulty && !seenIds.includes(l.id))
      const fallbackLessons = lessons.filter(l => l.difficulty === difficulty)
      const lesson = availableLessons.length > 0
        ? availableLessons[Math.floor(Math.random() * availableLessons.length)]
        : fallbackLessons.length > 0
          ? fallbackLessons[Math.floor(Math.random() * fallbackLessons.length)]
          : lessons[Math.floor(Math.random() * lessons.length)]

      const holdingsStr = portfolio.holdings.map(h => `${h.ticker} (${h.shares} shares)`).join(', ')
      const prompt = `You are "Market Spy AI", a financial coach for high school students.

Portfolio holdings: ${holdingsStr}

${priceContext}

${newsContext}

Based on the above, explain specifically WHAT happened with their stocks this week. 
Identify 1-2 key stocks that moved and explain WHY they moved (e.g., "VRTX surged over 8% today because of positive data for their new kidney disease drug"). 
If there is no specific news for their stocks, explain a broader market or sector trend that affected their portfolio value. 
Use a professional but accessible tone for a teenager. Keep it to 2-3 concise, timely sentences.`

      const analysis = await generateAIAnalysis(prompt) || "Great job managing your portfolio this week!"

      let classId = null
      if (portfolio.owner_type === 'group') {
        const group = await sbFetch(`/groups?id=eq.${portfolio.owner_id}&select=class_id`)
        classId = group?.[0]?.class_id
      } else {
        const membership = await sbFetch(`/class_memberships?user_id=eq.${portfolio.owner_id}&select=class_id`)
        classId = membership?.[0]?.class_id
      }

      if (classId) {
        const content = `${analysis}\n\n💡 **Quick Insight: ${lesson.title}**\n${lesson.content}`
        
        const msgRes = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            class_id: classId,
            recipient_type: portfolio.owner_type,
            recipient_id: portfolio.owner_id,
            content: content,
            sender_id: null
          })
        })

        if (msgRes.ok) {
          results.messagesSent++
          await fetch(`${SUPABASE_URL}/rest/v1/sent_lessons`, {
            method: 'POST',
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ lesson_id: lesson.id, recipient_id: portfolio.owner_id, recipient_type: portfolio.owner_type })
          })
        }
      }

      results.processed++
    } catch (err) {
      results.errors.push({ id: portfolio.id, error: err.message })
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' }
  })
}
