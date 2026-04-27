export const config = { runtime: 'edge' }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, sbFetch, jsonResponse } from './_lib/supabase.js'
import { computeLeaderboard } from './_lib/leaderboard.js'
import { generateAIAnalysis } from './_lib/ai.js'

function daysAgoIso(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

function topMovers(funds, limit = 3) {
  const sorted = [...funds].sort((a, b) => Math.abs(b.returnPct) - Math.abs(a.returnPct))
  return sorted.slice(0, limit)
}

function buildIntroPrompt({ className, threeMonth }) {
  const movers = topMovers(threeMonth.funds, 3)
    .map(f => `- ${f.fundName} (${f.groupName}): ${f.returnPct >= 0 ? '+' : ''}${f.returnPct}%`)
    .join('\n')
  const beatingSpy = threeMonth.groups.filter(g => g.returnPct > threeMonth.spyReturnPct).length
  const totalGroups = threeMonth.groups.length
  return `You are writing the opening paragraph of a student investing newsletter for "${className}".

Window: last 3 months
S&P 500 (SPY) return: ${threeMonth.spyReturnPct >= 0 ? '+' : ''}${threeMonth.spyReturnPct}%
Class results: ${beatingSpy} of ${totalGroups} groups beat the S&P 500.
Biggest movers among the class's funds:
${movers}

Write 2-3 plain sentences for high-school students. Reference what drove markets this period in a general way (rates, earnings, sectors), and frame how the class did versus the S&P. Do NOT invent specific news. No greetings, no sign-off, no markdown.`
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

    const introPrompt = buildIntroPrompt({ className: klass.class_name, threeMonth })
    const introText = await generateAIAnalysis(introPrompt, { maxTokens: 220 })
      || `Over the last three months, the S&P 500 returned ${threeMonth.spyReturnPct >= 0 ? '+' : ''}${threeMonth.spyReturnPct}%. Here's how the class did across our groups, funds, and individual investors.`

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
