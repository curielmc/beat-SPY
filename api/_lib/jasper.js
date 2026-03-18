const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

const ALLOWED_SCOPES = new Set([
  'tutorials:create',
  'tutorials:assign',
  'tutorials:publish'
])

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  })
}

export function getSupabaseEnv() {
  return {
    supabaseUrl: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    serviceKey: SUPABASE_SERVICE_KEY
  }
}

export async function sbFetch(path, options = {}) {
  const { serviceKey, supabaseUrl } = getSupabaseEnv()
  if (!serviceKey || !supabaseUrl) {
    throw new Error('Supabase server auth is not configured')
  }

  const res = await fetch(`${supabaseUrl}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...options.headers
    }
  })

  const data = await res.json().catch(() => null)
  return { res, data }
}

export async function verifyAdminBearer(authHeader) {
  const { supabaseUrl, anonKey, serviceKey } = getSupabaseEnv()
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return { error: json({ error: 'Server auth is not configured' }, 500) }
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return { error: json({ error: 'Missing bearer token' }, 401) }
  }

  const userLookup = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: authHeader
    }
  })
  const user = await userLookup.json().catch(() => null)
  if (!userLookup.ok || !user?.id) {
    return { error: json({ error: 'Unauthorized' }, 401) }
  }

  const profileLookup = await sbFetch(`/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role,email&limit=1`)
  if (!profileLookup.res.ok) {
    return { error: json({ error: 'Failed to verify admin role' }, 500) }
  }

  const profile = profileLookup.data?.[0]
  if (profile?.role !== 'admin') {
    return { error: json({ error: 'Forbidden' }, 403) }
  }

  return { user, profile }
}

export function normalizeScopes(scopes = []) {
  const normalized = Array.isArray(scopes)
    ? scopes.filter(scope => typeof scope === 'string' && ALLOWED_SCOPES.has(scope))
    : []
  return [...new Set(normalized)]
}

export function ensureScopes(tokenRecord, requiredScopes = []) {
  const granted = Array.isArray(tokenRecord?.scopes) ? tokenRecord.scopes : []
  return requiredScopes.every(scope => granted.includes(scope))
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export function generateJasperToken() {
  const buffer = new Uint8Array(24)
  crypto.getRandomValues(buffer)
  const body = btoa(String.fromCharCode(...buffer)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  return `jasper_${body}`
}

export async function authenticateJasperRequest(req, requiredScopes = []) {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return { error: json({ error: 'Missing Jasper bearer token' }, 401) }
  }

  const rawToken = authHeader.slice('Bearer '.length).trim()
  const tokenHash = await sha256Hex(rawToken)
  const lookup = await sbFetch(`/jasper_api_tokens?token_hash=eq.${tokenHash}&select=id,label,owner_user_id,scopes,revoked_at&limit=1`)
  if (!lookup.res.ok) {
    return { error: json({ error: 'Failed to verify Jasper token' }, 500) }
  }

  const token = lookup.data?.[0]
  if (!token || token.revoked_at) {
    return { error: json({ error: 'Invalid Jasper token' }, 401) }
  }

  if (!ensureScopes(token, requiredScopes)) {
    return { error: json({ error: 'Insufficient Jasper token scope' }, 403) }
  }

  return { token }
}

export async function touchJasperToken(tokenId) {
  await sbFetch(`/jasper_api_tokens?id=eq.${tokenId}`, {
    method: 'PATCH',
    body: JSON.stringify({ last_used_at: new Date().toISOString() }),
    headers: {
      Prefer: 'return=minimal'
    }
  }).catch(() => null)
}

export function slugify(value = '') {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stripHtmlTags(value = '') {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function decodePdfString(value = '') {
  return value
    .replace(/\\([\\()])/g, '$1')
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
}

export function extractTextFromPdfString(pdfString = '') {
  const matches = [...pdfString.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g)]
  const chunks = matches
    .map(match => decodePdfString(match[1]))
    .map(chunk => chunk.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  if (chunks.length > 0) {
    return chunks.join('\n')
  }

  const plainText = pdfString
    .replace(/[\u0000-\u001F]+/g, ' ')
    .match(/[A-Za-z0-9][A-Za-z0-9,.;:()'"%/ \-\n]{20,}/g)

  return plainText ? plainText.join('\n') : ''
}

export async function fetchSourceMaterial({ sourceType, sourceUrl, sourceExportUrl, sourceText }) {
  const normalizedText = typeof sourceText === 'string' ? sourceText.trim() : ''
  if (normalizedText) {
    return {
      extractedText: normalizedText,
      resolvedDeckPdfUrl: deriveDeckPdfUrl({ sourceType, sourceUrl, sourceExportUrl })
    }
  }

  const fetchUrl = sourceExportUrl || sourceUrl
  if (!fetchUrl) {
    return {
      extractedText: '',
      resolvedDeckPdfUrl: deriveDeckPdfUrl({ sourceType, sourceUrl, sourceExportUrl })
    }
  }

  const res = await fetch(fetchUrl)
  if (!res.ok) {
    throw new Error(`Failed to fetch source material (${res.status})`)
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase()
  if (contentType.includes('application/pdf') || fetchUrl.toLowerCase().includes('.pdf')) {
    const buffer = await res.arrayBuffer()
    const pdfString = new TextDecoder('latin1').decode(buffer)
    return {
      extractedText: extractTextFromPdfString(pdfString).trim(),
      resolvedDeckPdfUrl: deriveDeckPdfUrl({ sourceType, sourceUrl, sourceExportUrl }) || fetchUrl
    }
  }

  const text = await res.text()
  return {
    extractedText: stripHtmlTags(text),
    resolvedDeckPdfUrl: deriveDeckPdfUrl({ sourceType, sourceUrl, sourceExportUrl })
  }
}

export function deriveDeckPdfUrl({ sourceType, sourceUrl, sourceExportUrl }) {
  const normalizedType = (sourceType || '').toLowerCase()
  if (sourceExportUrl) return sourceExportUrl
  if (normalizedType === 'google-slides' && sourceUrl) {
    const match = sourceUrl.match(/\/presentation\/d\/([^/]+)/)
    if (match?.[1]) {
      return `https://docs.google.com/presentation/d/${match[1]}/export/pdf`
    }
  }
  if (normalizedType === 'google-drive' && sourceUrl) {
    const match = sourceUrl.match(/\/d\/([^/]+)/) || sourceUrl.match(/[?&]id=([^&]+)/)
    if (match?.[1]) {
      return `https://drive.google.com/uc?export=download&id=${match[1]}`
    }
  }
  if (normalizedType === 'pdf' && sourceUrl) return sourceUrl
  return null
}

