// Display accessibility: theme + text size (a11y.js), real contrast ratios,
// 44px tap targets, and the visuals pages' light mode + tap targets.
// The visuals pages are dark by default and gain a light mode via the pill,
// so contrast is asserted for both themes on every surface.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  THEME_KEY, SIZE_KEY, SIZE_MIN, SIZE_MAX, SIZE_DEFAULT,
  parseStoredTheme, resolveTheme, oppositeTheme,
  parseStoredSize, clampSize, stepSize, sizeClass, sizePercent,
  migrateLegacyBig, applyTheme, applySize, themeToggleState,
  STYLE_KEY, parseStoredStyle, otherStyle, applyStyle, lookToggleState,
} from '../a11y.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const repo = join(root, '..')
const css = readFileSync(join(root, 'style.css'), 'utf8')

// ---------- pure logic ----------

test('theme keys are the shared localStorage names', () => {
  assert.equal(THEME_KEY, 'ub-tools-theme')
  assert.equal(SIZE_KEY, 'ub-tools-text-size')
})

test('parseStoredTheme accepts JSON and raw values, rejects the rest', () => {
  assert.equal(parseStoredTheme('"dark"'), 'dark')
  assert.equal(parseStoredTheme('"light"'), 'light')
  assert.equal(parseStoredTheme('dark'), 'dark')
  assert.equal(parseStoredTheme('light'), 'light')
  assert.equal(parseStoredTheme(null), null)
  assert.equal(parseStoredTheme('"sepia"'), null)
  assert.equal(parseStoredTheme('banana'), null)
  assert.equal(parseStoredTheme('true'), null)
})

test('resolveTheme: saved pref wins, otherwise follows the device', () => {
  assert.equal(resolveTheme('"dark"', false), 'dark')
  assert.equal(resolveTheme('"light"', true), 'light')
  assert.equal(resolveTheme(null, true), 'dark')
  assert.equal(resolveTheme(null, false), 'light')
  assert.equal(resolveTheme('"sepia"', true), 'dark') // invalid saved -> device
})

test('oppositeTheme flips', () => {
  assert.equal(oppositeTheme('dark'), 'light')
  assert.equal(oppositeTheme('light'), 'dark')
})

test('size level parsing, clamping, and stepping', () => {
  assert.equal(parseStoredSize('2'), 2)
  assert.equal(parseStoredSize('"3"'), 3)
  assert.equal(parseStoredSize(null), null)
  assert.equal(parseStoredSize('"big"'), null)
  assert.equal(parseStoredSize('9'), 3) // stored junk clamps
  assert.equal(parseStoredSize('-2'), 0)
  assert.equal(SIZE_MIN, 0)
  assert.equal(SIZE_MAX, 3)
  assert.equal(SIZE_DEFAULT, 1)
  assert.equal(clampSize(99), 3)
  assert.equal(clampSize(-1), 0)
  assert.equal(stepSize(1, 1), 2)
  assert.equal(stepSize(3, 1), 3) // stays at the top
  assert.equal(stepSize(0, -1), 0) // stays at the bottom
  assert.equal(stepSize(2, -1), 1)
})

test('sizeClass / sizePercent map the four levels', () => {
  assert.deepEqual([0, 1, 2, 3].map(sizeClass), ['compact', '', 'big', 'bigger'])
  assert.deepEqual([0, 1, 2, 3].map(sizePercent), [90, 100, 112, 125])
})

test('migrateLegacyBig maps the old single toggle onto the scale', () => {
  assert.equal(migrateLegacyBig(true), 2) // old default was on = old html.big
  assert.equal(migrateLegacyBig(false), 1)
})

function fakeDoc() {
  const added = new Set()
  return {
    documentElement: {
      dataset: {},
      classList: {
        add: (c) => added.add(c),
        remove: (...cs) => cs.forEach((c) => added.delete(c)),
        contains: (c) => added.has(c),
      },
    },
    _added: added,
  }
}

