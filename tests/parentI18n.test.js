import test from 'node:test'
import assert from 'node:assert/strict'

import { t, consentTextVersion, getBundle } from '../src/i18n/parent/index.js'

test('t() interpolates variables', () => {
  const out = t('en', 'page.intro', { student_name: 'Alex' })
  assert.match(out, /Alex/)
})

test('t() falls back to English for unknown lang', () => {
  const out = t('zz', 'page.submit')
  assert.equal(out, 'Submit consent')
})

test('t() returns Spanish for es', () => {
  const out = t('es', 'page.submit')
  assert.equal(out, 'Enviar consentimiento')
})

test('en and es bundles have identical key shapes', () => {
  const enBundle = getBundle('en')
  const esBundle = getBundle('es')

  function shape(obj, prefix = '') {
    const keys = []
    for (const k of Object.keys(obj)) {
      const v = obj[k]
      const p = prefix ? `${prefix}.${k}` : k
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        keys.push(...shape(v, p))
      } else {
        keys.push(p)
      }
    }
    return keys.sort()
  }

  assert.deepEqual(shape(enBundle), shape(esBundle))
})

test('consentTextVersion returns a non-empty string', () => {
  const v = consentTextVersion()
  assert.equal(typeof v, 'string')
  assert.ok(v.length > 0)
})

test('t() handles missing variables gracefully', () => {
  const out = t('en', 'page.intro', {})
  // Should still substitute empty for missing var
  assert.equal(typeof out, 'string')
  assert.ok(!out.includes('{student_name}'))
})
