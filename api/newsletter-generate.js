export const config = { runtime: 'edge' }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, sbFetch, jsonResponse, FMP_KEY } from './_lib/supabase.js'
import { computeLeaderboard } from './_lib/leaderboard.js'
import { generateAIAnalysis } from './_lib/ai.js'

// Label used everywhere we reference the benchmark: SPY is the tradable ETF the
// class actually competes against; "(proxy for S&P 500)" explains what it tracks.
const SPY_LABEL = 'SPY (proxy for S&P 500)'

function daysAgoIso(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

const FMP_BASE = 'https://financialmodelingprep.com/api/v3'
const FMP_BASE_V4 = 'https://financialmodelingprep.com/api/v4'

// Pull recent real market headlines so the AI intro can ground its "what drove
// the market" sentences in actual news instead of inventing it. Best-effort:
// returns [] on any failure, and the prompt degrades to generic macro language.
async function fetchMarketHeadlines(limit = 12) {
  if (!FMP_KEY) return []
  const urls = [
    `${FMP_BASE}/stock_news?tickers=SPY,QQQ,NVDA,MSFT&limit=${limit}&apikey=${FMP_KEY}`,
    `${FMP_BASE_V4}/general_news?page=0&apikey=${FMP_KEY}`
  ]
  const titles = []
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const rows = await res.json().catch(() => [])
      for (const r of (Array.isArray(rows) ? rows : [])) {
        if (r?.title) titles.push(String(r.title).trim())
      }
    } catch { /* ignore — headlines are optional grounding */ }
  }
  // De-dupe, drop obvious clickbait/personal-finance noise, cap the list.
  const seen = new Set()
  const cleaned = []
  for (const t of titles) {
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    if (/retire|i'm \d|my \$|sports car|yield.*night/i.test(t)) continue
    seen.add(key)
    cleaned.push(t)
    if (cleaned.length >= 10) break
  }
  return cleaned
}

function topList(arr, n, fmt) {
  return [...(arr || [])].slice(0, n).map(fmt).join('\n')
}