test('applyTheme / applySize write to the document', () => {
  const d = fakeDoc()
  applyTheme(d, 'dark')
  assert.equal(d.documentElement.dataset.theme, 'dark')
  applyTheme(d, 'light')
  assert.ok(!('theme' in d.documentElement.dataset))
  applySize(d, 3)
  assert.ok(d._added.has('bigger') && !d._added.has('big'))
  applySize(d, 0)
  assert.ok(d._added.has('compact') && !d._added.has('bigger'))
  applySize(d, 1)
  assert.deepEqual([...d._added], []) // default adds no class
  applySize(d, 99)
  assert.ok(d._added.has('bigger')) // clamps
})

test('themeToggleState describes the button for each theme', () => {
  const dark = themeToggleState('dark')
  const light = themeToggleState('light')
  assert.equal(dark.pressed, true)
  assert.equal(dark.label, 'Light mode')
  assert.ok(dark.shortLabel.includes('<svg') && dark.shortLabel.includes('Light'), 'dark theme shows a sun icon + Light')
  assert.ok(!dark.shortLabel.includes('☀') && !dark.shortLabel.includes('☾'), 'no font glyphs (they misrender)')
  assert.equal(light.pressed, false)
  assert.equal(light.label, 'Dark mode')
  assert.ok(light.shortLabel.includes('<svg') && light.shortLabel.includes('Dark'), 'light theme shows a moon icon + Dark')
})

// ---------- contrast ----------

function lum(hex) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
function varsOf(cssText, selector) {
  const m = cssText.match(new RegExp(selector.replace(/[[\]{}()*+?.\\^$|]/g, '\\$&') + '\\s*\\{([^}]*)\\}'))
  const out = {}
  if (!m) return out
  for (const mm of m[1].matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) out[mm[1]] = mm[2]
  return out
}
function check(t, fg, bg, min, label) {
  const r = ratio(fg, bg)
  t.assert.ok(r >= min, `${label}: ${fg} on ${bg} = ${r.toFixed(2)} (need >= ${min})`)
}

test('Studio light theme meets contrast targets', (t) => {
  const v = varsOf(css, ':root')
  check(t, v.ink, v.ground, 7, 'body text')
  check(t, v.ink, v.chalk, 7, 'slab text')
  check(t, v.ink, v.basin, 7, 'well text')
  check(t, v.graphite, v.ground, 4.5, 'secondary text')
  check(t, v.lapis, v.ground, 4.5, 'accent text')
  check(t, v.fix, v.ground, 4.5, 'fix accent text')
  check(t, v.faint, v.ground, 4.5, 'faint metadata text')
  check(t, v.faint, v.chalk, 4.5, 'faint text on raised surfaces')
  check(t, '#ffffff', v.pass, 4.5, 'white on PASS button')
  check(t, '#ffffff', v.fix, 4.5, 'white on FIX button')
  check(t, '#F6F7F9', '#46618A', 4.5, 'go-button text on its gradient midpoint')
})

test('Studio dark theme meets contrast targets (no inversion)', (t) => {
  const v = { ...varsOf(css, ':root'), ...varsOf(css, 'html[data-theme="dark"]') }
  assert.ok(v.ground !== '#E7E5E1', 'dark theme overrides the palette')
  check(t, v.ink, v.ground, 7, 'body text')
  check(t, v.ink, v.chalk, 7, 'slab text')
  check(t, v.ink, v.basin, 7, 'well text')
  check(t, v.graphite, v.ground, 4.5, 'secondary text')
  check(t, v.lapis, v.ground, 4.5, 'accent text')
  check(t, v.fix, v.ground, 4.5, 'fix accent text')
  check(t, v.faint, v.ground, 4.5, 'faint metadata text')
  // white text would fail on the lightened greens/ambers, so dark mode uses dark text there
  check(t, '#23262B', v.pass, 4.5, 'seal text on PASS green')
  check(t, '#2A2013', v.fix, 4.5, 'stop-button text on FIX amber')
})