export function paragraphsToHtml(paragraphs = []) {
  const html = paragraphs
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map(paragraph => `<p>${escapeHtml(paragraph)}</p>`)
    .join('')

  return `<div class="space-y-4">${html}</div>`
}

function buildStepsFromSections(sections = []) {
  return sections.map((section, index) => {
    const fallbackTitle = `Step ${index + 1}`
    const title = (section.title || fallbackTitle).trim() || fallbackTitle
    const paragraphs = Array.isArray(section.paragraphs) ? section.paragraphs : []

    return {
      title,
      slug: slugify(title) || `step-${index + 1}`,
      description: paragraphs[0]?.slice(0, 180) || '',
      content_html: paragraphsToHtml(paragraphs.length > 0 ? paragraphs : ['Content coming soon.']),
      duration_minutes: Math.max(3, Math.min(15, paragraphs.length * 2 || 4)),
      position: index + 1
    }
  })
}

export function buildTutorialFallback({
  title,
  category = 'investments',
  sourceName,
  sourceText
}) {
  const text = (sourceText || '').replace(/\r\n/g, '\n').trim()
  const lines = text.split('\n').map(line => line.trim())
  const sections = []
  let current = null

  for (const line of lines) {
    if (!line) continue
    const isHeading = /^#{1,6}\s+/.test(line) || (/^[A-Z][A-Za-z0-9 ,:&/-]{3,80}$/.test(line) && !/[.?!]$/.test(line))
    if (isHeading) {
      if (current) sections.push(current)
      current = {
        title: line.replace(/^#{1,6}\s+/, '').trim(),
        paragraphs: []
      }
      continue
    }

    if (!current) {
      current = { title: 'Overview', paragraphs: [] }
    }
    current.paragraphs.push(line)
  }
  if (current) sections.push(current)

  let normalizedSections = sections.filter(section => section.paragraphs.length > 0)
  if (normalizedSections.length === 0 && text) {
    const paragraphs = text.split(/\n{2,}/).map(chunk => chunk.replace(/\s+/g, ' ').trim()).filter(Boolean)
    const chunkSize = Math.max(2, Math.ceil(paragraphs.length / Math.min(5, Math.max(1, paragraphs.length))))
    normalizedSections = []
    for (let i = 0; i < paragraphs.length; i += chunkSize) {
      normalizedSections.push({
        title: `Section ${normalizedSections.length + 1}`,
        paragraphs: paragraphs.slice(i, i + chunkSize)
      })
    }
  }

  if (normalizedSections.length === 0) {
    normalizedSections = [{
      title: 'Overview',
      paragraphs: ['Content could not be extracted automatically. Provide source_text for better results.']
    }]
  }

  const resolvedTitle = (title || normalizedSections[0]?.title || sourceName || 'Imported Tutorial').trim()
  const steps = buildStepsFromSections(normalizedSections)

  return {
    title: resolvedTitle,
    slug: slugify(resolvedTitle) || `tutorial-${Date.now()}`,
    description: steps[0]?.description || `Imported from ${sourceName || 'source material'}.`,
    category,
    steps
  }
}

export function extractJsonCandidate(text = '') {
  const fenced = text.match(/```json\s*([\s\S]+?)```/i)
  if (fenced) return fenced[1].trim()

  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1)
  }
  return ''
}

