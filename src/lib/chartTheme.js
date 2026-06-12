// Resolve DaisyUI theme colors from CSS custom properties so charts stay on-brand
// across the custom light/dark themes, instead of hard-coding stale palette values.
//
// Charts render to <canvas>. Chart.js and lightweight-charts both want colors the
// canvas API can parse. Rather than assume oklch() is accepted everywhere, we let the
// browser's own canvas parser normalize any CSS color (incl. oklch from our theme vars)
// down to a hex/rgb string. That keeps the resolver universal and future-proof.

let _ctx
function toRgb(color, fallback = '#888888') {
  if (typeof document === 'undefined') return fallback
  _ctx = _ctx || document.createElement('canvas').getContext('2d')
  _ctx.fillStyle = '#000000'
  _ctx.fillStyle = color // invalid input leaves the previous value untouched
  const out = _ctx.fillStyle
  return out && out !== '#000000' ? out : (color ? out : fallback)
}

function readVar(name, fallback) {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return toRgb(v || fallback, fallback)
}

// Live theme colors, resolved to canvas-safe strings. Call inside a computed so charts
// pick up the current theme each render.
export function themeColors() {
  return {
    primary: readVar('--color-primary', '#0d9488'),
    secondary: readVar('--color-secondary', '#eab308'),
    accent: readVar('--color-accent', '#22d3ee'),
    info: readVar('--color-info', '#38bdf8'),
    success: readVar('--color-success', '#22c55e'),
    warning: readVar('--color-warning', '#f59e0b'),
    error: readVar('--color-error', '#ef4444'),
    baseContent: readVar('--color-base-content', '#e5e7eb'),
    base300: readVar('--color-base-300', '#374151'),
    // Benchmark line (SPY): deliberately neutral so the user's own series leads.
    sp500: readVar('--color-base-content', '#9ca3af'),
  }
}

// Ordered multi-series palette. Brand-led; semantic hues come last so arbitrary series
// don't accidentally read as gain/loss.
export function chartPalette() {
  const c = themeColors()
  return [
    c.primary, c.secondary, c.accent, c.info, c.success, c.warning, c.error,
    toRgb('oklch(70% 0.13 285)'), toRgb('oklch(72% 0.15 30)'), toRgb('oklch(74% 0.13 330)'),
  ]
}

// Gain/loss is semantic and must never rely on hue alone (pair with sign/arrow in UI).
export function gainLoss(positive) {
  const c = themeColors()
  return positive ? c.success : c.error
}

// Apply an alpha channel to a #rrggbb color, returning rgba(...) — parsed by both
// Chart.js and lightweight-charts. Falls back to the input untouched for non-hex strings.
export function withAlpha(color, a = 0.15) {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(color)
  if (!m) return color
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16))
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, a))})`
}
