export const config = { runtime: 'edge' }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, FMP_KEY, sbFetch as _sbFetch } from './_lib/supabase.js'

const SUPABASE_KEY = SUPABASE_SERVICE_KEY

async function sbFetch(path, options = {}) {
  return _sbFetch(path, options).catch(() => null)
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
        max_tokens: 320
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
        max_tokens: 320
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
        max_tokens: 320
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
        max_tokens: 320,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    const data = await res.json()
    return data.content?.[0]?.text
  }

  return null
}

export default async function handler(req) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const legacySecret = req.headers.get('x-cron-secret')
  const authorized = !!cronSecret && (
    authHeader === `Bearer ${cronSecret}` ||
    legacySecret === cronSecret
  )

  if (!authorized) {
    return new Response('Unauthorized', { status: 401 })
  }

  const portfolios = await sbFetch('/portfolios?status=eq.active&select=id,owner_id,owner_type,cash_balance,starting_cash,holdings(ticker,shares)')
  if (!portfolios) return new Response('No portfolios found', { status: 200 })

  const lessons = await sbFetch('/investment_lessons?select=*')
  let results = { processed: 0, messagesSent: 0, errors: [] }

  // Window for the 30-day comparison
  const windowEndDate = new Date()
  const windowStart = new Date(windowEndDate)
  windowStart.setUTCDate(windowStart.getUTCDate() - 30)
  const windowStartIso = windowStart.toISOString()
  const windowStartDateStr = windowStartIso.split('T')[0]

  // SPY return over last 30 days (one fetch shared across all portfolios)
  let spyReturnPct = null
  if (FMP_KEY) {
    const to = windowEndDate.toISOString().split('T')[0]
    const from = new Date(windowStart); from.setUTCDate(from.getUTCDate() - 5)
    const fromStr = from.toISOString().split('T')[0]
    const [histRes, quoteRes] = await Promise.all([
      fetch(`https://financialmodelingprep.com/api/v3/historical-price-full/SPY?from=${fromStr}&to=${to}&apikey=${FMP_KEY}`).then(r => r.json()).catch(() => null),
      fetch(`https://financialmodelingprep.com/api/v3/quote/SPY?apikey=${FMP_KEY}`).then(r => r.json()).catch(() => null)
    ])
    const rows = histRes?.historical || []
    let spyStart = null
    for (const row of rows) {
      if (row?.date && row.date <= windowStartDateStr && row.close) { spyStart = row.close; break }
    }
    const spyNow = quoteRes?.[0]?.price
    if (spyStart && spyNow) spyReturnPct = ((spyNow - spyStart) / spyStart) * 100
  }

  for (const portfolio of portfolios) {
    try {
      if (!portfolio.holdings || portfolio.holdings.length === 0) continue

      // Get context for the AI with live market data
      const tickers = portfolio.holdings.map(h => h.ticker)
      let newsContext = ''
      let priceContext = ''
      let quotes = []

      if (FMP_KEY && tickers.length > 0) {
        const [news, quotesRes] = await Promise.all([
          fetch(`https://financialmodelingprep.com/api/v3/stock_news?tickers=${tickers.join(',')}&limit=5&apikey=${FMP_KEY}`).then(r => r.json()).catch(() => []),
          fetch(`https://financialmodelingprep.com/api/v3/quote/${tickers.join(',')}?apikey=${FMP_KEY}`).then(r => r.json()).catch(() => [])
        ])
        quotes = quotesRes || []

        if (news?.length > 0) {
          newsContext = 'Recent headlines:\n' + news.slice(0, 5).map(n =>
            `- ${n.symbol}: "${n.title}"${n.text ? ' — ' + n.text.slice(0, 120) : ''}`
          ).join('\n')
        }

        if (quotes.length > 0) {
          priceContext = 'Today\'s prices:\n' + quotes.map(q =>
            `- ${q.symbol}: $${q.price} (${q.changesPercentage >= 0 ? '+' : ''}${q.changesPercentage?.toFixed(2)}% today)`
          ).join('\n')
        }
      }

      // 30-day portfolio vs SPY performance
      const priceMap = Object.fromEntries(quotes.map(q => [q.symbol, q.price]))
      const cash = Number(portfolio.cash_balance || 0)
      let currentValue = cash
      for (const h of portfolio.holdings) {
        const px = priceMap[h.ticker]
        if (px) currentValue += Number(h.shares || 0) * px
      }

      const startSnaps = await sbFetch(`/portfolio_snapshots?portfolio_id=eq.${portfolio.id}&snapshot_type=eq.daily&snapshotted_at=lte.${windowStartIso}&select=total_value,snapshotted_at&order=snapshotted_at.desc&limit=1`)
      const startValue = Number(startSnaps?.[0]?.total_value || portfolio.starting_cash || 100000)
      const portfolioReturnPct = startValue > 0 ? ((currentValue - startValue) / startValue) * 100 : 0
      const vsSpy = spyReturnPct == null ? null : (portfolioReturnPct - spyReturnPct)

      // Top winner over the last month: best 30d-change among holdings (proxied by today's % since we lack per-ticker 30d here without extra calls)
      const topMover = quotes.slice().sort((a,b) => (b.changesPercentage||0) - (a.changesPercentage||0))[0]
      const monthContext = `30-day performance:
- Your portfolio: ${portfolioReturnPct >= 0 ? '+' : ''}${portfolioReturnPct.toFixed(2)}%
- S&P 500 (SPY): ${spyReturnPct == null ? 'n/a' : (spyReturnPct >= 0 ? '+' : '') + spyReturnPct.toFixed(2) + '%'}
${vsSpy == null ? '' : `- vs S&P: ${vsSpy >= 0 ? '+' : ''}${vsSpy.toFixed(2)}% (${vsSpy >= 0 ? 'beating' : 'trailing'} the benchmark)`}`

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
      const prompt = `You are "Market Spy AI", a monthly financial coach for high school students.

Portfolio holdings: ${holdingsStr}

${priceContext}

${newsContext}

${monthContext}

Write a short monthly update with THREE parts, each 1-2 sentences, in this order:
1. **Today**: What stands out in today's prices — call out the biggest mover by name and % (e.g., "${topMover ? topMover.symbol + ' is ' + (topMover.changesPercentage >= 0 ? 'up' : 'down') + ' ' + Math.abs(topMover.changesPercentage).toFixed(2) + '% today' : 'a notable mover'}").
2. **What worked & why**: Name the stock that helped most this past month and explain WHY (use the headlines or a sector/market trend if no specific news).
3. **vs. the S&P 500**: State the 30-day portfolio return, the SPY return, and whether they're beating or trailing the benchmark — tie it to their stock picks in one line.

Use a professional but accessible tone for a teenager. Keep the whole thing under ~120 words.`

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
