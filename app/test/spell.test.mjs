// node --test app/test/spell.test.mjs
// Spelling repair for Ask: suggest only words the book uses, and leave short words alone.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildVocab, editDistance, suggest, correctQuestion } from '../spell.js'

const V = buildVocab([
  'The ascension plan of the Universal Father. The ascension career.',
  'Spiritual growth is spiritual. Reincarnation was an early belief; reincarnation is not taught.',
  'The resurrection of Jesus. The resurrection hall. Paradise is the center. Paradise again.',
  'The poor and the needy. The poor. Incarnate incarnate.',
  "Urantia is your world. Urantia's history.",
])

test('edit distance', () => {
  assert.equal(editDistance('ascencion', 'ascension'), 1)
  assert.equal(editDistance('teh', 'the'), 1, 'adjacent swap counts once')
  assert.ok(editDistance('narcissism', 'ascension') > 2)
})

test('suggests the book word a reader meant', () => {
  assert.equal(suggest('ascencion', V), 'ascension')
  assert.equal(suggest('spirituel', V), 'spiritual')
  assert.equal(suggest('resurection', V), 'resurrection')
  assert.equal(suggest('paradice', V), 'paradise')
  assert.equal(suggest('reincarnate', V), 'reincarnation', "the book's own form of the word, not 'incarnate'")
  assert.equal(suggest('rancher', V), 'urantia', 'voice mishearing of Urantia')
})

test('leaves alone what it should', () => {
  assert.equal(suggest('paradise', V), null, 'already a book word')
  assert.equal(suggest('spoor', V), null, 'short words are not guessed ("spoor" is not "poor")')
  assert.equal(suggest('bigfoot', V), null, 'nothing close in the book')
})

test('corrects only the unknown words of a question', () => {
  const r = correctQuestion('What is the ascencion plan?', ['ascencion'], V)
  assert.equal(r.question, 'What is the ascension plan?')
  assert.deepEqual(r.fixes, [{ from: 'ascencion', to: 'ascension' }])
  assert.deepEqual(correctQuestion('Who is bigfoot?', ['bigfoot'], V).fixes, [])
})
