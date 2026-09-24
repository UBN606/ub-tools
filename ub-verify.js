#!/usr/bin/env node
/**
 * UB Verify — checks a draft against The Urantia Book before it ships.
 *
 * Usage:
 *   node ub-verify.js <file> [more files]        check drafts (md, mdx, txt, tsx, html, json)
 *   node ub-verify.js <file> --quotes-only       skip the dash check
 *   node ub-verify.js <file> --json              machine-readable report
 *   node ub-verify.js --self-test                prove the checker catches known failure types
 *
 * What it checks:
 *   1. Every quotation followed by a UB citation, e.g. "text" (180:2.1) or > "text" (180:2.1-3),
 *      is compared word for word against the cited paragraph(s).
 *        PASS         exact (straight vs curly quote marks are treated as the same)
 *        PUNCTUATION  same words, different punctuation, e.g. the book's em dash turned into a comma
 *        MISMATCH     words added, dropped or changed (shows the difference)
 *        NOT FOUND    the cited paragraph does not exist
 *      An ellipsis (... or …) inside a quote means "words skipped"; each piece must appear in order.
 *      [Square brackets] inside a quote are treated as an editorial insertion and skipped.
 *   2. Em dashes, en dashes, &mdash;/&ndash; and " -- " in OUR words (everything outside UB quotes).
 *      Dashes inside verbatim UB quotes are the book's own and are allowed. (The dash rule is Urantia Book Network house style; use --quotes-only to skip it.)
 *
 * Exit code 0 = clean, 1 = something needs fixing, 2 = usage/file error.
 * It never edits the draft.
 */

const fs = require('fs');
const path = require('path');

const PAPERS_DIR = path.join(__dirname, 'source-texts', 'papers');

// ---------- source text ----------
const paperCache = new Map();
function getParagraph(ref) {
  const m = ref.match(/^(\d+):(\d+)\.(\d+)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!paperCache.has(n)) {
    const file = path.join(PAPERS_DIR, `Doc${String(n).padStart(3, '0')}.json`);
    const map = new Map();
    if (fs.existsSync(file)) {
      const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const s of doc.sections) for (const p of s.pars) map.set(p.par_ref, p.par_content);
    }
    paperCache.set(n, map);
  }
  return paperCache.get(n).get(ref) || null;
}

// "180:2.1-3", "180:2.1–2.3", "180:2.1 through 180:2.3", "180:2.1, 180:2.4", "180:2.1; 2.4"
function expandCitation(inner) {
  const refs = [];
  const re = /(\d+):(\d+)\.(\d+)(?:\s*(?:-|–|—|through|to)\s*(?:(\d+):)?(?:(\d+)\.)?(\d+))?/g;
  let m;
  while ((m = re.exec(inner))) {
    const [, p, s, a, p2, s2, b] = m;
    if (b === undefined) { refs.push(`${p}:${s}.${a}`); continue; }
    if ((p2 && p2 !== p) || (s2 && s2 !== s)) { refs.push(`${p}:${s}.${a}`, `${p2 || p}:${s2 || s}.${b}`); continue; }
    const lo = parseInt(a, 10), hi = parseInt(b, 10);
    if (hi < lo || hi - lo > 40) { refs.push(`${p}:${s}.${a}`); continue; }
    for (let i = lo; i <= hi; i++) refs.push(`${p}:${s}.${i}`);
  }
  return [...new Set(refs)];
}

