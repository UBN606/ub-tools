// node --test app/test/read-lang.test.mjs
// The Read tablet's English/Español toggle: pure selection + label logic.
// Fixtures are synthetic — no UB text is ever committed, not even in tests.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  READ_LANG_KEY, normalizeReadLang, resolveReadParagraph, whereLine,
} from '../read-lang.js'

const enPar = {
  ref: '1:0.1', paper: 1, paperTitle: 'The Universal Father', section: '1. The Universal Father', page: 21,
  text: 'Synthetic English paragraph one.',
}
const esByRef = new Map([
  ['1:0.1', {
    ref: '1:0.1', paper: 1, paperTitle: 'El Padre Universal',
    sectionTitle: 'El Padre Universal', text: 'Párrafo sintético número uno.',
  }],
])

test('normalizeReadLang only honors es', () => {
  assert.equal(normalizeReadLang('es'), 'es')
  assert.equal(normalizeReadLang('en'), 'en')
  assert.equal(normalizeReadLang('fr'), 'en')
  assert.equal(normalizeReadLang(undefined), 'en')
  assert.equal(READ_LANG_KEY, 'read-lang')
})

test('english mode passes the English record through untouched', () => {
  const r = resolveReadParagraph('1:0.1', 'en', enPar, esByRef)
  assert.equal(r.lang, 'en')
  assert.equal(r.par, enPar)
  assert.equal(r.fallback, undefined)
})

test('spanish mode returns the translated paragraph', () => {
  const r = resolveReadParagraph('1:0.1', 'es', enPar, esByRef)
  assert.equal(r.lang, 'es')
  assert.equal(r.par.text, 'Párrafo sintético número uno.')
  assert.equal(r.par.paperTitle, 'El Padre Universal')
  assert.equal(r.fallback, undefined)
})

test('spanish mode falls back to English when the ref is missing', () => {
  const r = resolveReadParagraph('9:9.9', 'es', enPar, esByRef)
  assert.equal(r.lang, 'en')
  assert.equal(r.par, enPar)
  assert.equal(r.fallback, true)
})

test('spanish mode falls back to English when translations are not loaded', () => {
  const r = resolveReadParagraph('1:0.1', 'es', enPar, null)
  assert.equal(r.lang, 'en')
  assert.equal(r.fallback, true)
})

test('english errors pass through in either language', () => {
  const err = { ref: '1:0.1', error: 'Reference not found' }
  assert.equal(resolveReadParagraph('1:0.1', 'es', err, esByRef).par.error, 'Reference not found')
  assert.equal(whereLine({ lang: 'es', par: err }), '')
})

test('whereLine keeps the English format verbatim', () => {
  const r = resolveReadParagraph('1:0.1', 'en', enPar, esByRef)
  assert.equal(whereLine(r), 'Paper 1, The Universal Father. 1. The Universal Father. Page 21.')
})

test('whereLine in Spanish shows translated titles and no page number', () => {
  const r = resolveReadParagraph('1:0.1', 'es', enPar, esByRef)
  assert.equal(whereLine(r), 'El Padre Universal. El Padre Universal')
})
