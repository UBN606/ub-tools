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
