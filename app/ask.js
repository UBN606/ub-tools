// Ask: a plain question answered in the book's own words. No AI writes anything, so nothing can
// be misquoted and nothing costs money. Everyday words are mapped to the book's own terms
// ("heaven" -> mansion worlds, "conscience" -> Thought Adjuster), the tools' own search finds the
// paragraphs, and the best few are shown whole, with citations, ready to be read aloud.
import { edgeAudio, edgeVoiceId } from './edge-voices.js'

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
  reincarnation: ['reincarnation'], reincarnate: ['reincarnation'], reincarnated: ['reincarnation'], animals: ['animals'], pets: ['animals'], adam: ['Adam and Eve'], eve: ['Adam and Eve'],
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
  // Reader-email misses (2026-10): the book never uses "narcissism", so these are its nearest
  // words; the answer's "says little about this directly" note still says so.
  narcissism: ['self-seeking', 'self-centered', 'selfishness'], narcissist: ['self-seeking', 'self-centered', 'selfishness'],
  narcissistic: ['self-seeking', 'self-centered', 'selfishness'], selfish: ['selfishness'], ego: ['self-seeking', 'egotism'],
  // "How do I become more spiritual?": Paper 100 (religious growth, spiritual development).
  'more spiritual': ['religious growth', 'spiritual development'], 'spiritual growth': ['religious growth', 'spiritual development'],
  'grow spiritually': ['religious growth', 'spiritual development'], spirituality: ['spirituality', 'spiritual development'],
  // Missed-question log (2026-10). The book never says "technology": it speaks of
  // invention and machines (81:6, 99:1).
  technology: ['invention', 'machine'], technologies: ['invention', 'machine'], technological: ['invention', 'machine'],
  // The book names them both ways: "the midwayers" and "the midway creatures" (77:8.1).
  midwayer: ['midwayers', 'midway creatures'], midwayers: ['midwayers', 'midway creatures'],
  'on the cross': ['crucifixion'], crucified: ['crucifixion'], crucifixion: ['crucifixion'],
  // "The beginning of time" is the book's "eternity of the past" and "dawn of time".
  'beginning of time': ['eternity of the past', 'dawn of time'], 'start of time': ['eternity of the past', 'dawn of time'],
  'before time': ['eternity of the past', 'dawn of time'],
}
const QUESTION_WORDS = new Set('what whats who whom whose when where why how which does do did is are was were will would can could should shall may might the a an of to in on for from with about into and or but if then than that this these those it its be been being have has had i me my we our you your they them their he him his she her there here say says said tell define defined definition book urantia ub please described describe describes mentioned explained discussed'.split(' '))

// Specific subjects outrank general ones: a question about a child who dies is about the
// probationary nursery first, the mansion worlds second.
const SPECIFIC = new Set(['Adjusterless children', 'probationary nursery', 'infant-receiving schools', 'religious growth', 'spiritual development', 'eternity of the past', 'dawn of time'])

