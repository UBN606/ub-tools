// Ask: a plain question answered in the book's own words. No AI writes anything, so nothing can
// be misquoted and nothing costs money. Everyday words are mapped to the book's own terms
// ("heaven" -> mansion worlds, "conscience" -> Thought Adjuster), the tools' own search finds the
// paragraphs, and the best few are shown whole, with citations, ready to be read aloud.

// Everyday word -> the book's own terms. Add a line when a common question finds nothing.
export const BOOK_TERMS = {
  die: ['survival', 'mansion worlds', 'resurrection halls'], death: ['survival', 'mansion worlds', 'resurrection halls'],
  died: ['survival', 'mansion worlds', 'resurrection halls'], dies: ['survival', 'mansion worlds', 'resurrection halls'],
  dead: ['survival', 'mansion worlds'], dying: ['survival', 'mansion worlds'], afterlife: ['mansion worlds', 'survival'],
  heaven: ['mansion worlds', 'Paradise'], hell: ['hell'], 'life after death': ['mansion worlds', 'survival'],
  god: ['Universal Father'], father: ['Universal Father'], creator: ['Universal Father', 'Creator Son'],
  soul: ['soul'], spirit: ['Thought Adjuster', 'Spirit of Truth'], conscience: ['Thought Adjuster'],
  'inner voice': ['Thought Adjuster'], 'holy spirit': ['Holy Spirit', 'Spirit of Truth'],
  angel: ['guardian seraphim', 'seraphim'], angels: ['guardian seraphim', 'seraphim'], 'guardian angel': ['guardian seraphim', 'destiny guardian'],
  jesus: ['Jesus'], christ: ['Michael', 'Jesus'], pray: ['prayer'], prayer: ['prayer'], praying: ['prayer'],
  worship: ['worship'], faith: ['faith'], believe: ['faith'], sin: ['sin'], evil: ['evil'], devil: ['Lucifer', 'Caligastia'],
  satan: ['Satan', 'Lucifer'], forgive: ['forgiveness'], forgiveness: ['forgiveness'], suffering: ['suffering', 'adversity'],
  pain: ['suffering'], grief: ['sorrow'], love: ['love'], marriage: ['marriage'], children: ['Adjusterless children', 'probationary nursery', 'infant-receiving schools'], kids: ['Adjusterless children', 'probationary nursery', 'infant-receiving schools'], family: ['family'],
  reincarnation: ['reincarnation'], animals: ['animals'], pets: ['animals'], adam: ['Adam and Eve'], eve: ['Adam and Eve'],
  abortion: ['Adjusterless children', 'probationary nursery', 'infant-receiving schools'], embryo: ['Adjusterless children', 'probationary nursery', 'infant-receiving schools'], conception: ['Adjusterless children', 'first moral decision'], unborn: ['Adjusterless children', 'probationary nursery', 'infant-receiving schools'],
  fetus: ['Adjusterless children', 'probationary nursery', 'infant-receiving schools'], unborn: ['Adjusterless children', 'probationary nursery', 'infant-receiving schools'], miscarriage: ['Adjusterless children', 'probationary nursery', 'infant-receiving schools'], baby: ['Adjusterless children', 'probationary nursery', 'infant-receiving schools'], babies: ['Adjusterless children', 'probationary nursery', 'infant-receiving schools'], infant: ['Adjusterless children', 'infant-receiving schools'], infants: ['Adjusterless children', 'infant-receiving schools'], child: ['Adjusterless children', 'probationary nursery', 'infant-receiving schools'], adjusterless: ['Adjusterless children', 'probationary nursery', 'infant-receiving schools'], 'thought adjuster': ['Thought Adjuster'], adjuster: ['Thought Adjuster'],
  universe: ['universe'], purpose: ['purpose of life', 'perfection'], meaning: ['meaning of life', 'values'], happiness: ['happiness', 'joy'],
  fear: ['fear'], worry: ['anxiety', 'worry'], healing: ['healing'], miracle: ['miracles'], miracles: ['miracles'],
  'how old': ['birth', 'born'],
  earth: ['Urantia'],
  brothers: ['brother'], sisters: ['sister'], 'brothers and sisters': ['family'],
  'god in me': ['Thought Adjuster', 'indwells'], 'within me': ['Thought Adjuster'], 'inside me': ['Thought Adjuster'],
  wisest: ['all-wisdom'],
  'morontia nursery': ['probation nursery'],
  filosofia: ['philosophy'], metronita: ['morontia'],
}
const QUESTION_WORDS = new Set('what whats who whom whose when where why how which does do did is are was were will would can could should shall may might the a an of to in on for from with about into and or but if then than that this these those it its be been being have has had i me my we our you your they them their he him his she her there here say says said tell define defined definition book urantia ub please'.split(' '))

