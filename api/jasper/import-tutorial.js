export const config = { runtime: 'edge' }

import {
  authenticateJasperRequest,
  deriveDeckPdfUrl,
  fetchSourceMaterial,
  generateTutorialDraft,
  json,
  normalizeScopes,
  sbFetch,
  slugify,
  touchJasperToken
} from '../_lib/jasper.js'

const ALLOWED_CATEGORIES = new Set(['investments', 'trading', 'economics', 'personal-finance'])
const ALLOWED_SOURCE_TYPES = new Set(['pdf', 'pptx', 'google-drive', 'google-slides', 'text', 'url'])

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const auth = await authenticateJasperRequest(req, ['tutorials:create'])
  if (auth.error) return auth.error

  const body = await req.json().catch(() => null)
  if (!body) {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const sourceType = typeof body.source_type === 'string' ? body.source_type.trim().toLowerCase() : ''
  if (!ALLOWED_SOURCE_TYPES.has(sourceType)) {
    return json({ error: 'source_type must be one of pdf, pptx, google-drive, google-slides, text, url' }, 400)
  }

  const requestedScopes = normalizeScopes([
    'tutorials:create',
    Array.isArray(body.class_ids) && body.class_ids.length > 0 ? 'tutorials:assign' : null,
    body.status === 'active' ? 'tutorials:publish' : null
  ].filter(Boolean))
  if (!requestedScopes.every(scope => auth.token.scopes.includes(scope))) {
    return json({ error: 'Jasper token does not have the required scopes for this import' }, 403)
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const category = ALLOWED_CATEGORIES.has(body.category) ? body.category : 'investments'
  const status = body.status === 'active' ? 'active' : 'draft'
  const sourceUrl = typeof body.source_url === 'string' ? body.source_url.trim() : ''
  const sourceExportUrl = typeof body.source_export_url === 'string' ? body.source_export_url.trim() : ''
  const sourceName = typeof body.source_name === 'string' ? body.source_name.trim() : ''
  const classIds = Array.isArray(body.class_ids) ? body.class_ids.filter(id => typeof id === 'string' && id.trim()) : []
  const explicitSourceText = typeof body.source_text === 'string' ? body.source_text : ''

  if (!explicitSourceText.trim() && !sourceUrl && !sourceExportUrl) {
    return json({ error: 'Provide source_text, source_url, or source_export_url' }, 400)
  }

  let extractedText = explicitSourceText.trim()
  let deckPdfUrl = deriveDeckPdfUrl({ sourceType, sourceUrl, sourceExportUrl })

  if (!extractedText) {
    try {
      const sourceMaterial = await fetchSourceMaterial({
        sourceType,
        sourceUrl,
        sourceExportUrl,
        sourceText: explicitSourceText
      })
      extractedText = sourceMaterial.extractedText
      deckPdfUrl = sourceMaterial.resolvedDeckPdfUrl || deckPdfUrl
    } catch (error) {
      return json({ error: error.message || 'Failed to load source material' }, 400)
    }
  }

  if (!extractedText) {
    return json({
      error: 'No extractable text found. Supply source_text directly, or provide a publicly accessible text-based PDF/export URL.'
    }, 400)
  }

  const draft = await generateTutorialDraft({
    title,
    category,
    sourceName: sourceName || sourceUrl || 'source material',
    sourceText: extractedText
  })

  const tutorialInsert = await sbFetch('/training_tutorials', {
    method: 'POST',
    body: JSON.stringify({
      title: draft.title,
      slug: slugify(body.slug || draft.slug || draft.title),
      description: draft.description,
      category,
      status,
      position: Number.isFinite(body.position) ? body.position : 0,
      source_type: sourceType,
      source_url: sourceUrl || sourceExportUrl || null,
      source_name: sourceName || null,
      deck_pdf_url: deckPdfUrl || null,
      generated_by: 'jasper',
      jasper_metadata: {
        imported_via: 'api',
        token_label: auth.token.label,
        extracted_text_length: extractedText.length
      }
    })
  })

  if (!tutorialInsert.res.ok) {
    return json({ error: 'Failed to create tutorial', details: tutorialInsert.data }, 500)
  }

  const tutorial = tutorialInsert.data?.[0]
  const stepsPayload = draft.steps.map((step, index) => ({
    training_tutorial_id: tutorial.id,
    title: step.title,
    slug: step.slug || `step-${index + 1}`,
    description: step.description || null,
    content: step.content_html,
    position: index + 1,
    duration_minutes: step.duration_minutes || 5
  }))

  const stepsInsert = await sbFetch('/training_steps', {
    method: 'POST',
    body: JSON.stringify(stepsPayload)
  })
  if (!stepsInsert.res.ok) {
    await sbFetch(`/training_tutorials?id=eq.${tutorial.id}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' }
    }).catch(() => null)
    return json({ error: 'Failed to create tutorial steps', details: stepsInsert.data }, 500)
  }

  if (classIds.length > 0) {
    const classAssignments = classIds.map(classId => ({
      class_id: classId,
      training_tutorial_id: tutorial.id
    }))
    const assign = await sbFetch('/class_training_tutorials', {
      method: 'POST',
      body: JSON.stringify(classAssignments),
      headers: {
        Prefer: 'resolution=merge-duplicates,return=representation'
      }
    })
    if (!assign.res.ok) {
      return json({
        error: 'Tutorial created but class assignment failed',
        tutorial_id: tutorial.id,
        details: assign.data
      }, 500)
    }
  }

  await touchJasperToken(auth.token.id)

  return json({
    tutorial_id: tutorial.id,
    title: tutorial.title,
    slug: tutorial.slug,
    status: tutorial.status,
    category: tutorial.category,
    deck_pdf_url: tutorial.deck_pdf_url,
    source_type: tutorial.source_type,
    steps_created: stepsPayload.length,
    assigned_class_ids: classIds
  }, 201)
}