// How a question asks for a number: "how many days", "how long". The frame and its unit
// say what kind of answer is wanted (a number, a time), not what to search for.
const QUANTITY = /\bhow (many|much|long|often)\b|\bnumber of\b/
const QUANTITY_FRAME = /\bhow (?:many|much|long|often)(?: (?:days|hours|years|minutes|weeks|months|times))?\b|\bnumber of\b/g
const TIME_UNIT = /\bhow (?:many (?:days|hours|years|minutes|weeks|months)|long)\b/
// "What does it mean to be spiritual?" asks about "spiritual", not about "mean".
const MEAN_FRAME = /\bwhat (?:does|do|did) it mean(?: to be| to| that)?\b|\bwhat is meant by\b/g
// "Will" is glue in "will I see God?" but the subject in "our will" and "God's will".
const NOUN_WILL = /\b(?:our|my|your|his|her|their|own|free|human|divine|thy|[a-z]+'s) will\b/

// The question's own content words, and the book's terms they map to. Possessives are
// stripped ("Eve's" -> "Eve") so the words match the book's text.
export function toBookTerms(question) {
  const q = question.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z'\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  const mapped = []
  for (const [k, terms] of Object.entries(BOOK_TERMS)) {
    if (new RegExp(`\\b${k}\\b`).test(q)) mapped.push(...terms)
  }
  const framed = q.replace(QUANTITY_FRAME, ' ').replace(MEAN_FRAME, ' ')
  const words = framed.split(' ').filter((w) => w.length > 2 && !QUESTION_WORDS.has(w.replace(/'s$/, ''))).map((w) => w.replace(/'s$/, ''))
  if (NOUN_WILL.test(q) && !words.includes('will')) words.push('will')
  return { words, mapped: [...new Set(mapped)] }
}

// ---------- the book's own phrasing ----------
// Names the book itself capitalizes ("Supreme Being", "God the Supreme", "Thought Adjuster"),
// counted once per book. A reader who types "define the supreme being" means the name, not
// the words "supreme" and "being" (the second is glue everywhere else).
const NAME_RUN = /\b[A-Z][a-z]+(?:(?:\s+of)?(?:\s+the)?\s+[A-Z][a-z]+)+/g
const NOT_NAME = new Set('the a an in and but this these that those when if as at on for of to it he she they we you all such while thus so then there here his her their its our your my no not now nor or yet what who which how why where both each every many most some even only also let behold before after during upon though although because since'.split(' '))
const namesCache = new WeakMap()
function bookNames(E) {
  if (namesCache.has(E)) return namesCache.get(E)
  const count = new Map()
  for (const p of E.byRef.values()) {
    for (const m of p.text.matchAll(NAME_RUN)) {
      const toks = m[0].split(/\s+/)
      // Every run of 2-4 words inside the match that starts and ends on a capitalized
      // word: "Father God the Supreme" counts "God the Supreme" too.
      for (let i = 0; i < toks.length; i++) {
        if (!/^[A-Z]/.test(toks[i]) || NOT_NAME.has(toks[i].toLowerCase())) continue
        for (let j = i + 1; j < Math.min(toks.length, i + 4); j++) {
          if (!/^[A-Z]/.test(toks[j])) continue
          const k = toks.slice(i, j + 1).join(' ').toLowerCase()
          count.set(k, (count.get(k) || 0) + 1)
        }
      }
    }
  }
  const names = new Set([...count].filter(([, c]) => c >= 5).map(([k]) => k))
  namesCache.set(E, names)
  return names
}

// The book's names in the question, longest first, without overlaps.
function namesIn(E, q) {
  const names = bookNames(E)
  const toks = q.split(' ')
  const used = new Array(toks.length).fill(false)
  const found = []
  for (let n = 4; n >= 2; n--) {
    for (let i = 0; i + n <= toks.length; i++) {
      if (used.slice(i, i + n).some(Boolean)) continue
      const k = toks.slice(i, i + n).join(' ')
      if (!names.has(k)) continue
      found.push(k)
      for (let j = i; j < i + n; j++) used[j] = true
    }
  }
  return found
}

// Every word of the book's paper and section titles, once per book.
const titlesCache = new WeakMap()
function titleWords(E) {
  if (titlesCache.has(E)) return titlesCache.get(E)
  const set = new Set()
  for (const p of E.byRef.values())
    for (const t of [p.paperTitle, p.sectionTitle]) for (const w of String(t || '').toLowerCase().match(/[a-z]+/g) || []) set.add(w)
  titlesCache.set(E, set)
  return set
}

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const NUMBER = /\d|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|half|dozen)\b/i
const TIME = /\b(?:o['’]clock|hours?|days?|years?|minutes?|weeks?|months?|morning|afternoon|evening|noon|midnight)\b/i
// "Define X", "What is X?", "What does it mean to be X?": the subject X.
const DEFINE = /^(?:please )?(?:define|definition of|what is meant by|what (?:does|do) it mean to be|what(?:'s| is| are| was| were)|explain)\s+(?:the |a |an )?(.+)$/
const DEFINE_TAIL = /\s+(?:for me|to me|for us|please|in (?:the )?(?:urantia )?book|according to .*|as (?:described|explained|mentioned|defined|presented) in .*|in paper \d+.*)$/

// Run the tools' own search for the question's words and for each mapped book term, and rank the
// paragraphs found by how many of those searches found them, and how well.
export function answer(E, question, { max = 5 } = {}) {
  let { words, mapped } = toBookTerms(question)
  const typed = words
  const qn = question.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9'\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  const dfCache = new Map()
  const df = (w) => {
    if (!dfCache.has(w)) dfCache.set(w, E.search.searchUB({ query: w, limit: 3 }))
    return dfCache.get(w)
  }
  // "God the Supreme as described in Paper 117": the reader names the paper, so its
  // paragraphs are searched on their own as well, and "paper" is not a search word.
  const pm = qn.match(/\bpaper (\d{1,3})\b/)
  const paperScope = pm && Number(pm[1]) <= 196 ? Number(pm[1]) : null
  if (paperScope !== null) words = words.filter((w) => w !== 'paper')
  // The book's names in the question ("supreme being", "god the supreme") are searched as
  // phrases, and a word inside a name keeps its own meaning: "god" in "God the Supreme"
  // is not mapped to the Universal Father.
  const names = E.byRef ? namesIn(E, qn.replace(/'s\b/g, '')) : []
  if (names.length) {
    let rest = qn
    for (const n of names) rest = rest.replace(new RegExp(`\\b${esc(n)}\\b`, 'g'), ' ')
    const outside = toBookTerms(rest).mapped
    mapped = mapped.filter((t) => outside.includes(t) || names.includes(t.toLowerCase()))
  }
  // A hyphenated word the book never uses ("non-adamic") is searched by its parts
  // ("adamic"). The never-used note still names the word as the reader typed it.
  const PREFIX = new Set(['non', 'anti', 'pre', 'post', 'semi', 'pro'])
  words = words.flatMap((w) => (w.includes('-') && !df(w).total ? w.split('-').filter((x) => x.length > 2 && !PREFIX.has(x)) : [w]))
  // A reader's idiom the book never uses ("the beginning of time") is searched as the book's
  // own terms for it ("the eternity of the past"), not word by word.
  for (const [k, terms] of Object.entries(BOOK_TERMS)) {
    if (!k.includes(' ') || !terms.every((t) => SPECIFIC.has(t)) || !new RegExp(`\\b${esc(k)}\\b`).test(qn)) continue
    if ((E.search.searchUB({ query: k, limit: 1 }).results[0]?.score || 0) >= 100) continue
    const idiom = new Set(k.split(' '))
    words = words.filter((w) => !idiom.has(w))
  }
  // A word far rarer than the question's others names its subject ("midwayers" beside
  // "created" and "left"): paragraphs without it are about something else. Only a word
  // the book's own headings use counts ("The United Midwayers"): a rare verb ("happens",
  // "salvaged") is not a subject.
  const headed = E.byRef ? titleWords(E) : null
  const byDf = words.filter((w) => w !== 'will').map((w) => ({ w, n: df(w).total })).filter((x) => x.n > 0).sort((a, b) => a.n - b.n)
  const anchor = headed && byDf.length >= 2 && byDf[0].n <= 300 && byDf[1].n >= 2 * byDf[0].n &&
    [...headed].some((t) => t.startsWith(byDf[0].w)) ? byDf[0].w : null
  const anchorForms = anchor ? [anchor, ...(BOOK_TERMS[anchor] || []).filter((t) => t.toLowerCase() !== anchor)] : []
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
  // A parenthetical clarification names the term the reader means ("What are Spoor Nega?
  // (means Spornagia)"): long parenthetical words get their own high-weight query so the
  // misspelled words outside the parens can't drown them out.
  const parenSpecific = []
  for (const m of question.matchAll(/\(([^)]+)\)/g))
    for (const w of m[1].toLowerCase().split(/[^a-z0-9']+/).filter(Boolean))
      if (w.length >= 7 && !QUESTION_WORDS.has(w) && !parenSpecific.includes(w)) parenSpecific.push(w)
  for (const t of parenSpecific) queries.push({ q: t, weight: 3, label: `clarified:"${t}"` })
  // Only the paragraphs that use a name as written count for it ("Supreme Being", not
  // every paragraph with "supreme" in it).
  for (const n of names) queries.push({ q: n, weight: 2.5, label: n, phrase: true })
  if (paperScope !== null) {
    if (words.length) queries.push({ q: words.join(' '), weight: 1.5, label: `Paper ${paperScope}`, paper: paperScope })
    for (const n of names) queries.push({ q: n, weight: 2.5, label: `${n}, Paper ${paperScope}`, phrase: true, paper: paperScope })
  }
  if (anchor && words.length >= 2) {
    for (const form of anchorForms) {
      const q = words.map((w) => (w === anchor ? form : w)).join(' ')
      queries.push({ q, weight: 1.5, label: form, limit: 400, keep: 40, must: new RegExp(`\\b${esc(form)}`, 'i') })
    }
  }
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
  for (const { q, weight, label, ownWords, limit, phrase, paper, must, keep } of queries) {
    const lim = keep || limit || 40
    const r = E.search.searchUB({ query: q, limit: limit || 40, paper })
    if (phrase) r.results = r.results.filter((x) => x.score >= 100)
    if (must) r.results = r.results.filter((x) => must.test(x.text)).slice(0, lim)
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
    // A paragraph whose first sentence carries a name or the book's phrase is about it
    // ("In the eternity of the past, ..."); a passing mention later on usually is not.
    const opens = (phrase || (SPECIFIC.has(q) && q.includes(' '))) && new RegExp(`^[^.!?]*\\b${esc(q)}\\b`, 'i')
    r.results.forEach((x, i) => {
      const s = (x.score / 100 + (lim - i) / (4 * lim) + (opens && opens.test(x.text) ? 0.5 : 0)) * weight
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
  if (words.length >= 2 && !ageQ && E.byRef) {
    // The paragraphs of the section or paper that is about the question's subject outrank a
    // passing mention elsewhere: "Do I have a guardian angel?" is answered in 113:1 "The
    // Guardian Angels", not by 25:8.10, which names "the guardian angel of the mortal career"
    // once while telling of a pilgrim who fails in Havona. Only paragraphs already found get
    // the boost, and every content word must be in the heading (plurals allowed), so broad
    // and one-word questions are unaffected.
    const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const res = words.map((w) => new RegExp(`\\b${esc(w)}(?:s|es)?\\b`, 'i'))
    for (const ref of score.keys()) {
      const p = E.byRef.get(ref)
      const heading = p && `${p.sectionTitle || ''} | ${p.paperTitle || ''}`
      if (heading && res.every((re) => re.test(heading))) {
        score.set(ref, score.get(ref) + 1.5)
        why.get(ref).add('section about it')
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
  if (E.byRef) bookPhrasing(E, { qn, words, names, anchorForms, ageQ, score, why, df })
  const all = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([ref]) => ref)
  // Where the book is silent: a word of the question that the book uses rarely or never.
  const quiet = []
  for (const w of typed) {
    const r = df(w)
    if (r.total <= 3) quiet.push({ word: w, total: r.total, refs: r.results.map((x) => x.ref) })
  }
  return { refs: all.slice(0, max), more: all.slice(max, max + 10), why, words: typed, mapped, quiet }
}

// The ways a question is phrased that the book phrases differently, or that say what kind
// of passage answers it. Each finds the paragraphs that match across the whole book and
// adds to their score; a pattern that matches too much of the book says nothing and is
// applied only to paragraphs the searches already found.
function bookPhrasing(E, { qn, words, names, anchorForms, ageQ, score, why, df }) {
  const add = (ref, s, label) => {
    score.set(ref, (score.get(ref) || 0) + s)
    if (!why.has(ref)) why.set(ref, new Set())
    why.get(ref).add(label)
  }
  const boost = (test, s, label, cap) => {
    const hits = []
    for (const [ref, p] of E.byRef) if (test(p)) hits.push(ref)
    for (const ref of hits) if (hits.length <= cap || score.has(ref)) add(ref, s, label)
  }
  const toks = qn.replace(/[?.!,]+/g, ' ').split(' ').filter(Boolean)
  const inName = (w) => names.some((n) => n.split(' ').includes(w))
  // The book's word order: "God's will" is "the will of God" and "the Father's will",
  // "our will" is "the human will", "the ascension plan" is "the plan of ... ascension".
  const owner = (w) => {
    const m = BOOK_TERMS[w]
    return m && m.length === 1 && m[0].includes(' ') ? [w, m[0].split(' ').pop().toLowerCase()] : [w]
  }
  for (let i = 0; i + 1 < toks.length; i++) {
    const a = toks[i], b = toks[i + 1].replace(/'s$/, '')
    if (b.length < 4 || (QUESTION_WORDS.has(b) && b !== 'will')) continue
    let re = null, label = ''
    if (/'s$/.test(a) && a.length > 4) {
      const o = owner(a.slice(0, -2)).map(esc).join('|')
      re = new RegExp(`\\b(?:(?:${o})['’]s ${esc(b)}|${esc(b)} of (?:the )?(?:${o}))\\b`, 'i')
      label = `${b} of ${a.slice(0, -2)}`
    } else if (a === 'our' || a === 'my') {
      re = new RegExp(`\\b(?:human|your|man['’]s|mortal|creature|personal) ${esc(b)}\\b`, 'i')
      label = `human ${b}`
    } else if (a.length >= 4 && !QUESTION_WORDS.has(a) && !inName(a) && !inName(b)) {
      re = new RegExp(`\\b${esc(b)}s? of (?:[a-z-]+ ){0,2}?${esc(a)}\\b`, 'i')
      label = `${b} of ${a}`
    }
    if (re) boost((p) => re.test(p.text), 1.5, label, 300)
  }
  // "Define X", "What is X?", "What does it mean to be X?": the book's own "X is ..."
  // sentences answer it. An adjective is also tried as the book's noun ("spiritual" ->
  // "Spirituality becomes ...").
  const dm = qn.replace(/[?.!]+$/, '').match(DEFINE)
  const subject = dm ? dm[1].replace(/'s\b/g, '').replace(DEFINE_TAIL, '').trim() : ''
  if (subject && subject.split(' ').length <= 4 && !QUESTION_WORDS.has(subject)) {
    const forms = [subject]
    if (!subject.includes(' ')) for (const suffix of ['ity', 'ness']) if (E.search.searchUB({ query: subject + suffix, limit: 1 }).total) forms.push(subject + suffix)
    const defRe = new RegExp(`(?:^|[.!?:;—]\\s*)[“"‘*]*(?:the |a |an )?(?:${forms.map(esc).join('|')})\\*?,? (?:is|are|becomes|means|indicates|represents|consists)\\b`, 'i')
    boost((p) => defRe.test(p.text), 2, `what ${forms[forms.length - 1]} is`, 40)
    // A section titled with the name ("VII. The Supreme Being") is the book's own entry on it.
    const title = (t) => String(t || '').toLowerCase().replace(/^[\divx]+\.\s*/, '').replace(/^the /, '').trim()
    boost((p) => title(p.sectionTitle) === subject || title(p.paperTitle) === subject, 1, `the book's section on ${subject}`, 300)
  }
  // "How many ...?", "How long ...?": the answer states a number (or a time) about the
  // subject: "numbering 10,992" (77:8.1), "half past nine o'clock" (187:3.1).
  if (QUANTITY.test(qn) && !ageQ && words.length) {
    const all = words.map((w) => new RegExp(`\\b${esc(w)}`, 'i'))
    if (TIME_UNIT.test(qn)) {
      // A time is told across a narrative ("half past nine o'clock ... hung upon the cross").
      boost((p) => NUMBER.test(p.text) && TIME.test(p.text) && all.every((re) => re.test(p.text)), 2.5, 'the time', 80)
    } else {
      // A count stands beside what it counts: "eight brothers and sisters", "the original
      // 50,000 [midwayers], 40,119 had joined", "midway creatures ... numbering 10,992".
      // What is counted is what follows "how many": "how many brothers and sisters did ...".
      const cm = qn.match(/\bhow many ([a-z' -]+?)(?= (?:did|do|does|is|are|was|were|has|have|had|will|can|could|would|in|on|of|at|for)\b|[?.!]|$)/)
      const counted = cm ? cm[1].split(' ').filter((w) => w.length > 2 && !QUESTION_WORDS.has(w)) : []
      const forms = (counted.length ? counted : words).flatMap((w) => [w, ...(BOOK_TERMS[w] || [])]).map((w) => w.toLowerCase().split(' ')[0])
      const near = (p) => {
        const t = p.text.toLowerCase().split(/[^a-z0-9,'-]+/)
        const at = [], nums = []
        t.forEach((x, i) => {
          if (forms.some((w) => x.startsWith(w))) at.push(i)
          if (NUMBER.test(x) && x !== 'one') nums.push(i)
        })
        return at.some((i) => nums.some((j) => Math.abs(i - j) <= 4))
      }
      const label = `the number of ${counted.length ? counted.join(' ') : words[0]}`
      boost(near, 2, label, 80)
      // The count right before the reader's own words is the plainest answer ("eight
      // brothers and sisters").
      if (cm && counted.length) {
        const exact = new RegExp(`(?:\\d[\\d,]*|\\b[a-z]+(?:-[a-z]+)?)\\s+(?:${esc(cm[1])})\\b`, 'gi')
        boost((p) => [...p.text.matchAll(exact)].some((m) => NUMBER.test(m[0].split(/\s+/)[0])), 2, label, 80)
      }
      boost((p) => near(p) && all.every((re) => re.test(p.text)), 1, label, 80)
    }
  }
  // Three or more words close together are the passage's subject ("love—truth, beauty,
  // and goodness"), not words that happen to share a long paragraph. Words found all
  // through the book ("life", "other") are close to everything, so at most one may be.
  const close = words.filter((w) => w.length > 2 && w !== 'will')
  if (close.length >= 3 && close.filter((w) => df(w).total > 1000).length <= 1) {
    const res = close.map((w) => new RegExp(`^${esc(w)}`, 'i'))
    boost((p) => {
      const t = p.text.toLowerCase().split(/[^a-z'-]+/)
      const last = res.map(() => -1)
      for (let i = 0; i < t.length; i++) {
        res.forEach((re, k) => { if (re.test(t[i])) last[k] = i })
        if (last.every((x) => x >= 0) && i - Math.min(...last) < 12) return true
      }
      return false
    }, 1.5, `${close.join(', ')} together`, 60)
  }
}

// Voice-garble guard: did the question likely come through garbled (dictation
// noise, a fragment) rather than as a clear question the book couldn't answer?
// Pure logic, so it can be tested. The renderer shows "try asking another way"
// for garble instead of the generic "not found" miss message.
export function looksGarbled(question, r) {
  if ((r.refs || []).length > 0) return false  // found passages, so it understood enough
  const words = String(question || '').trim().split(/\s+/).filter(Boolean)
  if (words.length <= 2) return true  // "Rugged", "bigfoot", "one another?"
  if ((r.mapped || []).length === 0 && words.length <= 5) return true  // short, nothing recognized
  return false
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
// 0.1s of silence (8kHz 8-bit mono WAV) used to unlock audio inside the tap
// gesture on iOS. See speech.say below.
const SILENT_WAV = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=='
export const speech = {
  ok: typeof speechSynthesis !== 'undefined',
  _edge: null, // the playing Edge-voice <audio>, if any
  say(text, onEnd) {
    this.stop()
    const eid = edgeVoiceId(chosen)
    if (eid) {
      // Microsoft Edge neural voice via the website's TTS endpoint. Any failure
      // (rate limit, offline, CORS) falls back to the device voice for this utterance.
      this.speaking = true
      this.onchange?.(true)
      const done = () => { this.speaking = false; this.onchange?.(false); onEnd?.() }
      // iOS Safari only honors play() inside the tap gesture. Unlock audio with
      // silence NOW; the fetched voice attaches when it arrives. Without this,
      // play() after the async fetch is rejected on iPhone and every utterance
      // silently falls back to the device voice.
      const audio = new Audio()
      audio.preload = 'auto'
      audio.src = SILENT_WAV
      try { const u = audio.play(); if (u && u.catch) u.catch(() => {}) } catch {}
      this._edge = audio
      let live = false
      audio.onended = () => { if (!live) return; this._edge = null; done() }
      audio.onerror = () => { if (!live) return; this._edge = null; this.sayLocal(text, onEnd) }
      edgeAudio(spoken(text), eid).then(
        (fetched) => {
          live = true
          audio.src = fetched.src
          audio.play().catch(() => { this._edge = null; this.sayLocal(text, onEnd) })
        },
        () => { this._edge = null; this.sayLocal(text, onEnd) },
      )
      return
    }
    this.sayLocal(text, onEnd)
  },
  sayLocal(text, onEnd) {
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
  pause() {
    if (this._edge) this._edge.pause()
    else if (this.ok) speechSynthesis.pause()
  },
  resume() {
    if (this._edge) this._edge.play().catch(() => {})
    else if (this.ok) speechSynthesis.resume()
  },
  stopTTS() {
    if (this.ok) speechSynthesis.cancel()
    if (this._edge) {
      this._edge.pause()
      this._edge = null
    }
    if (this.speaking) { this.speaking = false; this.onchange?.(false) }
  },
  stop() {
    this.stopTTS()
    // The read-along's human narration is a separate <audio> element — one
    // voice at a time, so stopping TTS also stops the narration.
    document.getElementById('ra-audio')?.pause()
  },
  speaking: false,
  onchange: null,
}

// ---------- listening (the browser's speech recognition, where the browser has it) ----------
export function listener(onText, onState) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition
  // The Mac app's engine (Electron) has the API but no speech service behind it, so the
  // button would do nothing there; Mac readers can use the system's own Dictation instead.
  if (!R || window.ubDesktop) return null
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