// ---------- normalizing ----------
const QUOTES = /[“”„‟"‘’‚‛'`´]/g;
function foldQuotes(s) { return s.replace(QUOTES, ''); }
function squash(s) { return s.replace(/\s+/g, ' ').trim(); }
function stripMarkup(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&rsquo;|&lsquo;/g, '’')
    .replace(/&rdquo;|&ldquo;|&quot;/g, '"').replace(/[*_]{1,3}/g, '')
    .replace(/^\s*>\s?/gm, ' ');
}
// exact form: only quote marks and spacing are ignored
function exactForm(s) { return squash(foldQuotes(s)); }
// words form: punctuation and case ignored
function words(s) {
  return foldQuotes(s).toLowerCase().replace(/[—–-]/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
}

// Paper and section titles ("Development of the State", "Discussion at the Olive Press") are
// verbatim book text but not paragraph text, so a quoted title is not checked against a paragraph.
let titleSet = null;
function isTitle(body) {
  if (!titleSet) {
    titleSet = new Set();
    for (const f of fs.readdirSync(PAPERS_DIR).filter(n => /^Doc\d{3}\.json$/.test(n))) {
      const doc = JSON.parse(fs.readFileSync(path.join(PAPERS_DIR, f), 'utf8'));
      if (doc.paper_title) titleSet.add(words(doc.paper_title).join(' '));
      for (const s of doc.sections) if (s.section_title) titleSet.add(words(s.section_title.replace(/^\d+\.\s*/, '')).join(' '));
    }
  }
  return titleSet.has(words(body).join(' '));
}

// ---------- extraction ----------
// Works one paragraph at a time (blank-line separated), never inside frontmatter.
// Quote marks are paired in order within the paragraph: “ opens, ” closes, a straight " toggles.
// A citation "(P:S.P)" claims the quotation that ends just before it, plus earlier quoted pieces
// in the same paragraph that are separated from it only by a short stretch of our own words
// (e.g. "an evolutionary world becomes thus ripe" does "one of the high order" make "his appearance" (52:4.2)).
const CITE = /\(([^()]*?\d+:\d+\.\d+[^()]*?)\)/g;
const HAS_CITE = /\([^()]*\d+:\d+\.\d+/; // non-global, safe to reuse
const GLUE_MAX = 80; // max chars of our own words between two pieces of one cited quotation

function lineOf(text, index) { return text.slice(0, index).split('\n').length; }

function frontmatterEnd(raw) {
  const m = raw.match(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/);
  return m ? m[0].length : 0;
}

function quoteSpans(text, offset) {
  // A straight-quoted UB quotation may contain the book's own curly inner quotes (“briny deep.”),
  // and a curly one may nest another curly pair; only the matching outer mark closes the span.
  const spans = [];
  let open = -1, depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (open < 0) {
      if (ch === '“' || ch === '"') { open = i; depth = 0; }
      continue;
    }
    if (text[open] === '"') {
      if (ch === '"') { spans.push([open, i]); open = -1; }
    } else if (ch === '“') depth++;
    else if (ch === '”') {
      if (depth > 0) depth--; else { spans.push([open, i]); open = -1; }
    }
  }
  return spans.map(([a, b]) => ({ start: offset + a, end: offset + b + 1, body: text.slice(a + 1, b) }));
}

function extractQuotes(raw) {
  const out = [];
  const fm = frontmatterEnd(raw);
  const paraRe = /(?:[^\n]|\n(?![ \t]*\r?\n))+/g;
  paraRe.lastIndex = fm;
  let p;
  while ((p = paraRe.exec(raw))) {
    const text = p[0], off = p.index;
    const spans = quoteSpans(text, off);
    if (!spans.length) continue;
    CITE.lastIndex = 0;
    let c, prevCiteEnd = off;
    while ((c = CITE.exec(text))) {
      const citeStart = off + c.index;
      // the quotation that closes just before this citation (allow italics, a comma/period, a dash)
      let k = spans.length - 1;
      while (k >= 0 && spans[k].end > citeStart) k--;
      if (k < 0) { prevCiteEnd = citeStart + c[0].length; continue; }
      // The citation may sit right after the quote, or later in the same sentence:
      // "...nothing potentially idolatrous" be left on the planet (120:3.7). Our words in between
      // are allowed up to GLUE_MAX*2 chars, with no sentence break and no other citation.
      const between = raw.slice(spans[k].end, citeStart);
      const tight = /^[\s*_,.;:!?—–-]{0,6}(?:<[^>]+>\s*)?$/.test(between);
      const sameSentence = between.length <= GLUE_MAX * 2 && !HAS_CITE.test(between) && !/[.!?]\s+[A-Z]/.test(between) && !(/[.!?]\s*$/.test(spans[k].body) && /^\s*[A-Z]/.test(between));
      if (!(tight || sameSentence) || spans[k].start < prevCiteEnd) { prevCiteEnd = citeStart + c[0].length; continue; }
      const pieces = [spans[k]];
      for (let j = k - 1; j >= 0; j--) {
        const gap = raw.slice(spans[j].end, pieces[0].start);
        // a new sentence between two pieces means they are separate quotations; the period often sits
        // inside the earlier quote ("...for an age." And Michael ... "to intern...")
        const sentenceBreak = /[.!?]\s+[A-Z]/.test(gap) || (/[.!?]\s*$/.test(spans[j].body) && /^\s*[A-Z]/.test(gap));
        if (spans[j].start < prevCiteEnd || gap.length > GLUE_MAX || HAS_CITE.test(gap) || sentenceBreak) break;
        pieces.unshift(spans[j]);
      }
      const refs = expandCitation(c[1]);
      for (const s of pieces) {
        if (words(s.body).length < 2) continue; // single words in quotes are terms, not quotations
        if (/\|/.test(s.body)) continue;          // a quote mark caught across table cells
        if (!/\p{L}/u.test(s.body)) continue;      // numbers only (map coordinates, data), not text
        // Linked loosely (citation later in the sentence), short quoted bits are usually terms or
        // titles ("at hand", "a fairy tale"), not quotations; require 4+ words there.
        if (!tight && words(s.body).length < 4) continue;
        if (isTitle(s.body)) continue;             // paper or section titles quoted by name
        out.push({ quoteStart: s.start, quoteEnd: s.end, body: s.body, citation: c[1], refs, line: lineOf(raw, s.start) });
      }
      prevCiteEnd = citeStart + c[0].length;
    }
  }
  return out;
}

// ---------- comparison ----------
function lcsAlign(a, b) {
  // a = quote words, b = source words; returns matched index pairs
  const n = a.length, m = b.length;
  if (n * m > 4e6) return null;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return pairs;
}

function describeWordDiff(qWords, sWords) {
  const pairs = lcsAlign(qWords, sWords);
  if (!pairs || !pairs.length) return { summary: 'no overlap with the cited paragraph; the quote may be invented or cite the wrong paragraph', changes: [] };
  const changes = [];
  let qi = 0, si = pairs[0][1];
  for (const [qa, sa] of [...pairs, [qWords.length, pairs[pairs.length - 1][1] + 1]]) {
    const added = qWords.slice(qi, qa), dropped = sWords.slice(si, sa);
    if (added.length || dropped.length) changes.push({ quoteSays: added.join(' ') || '(nothing)', bookSays: dropped.join(' ') || '(nothing)' });
    qi = qa + 1; si = sa + 1;
  }
  const matched = pairs.length / qWords.length;
  return { summary: `${Math.round(matched * 100)}% of the quote's words match the cited text`, changes: changes.slice(0, 8) };
}

function checkQuote(q) {
  const missing = q.refs.filter(r => !getParagraph(r));
  if (!q.refs.length || missing.length === q.refs.length) {
    const where = findElsewhere([stripMarkup(q.body)]);
    return { status: 'NOT FOUND', detail: `cited paragraph does not exist: ${missing.join(', ') || q.citation}${where.length ? `. The quoted words appear verbatim at ${where.join(', ')}.` : ''}`, foundAt: where };
  }
  // the source JSON carries markup (<sup>th</sup>, <em>) and footnote asterisks; compare text only
  const source = stripMarkup(q.refs.map(getParagraph).filter(Boolean).join(' ')).replace(/\*/g, '');
  const pieces = stripMarkup(q.body).split(/\.\.\.|…|\[[^\]]*\]/).map(s => s.trim()).filter(s => words(s).length);
  if (!pieces.length) return { status: 'PASS', detail: 'empty after removing ellipses' };

  const srcExact = exactForm(source);
  const srcWordsStr = ' ' + words(source).join(' ') + ' ';
  let exact = true, wordsOk = true, from = 0, wfrom = 0;
  const punct = [];
  for (const piece of pieces) {
    // trim leading/trailing punctuation left by ellipsis splits
    // Standard quoting fits a quote into our sentence: the first letter's case and the closing
    // punctuation may change ("Judgment in such..." quoted as "judgment in such...", "him." as "him,").
    // Words, inner punctuation and the book's dashes must still match exactly.
    const pe = exactForm(piece).replace(/^[\s,;:.!?—–-]+|[\s,;:.!?—–-]+$/g, '');
    const swap = pe ? (pe[0] === pe[0].toLowerCase() ? pe[0].toUpperCase() : pe[0].toLowerCase()) + pe.slice(1) : pe;
    let idx = srcExact.indexOf(pe, from);
    if (idx < 0) idx = srcExact.indexOf(swap, from);
    if (idx >= 0) { from = idx + pe.length; } else exact = false;
    const pw = ' ' + words(piece).join(' ') + ' ';
    const widx = srcWordsStr.indexOf(pw, wfrom);
    if (widx >= 0) {
      wfrom = widx + pw.length - 1;
      if (idx < 0) punct.push(piece);
    } else wordsOk = false;
  }
  const note = missing.length ? ` (also cites missing paragraph ${missing.join(', ')})` : '';
  if (exact && !missing.length) return { status: 'PASS', detail: '' };
  if (exact) return { status: 'NOT FOUND', detail: `quote matches, but cites a paragraph that does not exist: ${missing.join(', ')}` };
  if (wordsOk) {
    // show the first point where the draft's punctuation departs from the book's
    const draftText = exactForm(punct[0] || '').replace(/^[\s,;:.!?—–-]+|[\s,;:.!?—–-]+$/g, '');
    const w = words(draftText);
    let draftAt = '', bookAt = '';
    if (w.length) {
      const re = new RegExp(w.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^\\p{L}\\p{N}]+'), 'iu');
      const mm = srcExact.match(re);
      if (mm) {
        const book = mm[0];
        let i = 0;
        while (i < book.length && i < draftText.length && book[i].toLowerCase() === draftText[i].toLowerCase()) i++;
        const from = Math.max(0, i - 40);
        draftAt = (from ? '...' : '') + draftText.slice(from, i + 40) + '...';
        bookAt = (from ? '...' : '') + book.slice(from, i + 40) + '...';
      }
    }
    return { status: 'PUNCTUATION', detail: `same words, different punctuation${note}. Restore the book's punctuation.\n      draft: ${draftAt || squash(punct[0] || '').slice(0, 120)}\n      book:  ${bookAt || '(see --ref)'}` };
  }
  const d = describeWordDiff(words(pieces.join(' ')), words(source));
  const where = findElsewhere(pieces);
  const hint = where.length ? ` The quoted words appear verbatim at ${where.join(', ')}; the citation may be wrong.` : '';
  return { status: 'MISMATCH', detail: `${d.summary}${note}.${hint}`, changes: where.length ? [] : d.changes, foundAt: where };
}

