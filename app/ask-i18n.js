// ask-i18n.js — Ask in Spanish, French, and Korean.
// The same machinery as app/ask.js, generalized: everyday words are mapped to each
// translation's own book terms (verified against the official texts), the question's
// language folds and searches its own paragraphs, and the best few are shown whole.
// Only short term-list mappings live here; the app fetches the official translation
// text at runtime from urantia.org. Nothing is ever quoted from memory.

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ---------- folding ----------
const foldAccent = (s) => s.toLowerCase()
  .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
  .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n').replace(/ç/g, 'c')
  .replace(/œ/g, 'oe')
// Korean: strip the particles endings leave on words (하나님은 -> 하나님), so the
// question's words meet the book's words. Only when the stem stays meaningful.
const KO_ENDINGS = ['에서는', '에게는', '에서', '에게', '한테', '부터', '까지', '으로', '로', '와', '과',
  '해야', '하며', '하고', '하면', '하니', '하다', '한다', '합니다', '입니다', '입니까', '인가요', '인가',
  '들', '이었', '였', '나요', '까요', '세요', '십시오', '습니까', '니까', '이란', '란',
  '은', '는', '이', '가', '을', '를', '의', '에', '만', '아', '야', '고']
const stripKo = (w) => {
  let prev = ''
  while (w.length > 2 && w !== prev) {
    prev = w
    for (const p of KO_ENDINGS) {
      if (w.endsWith(p) && w.length - p.length >= 2) { w = w.slice(0, -p.length); break }
    }
  }
  return w
}
const foldKoWord = (w) => stripKo(w.toLowerCase())

