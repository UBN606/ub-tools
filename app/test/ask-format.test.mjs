import test from 'node:test'
import assert from 'node:assert/strict'
import { ASK_LABELS, askLabels, forwardText } from '../ask-format.js'

const quotes = [
  { ref: '16:6.4', text: 'First passage text.' },
  { ref: '16:6.5', text: 'Second passage text.' },
  { ref: '16:9.1', text: 'Third passage text.' },
]

test('all four languages carry the same label keys', () => {
  const keys = Object.keys(ASK_LABELS.en)
  for (const lang of ['es', 'fr', 'ko']) {
    assert.deepEqual(Object.keys(ASK_LABELS[lang]).sort(), keys.sort(), lang)
    for (const k of keys) assert.ok(ASK_LABELS[lang][k].length > 0, `${lang}.${k} empty`)
  }
})

test('askLabels falls back to English for unknown languages', () => {
  assert.equal(askLabels('xx').theAnswer, ASK_LABELS.en.theAnswer)
})

for (const lang of ['en', 'es', 'fr', 'ko']) {
  test(`forwardText (${lang}) leads with the question and the answer passage cited`, () => {
    const t = forwardText(lang, 'Q?', quotes)
    const L = ASK_LABELS[lang]
    assert.ok(t.startsWith('Q?\n'), 'question first')
    assert.ok(t.includes(L.theAnswer), 'answer label')
    assert.ok(t.includes('16:6.4'), 'answer citation')
    assert.ok(t.includes('"First passage text."'), 'answer text quoted')
    assert.ok(t.includes(L.more), 'supporting label')
    assert.ok(t.includes('16:6.5') && t.includes('16:9.1'), 'supporting citations')
    assert.ok(t.includes(L.book), 'book name')
    assert.ok(t.includes(L.via), 'via line')
  })
}

test('forwardText with a single quote has no supporting section', () => {
  const t = forwardText('en', 'Q?', [quotes[0]])
  assert.ok(!t.includes(ASK_LABELS.en.more))
  assert.ok(t.includes('16:6.4'))
})

test('every quote carries its exact citation', () => {
  const t = forwardText('fr', 'Q?', quotes)
  for (const q of quotes) assert.ok(t.includes(q.ref), q.ref)
})
