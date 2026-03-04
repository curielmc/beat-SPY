export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const { tickers, changes, portfolioSummary, mode } = await req.json()
  const FMP_KEY = process.env.VITE_FMP_API_KEY
  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY

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

  // Call Anthropic API directly via fetch (Edge-compatible)
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  const data = await response.json()
  const explanation = data.content?.[0]?.text || 'Could not generate explanation.'

  return new Response(JSON.stringify({ explanation }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
