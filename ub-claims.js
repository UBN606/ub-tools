#!/usr/bin/env node
/**
 * ub-claims.js -- what a draft says The Urantia Book says must be checkable against the book.
 *
 * ub-verify.js checks "quote" (citation) pairs. Three kinds of error pass it, and this closes each:
 *   C1 UNCITED    a sentence credits the book ("the book says, dates, places, describes...",
 *                 "according to the UB") and neither it, its paragraph nor the next paragraph
 *                 cites a Paper:Section.Paragraph. A claim of absence ("the book never names X")
 *                 is left to ub-recall.js, which proves those.
 *   C2 NUMBER     a date or quantity credited to the book that the cited paragraphs do not
 *                 contain, in digits or in words ("eighty-five thousand" = 85000). A draft that
 *                 said "the UB's dating ... c. 6000-2000 BCE" for a passage that gives no date
 *                 passed every quote check. Figures marked as ours ("our arithmetic") are exempt.
 *   C3 BOOK WORDS six or more words of the book in quotation marks with no citation.
 *
 * usage:
 *   node ub-claims.js draft.md [more files]      (.md, .mdx, .txt; .ts/.json read string by string)
 *   node ub-claims.js draft.md --allow allow.json
 *        allow.json = { "allow": { "<first 60 characters of the sentence>": "why it is right as written" } }
 *   node ub-claims.js --self-test
 * exit 0 CLAIMS PASS, 1 findings, 3 no book text (run node fetch-data.js)
 *
 * The same rules run the Urantia Book Network's own pre-commit check; both carry the same controls.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PAPERS_DIR = path.join(__dirname, 'source-texts', 'papers');

const MIN_REASON = 20
const REF = /\b(\d{1,3}):(\d{1,2})\.(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\b/g
const SUBJECT = /\b(the (Urantia )?book(?! Network)|the UB|UB(?! Network)|revelators?|Papers? \d{1,3}|the revelation)('s)?\b/i
const VERB = /\b(says?|said|states?|stated|teach(es)?|taught|describes?|described|dates?|dated|places?|placed|gives?|gave|records?|recorded|tells?|told|names?|named|calls?|called|notes?|noted|puts?|lists?|listed|defines?|defined|adds?|added|explains?|explained|reports?|reported|mentions?|mentioned|speaks?|spoke|identif\w+|document\w*|confirm\w*|credits?|credited|attributes?|attributed|traces?|traced|provides?|supplies|locates?)\b/i
const OWN = /\b(the (Urantia )?book|the UB|UB)('s)? (own )?(dating|date|dates|chronology|figures?|numbers?)\b|\baccording to (the )?(Urantia Book|UB|book)\b/i
const ABSENCE = /\b(never|not|no|nothing|none|neither|nor|without|silent)\b|n't\b/i
const OURS = /\b(our (own )?(arithmetic|reading|inference|interpretation|hypothesis|estimate|calculation|conversion)|is ours|are ours|we read|in our reading|as we read it)\b/i
// ---------- numbers ----------
const UNITS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 }
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const SCALES = { hundred: 100, thousand: 1000, million: 1e6, billion: 1e9 }
const WORDLIST = [...Object.keys(UNITS), ...Object.keys(TENS), ...Object.keys(SCALES)].join('|')
const NUMWORD = new RegExp(`\\b(?:(?:half|a quarter|a|an)(?: of)? (?:a )?(?=hundred|thousand|million|billion))?(?:${WORDLIST})(?:(?:[\\s-]+(?:and[\\s-]+)?)(?:${WORDLIST}))*\\b`, 'gi')

function wordsToNumber(phrase) {
  let total = 0, current = 0, seen = false
  for (const w of phrase.toLowerCase().split(/[\s-]+/)) {
    if (w === 'and' || w === 'of' || !w) continue
    if (w === 'a' || w === 'an') { current = current || 1; continue }
    if (w === 'half') { current = 0.5; continue }
    if (w === 'quarter') { current = 0.25; continue }
    if (w in UNITS) { current += UNITS[w]; seen = true }
    else if (w in TENS) { current += TENS[w]; seen = true }
    else if (w === 'hundred') { current = (current || 1) * 100; seen = true }
    else if (w in SCALES) { total += (current || 1) * SCALES[w]; current = 0; seen = true }
  }
  return seen ? total + current : null
}

// Every number a paragraph states, in digits or words: "eighty-five thousand" -> 85000.
function numbersIn(text) {
  const out = new Set()
  const noRefs = text.replace(REF, ' ')
  for (const m of noRefs.matchAll(/\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:\.\d+)?\b/g)) out.add(Number(m[0].replace(/,/g, '')))
  for (const m of noRefs.matchAll(NUMWORD)) { const n = wordsToNumber(m[0]); if (n != null) out.add(n) }
  return out
}

// Dates and quantities WE state, outside quotation marks and citations. A number counts when it
// is 1,000 or more or sits before a unit (years, ago, B.C., BCE, AD, per cent, generations...).
// Labels such as "the 132" or "Paper 66" are not figures.
const UNIT = /^\s*(?:[-–]\s*[\d,]+\s*)?(?:years?|yrs|ago|B\.\s?C\.?|BCE|B\.C\.E\.|A\.D\.|AD\b|CE\b|per ?cent|%|percent|generations?|centuries|century|millennia|millennium|miles?|feet|foot|meters?|kilometers?|days?|months?|times\b)/i
function ourNumbers(sentence) {
  const outside = sentence
    .replace(/"[^"]*"/g, ' ')
    .replace(/\((?:UB\s*)?\d{1,3}:[^)]*\)/g, ' ')
    .replace(REF, ' ')
    .replace(/\b(Papers?|Sections?|Part|Figure|Table|Note|Volume|vol\.|pp?\.)\s+\d+(?:\s*(?:,|and|to|-)\s*\d+)*/gi, ' ')
    .replace(/\b\d{1,3}:\d{1,2}\b/g, ' ')
  const out = new Set()
  for (const m of outside.matchAll(/\b\d{1,3}(?:,\d{3})+\b|\b\d+\b/g)) {
    const n = Number(m[0].replace(/,/g, ''))
    const after = outside.slice(m.index + m[0].length, m.index + m[0].length + 40)
    if (n >= 1000 || UNIT.test(after)) out.add(n)
  }
  for (const m of outside.matchAll(NUMWORD)) {
    const n = wordsToNumber(m[0])
    const after = outside.slice(m.index + m[0].length, m.index + m[0].length + 40)
    if (n != null && (n >= 1000 || (n > 12 && UNIT.test(after)))) out.add(n)
  }
  return out
}