// The Cosmic look sets its own palette; Classic's tokens must not leak into it.
const COSMIC = 'html[data-style="cosmic"]'
const COSMIC_DARK = 'html[data-style="cosmic"][data-theme="dark"]'

test('Cosmic light (aurora dawn) meets contrast targets', (t) => {
  const v = { ...varsOf(css, ':root'), ...varsOf(css, COSMIC) }
  assert.ok(v.ground !== '#E7E5E1', 'cosmic overrides the palette')
  check(t, v.ink, v.ground, 7, 'body text')
  check(t, v.ink, v.chalk, 7, 'panel text')
  check(t, v.ink, v.basin, 7, 'well text')
  check(t, v.graphite, v.ground, 4.5, 'secondary text')
  check(t, v.faint, v.ground, 4.5, 'faint metadata text')
  check(t, v.faint, v.chalk, 4.5, 'faint text on panels')
  check(t, v.lapis, v.ground, 4.5, 'accent text')
  check(t, v.fix, v.chalk, 4.5, 'gold eyebrow on panels')
  check(t, '#ffffff', v.fix, 4.5, 'white cite chip on gold')
  check(t, '#ffffff', v.pass, 4.5, 'white on PASS')
})

test('Cosmic dark (deep space) meets contrast targets', (t) => {
  const v = { ...varsOf(css, ':root'), ...varsOf(css, COSMIC), ...varsOf(css, COSMIC_DARK) }
  assert.ok(v.ground !== '#F7F5FF', 'cosmic dark overrides cosmic light')
  check(t, v.ink, v.ground, 7, 'body text')
  check(t, v.ink, v.chalk, 7, 'panel text')
  check(t, v.ink, v.basin, 7, 'well text')
  check(t, v.graphite, v.ground, 4.5, 'secondary text')
  check(t, v.faint, v.ground, 4.5, 'faint metadata text')
  check(t, v.faint, v.chalk, 4.5, 'faint text on panels')
  check(t, v.lapis, v.chalk, 4.5, 'accent text on panels')
  check(t, v.fix, v.chalk, 4.5, 'gold eyebrow on panels')
  check(t, '#1A1300', v.fix, 4.5, 'dark cite chip text on gold')
  check(t, '#07060F', v.pass, 4.5, 'seal text on PASS')
})

test('Cosmic primary button keeps white text readable across its gradient', (t) => {
  for (const stop of ['#5B3FE0', '#4A56E6', '#3A6FE0']) check(t, '#ffffff', stop, 4.5, `go button at ${stop}`)
  assert.ok(css.includes('linear-gradient(120deg,#5B3FE0 0%,#4A56E6 50%,#3A6FE0 100%)'), 'gradient stops match the test')
})

test('Cosmic motion stops under prefers-reduced-motion', () => {
  const m = css.match(/@media \(prefers-reduced-motion: reduce\)\{\s*html\[data-style="cosmic"\][^@]*/)
  assert.ok(m && /animation:none/.test(m[0]) && /transition:none/.test(m[0]), 'reduced-motion block for cosmic')
})

test('Look setting: Classic by default, Cosmic only when chosen', () => {
  assert.equal(STYLE_KEY, 'ub-tools-style')
  assert.equal(parseStoredStyle(null), 'classic')
  assert.equal(parseStoredStyle('"cosmic"'), 'cosmic')
  assert.equal(parseStoredStyle('cosmic'), 'cosmic')
  assert.equal(parseStoredStyle('"neon"'), 'classic')
  assert.equal(otherStyle('classic'), 'cosmic')
  assert.equal(otherStyle('cosmic'), 'classic')
  const d = { documentElement: { dataset: {} } }
  applyStyle(d, 'cosmic'); assert.equal(d.documentElement.dataset.style, 'cosmic')
  applyStyle(d, 'classic'); assert.equal(d.documentElement.dataset.style, undefined)
  const c = lookToggleState('classic'), k = lookToggleState('cosmic')
  assert.equal(c.pressed, false); assert.match(c.shortLabel, /Cosmic/); assert.match(c.shortLabel, /<svg/)
  assert.equal(k.pressed, true); assert.match(k.shortLabel, /Classic/)
})

test('app.js imports every a11y constant it uses', () => {
  // SIZE_MIN was used but never imported, so the text-size button threw at A++ and
  // readers could never make the text smaller again.
  const app = readFileSync(join(root, 'app.js'), 'utf8')
  const imp = app.match(/import \{([^}]*)\} from '\.\/a11y\.js'/)[1].split(',').map((x) => x.trim())
  const local = new Set([...app.matchAll(/\b(?:const|let|var)\s+([A-Z_]+)\b/g)].map((m) => m[1]))
  for (const name of new Set(app.match(/\b(SIZE_[A-Z]+|THEME_KEY|STYLE_KEY)\b/g))) {
    if (!local.has(name)) assert.ok(imp.includes(name), `${name} is used in app.js but not imported`)
  }
})

