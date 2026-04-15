export const config = { runtime: 'edge' }

export default async function handler(req) {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY

  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_KEY not configured' }), { status: 500 })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Say ok' }]
      })
    })

    const data = await response.json()
    return new Response(JSON.stringify({
      status: response.status,
      ok: response.ok,
      response: data
    }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}
