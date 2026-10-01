// parse-i18n.js — one parser for the three official translations of The Urantia Book.
// It reads the plain TXT published on urantia.org (Spanish, French, Korean) and turns
// it into 197 paper documents shaped like the English search index:
//   { paper_index, paper_title, author, sections: [{ section_index, section_ref,
//     section_title, paragraphs: [{ ref, pageref, text }] }] }
//
// The three editions are laid out almost identically; only the headings, presenter
// wording, and title casing differ. Those differences live in the LANG config below.
// Rights note: this parser holds no translation text, only the code and these short
// structural patterns. The app fetches the official text at runtime from urantia.org.

const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15 }

function titleCase(s) {
  // Python str.title(): first letter of every word up, the rest down.
  return s.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (m, b, c) => b + c.toUpperCase())
}

// ---------- Spanish presenter names ----------
const ES_TITLE_PATTERNS = [
  ['jefe de los arcángeles', 'Jefe de los Arcángeles'],
  ['brillante estrella vespertina', 'Brillante Estrella Vespertina'],
  ['estrella brillante vespertina', 'Brillante Estrella Vespertina'],
  ['estrella vespertina', 'Brillante Estrella Vespertina'],
  ['hijo lanonandek secundario', 'Hijo Lanonandek Secundario'],
  ['consejero divino', 'Consejero Divino'],
  ['perfeccionador de la sabiduría', 'Perfeccionador de la Sabiduría'],
  ['censor universal', 'Censor Universal'],
  ['mensajero poderoso', 'Mensajero Poderoso'],
  ['mensajero solitario', 'Mensajero Solitario'],
  ['hijo vorondadek', 'Hijo Vorondadek'],
  ['portadores de vida', 'Portador de Vida'],
  ['portador de vida', 'Portador de Vida'],
  ['elevado en autoridad', 'Elevado en Autoridad'],
  ['jefe de los serafines', 'Jefe de Serafines'],
  ['jefe de serafines', 'Jefe de Serafines'],
  ['jefe de los seres intermedios', 'Jefe de los seres intermedios'],
  ['malavatia melquisedek', 'Malavatia Melquisedek'],
  ['manovandet melquisedek', 'Manovandet Melquisedek'],
  ['mantutia melquisedek', 'Mantutia Melquisedek'],
  ['arcángel', 'Arcángel'],
  ['melquisedek', 'Melquisedek'],
  ['solonia', 'Solonia'],
]
const ES_VERB_RE = /^(Presentado en Urantia por|Revelado en Urantia por|Presentado a solicitud de Gabriel por|Presentado|Patrocinado|Redactado|Dictado|Narrado|Auspiciado|Revelado)\s+(conjuntamente\s+)?(por\s+)?/
const EN_ES_AUTHOR = {
  'Chief of Evening Stars': 'Jefe de las Estrellas Vespertinas',
  'Mantutia Melchizedek': 'Mantutia Melquisedek',
  'Midwayer Commission': 'Comisión de seres intermedios',
  'Divine Counselor': 'Consejero Divino',
  'Perfector of Wisdom': 'Perfeccionador de la Sabiduría',
  'Universal Censor': 'Censor Universal',
  'Mighty Messenger': 'Mensajero Poderoso',
  'One High in Authority': 'Elevado en Autoridad',
  'Melchizedek': 'Melquisedek',
  'Vorondadek Son': 'Hijo Vorondadek',
  'Brilliant Evening Star': 'Brillante Estrella Vespertina',
  'Archangel': 'Arcángel',
  'Chief of Archangels': 'Jefe de los Arcángeles',
  'Life Carrier': 'Portador de Vida',
  'Solitary Messenger': 'Mensajero Solitario',
  'Chief of Seraphim': 'Jefe de Serafines',
  'Secondary Lanonandek': 'Hijo Lanonandek Secundario',
  'Solonia': 'Solonia',
  'Chief of Midwayers': 'Jefe de los seres intermedios',
  'Malavatia Melchizedek': 'Malavatia Melquisedek',
  'Manovandet Melchizedek': 'Manovandet Melquisedek',
  'Divine Counselor and One Without Name and Number': 'Consejero Divino y Uno Sin Nombre ni Número',
  'Mighty Messenger and Machiventa Melchizedek': 'Mensajero Poderoso y Maquiventa Melquisedek',
}
function esExtractAuthor(bracketText) {
  let t = bracketText.trim()
  if (!t.startsWith('[')) throw new Error('extract_author: ' + t.slice(0, 60))
  t = t.slice(1)
  if (t.endsWith(']')) t = t.slice(0, -1)
  if (t.includes('Sin Nombre ni Número')) return 'Consejero Divino y Uno Sin Nombre ni Número'
  if (t.includes('vicegerente Príncipe Planetario')) return 'Mensajero Poderoso y Maquiventa Melquisedek'
  t = t.replace(ES_VERB_RE, '')
  const tl = t.toLowerCase()
  for (const [pattern, canonical] of ES_TITLE_PATTERNS) {
    if (tl.includes(pattern)) return canonical
  }
  t = t.replace(/^(un|una|el|e)\s+/, '')
  t = t.split(/[,.]/)[0].trim()
  t = t.replace(/\s+de\s+(Nebadon|Uversa|Orvonton)$/, '')
  return t || 'Desconocido'
}