test('extra size levels have real CSS rules', () => {
  assert.ok(css.includes('html.bigger'), 'html.bigger rules exist')
  assert.ok(css.includes('html.compact'), 'html.compact rules exist')
  assert.ok(css.includes('html[data-theme="dark"]'), 'dark theme block exists')
})

// ---------- tap targets ----------

function rules(cssText) {
  const clean = cssText.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    sels: m[1].split(',').map((s) => s.trim()),
    body: m[2],
  }))
}

test('Studio interactive controls are at least 44px tall', (t) => {
  const rs = rules(css)
  const minHeight = (target) => {
    const hit = rs.filter((r) => r.sels.includes(target))
    return Math.max(0, ...hit.map((r) => {
      const m = r.body.match(/min-height\s*:\s*(\d+)px/)
      return m ? +m[1] : 0
    }))
  }
  for (const sel of ['.soft', '.go', '.chip', '.topnav button', '.modes button', '.mic',
    '.p-controls button', '.share-btn', '.quiz-typein input', '.voice-pick select',
    '.ra-select', '.sel-bar button', '.row > button', '.quiz .soft[data-pick]']) {
    t.assert.ok(minHeight(sel) >= 44, `${sel} min-height >= 44px`)
  }
  const closeHit = rs.some((r) => r.sels.includes('.close') && /width\s*:\s*44px/.test(r.body) && /height\s*:\s*44px/.test(r.body))
  t.assert.ok(closeHit, '.close is 44x44')
  const tog = rs.find((r) => r.sels.includes('.read-toggle::before'))
  t.assert.ok(tog && /inset\s*:\s*-12px/.test(tog.body), 'read-toggle has a 44px hit area via ::before')
})

test('index.html carries the display controls and pre-paint script', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8')
  for (const id of ['theme-toggle', 'size-cycle']) {
    assert.ok(html.includes(`id="${id}"`), `button #${id} exists`)
  }
  assert.ok(!html.includes('id="bigger"'), 'old single toggle is gone')
  assert.ok(html.includes("localStorage.getItem('ub-tools-theme')"), 'pre-paint theme script present')
  assert.ok(html.includes("localStorage.getItem('ub-tools-text-size')"), 'pre-paint size script present')
  assert.ok(html.includes('cycles through text sizes'), 'help text documents the size button')
})

// ---------- visuals pages ----------

const pages = ['cosmos', 'timeline', 'maps', 'genealogy']
const pageHtml = Object.fromEntries(pages.map((p) => [p, readFileSync(join(repo, 'visuals', p, 'index.html'), 'utf8')]))