// The question's own content words, and the book's terms they map to. Possessives are
// stripped ("Eve's" -> "Eve") so the words match the book's text.
export function toBookTerms(question) {
  const q = question.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z'\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  const mapped = []
  for (const [k, terms] of Object.entries(BOOK_TERMS)) {
    if (new RegExp(`\\b${k}\\b`).test(q)) mapped.push(...terms)
  }
  const words = q.split(' ').filter((w) => w.length > 2 && !QUESTION_WORDS.has(w.replace(/'s$/, ''))).map((w) => w.replace(/'s$/, ''))
  return { words, mapped: [...new Set(mapped)] }
}

// Run the tools' own search for the question's words and for each mapped book term, and rank the
// paragraphs found by how many of those searches found them, and how well.
export function answer(E, question, { max = 5 } = {}) {
  const { words, mapped } = toBookTerms(question)
  // "How old was X?" is answered by X's birth narrative: pair the subject with birth terms,
  // and favor the book's birth sections about that subject. "What is the age of X?" too.
  const ageQ = /\bhow old\b|\bage of\b/i.test(question)
  const subjects = ageQ ? [...new Set(mapped.filter((t) => /^[A-Z][a-z]+$/.test(t)))] : []
  // "How old is the Earth/Urantia?" is answered by the book's age-of-the-planet statement
  // (57:8.1: a billion years, "the actual beginning of Urantia history"), not a birth
  // narrative: birth-term machinery would only add noise here.
  const worldAgeQ = ageQ && (subjects.some((s) => /^Urantia$/i.test(s)) || /\burantia\b/i.test(question))
  // "How old was Jesus when he died?" is answered by the book's own lifespan
  // statement (189:1.2: "almost thirty-six years"), with the birth date
  // (122:8.1: August 21, 7 B.C.) and the crucifixion date (185:0.1: Friday,
  // April 7, A.D. 30) as the bookends. The generic birth machinery and the
  // death->survival mappings would only add noise here.
  const jesusDeathAgeQ = ageQ && /\bjesus\b/i.test(question) && /\b(die|died|dies|dying|death)\b|\bcrucif/i.test(question)
  // The question's most distinctive words (longer words are rarely glue like "at the time
  // of"), with book-term substitutions where the book says it differently ("earth" ->
  // "Urantia"): where they co-occur often names the passage ("morontia ... resurrection").
  // (Age questions have their own machinery below; this would only add noise there.)
  const distinctive = ageQ ? [] : words.filter((w) => w.length >= 5).map((w) => {
    const m = BOOK_TERMS[w.toLowerCase()]
    return m && m.length === 1 ? m[0] : w
  })
  // Only for questions with a genuinely rare word ("morontia", "resurrection"): on everyday
  // questions ("what did Jesus teach?") the ordinary searches already do the right thing.
  const distinctiveOn = distinctive.length >= 2 && distinctive.join(' ') !== words.join(' ') &&
    distinctive.some((w) => w.length >= 8)
  // A mapped term inside the distinctive set is covered by the distinctive query, which is
  // strictly more specific ("Urantia" alone also matches mansion-world procedure).
  const distinctiveSet = new Set(distinctive.map((w) => w.toLowerCase()))
  const queries = []
  // On the Jesus-death-age question the reader's own words are search-noise:
  // "old" is an adjective and "died" pulls resurrection narratives (194:4.6),
  // while the book's answer ("almost thirty-six years") shares only "Jesus".
  // The directed lifespan boost below plus the birth machinery carry it.
  if (words.length && !jesusDeathAgeQ) queries.push({ q: words.join(' '), weight: 1, label: words.join(' '), ownWords: true })
  // The reader's words in the book's language ("metronita" -> "morontia"): pairs the mapped
  // term with the question's other content words ("morontia song"), which the separate
  // single-term mapped query can't do. Light verbs are dropped: the search is AND-like,
  // so glue ("come find") would exclude the very paragraphs we want.
  const GLUE = new Set(('come comes came coming find finds found finding get gets got getting go goes went going make makes made making take takes took taking see sees saw seeing look looks looked looking want wants wanted needing need needs needed know knows knew knowing think thinks thought thinking give gives gave given ' +
    // Spanish stopwords: the substituted query is English book-language; Spanish glue would
    // AND-exclude the paragraphs we want.
    'que es la el de del en un una los las para con por se su sus como pero este esta eso son hay muy sobre entre donde cuando porque cual cuales mi tu te lo le les nos libro libros').split(' '))
  const substituted = words.map((w) => {
    const m = BOOK_TERMS[w.toLowerCase()]
    return m && m.length === 1 ? m[0] : w
  }).filter((w) => !GLUE.has(w.toLowerCase()))
  if (substituted.length >= 2 && substituted.join(' ') !== words.join(' ') && !jesusDeathAgeQ)
    queries.push({ q: substituted.join(' '), weight: 1, label: substituted.join(' '), ownWords: true })
  if (distinctiveOn) {
    queries.push({ q: distinctive.join(' '), weight: 1.5, label: distinctive.join(' '), ownWords: true })
  }
  // The book's own term for the eternity-infinity relationship: when the question names
  // both, it is asking about their relationship (105:0.1's "eternity-infinity" ellipse),
  // not about either one alone.
  if (words.includes('eternity') && words.includes('infinity'))
    queries.push({ q: 'eternity-infinity', weight: 2.5, label: 'eternity-infinity' })
  // Specific subjects outrank general ones: a question about a child who dies is about the
  // probationary nursery first, the mansion worlds second.
  const SPECIFIC = new Set(['Adjusterless children', 'probationary nursery', 'infant-receiving schools'])
  // A parenthetical clarification names the term the reader means ("What are Spoor Nega?
  // (means Spornagia)"): long parenthetical words get their own high-weight query so the
  // misspelled words outside the parens can't drown them out.
  const parenSpecific = []
  for (const m of question.matchAll(/\(([^)]+)\)/g))
    for (const w of m[1].toLowerCase().split(/[^a-z0-9']+/).filter(Boolean))
      if (w.length >= 7 && !QUESTION_WORDS.has(w) && !parenSpecific.includes(w)) parenSpecific.push(w)
  for (const t of parenSpecific) queries.push({ q: t, weight: 3, label: `clarified:"${t}"` })
  // Bare "birth"/"born" searches only match birth-word noise on age questions
  // (103:2.1's "birth of religion"): subjects pair with birth terms directly
  // ("Jesus born"), the planet's age has its own statement, and subject-less
  // questions answer from the subject's own passages.
  // A mapped term the reader actually typed ("universe") is covered by the distinctive
  // query; a substituted book-term ("wisest" -> "all-wisdom") is not — paired with the
  // question's other words, the distinctive query drowns the rare term out, so the
  // book-term needs its own query to reach its one or two paragraphs.
  const typedWords = new Set(words.map((w) => w.toLowerCase()))
  // On the Jesus-death-age question the reader's death words ("died") are about
  // dating the lifespan, not the afterlife: the survival/mansion-worlds
  // mappings would drown the book's own "almost thirty-six years" statement.
  const DEATH_TERMS = new Set(['survival', 'mansion worlds', 'resurrection halls'])
  for (const t of mapped) {
    if (ageQ && (t === 'birth' || t === 'born')) continue
    if (jesusDeathAgeQ && DEATH_TERMS.has(t)) continue
    if (distinctiveOn && distinctiveSet.has(t.toLowerCase()) && typedWords.has(t.toLowerCase())) continue
    queries.push({ q: t, weight: SPECIFIC.has(t) ? 3 : 1.2, label: t })
  }
  if (subjects.length && !worldAgeQ) {
    for (const s of subjects.slice(0, 2)) queries.push({ q: `${s} born`, weight: 2, label: `${s} born`, limit: 60 })
  }
  const score = new Map(), why = new Map()
  for (const { q, weight, label, ownWords, limit } of queries) {
    const lim = limit || 40
    const r = E.search.searchUB({ query: q, limit: lim })
    if (ownWords) {
      // The search scores a paragraph 50+ only when every one of the question's words is in
      // it. When that is true of just a handful of paragraphs, they are almost certainly the
      // answer ("Adam and Eve's hair color" -> 76:4.1), so they outrank the looser topic
      // expansions. Broad questions match dozens of paragraphs and are unaffected.
      const direct = r.results.filter((x) => x.score >= 50)
      if (direct.length && direct.length <= 8) {
        for (const x of direct) score.set(x.ref, (score.get(x.ref) || 0) + 2)
      }
    }
    r.results.forEach((x, i) => {
      const s = (x.score / 100 + (lim - i) / (4 * lim)) * weight
      score.set(x.ref, (score.get(x.ref) || 0) + s)
      if (!why.has(x.ref)) why.set(x.ref, new Set())
      why.get(x.ref).add(label)
    })
    if (ownWords && E.byRef && !mapped.some((t) => SPECIFIC.has(t))) {
      // Whole-word refinement: the search matches word-starts, so "exchanger" and
      // "simple-minded" can tie with the paragraph that uses the question's exact words
      // ("exchange ... the mind of Jesus"). When only a handful of the paragraphs already
      // scored contain every content word as a whole word, they are the answer.
      // (Broad questions match dozens and are unaffected. Questions the SPECIFIC
      // mappings redirect — "salvaged children" -> the probationary nursery — keep
      // their redirect: the explanation outranks the passing mention.)
      const terms = q.split(' ').filter((t) => t.length >= 4)
      if (terms.length >= 2) {
        const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const res = terms.map((t) => new RegExp(`\\b${esc(t)}\\b`, 'i'))
        const hits = []
        for (const ref of score.keys()) {
          const p = E.byRef.get(ref)
          if (p && res.every((re) => re.test(p.text))) hits.push(ref)
        }
        if (hits.length && hits.length <= 8) {
          for (const ref of hits) {
            score.set(ref, (score.get(ref) || 0) + 2.5)
            why.get(ref).add('exact words')
          }
        }
      }
    }
  }
  if (subjects.length && !worldAgeQ && E.byRef) {
    // The book's birth narratives live in birth-titled sections: they answer "how old" even
    // when the subject is named there less often than in later discourses.
    const subRe = new RegExp(`\\b(${subjects.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i')
    for (const [ref, p] of E.byRef) {
      if (p.sectionTitle && p.sectionTitle.toLowerCase().includes('birth') && subRe.test(p.text)) {
        score.set(ref, (score.get(ref) || 0) + 3)
        if (!why.has(ref)) why.set(ref, new Set())
        why.get(ref).add(`${subjects.join('/')} birth`)
      }
    }
  }
  if (worldAgeQ && E.byRef) {
    // The book dates the planet itself: 57:8.1 states a billion years as "the actual
    // beginning of Urantia history". Dated Urantia passages about later events (Adam's
    // arrival, Melchizedek) are supporting context, not the answer.
    for (const [ref, p] of E.byRef) {
      if (/beginning of Urantia history/i.test(p.text)) {
        score.set(ref, (score.get(ref) || 0) + 5)
        if (!why.has(ref)) why.set(ref, new Set())
        why.get(ref).add('age of Urantia')
      } else if (/\bUrantia\b/i.test(p.text) && /\d[\d,]*\*?\s*years ago/i.test(p.text)) {
        score.set(ref, (score.get(ref) || 0) + 2)
        if (!why.has(ref)) why.set(ref, new Set())
        why.get(ref).add('dated Urantia passage')
      }
    }
  }
  if (jesusDeathAgeQ && E.byRef) {
    // The book states the lifespan outright: "almost thirty-six years".
    for (const [ref, p] of E.byRef) {
      if (/almost thirty-six years/i.test(p.text)) {
        score.set(ref, (score.get(ref) || 0) + 5)
        if (!why.has(ref)) why.set(ref, new Set())
        why.get(ref).add('stated lifespan')
      }
    }
  }
  const all = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([ref]) => ref)
  // Where the book is silent: a word of the question that the book uses rarely or never.
  const quiet = []
  for (const w of words) {
    const r = E.search.searchUB({ query: w, limit: 3 })
    if (r.total <= 3) quiet.push({ word: w, total: r.total, refs: r.results.map((x) => x.ref) })
  }
  return { refs: all.slice(0, max), more: all.slice(max, max + 10), why, words, mapped, quiet }
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
    const done = () => { this.speaking = false; this.onchange?.(false); onEnd?.() }
    u.onend = done
    u.onerror = done
    this.speaking = true
    this.onchange?.(true)
    speechSynthesis.speak(u)
  },
  stop() { if (this.ok) speechSynthesis.cancel(); if (this.speaking) { this.speaking = false; this.onchange?.(false) } },
  speaking: false,
  onchange: null,
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
