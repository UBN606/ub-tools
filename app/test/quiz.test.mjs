// Tests for app/quiz.js and app/quiz-bank.json. Run: node --test app/test/quiz.test.mjs
// The bank is machine-sliced: this suite re-verifies every question against
// the book with the repo's own ub-verify.js (checkQuote) and requires PASS.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { shuffle, pickDistractors, normalizeAnswer, renderQuizView } from '../quiz.js'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')
const require = createRequire(join(ROOT, 'ub-verify.js'))
const verify = require('./ub-verify.js')

const bank = JSON.parse(readFileSync(join(here, '..', 'quiz-bank.json'), 'utf8'))
const questions = bank.questions
const allRefs = questions.map((q) => q.ref)

// A fixed-seed PRNG so the distractor trials are deterministic.
function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

describe('quiz-bank.json', () => {
  it('has a build date and a non-empty question list', () => {
    assert.match(bank.built, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(Array.isArray(questions) && questions.length > 0)
  })

  it('keeps every quote within the 80–220 char slice bounds', () => {
    for (const q of questions) {
      assert.ok(
        q.quote.length >= 80 && q.quote.length <= 220,
        `${q.ref}: ${q.quote.length} chars`,
      )
    }
  })

  it('has no duplicate quotes', () => {
    const quotes = questions.map((q) => q.quote)
    assert.equal(new Set(quotes).size, quotes.length)
  })

  it('has no duplicate refs', () => {
    assert.equal(new Set(allRefs).size, allRefs.length)
  })

  it('spans many papers (one question per paper, ≥150 distinct)', () => {
    const papers = new Set(allRefs.map((r) => r.split(':')[0]))
    assert.ok(papers.size >= 150, `only ${papers.size} papers`)
  })

  it('every question verifies PASS against its own ref (re-verified)', () => {
    const fails = []
    for (const q of questions) {
      const r = verify.checkQuote({ body: q.quote, citation: q.ref, refs: [q.ref] })
      if (r.status !== 'PASS') fails.push(`${q.ref}: ${r.status}`)
    }
    assert.deepEqual(fails, [])
  })
})

describe('pickDistractors', () => {
  it('never includes the correct ref, across seeded trials', () => {
    const rand = seeded(42)
    for (const ref of allRefs) {
      const d = pickDistractors(ref, allRefs, rand)
      assert.ok(!d.includes(ref), `${ref} leaked into its own distractors`)
    }
  })

  it('returns 3 unique refs from other papers', () => {
    const rand = seeded(7)
    for (const ref of allRefs.slice(0, 25)) {
      const paper = ref.split(':')[0]
      const d = pickDistractors(ref, allRefs, rand)
      assert.equal(d.length, 3)
      assert.equal(new Set(d).size, 3)
      for (const x of d) {
        assert.notEqual(x, ref)
        assert.notEqual(x.split(':')[0], paper)
        assert.ok(allRefs.includes(x), `${x} is not a bank ref`)
      }
    }
  })
})

describe('helpers', () => {
  it('shuffle keeps every element and does not mutate the input', () => {
    const input = ['a', 'b', 'c', 'd', 'e']
    const out = shuffle(input, seeded(3))
    assert.deepEqual([...out].sort(), [...input].sort())
    assert.deepEqual(input, ['a', 'b', 'c', 'd', 'e'])
  })

  it('normalizeAnswer tolerates spaces around paper:section.paragraph', () => {
    assert.equal(normalizeAnswer(' 180:2.1 '), '180:2.1')
    assert.equal(normalizeAnswer('180 : 2.1'), '180:2.1')
    assert.notEqual(normalizeAnswer('180:2.2'), '180:2.1')
  })

  it('renderQuizView is exported for the app to mount', () => {
    assert.equal(typeof renderQuizView, 'function')
  })
})
