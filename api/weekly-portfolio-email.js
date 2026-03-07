export const config = { runtime: 'edge' }

const SUPABASE_URL = 'https://omrfqisqsqgidcqellzy.supabase.co'
const FMP_BASE = 'https://financialmodelingprep.com/api/v3'

function escapeHtml(input) {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Auth ──
async function requireTeacherOrAdmin(req) {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null

  const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!ANON_KEY) return null

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: authHeader }
  })
  if (!userRes.ok) return null
  const user = await userRes.json()
  if (!user?.id) return null

  const roleRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=role`, {
    headers: { apikey: ANON_KEY, Authorization: authHeader }
  })
  if (!roleRes.ok) return null
  const rows = await roleRes.json()
  const role = rows?.[0]?.role
  return role === 'teacher' || role === 'admin' ? user : null
}

// ── Supabase REST helper (service key) ──
function sbFetch(path) {
  const key = process.env.SUPABASE_SERVICE_KEY
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  }).then(r => r.json())
}

function sbPost(path, body) {
  const key = process.env.SUPABASE_SERVICE_KEY
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(body)
  })
}

// ── FMP helper ──
function fmpFetch(endpoint) {
  const key = process.env.FMP_API_KEY || process.env.VITE_FMP_API_KEY
  const sep = endpoint.includes('?') ? '&' : '?'
  return fetch(`${FMP_BASE}${endpoint}${sep}apikey=${key}`).then(r => r.json())
}

// ── Brave Search helper ──
async function searchNews(ticker, companyName) {
  const braveKey = process.env.BRAVE_API_KEY
  if (!braveKey) return []
  const query = `${ticker} ${companyName || ''} stock news`
  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3&freshness=pw`, {
      headers: { 'X-Subscription-Token': braveKey, Accept: 'application/json' }
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.web?.results || []).slice(0, 2).map(r => ({
      title: r.title,
      url: r.url,
      description: r.description
    }))
  } catch { return [] }
}

// ── Claude helper ──
async function callClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Claude API error: ${res.status} ${err?.error?.message || ''}`)
  }
  const data = await res.json()
  return data.content?.[0]?.text || ''
}

// ── Email template ──
function buildEmailHtml(recipientName, sections) {
  const { portfolioSection, newsSection, lessonSection } = sections
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #6366f1; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <img src="https://beat-snp.com/logo.jpg" alt="Beat the S&P 500" style="height: 60px; margin: 0 auto 12px;" />
        <h2 style="color: white; margin: 0;">Beat the S&P 500 - Weekly Report</h2>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Hi ${escapeHtml(recipientName)}, here's your weekly portfolio recap.</p>
      </div>
      <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">

        <h3 style="color: #6366f1; margin: 0 0 12px; font-size: 16px;">Your Portfolio This Week</h3>
        <div style="background: white; border-left: 4px solid #6366f1; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
          <div style="font-size: 14px; color: #111827; line-height: 1.6;">${portfolioSection}</div>
        </div>

        <h3 style="color: #f59e0b; margin: 0 0 12px; font-size: 16px;">Why It Happened</h3>
        <div style="background: white; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
          <div style="font-size: 14px; color: #111827; line-height: 1.6;">${newsSection}</div>
        </div>

        <h3 style="color: #10b981; margin: 0 0 12px; font-size: 16px;">The Lesson</h3>
        <div style="background: white; border-left: 4px solid #10b981; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
          <div style="font-size: 14px; color: #111827; line-height: 1.6;">${lessonSection}</div>
        </div>

        <a href="https://beat-snp.com" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          Open App
        </a>
        <p style="margin: 24px 0 0; font-size: 12px; color: #9ca3af;">
          You're receiving this because you're enrolled in a Beat the S&P 500 class.
        </p>
      </div>
    </div>
  `
}

