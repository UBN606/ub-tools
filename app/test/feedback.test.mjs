// node --test app/test/feedback.test.mjs
// Tests the missed-question feedback payload and sender (pure, no DOM).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { missedPayload, sendMissed } from '../feedback.js'

test('missedPayload carries the question, page and timestamp', () => {
  const p = missedPayload('What happens after we die?')
  assert.equal(p.question, 'What happens after we die?')
  assert.ok(typeof p.at === 'string' && p.at.length > 0)
  assert.ok(typeof p.page === 'string')
})

test('missedPayload truncates very long questions', () => {
  const p = missedPayload('x'.repeat(900))
  assert.equal(p.question.length, 500)
})

test('sendMissed does nothing without an endpoint', async () => {
  let called = false
  const r = await sendMissed('', 'hello?', () => { called = true; return Promise.resolve({}) })
  assert.equal(r, false)
  assert.equal(called, false)
})

test('sendMissed POSTs JSON to the endpoint', async () => {
  let seen = null
  const fake = (url, opts) => { seen = { url, opts }; return Promise.resolve({}) }
  const r = await sendMissed('https://example.invalid/log', 'Where is Havona?', fake)
  assert.equal(r, true)
  assert.equal(seen.url, 'https://example.invalid/log')
  assert.equal(seen.opts.method, 'POST')
  const body = JSON.parse(seen.opts.body)
  assert.equal(body.question, 'Where is Havona?')
})

test('sendMissed never throws on network failure', async () => {
  const bad = () => Promise.reject(new Error('offline'))
  const r = await sendMissed('https://example.invalid/log', 'q?', bad)
  assert.equal(r, false)
})
