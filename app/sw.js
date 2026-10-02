// sw.js — offline shell for UB Tools Studio.
// The app shell (HTML/CSS/JS/data) is cached on install so the Studio opens
// without a network. Book text is cached as it is read (stale-while-revalidate)
// so papers keep working offline after the first visit. Version the cache name
// when the shell changes.
'use strict'

const VERSION = 'ub-tools-v10'
const SHELL_CACHE = VERSION + '-shell'
const TEXT_CACHE = VERSION + '-text'
const MAX_TEXT_ENTRIES = 250

const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './style.css', './app.js', './engine.js', './tools.js', './explore.js',
  './quiz.js', './plans.js', './readalong.js', './deep-link.js', './a11y.js',
  './share.js', './topics.js', './ask.js', './embed-quote.js', './edge-voices.js',
  './plans-data.json', './quiz-bank.json', './pronounce.json', './ubn-articles.json',
  './icons/icon-192.png', './icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
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