// ---------- French presenter names ----------
const FR_TITLE_PATTERNS = [
  ['dépourvu de nom et de nombre', 'Un Conseiller Divin et un Dépourvu de Nom et de Nombre'],
  ['puissant messager et machiventa', 'Un Puissant Messager et Machiventa Melchizédek'],
  ['chef des étoiles du soir', 'Le chef des Étoiles du Soir'],
  ['brillante étoile du soir', 'Une Brillante Étoile du Soir'],
  ['étoile du soir', 'Une Brillante Étoile du Soir'],
  ['chef des archanges', 'Le chef des archanges'],
  ['chef des séraphins', 'Le chef des séraphins'],
  ['chef des médians', 'Le chef des médians'],
  ['membre du corps des porteurs de vie', 'Un Porteur de Vie'],
  ['porteur de vie', 'Un Porteur de Vie'],
  ['manovandet melchizédek', 'Manovandet Melchizédek'],
  ['malavatia melchizédek', 'Malavatia Melchizédek'],
  ['fils vorondadek', 'Un Fils Vorondadek'],
  ['fils lanonandek secondaire', 'Un Lanonandek Secondaire'],
  ['melchizédek', 'Un Melchizédek'],
  ['lanonandek secondaire', 'Un Lanonandek Secondaire'],
  ['élevé en autorité', 'Un Élevé en Autorité'],
  ['messager solitaire', 'Un Messager Solitaire'],
  ['conseiller divin', 'Un Conseiller Divin'],
  ['perfecteur de sagesse', 'Un Perfecteur de Sagesse'],
  ['censeur universel', 'Un Censeur Universel'],
  ['puissant messager', 'Un Puissant Messager'],
  ['archange', 'Un archange'],
  ['solonia', 'Solonia'],
]
const FR_VERB_RE = /^(Présenté sur requête de Gabriel par|Présenté sur Urantia par|Parrainé conjointement par|Présenté|Parrainé|Rédigé|Dicté|Relaté|Exposé|Révélé|Étant)\s+(par\s+)?/
function frExtractAuthor(bracketText) {
  let t = bracketText.trim()
  if (!t.startsWith('[')) throw new Error('extract_author: ' + t.slice(0, 60))
  t = t.slice(1)
  if (t.endsWith(']')) t = t.slice(0, -1)
  if (t.includes('Dépourvu de Nom et de Nombre')) return 'Un Conseiller Divin et un Dépourvu de Nom et de Nombre'
  if (t.includes('Machiventa')) return 'Un Puissant Messager et Machiventa Melchizédek'
  if (t.includes('Prince Planétaire vice-gérant')) return 'Un Puissant Messager et Machiventa Melchizédek'
  t = t.replace(FR_VERB_RE, '')
  const tl = t.toLowerCase()
  for (const [pattern, canonical] of FR_TITLE_PATTERNS) {
    if (tl.includes(pattern)) return canonical
  }
  return 'Inconnu'
}

