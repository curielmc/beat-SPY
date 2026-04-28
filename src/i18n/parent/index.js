import en from './en.json' with { type: 'json' }
import es from './es.json' with { type: 'json' }

const bundles = { en, es }

export function t(lang, key, vars = {}) {
  const path = key.split('.')
  let v = bundles[lang] || bundles.en
  for (const p of path) v = v?.[p]
  if (typeof v !== 'string') return v
  return v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''))
}

export function consentTextVersion() {
  return en.consent_text_version
}

export function getBundle(lang) {
  return bundles[lang] || bundles.en
}
