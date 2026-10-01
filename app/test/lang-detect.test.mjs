// node --test app/test/lang-detect.test.mjs
// The Ask answerer replies in the language the question was asked in; this
// checks the detector across Spanish, French, Korean, and English, including
// unaccented Spanish, mixed-language, and very short questions.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectLang } from '../lang-detect.js'

const cases = [
  // Spanish
  ['¿Qué es la filosofía según el libro de Urantia?', 'es'],
  ['¿Qué pasa cuando morimos?', 'es'],
  ['que es la filosofia para el libro de urantia', 'es'], // no accents
  ['filosofia', 'es'], // one word, no glue
  ['¿Cómo era el cabello de Adán y Eva?', 'es'],
  ['¿Quién fue Jesús?', 'es'],
  ['¿Qué enseña el libro sobre la oración?', 'es'],
  // French
  ['Qu\u2019est-ce que la philosophie ?', 'fr'],
  ['Que dit le livre sur les anges ?', 'fr'],
  ['philosophie', 'fr'], // one word, no glue
  ['Que se passe-t-il quand nous mourons ?', 'fr'],
  ['Qui était Jésus ?', 'fr'],
  ['Parlez-moi de la prière', 'fr'],
  // Korean
  ['예수님은 누구인가요?', 'ko'],
  ['죽으면 어떻게 되나요?', 'ko'],
  ['기도에 대해 알려줘', 'ko'],
  ['하나님은 어떤 분이신가요?', 'ko'],
  ['사랑이 뭐야?', 'ko'],
  // English
  ['What happens when we die?', 'en'],
  ['What is philosophy?', 'en'],
  ['Who was Jesus?', 'en'],
  ['Tell me about prayer', 'en'],
  ['philosophy', 'en'], // English word, no markers
  // Mixed
  ['What is 하나님?', 'ko'], // Hangul present -> Korean
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