// ---------- per-language config ----------
export const LANGS = {
  es: {
    label: 'Español', name: 'Spanish',
    fold: foldAccent, foldWord: (w) => w,
    STOP: new Set(('de la el en y a los del se las por un para con no una su al lo como mas pero sus le ya o este si porque esta entre cuando muy sin sobre tambien me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos esto mi antes e que fue eran son era sido ser tienen tiene tenia fueron era').split(' ')),
    QUESTION_WORDS: new Set(('que quien quienes cual cuales cuando donde como porque cuanto cuantos es son era eran fue fueron sera seran hay tiene tienen tengo el la los las del en un una unos unas para con por se su sus como pero este esta estos estas eso esa muy sobre entre donde cuando cual cuales mi tu te lo le les nos y e o u ni si no al de a ante bajo cabe contra desde durante hacia hasta mediante segun sin tras via libro libros urantia favor dime digame explica explique significa quiere decir definicion debo tener puedo poder debe deben puede pueden debes quiere quieren').split(' ')),
    BOOK_TERMS: {
      morir: ['supervivencia', 'mundos de estancia'], muerte: ['supervivencia', 'mundos de estancia'],
      muerto: ['supervivencia', 'mundos de estancia'], muere: ['supervivencia', 'mundos de estancia'],
      mueren: ['supervivencia', 'mundos de estancia'], morimos: ['supervivencia', 'mundos de estancia'],
      murio: ['supervivencia', 'mundos de estancia'], murieron: ['supervivencia', 'mundos de estancia'],
      angel: ['serafin', 'serafines'], angeles: ['serafin', 'serafines'],
      cielo: ['mundos de estancia', 'Paraiso'], infierno: ['infierno'],
      dios: ['Padre Universal'], padre: ['Padre Universal'], creador: ['Padre Universal', 'Hijo Creador'],
      alma: ['alma'], espiritu: ['Ajustador del Pensamiento', 'Espiritu de la Verdad'],
      conciencia: ['Ajustador del Pensamiento'],
      jesus: ['Jesus'], cristo: ['Miguel', 'Jesus'],
      orar: ['oracion'], oracion: ['oracion'], rezar: ['oracion'], rezo: ['oracion'],
      adoracion: ['adoracion'], fe: ['fe'], creer: ['fe'], pecado: ['pecado'], mal: ['mal'],
      diablo: ['Lucifer', 'Caligastia'], satanas: ['Satanas', 'Lucifer'],
      perdon: ['perdon'], perdonar: ['perdon'], sufrimiento: ['sufrimiento'], dolor: ['sufrimiento'],
      amor: ['amor'], matrimonio: ['matrimonio'], proposito: ['proposito'],
      felicidad: ['felicidad'], miedo: ['miedo'], curacion: ['curacion'], milagro: ['milagros'],
      tierra: ['Urantia'], filosofia: ['filosofia'], universo: ['universo'], vida: ['vida'],
      'cuantos anos': ['nacimiento', 'nacido'], 'que edad': ['nacimiento', 'nacido'],
    },
    GLUE: new Set(('viene vienen venir encontrar encuentra encontrando obtener conseguir ir va van hacer hace haciendo tomar toma ver mira mirar querer quiere saber sabe pensar piensa dar dio dicho ' +
      'que es la el de del en un una los las para con por se su sus como pero este esta eso son hay muy sobre entre donde cuando porque cual cuales mi tu te lo le les nos').split(' ')),
    ageRe: /cu[aá]ntos a[ñn]os|qu[ée] edad/i,
    birthTerms: ['nacimiento', 'nacido'], birthTitleRe: /nacimiento/i,
    subjectRe: /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/,
    minLen: 3, distinctiveLen: 5, rareLen: 8, parenMinLen: 7,
    bStart: '\\b', bCont: '\\w*', bEnd: '\\b', flags: 'gi', splitRe: /[^a-z0-9']+/,
  },
  fr: {
    label: 'Français', name: 'French',
    fold: foldAccent, foldWord: (w) => w,
    STOP: new Set(('de la le les des du un une en et est sont dans pour avec par sur au aux ce cette ces son sa ses mon ma mes ton ta tes notre votre leur leurs qui que quoi dont ou quand comment pourquoi ne pas plus tres aussi tout tous toute toutes comme mais ou donc or ni car il elle ils elles on nous vous je tu y se me te lui eux celui celle ceux celles ceci cela ca a ont etait etaient sera seront fait font dit ete avoir etre faire dire livre livres urantia').split(' ')),
    QUESTION_WORDS: new Set(('que qui quoi quand ou comment pourquoi combien quel quelle quels quelles lequel laquelle lesquels lesquelles est sont etait etaient fut furent sera seront a ont fait le la les de du des en un une au aux pour avec par sur dans comme mais ou et ce cette ces mon ma mes ton ta tes son sa ses notre votre leur leurs ne pas y se il elle ils elles nous vous on je tu me te lui tres plus tout tous toute toutes aussi donc livre livres urantia explique expliquez signifie definition plait qu\'est faut').split(' ')),
    BOOK_TERMS: {
      mourir: ['survie', 'mondes des maisons'], mort: ['survie', 'mondes des maisons'],
      meurt: ['survie', 'mondes des maisons'], decede: ['survie', 'mondes des maisons'],
      deces: ['survie', 'mondes des maisons'], 'vie apres la mort': ['mondes des maisons', 'survie'],
      ange: ['séraphin', 'séraphins'], anges: ['séraphin', 'séraphins'],
      'ange gardien': ['gardiens de la destinée', 'séraphin'],
      ciel: ['mondes des maisons', 'Paradis'], enfer: ['enfer'],
      dieu: ['Père Universel'], pere: ['Père Universel'], createur: ['Père Universel', 'Fils Créateur'],
      ame: ['âme'], esprit: ['Ajusteur de Pensée', 'Esprit de Vérité'],
      conscience: ['Ajusteur de Pensée'], 'voix interieure': ['Ajusteur de Pensée'],
      'saint esprit': ['Saint-Esprit', 'Esprit de Vérité'],
      jesus: ['Jésus'], christ: ['Micaël', 'Jésus'],
      prier: ['prière'], priere: ['prière'],
      culte: ['culte'], adoration: ['adoration'], foi: ['foi'], croire: ['foi'],
      peche: ['péché'], mal: ['mal'], diable: ['Lucifer', 'Caligastia'], satan: ['Satan', 'Lucifer'],
      pardon: ['pardon'], pardonner: ['pardon'],
      souffrance: ['souffrance', 'adversité'], douleur: ['souffrance'], chagrin: ['chagrin'],
      amour: ['amour'], mariage: ['mariage'], famille: ['famille'],
      enfants: ['enfants'], bebe: ['enfants'], bebes: ['enfants'],
      reincarnation: ['réincarnation'], animaux: ['animaux'],
      adam: ['Adam et Ève'], eve: ['Adam et Ève'],
      univers: ['univers'], but: ['but de la vie', 'perfection'], sens: ['sens'],
      bonheur: ['bonheur', 'joie'], peur: ['peur'],
      inquietude: ['inquiétude', 'anxiété'], guerison: ['guérison'],
      miracle: ['miracles'], miracles: ['miracles'],
      'quel age': ['naissance'],
      terre: ['Urantia'], philosophie: ['philosophie'], vie: ['vie'],
    },
    GLUE: new Set(('venir vient viennent trouver trouve trouvent chercher cherche cherchent obtenir obtient aller va vont faire fait font prendre prend prennent voir voit voient regarder regarde vouloir veut veulent savoir sait savent penser pense donnent donne donnent dire dit disent parler parle ' +
      'que qui quoi quand ou comment pourquoi est sont etait etaient le la les de du des en un une au aux pour avec par sur dans comme mais ou et ce cette ces son sa ses notre votre leur leurs ne pas y se il elle ils elles').split(' ')),
    ageRe: /quel [âa]ge/i,
    birthTerms: ['naissance'], birthTitleRe: /naissance/i,
    subjectRe: /^[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ][a-zàâäéèêëîïôöùûüç]+$/,
    minLen: 3, distinctiveLen: 5, rareLen: 8, parenMinLen: 7,
    bStart: '\\b', bCont: '\\w*', bEnd: '\\b', flags: 'gi', splitRe: /[^a-z0-9']+/,
  },
  ko: {
    label: '한국어', name: 'Korean',
    fold: (s) => s.split(/\s+/).map(foldKoWord).join(' '),
    foldWord: foldKoWord,
    STOP: new Set(('은 는 이 가 을 를 의 에 에서 에게 한테 도 만 부터 까지 와 과 로 으로 아 야 고 하 되 있 없 이 그 저 ' +
      '무엇 무슨 어떤 어느 어디 언제 왜 어떻게 누구 얼마 얼마나 있다 없다 이다 아니다 것 수 등 및 그리고 그러나 그래서 그런데 그러면 책 유란시아 알려줘 알려주세요 설명해줘 설명해주세요 뜻이야 정의 해줘 말해줘 ' +
      '하나요 해요 이에요 예요 인가요 하나 하니 있나요 되나요 돼요 합니까 입니까 인가 해').split(' ')),
    QUESTION_WORDS: new Set(('무엇 무슨 어떤 어느 어디 언제 왜 어떻게 누구 얼마 얼마나 있다 없다 이다 아니다 것 수 등 및 그리고 그러나 그래서 그런데 그러면 책 유란시아 알려줘 알려주세요 설명해줘 설명해주세요 뜻이야 정의 해줘 말해줘').split(' ')),
    BOOK_TERMS: {
      '죽': ['생존', '저택 세계'], '사망': ['생존', '저택 세계'],
      '천사': ['세라핌'], '수호천사': ['운명 수호자', '세라핌'],
      '하늘': ['저택 세계', '파라다이스'], '지옥': ['지옥'],
      '하나님': ['우주의 아버지'], '아버지': ['우주의 아버지'], '창조자': ['우주의 아버지', '미가엘'],
      '혼': ['혼'], '성령': ['성령', '진실의 영'], '양심': ['생각 조절자'],
      '예수': ['예수'], '그리스도': ['미가엘', '예수'],
      '기도': ['기도'], '예배': ['예배'], '믿음': ['믿음'],
      '죄': ['죄'], '악': ['악'], '악마': ['루시퍼', '칼리가스티아'], '사탄': ['사탄', '루시퍼'],
      '용서': ['용서'], '고통': ['고통'], '슬픔': ['슬픔'],
      '사랑': ['사랑'], '결혼': ['결혼'], '가정': ['가정'],
      '아담': ['아담', '이브'], '이브': ['아담', '이브'],
      '우주': ['우주'], '행복': ['행복'], '두려움': ['두려움'], '치유': ['치유'], '기적': ['기적'],
      '몇 살': ['출생', '탄생'],
      '유란시아': ['유란시아'], '철학': ['철학'], '생명': ['생명'], '구원': ['구원'], '부활': ['부활'],
    },
    GLUE: new Set(('오 가 하 해 되 돼 있 없 보 봐 알 알아 생각 생각해 주 줘 듣 들어 말 말해 찾 찾아 가르쳐 보여줘 알려줘 알려주세요 설명해줘 설명해주세요 싶 지만').split(' ')),
    ageRe: /몇 살/,
    birthTerms: ['출생', '탄생'], birthTitleRe: /태어나|탄생|출생/,
    subjectRe: null, // Korean has no case; age questions use the plain machinery
    minLen: 2, distinctiveLen: 3, rareLen: 4, parenMinLen: 2,
    bStart: '(?<![\\p{L}\\p{N}])', bCont: '[\\p{L}\\p{N}]*', bEnd: '(?![\\p{L}\\p{N}])',
    flags: 'giu', splitRe: /[^\p{L}\p{N}]+/u,
  },
}

export const I18N_LANGS = Object.keys(LANGS)

// The question's own content words, and the book's terms they map to — in that language.
export function toBookTermsIn(lang, question) {
  const cfg = LANGS[lang]
  if (!cfg) throw new Error('unknown language: ' + lang)
  let q
  if (lang === 'ko') {
    q = cfg.fold(question).replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim()
  } else {
    q = cfg.fold(question).replace(/[‘’]/g, "'").replace(/[^a-z'\s]/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const words = q.split(' ').filter(Boolean)
    // French elisions: "l'enfer" -> "enfer", "d'amour" -> "amour"
    .map((w) => (lang === 'fr' ? w.replace(/^(l|d|c|j|m|t|s|y|qu)'/, '') : w))
  const mapped = []
  if (lang === 'ko') {
    for (const [k, terms] of Object.entries(cfg.BOOK_TERMS)) {
      const parts = k.split(' ')
      let hit = false
      for (let i = 0; i + parts.length <= words.length && !hit; i++) {
        hit = parts.every((p, j) => words[i + j].startsWith(p))
      }
      if (hit) mapped.push(...terms)
    }
  } else {
    for (const [k, terms] of Object.entries(cfg.BOOK_TERMS)) {
      if (new RegExp(`\\b${escRe(k)}\\b`).test(q)) mapped.push(...terms)
    }
  }
  const content = words
    .filter((w) => w.length >= cfg.minLen && !cfg.QUESTION_WORDS.has(w) && !cfg.STOP.has(w))
    .map((w) => (lang === 'ko' ? w : w.replace(/'s$/, '')))
  return { words: content, mapped: [...new Set(mapped)] }
}

// Flatten parsed papers for searching, the way the English engine builds byRef.
export function buildByRef(papers) {
  const byRef = new Map()
  for (const p of papers)
    for (const s of p.sections)
      for (const par of s.paragraphs)
        byRef.set(par.ref, { ...par, paper: p.paper_index, paperTitle: p.paper_title, author: p.author, sectionTitle: s.section_title })
  return byRef
}

// The tools' own search over a translation's paragraphs: phrase 100, all-terms 50,
// partial 10 per term — the same tiers as the English search.
export function searchTranslation(lang, papers, query, limit = 40) {
  const cfg = LANGS[lang]
  if (!cfg) throw new Error('unknown language: ' + lang)
  const fq = cfg.fold(query).trim()
  let terms
  if (lang === 'ko') {
    terms = fq.split(/\s+/).map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter((t) => t.length > 1 && !cfg.STOP.has(t))
  } else {
    terms = fq.split(/\s+/).map((t) => t.replace(/[^a-z-]/g, ''))
      .filter((t) => t.length > 1 && !cfg.STOP.has(t))
  }
  if (!terms.length) terms = fq.split(/\s+/).filter(Boolean)
  const termRes = terms.map((t) => new RegExp(cfg.bStart + escRe(t) + cfg.bCont, cfg.flags))
  const phraseRe = new RegExp(cfg.bStart + escRe(fq).replace(/\s+/g, '\\s+') + cfg.bEnd, cfg.flags.replace('g', ''))
  const results = []
  for (const p of papers) {
    for (const s of p.sections) {
      for (const par of s.paragraphs) {
        const folded = cfg.fold(par.text)
        const counts = termRes.map((re) => { re.lastIndex = 0; return (folded.match(re) || []).length })
        const matched = counts.filter((c) => c > 0).length
        const hits = counts.reduce((a, b) => a + b, 0)
        let score = 0
        if (phraseRe.test(folded)) score = 100
        else if (terms.length && matched === terms.length) score = 50
        else if (matched > 0) score = matched * 10
        if (score > 0) score += Math.min(hits, 49) / 50
        if (score > 0) results.push({ score, ref: par.ref })
      }
    }
  }
  results.sort((a, b) => b.score - a.score)
  return { total: results.length, results: results.slice(0, limit) }
}

// Answer a question in the book's own words — in that language. Mirrors app/ask.js.
export function answerIn(lang, papers, question, { max = 5 } = {}) {
  const cfg = LANGS[lang]
  if (!cfg) throw new Error('unknown language: ' + lang)
  const byRef = buildByRef(papers)
  const search = (q, limit) => searchTranslation(lang, papers, q, limit)
  const { words, mapped } = toBookTermsIn(lang, question)

  // "How old was X?" is answered by X's birth narrative.
  const ageQ = cfg.ageRe.test(question)
  // A subject is a name the book calls by the same name ("Jesus" -> "Jesus"; Korean has
  // no case, so a mapped term that maps to itself, like 예수 -> 예수, counts as one).
  const isSubject = (t) => cfg.subjectRe ? cfg.subjectRe.test(t) : (cfg.BOOK_TERMS[t] || []).includes(t)
  const subjects = ageQ ? [...new Set(mapped.filter(isSubject))] : []
  // The question's most distinctive words, with book-term substitutions where the book
  // says it differently. (Age questions have their own machinery; this adds noise there.)
  const distinctive = ageQ ? [] : words.filter((w) => w.length >= cfg.distinctiveLen).map((w) => {
    const m = cfg.BOOK_TERMS[lang === 'ko' ? w : w.toLowerCase()]
    return m && m.length === 1 ? m[0] : w
  })
  const distinctiveOn = distinctive.length >= 2 && distinctive.join(' ') !== words.join(' ') &&
    distinctive.some((w) => w.length >= cfg.rareLen)
  // A mapped term inside the distinctive set is covered by the distinctive query, which is
  // strictly more specific. (No child-specific terms in the translations yet.)
  const distinctiveSet = new Set(distinctive.map((w) => w.toLowerCase()))
  const SPECIFIC = new Set()
  const queries = []
  if (words.length) queries.push({ q: words.join(' '), weight: 1, label: words.join(' '), ownWords: true })
  // The reader's words in the book's language: pairs the mapped term with the question's
  // other content words. Light verbs are dropped: the search is AND-like, so glue would
  // exclude the very paragraphs we want.
  const substituted = words.map((w) => {
    const m = cfg.BOOK_TERMS[lang === 'ko' ? w : w.toLowerCase()]
    return m && m.length === 1 ? m[0] : w
  }).filter((w) => !cfg.GLUE.has(w.toLowerCase()))
  if (substituted.length >= 2 && substituted.join(' ') !== words.join(' '))
    queries.push({ q: substituted.join(' '), weight: 1, label: substituted.join(' '), ownWords: true })
  if (distinctiveOn) {
    queries.push({ q: distinctive.join(' '), weight: 1.5, label: distinctive.join(' '), ownWords: true })
  }
  // A parenthetical clarification names the term the reader means: long parenthetical
  // words get their own high-weight query so the misspelled words outside the parens
  // can't drown them out.
  const parenSpecific = []
  for (const m of question.matchAll(/\(([^)]+)\)/g))
    for (const w of m[1].split(cfg.splitRe).filter(Boolean))
      if (w.length >= cfg.parenMinLen && !cfg.QUESTION_WORDS.has(lang === 'ko' ? w : cfg.fold(w)) && !parenSpecific.includes(w)) parenSpecific.push(w)
  for (const t of parenSpecific) queries.push({ q: t, weight: 3, label: `clarified:"${t}"` })
  // With a subject to pair with birth terms, the plain birth searches add only noise.
  const skipBirth = ageQ && subjects.length > 0
  for (const t of mapped) {
    if (skipBirth && cfg.birthTerms.includes(t)) continue
    if (distinctiveOn && distinctiveSet.has(t.toLowerCase())) continue
    queries.push({ q: t, weight: SPECIFIC.has(t) ? 3 : 1.2, label: t })
  }
  if (subjects.length) {
    for (const s of subjects.slice(0, 2)) queries.push({ q: `${s} ${cfg.birthTerms[0]}`, weight: 2, label: `${s} ${cfg.birthTerms[0]}`, limit: 60 })
  }
  const score = new Map(), why = new Map()
  for (const { q, weight, label, ownWords, limit } of queries) {
    const lim = limit || 40
    const r = search(q, lim)
    if (ownWords) {
      // The search scores a paragraph 50+ only when every one of the question's words is
      // in it. When that is true of just a handful of paragraphs, they are almost
      // certainly the answer, so they outrank the looser topic expansions.
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
  }
  if (subjects.length && byRef) {
    // The book's birth narratives live in birth-titled sections: they answer "how old"
    // even when the subject is named there less often than in later discourses. The
    // subject may appear in the section title ("El Nacimiento De Jesús") rather than
    // the paragraph text, and matching is accent-folded ("Jesus" meets "Jesús").
    const subFolded = subjects.map((s) => cfg.fold(s))
    for (const [ref, p] of byRef) {
      if (!p.sectionTitle || !cfg.birthTitleRe.test(p.sectionTitle)) continue
      const hayText = cfg.fold(p.text), hayTitle = cfg.fold(p.sectionTitle)
      if (subFolded.some((s) => hayText.includes(s) || hayTitle.includes(s))) {
        score.set(ref, (score.get(ref) || 0) + 3)
        if (!why.has(ref)) why.set(ref, new Set())
        why.get(ref).add(`${subjects.join('/')} ${cfg.birthTerms[0]}`)
      }
    }
  }
  const all = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([ref]) => ref)
  // Where the book is silent: a word of the question that the book uses rarely or never.
  const quiet = []
  for (const w of words) {
    const r = search(w, 3)
    if (r.total <= 3) quiet.push({ word: w, total: r.total, refs: r.results.map((x) => x.ref) })
  }
  return { refs: all.slice(0, max), more: all.slice(max, max + 10), why, words, mapped, quiet }}