// Search the whole book for a quote's words (used when the cited paragraph does not match)
let bookIndex = null;
function findElsewhere(pieces) {
  if (!bookIndex) {
    bookIndex = [];
    for (const f of fs.readdirSync(PAPERS_DIR).filter(n => /^Doc\d{3}\.json$/.test(n))) {
      const doc = JSON.parse(fs.readFileSync(path.join(PAPERS_DIR, f), 'utf8'));
      for (const s of doc.sections) for (const p of s.pars) bookIndex.push([p.par_ref, ' ' + words(stripMarkup(p.par_content).replace(/\*/g, '')).join(' ') + ' ']);
    }
  }
  const longest = pieces.map(p => words(p)).sort((a, b) => b.length - a.length)[0] || [];
  if (longest.length < 4) return [];
  const needle = ' ' + longest.join(' ') + ' ';
  return bookIndex.filter(([, t]) => t.includes(needle)).map(([r]) => r).slice(0, 5);
}

// ---------- dash check (our own words) ----------
function dashCheck(raw) {
  // Text inside quotation marks in the body is never our own words (UB or anyone else), so those
  // spans are blanked out. Frontmatter is NOT masked: its quoted values (title, excerpt) are our words.
  let masked = raw;
  const fm = frontmatterEnd(raw);
  const paraRe = /(?:[^\n]|\n(?![ \t]*\r?\n))+/g;
  paraRe.lastIndex = fm;
  let p;
  while ((p = paraRe.exec(raw))) {
    for (const s of quoteSpans(p[0], p.index)) masked = masked.slice(0, s.start) + ' '.repeat(s.end - s.start) + masked.slice(s.end);
  }
  // blank out fenced code, URLs and the machine lines of frontmatter-free code
  masked = masked.replace(/```[\s\S]*?```/g, m => m.replace(/[^\n]/g, ' ')).replace(/https?:\/\/\S+/g, m => ' '.repeat(m.length));
  const hits = [];
  const re = /—|–|&mdash;|&ndash;|&#8212;|&#8211;|\s--\s/g;
  let m;
  while ((m = re.exec(masked))) {
    const line = lineOf(masked, m.index);
    const lineText = raw.split('\n')[line - 1];
    hits.push({ line, mark: m[0].trim() || '--', text: squash(lineText).slice(0, 140) });
  }
  return hits;
}

