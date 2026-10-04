// node --test app/test/study-tracks.test.mjs
// Tests the study-track data (pure data, no DOM needed).
// Content rule: every answer plain language, every quote verbatim with a ref.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TRACKS, trackById } from '../study-tracks.js'
import { TOOLS } from '../tools.js'

const REF_RE = /^\d{1,3}:\d{1,2}\.\d{1,2}$/

test('TRACKS has the newcomer and love-one-another tracks', () => {
  const ids = TRACKS.map((t) => t.id).sort()
  assert.deepEqual(ids, ['love-one-another', 'newcomer-start'])
})

test('trackById finds tracks and misses cleanly', () => {
  assert.equal(trackById('newcomer-start').id, 'newcomer-start')
  assert.equal(trackById('nope'), null)
})

test('every track has an intro and questions', () => {
  for (const t of TRACKS) {
    assert.ok(t.intro && t.intro.length > 20, `${t.id} needs an intro`)
    assert.ok(Array.isArray(t.questions) && t.questions.length > 0, `${t.id} needs questions`)
  }
})

test('every question has a plain answer and verbatim quotes with refs', () => {
  for (const t of TRACKS) {
    for (const q of t.questions) {
      assert.ok(q.q && q.q.length > 5, `${t.id}: question needs text`)
      assert.ok(q.answer && q.answer.length > 20, `${t.id} "${q.q}": needs a plain answer`)
      assert.ok(Array.isArray(q.quotes) && q.quotes.length > 0, `${t.id} "${q.q}": needs quotes`)
      for (const qt of q.quotes) {
        assert.match(qt.ref, REF_RE, `${t.id} "${q.q}": bad ref "${qt.ref}"`)
        assert.ok(qt.text && qt.text.length > 20, `${t.id} "${q.q}": quote needs text`)
      }
    }
  }
})

test('TOOLS track entries point at real tracks', () => {
  const tracks = TOOLS.filter((t) => t.action.kind === 'track')
  assert.ok(tracks.length >= 2, 'expected track entries in TOOLS')
  for (const t of tracks) {
    assert.ok(trackById(t.action.track), `${t.id} points at missing track ${t.action.track}`)
    assert.ok(t.title && t.blurb, `${t.id} needs title and blurb`)
  }
})