// Only the clauses that speak of the book are held to its figures. "The book says X (78:5.7),
// but the settlement of Rapa Nui is estimated at AD 1150 to 1280 (Moreno-Mayar et al. 2024)"
// credits the second figure to a study, not to the book.
function bookClauseNumbers(sentence) {
  const clauses = sentence.replace(/"[^"]*"/g, '"…"').split(/;|,?\s+\b(?:but|while|whereas|yet|although|though)\b\s+/i)
  const out = new Set()
  const speaks = clauses.filter((c) => SUBJECT.test(c) || OWN.test(c))
  for (const c of speaks.length ? speaks : clauses) for (const n of ourNumbers(c)) out.add(n)
  return out
}

function refsIn(text) {
  const out = []
  for (const m of text.matchAll(REF)) {
    const lo = Number(m[3]), hi = m[4] ? Number(m[4]) : lo
    for (let i = lo; i <= Math.max(lo, hi); i++) out.push(`${Number(m[1])}:${Number(m[2])}.${i}`)
  }
  return out
}

// ---------- prose ----------
const norm = (s) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\\(["'`])/g, '$1').replace(/\*/g, '').replace(/\s+/g, ' ')

// Sentences with line and paragraph-block numbers. Frontmatter, code fences, headings and rules
// are skipped. Data files (.ts) are read as prose too: their strings are the card text shown.
// Data files (.ts, .json): every string literal is its own paragraph, in order, so a card's
// text is read apart from its code, and a short citation string such as '78:5.7' sits right
// after the text it cites.
function dataBlocks(text) {
  const out = []
  const lineAt = (i) => text.slice(0, i).split('\n').length
  for (const m of text.matchAll(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g)) {
    const body = m[0].slice(1, -1)
    const cite = /\d{1,3}:\d{1,2}/.test(body)
    if (!cite && (body.length < 40 || /^[\w./#@-]*$/.test(body))) continue
    let offset = 0
    for (const para of body.split(/\n\s*\n/)) {
      out.push({ text: para, line: lineAt(m.index + 1 + offset) })
      offset += para.length + 2
    }
  }
  return out
}

function sentences(text, { data = false } = {}) {
  if (data) {
    const out = []
    dataBlocks(text).forEach((b, block) => out.push(...splitSentences(b.text, b.line).map((x) => ({ ...x, block }))))
    return out
  }
  const lines = text.split(/\r?\n/)
  let inFront = lines[0] === '---', inCode = false
  const out = []
  let buf = '', start = 0, block = 0
  const flush = () => { if (buf.trim()) out.push(...splitSentences(buf, start).map((x) => ({ ...x, block }))); buf = ''; block++ }
  lines.forEach((line, i) => {
    if (inFront) { if (i > 0 && line.trim() === '---') inFront = false; return }
    if (/^\s*```/.test(line)) { inCode = !inCode; flush(); return }
    if (inCode) return
    if (!line.trim() || /^\s*(#{1,6}\s|-{3,}\s*$|\*{3,}\s*$)/.test(line)) { flush(); return }
    if (!buf) start = i + 1
    buf += (buf ? ' ' : '') + line
  })
  flush()
  return out
}
function splitSentences(block, line) {
  const parts = []
  let cur = '', inQ = false
  const s = norm(block)
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    cur += c
    if (c === '"') inQ = !inQ
    if (!inQ && /[.!?]/.test(c) && /\s/.test(s[i + 1] || ' ') && !/\b(B\.C|A\.D|c|ca|e\.g|i\.e|et al|vs|St|Dr|Mr|No|pp?)\.$/i.test(cur) && !/\b[A-Z]\.$/.test(cur)) {
      parts.push(cur.trim()); cur = ''
    }
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts.map((text) => ({ text, line }))
}

function isBookClaim(sentence) {
  const bare = sentence.replace(/\((?:UB\s*)?\d{1,3}:[^)]*\)/g, ' ').replace(/"[^"]*"/g, '"…"')
  if (OWN.test(bare)) return true
  const m = bare.match(SUBJECT)
  if (!m) return false
  return VERB.test(bare.slice(m.index, m.index + 140))
}

// ---------- the check ----------
function makeFlat(corpus) { return norm([...corpus.values()].join('\n')).toLowerCase() }

function checkText(text, { corpus, allow = {}, flat = makeFlat(corpus), data = false }) {
  const findings = []
  const sents = sentences(text, { data })
  const allowed = (s) => Object.entries(allow).some(([k, why]) => typeof why === 'string' && why.trim().length >= MIN_REASON && s.startsWith(k.slice(0, 60)))
  const blockText = new Map()
  for (const s of sents) blockText.set(s.block, (blockText.get(s.block) || '') + ' ' + s.text)
  const blocks = [...blockText.keys()]
  const nextBlock = (b, k = 1) => blockText.get(blocks[blocks.indexOf(b) + k]) || ''
  for (const s of sents) {
    if (allowed(s.text)) continue
    const own = refsIn(s.text)
    // A lead-in ("The book identifies the substrate.") is backed by the quotation it introduces,
    // which may sit one paragraph further down ("The statement is direct:" then the quote).
    const contextRefs = refsIn((blockText.get(s.block) || '') + ' ' + nextBlock(s.block) + ' ' + nextBlock(s.block, 2))
    const mine = OURS.test(s.text)
    if (isBookClaim(s.text)) {
      const absence = ABSENCE.test(s.text.replace(/"[^"]*"/g, ''))
      if (!own.length && !contextRefs.length && !absence && !mine) {
        findings.push({ kind: 'C1 UNCITED', line: s.line, text: s.text, detail: 'credits the book, but no paragraph is cited in it, its paragraph or the next' })
      }
      if (!mine) {
        const refs = own.length ? own : contextRefs
        const have = new Set()
        for (const r of refs) for (const n of numbersIn(corpus.get(r) || '')) have.add(n)
        const missing = [...bookClauseNumbers(s.text)].filter((n) => !have.has(n))
        if (missing.length) {
          findings.push({ kind: 'C2 NUMBER', line: s.line, text: s.text, detail: refs.length
            ? `${missing.join(', ')} not in ${[...new Set(refs)].slice(0, 6).join(', ')}; quote the book's figure, or mark the figure as ours`
            : `${missing.join(', ')} credited to the book with no citation to check it against` })
        }
      }
    }
    for (const m of s.text.matchAll(/"([^"]{20,})"(.{0,40})/g)) {
      if (m[1].trim().split(/\s+/).length < 6) continue
      if (own.length || /^\s*\(?\s*(UB\s*)?\d{1,3}:\d/.test(m[2])) continue
      const nb = nextBlock(s.block)
      if (/^\s*\(?\s*(UB\s*)?\d{1,3}:\d/.test(nb) || /citation\s*:\s*['"`]\s*\d/.test(nb.slice(0, 300)) || /citation\s*:\s*['"`]\s*\d/.test(m[2])) continue
      const needle = m[1].toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:!?]+$/, '').trim()
      if (needle.length >= 25 && flat.includes(needle)) {
        findings.push({ kind: 'C3 BOOK WORDS', line: s.line, text: s.text, detail: `the book's words "${m[1].slice(0, 70)}${m[1].length > 70 ? '...' : ''}" with no paragraph citation` })
      }
    }
  }
  return findings
}


let corpusCache = null;
function loadCorpus() {
  if (corpusCache) return corpusCache;
  corpusCache = new Map();
  if (!fs.existsSync(PAPERS_DIR)) return corpusCache;
  for (const f of fs.readdirSync(PAPERS_DIR).sort()) {
    if (!/^Doc\d{3}\.json$/.test(f)) continue;
    const d = JSON.parse(fs.readFileSync(path.join(PAPERS_DIR, f), 'utf8'));
    for (const s of d.sections || []) for (const p of s.pars || []) {
      if (p.par_ref) corpusCache.set(p.par_ref, String(p.par_content || '').replace(/<[^>]+>/g, ''));
    }
  }
  return corpusCache;
}

let flatCache = null;
function checkDraft(text, { allow = {}, data = false } = {}) {
  const corpus = loadCorpus();
  if (!flatCache) flatCache = makeFlat(corpus);
  return checkText(text, { corpus, allow, flat: flatCache, data });
}

function selfTest() {
  if (!loadCorpus().size) { console.error('self-test: source files missing; run node fetch-data.js'); return 2; }
  let bad = 0;
  const ok = (cond, label) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) bad++; };
  const kinds = (f) => f.map((x) => x.kind);
  ok(wordsToNumber('eighty-five thousand') === 85000 && wordsToNumber('half a million') === 500000, 'the book\'s number words are read as figures');
  ok(kinds(checkDraft("The UB's dating (late Andite migrations, c. 6000-2000 BCE) comes from 78:5.7.")).includes('C2 NUMBER'), 'a date the cited paragraph does not give is caught (6000-2000 BCE against 78:5.7)');
  ok(checkDraft('The book says the red race crossed about 85,000 years ago (64:6.5).').length === 0, 'a figure the paragraph states in words passes (85,000 against "eighty-five thousand", 64:6.5)');
  ok(checkDraft('The book says they reached South America (78:5.7), but the settlement of Rapa Nui is estimated at AD 1150 to 1280 (Moreno-Mayar et al. 2024).').length === 0, 'a study\'s figure in a "but" clause is not charged to the book');
  ok(kinds(checkDraft('The Urantia Book describes Andite teaching in Tibet.\n\nMore of our own prose.')).join() === 'C1 UNCITED', 'a claim about the book with no citation nearby is caught');
  ok(checkDraft('The book never names the Maya.').length === 0, 'a claim of absence is left to ub-recall.js');
  ok(kinds(checkDraft('He wrote that "embarking in a fleet of small boats from Japan, eventually reached South America" long ago.')).join() === 'C3 BOOK WORDS', 'the book\'s words with no citation are caught');
  ok(checkDraft('He wrote that "embarking in a fleet of small boats from Japan, eventually reached South America" (78:5.7).').length === 0, 'the same words with their citation pass');
  console.log(bad ? `\n${bad} self-test case(s) FAILED` : '\nAll self-test cases passed');
  return bad ? 1 : 0;
}

module.exports = { checkDraft, wordsToNumber, numbersIn, isBookClaim, MIN_REASON };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) process.exit(selfTest());
  if (!loadCorpus().size) { console.error('No book text found. Run: node fetch-data.js'); process.exit(3); }
  const ai = args.indexOf('--allow');
  const allow = ai >= 0 ? (JSON.parse(fs.readFileSync(args[ai + 1], 'utf8')).allow || {}) : {};
  const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--allow');
  if (!files.length) { console.log('usage: node ub-claims.js draft.md [--allow allow.json] | --self-test'); process.exit(1); }
  let n = 0;
  for (const f of files) {
    const found = checkDraft(fs.readFileSync(f, 'utf8'), { allow, data: /\.(ts|js|json)$/.test(f) });
    if (!found.length) { console.log(`OK      ${f}`); continue; }
    n += found.length;
    console.log(`CLAIMS  ${f}: ${found.length}`);
    for (const x of found) console.log(`  line ${x.line}  ${x.kind}: ${x.detail}\n    "${x.text.slice(0, 160)}${x.text.length > 160 ? '...' : ''}"`);
  }
  if (n) { console.log(`\n${n} finding(s). Cite the paragraph, quote the book's own figure, mark a figure as ours, or record why in --allow.`); process.exit(1); }
  console.log('\nCLAIMS PASS');
}
