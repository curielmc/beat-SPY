import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildTutorialFallback,
  deriveDeckPdfUrl,
  extractJsonCandidate,
  normalizeTutorialDraft,
  slugify
} from '../api/_lib/jasper.js'

test('slugify produces kebab-case slugs', () => {
  assert.equal(slugify(' Intro to Dividends! '), 'intro-to-dividends')
})

test('deriveDeckPdfUrl prefers explicit export url', () => {
  assert.equal(
    deriveDeckPdfUrl({
      sourceType: 'google-slides',
      sourceUrl: 'https://docs.google.com/presentation/d/123/edit',
      sourceExportUrl: 'https://docs.google.com/presentation/d/123/export/pdf'
    }),
    'https://docs.google.com/presentation/d/123/export/pdf'
  )
})

test('deriveDeckPdfUrl derives google slides export url', () => {
  assert.equal(
    deriveDeckPdfUrl({
      sourceType: 'google-slides',
      sourceUrl: 'https://docs.google.com/presentation/d/abc123/edit#slide=id.p1'
    }),
    'https://docs.google.com/presentation/d/abc123/export/pdf'
  )
})

test('extractJsonCandidate finds fenced json', () => {
  const candidate = extractJsonCandidate('```json\n{"title":"X"}\n```')
  assert.equal(candidate, '{"title":"X"}')
})

test('buildTutorialFallback creates multiple steps from headings', () => {
  const draft = buildTutorialFallback({
    title: '',
    category: 'investments',
    sourceName: 'Deck',
    sourceText: '# Intro\nStocks build ownership.\n\n# Risk\nDiversification matters.'
  })

  assert.equal(draft.title, 'Intro')
  assert.equal(draft.steps.length, 2)
  assert.equal(draft.steps[0].slug, 'intro')
})

test('normalizeTutorialDraft falls back to valid html and positions', () => {
  const fallback = buildTutorialFallback({
    title: 'Fallback',
    category: 'investments',
    sourceName: 'Deck',
    sourceText: 'Paragraph one.\n\nParagraph two.'
  })

  const normalized = normalizeTutorialDraft({
    title: 'AI Title',
    steps: [{ title: 'Step A', description: 'Summary only' }]
  }, fallback)

  assert.equal(normalized.title, 'AI Title')
  assert.equal(normalized.steps.length, 1)
  assert.match(normalized.steps[0].content_html, /<div class="space-y-4">/)
  assert.equal(normalized.steps[0].position, 1)
})