// ---------- Korean presenter names ----------
// (variant, canonical), longest-first so specific forms win.
const KO_TITLES = [
  ['신성한 조언자와 한 이름도 번호도 없는 자', '신성한 조언자와 이름도 번호도 없는 자'],
  ['막강한 사자와 마키벤타 멜기세덱', '막강한 사자와 마키벤타 멜기세덱'],
  ['천사장들의 우두머리', '천사장 우두머리'],
  ['천사장 우두머리', '천사장 우두머리'],
  ['저녁별 우두머리', '저녁별 우두머리'],
  ['중도자 우두머리', '중도자 우두머리'],
  ['중도자 위원회', '중도자 위원회'],
  ['세라핌의 우두머리', '세라핌의 우두머리'],
  ['세라핌 우두머리', '세라핌의 우두머리'],
  ['마노반뎃 멜기세덱', '마노반뎃 멜기세덱'],
  ['만투시아 멜기세덱', '만투시아 멜기세덱'],
  ['말라바시아 멜기세덱', '말라바시아 멜기세덱'],
  ['찬란한 저녁별', '찬란한 저녁별'],
  ['신성한 조언자', '신성한 조언자'],
  ['막강한 사자', '막강한 사자'],
  ['우주 검열자', '우주 검열자'],
  ['지혜 완성자', '지혜 완성자'],
  ['고등 권위자', '고등 권위자'],
  ['보론다덱 아들', '보론다덱 아들'],
  ['생명 운반자', '생명 운반자'],
  ['외톨 사자', '외톨사자'],
  ['외톨사자', '외톨사자'],
  ['2차 라노난덱', '2차 라노난덱'],
  ['저녁별', '찬란한 저녁별'],
  ['천사장', '천사장'],
  ['멜기세덱', '멜기세덱'],
  ['솔로니아', '솔로니아'],
]
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const KO_TITLE_ALT = KO_TITLES.map(([v]) => escRe(v)).join('|')
// presenter subject: "[(한) <title>(, appositive)( 아들)(이|가|이므로) ..."
const KO_SUBJ_RE = new RegExp(`(한\\s+)?(${KO_TITLE_ALT})(,\\s*[^.\\]]{1,60})?(\\s*아들)?(이|가|이므로)`)
// presenter via membership: "TITLE (집단|군단|무리|단)의 한 단원이 ..."
const KO_MEMBER_RE = new RegExp(`(${KO_TITLE_ALT})\\s*(집단|군단|무리|단)의 한 단원이`)
const KO_CANON = new Map(KO_TITLES)
function koExtractAuthor(bracketText) {
  let t = bracketText.trim()
  if (!t.startsWith('[')) throw new Error('extract_author: ' + t.slice(0, 60))
  t = t.replace(/(어느|어떤)\s+/g, '한 ') // normalize indefinite articles
  let m = KO_SUBJ_RE.exec(t.slice(0, 200))
  if (m) return KO_CANON.get(m[2])
  m = KO_MEMBER_RE.exec(t.slice(0, 200))
  if (m) return KO_CANON.get(m[1])
  return null
}

