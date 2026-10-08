// sw.js — offline shell for UB Tools Studio.
// The app shell (HTML/CSS/JS/data) is cached on install so the Studio opens
// without a network. Book text is cached as it is read (stale-while-revalidate)
// so papers keep working offline after the first visit.
//
// VERSIONING — read this before pushing:
//   The browser only checks for a new service worker when THIS FILE's bytes
//   change. Run `node scripts/bump-sw.mjs` from the repo root before every
//   push to main; it stamps a fresh timestamp into VERSION below. Without
//   that step, readers keep the old cached app until their browser happens
//   to re-fetch (up to 24h on some hosts).
//   Update flow: new SW installs in the background, activates right away,
//   and takes control. The page notices (see app/pwa.js) and shows one gentle
//   "A new version is ready" banner with Reload / Later. We activate
//   immediately instead of waiting for the reader on purpose: older cached
//   pages have no banner code, and a waiting worker they can never dismiss
//   would strand them on the old version forever.
'use strict'

const VERSION = 'ub-tools-20261008T072335'
const SHELL_CACHE = VERSION + '-shell'
const TEXT_CACHE = VERSION + '-text'
const MAX_TEXT_ENTRIES = 250

const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './style.css', './app.js', './engine.js', './tools.js', './explore.js',
  './quiz.js', './plans.js', './readalong.js', './deep-link.js', './a11y.js',
  './pwa.js', './share.js', './topics.js', './ask.js', './ask-format.js', './embed-quote.js', './edge-voices.js',
  './lang-detect.js', './parse-i18n.js', './ask-i18n.js', './load-translation.js',
  './read-lang.js', './study-tracks.js', './chat.js',
  './plans-data.json', './quiz-bank.json', './pronounce.json', './ubn-articles.json',
  './icons/icon-192.png', './icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Kept for forward compatibility: the page may ask a waiting worker to
// activate (harmless today since install() already skips waiting).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

async function cacheFirst(request) {
  const hit = await caches.match(request, { cacheName: SHELL_CACHE })
  if (hit) return hit
  const res = await fetch(request)
  if (res && res.ok) {
    const cache = await caches.open(SHELL_CACHE)
    cache.put(request, res.clone())
  }
  return res
}

async function trimTextCache() {
  const cache = await caches.open(TEXT_CACHE)
  const keys = await cache.keys()
  if (keys.length > MAX_TEXT_ENTRIES) {
    await cache.delete(keys[0])
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(TEXT_CACHE)
  const hit = await cache.match(request)
  const network = fetch(request).then((res) => {
    if (res && res.ok) {
      cache.put(request, res.clone())
      trimTextCache()
    }
    return res
  }).catch(() => null)
  return hit || network || fetch(request)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request))
  } else if (/\.json$/i.test(url.pathname)) {
    // Book text and topic data from the remote source.
    event.respondWith(staleWhileRevalidate(request))
  }
})
