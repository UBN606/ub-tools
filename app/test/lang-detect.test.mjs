// node --test app/test/lang-detect.test.mjs
// The Ask answerer replies in the language the question was asked in; this
// checks the detector. Spanish-only for now: French/Korean map to English
// until those translations ship (after ranking review).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectLang } from '../lang-detect.js'

const cases = [
  // Spanish
  ['¿Qué es la filosofía según el libro de Urantia?', 'es'],
  ['¿Qué pasa cuando morimos?', 'es'],
  ['que es la filosofia para el libro de urantia', 'es'], // no accents
  ['filosofia', 'es'], // one word, no glue
  ['el libro de Urantia', 'es'], // "libro" is Spanish; "Urantia" is every language's
  ['¿Cómo era el cabello de Adán y Eva?', 'es'],
  ['¿Quién fue Jesús?', 'es'],
  ['¿Qué enseña el libro sobre la oración?', 'es'],
  // French -> English (not shipped yet)
  ['Qu\u2019est-ce que la philosophie ?', 'en'],
  ['Que dit le livre sur les anges ?', 'en'],
  ['philosophie', 'en'],
  // Korean -> English (not shipped yet)
  ['예수님은 누구인가요?', 'en'],
  ['죽으면 어떻게 되나요?', 'en'],
  // English
  ['What happens when we die?', 'en'],
  ['What is philosophy?', 'en'],
  ['Who was Jesus?', 'en'],
  ['Tell me about prayer', 'en'],
  ['philosophy', 'en'], // English word, no markers
  // Mixed
  ['What is 하나님?', 'en'], // Hangul present but Korean not shipped -> English
  ['¿Qué dice the book about angels?', 'es'], // Spanish glue wins
]

for (const [q, want] of cases) {
  test(`detectLang(${JSON.stringify(q)}) === ${want}`, () => {
    assert.equal(detectLang(q), want)
  })
}

test('empty question defaults to English', () => {
  assert.equal(detectLang(''), 'en')
  assert.equal(detectLang(null), 'en')
})

// Polish -> 'pl' (graceful fallback, text not shipped yet)
for (const [q, want] of [
  ['Co się dzieje po śmierci', 'pl'],
  ['Syn Stwórca', 'pl'],
  ['Co to jest osobowość', 'pl'],
  ['Kim był Jezus?', 'pl'],
  ['Co to jest dusza', 'pl'], // no diacritics: "jest" is unambiguous, so "co" and "to" count
  ['Kim jest Jezus', 'pl'],
]) {
  test(`detectLang(${JSON.stringify(q)}) === ${want}`, () => {
    assert.equal(detectLang(q), want)
  })
}

// English questions that used to get Polish answers: "Urantia" (the same word in every
// language) and English words that are also Polish glue ("ten", "co", "ma", "te").
for (const q of ['Urantia', 'Urantia book', 'Urantia history', 'Urantia Foundation', 'urantia papers',
  'Ten commandments', 'Ten lepers', 'ten apostles', 'Ten thousand years', 'co-creator', 'Co op', 'Ma', 'Te Deum']) {
  test(`detectLang(${JSON.stringify(q)}) === en`, () => {
    assert.equal(detectLang(q), 'en')
  })
}

for (const [q, want] of [
  ['Urantia nie', 'pl'], // a sure Polish word still wins
]) {
  test(`detectLang(${JSON.stringify(q)}) === ${want}`, () => {
    assert.equal(detectLang(q), want)
  })
}