// ---------- reporting ----------
function verifyText(raw, opts = {}) {
  const quotes = extractQuotes(raw);
  const results = quotes.map(q => ({ ...q, ...checkQuote(q) }));
  const dashes = opts.quotesOnly ? [] : dashCheck(raw);
  return { results, dashes };
}
function verifyFile(file, opts) {
  return { file, ...verifyText(fs.readFileSync(file, 'utf8'), opts) };
}

function printReport(rep) {
  const c = s => rep.results.filter(r => r.status === s).length;
  console.log(`\n=== ${rep.file}`);
  console.log(`UB quotes checked: ${rep.results.length} | PASS ${c('PASS')} | PUNCTUATION ${c('PUNCTUATION')} | MISMATCH ${c('MISMATCH')} | NOT FOUND ${c('NOT FOUND')}`);
  for (const r of rep.results) {
    if (r.status === 'PASS') continue;
    console.log(`\n  [${r.status}] line ${r.line} (${r.citation}): "${squash(r.body).slice(0, 110)}${r.body.length > 110 ? '...' : ''}"`);
    console.log(`      ${r.detail}`);
    for (const ch of r.changes || []) console.log(`      - draft says: ${ch.quoteSays}\n        book says:  ${ch.bookSays}`);
    if (r.status !== 'NOT FOUND') console.log(`      exact text: node ub-search.js --ref ${r.refs.join(' ')}`);
  }
  if (rep.dashes.length) {
    console.log(`\n  Dashes in our own words: ${rep.dashes.length}`);
    for (const d of rep.dashes.slice(0, 25)) console.log(`    line ${d.line} [${d.mark}]: ${d.text}`);
    if (rep.dashes.length > 25) console.log(`    ... and ${rep.dashes.length - 25} more`);
  } else if (!rep.quotesOnly) console.log('  Dashes in our own words: 0');
}