test('each visuals page has the display pill, pre-paint script, and light theme', (t) => {
  for (const p of pages) {
    const h = pageHtml[p]
    for (const id of ['ub-theme', 'ub-sdec', 'ub-sreset', 'ub-sinc']) {
      t.assert.ok(h.includes(`id="${id}"`), `${p}: pill button #${id} present`)
    }
    t.assert.ok(h.includes("ub-tools-theme") && h.includes('prefers-color-scheme'), `${p}: pre-paint theme script`)
    t.assert.ok(h.includes("ub-tools-text-size"), `${p}: pre-paint size script`)
    t.assert.ok(h.includes('[data-theme="light"]'), `${p}: light theme CSS block`)
    t.assert.ok(h.includes('role="group"') && h.includes('aria-label="Display settings"'), `${p}: pill is a labeled group`)
  }
})

test('each visuals page meets contrast targets in both themes', (t) => {
  const want = {
    cosmos: { base: [':root'], ink: 'ink', bg: 'bg', muted: 'muted', gold: 'gold' },
    timeline: { base: [':root'], ink: 'text', bg: 'bg', muted: 'muted', gold: 'gold-hi' },
    maps: { base: [':root'], ink: 'ink', bg: 'bg', muted: 'muted', gold: 'gold' },
    genealogy: { base: [':root'], ink: 'ink', bg: 'bg', muted: 'muted', gold: 'gold' },
  }
  for (const p of pages) {
    const h = pageHtml[p]
    const w = want[p]
    const dark = varsOf(h, ':root')
    const light = { ...dark, ...varsOf(h, '[data-theme="light"]') }
    check(t, dark[w.ink], dark[w.bg], 7, `${p} dark: main text`)
    check(t, dark[w.muted], dark[w.bg], 4.5, `${p} dark: muted text`)
    check(t, dark[w.gold], dark[w.bg], 4.5, `${p} dark: gold accents`)
    check(t, light[w.ink], light[w.bg], 7, `${p} light: main text`)
    check(t, light[w.muted], light[w.bg], 4.5, `${p} light: muted text`)
    check(t, light[w.gold], light[w.bg], 4.5, `${p} light: gold accents`)
  }
})

test('visuals tap targets are 44px or have halos', (t) => {
  const h = pageHtml
  t.assert.ok(h.cosmos.includes('a11y-touch-halo'), 'cosmos: satellite tap halos')
  t.assert.ok(h.maps.includes('a11y-touch-halo'), 'maps: dot tap halos')
  t.assert.ok(/\.node::after\s*\{[^}]*inset\s*:\s*-15px/.test(h.timeline), 'timeline: node tap halo via ::after')
  t.assert.ok(h.genealogy.includes('.node:focus-visible'), 'genealogy: keyboard focus style on tree nodes')
  for (const p of pages) {
    t.assert.ok(/\.ub-a11y button\{[^}]*min-height\s*:\s*44px/.test(h[p]), `${p}: pill buttons 44px`)
  }
  t.assert.ok(h.cosmos.includes('#rgrid button{min-height:44px}'), 'cosmos: region buttons 44px')
  t.assert.ok(h.timeline.includes('.tl-nav button{min-height:44px}'), 'timeline: nav buttons 44px')
  t.assert.ok(h.timeline.includes('.egrid button{min-height:44px}'), 'timeline: index buttons 44px')
  t.assert.ok(h.genealogy.includes('nav.tabs button{min-height:44px}'), 'genealogy: tab buttons 44px')
})

test('visuals keep visible keyboard focus everywhere', (t) => {
  const h = pageHtml
  t.assert.ok(h.cosmos.includes('.region:focus-visible'), 'cosmos region focus')
  t.assert.ok(h.maps.includes('.dot:focus-visible'), 'maps dot focus')
  t.assert.ok(h.timeline.includes('.node:focus-visible'), 'timeline node focus')
  t.assert.ok(h.timeline.includes('.tl-nav button:focus-visible'), 'timeline nav focus')
  t.assert.ok(h.genealogy.includes('.node:focus-visible'), 'genealogy node focus')
  for (const p of pages) {
    t.assert.ok(h[p].includes('.ub-a11y button:focus-visible'), `${p}: pill focus`)
  }
})
