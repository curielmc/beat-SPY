export const config = { runtime: 'edge' }

export default async function handler(req) {
  const FMP_KEY = process.env.VITE_FMP_API_KEY
  const url = new URL(req.url)
  const ticker = url.searchParams.get('ticker') || 'SPY'
  const from = url.searchParams.get('from') || '2026-04-16'
  const to = url.searchParams.get('to') || '2026-04-21'

  if (!FMP_KEY) {
    return new Response(JSON.stringify({ error: 'FMP key missing' }), { status: 500 })
  }

  const fmpUrl = `https://financialmodelingprep.com/api/v3/historical-price-full/${ticker}?serietype=line&from=${from}&to=${to}&apikey=${FMP_KEY}`
  const res = await fetch(fmpUrl)
  const text = await res.text()

  return new Response(JSON.stringify({
    status: res.status,
    ok: res.ok,
    contentType: res.headers.get('content-type'),
    bodyLength: text.length,
    bodyPreview: text.slice(0, 500),
    urlSent: fmpUrl.replace(FMP_KEY, 'REDACTED')
  }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
