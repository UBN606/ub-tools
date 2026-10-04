// node --test app/test/garble.test.mjs
// Tests the voice-garble guard: dictation noise and fragments should be
// flagged as "didn't come through clearly", while clear questions the book
// couldn't answer keep the normal miss message.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { looksGarbled } from '../ask.js'

const noRefs = (mapped = []) => ({ refs: [], mapped })
const withRefs = (mapped = ['god']) => ({ refs: ['1:0.1'], mapped })

test('single words and fragments are garble', () => {
  assert.ok(looksGarbled('Rugged', noRefs()))
  assert.ok(looksGarbled('bigfoot', noRefs()))
  assert.ok(looksGarbled('one another?', noRefs()))
  assert.ok(looksGarbled('The difference between.', noRefs()))
  assert.ok(looksGarbled("don't think winter", noRefs()))
})

test('short questions with nothing recognized are garble', () => {
  assert.ok(looksGarbled('what does the rancher book', noRefs()))
})

test('clear questions are not garble even when missed', () => {
  assert.ok(!looksGarbled('Is there a God', noRefs(['god'])))
  assert.ok(!looksGarbled('Do humans reincarnate', noRefs(['reincarnation'])))
  assert.ok(!looksGarbled('What happens after we die', noRefs(['death'])))
})

test('anything that found passages is not garble', () => {
  assert.ok(!looksGarbled('Rugged', withRefs([])))
})

test('empty and whitespace input is garble', () => {
  assert.ok(looksGarbled('', noRefs()))
  assert.ok(looksGarbled('   ', noRefs()))
})