// ── Build portfolio data for a single portfolio ──
async function buildPortfolioData(portfolio, ownerLabel) {
  const holdings = await sbFetch(`/holdings?portfolio_id=eq.${portfolio.id}&select=*`)
  const tickers = (holdings || []).map(h => h.ticker)

  // Fetch current prices
  let quotes = {}
  if (tickers.length > 0) {
    const quoteData = await fmpFetch(`/quote/${tickers.join(',')}`)
    for (const q of (quoteData || [])) {
      quotes[q.symbol] = q
    }
  }

  // Fetch trades from past 7 days
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const trades = await sbFetch(`/trades?portfolio_id=eq.${portfolio.id}&executed_at=gte.${weekAgo}&select=*&order=executed_at.desc`)

  // Fetch SPY quote for benchmark
  const spyData = await fmpFetch('/quote/SPY')
  const spyQuote = spyData?.[0]

  // Calculate P&L per holding
  const holdingsWithPnL = (holdings || []).map(h => {
    const q = quotes[h.ticker]
    const currentPrice = q?.price || h.avg_cost
    const marketValue = h.shares * currentPrice
    const costBasis = h.shares * h.avg_cost
    const gainLoss = marketValue - costBasis
    const gainPct = costBasis > 0 ? ((gainLoss / costBasis) * 100) : 0
    return {
      ticker: h.ticker,
      companyName: q?.name || h.ticker,
      shares: h.shares,
      avgCost: h.avg_cost,
      currentPrice,
      marketValue,
      gainLoss,
      gainPct,
      changesPercentage: q?.changesPercentage || 0
    }
  })

  const holdingsValue = holdingsWithPnL.reduce((s, h) => s + h.marketValue, 0)
  const totalValue = holdingsValue + portfolio.cash_balance
  const returnPct = ((totalValue - portfolio.starting_cash) / portfolio.starting_cash) * 100

  // Gather news for each ticker (parallel, limited)
  const newsMap = {}
  if (tickers.length > 0) {
    const newsPromises = tickers.slice(0, 10).map(async t => {
      const q = quotes[t]
      newsMap[t] = await searchNews(t, q?.name)
    })
    await Promise.all(newsPromises)
  }

  return {
    ownerLabel,
    holdings: holdingsWithPnL,
    trades: trades || [],
    cashBalance: portfolio.cash_balance,
    startingCash: portfolio.starting_cash,
    totalValue,
    returnPct,
    spyChange: spyQuote?.changesPercentage || 0,
    newsMap
  }
}

// ── Generate email content via Claude ──
async function generateEmailContent(data) {
  const { ownerLabel, holdings, trades, cashBalance, startingCash, totalValue, returnPct, spyChange, newsMap } = data

  const holdingsSummary = holdings.length > 0
    ? holdings.map(h =>
      `- ${h.ticker} (${h.companyName}): ${h.shares} shares, avg cost $${h.avgCost.toFixed(2)}, now $${h.currentPrice.toFixed(2)}, P&L ${h.gainLoss >= 0 ? '+' : ''}$${h.gainLoss.toFixed(2)} (${h.gainPct >= 0 ? '+' : ''}${h.gainPct.toFixed(1)}%), week change ${h.changesPercentage >= 0 ? '+' : ''}${h.changesPercentage.toFixed(1)}%`
    ).join('\n')
    : '- No holdings (100% cash)'

  const tradesSummary = trades.length > 0
    ? trades.map(t => `- ${t.side.toUpperCase()} ${t.ticker}: $${Number(t.dollars).toFixed(2)} at $${Number(t.price).toFixed(2)}`).join('\n')
    : '- No trades this week'

  const newsSummary = Object.entries(newsMap)
    .filter(([, articles]) => articles.length > 0)
    .map(([ticker, articles]) =>
      `${ticker}:\n${articles.map(a => `  - "${a.title}" (${a.url})`).join('\n')}`
    ).join('\n') || 'No specific news found for holdings.'

  const cashPct = ((cashBalance / totalValue) * 100).toFixed(1)

  const prompt = `You are writing a weekly portfolio email for a high school student investment competition called "Beat the S&P 500."

Portfolio: "${ownerLabel}"
Overall: $${totalValue.toFixed(2)} total value (started with $${startingCash.toFixed(2)}), return: ${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%
SPY this week: ${spyChange >= 0 ? '+' : ''}${spyChange.toFixed(2)}%
Cash: $${cashBalance.toFixed(2)} (${cashPct}% of portfolio)

Holdings:
${holdingsSummary}

Trades This Week:
${tradesSummary}

Recent News for Holdings:
${newsSummary}

Write exactly 3 sections in HTML (use <p>, <strong>, <ul>, <li> tags only, no headers):

1. "Your Portfolio This Week" - Summarize what moved, P&L per position, overall return vs SPY. Be specific with numbers. Keep it to 3-5 sentences.

2. "Why It Happened" - Connect real news to their specific holdings' performance. If news was found, reference it. If no news, explain general market conditions. 2-4 sentences.

3. "The Lesson" - A specific investing lesson drawn from what ACTUALLY happened in their portfolio. Examples:
   - If they hold 100% cash while market rose: "Opportunity Cost"
   - If they're 100% in one sector: "Diversification"
   - If a stock dropped on earnings: "Earnings expectations vs results"
   - If a stock is up 15%+: "Momentum vs Fundamentals: When to take profits?"
   - If they panic-sold: "Emotional discipline"
   Make it educational, specific to their situation, 2-3 sentences.

Return ONLY a JSON object with keys: portfolioSection, newsSection, lessonSection. Each value is an HTML string. No markdown wrapping.`

  const raw = await callClaude(prompt)
  const cleaned = raw.replace(/```json\n?|```\n?/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    // Fallback: use raw text split
    return {
      portfolioSection: `<p>Portfolio value: $${totalValue.toFixed(2)} (${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}% return). SPY: ${spyChange >= 0 ? '+' : ''}${spyChange.toFixed(2)}%.</p>`,
      newsSection: `<p>See your app dashboard for the latest news on your holdings.</p>`,
      lessonSection: `<p>Keep learning and stay disciplined with your investment strategy!</p>`
    }
  }
}

