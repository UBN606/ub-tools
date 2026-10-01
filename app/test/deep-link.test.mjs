// Tests for app/deep-link.js. Run: node --test app/test/deep-link.test.mjs
// All paragraph refs used here were verified against the book text with
// `node ub-search.js --ref <ref>` (999:9.9 is intentionally nonexistent).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseRefParam, expandRange, isValidRef, refLink } from '../deep-link.js'

const ORDER = ['180:2.1', '180:2.2', '180:2.3', '180:3.1', '196:1.3', '2:3.4']
const BYREF = new Map(ORDER.map((r) => [r, { ref: r }]))

describe('parseRefParam', () => {
  it('parses a single ref', () => {
    assert.deepEqual(parseRefParam('?ref=180:2.1'), { refs: ['180:2.1'], ranges: [], error: null })
  })

  it('parses a full-form range', () => {
    const r = parseRefParam('?ref=180:2.1-180:2.3')
    assert.deepEqual(r.ranges, [{ start: '180:2.1', end: '180:2.3' }])
    assert.deepEqual(r.refs, [])
    assert.equal(r.error, null)
  })

  it('parses a short-form range', () => {
    const r = parseRefParam('?ref=180:2.1-3')
    assert.deepEqual(r.ranges, [{ start: '180:2.1', end: '180:2.3' }])
    assert.equal(r.error, null)
  })

  it('parses a comma list', () => {
    const r = parseRefParam('?ref=180:2.1,196:1.3')
    assert.deepEqual(r.refs, ['180:2.1', '196:1.3'])
    assert.equal(r.error, null)
  })

  it('mixes ranges and singles, and drops duplicates', () => {
    const r = parseRefParam('?ref=180:2.1-3,196:1.3,180:2.1')
    assert.deepEqual(r.refs, ['196:1.3', '180:2.1'])
    assert.deepEqual(r.ranges, [{ start: '180:2.1', end: '180:2.3' }])
    assert.equal(r.error, null)
  })

  it('accepts a full URL too', () => {
    assert.deepEqual(parseRefParam('https://example.com/app/?ref=180:2.1').refs, ['180:2.1'])
  })

  it('rejects garbage with an error, no refs', () => {
    const r = parseRefParam('?ref=banana')
    assert.deepEqual(r.refs, [])
    assert.deepEqual(r.ranges, [])
    assert.match(r.error, /could not be read/i)
  })

  it('treats a well-formed but unknown ref as syntactically fine', () => {
    const r = parseRefParam('?ref=999:9.9')
    assert.deepEqual(r.refs, ['999:9.9'])
    assert.equal(r.error, null)
    // existence is the boot code's job, via isValidRef against E.byRef:
    assert.equal(isValidRef('999:9.9', BYREF), false)
  })

  it('rejects a reversed range in a way the boot code can report', () => {
    const r = parseRefParam('?ref=180:2.3-180:2.1')
    assert.equal(r.error, null) // syntactically fine...
    const grown = expandRange(r.ranges[0].start, r.ranges[0].end, ORDER)
    assert.deepEqual(grown, []) // ...but empty, so the app shows an error
  })

  it('rejects an empty value', () => {
    const r = parseRefParam('?ref=')
    assert.ok(r.error)
    assert.deepEqual(r.refs, [])
  })

  it('is a no-op when ?ref= is absent', () => {
    assert.deepEqual(parseRefParam('?q=jesus'), { refs: [], ranges: [], error: null })
    assert.deepEqual(parseRefParam(''), { refs: [], ranges: [], error: null })
  })

  it('never throws on null/undefined/garbage input', () => {
    for (const bad of [null, undefined, 42, {}, [], '???', '?ref=180:2.1-']) {
      assert.doesNotThrow(() => parseRefParam(bad))
    }
  })
})

describe('expandRange', () => {
  it('expands a same-section range', () => {
    assert.deepEqual(expandRange('180:2.1', '180:2.3', ORDER), ['180:2.1', '180:2.2', '180:2.3'])
  })

  it('expands across section boundaries using book order', () => {
    assert.deepEqual(expandRange('180:2.3', '180:3.1', ORDER), ['180:2.3', '180:3.1'])
  })

  it('a range to itself is the single ref', () => {
    assert.deepEqual(expandRange('196:1.3', '196:1.3', ORDER), ['196:1.3'])
  })

  it('returns [] for a reversed range', () => {
    assert.deepEqual(expandRange('180:2.3', '180:2.1', ORDER), [])
  })

  it('returns [] when an endpoint is missing', () => {
    assert.deepEqual(expandRange('180:2.1', '999:9.9', ORDER), [])
    assert.deepEqual(expandRange('999:9.9', '180:2.1', ORDER), [])
  })

  it('returns [] on bad input', () => {
    assert.deepEqual(expandRange(null, '180:2.1', ORDER), [])
    assert.deepEqual(expandRange('180:2.1', '180:2.3', null), [])
    assert.deepEqual(expandRange('180:2.1', '180:2.3', []), [])
    assert.deepEqual(expandRange('banana', '180:2.3', ORDER), [])
  })
})

describe('isValidRef', () => {
  it('accepts refs present in the book', () => {
    assert.equal(isValidRef('180:2.1', BYREF), true)
    assert.equal(isValidRef('2:3.4', BYREF), true)
  })

  it('rejects unknown, malformed, and missing refs', () => {
    assert.equal(isValidRef('999:9.9', BYREF), false)
    assert.equal(isValidRef('banana', BYREF), false)
    assert.equal(isValidRef('', BYREF), false)
    assert.equal(isValidRef(null, BYREF), false)
    assert.equal(isValidRef(undefined, BYREF), false)
    assert.equal(isValidRef('180:2.1', null), false)
    assert.equal(isValidRef('180:2.1', new Map()), false)
  })

  it('also works with plain-object and array indexes', () => {
    assert.equal(isValidRef('180:2.1', { '180:2.1': 1 }), true)
    assert.equal(isValidRef('999:9.9', { '180:2.1': 1 }), false)
    assert.equal(isValidRef('180:2.1', ['180:2.1']), true)
  })
})

describe('refLink', () => {
  it('builds an absolute link from location', () => {
    globalThis.location = { origin: 'https://example.com', pathname: '/app/' }
    try {
      assert.equal(refLink('180:2.1'), 'https://example.com/app/?ref=180:2.1')
      assert.equal(refLink('180:2.1-180:2.3'), 'https://example.com/app/?ref=180:2.1-180:2.3')
    } finally { delete globalThis.location }
  })

  it('never throws on bad input, even without location', () => {
    delete globalThis.location
    assert.doesNotThrow(() => refLink(null))
    assert.doesNotThrow(() => refLink(undefined))
    assert.equal(refLink('180:2.1', 'https://x.test/studio'), 'https://x.test/studio?ref=180:2.1')
  })
})
