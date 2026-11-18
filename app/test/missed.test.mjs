// node --test app/test/missed.test.mjs
// The missed-question log (Oct 2026): real reader questions, exactly as typed, that found
// nothing useful. Each must now lead with a passage that speaks to it, found through the
// same steps as the Studio's Ask (app.js runAsk): chat trimmed, the question answered, and
// a word the book never uses repaired ("ascencion" -> "ascension") and searched again.
// The accepted passages were read and judged by hand; the search code knows none of them.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { answer } from '../ask.js'
import { trimChat } from '../chat.js'
import { buildVocab, correctQuestion } from '../spell.js'

const require = createRequire(import.meta.url)
const search = require('../../ub-search.js')
const index = require('../../source-texts/ub-search-index.json')
const byRef = new Map()
for (const p of index.papers)
  for (const s of p.sections)
    for (const par of s.paragraphs)
      byRef.set(par.ref, { ...par, paper: p.paper_index, paperTitle: p.paper_title, author: p.author, sectionTitle: s.section_title })
const E = { search, byRef }
const vocab = buildVocab(Array.from(byRef.values(), (p) => p.text))

function ask(q) {
  const t = trimChat(q)
  let r = answer(E, t.question)
  const unknown = r.quiet.filter((x) => x.total === 0).map((x) => x.word)
  const fix = unknown.length ? correctQuestion(t.question, unknown, vocab) : { fixes: [] }
  if (fix.fixes.length) {
    const fixed = answer(E, fix.question)
    if (fixed.refs.length) r = fixed
  }
  return r.refs
}

