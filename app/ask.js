// Ask: a plain question answered in the book's own words. No AI writes anything, so nothing can
// be misquoted and nothing costs money. Everyday words are mapped to the book's own terms
// ("heaven" -> mansion worlds, "conscience" -> Thought Adjuster), the tools' own search finds the
// paragraphs, and the best few are shown whole, with citations, ready to be read aloud.

// Everyday word -> the book's own terms. Add a line when a common question finds nothing.
export const BOOK_TERMS = {
  die: ['survival', 'mansion worlds', 'resurrection halls'], death: ['survival', 'mansion worlds', 'resurrection halls'],
  dead: ['survival', 'mansion worlds'], dying: ['survival', 'mansion worlds'], afterlife: ['mansion worlds', 'survival'],
  heaven: ['mansion worlds', 'Paradise'], hell: ['hell'], 'life after death': ['mansion worlds', 'survival'],
  god: ['Universal Father'], father: ['Universal Father'], creator: ['Universal Father', 'Creator Son'],
  soul: ['soul'], spirit: ['Thought Adjuster', 'Spirit of Truth'], conscience: ['Thought Adjuster'],
  'inner voice': ['Thought Adjuster'], 'holy spirit': ['Holy Spirit', 'Spirit of Truth'],
  angel: ['guardian seraphim', 'seraphim'], angels: ['guardian seraphim', 'seraphim'], 'guardian angel': ['guardian seraphim', 'destiny guardian'],
  jesus: ['Jesus'], christ: ['Michael', 'Jesus'], pray: ['prayer'], prayer: ['prayer'], praying: ['prayer'],
  worship: ['worship'], faith: ['faith'], believe: ['faith'], sin: ['sin'], evil: ['evil'], devil: ['Lucifer', 'Caligastia'],
  satan: ['Satan', 'Lucifer'], forgive: ['forgiveness'], forgiveness: ['forgiveness'], suffering: ['suffering', 'adversity'],
  pain: ['suffering'], grief: ['sorrow'], love: ['love'], marriage: ['marriage'], children: ['children'], family: ['family'],
  reincarnation: ['reincarnation'], animals: ['animals'], pets: ['animals'], adam: ['Adam and Eve'], eve: ['Adam and Eve'],
  universe: ['universe'], purpose: ['purpose of life', 'perfection'], meaning: ['meaning of life', 'values'], happiness: ['happiness', 'joy'],
  fear: ['fear'], worry: ['anxiety', 'worry'], healing: ['healing'], miracle: ['miracles'], miracles: ['miracles'],
}
const QUESTION_WORDS = new Set('what whats who whom whose when where why how which does do did is are was were will would can could should shall may might the a an of to in on for from with about into and or but if then than that this these those it its be been being have has had i me my we our you your they them their he him his she her there here say says said tell book urantia ub please'.split(' '))

// The question's own content words, and the book's terms they map to.
export function toBookTerms(question) {
  const q = question.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z'\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  const mapped = []
  for (const [k, terms] of Object.entries(BOOK_TERMS)) {
    if (new RegExp(`\\b${k}\\b`).test(q)) mapped.push(...terms)
  }
  const words = q.split(' ').filter((w) => w.length > 2 && !QUESTION_WORDS.has(w.replace(/'s$/, '')))
  return { words, mapped: [...new Set(mapped)] }
}

// Run the tools' own search for the question's words and for each mapped book term, and rank the
// paragraphs found by how many of those searches found them, and how well.
export function answer(E, question, { max = 5 } = {}) {
  const { words, mapped } = toBookTerms(question)
  const queries = []
  if (words.length) queries.push({ q: words.join(' '), weight: 1 })
  for (const t of mapped) queries.push({ q: t, weight: 1.2 })
  const score = new Map()
  for (const { q, weight } of queries) {
    const r = E.search.searchUB({ query: q, limit: 25 })
    r.results.forEach((x, i) => {
      const s = (x.score / 100 + (25 - i) / 100) * weight
      score.set(x.ref, (score.get(x.ref) || 0) + s)
    })
  }
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([ref]) => ref)
  return { refs: ranked, words, mapped }
}

// ---------- reading aloud (the browser's own voice; free) ----------
// Book terms are spoken from the Urantia Foundation's pronunciation guide (pronounce.json:
// Nebadon -> "Nehbuhdahn"). Microsoft's neural "Natural" voices (Edge on Windows) are preferred.
let SAY = null
fetch(new URL('./pronounce.json', import.meta.url)).then((r) => r.json()).then((j) => {
  const terms = Object.keys(j.say).sort((a, b) => b.length - a.length)
  const escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  SAY = { re: new RegExp(`\\b(${terms.map(escRe).join('|')})\\b`, 'g'), map: j.say }
}).catch(() => {})
export const spoken = (text) => (SAY ? text.replace(SAY.re, (m) => SAY.map[m] || m) : text)
// English voices, most natural first: Microsoft Natural/Online, then Google and premium voices.
const rank = (v) => (/Microsoft.*(Natural|Online)/i.test(v.name) ? 0 : /natural|neural|premium|enhanced|siri/i.test(v.name) ? 1 : /google/i.test(v.name) ? 2 : 3)
export function englishVoices() {
  if (typeof speechSynthesis === 'undefined') return []
  return speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}
// Voices arrive a moment after the page opens; call back when they are known.
export function whenVoices(cb) {
  if (typeof speechSynthesis === 'undefined') return
  if (speechSynthesis.getVoices().length) cb()
  speechSynthesis.addEventListener?.('voiceschanged', cb)
}
let chosen = null
try { chosen = localStorage.getItem('voice') } catch {}
export function chooseVoice(name) { chosen = name; try { localStorage.setItem('voice', name) } catch {} }
export const speech = {
  ok: typeof speechSynthesis !== 'undefined',
  say(text, onEnd) {
    if (!this.ok) return
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(spoken(text))
    u.rate = 0.92
    const en = englishVoices()
    u.voice = en.find((v) => v.name === chosen) || en[0] || null
    if (onEnd) u.onend = onEnd
    speechSynthesis.speak(u)
  },
  stop() { if (this.ok) speechSynthesis.cancel() },
}

// ---------- listening (the browser's speech recognition, where the browser has it) ----------
export function listener(onText, onState) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!R) return null
  const r = new R()
  r.lang = 'en-US'
  r.interimResults = false
  r.maxAlternatives = 1
  r.onresult = (e) => onText(e.results[0][0].transcript)
  r.onstart = () => onState(true)
  r.onend = () => onState(false)
  r.onerror = () => onState(false)
  return r
}
