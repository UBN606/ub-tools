// node --test desktop/test/*.test.mjs — the Mac app's pure logic, no Electron needed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'
import { shipped } from '../scripts/stage.mjs'

const require = createRequire(import.meta.url)
const site = require('../lib/site.js')
const ROOT = path.resolve('/tmp/ub-site')

test('the window opens the Studio at its web address', () => {
  assert.equal(site.START_URL, 'https://ubn606.github.io/ub-tools/app/')
  assert.equal(site.isSiteUrl(site.START_URL), true)
})

test('site URLs map to bundled files, folders to index.html', () => {
  assert.equal(site.localPath(ROOT, 'https://ubn606.github.io/ub-tools/app/'), path.join(ROOT, 'app', 'index.html'))
  assert.equal(site.localPath(ROOT, 'https://ubn606.github.io/ub-tools/app/app.js?v=2#x'), path.join(ROOT, 'app', 'app.js'))
  assert.equal(site.localPath(ROOT, 'https://ubn606.github.io/ub-tools/ub-search.js'), path.join(ROOT, 'ub-search.js'))
  assert.equal(site.localPath(ROOT, 'https://ubn606.github.io/ub-tools/visuals/cosmos/'), path.join(ROOT, 'visuals', 'cosmos', 'index.html'))
  assert.equal(site.localPath(ROOT, 'https://ubn606.github.io/ub-tools/quote-cards/my%20card.json'), path.join(ROOT, 'quote-cards', 'my card.json'))
})

test('nothing outside the bundled site is ever served from disk', () => {
  assert.equal(site.localPath(ROOT, 'https://ubn606.github.io/ub-tools/../../etc/passwd'), null) // URL parser resolves .. out of /ub-tools/
  assert.equal(site.localPath(ROOT, 'https://ubn606.github.io/ub-tools/%2e%2e/%2e%2e/etc/passwd'), null)
  assert.equal(site.localPath(ROOT, 'https://ubn606.github.io/ub-tools/app/..%2f..%2f..%2fetc/passwd'), null)
  assert.equal(site.localPath(ROOT, 'https://ubn606.github.io/ub-tools/a%00b'), null)
  assert.equal(site.localPath(ROOT, 'https://ubn606.github.io/ub-tools/%E0%A4%A'), null) // bad escape
  assert.equal(site.localPath(ROOT, 'https://ubn606.github.io/other-repo/app/'), null)
  assert.equal(site.localPath(ROOT, 'https://ubn606.github.io/ub-tools-evil/app/'), null)
  assert.equal(site.localPath(ROOT, 'https://evil.example/ub-tools/app/'), null)
  assert.equal(site.localPath(ROOT, 'http://ubn606.github.io/ub-tools/app/'), null)
  assert.equal(site.localPath(ROOT, 'not a url'), null)
})

test('pages are told apart from their files, to pick live or bundled once per page', () => {
  assert.equal(site.isPageRequest('https://ubn606.github.io/ub-tools/app/'), true)
  assert.equal(site.isPageRequest('https://ubn606.github.io/ub-tools/app/?ref=180:2.1#top'), true)
  assert.equal(site.isPageRequest('https://ubn606.github.io/ub-tools/visuals/cosmos/index.html'), true)
  assert.equal(site.isPageRequest('https://ubn606.github.io/ub-tools/app/app.js'), false)
  assert.equal(site.isPageRequest('https://ubn606.github.io/ub-tools/entities/people.json'), false)
  // A folder without its / is redirected first (from the bundle), then loads as a page.
  assert.equal(site.isPageRequest('https://ubn606.github.io/ub-tools/app'), false)
  assert.equal(site.isPageRequest('https://example.com/'), false)
})

test('online the Studio comes from the website; offline, and a page\'s files, follow the page', () => {
  // A page goes live only when the website answered it.
  assert.equal(site.sourceFor({ page: true, liveAnswered: true }), 'live')
  assert.equal(site.sourceFor({ page: true, liveAnswered: false }), 'bundled')
  // Its files come from where the page came from, so one page is one version.
  assert.equal(site.sourceFor({ page: false, pageSource: 'live' }), 'live')
  assert.equal(site.sourceFor({ page: false, pageSource: 'bundled' }), 'bundled')
  assert.equal(site.sourceFor({ page: false }), 'bundled')
  assert.ok(site.LIVE_TIMEOUT_MS > 0 && site.LIVE_TIMEOUT_MS <= 10000, 'a slow site falls back to the bundle within seconds')
})

