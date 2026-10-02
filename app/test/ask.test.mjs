// node --test app/test/ask.test.mjs
// Tests the Ask question-answerer against the real search index: the exact
// paragraphs must lead for specific questions, and broad questions must keep
// working through the everyday-word -> book-term mappings.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { answer, toBookTerms } from '../ask.js'

const require = createRequire(import.meta.url)
const search = require('../../ub-search.js')
// byRef built the way app/engine.js builds it for the browser.
const index = require('../../source-texts/ub-search-index.json')
const byRef = new Map()
for (const p of index.papers)
  for (const s of p.sections)
    for (const par of s.paragraphs)
      byRef.set(par.ref, { ...par, paper: p.paper_index, paperTitle: p.paper_title, author: p.author, sectionTitle: s.section_title })
const E = { search, byRef }

test("possessives are stripped so Eve's matches Eve", () => {
  const { words } = toBookTerms("What were Adam and Eve's hair color?")
  assert.ok(words.includes('eve'), `words were: ${words.join(',')}`)
  assert.ok(!words.includes("eve's"))
})

test("'died' maps to the book's survival terms like 'die' does", () => {
  const { mapped } = toBookTerms('How old was Jesus when he died on the cross?')
  assert.ok(mapped.includes('mansion worlds'), `mapped were: ${mapped.join(',')}`)
})

test("'how old' maps to birth terms", () => {
  const { mapped } = toBookTerms('How old was Jesus when he died on the cross?')
  assert.ok(mapped.includes('born'), `mapped were: ${mapped.join(',')}`)
})

test('hair color question leads with the violet-race paragraph', () => {
  const r = answer(E, "What were Adam and Eve's hair color?")
  assert.equal(r.refs[0], '76:4.1')
})

test('Jesus age question leads with the birth paragraph', () => {
  const r = answer(E, 'How old was Jesus when he died on the cross?')
  assert.ok(r.refs.slice(0, 5).includes('122:8.1'), `top 5 were: ${r.refs.join(',')}`)
})

test('morontia-at-the-resurrection question leads with the assembled-hosts paragraphs', () => {
  const r = answer(E, 'Why were there morontia creatures on earth at the time of Jesus resurrection?')
  assert.equal(r.refs[0], '189:0.1')
  assert.equal(r.refs[1], '189:0.2')
})

test('everyday Jesus questions are untouched by the distinctive-words search', () => {
  const teach = answer(E, 'What did Jesus teach?')
  assert.deepEqual(teach.refs, ['163:2.4', '147:0.2', '151:1.1', '183:2.3', '196:2.1'])
  const pray = answer(E, 'How did Jesus pray?')
  assert.deepEqual(pray.refs, ['126:3.3', '144:1.10', '144:3.13', '196:0.10', '146:2.14'])
})

test('broad questions still answer through the term mappings', () => {
  const heaven = answer(E, 'where is heaven?')
  assert.deepEqual(heaven.refs, ['48:6.23', '15:7.5', '105:3.4', '45:1.2', '45:6.3'])
  const die = answer(E, 'what happens when we die?')
  assert.deepEqual(die.refs, ['47:4.4', '189:3.2', '30:4.15', '38:2.2', '47:3.5'])
  const melch = answer(E, 'who was Melchizedek?')
  assert.deepEqual(melch.refs, ['119:1.5', '35:1.2', '35:1.3', '35:3.22', '93:9.11'])
})

test("'define' is structural: the philosophy question answers about philosophy", () => {
  const r = answer(E, 'How does the Urantia Book define philosophy?')
  assert.ok(!r.refs.slice(0, 3).includes('94:8.16'), `top 3 were: ${r.refs.slice(0, 3).join(',')}`)
  assert.ok(r.refs.slice(0, 5).includes('103:6.14'), `top 5 were: ${r.refs.join(',')}`)
})

test("Spanish 'filosofia' maps to philosophy", () => {
  const { mapped } = toBookTerms('que es la filosofia para el libro de urantia')
  assert.ok(mapped.includes('philosophy'), `mapped were: ${mapped.join(',')}`)
  const r = answer(E, 'que es la filosofia para el libro de urantia')
  assert.ok(r.refs.slice(0, 5).includes('103:6.14'), `top 5 were: ${r.refs.join(',')}`)
})

