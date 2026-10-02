// node --test app/test/load-translation.test.mjs
// The translation loader fetches the official ZIP from urantia.org, extracts the
// single .txt inside it with no dependencies, parses it, and caches it. These
// tests drive the pure zip helpers and the loader wiring with injected fakes —
// no UB text is ever committed, not even in fixtures.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import {
  readFirstFile, extractSingleTxt, loadTranslation, clearTranslationCache,
  TRANSLATION_URLS, LOCAL_URLS,
} from '../load-translation.js'
import { toggleLangs } from '../ask-format.js'

// Build a minimal single-file zip in-test: local file header + file data.
// Never contains UB text — just a short synthetic string.
function makeZip(text, method = 8) {
  const raw = Buffer.from(text, 'utf-8')
  const data = method === 8 ? deflateRawSync(raw) : raw
  const name = Buffer.from('test.txt', 'utf-8')
  const head = Buffer.alloc(30)
  head.writeUInt32LE(0x04034b50, 0)
  head.writeUInt16LE(20, 4) // version needed
  head.writeUInt16LE(0, 6) // flags
  head.writeUInt16LE(method, 8)
  head.writeUInt32LE(0, 14) // crc (unchecked by our reader)
  head.writeUInt32LE(data.length, 18)
  head.writeUInt32LE(raw.length, 22)
  head.writeUInt16LE(name.length, 26)
  head.writeUInt16LE(0, 28)
  return new Uint8Array(Buffer.concat([head, name, data]))
}

const fakePapers = (n = 197) => Array.from({ length: n }, (_, i) => ({ paper_index: i }))
const memStore = () => {
  const m = new Map()
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => { m.set(k, v) },
    _map: m,
  }
}
const okFetch = (bytes) => async (url) => {
  okFetch.lastUrl = url
  return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }
}

test('readFirstFile finds the deflated entry', () => {
  const zip = makeZip('hola mundo — prueba ñ')
  const { method, data } = readFirstFile(zip)
  assert.equal(method, 8)
  assert.ok(data.length > 0 && data.length < zip.length)
})

test('extractSingleTxt round-trips deflated UTF-8', async () => {
  const text = 'En la mente de los mortales — prueba con ñ, é, ü y 한글.'
  assert.equal(await extractSingleTxt(makeZip(text)), text)
})

test('extractSingleTxt handles stored (uncompressed) entries', async () => {
  assert.equal(await extractSingleTxt(makeZip('plain stored', 0)), 'plain stored')
})

test('readFirstFile rejects non-zip bytes', () => {
  assert.throws(() => readFirstFile(new Uint8Array([1, 2, 3, 4])), /not a zip/)
})

// The official zips write sizes as 0 in the local header (data descriptor in
// use); the true sizes live in the central directory. This fixture mimics that.
function makeZipDescriptor(text) {
  const raw = Buffer.from(text, 'utf-8')
  const data = deflateRawSync(raw)
  const name = Buffer.from('official.txt', 'utf-8')
  const head = Buffer.alloc(30)
  head.writeUInt32LE(0x04034b50, 0)
  head.writeUInt16LE(20, 4)
  head.writeUInt16LE(0x08, 6) // data descriptor follows
  head.writeUInt16LE(8, 8)
  head.writeUInt32LE(0, 18) // sizes zeroed
  head.writeUInt32LE(0, 22)
  head.writeUInt16LE(name.length, 26)
  head.writeUInt16LE(0, 28)
  const desc = Buffer.alloc(16)
  desc.writeUInt32LE(0x08074b50, 0)
  desc.writeUInt32LE(0, 4)
  desc.writeUInt32LE(data.length, 8)
  desc.writeUInt32LE(raw.length, 12)
  const cd = Buffer.alloc(46)
  cd.writeUInt32LE(0x02014b50, 0)
  cd.writeUInt16LE(20, 6)
  cd.writeUInt16LE(0x08, 8)
  cd.writeUInt16LE(8, 10)
  cd.writeUInt32LE(data.length, 20)
  cd.writeUInt32LE(raw.length, 24)
  cd.writeUInt16LE(name.length, 28)
  cd.writeUInt32LE(0, 42) // local header offset
  const cdOff = head.length + name.length + data.length + desc.length
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(1, 8)
  eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(cd.length + name.length, 12)
  eocd.writeUInt32LE(cdOff, 16)
  return new Uint8Array(Buffer.concat([head, name, data, desc, cd, name, eocd]))
}

test('extractSingleTxt reads sizes from the central directory when needed', async () => {
  const text = 'descriptor-style zip, como los oficiales — ñ é ü'
  assert.equal(await extractSingleTxt(makeZipDescriptor(text)), text)
})

