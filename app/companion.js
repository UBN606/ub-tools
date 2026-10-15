// companion.js: an optional AI "companion" for Ask, run by a model on the reader's own
// computer (LM Studio, Ollama, llama.cpp: anything with an OpenAI-style /v1 API on
// localhost). Nothing goes to a cloud service and nothing costs money.
//
// The model never speaks for the book. It does two small jobs around the search:
//  1. Understand: turn the reader's message into a plain, standalone question for the
//     search ("what about his brothers?" after a question about Jesus -> "Who were
//     Jesus's brothers?"), fixing spelling and translating, or notice it isn't a
//     question at all ("thank you!") and answer kindly.
//  2. Welcome: one or two warm sentences in front of the passages the search found.
//     guardIntro() throws the sentence away if it quotes, restates or claims anything
//     about what the book teaches, so every word of the book on screen is still the
//     book's own, with its citation.
// Pure logic plus fetch, so it can be tested with a stand-in server.

export const COMPANION_KEY = 'companion'
export const DEFAULT_URL = 'http://127.0.0.1:1234/v1' // LM Studio's local server

// What the reader set up: { on, url, model }. Off unless they turned it on.
export function parseSettings(v) {
  const s = v && typeof v === 'object' ? v : {}
  return {
    on: s.on === true,
    url: normalizeUrl(typeof s.url === 'string' && s.url.trim() ? s.url : DEFAULT_URL),
    model: typeof s.model === 'string' ? s.model.trim() : '',
  }
}

// "localhost:1234" or "http://127.0.0.1:1234/" -> "http://localhost:1234/v1". Ollama is
// at :11434/v1, LM Studio at :1234/v1; readers often paste the address without /v1.
export function normalizeUrl(u) {
  let s = String(u || '').trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s
  if (!/\/v\d+$/.test(s)) s += '/v1'
  return s
}

// Only this computer: the companion is "on your own computer", so a remote address
// would quietly send readers' questions elsewhere.
export function isLocalUrl(u) {
  try {
    const h = new URL(u).hostname
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1'
  } catch { return false }
}

async function getJSON(fetchFn, url, init, timeoutMs) {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  try {
    const res = await fetchFn(url, { ...init, signal: ctrl?.signal })
    if (!res.ok) throw new Error(`The model server answered ${res.status}`)
    return await res.json()
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('The model took too long to answer')
    throw e
  } finally { if (timer) clearTimeout(timer) }
}

// The models the server has. LM Studio lists what is downloaded; the reader picks one.
export async function listModels(url, { fetchFn = fetch, timeoutMs = 5000 } = {}) {
  const j = await getJSON(fetchFn, `${normalizeUrl(url)}/models`, { method: 'GET' }, timeoutMs)
  return (j.data || []).map((m) => m.id).filter((id) => typeof id === 'string' && !/embed/i.test(id))
}

// One chat call. Returns the text with any <think>...</think> reasoning removed
// (Qwen3 and DeepSeek-R1 style models write their reasoning first).
export async function chat(settings, messages, { fetchFn = fetch, timeoutMs = 45000, maxTokens = 200 } = {}) {
  const body = { messages, temperature: 0.2, max_tokens: maxTokens, stream: false }
  if (settings.model) body.model = settings.model
  const j = await getJSON(fetchFn, `${normalizeUrl(settings.url)}/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }, timeoutMs)
  const text = j?.choices?.[0]?.message?.content
  if (typeof text !== 'string') throw new Error('The model sent back no text')
  return stripThinking(text)
}

export function stripThinking(t) {
  return String(t).replace(/<think>[\s\S]*?(<\/think>|$)/gi, '').trim()
}

// The first {...} in a reply, parsed. Small models wrap JSON in prose or ``` fences.
export function firstJSON(t) {
  const s = String(t)
  const start = s.indexOf('{')
  if (start < 0) return null
  let depth = 0, inStr = false, escNext = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (escNext) escNext = false
      else if (c === '\\') escNext = true
      else if (c === '"') inStr = false
    } else if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(s.slice(start, i + 1)) } catch { return null }
    }
  }
  return null
}

// ---------- 1. understand ----------

// "/no_think" turns off Qwen3's long reasoning; other models ignore it.
export const UNDERSTAND_SYSTEM = `You help a reader search The Urantia Book. You never answer questions yourself and never say what the book teaches.
Read the conversation and the reader's newest message. Reply with JSON only, no other text:
{"question": "...", "reply": "..."}
- "question": the newest message as one short, complete question in plain English that makes sense on its own. Replace words like he, him, it, that, they with what they mean from the earlier questions. Fix spelling. Translate into English. Keep the reader's meaning, add nothing.
- If the newest message is not a question or request about the book (a greeting, thanks, small talk), set "question" to "" and put one short friendly sentence in "reply" that invites them to ask about the book.
- Otherwise "reply" is "".
/no_think`