// ── Send email via Resend ──
async function sendEmail(to, subject, html) {
  const key = process.env.RESEND_API_KEY
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Beat the S&P 500 <noreply@beat-snp.com>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html
    })
  })
  return res.json()
}

// ── Main handler ──
export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const user = await requireTeacherOrAdmin(req)
  if (!user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const RESEND_KEY = process.env.RESEND_API_KEY
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  if (!RESEND_KEY || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 })
  }

  const { classId, preview = false, audience = 'groups' } = await req.json()
  // audience: 'groups' | 'individuals' | 'both'

  if (!classId) {
    return new Response(JSON.stringify({ error: 'classId is required' }), { status: 400 })
  }

  const results = { groups: [], individuals: [], errors: [] }

  try {
    // ── Process group portfolios ──
    if (audience === 'groups' || audience === 'both') {
      const groups = await sbFetch(`/groups?class_id=eq.${classId}&select=*`)

      for (const group of (groups || [])) {
        try {
          // Get group portfolio
          const portfolios = await sbFetch(`/portfolios?owner_type=eq.group&owner_id=eq.${group.id}&select=*`)
          const portfolio = portfolios?.[0]
          if (!portfolio) continue

          // Get group members' emails
          const members = await sbFetch(`/class_memberships?group_id=eq.${group.id}&select=profiles:profiles(email,full_name)`)
          const emails = (members || []).map(m => m.profiles?.email).filter(Boolean)
          if (emails.length === 0) continue

          // Build data & generate content
          const data = await buildPortfolioData(portfolio, group.name)
          const sections = await generateEmailContent(data)
          const html = buildEmailHtml(group.name, sections)

          if (!preview) {
            await sendEmail(emails, `Weekly Portfolio Report - ${group.name}`, html)
          }

          // Log it
          await sbPost('/weekly_email_logs', {
            class_id: classId,
            group_id: group.id,
            recipient_type: 'group',
            email_content_preview: sections.portfolioSection?.substring(0, 500),
            status: preview ? 'preview' : 'sent',
            created_by: user.id
          })

          results.groups.push({
            groupId: group.id,
            groupName: group.name,
            emailCount: emails.length,
            preview: preview ? { html, sections } : undefined
          })
        } catch (e) {
          results.errors.push({ groupId: group.id, groupName: group.name, error: e.message })
        }
      }
    }

    // ── Process individual portfolios ──
    if (audience === 'individuals' || audience === 'both') {
      // Get all class members
      const members = await sbFetch(`/class_memberships?class_id=eq.${classId}&select=user_id,profiles:profiles(id,email,full_name)`)

      for (const member of (members || [])) {
        try {
          const userId = member.user_id
          const email = member.profiles?.email
          const name = member.profiles?.full_name || 'Student'
          if (!email) continue

          // Get individual portfolio
          const portfolios = await sbFetch(`/portfolios?owner_type=eq.user&owner_id=eq.${userId}&select=*`)
          const portfolio = portfolios?.[0]
          if (!portfolio) continue

          // Build data & generate content
          const data = await buildPortfolioData(portfolio, `${name}'s Portfolio`)
          const sections = await generateEmailContent(data)
          const html = buildEmailHtml(name, sections)

          if (!preview) {
            await sendEmail(email, `Your Weekly Portfolio Report`, html)
          }

          // Log it
          await sbPost('/weekly_email_logs', {
            class_id: classId,
            user_id: userId,
            recipient_type: 'individual',
            email_content_preview: sections.portfolioSection?.substring(0, 500),
            status: preview ? 'preview' : 'sent',
            created_by: user.id
          })

          results.individuals.push({
            userId,
            name,
            preview: preview ? { html, sections } : undefined
          })
        } catch (e) {
          results.errors.push({ userId: member.user_id, error: e.message })
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      preview,
      audience,
      sent: {
        groups: results.groups.length,
        individuals: results.individuals.length
      },
      results,
      errors: results.errors
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e) {
    console.error('Weekly email error:', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