export function normalizeTutorialDraft(draft, fallback) {
  const title = typeof draft?.title === 'string' && draft.title.trim() ? draft.title.trim() : fallback.title
  const description = typeof draft?.description === 'string' && draft.description.trim()
    ? draft.description.trim()
    : fallback.description
  const category = typeof draft?.category === 'string' && draft.category.trim()
    ? draft.category.trim()
    : fallback.category

  const stepsInput = Array.isArray(draft?.steps) && draft.steps.length > 0 ? draft.steps : fallback.steps
  const steps = stepsInput.map((step, index) => {
    const plainDescription = typeof step?.description === 'string' ? step.description.trim() : ''
    const contentHtml = typeof step?.content_html === 'string' && step.content_html.trim()
      ? step.content_html.trim()
      : paragraphsToHtml([plainDescription || `Step ${index + 1}`])
    const titleValue = typeof step?.title === 'string' && step.title.trim() ? step.title.trim() : `Step ${index + 1}`

    return {
      title: titleValue,
      slug: slugify(step?.slug || titleValue) || `step-${index + 1}`,
      description: plainDescription || stripHtmlTags(contentHtml).slice(0, 180),
      content_html: contentHtml,
      duration_minutes: Number.isFinite(step?.duration_minutes) ? Math.max(1, Math.round(step.duration_minutes)) : 5,
      position: index + 1
    }
  })

  return {
    title,
    slug: slugify(draft?.slug || title) || fallback.slug,
    description,
    category,
    steps
  }
}

export async function generateTutorialDraft({
  title,
  category,
  sourceName,
  sourceText
}) {
  const fallback = buildTutorialFallback({ title, category, sourceName, sourceText })
  const prompt = `You convert teaching material into an interactive tutorial JSON object.

Return JSON only. No markdown fences. Use this schema:
{
  "title": "string",
  "description": "string",
  "category": "investments|trading|economics|personal-finance",
  "steps": [
    {
      "title": "string",
      "slug": "kebab-case-string",
      "description": "short summary",
      "content_html": "<div class=\\"space-y-4\\">...</div>",
      "duration_minutes": 5
    }
  ]
}

Rules:
- Preserve factual content from the source.
- Create 3 to 8 steps.
- Use simple semantic HTML only: div, p, ul, ol, li, h3, strong, em.
- Each step should cover one concept.
- Avoid scripts, images, iframes, style tags, and markdown.

Category: ${fallback.category}
Preferred title: ${fallback.title}
Source name: ${sourceName || 'Uploaded source'}

Source material:
${sourceText.slice(0, 24000)}`

  const aiResponse = await generateAiText(prompt)
  if (!aiResponse) {
    return fallback
  }

  try {
    const parsed = JSON.parse(extractJsonCandidate(aiResponse) || aiResponse)
    return normalizeTutorialDraft(parsed, fallback)
  } catch {
    return fallback
  }
}

async function generateAiText(prompt) {
  if (process.env.OPENROUTER_API_KEY) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://beat-snp.com',
        'X-Title': 'Beat the S&P 500 Jasper'
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2400,
        temperature: 0.3
      })
    })
    const data = await res.json().catch(() => null)
    return data?.choices?.[0]?.message?.content || null
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
        model: 'claude-3-5-haiku-latest',
        max_tokens: 2400,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    const data = await res.json().catch(() => null)
    return data?.content?.[0]?.text || null
  }

  if (process.env.DEEPSEEK_API_KEY) {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2400,
        temperature: 0.3
      })
    })
    const data = await res.json().catch(() => null)
    return data?.choices?.[0]?.message?.content || null
  }

  return null
}
