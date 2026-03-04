export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const { groups } = await req.json()
  const apiKey = process.env.ANTHROPIC_KEY

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'No API key configured' }), { status: 500 })
  }

  // Build prompt
  const groupSummaries = groups.map(g => {
    const tradeLines = (g.trades || [])
      .filter(t => t.rationale)
      .map(t => `  - ${t.side === 'buy' ? 'Bought' : 'Sold'} ${t.ticker}: "${t.rationale}"`)
      .join('\n')
    return `**${g.name}**
Fund Thesis: ${g.fund_thesis || '(none provided)'}
Trade Rationales:
${tradeLines || '  (no rationales provided)'}`
  }).join('\n\n---\n\n')

  const prompt = `You are evaluating high school student investment portfolios for an educational stock market competition.

For each group below, score their investment thesis and trade rationales on a scale of 1-10 for:
- **Clarity** (is it clearly written and easy to understand?)
- **Specificity** (do they mention specific reasons, data, or metrics?)
- **Reasoning** (is the investment logic sound and fundamentals-based?)

Return a JSON array with this exact format (no markdown, just raw JSON):
[
  {
    "group": "Group Name",
    "clarity": 7,
    "specificity": 5,
    "reasoning": 8,
    "overall": 6.7,
    "feedback": "One sentence of constructive feedback."
  }
]

Here are the groups:

${groupSummaries}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  const data = await response.json()
  const text = data.content?.[0]?.text || '[]'

  try {
    const scores = JSON.parse(text)
    return new Response(JSON.stringify({ scores }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: text }), { status: 500 })
  }
}
