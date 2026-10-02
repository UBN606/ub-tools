// node --test app/test/edge-voices.test.mjs
// The Studio's Microsoft Edge neural voices (via the website's /api/tts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EDGE_API, EDGE_VOICES, EDGE_DEFAULT,
  edgeOptionValue, edgeVoiceId, edgeAvailable, edgeAudio,
} from '../edge-voices.js'

test('voice list matches the website: 12 voices, Andrew default', () => {
  assert.equal(EDGE_VOICES.length, 12)
  assert.equal(EDGE_DEFAULT, 'en-US-AndrewMultilingualNeural')
  assert.ok(EDGE_VOICES.some((v) => v.id === EDGE_DEFAULT && v.label === 'Andrew'))
  for (const v of EDGE_VOICES) {
    assert.match(v.id, /^en-[A-Z]{2}-.+Neural$/, `voice id shape: ${v.id}`)
    assert.ok(v.label.length > 0)
  }
  assert.equal(new Set(EDGE_VOICES.map((v) => v.id)).size, 12, 'no duplicate ids')
})

test('option values namespace Edge voices apart from device voices', () => {
  assert.equal(edgeOptionValue('en-US-AndrewMultilingualNeural'), 'edge:en-US-AndrewMultilingualNeural')
  assert.equal(edgeVoiceId('edge:en-US-AndrewMultilingualNeural'), 'en-US-AndrewMultilingualNeural')
  assert.equal(edgeVoiceId('Albert'), null)
  assert.equal(edgeVoiceId(''), null)
  assert.equal(edgeVoiceId(null), null)
})

test('edgeAvailable: true on probe ok, false on failure, never throws', async () => {
  const realFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => ({ ok: true })
    // reset the module's probe cache by reimporting
    const m1 = await import('../edge-voices.js?probe-ok')
    assert.equal(await m1.edgeAvailable(), true)
    globalThis.fetch = async () => { throw new Error('CORS blocked') }
    const m2 = await import('../edge-voices.js?probe-fail')
    assert.equal(await m2.edgeAvailable(), false)
  } finally {
    globalThis.fetch = realFetch
  }
})

test('edgeAudio: throws on HTTP error so the caller falls back', async () => {
  const realFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => ({ ok: false, status: 429 })
    await assert.rejects(edgeAudio('hello', EDGE_DEFAULT), /429/)
    globalThis.fetch = async () => { throw new Error('nope') }
    await assert.rejects(edgeAudio('hello', EDGE_DEFAULT), /unreachable/)
  } finally {
    globalThis.fetch = realFetch
  }
})

test('API endpoint is the website TTS route', () => {
  assert.equal(EDGE_API, 'https://urantiabooknetwork.com/api/tts')
})