test("parenthetical clarification names the term: 'Spoor Nega? (means Spornagia)'", () => {
  const r = answer(E, 'What are Spoor Nega? (means Spornagia)')
  assert.equal(r.refs[0], '37:10.3')
  assert.ok(r.refs.slice(0, 3).includes('46:7.2'), `top 3 were: ${r.refs.slice(0, 3).join(',')}`)
})

test("'metronita' misspelling maps to morontia and pairs with song", () => {
  const { mapped } = toBookTerms('where I come find the metronita song?')
  assert.ok(mapped.includes('morontia'), `mapped were: ${mapped.join(',')}`)
  const r = answer(E, 'where I come find the metronita song?')
  assert.equal(r.refs[0], '47:10.2')
})

test("'salvaged children' reaches the probationary nursery", () => {
  const r = answer(E, 'What are "salvaged children"?')
  assert.equal(r.refs[0], '47:2.1')
})

// Reader-email regressions (Oct 2026): questions from Derek's inbox that the tool
// must answer with the book's own words, no AI involved.
test('email: "exchange my mind for Jesus\'s mind" leads with 48:6.26', () => {
  const r = answer(E, "where does the ub say I can exchange my mind for Jesus's mind?")
  assert.equal(r.refs[0], '48:6.26')
})

test('email: "How old is Earth?" leads with the billion-year age statement', () => {
  const r = answer(E, 'How old is Earth?')
  assert.equal(r.refs[0], '57:8.1')
})

test('email: "How old is Urantia?" and "age of the Earth" lead with 57:8.1 too', () => {
  assert.equal(answer(E, 'How old is Urantia?').refs[0], '57:8.1')
  assert.equal(answer(E, 'What is the age of the Earth?').refs[0], '57:8.1')
})

test('email: Jesus\'s siblings leads with "eight brothers and sisters"', () => {
  const r = answer(E, 'How many brothers and sisters did Jesus have?')
  assert.equal(r.refs[0], '127:2.8')
})

test('email: highest and wisest personality leads with all-wisdom', () => {
  const r = answer(E, 'who is the highest and wisest guiding personality in the universe?')
  assert.equal(r.refs[0], '3:2.9')
})

test('email: "the god in me" leads with the indwelling Adjuster', () => {
  const r = answer(E, 'Tell me about the god in me')
  assert.equal(r.refs[0], '1:2.8')
})

test('email: eternity and infinity lead with the eternity-infinity ellipse', () => {
  const r = answer(E, 'Is eternity at the opposite end of infinity?')
  assert.equal(r.refs[0], '105:0.1')
})

test('email: Morontia Nursery leads with the finaliters\' world', () => {
  const r = answer(E, 'Where is the Morontia Nursery?')
  assert.equal(r.refs[0], '45:6.7')
})

// Open Ask items (Oct 1, 2026): the short morontia wording, Jesus's age at
// death, and narrowing of generic "how old was X?" questions.
test('short morontia wording leads with the morontia-creatures paragraph', () => {
  const r = answer(E, 'Why were morontia creatures on earth?')
  assert.equal(r.refs[0], '191:3.1')
})

test('"How old was Jesus when he died?" leads with the stated lifespan', () => {
  for (const q of ['How old was Jesus when he died?', 'How old was Jesus when he died on the cross?']) {
    const r = answer(E, q)
    assert.equal(r.refs[0], '189:1.2', `for ${q}: top 5 were ${r.refs.slice(0, 5).join(',')}`)
    assert.ok(r.refs.slice(0, 5).includes('122:8.1'), `for ${q}: top 5 were ${r.refs.slice(0, 5).join(',')}`)
  }
})

test('generic "how old was X?" no longer leads with birth-word noise', () => {
  // 103:2.1 is about the "birth" of religion: it only ever ranked here because
  // the bare birth/born searches matched the word "birth".
  for (const q of ['How old was Moses?', 'How old was Abraham?']) {
    const r = answer(E, q)
    assert.ok(!r.refs.slice(0, 3).includes('103:2.1'), `for ${q}: top 3 were ${r.refs.slice(0, 3).join(',')}`)
  }
})