test('links: Studio pages stay, web and email go out, the rest is blocked', () => {
  assert.equal(site.linkAction('https://ubn606.github.io/ub-tools/visuals/cosmos/index.html'), 'internal')
  assert.equal(site.linkAction('https://urantiapedia.org/'), 'external')
  assert.equal(site.linkAction('https://www.facebook.com/sharer/sharer.php?u=x'), 'external')
  assert.equal(site.linkAction('mailto:?subject=The%20Urantia%20Book'), 'external')
  assert.equal(site.linkAction('file:///etc/passwd'), 'block')
  assert.equal(site.linkAction('javascript:alert(1)'), 'block')
  assert.equal(site.linkAction('smb://server/share'), 'block')
  assert.equal(site.linkAction(''), 'block')
})

test('content types for what the Studio serves', () => {
  assert.match(site.contentType('index.html'), /^text\/html/)
  assert.match(site.contentType('app.js'), /^text\/javascript/)
  assert.match(site.contentType('x.mjs'), /^text\/javascript/)
  assert.match(site.contentType('cards.json'), /^application\/json/)
  assert.equal(site.contentType('icon.PNG'), 'image/png')
  assert.equal(site.contentType('ub-quote-verifier.zip'), 'application/zip')
  assert.equal(site.contentType('mystery.bin'), 'application/octet-stream')
})

test('versions: only a strictly newer desktop release counts', () => {
  assert.deepEqual(site.parseVersion('desktop-v1.2.3'), [1, 2, 3])
  assert.deepEqual(site.parseVersion('1.10.0'), [1, 10, 0])
  assert.equal(site.parseVersion('desktop-v1.2'), null)
  assert.equal(site.parseVersion('v1.2.3-beta.1'), null)
  assert.equal(site.isNewer('desktop-v1.0.1', '1.0.0'), true)
  assert.equal(site.isNewer('desktop-v1.10.0', '1.9.9'), true)
  assert.equal(site.isNewer('desktop-v1.0.0', '1.0.0'), false)
  assert.equal(site.isNewer('desktop-v0.9.0', '1.0.0'), false)
  assert.equal(site.isNewer('garbage', '1.0.0'), false)
})

test('update check picks the newest published desktop release and its .dmg', () => {
  const list = [
    { tag_name: 'desktop-v1.2.0', draft: true, html_url: 'u0' },
    { tag_name: 'desktop-v1.3.0-beta', html_url: 'u1' },
    { tag_name: 'desktop-v1.1.0', prerelease: true, html_url: 'u2' },
    { tag_name: 'v9.9.9', html_url: 'u3' },
    { tag_name: 'desktop-v1.0.2', html_url: 'u4', assets: [{ name: 'UBN-Tools-mac.dmg.blockmap', browser_download_url: 'b' }, { name: 'UBN-Tools-mac.dmg', browser_download_url: 'd' }] },
    { tag_name: 'desktop-v1.0.1', html_url: 'u5' },
  ]
  assert.deepEqual(site.latestDesktopRelease(list), { version: [1, 0, 2], tag: 'desktop-v1.0.2', url: 'u4', dmg: 'd' })
  assert.equal(site.latestDesktopRelease([]), null)
  assert.equal(site.latestDesktopRelease({ message: 'API rate limit exceeded' }), null)
  assert.equal(site.latestDesktopRelease([{ tag_name: 'desktop-v1.0.0' }]).dmg, null)
})

test('window reopens where it was, never off-screen', () => {
  const screens = [{ x: 0, y: 0, width: 1440, height: 875 }]
  assert.deepEqual(site.restoreBounds({ x: 100, y: 50, width: 1000, height: 700 }, screens), { x: 100, y: 50, width: 1000, height: 700 })
  // The second monitor it was on is unplugged: keep the size, let macOS place it.
  assert.deepEqual(site.restoreBounds({ x: 2000, y: 50, width: 1000, height: 700 }, screens), { width: 1000, height: 700 })
  assert.deepEqual(site.restoreBounds(undefined, screens), { width: 1200, height: 860 })
  assert.deepEqual(site.restoreBounds({ x: 0, y: 0, width: 50, height: 50 }, screens), { width: 1200, height: 860 })
  assert.deepEqual(site.restoreBounds({ x: 'a', y: 0, width: 900, height: 700 }, screens), { width: 1200, height: 860 })
})

test('the app bundles the Studio, never the book text or development files', () => {
  for (const f of ['app/index.html', 'app/app.js', 'ub-search.js', 'ub-recall-places.json', 'visuals/cosmos/index.html', 'parallel/data/links.json', 'quote-cards/cards.json', 'extension/ub-quote-verifier.zip']) {
    assert.equal(shipped(f), true, f)
  }
  for (const f of ['source-texts/papers/Doc001.json', 'app/i18n/es.zip', 'audio/aligned/Doc001.json', 'app/test/pwa.test.mjs', 'audio/tests/test_align.py', 'audio/align.py', 'desktop/main.js', '.github/workflows/mac-app.yml', 'ub-bench/ub-bench.js', 'quote-cards/png/square/a.png', '.gitignore']) {
    assert.equal(shipped(f), false, f)
  }
})