function buildIntroPrompt({ className, oneMonth, threeMonth, headlines }) {
  const fundFmt = f => `- ${f.fundName} (${f.groupName}): ${f.returnPct >= 0 ? '+' : ''}${f.returnPct}%`
  const groupFmt = g => `- ${g.name}: ${g.returnPct >= 0 ? '+' : ''}${g.returnPct}%`
  const indFmt = s => `- ${s.name}: ${s.returnPct >= 0 ? '+' : ''}${s.returnPct}%`

  const monthBeat = oneMonth.groups.filter(g => g.returnPct > oneMonth.spyReturnPct).length
  const inceptBeat = threeMonth.groups.filter(g => g.returnPct > threeMonth.spyReturnPct).length
  const totalGroups = threeMonth.groups.length

  const newsBlock = headlines?.length
    ? `Recent real market headlines (use these to ground what drove markets — paraphrase, do not quote verbatim, do not cite outlets):\n${headlines.map(h => `- ${h}`).join('\n')}`
    : `No headline feed available — describe market drivers only in general terms (Fed/rates, inflation, earnings, AI/tech leadership). Do NOT invent specific events.`

  return `You are writing the opening of a student investing newsletter for "${className}". Audience: high-school students and their parents. Benchmark label to use verbatim: "${SPY_LABEL}".

=== BENCHMARK ===
Last 1 month ${SPY_LABEL}: ${oneMonth.spyReturnPct >= 0 ? '+' : ''}${oneMonth.spyReturnPct}%
Last 3 months ${SPY_LABEL}: ${threeMonth.spyReturnPct >= 0 ? '+' : ''}${threeMonth.spyReturnPct}%

=== CLASS RESULTS — LAST 1 MONTH ===
Top groups:
${topList(oneMonth.groups, 3, groupFmt)}
Top funds:
${topList(oneMonth.funds, 3, fundFmt)}
Top individual: ${oneMonth.individuals?.[0] ? indFmt(oneMonth.individuals[0]).slice(2) : 'n/a'}
${monthBeat} of ${totalGroups} groups beat ${SPY_LABEL} this month.

=== CLASS RESULTS — SINCE INCEPTION (~3 months) ===
Top groups:
${topList(threeMonth.groups, 3, groupFmt)}
Top funds:
${topList(threeMonth.funds, 3, fundFmt)}
Top individual: ${threeMonth.individuals?.[0] ? indFmt(threeMonth.individuals[0]).slice(2) : 'n/a'}
${inceptBeat} of ${totalGroups} groups beat ${SPY_LABEL} since inception.

=== MARKET NEWS (last ~3 months) ===
${newsBlock}

Write exactly TWO short paragraphs in plain language (no markdown, no greeting, no sign-off):
Paragraph 1 — The market backdrop: what actually drove US stocks over the last three months (tie to the news above — e.g. earnings strength, AI/tech leadership, Fed/rate expectations, any notable swings), and where ${SPY_LABEL} landed (cite the 1-month and/or 3-month benchmark numbers).
Paragraph 2 — The class: call out a FEW specific standout groups and funds BY NAME, distinguishing strong performers over the last month versus standouts since inception, and note how many groups beat ${SPY_LABEL}. Be encouraging and concrete. Use the real names and percentages above.

Always write "${SPY_LABEL}" in full — never just "S&P 500".`
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)
  const token = authHeader.replace('Bearer ', '')

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_SERVICE_KEY }
  })
  if (!userRes.ok) return jsonResponse({ error: 'Unauthorized' }, 401)
  const user = await userRes.json()

  const profile = await sbFetch(`/profiles?id=eq.${user.id}&select=role`)
  const role = profile?.[0]?.role
  if (role !== 'teacher' && role !== 'admin') return jsonResponse({ error: 'Forbidden' }, 403)

  const { class_id } = await req.json().catch(() => ({}))
  if (!class_id) return jsonResponse({ error: 'class_id required' }, 400)

  const cls = await sbFetch(`/classes?id=eq.${class_id}&select=id,class_name,teacher_id,public_slug,end_date`)
  const klass = cls?.[0]
  if (!klass) return jsonResponse({ error: 'Class not found' }, 404)
  if (role !== 'admin' && klass.teacher_id !== user.id) return jsonResponse({ error: 'Forbidden' }, 403)

  try {
    // All-time = oldest portfolio in the class (when investing actually started).
    // Falls back to class created_at, then 1 year ago, if no portfolios exist yet.
    const classGroups = await sbFetch(`/groups?class_id=eq.${class_id}&select=id`)
    const groupIdCsv = (classGroups || []).map(g => encodeURIComponent(g.id)).join(',')
    let allTimeStart = null
    if (groupIdCsv) {
      const oldest = await sbFetch(
        `/portfolios?owner_type=eq.group&owner_id=in.(${groupIdCsv})&select=created_at&order=created_at.asc&limit=1`
      )
      allTimeStart = oldest?.[0]?.created_at
    }
    if (!allTimeStart) {
      const cRow = await sbFetch(`/classes?id=eq.${class_id}&select=created_at`)
      allTimeStart = cRow?.[0]?.created_at || daysAgoIso(365)
    }

    const [allTime, threeMonth, oneMonth] = await Promise.all([
      computeLeaderboard({ classId: class_id, windowStart: allTimeStart }),
      computeLeaderboard({ classId: class_id, windowStart: daysAgoIso(90) }),
      computeLeaderboard({ classId: class_id, windowStart: daysAgoIso(30) })
    ])

    const headlines = await fetchMarketHeadlines()
    const introPrompt = buildIntroPrompt({ className: klass.class_name, oneMonth, threeMonth, headlines })
    const introText = await generateAIAnalysis(introPrompt, { maxTokens: 420 })
      || `Over the last three months, ${SPY_LABEL} returned ${threeMonth.spyReturnPct >= 0 ? '+' : ''}${threeMonth.spyReturnPct}% (${oneMonth.spyReturnPct >= 0 ? '+' : ''}${oneMonth.spyReturnPct}% in the last month). Here's how the class did across our groups, funds, and individual investors.`

    const today = new Date()
    const subject = `${klass.class_name} — Investing Update ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

    let daysRemaining = null
    if (klass.end_date) {
      const end = new Date(klass.end_date + 'T23:59:59Z')
      daysRemaining = Math.max(0, Math.ceil((end - today) / (1000 * 60 * 60 * 24)))
    }
    const payload = { allTime, threeMonth, oneMonth, endDate: klass.end_date || null, daysRemaining, generatedAt: today.toISOString() }
    const introHtml = `<p>${escapeHtml(introText.trim()).replace(/\n+/g, '</p><p>')}</p>`

    const inserted = await sbFetch(`/newsletters`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        class_id,
        teacher_id: user.id,
        subject,
        intro_html: introHtml,
        payload,
        status: 'draft'
      })
    })

    return jsonResponse({ newsletter: inserted?.[0] || null, payload, intro_html: introHtml, subject })
  } catch (error) {
    console.error('Newsletter generate error:', error)
    return jsonResponse({ error: error.message || 'Failed to generate newsletter' }, 500)
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