const LANG = {
  es: {
    docRe: /^Documento (\d+)$/,
    startMarker: 'PRÓLOGO', paper0Title: 'Prólogo',
    bookTitle: 'El libro de Urantia',
    partRe: /^PARTE [IVX]+\s*$/,
    partTitles: new Set(['El Universo Central y los Superuniversos', 'El Universo Local', 'La Historia de Urantia', 'La Vida y las Enseñanzas de Jesus']),
    sponsorInfixCI: ['auspiciad'], sponsorPrefix: ['La base de esta narrativa provino'],
    ackLine: 'Reconocimiento', asterRe: /^\s*\*\s*\*\s*\*/,
    parenUpperSkip: true, allCapsTitles: true,
    presRe: /^\[(Presentado|Patrocinado|Redactado|Dictado|Narrado|Auspiciado|Revelado|Siendo|Éste es)/,
    extractAuthor: esExtractAuthor, presLeakNeedle: 'Presentado por',
    authorFrom: 'english',
    tocSplit: null,
  },
  fr: {
    docRe: /^Fascicule (\d+)$/,
    startMarker: 'INTRODUCTION', paper0Title: 'Introduction',
    bookTitle: 'Le Livre d\u2019Urantia',
    partRe: /^(Première|Deuxième|Troisième|Quatrième) partie$/,
    partTitles: new Set(['L\u2019univers central et les superunivers', 'L\u2019univers local', 'L\u2019histoire d\u2019Urantia', 'La vie et les enseignements de Jésus']),
    sponsorInfixCI: [], sponsorPrefix: ['Parrainée par', 'Ces fascicules furent parrainés', 'Ce groupe de fascicules fut parrainé', 'La base de ce récit a été fournie'],
    ackLine: 'Remerciements', asterRe: /^\s*\*\s*\*\s*\*/,
    parenUpperSkip: true, allCapsTitles: true,
    presRe: /^\[(Présenté|Parrainé|Rédigé|Dicté|Relaté|Exposé|Révélé|Étant)/,
    extractAuthor: frExtractAuthor, presLeakNeedle: null,
    authorFrom: 'toc',
    tocSplit: 'fr',
  },
  ko: {
    docRe: /^제 (\d+) 편$/, koTruncate: true,
    startMarker: '머 리 말', paper0Title: '머리말',
    bookTitle: '유란시아서',
    partRe: /^제 (\d+) 부$/,
    partTitles: new Set(['중앙 우주와 초우주', '지역 우주', '유란시아의 역사', '예수의 생애와 가르침', '예수의 일생과 가르침']),
    sponsorInfixCI: [], sponsorPrefix: [],
    ackLine: null, asterRe: /^\s*(\*\s*){3,}$/,
    parenUpperSkip: false, allCapsTitles: false,
    presRe: null, // Korean: any '[' paragraph whose author pattern matches is a presenter
    extractAuthor: koExtractAuthor, presLeakNeedle: null,
    authorFrom: 'toc',
    tocSplit: 'ko',
    combRe: /^(\d+)\. - (\d+)\.\s+(.+)$/,
    koSponsor: (s) => s.includes('후원을 받았다') || s.includes('후원하였다') || s.startsWith('이 이야기의 근거는'),
  },
}

const PAR_RE = /^(\d+):(\d+)\.(\d+) \((\d+\.\d+)\) (.*)$/
const ARAB_RE = /^(\d+)\.\s+(.+?)\s*$/
const ROMAN_RE = /^([IVX]+)\.\s+(.+?)\s*$/
const SEP_RE = /^-+\s*$/
const PAREN_RE = /^\(([^)]+)\)\s*$/

// Parse the plain TXT of one official translation.
// opts.englishAuthor(pidx) -> English author string, required for Spanish backfill.
export function parseTranslation(rawText, lang, opts = {}) {
  const cfg = LANG[lang]
  if (!cfg) throw new Error('unknown language: ' + lang)
  let rawLines = rawText.split('\n')
  if (cfg.koTruncate) {
    let last = -1
    rawLines.forEach((l, i) => { if (/^196:3\.35 /.test(l)) last = i })
    rawLines = rawLines.slice(0, last + 1)
  }

  // --- document boundaries + table of contents ---
  let start = -1
  for (let i = 0; i < rawLines.length; i++) {
    const hit = lang === 'ko' ? rawLines[i].trim() === cfg.startMarker : rawLines[i] === cfg.startMarker
    if (hit) { start = i; break }
  }
  if (start < 0) throw new Error('start marker not found: ' + cfg.startMarker)

  const bounds = [[0, start]] // paper 0 starts at the PRÓLOGO/INTRODUCTION/머 리 말 line
  for (let i = 0; i < rawLines.length; i++) {
    const line = lang === 'ko' ? rawLines[i].trim() : rawLines[i]
    const m = line.match(cfg.docRe)
    if (m) bounds.push([parseInt(m[1], 10), i])
  }
  bounds.sort((a, b) => a[1] - b[1])
  if (bounds.length !== 197 || bounds[0][0] !== 0 || bounds[196][0] !== 196) {
    throw new Error('paper sequence broken: ' + bounds.length + ' docs')
  }
  bounds.push([null, rawLines.length]) // sentinel
  const byPidx = new Map(bounds.map(([p, i]) => [p, i]))

  const tocLines = rawLines // the edition's TOC is a plain listing; first match per paper wins
  const TOC_AUTHOR = {}
  for (const tl of tocLines) {
    const s = tl.trim()
    let m
    if (cfg.tocSplit === 'fr' && (m = s.match(/^(\d{3}) \. (.+) \. (.+) \. (\d+)$/))) {
      const n = parseInt(m[1], 10)
      if (!(n in TOC_AUTHOR)) TOC_AUTHOR[n] = m[3].trim()
    } else if (cfg.tocSplit === 'ko') {
      const parts = s.split(' . ')
      if (parts.length >= 4 && /^\d{3}$/.test(parts[0].trim())) {
        const n = parseInt(parts[0].trim(), 10)
        if (!(n in TOC_AUTHOR)) TOC_AUTHOR[n] = parts[2].trim()
      }
    }
  }

  const docs = []
  const multiBrackets = [], keptBrackets = [], unmatchedBrackets = [], strays = [], backfilled = []
  const mismatches = []

  for (let pidx = 0; pidx <= 196; pidx++) {
    const sline = byPidx.get(pidx)
    const eline = bounds[pidx + 1][1]
    const lines = rawLines.slice(sline, eline)

    let k, ptitle
    if (pidx === 0) {
      ptitle = cfg.paper0Title
      k = 1
    } else if (cfg.allCapsTitles) {
      k = 1
      while (k < lines.length && !lines[k].trim()) k++
      if (k >= lines.length) throw new Error('no title line for paper ' + pidx)
      const rawTitle = lines[k].trim()
      if (rawTitle !== rawTitle.toUpperCase()) {
        throw new Error(`paper ${pidx}: title not ALL CAPS: ${rawTitle.slice(0, 40)}`)
      }
      ptitle = titleCase(rawTitle)
      k += 1
    } else {
      k = 1
      while (k < lines.length && !lines[k].trim()) k++
      if (k >= lines.length) throw new Error('no title line for paper ' + pidx)
      ptitle = lines[k].trim()
      if (PAR_RE.test(lines[k])) throw new Error(`paper ${pidx}: title looks like par`)
      if (cfg.docRe.test(ptitle)) throw new Error(`paper ${pidx}: title looks like doc header`)
      k += 1
    }

    const sections = []
    const state = { sec: null, par: null, author: null, expect_par: null, sub_skipped: 0 }

    const flushPar = () => {
      if (state.par === null) return
      const [ref, pageref, chunks] = state.par
      const text = chunks.join(' ').trim()
      state.par = null
      if (!text) return
      if (cfg.presRe ? cfg.presRe.test(text) : text.startsWith('[')) {
        const a = cfg.extractAuthor(text)
        if (a !== null) {
          if (state.author === null) state.author = a
          else multiBrackets.push([pidx, ref])
          return // presenter bracket: excluded from paragraphs
        }
        keptBrackets.push([pidx, ref]) // editorial: keep as content
      } else if (text.startsWith('[')) {
        unmatchedBrackets.push([pidx, ref, text.slice(0, 80)])
      }
      if (state.sec === null) throw new Error(`par ${ref} before any section`)
      state.sec.paragraphs.push({ ref, pageref, text })
    }

    const newSection = (idx, ref, title) => {
      flushPar()
      state.sec = { section_index: idx, section_ref: ref, section_title: title, paragraphs: [] }
      sections.push(state.sec)
      if (lang === 'ko') { state.expect_par = idx; state.sub_skipped = 0 }
    }
    const ensureSection0 = () => {
      if (state.sec === null) {
        newSection(0, `${pidx}:0`, '')
        if (lang === 'ko') state.expect_par = null
      }
    }
    const isSkip = (s) => {
      if (!s) return true
      if (SEP_RE.test(s)) return true
      if (s === cfg.bookTitle) return true
      if (cfg.partRe.test(s) || cfg.partTitles.has(s)) return true
      if (cfg.ackLine && s === cfg.ackLine) return true
      if (cfg.asterRe.test(s)) return true
      for (const p of cfg.sponsorPrefix) if (s.startsWith(p)) return true
      const sl = s.toLowerCase()
      for (const inf of cfg.sponsorInfixCI) if (sl.includes(inf)) return true
      if (cfg.parenUpperSkip) {
        const m = s.match(PAREN_RE)
        if (m && m[1] === m[1].toUpperCase()) return true
      }
      return false
    }

    while (k < lines.length) {
      const raw = lines[k], s = raw.trim(); k++
      if (!s && lang === 'ko') continue // KO: blank lines never end a paragraph
      if (isSkip(s)) { flushPar(); continue }
      if (s === cfg.startMarker) continue
      if (cfg.docRe.test(s)) { flushPar(); break }
      let m = raw.match(PAR_RE)
      if (m) {
        flushPar(); ensureSection0()
        const pnum = parseInt(m[1], 10), secnum = parseInt(m[2], 10)
        if (pnum !== pidx) throw new Error(`paper ${pidx}: par ref mismatch ${m[0].slice(0, 24)}`)
        if (state.expect_par !== null) {
          if (secnum !== state.expect_par) {
            throw new Error(`paper ${pidx}: section ${state.expect_par} opens with ${m[0].slice(0, 24)}`)
          }
          state.expect_par = null
          state.sub_skipped = 0
        }
        state.par = [`${m[1]}:${m[2]}.${m[3]}`, m[4], [m[5].trim()]]
        continue
      }
      if (lang === 'ko' && (m = s.match(cfg.combRe))) {
        newSection(parseInt(m[2], 10), `${pidx}:${m[2]}`, s)
        continue
      }
      m = s.match(ARAB_RE)
      if (m && (lang === 'ko' || s === s.toUpperCase())) {
        newSection(parseInt(m[1], 10), `${pidx}:${m[1]}`, lang === 'ko' ? m[2].trim() : titleCase(m[2].trim()))
        continue
      }
      m = s.match(ROMAN_RE)
      if (m && ROMAN[m[1]] !== undefined && (lang === 'ko' || s === s.toUpperCase())) {
        const n = ROMAN[m[1]]
        newSection(n, `${pidx}:${n}`, lang === 'ko' ? m[2].trim() : titleCase(m[2].trim()))
        continue
      }
      if (lang === 'ko') {
        if (state.expect_par !== null) {
          state.sub_skipped++
          if (state.sub_skipped > 3) {
            throw new Error(`paper ${pidx} section ${state.expect_par}: too many subtitle lines near ${s.slice(0, 60)}`)
          }
          continue
        }
        if (state.par === null && cfg.koSponsor(s)) continue
      }
      if (cfg.presLeakNeedle && state.par !== null && s.includes(cfg.presLeakNeedle)) {
        throw new Error(`paper ${pidx}: presenter leak near ${s.slice(0, 60)}`)
      }
      if (state.par !== null) state.par[2].push(s)
      else strays.push([pidx, s.slice(0, 80)])
    }
    flushPar()

    if (lang === 'ko' && state.expect_par !== null) {
      throw new Error(`paper ${pidx}: section ${state.expect_par} never got its first paragraph`)
    }

    let author = state.author
    if (author === null) {
      if (cfg.authorFrom === 'english') {
        if (!opts.englishAuthor) throw new Error('englishAuthor provider required for Spanish backfill')
        author = EN_ES_AUTHOR[opts.englishAuthor(pidx)] || 'Desconocido'
      } else {
        author = TOC_AUTHOR[pidx]
        if (author === undefined) throw new Error('no TOC author for paper ' + pidx)
      }
      backfilled.push(pidx)
    } else if (cfg.authorFrom === 'toc') {
      if (TOC_AUTHOR[pidx] === undefined) throw new Error('no TOC author for paper ' + pidx)
      if (author !== TOC_AUTHOR[pidx]) {
        mismatches.push([pidx, author, TOC_AUTHOR[pidx]])
        author = TOC_AUTHOR[pidx] // TOC wins
      }
    }

    docs.push({ paper_index: pidx, paper_title: ptitle, author, sections })
  }

  return {
    docs,
    stats: { multiBrackets, keptBrackets, unmatchedBrackets, strays, backfilled, mismatches,
             paragraphCount: docs.reduce((n, d) => n + d.sections.reduce((m, s) => m + s.paragraphs.length, 0), 0) },
  }
}