test('loadTranslation serves cached papers without fetching', async () => {
  clearTranslationCache()
  const store = memStore()
  const papers = fakePapers()
  await store.set('ub-i18n-es', { papers })
  let fetched = false
  const got = await loadTranslation('es', { storage: store, fetchFn: async () => { fetched = true; throw new Error('nope') } })
  assert.equal(got, papers)
  assert.equal(fetched, false)
})

test('loadTranslation fetches the official URL, extracts, parses, and caches', async () => {
  clearTranslationCache()
  const store = memStore()
  const zip = makeZip('texto oficial de prueba')
  const fetchFn = okFetch(zip)
  const parsed = fakePapers()
  let parsedWith = null
  const got = await loadTranslation('es', {
    storage: store,
    fetchFn,
    parseFn: (txt, lang) => { parsedWith = [txt, lang]; return parsed },
  })
  assert.equal(okFetch.lastUrl, LOCAL_URLS.es)
  assert.deepEqual(parsedWith, ['texto oficial de prueba', 'es'])
  assert.equal(got, parsed)
  const saved = await store.get('ub-i18n-es')
  assert.equal(saved.papers, parsed)
  // second call comes from the in-memory cache: no storage hit needed
  const again = await loadTranslation('es', { storage: { get: async () => { throw new Error('should not read') } } })
  assert.equal(again, parsed)
})

test('loadTranslation passes authorProvider through to the parser', async () => {
  clearTranslationCache()
  let gotOpts = null
  const provider = (i) => `Author ${i}`
  await loadTranslation('es', {
    storage: memStore(),
    fetchFn: okFetch(makeZip('x')),
    parseFn: (txt, lang, opts) => { gotOpts = opts; return fakePapers() },
    authorProvider: provider,
  })
  assert.equal(typeof gotOpts.englishAuthor, 'function')
  assert.equal(gotOpts.englishAuthor(3), 'Author 3')
})

test('loadTranslation throws a reader-friendly error when the fetch fails', async () => {
  clearTranslationCache()
  const err = await loadTranslation('fr', {
    storage: memStore(),
    fetchFn: async () => { throw new TypeError('Failed to fetch') },
    parseFn: () => fakePapers(),
  }).then(() => null, (e) => e)
  assert.ok(err, 'expected an error')
  assert.match(err.message, /French/)
  assert.doesNotMatch(err.message, /fetch|CORS|cors|TypeError|URL/i)
})

test('loadTranslation rejects a bad parse with the friendly error', async () => {
  clearTranslationCache()
  const err = await loadTranslation('ko', {
    storage: memStore(),
    fetchFn: okFetch(makeZip('x')),
    parseFn: () => [{ paper_index: 0 }], // not 197 papers
  }).then(() => null, (e) => e)
  assert.ok(err)
  assert.match(err.message, /Korean/)
})

test('loadTranslation rejects unknown languages', async () => {
  clearTranslationCache()
  await assert.rejects(() => loadTranslation('xx', { storage: memStore() }), /unknown language/)
})

test('loadTranslation falls through local, official, then proxies', async () => {
  clearTranslationCache()
  const tried = []
  const fetchFn = async (url) => {
    tried.push(url)
    if (tried.length < 3) throw new TypeError('Failed to fetch')
    return { ok: true, arrayBuffer: async () => { const z = makeZip('x'); return z.buffer.slice(z.byteOffset, z.byteOffset + z.byteLength) } }
  }
  await loadTranslation('es', { storage: memStore(), fetchFn, parseFn: () => fakePapers() })
  assert.equal(tried[0], LOCAL_URLS.es)
  assert.equal(tried[1], TRANSLATION_URLS.es)
  assert.match(tried[2], /^https:\/\/api\./)
})

test('official translation URLs point at urantia.org zips', () => {
  for (const [lang, url] of Object.entries(TRANSLATION_URLS)) {
    assert.match(url, /^https:\/\/(www\.)?urantia\.org\/.*-txt\.zip$/, `bad URL for ${lang}`)
  }
  assert.equal(Object.keys(TRANSLATION_URLS).sort().join(','), 'es,fr,ko')
})

test('toggleLangs skips the current language and names the rest plainly', () => {
  // Spanish-only for now; FR/KO return after ranking review
  assert.deepEqual(toggleLangs('es').map((t) => t.code), ['en'])
  assert.deepEqual(toggleLangs('es').map((t) => t.label), ['English'])
  assert.deepEqual(toggleLangs('en').map((t) => t.code), ['es'])
  assert.deepEqual(toggleLangs('en').map((t) => t.label), ['Español'])
})
