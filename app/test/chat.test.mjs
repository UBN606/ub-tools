// node --test app/test/chat.test.mjs
// Tests the chat guard: messages that aren't questions for the book get a kind reply
// instead of passages that only share a word, and chatty questions are trimmed so the
// search sees only the question. The last tests run against the real search index.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { chatIntent, trimChat, STARTERS } from '../chat.js'
import { answer } from '../ask.js'

const kind = (q) => chatIntent(q)?.kind ?? null

test('greetings are recognized', () => {
  for (const q of ['Hello', 'Hi, are you there?', 'hey', 'Good morning!', 'Is anyone there?', 'testing'])
    assert.equal(kind(q), 'greeting', q)
})

test('thanks and blessings are recognized', () => {
  for (const q of ['Thank you so much', 'Thanks!', 'God bless you', 'thank you for your help', 'Amen', 'Wonderful, thank you'])
    assert.equal(kind(q), 'thanks', q)
})

test('follow-ups that point back at a last answer are recognized', () => {
  for (const q of ['Tell me more', 'Can you explain that in simpler words?', 'What do you mean?', 'Why?', 'go on', 'What about him?'])
    assert.equal(kind(q), 'followup', q)
})

test('a follow-up that names a subject is a question', () => {
  assert.equal(kind('What about Jesus?'), null)
})

test('questions about the book itself are recognized', () => {
  assert.equal(kind('Who wrote the Urantia Book?'), 'author')
  assert.equal(kind('who are the authors'), 'author')
  assert.equal(kind('Is the Urantia Book true?'), 'true')
  assert.equal(kind('Is it real?'), 'true')
})

test('asking for a paper opens the paper', () => {
  assert.deepEqual(chatIntent('summarize paper 1'), { kind: 'paper', paper: 1 })
  assert.deepEqual(chatIntent('Paper 112'), { kind: 'paper', paper: 112 })
  assert.deepEqual(chatIntent('open paper 0'), { kind: 'paper', paper: 0 })
  assert.equal(kind('read paper 197'), null, 'there is no Paper 197')
})

test('ordinary questions are left for Ask', () => {
  for (const q of ['What happens after we die?', 'Is there a hell?', 'Is God real?', 'Do animals have souls?', 'What is love?', 'How do I pray', 'Who is Michael?'])
    assert.equal(kind(q), null, q)
})

test('ordinary questions are not trimmed', () => {
  for (const q of ['What happens after we die?', 'Is there a hell?', 'What did Jesus teach?']) {
    const t = trimChat(q)
    assert.equal(t.trimmed, false, q)
    assert.equal(t.question, q)
  }
})

test('the chat around a question is trimmed away', () => {
  assert.equal(trimChat('Hello, could you please tell me what the book says about angels? Thank you').question, 'what the book says about angels?')
  assert.equal(trimChat('good morning I would like to know about Adam and Eve').question, 'Adam and Eve')
  const ta = trimChat('I have been reading the Urantia Book for 30 years and I always wondered about the Thought Adjuster, could you tell me what it is')
  assert.ok(ta.trimmed)
  assert.match(ta.question, /^the Thought Adjuster/)
  assert.doesNotMatch(ta.question, /reading|years|wondered|could you/i)
})

test('a long message is searched by its question sentence', () => {
  const t = trimChat('Can you help me understand what happens when we die? My husband passed last year and I want to know if I will see him again.')
  assert.equal(t.question, 'what happens when we die?')
  assert.ok(t.trimmed)
})

test('a message that is all chat falls back to the words typed', () => {
  const t = trimChat('please')
  assert.equal(t.question, 'please')
  assert.equal(t.trimmed, false)
})

// ---------- against the real search index ----------
const require = createRequire(import.meta.url)
const search = require('../../ub-search.js')
const index = require('../../source-texts/ub-search-index.json')
const byRef = new Map()
for (const p of index.papers)
  for (const s of p.sections)
    for (const par of s.paragraphs)
      byRef.set(par.ref, { ...par, paper: p.paper_index, paperTitle: p.paper_title, author: p.author, sectionTitle: s.section_title })
const E = { search, byRef }
const top = (q) => byRef.get(answer(E, q).refs[0])?.text || ''

test('every starter question leads with a passage on its subject', () => {
  const subject = {
    'What happens after we die?': /mansion world|morontia|survival|resurrection/i,
    'What is the Thought Adjuster?': /Adjuster/,
    'Does God love me?': /\blove\b/i,
    'How should I pray?': /\bpray/i,
    'What is the soul?': /\bsoul\b/i,
    'What is faith?': /\bfaith\b/i,
  }
  for (const q of STARTERS) {
    assert.ok(subject[q], `no subject check for starter: ${q}`)
    assert.match(top(q), subject[q], q)
  }
})

test('trimming the grief message turns vine passages into passages on survival', () => {
  const raw = 'Can you help me understand what happens when we die? My husband passed last year and I want to know if I will see him again.'
  assert.doesNotMatch(top(raw), /mansion world|morontia|survival/i, 'untrimmed baseline changed: revisit this test')
  assert.match(top(trimChat(raw).question), /mansion world|morontia|survival/i)
})