function failed(rep) { return rep.results.some(r => r.status !== 'PASS') || rep.dashes.length > 0; }

// ---------- self-test ----------
function selfTest() {
  const good = getParagraph('180:2.2');
  const vine = getParagraph('180:2.1');
  if (!good || !vine) { console.error('self-test: source files missing'); return 2; }
  const cases = [
    ['exact straight quotes', `"As the Father has loved me, so have I loved you." (180:2.2)`, 'PASS'],
    ['exact with ellipsis', `"I am the true vine, and my Father is the husbandman. ... Remember: I am the real vine, and you are the living branches." (180:2.1)`, 'PASS'],
    ['range citation', `"Then Jesus stood up again" ... "evermore abide in his love." (180:2.1-2)`, 'PASS'],
    ['em dash turned into comma', `"And when the world sees these fruit-bearing branches, my friends who love one another" (180:2.1)`, 'PUNCTUATION'],
    ['word substituted', `"As the Father has loved me, so have I cherished you." (180:2.2)`, 'MISMATCH'],
    ['word dropped ("unique")', `"always carry the name of this first and original Son of their order." (51:0.1)`, 'MISMATCH'],
    ['first letter lowercased, end comma (fitted to our sentence)', `"judgment in such matters belongs to the Ancients of Days, the rulers of the superuniverse," (53:1.2)`, 'PASS'],
    ['inner curly quotes inside a straight-quoted quote', `"did not bring against him an accusing judgment but simply said, ‘the Judge rebuke you.’" (53:1.2)`, 'PASS'],
    ['book markup and footnote asterisk', `"Thus was Urantia given the number 606 of Satania" (49:0.3)`, 'PASS'],
    ['invented quote', `"The Prince's schools were the world's first university." (66:5.6)`, 'MISMATCH'],
    ['missing paragraph', `"Anything at all" (180:2.99)`, 'NOT FOUND'],
    ['citation later in the sentence, word dropped', `The book warns against "stereotyped systems of religious beliefs" and more (120:3.7).`, 'MISMATCH'],
    ['citation later in the sentence, exact', `The book asks "that nothing potentially idolatrous is left on the planet" at his departure (120:3.7).`, 'PASS'],
  ];
  let bad = 0;
  for (const [name, text, want] of cases) {
    const q = extractQuotes(text);
    const got = q.length ? checkQuote(q[0]).status : 'NOT EXTRACTED';
    const ok = got === want;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: expected ${want}, got ${got}`);
  }
  const dashDoc = `---\ntitle: "Our title — with a dash"\n---\n\nOur sentence with no dash. "As the Father has loved me, so have I loved you. Live in my love even as I live in the Father’s love." (180:2.2) And "fruit-bearing branches—my friends who love one another" (180:2.1).`;
  const reps = extractQuotes(dashDoc).map(q => ({ ...q, ...checkQuote(q) }));
  const dh = dashCheck(dashDoc);
  const where = findElsewhere(['Gabriel came down from Salvington and bound the dragon']);
  const whereOk = where.includes('53:1.6');
  if (!whereOk) bad++;
  console.log(`${whereOk ? 'ok  ' : 'FAIL'} wrong citation: finds the quote's real paragraph (expected 53:1.6, got ${where.join(', ') || 'none'})`);
  const dashOk = dh.length === 1;
  if (!dashOk) bad++;
  console.log(`${dashOk ? 'ok  ' : 'FAIL'} dash in our words flagged, book's dash inside quote allowed: expected 1 flag, got ${dh.length}`);
  console.log(bad ? `\n${bad} self-test case(s) FAILED` : '\nAll self-test cases passed');
  return bad ? 1 : 0;
}

// ---------- main ----------
// Library use (for a separate, reviewed fix script): require('./ub-verify.js') runs nothing.
module.exports = { extractQuotes, checkQuote, getParagraph, stripMarkup, exactForm, words, verifyFile, verifyText, findElsewhere };
if (require.main !== module) return;
const args = process.argv.slice(2);
if (args.includes('--self-test')) process.exit(selfTest());
const opts = { quotesOnly: args.includes('--quotes-only'), json: args.includes('--json') };
const files = args.filter(a => !a.startsWith('--'));
if (!files.length) { console.error('Usage: node ub-verify.js <file> [more files] [--quotes-only] [--json] | --self-test'); process.exit(2); }
let anyFail = false, code = 0;
const reports = [];
for (const f of files) {
  if (!fs.existsSync(f)) { console.error(`File not found: ${f}`); code = 2; continue; }
  const rep = verifyFile(f, opts);
  rep.quotesOnly = opts.quotesOnly;
  reports.push(rep);
  if (failed(rep)) anyFail = true;
  if (!opts.json) printReport(rep);
}
if (opts.json) console.log(JSON.stringify(reports.map(r => ({ file: r.file, quotes: r.results.map(({ body, citation, refs, line, status, detail, changes }) => ({ line, citation, refs, status, detail, changes, quote: body })), dashes: r.dashes })), null, 2));
else console.log(anyFail ? '\nRESULT: FIX NEEDED before publishing' : '\nRESULT: CLEAN');
process.exit(code || (anyFail ? 1 : 0));
