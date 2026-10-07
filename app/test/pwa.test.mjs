// node --test app/test/pwa.test.mjs
// The PWA install bits: a valid manifest with icons that exist on disk.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(appDir, 'manifest.webmanifest'), 'utf8'))

test('manifest has the fields browsers require', () => {
  assert.ok(manifest.name && manifest.name.length > 0, 'name')
  assert.ok(manifest.short_name && manifest.short_name.length > 0, 'short_name')
  assert.ok(manifest.start_url, 'start_url')
  assert.equal(manifest.display, 'standalone')
  assert.ok(manifest.theme_color, 'theme_color')
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'icons')
})

test('manifest icons exist on disk at the declared sizes', () => {
  const sizes = new Set()
  for (const icon of manifest.icons) {
    assert.ok(icon.src && icon.sizes && icon.type === 'image/png', `icon entry malformed: ${icon.src}`)
    const disk = join(appDir, icon.src.replace(/^\.\//, ''))
    assert.ok(existsSync(disk), `missing icon file: ${icon.src}`)
    sizes.add(icon.sizes)
  }
  assert.ok(sizes.has('192x192'), 'needs a 192px icon')
  assert.ok(sizes.has('512x512'), 'needs a 512px icon')
})

test('index.html links the manifest', () => {
  const html = readFileSync(join(appDir, 'index.html'), 'utf8')
  assert.ok(html.includes('rel="manifest"'), 'no manifest link in index.html')
  assert.ok(html.includes('apple-touch-icon'), 'no apple touch icon in index.html')
})

// ---------- manifest additions ----------

test('manifest has categories, shortcuts, and screenshots', () => {
  assert.ok(Array.isArray(manifest.categories) && manifest.categories.includes('books'), 'categories')
  assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 1, 'shortcuts')
  for (const s of manifest.shortcuts) {
    assert.ok(s.name && s.url, `shortcut malformed: ${JSON.stringify(s)}`)
    assert.ok(s.url.startsWith('./index.html?mode='), `shortcut url should deep-link a tab: ${s.url}`)
    assert.ok(Array.isArray(s.icons) && s.icons.length > 0, `shortcut needs icons: ${s.name}`)
  }
  assert.ok(Array.isArray(manifest.screenshots) && manifest.screenshots.length >= 1, 'screenshots')
  for (const shot of manifest.screenshots) {
    const disk = join(appDir, shot.src.replace(/^\.\//, ''))
    assert.ok(existsSync(disk), `missing screenshot file: ${shot.src}`)
    assert.equal(shot.sizes, '1080x1920', `screenshot should be phone-sized: ${shot.src}`)
  }
})

test('index.html has the iOS status-bar meta', () => {
  const html = readFileSync(join(appDir, 'index.html'), 'utf8')
  assert.ok(html.includes('apple-mobile-web-app-status-bar-style'), 'no status-bar-style meta')
})

// ---------- sw.js ----------

test('sw.js is versioned, skippable, and caches pwa.js', () => {
  const sw = readFileSync(join(appDir, 'sw.js'), 'utf8')
  assert.match(sw, /const VERSION = 'ub-tools-\d{8}T\d{6}'/, 'VERSION should be a timestamp stamp (bump-sw.mjs)')
  assert.ok(sw.includes("type === 'SKIP_WAITING'"), 'no SKIP_WAITING message handler')
  assert.ok(sw.includes("'./pwa.js'"), 'pwa.js not in the shell cache list')
})

test('bump-sw.mjs stamps a fresh version', async () => {
  const { execFileSync } = await import('node:child_process')
  const before = readFileSync(join(appDir, 'sw.js'), 'utf8')
  execFileSync('node', [join(repoRoot(), 'scripts', 'bump-sw.mjs')], { stdio: 'pipe' })
  const after = readFileSync(join(appDir, 'sw.js'), 'utf8')
  assert.match(after, /const VERSION = 'ub-tools-\d{8}T\d{6}'/, 'bump did not stamp a version')
  writeFileSync(join(appDir, 'sw.js'), before) // leave the tree as found
})

// ---------- pwa.js pure logic ----------

function repoRoot() {
  return join(appDir, '..')
}

import {
  isSnoozed, updateSnoozeUntil, installDismissUntil,
  nextVisitCount, isStandaloneDisplay, isIOS, shouldShowInstallPrompt,
  buildUpdateBanner, buildInstallBanner, buildOnlineBadge,
  UPDATE_SNOOZE_HOURS, INSTALL_MIN_VISITS, INSTALL_SNOOZE_DAYS,
} from '../pwa.js'
import { writeFileSync } from 'node:fs'

test('snooze math: dismissed stays quiet until the window passes', () => {
  const now = 1_000_000
  assert.equal(isSnoozed(String(now + 1000), now), true)
  assert.equal(isSnoozed(String(now - 1000), now), false)
  assert.equal(isSnoozed(null, now), false)
  assert.equal(isSnoozed('garbage', now), false)
  assert.equal(updateSnoozeUntil(now) - now, UPDATE_SNOOZE_HOURS * 3600 * 1000)
  assert.equal(installDismissUntil(now) - now, INSTALL_SNOOZE_DAYS * 24 * 3600 * 1000)
})

test('visit counting never goes NaN or negative', () => {
  assert.equal(nextVisitCount(null), 1)
  assert.equal(nextVisitCount('nope'), 1)
  assert.equal(nextVisitCount(-4), 1)
  assert.equal(nextVisitCount('2'), 3)
  assert.equal(nextVisitCount(2.9), 3)
})

test('install nudge gating: gentle by default', () => {
  const base = { dismissedUntilRaw: null, nowMs: 1_000_000, standalone: false, hasPrompt: true, ios: false }
  assert.equal(shouldShowInstallPrompt({ ...base, visits: 1 }), false, 'too early: visit 1')
  assert.equal(shouldShowInstallPrompt({ ...base, visits: INSTALL_MIN_VISITS }), true, 'visit threshold')
  assert.equal(shouldShowInstallPrompt({ ...base, visits: 9, standalone: true }), false, 'already installed')
  assert.equal(
    shouldShowInstallPrompt({ ...base, visits: 9, dismissedUntilRaw: String(2_000_000) }),
    false, 'dismissed recently'
  )
  assert.equal(
    shouldShowInstallPrompt({ ...base, visits: 9, dismissedUntilRaw: String(500_000) }),
    true, 'dismissal expired'
  )
  // iOS never has a native prompt; it gets instructions instead.
  assert.equal(shouldShowInstallPrompt({ ...base, visits: 9, hasPrompt: false, ios: true }), true, 'iOS path')
  assert.equal(shouldShowInstallPrompt({ ...base, visits: 9, hasPrompt: false, ios: false }), false, 'no prompt yet')
})

test('standalone + iOS detection', () => {
  assert.equal(isStandaloneDisplay({ matchMediaStandalone: true }), true)
  assert.equal(isStandaloneDisplay({ navigatorStandalone: true }), true)
  assert.equal(isStandaloneDisplay({}), false)
  assert.equal(isIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), true)
  assert.equal(isIOS('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), true)
  assert.equal(isIOS('Mozilla/5.0 (Linux; Android 14)'), false)
  assert.equal(isIOS('Mozilla/5.0 (Windows NT 10.0)'), false)
})

// ---------- pwa.js DOM builders (fake document) ----------

function fakeEl(tag) {
  const listeners = {}
  const children = []
  return {
    tag, children,
    className: '',
    textContent: '',
    type: '',
    dataset: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c) },
      contains(c) { return this._s.has(c) },
    },
    setAttribute(k, v) { this['attr:' + k] = v },
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn) },
    appendChild(c) { children.push(c); return c },
    remove() { this.removed = true },
    click() { (listeners.click || []).forEach((fn) => fn()) },
    query(cls) {
      // depth-first search for a child whose className contains cls
      const stack = [...children]
      while (stack.length) {
        const n = stack.shift()
        if (n.className && n.className.split(' ').includes(cls)) return n
        stack.push(...(n.children || []))
      }
      return null
    },
  }
}

