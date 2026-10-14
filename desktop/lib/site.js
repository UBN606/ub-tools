// desktop/lib/site.js — pure helpers for the Mac app's main process, kept free
// of Electron so they can be tested with plain `node --test desktop/test/`.
//
// How the app works: the window opens the Studio at its real web address,
// https://ubn606.github.io/ub-tools/app/, and the main process answers every
// request under /ub-tools/ from the copy of the Studio bundled inside the app.
// So the app works offline from the first launch, and it keeps the website's
// origin: reading-plan progress, the cached book text and every server that
// allows the Studio (the read-aloud voices, the feedback logger) behave in the
// app exactly as they do on the web. A file the app doesn't bundle (the 100 MB
// read-along timings, for one) is fetched from the live site instead.
'use strict'

const path = require('node:path')

const SITE_ORIGIN = 'https://ubn606.github.io'
const SITE_BASE = '/ub-tools/'
const START_URL = `${SITE_ORIGIN}${SITE_BASE}app/`
const RELEASES_API = 'https://api.github.com/repos/UBN606/ub-tools/releases?per_page=30'
const RELEASES_PAGE = 'https://github.com/UBN606/ub-tools/releases/latest'
// Desktop releases are tagged desktop-v1.2.3 so they never collide with other tags.
const TAG_PREFIX = 'desktop-v'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.zip': 'application/zip',
  '.woff2': 'font/woff2',
}

function contentType(file) {
  return TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream'
}

/** True when a URL is part of the bundled Studio site. */
function isSiteUrl(raw) {
  let u
  try { u = new URL(raw) } catch { return false }
  return u.origin === SITE_ORIGIN && (u.pathname === SITE_BASE.slice(0, -1) || u.pathname.startsWith(SITE_BASE))
}

/**
 * Map a site URL to a file inside siteDir, or null when the URL is not ours or
 * would escape siteDir. A folder maps to its index.html. Does not touch disk.
 */
function localPath(siteDir, raw) {
  if (!isSiteUrl(raw)) return null
  let rel
  try { rel = decodeURIComponent(new URL(raw).pathname.slice(SITE_BASE.length)) } catch { return null }
  if (rel.includes('\0')) return null
  const root = path.resolve(siteDir)
  let file = path.resolve(root, '.' + path.sep + rel)
  if (file !== root && !file.startsWith(root + path.sep)) return null
  if (rel === '' || rel.endsWith('/')) file = path.join(file, 'index.html')
  return file
}

/**
 * What to do when the page tries to go somewhere:
 *   'internal' — a Studio page: open it in the app window
 *   'external' — the reader's browser or mail app (web links, mailto:)
 *   'block'    — anything else (file:, javascript:, custom schemes)
 */
function linkAction(raw) {
  if (isSiteUrl(raw)) return 'internal'
  let u
  try { u = new URL(raw) } catch { return 'block' }
  if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') return 'external'
  return 'block'
}

/** Parse "desktop-v1.2.3" or "1.2.3" into [1, 2, 3]; null when it isn't a version. */
function parseVersion(tag) {
  const m = /^(?:desktop-)?v?(\d+)\.(\d+)\.(\d+)$/.exec(String(tag || '').trim())
  return m ? m.slice(1).map(Number) : null
}

/** True when `latest` is a strictly newer version than `current`. */
function isNewer(latest, current) {
  const a = parseVersion(latest), b = parseVersion(current)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}

/**
 * From a GitHub releases list, the newest published desktop release
 * ({ version: [1,2,3], tag, url, dmg }) or null; dmg is the direct
 * download link to the .dmg when the release has one. Drafts and pre-releases are skipped,
 * and so is every tag that isn't desktop-vX.Y.Z, so other releases in the
 * repository never trigger an update notice.
 */
function latestDesktopRelease(list) {
  let best = null
  for (const r of Array.isArray(list) ? list : []) {
    if (!r || r.draft || r.prerelease) continue
    const tag = String(r.tag_name || '')
    if (!tag.startsWith(TAG_PREFIX)) continue
    const version = parseVersion(tag)
    if (!version) continue
    if (best && !isNewer(tag, best.tag)) continue
    const dmg = (Array.isArray(r.assets) ? r.assets : []).find((a) => a && /\.dmg$/i.test(String(a.name || '')))
    best = { version, tag, url: String(r.html_url || RELEASES_PAGE), dmg: dmg ? String(dmg.browser_download_url || '') || null : null }
  }
  return best
}

/**
 * Window bounds saved last time, checked against the screens attached now so
 * the window never reopens off-screen after a monitor is unplugged.
 * displays: [{ x, y, width, height }] (the screens' work areas).
 */
function restoreBounds(saved, displays, fallback = { width: 1200, height: 860 }) {
  const ok = saved && ['x', 'y', 'width', 'height'].every((k) => Number.isFinite(saved[k]))
  if (!ok || saved.width < 400 || saved.height < 300) return { ...fallback }
  const visible = (displays || []).some((d) =>
    saved.x < d.x + d.width - 50 && saved.x + saved.width > d.x + 50 &&
    saved.y >= d.y - 10 && saved.y < d.y + d.height - 50)
  if (!visible) return { width: saved.width, height: saved.height }
  return { x: saved.x, y: saved.y, width: saved.width, height: saved.height }
}

module.exports = {
  SITE_ORIGIN, SITE_BASE, START_URL, RELEASES_API, RELEASES_PAGE, TAG_PREFIX,
  contentType, isSiteUrl, localPath, linkAction, parseVersion, isNewer, latestDesktopRelease, restoreBounds,
}
