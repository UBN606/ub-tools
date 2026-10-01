// UB Tools Studio: display accessibility — theme + text size.
// Pure logic only. DOM wiring lives in app.js; the inline <head> snippet in
// index.html duplicates the tiny "apply early" path so first paint is correct.
// Storage values are JSON-encoded (same convention as app.js's store).

export const THEME_KEY = 'ub-tools-theme'
export const SIZE_KEY = 'ub-tools-text-size'

// Text-size levels: 0 compact · 1 default · 2 large · 3 extra large.
// Level 2 reuses the long-standing `html.big` styles; 0 and 3 add `compact`/`bigger`.
export const SIZE_MIN = 0
export const SIZE_MAX = 3
export const SIZE_DEFAULT = 1
const SIZE_CLASSES = ['compact', '', 'big', 'bigger']
// Root font-size percentages for rem-based pages (the visuals/ pages).
const SIZE_PCTS = [90, 100, 112, 125]

export function parseStoredTheme(raw) {
  if (raw == null) return null
  let v = raw
  try { v = JSON.parse(raw) } catch { /* keep raw */ }
  return v === 'light' || v === 'dark' ? v : null
}

// saved: raw localStorage value (or null). prefersDark: matchMedia('(prefers-color-scheme: dark)').matches
export function resolveTheme(saved, prefersDark) {
  const s = parseStoredTheme(saved)
  if (s) return s
  return prefersDark ? 'dark' : 'light'
}

export function oppositeTheme(theme) {
  return theme === 'dark' ? 'light' : 'dark'
}

export function parseStoredSize(raw) {
  if (raw == null) return null
  let v
  try { v = JSON.parse(raw) } catch { v = raw }
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isInteger(n) ? clampSize(n) : null
}

export function clampSize(n) {
  const t = typeof n === 'number' && !Number.isNaN(n) ? Math.trunc(n) : SIZE_DEFAULT
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, t))
}

// delta: +1 (A+) or -1 (A−). Never leaves [SIZE_MIN, SIZE_MAX].
export function stepSize(current, delta) {
  return clampSize(clampSize(current) + (delta > 0 ? 1 : -1))
}

export function sizeClass(level) {
  return SIZE_CLASSES[clampSize(level)]
}

export function sizePercent(level) {
  return SIZE_PCTS[clampSize(level)]
}

// The old single "Larger text" toggle stored a boolean under 'big' (default true).
// Map it onto the new scale once, then the new key wins.
export function migrateLegacyBig(big) {
  return big ? 2 : 1
}

// --- DOM application (tested with a minimal fake document) ---

export function applyTheme(doc, theme) {
  const el = doc.documentElement
  if (theme === 'dark') el.dataset.theme = 'dark'
  else delete el.dataset.theme
  return theme
}

export function applySize(doc, level) {
  const n = clampSize(level)
  const el = doc.documentElement
  el.classList.remove('compact', 'big', 'bigger')
  const c = sizeClass(n)
  if (c) el.classList.add(c)
  return n
}

// Inline SVG icons for the theme toggle (font glyphs like ☾ render as "C"
// in the header font on some systems).
const ICON_MOON = '<svg class="ticon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M20 13.2A8.2 8.2 0 1 1 10.8 4a6.6 6.6 0 0 0 9.2 9.2z"/></svg>'
const ICON_SUN = '<svg class="ticon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7"/></svg>'

// Button label/pressed state for the theme toggle. shortLabel is HTML.
export function themeToggleState(theme) {
  const dark = theme === 'dark'
  return {
    pressed: dark,
    label: dark ? 'Light mode' : 'Dark mode',
    shortLabel: dark ? `${ICON_SUN} Light` : `${ICON_MOON} Dark`,
  }
}