// history: earlier turns, oldest first, as [{ asked, searched }].
export function understandMessages(message, history = []) {
  const recent = history.slice(-3)
  const context = recent.length
    ? 'Earlier questions, oldest first:\n' + recent.map((h, i) => `${i + 1}. ${h.searched || h.asked}`).join('\n') + '\n\n'
    : ''
  return [
    { role: 'system', content: UNDERSTAND_SYSTEM },
    { role: 'user', content: `${context}Newest message: ${message}` },
  ]
}

// The model's reply -> { question, reply }. Anything unusable falls back to the reader's
// own words, so a confused model can only cost a little, never block the search.
export function parseUnderstanding(text, message) {
  const j = firstJSON(text)
  const own = { question: String(message), reply: '', fallback: true }
  if (!j || typeof j !== 'object') return own
  const question = typeof j.question === 'string' ? j.question.replace(/\s+/g, ' ').trim() : null
  const reply = typeof j.reply === 'string' ? j.reply.replace(/\s+/g, ' ').trim() : ''
  if (question === null) return own
  if (!question) {
    // Not a question: a kind reply, if it is a short plain sentence that claims nothing.
    const r = guardIntro(reply, [])
    return r ? { question: '', reply: r, fallback: false } : own
  }
  // A rewrite that runs long has started answering instead of rewording.
  if (question.length > 200 || question.split(' ').length > 30) return own
  return { question, reply: '', fallback: false }
}

// ---------- 2. welcome ----------

export const WELCOME_SYSTEM = `You are a warm, humble study companion. A reader asked a question and a search found passages from The Urantia Book, which the reader will read in full right below what you write.
Write one or two short, friendly sentences that welcome the question and invite them to read the passages. Do not quote, summarize, explain or restate anything the passages say, and do not say what the book teaches, what is true, or what God, Jesus or anyone is or does. Speak only about the reader's question and about reading. No quotation marks. Plain sentences only, no lists or markdown.
/no_think`

export function welcomeMessages(question, passages) {
  const where = passages.slice(0, 3).map((p) => `${p.ref} (${p.paperTitle}${p.section ? ', ' + p.section : ''})`).join('; ')
  return [
    { role: 'system', content: WELCOME_SYSTEM },
    { role: 'user', content: `The reader asked: ${question}\nThe passages found are from: ${where}` },
  ]
}

// Patterns that mean the sentence speaks for the book instead of pointing to it.
const CLAIMS = [
  /\b(book|urantia|passages?|paper|papers|revelation|text|it|they)\s+(says?|said|teach(es)?|taught|states?|explains?|tells?|describes?|reveals?|claims?|shows?|suggests?|emphasizes?|affirms?|indicates?|mentions?|notes?)\b/i,
  /\baccording to\b/i,
  /\b(god|jesus|christ|michael|the father|adjusters?|angels?|seraphim|lucifer|satan|the soul|souls|spirit|paradise|mansion worlds?|heaven|humans?|mortals?|man|death|life)\s+(is|are|was|were|will|does|do|did|has|have|can|cannot|can't|must|never|always)\b/i,
  /\b(means?|meaning) that\b/i,
  /\b(the answer is|in short|in other words|simply put|essentially|basically)\b/i,
]

// The welcome sentence, cleaned, or null to show none. Quotes are refused outright: a
// quote typed by a model is the one place a misquote could slip in front of a reader.
export function guardIntro(text, passages = []) {
  let t = stripThinking(text || '').replace(/[*_#`>]/g, '').replace(/\s+/g, ' ').trim()
  if (!t) return null
  if (/["“”«»„]/.test(t) || /(^|\s)'[^']{3,}'(\s|[.,!?]|$)/.test(t)) return null
  if (/\b\d{1,3}:\d{1,2}(\.\d{1,3})?\b/.test(t)) return null // citations belong to the cards
  if (CLAIMS.some((re) => re.test(t))) return null
  if (/(^|\s)(-|\d+\.)\s/.test(t)) return null // lists
  const sentences = t.match(/[^.!?]+[.!?]+/g) || [t]
  if (sentences.length > 2 || t.length > 260) return null
  // A run of five or more of a passage's words is restating it, even without quote marks.
  const words = (s) => s.toLowerCase().replace(/[^a-z'\s]/g, ' ').split(/\s+/).filter(Boolean)
  const tw = words(t)
  for (const p of passages) {
    const pw = ' ' + words(p.text || '').join(' ') + ' '
    for (let i = 0; i + 5 <= tw.length; i++) {
      if (pw.includes(' ' + tw.slice(i, i + 5).join(' ') + ' ')) return null
    }
  }
  return t
}
