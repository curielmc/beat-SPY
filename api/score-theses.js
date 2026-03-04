export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const { groups, individualTrades } = await req.json()
  const apiKey = process.env.ANTHROPIC_KEY

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'No API key configured' }), { status: 500 })
  }

  const callClaude = async (prompt) => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    const data = await response.json()
    return data.content?.[0]?.text || '[]'
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
    const [fundText, stockText] = await Promise.all([
      groupSummaries ? callClaude(fundPrompt) : Promise.resolve('[]'),
      tradeSummaries ? callClaude(stockPrompt) : Promise.resolve('[]')
    ])

    const fundScores = JSON.parse(fundText)
    const stockScores = JSON.parse(stockText)

    return new Response(JSON.stringify({ fundScores, stockScores }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to parse AI response: ' + e.message }), { status: 500 })
  }
}
