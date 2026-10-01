// load-translation.js — fetch an official Urantia Book translation at runtime.
//
// The Foundation's translations never live in this repo (rights). Instead the
// reader's browser downloads the official ZIP from urantia.org, extracts the
// single .txt inside it with no dependencies, parses it with parse-i18n.js, and
// caches the parsed papers in IndexedDB. Nothing is redistributed: the text
// comes straight from the official source to the reader.
//
// Note (2026-10-01): urantia.org does not send CORS headers, so a direct
// browser fetch is blocked. The loader tries the official URL first, then
// falls back to a public CORS proxy for the same official file. If the
// Foundation ever adds Access-Control-Allow-Origin to their downloads, the
// direct fetch just starts working.
import { parseTranslation } from './parse-i18n.js'

export const TRANSLATION_URLS = {
  es: 'https://urantia.org/sites/default/files/book/es/uf-spa-419-1993-1.9-txt.zip',
  fr: 'https://urantia.org/sites/default/files/book/fr/uf-fre-001-1960-3.5-txt.zip',
  ko: 'https://urantia.org/sites/default/files/book/ko/uf-kor-001-2000-1.4-txt.zip',
}
const CORS_PROXY = (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`

const LANG_NAMES = { es: 'Spanish', fr: 'French', ko: 'Korean' }
const LOAD_ERROR = (lang) =>
  `Couldn't load the ${LANG_NAMES[lang] || ''} text — check your connection and try again.`.replace('  ', ' ')

// ---------- pure zip helpers (no dependencies) ----------
// These zips each hold exactly one deflated .txt file. We read the local file
// header by hand and inflate the raw deflate stream with DecompressionStream.

export function readFirstFile(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length < 30 || dv.getUint32(0, true) !== 0x04034b50) throw new Error('not a zip file')
  const method = dv.getUint16(8, true)
  const flags = dv.getUint16(6, true)
  let compSize = dv.getUint32(18, true)
  const fnLen = dv.getUint16(26, true)
  const extraLen = dv.getUint16(28, true)
  const start = 30 + fnLen + extraLen
  if ((flags & 0x08) || compSize === 0) {
    // A data descriptor follows the file data, so the true sizes live in the
    // central directory (this is how the official zips are written).
    let eocd = -1
    for (let i = bytes.length - 22; i >= 0; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
    }
    if (eocd < 0) throw new Error('zip directory not found')
    const cdOff = dv.getUint32(eocd + 16, true)
    const cd = new DataView(bytes.buffer, bytes.byteOffset + cdOff, 46)
    if (cd.getUint32(0, true) !== 0x02014b50) throw new Error('zip directory corrupt')
    const cdFnLen = cd.getUint16(28, true)
    const cdName = new Uint8Array(bytes.buffer, bytes.byteOffset + cdOff + 46, cdFnLen)
    const name = bytes.subarray(30, 30 + fnLen)
    const same = cdName.length === name.length && cdName.every((v, i) => v === name[i])
    if (!same) throw new Error('zip directory mismatch')
    compSize = cd.getUint32(20, true)
  }
  if (start + compSize > bytes.length) throw new Error('zip is truncated')
  return { method, data: bytes.subarray(start, start + compSize) }
}

export async function inflateRawDeflate(data) {
  // Zip entries are raw DEFLATE streams: 'deflate-raw' is the spec-correct
  // format ('deflate' means zlib-wrapped in some engines, including node).
  const input = new Blob([data]).stream()
  let stream = null
  for (const format of ['deflate-raw', 'deflate']) {
    try {
      stream = input.pipeThrough(new DecompressionStream(format))
      break
    } catch { /* this engine lacks the format; try the next */ }
  }
  if (!stream) throw new Error('no inflate support')
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function extractSingleTxt(bytes) {
  const { method, data } = readFirstFile(bytes)
  const raw = method === 8 ? await inflateRawDeflate(data)
    : method === 0 ? data
    : (() => { throw new Error('unsupported zip compression') })()
  return new TextDecoder('utf-8').decode(raw)
}

// ---------- storage (IndexedDB, injectable for tests) ----------
const DB = 'ub-studio'
const STORE = 'translations'

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no IndexedDB'))
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'))
  })
}

async function idbTx(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IndexedDB failed'))
  })
}

const defaultStorage = {
  get: (k) => idbTx('readonly', (s) => s.get(k)).catch(() => null),
  set: (k, v) => idbTx('readwrite', (s) => s.put(v, k)).catch(() => null),
}

// In-memory cache so a session never parses twice.
const memCache = new Map()
export const clearTranslationCache = () => memCache.clear()

async function fetchBytes(fetchFn, url) {
  const res = await fetchFn(url)
  if (!res || !res.ok) throw new Error(`fetch failed: ${url}`)
  const buf = await res.arrayBuffer()
  return new Uint8Array(buf)
}

// Load (and cache) the parsed papers for a translation language.
// storage/fetchFn/parseFn are injectable so node --test can drive this.
// authorProvider(paperIndex) -> English author name: the Spanish text doesn't
// name its authors, so the parser backfills them from the English book.
export async function loadTranslation(lang, { storage, fetchFn = fetch, parseFn = parseTranslation, authorProvider } = {}) {
  if (!TRANSLATION_URLS[lang]) throw new Error('unknown language: ' + lang)
  if (memCache.has(lang)) return memCache.get(lang)
  const store = storage || defaultStorage
  const key = `ub-i18n-${lang}`
  try {
    const cached = await store.get(key)
    if (cached && cached.papers && cached.papers.length === 197) {
      memCache.set(lang, cached.papers)
      return cached.papers
    }
  } catch { /* fall through to fetch */ }
  const url = TRANSLATION_URLS[lang]
  let buf = null
  try {
    buf = await fetchBytes(fetchFn, url)
  } catch {
    try { buf = await fetchBytes(fetchFn, CORS_PROXY(url)) } catch { buf = null }
  }
  if (!buf) throw new Error(LOAD_ERROR(lang))
  let papers = null
  try {
    const out = parseFn(await extractSingleTxt(buf), lang, authorProvider ? { englishAuthor: authorProvider } : {})
    papers = Array.isArray(out) ? out : (out && out.docs)
  } catch { papers = null }
  if (!papers || papers.length !== 197) throw new Error(LOAD_ERROR(lang))
  try { await store.set(key, { papers, savedAt: Date.now() }) } catch { /* cache is a nicety */ }
  memCache.set(lang, papers)
  return papers
}
