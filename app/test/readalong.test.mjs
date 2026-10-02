// node --test app/test/readalong.test.mjs
// Tests the read-along module against a SYNTHETIC fixture
// (app/test/fixtures/alignment-sample.json) — not real book text.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadAlignment, wordAtTime } from '../readalong.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(readFileSync(join(HERE, 'fixtures', 'alignment-sample.json'), 'utf8'))

const WORDS = [
  { w: 'a', start: 1.0, end: 1.5, x: true },
  { w: 'b', start: 1.5, end: 2.2, x: false },
  { w: 'c', start: 2.2, end: 3.0, x: true },
]

// ---------- wordAtTime ----------

test('wordAtTime: empty array returns -1', () => {
  assert.equal(wordAtTime([], 1.0), -1)
})

test('wordAtTime: before the first word starts, returns 0', () => {
  assert.equal(wordAtTime(WORDS, 0.2), 0)
})

test('wordAtTime: exactly at the first word start, returns 0', () => {
  assert.equal(wordAtTime(WORDS, 1.0), 0)
})

test('wordAtTime: mid-word returns that word', () => {
  assert.equal(wordAtTime(WORDS, 1.8), 1)
  assert.equal(wordAtTime(WORDS, 2.9), 2)
})

test('wordAtTime: boundary (t == word end == next start) returns the next word', () => {
  assert.equal(wordAtTime(WORDS, 1.5), 1)
  assert.equal(wordAtTime(WORDS, 2.2), 2)
})

test('wordAtTime: past the last word end returns the last word', () => {
  assert.equal(wordAtTime(WORDS, 30.0), 2)
})

test('wordAtTime: single-word array', () => {
  const one = [{ w: 'x', start: 5, end: 6, x: true }]
  assert.equal(wordAtTime(one, 4.9), 0)
  assert.equal(wordAtTime(one, 5.5), 0)
  assert.equal(wordAtTime(one, 99), 0)
})

// ---------- fixture schema ----------

test('fixture: synthetic marker and top-level shape', () => {
  assert.equal(fixture.synthetic, true)
  assert.equal(typeof fixture.paper, 'number')
  assert.ok(Array.isArray(fixture.paragraphs) && fixture.paragraphs.length === 2)
})

test('fixture: every paragraph validates', () => {
  for (const p of fixture.paragraphs) {
    assert.match(p.ref, /^\d+:\d+\.\d+$/, 'ref shape')
    assert.ok(typeof p.confidence === 'number' && p.confidence >= 0 && p.confidence <= 1, 'confidence 0..1')
    assert.ok(Array.isArray(p.words) && p.words.length > 0, 'non-empty words')
    let prevStart = -Infinity
    for (const w of p.words) {
      assert.equal(typeof w.w, 'string')
      assert.ok(Number.isFinite(w.start) && Number.isFinite(w.end), 'finite bounds')
      assert.ok(w.end >= w.start, 'end >= start')
      assert.equal(typeof w.x, 'boolean', 'x flag present')
      assert.ok(w.start > prevStart, `starts strictly increasing (${p.ref})`)
      prevStart = w.start
    }
  }
})

// ---------- loadAlignment ----------

test('loadAlignment: invalid paper numbers return null without fetching', async () => {
  let called = false
  const real = globalThis.fetch
  globalThis.fetch = async () => { called = true; throw new Error('should not be called') }
  try {
    assert.equal(await loadAlignment(-1), null)
    assert.equal(await loadAlignment(197), null)
    assert.equal(await loadAlignment(NaN), null)
    assert.equal(await loadAlignment(1.5), null)
    assert.equal(called, false)
  } finally {
    globalThis.fetch = real
  }
})

test('loadAlignment: 404 (timings not published) returns null', async () => {
  const real = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 404 })
  try {
    assert.equal(await loadAlignment(5), null)
  } finally {
    globalThis.fetch = real
  }
})

test('loadAlignment: 500 and network errors return null, never throw', async () => {
  const real = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 500 })
  try {
    assert.equal(await loadAlignment(5), null)
  } finally {
    globalThis.fetch = real
  }
  globalThis.fetch = async () => { throw new Error('offline') }
  try {
    assert.equal(await loadAlignment(5), null)
  } finally {
    globalThis.fetch = real
  }
})

test('loadAlignment: valid JSON returns a ref → words Map', async () => {
  const real = globalThis.fetch
  const payload = {
    paper: 5,
    paper_title: 'synthetic title',
    stats: { exact_match_rate: 0.9 },
    paragraphs: [
      {
        ref: '5:0.1',
        confidence: 0.9,
        words: [
          { w: 'One', start: 0.1, end: 0.4, x: true },
          { w: 'bad', start: NaN, end: 0.5, x: true }, // filtered: non-finite
          { w: 'two.', start: 0.41, end: 0.8, x: false },
        ],
      },
      { ref: '5:0.2', confidence: 0.5, words: [] }, // skipped: no words
    ],
  }
  globalThis.fetch = async () => ({ ok: true, json: async () => payload })
  try {
    const r = await loadAlignment(5)
    assert.ok(r)
    assert.ok(r.paragraphs instanceof Map)
    assert.equal(r.paragraphs.size, 1)
    assert.deepEqual(r.paragraphs.get('5:0.1').map((w) => w.w), ['One', 'two.'])
    assert.equal(r.meta.paper, 5)
    assert.equal(r.meta.title, 'synthetic title')
    assert.equal(r.meta.exactMatchRate, 0.9)
  } finally {
    globalThis.fetch = real
  }
})

test('loadAlignment: empty or malformed payloads return null', async () => {
  const real = globalThis.fetch
  for (const payload of [
    { ok: true, json: async () => ({ paper: 5, paragraphs: [] }) },
    { ok: true, json: async () => ({ paper: 5 }) },
    { ok: true, json: async () => { throw new Error('bad json') } },
  ]) {
    globalThis.fetch = async () => payload
    assert.equal(await loadAlignment(5), null)
  }
  globalThis.fetch = real
})

test('wordAtTime works across the synthetic fixture', () => {
  const words = fixture.paragraphs[0].words
  assert.equal(wordAtTime(words, 0.0), 0)
  assert.equal(wordAtTime(words, 0.9), 2) // interpolated word still found
  assert.equal(wordAtTime(words, 2.75), 7)
  assert.equal(wordAtTime(words, 99), words.length - 1)
})

// ---------- audioUrlForPaper (built-in narration stream) ----------

import { audioUrlForPaper } from '../readalong.js'

test('audioUrlForPaper: Foreword and Papers map to the UF24K mirror files', () => {
  assert.equal(audioUrlForPaper(0), 'https://truthbook.com/wp-content/uploads/AudioFiles/UF24K/U0.mp3')
  assert.equal(audioUrlForPaper(1), 'https://truthbook.com/wp-content/uploads/AudioFiles/UF24K/U1.mp3')
  assert.equal(audioUrlForPaper(196), 'https://truthbook.com/wp-content/uploads/AudioFiles/UF24K/U196.mp3')
})

test('audioUrlForPaper: out-of-range paper numbers return null', () => {
  assert.equal(audioUrlForPaper(-1), null)
  assert.equal(audioUrlForPaper(197), null)
  assert.equal(audioUrlForPaper(1.5), null)
  assert.equal(audioUrlForPaper('1'), null)
})
