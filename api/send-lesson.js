export const config = { runtime: 'edge' }

import { FMP_KEY, sbFetch as _sbFetch } from './_lib/supabase.js'

async function sbFetch(path, options = {}) {
  return _sbFetch(path, options).catch(() => null)
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
        max_tokens: 150
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
        max_tokens: 150
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
        max_tokens: 150
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

  const { owner_id, owner_type, lesson_id } = await req.json()
  if (!owner_id || !['user', 'group'].includes(owner_type)) {
    return new Response(JSON.stringify({ error: 'owner_id and owner_type (user|group) required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Find the portfolio
  const portfolios = await sbFetch(`/portfolios?owner_id=eq.${owner_id}&owner_type=eq.${owner_type}&status=eq.active&select=id,owner_id,owner_type,cash_balance,starting_cash,holdings(ticker,shares)`)
  const portfolio = portfolios?.[0]
  if (!portfolio) {
    return new Response(JSON.stringify({ error: 'No active portfolio found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Get all lessons
  const lessons = await sbFetch('/investment_lessons?select=*')
  if (!lessons?.length) {
    return new Response(JSON.stringify({ error: 'No lessons available' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Pick a lesson — use specific lesson_id if provided, otherwise random by difficulty
  let lesson
  if (lesson_id) {
    lesson = lessons.find(l => l.id === lesson_id)
    if (!lesson) {
      return new Response(JSON.stringify({ error: 'Lesson not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      })
    }
  } else {
    const prefs = await sbFetch(`/user_lesson_preferences?user_id=eq.${owner_id}&select=difficulty`)
    const difficulty = prefs?.[0]?.difficulty || 'basic'
    const sentLessons = await sbFetch(`/sent_lessons?recipient_id=eq.${owner_id}&select=lesson_id`)
    const seenIds = (sentLessons || []).map(s => s.lesson_id)
    const availableLessons = lessons.filter(l => l.difficulty === difficulty && !seenIds.includes(l.id))
    const fallbackLessons = lessons.filter(l => l.difficulty === difficulty)
    lesson = availableLessons.length > 0
      ? availableLessons[Math.floor(Math.random() * availableLessons.length)]
      : fallbackLessons.length > 0
        ? fallbackLessons[Math.floor(Math.random() * fallbackLessons.length)]
        : lessons[Math.floor(Math.random() * lessons.length)]
  }

  // Build AI analysis from portfolio context with live market data
  const tickers = (portfolio.holdings || []).map(h => h.ticker)
  let newsContext = ''
  let priceContext = ''

  if (FMP_KEY && tickers.length > 0) {
    // Fetch recent news with summaries
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

  let analysis = 'Great job managing your portfolio!'
  if (tickers.length > 0) {
    const holdingsStr = portfolio.holdings.map(h => `${h.ticker} (${h.shares} shares)`).join(', ')
    const prompt = `You are "Market Spy AI", a financial coach for high school students.

Portfolio holdings: ${holdingsStr}

${priceContext}

${newsContext}

Based on the above, write ONE sentence that references a specific recent news event or price movement for one of their stocks. Make it educational and encouraging. Speak directly to the student like a mentor. Be specific — mention the stock ticker and what happened. Keep it under 40 words.`
    analysis = await generateAIAnalysis(prompt) || analysis
  }

  // Find class_id
  let classId = null
  if (owner_type === 'group') {
    const group = await sbFetch(`/groups?id=eq.${owner_id}&select=class_id`)
    classId = group?.[0]?.class_id
  } else {
    const membership = await sbFetch(`/class_memberships?user_id=eq.${owner_id}&select=class_id`)
    classId = membership?.[0]?.class_id
  }

  if (!classId) {
    return new Response(JSON.stringify({ error: 'Could not determine class' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Send the message
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
      recipient_type: owner_type,
      recipient_id: owner_id,
      content,
      sender_id: null
    })
  })

  if (!msgRes.ok) {
    const err = await msgRes.text()
    return new Response(JSON.stringify({ error: err }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Track sent lesson
  await fetch(`${SUPABASE_URL}/rest/v1/sent_lessons`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lesson_id: lesson.id, recipient_id: owner_id, recipient_type: owner_type })
  })

  return new Response(JSON.stringify({
    success: true,
    lesson_title: lesson.title,
    lesson_type: lesson.lesson_type,
    difficulty: lesson.difficulty
  }), { headers: { 'Content-Type': 'application/json' } })
}