function fakeDoc() {
  return { createElement: (t) => fakeEl(t) }
}

test('update banner: copy, buttons, and callbacks', () => {
  let updated = 0, latered = 0
  const bar = buildUpdateBanner(fakeDoc(), { onUpdate: () => updated++, onLater: () => latered++ })
  assert.equal(bar.className, 'pwa-banner')
  assert.equal(bar['attr:role'], 'status')
  const text = bar.query('pwa-banner-text')
  assert.ok(text && /new version/i.test(text.textContent), 'banner should say a new version is ready')
  const primary = bar.query('pwa-btn-primary')
  assert.ok(primary, 'needs a primary action')
  primary.click()
  assert.equal(updated, 1)
  // find the Later button (pwa-btn without pwa-btn-primary)
  const later = bar.children[1].children.find((c) => c.className === 'pwa-btn')
  assert.ok(later, 'needs a Later/dismiss action')
  later.click()
  assert.equal(latered, 1)
})

test('install banner: iOS wording vs native prompt wording', () => {
  const iosBar = buildInstallBanner(fakeDoc(), { ios: true, onInstall: () => {}, onDismiss: () => {} })
  assert.ok(/Add to Home Screen/.test(iosBar.query('pwa-banner-text').textContent), 'iOS needs Share-menu instructions')
  assert.ok(iosBar.query('pwa-btn-primary'), 'iOS still gets an acknowledge button')
  const andBar = buildInstallBanner(fakeDoc(), { ios: false, onInstall: () => {}, onDismiss: () => {} })
  assert.equal(andBar.query('pwa-btn-primary').textContent, 'Add to Home Screen')
  const notNow = andBar.children[1].children.find((c) => c.className === 'pwa-btn')
  assert.ok(notNow && notNow.textContent === 'Not now', 'dismiss must be easy to find')
})

test('offline badge copy', () => {
  const off = buildOnlineBadge(fakeDoc(), false)
  assert.ok(/offline/i.test(off.textContent), 'offline badge should say offline')
  assert.ok(/saved content/i.test(off.textContent), 'offline badge should reassure about saved content')
  const on = buildOnlineBadge(fakeDoc(), true)
  assert.ok(/back online/i.test(on.textContent), 'reconnect badge should confirm')
  assert.ok(on.classList.contains('is-back'))
})

test('app.js wires pwa.js in place of the old inline registration', () => {
  const js = readFileSync(join(appDir, 'app.js'), 'utf8')
  assert.ok(js.includes("from './pwa.js'"), 'app.js should import pwa.js')
  assert.ok(js.includes('initPWA()'), 'app.js should call initPWA()')
  assert.ok(!js.includes('serviceWorker.register'), 'old inline registration should be gone')
})
