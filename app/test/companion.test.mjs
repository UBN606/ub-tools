// node --test app/test/companion.test.mjs
// The on-device companion: it may reword the reader's question and say hello, but it
// must never speak for the book, and a broken or confused model must never block Ask.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseSettings, normalizeUrl, isLocalUrl, listModels, chat, stripThinking, firstJSON,
  understandMessages, parseUnderstanding, welcomeMessages, guardIntro, DEFAULT_URL,
} from '../companion.js'

// A stand-in for LM Studio's OpenAI-style server.
function fakeServer(reply, { status = 200, models = ['qwen3-4b', 'text-embedding-nomic'] } = {}) {
  const calls = []
  const fetchFn = async (url, init = {}) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null })
    const json = url.endsWith('/models')
      ? { data: models.map((id) => ({ id })) }
      : { choices: [{ message: { content: typeof reply === 'function' ? reply(calls.at(-1).body) : reply } }] }
    return { ok: status < 400, status, json: async () => json }
  }
  return { fetchFn, calls }
}

test('settings: off unless turned on, LM Studio address by default', () => {
  assert.deepEqual(parseSettings(null), { on: false, url: DEFAULT_URL, model: '' })
  assert.equal(parseSettings({ on: 'yes' }).on, false)
  assert.equal(parseSettings({ on: true, url: 'localhost:11434', model: ' qwen3 ' }).url, 'http://localhost:11434/v1')
  assert.equal(parseSettings({ on: true, model: ' qwen3 ' }).model, 'qwen3')
})

test('addresses: /v1 added, only this computer allowed', () => {
  assert.equal(normalizeUrl('http://127.0.0.1:1234/'), 'http://127.0.0.1:1234/v1')
  assert.equal(normalizeUrl('http://localhost:1234/v1'), 'http://localhost:1234/v1')
  assert.ok(isLocalUrl('http://127.0.0.1:1234/v1'))
  assert.ok(isLocalUrl('http://localhost:11434/v1'))
  assert.ok(!isLocalUrl('https://api.example.com/v1'), 'questions must not leave the computer')
  assert.ok(!isLocalUrl('not a url'))
})

test('lists chat models, not embedding models', async () => {
  const { fetchFn, calls } = fakeServer('')
  assert.deepEqual(await listModels('localhost:1234', { fetchFn }), ['qwen3-4b'])
  assert.equal(calls[0].url, 'http://localhost:1234/v1/models')
})

test('chat: sends the model, strips reasoning, reports server errors', async () => {
  const { fetchFn, calls } = fakeServer('<think>Let me think about Jesus.</think>\n{"question":"Who was Jesus?","reply":""}')
  const out = await chat({ url: DEFAULT_URL, model: 'qwen3-4b' }, [{ role: 'user', content: 'hi' }], { fetchFn })
  assert.equal(out, '{"question":"Who was Jesus?","reply":""}')
  assert.equal(calls[0].url, `${DEFAULT_URL}/chat/completions`)
  assert.equal(calls[0].body.model, 'qwen3-4b')
  assert.equal(calls[0].body.stream, false)
  await assert.rejects(chat({ url: DEFAULT_URL }, [], { fetchFn: fakeServer('', { status: 500 }).fetchFn }), /answered 500/)
  assert.equal(stripThinking('<think>unfinished'), '', 'a cut-off reasoning block leaves nothing')
})

test('finds the JSON inside chatty or fenced replies', () => {
  assert.deepEqual(firstJSON('Sure! ```json\n{"question":"What is a {soul}?","reply":""}\n```'), { question: 'What is a {soul}?', reply: '' })
  assert.equal(firstJSON('no json here'), null)
  assert.equal(firstJSON('{"question": "unterminated'), null)
})

test('understand: earlier questions go along so "him" can be resolved', () => {
  const m = understandMessages('what about his brothers?', [{ asked: 'tell me about jesus', searched: 'Who was Jesus?' }])
  assert.equal(m[0].role, 'system')
  assert.match(m[1].content, /1\. Who was Jesus\?/)
  assert.match(m[1].content, /Newest message: what about his brothers\?/)
  assert.equal(understandMessages('hi', Array.from({ length: 6 }, (_, i) => ({ asked: `q${i}` })))[1].content.match(/^\d\./gm).length, 3, 'only the last three')
})

test('understand: a good rewrite is used, anything odd falls back to the reader\'s words', () => {
  assert.deepEqual(parseUnderstanding('{"question":"Who were Jesus\'s brothers?","reply":""}', 'what about his brothers'),
    { question: "Who were Jesus's brothers?", reply: '', fallback: false })
  assert.equal(parseUnderstanding('I think you mean the brothers', 'what about his brothers').question, 'what about his brothers')
  assert.equal(parseUnderstanding('{"reply":"hi"}', 'q').fallback, true, 'no question field')
  const essay = '{"question":"' + 'Jesus had four brothers named James Joseph Simon and Jude and they were '.repeat(3) + '","reply":""}'
  assert.equal(parseUnderstanding(essay, 'brothers?').fallback, true, 'a long "rewrite" is an answer')
})

test('understand: small talk gets a kind reply, but only a safe one', () => {
  assert.deepEqual(parseUnderstanding('{"question":"","reply":"You\'re very welcome! Ask me anything about the book."}', 'thanks!'),
    { question: '', reply: "You're very welcome! Ask me anything about the book.", fallback: false })
  const r = parseUnderstanding('{"question":"","reply":"God is love, as the book says."}', 'hi')
  assert.equal(r.fallback, true, 'a reply that speaks for the book is dropped and the search runs')
})

test('welcome prompt names where the passages are from, not what they say', () => {
  const m = welcomeMessages('What happens after we die?', [{ ref: '47:3.1', paperTitle: 'The Seven Mansion Worlds', section: '3. The First Mansion World', text: 'SECRET TEXT' }])
  assert.match(m[1].content, /47:3\.1 \(The Seven Mansion Worlds, 3\. The First Mansion World\)/)
  assert.doesNotMatch(m[1].content, /SECRET TEXT/)
})

test('guard keeps a warm welcome', () => {
  const ok = [
    "What a beautiful question to sit with. Here are the passages to read, starting with the one that speaks most directly to it.",
    "That's a question many readers ask. Take your time with the passages below.",
    'You are asking about something close to the heart of the book. Read on.',
  ]
  for (const t of ok) assert.equal(guardIntro(t), t, t)
  assert.equal(guardIntro('**Great question!** Read on.'), 'Great question! Read on.', 'markdown removed')
})

test('guard refuses anything that speaks for the book', () => {
  const bad = [
    'The book says we survive death on the mansion worlds.',
    'According to the Urantia Book, the soul lives on.',
    'God is love, and these passages show it.',
    'Jesus was born in Bethlehem. Read below.',
    'The Thought Adjusters are fragments of God.',
    'Here is "the Father loves you" in the book.',
    'See 47:3.1 for the answer.',
    'In short, you will wake up on the first mansion world.',
    'The passages explain that death is not the end.',
    'One. Two. Three sentences is too many.',
    '- first point - second point',
    '',
  ]
  for (const t of bad) assert.equal(guardIntro(t), null, t)
})

test('guard refuses restating a passage without quote marks', () => {
  const p = [{ text: 'The mortal survivors awaken in the resurrection halls of the first mansion world.' }]
  assert.equal(guardIntro('Imagine how you awaken in the resurrection halls of the first world.', p), null)
  assert.equal(guardIntro('Here is where the book takes up your question.', p), 'Here is where the book takes up your question.')
})