// [question as typed, how many top results to look in, passages that answer it]
const MISSED = [
  // 180:2.4 "when your will has been truly aligned with his"; 1:1.2 "the human will to the doing of the Father's will".
  ["How do we align our will with God's will?", 3, ['180:2.4', '1:1.2']],
  // 52:3.5 "Neither is it the divine plan for the Planetary Adam or Eve to mate, personally, with the evolutionary peoples"; 51:5.3; 75:5.2 (Laotta).
  ['Did Adam mate with non-adamic people?', 3, ['52:3.5', '51:5.3', '75:5.2']],
  // The plan of creature (evolutionary, mortal) ascension.
  ['What is the ascencion plan?', 3, ['7:4.4', '7:4.7', '2:1.10', '14:3.4', '14:3.5', '26:9.3']],
  // Hung on the cross at half past nine (187:3.1), died just before three (187:5.5), a day and a half in the tomb (188:3.4).
  ['how many days was jesus on the cross', 3, ['171:0.7', '187:2.1', '187:3.1', '187:5.5', '188:0.1', '188:3.4']],
  // "In the eternity of the past ..."
  ['what happened in the beginning of time', 3, ['118:9.8', '8:1.1', '11:9.3', '105:7.18', '23:1.3', '17:2.2']],
  // "The Supreme Being is ..."
  ['Define the Supreme Being for me.', 3, ['0:7.9', '22:7.11', '115:5.1', '10:7.3', '106:2.1', '0:2.15']],
  // 77:8.1 "numbering 10,992"; 77:6.4 "1,984 in number"; 77:7.1 "of the original 50,000, 40,119".
  ['how many midwayers were created and how many are left?', 3, ['77:8.1', '77:6.4', '77:7.1', '77:7.2', '77:1.4', '38:9.3', '38:9.4']],
  // "Spirituality becomes at once the indicator of one's nearness to God ..."
  ['What does it mean to be spiritual?', 1, ['100:2.4']],
  // The reader's words are the book's: "The meaning of life is its adaptability".
  ['the meaning of life is its adaptability', 1, ['130:4.7']],
  // Jesus on "the will of God and that human mind act of choosing".
  ['Jesus on mind and choice', 1, ['130:2.7']],
  ['contemplative meditation', 3, ['124:3.10', '128:6.10', '143:7.3']],
  // Machine invention, "the too rapid invention of new types of laborsaving machinery".
  ['rapid change in technology', 3, ['71:8.11', '81:2.14', '81:6.22', '81:6.30', '99:1.1', '99:1.4']],
  ['truth, Beauty, love', 3, ['196:3.24', '1:7.3', '5:4.6', '196:3.29', '140:8.31']],
  // The reader's words are the book's: "take delight in cultivating these qualities".
  ['Take delight in cultivating', 1, ['16:6.9']],
  // Missed-question log, Oct–Nov 2026 (read and judged by hand):
  // 123:2.3 "From the time Jesus was five years old until he was ten, he was one continuous question mark."
  ['Jesus was one big question mark as a child', 1, ['123:2.3']],
  // 140:1.4 "for all others who would follow you into this kingdom, there is set a severe test".
  ['what is the severe test to remain in the kingdom of God', 1, ['140:1.4']],
  // 98:2.12 "Philosophy is to religion as conception is to action"; 112:2.12 "philosophy is the observation of this observation".
  ['How does the Urantia Book define philosophy?', 2, ['98:2.12', '112:2.12']],
  // 188:4 "Meaning of the Death on the Cross"; 187:0.3 "submit to death on the cross, he does of his own free will".
  ['WHY DID THE FATHER WILL THAT JESUS DIE ON THE CROSS?', 3, ['188:4.1', '188:4.3', '187:0.3']],
  // 100:2.4 "Spirituality becomes at once the indicator of one's nearness to God".
  ['what do you mean by spiritual?', 1, ['100:2.4']],
  // Paper 57: the Andronover nebula and the origin of Monmatia, "the solar system to which your world belongs" (57:5.3).
  // The reader meant "what are the leading values communicated in the UB?": 194:4.4 and 12:7.8,
  // "the fatherhood of God and the brotherhood of man"; 0:1.17, 56:10.9 "truth, beauty, and goodness".
  ['what are the main points of the urantia book?', 2, ['194:4.4', '12:7.8', '0:1.17', '56:10.9']],
  ['what are the leading values communicated in the ub?', 2, ['194:4.4', '12:7.8', '0:1.17', '56:10.9']],
  // The reader meant God or the Thought Adjuster: 5:6.1 "The Universal Father is the God of
  // personalities"; 1:0.3, 1:1.4, 1:0.1 the Universal Father; 110:1.2 the Adjusters as guides.
  ['who is the highest guiding spirituel  personality in the universe?', 3, ['1:1.4', '1:2.9', '1:0.1', '1:0.3', '5:6.1', '110:1.2']],
  ['who is the highest and wisest guiding  personality in the universe?', 1, ['5:6.1', '1:0.1', '1:0.3', '110:1.2']],
  ['who are the wisest divine guiding  personality in the universe?', 1, ['1:0.3', '1:0.1', '5:6.1', '110:1.2']],
  ['How was earth created', 3, ['57:5.3', '57:5.4', '57:6.1', '57:2.2', '15:3.6']],
]

for (const [q, n, good] of MISSED) {
  test(`missed question: ${q}`, () => {
    const refs = ask(q)
    assert.ok(refs.slice(0, n).some((ref) => good.includes(ref)), `top ${n} were: ${refs.slice(0, 5).join(', ')}`)
  })
}

test('missed question: What is God the Supreme as described in Paper 117?', () => {
  const refs = ask('What is God the Supreme as described in Paper 117?')
  for (const ref of refs.slice(0, 3)) {
    assert.ok(ref.startsWith('117:'), `top 3 were: ${refs.slice(0, 5).join(', ')}`)
    assert.match(byRef.get(ref).text, /God the Supreme/)
  }
})

test('a word inside a name keeps its meaning: "God the Supreme" is not mapped to the Universal Father', () => {
  const r = answer(E, 'What is God the Supreme?')
  assert.ok(!r.mapped.includes('Universal Father'), `mapped were: ${r.mapped.join(',')}`)
})

test('a hyphenated word the book never uses is still named in the never-used note', () => {
  const r = answer(E, 'Did Adam mate with non-adamic people?')
  assert.ok(r.quiet.some((x) => x.word === 'non-adamic' && x.total === 0))
})
