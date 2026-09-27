#!/usr/bin/env node
/**
 * ub-recall.js -- before you say what The Urantia Book says about a place, read all of it.
 *
 * ub-verify.js proves PRECISION: every quote in a draft is the book's exact wording. It cannot
 * prove RECALL: that you read everything the book says on the subject. A draft can quote
 * perfectly and still leave out the paragraph that changes the answer. At the Urantia Book
 * Network (urantiabooknetwork.com) two articles on the Maya passed every quote check while
 * saying the book "counts against" an outside link to Mesoamerica; nobody had searched
 * "Central America", and 64:7.5 and 79:5.8 name the mixed race that founded those civilizations.
 * Modern names make it worse: the book never says "Maya", "Aztec" or "Polynesia's Maori".
 *
 * ub-recall-places.json maps the names writers use to the names the book uses.
 *
 * usage:
 *   node ub-recall.js Maya                   every paragraph on the place (book names resolved)
 *   node ub-recall.js "Central America" Peru several at once
 *   node ub-recall.js --check draft.md       which of those paragraphs the draft neither cites
 *                                            nor records as read (exit 1 if any)
 *   node ub-recall.js --check draft.md --read read.json
 *        read.json = { "reviewed": { "64:6.5": "why it does not change the claim", "94": "whole paper, why" } }
 *   --all-papers   include Papers 57-61 (geology, skipped by default and said so)
 *   node ub-recall.js --self-test
 *
 * A draft TRIGGERS a place when the place is its subject (title or heading, or 3 or more
 * sentences that speak of the book name it) or when one such sentence makes a limiting
 * claim about it: never, not, no, only, nothing, none, without, counts against.
 * Nothing is sent anywhere; the book text comes from fetch-data.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PAPERS_DIR = path.join(__dirname, 'source-texts', 'papers');
const PLACES_FILE = path.join(__dirname, 'ub-recall-places.json');
const MIN_REASON = 20;
const CITE = /\b(\d{1,3}):(\d{1,2})\.(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\b/g;
const BOOKISH = /\b(the (Urantia )?book|book's|Urantia|UB|revelators?|Papers? \d{1,3})\b|\b\d{1,3}:\d{1,2}\.\d{1,3}\b/i;
const LIMITING = /\b(never|not|no|nothing|only|none|neither|nor|without|counts? against|silent|absent)\b|n't\b/i;

let corpusCache = null;
function corpus() {
  if (corpusCache) return corpusCache;
  corpusCache = [];
  if (!fs.existsSync(PAPERS_DIR)) return corpusCache;
  for (const f of fs.readdirSync(PAPERS_DIR).sort()) {
    if (!/^Doc\d{3}\.json$/.test(f)) continue;
    const d = JSON.parse(fs.readFileSync(path.join(PAPERS_DIR, f), 'utf8'));
    for (const s of d.sections || []) for (const p of s.pars || []) {
      if (p.par_ref) corpusCache.push({ ref: p.par_ref, text: String(p.par_content || '').replace(/<[^>]+>/g, '') });
    }
  }
  return corpusCache;
}

function places() {
  const j = JSON.parse(fs.readFileSync(PLACES_FILE, 'utf8'));
  return {
    skip: new Set((j.skipPapers && j.skipPapers.papers || []).map(Number)),
    groups: j.groups.map((g) => ({ id: g.id, article: new RegExp(g.article, g.articleFlags ?? 'i'), book: new RegExp(g.book, g.bookFlags ?? 'i') })),
  };
}

// A name the writer typed -> the book patterns to search. Known places resolve through the
// list; anything else is searched as a whole word, and that is said.
function resolve(term, P = places()) {
  const hits = P.groups.filter((g) => g.article.test(term) || g.book.test(term));
  if (hits.length) return hits.map((g) => ({ id: g.id, book: g.book }));
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [{ id: `"${term}" (not in the places list; searched as a whole word)`, book: new RegExp(`\\b${esc}\\b`, 'i') }];
}

function paragraphsFor(groups, { allPapers = false, skip = places().skip } = {}) {
  const out = new Map();
  for (const g of groups) for (const p of corpus()) {
    if (!allPapers && skip.has(Number(p.ref.split(':')[0]))) continue;
    if (g.book.test(p.text)) out.set(p.ref, { ...p, groups: [...((out.get(p.ref) || {}).groups || []), g.id] });
  }
  return [...out.values()];
}

function citedRefs(text) {
  const out = new Set();
  for (const m of text.matchAll(CITE)) {
    const lo = Number(m[3]), hi = m[4] ? Number(m[4]) : lo;
    for (let i = lo; i <= Math.max(lo, hi); i++) out.add(`${Number(m[1])}:${Number(m[2])}.${i}`);
  }
  return out;
}

function subjectOf(text) {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const front = fm ? fm[1].split(/\r?\n/).filter((l) => /^(title|excerpt|description|tags)\s*:/i.test(l)).join('\n') : '';
  const headings = text.split(/\r?\n/).filter((l) => /^#{1,3}\s/.test(l)).join('\n');
  return front + '\n' + headings;
}

function bookSentences(text) {
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
  const lines = body.split(/\r?\n/).filter((l) => !/^\s*>/.test(l) && !/^#{1,6}\s/.test(l));
  return lines.join('\n').split(/(?<=[.!?])\s+|\n{2,}/).filter((s) => BOOKISH.test(s));
}

function triggers(text, P = places()) {
  const subject = subjectOf(text), sentences = bookSentences(text), why = new Map();
  for (const g of P.groups) {
    const named = sentences.filter((s) => g.article.test(s));
    if (g.article.test(subject)) why.set(g.id, 'the draft is about it (title or heading)');
    else if (named.length >= 3) why.set(g.id, `${named.length} sentences about the book name it`);
    else {
      const lim = named.find((s) => LIMITING.test(s));
      if (lim) why.set(g.id, `limiting claim: "${lim.replace(/\s+/g, ' ').trim().slice(0, 100)}"`);
    }
  }
  return why;
}

function covers(key, ref) {
  const paper = Number(ref.split(':')[0]);
  if (/^\d+$/.test(key)) return Number(key) === paper;
  const r = key.match(/^(\d+)-(\d+)$/);
  return r ? paper >= Number(r[1]) && paper <= Number(r[2]) : key === ref;
}

function checkText(text, { read = {}, terms = null, allPapers = false } = {}) {
  const P = places();
  let groups, why;
  if (terms && terms.length) {
    groups = terms.flatMap((t) => resolve(t, P));
    why = new Map(groups.map((g) => [g.id, 'named with --terms']));
  } else {
    why = triggers(text, P);
    groups = P.groups.filter((g) => why.has(g.id));
  }
  const cited = citedRefs(text);
  const reviewed = read.reviewed || {};
  const weak = Object.keys(reviewed).filter((k) => typeof reviewed[k] !== 'string' || reviewed[k].trim().length < MIN_REASON);
  const good = Object.keys(reviewed).filter((k) => !weak.includes(k));
  const required = paragraphsFor(groups, { allPapers, skip: P.skip });
  const unread = required.filter((p) => !cited.has(p.ref) && !good.some((k) => covers(k, p.ref)));
  return { why, required: required.length, unread, weak };
}

// The sentence of a paragraph that holds the match, to find it by; quote from ub_get_paragraphs.
function excerpt(text, groups) {
  const sents = text.split(/(?<=[.!?])\s+/);
  const s = sents.find((x) => groups.some((g) => g.book.test(x))) || sents[0];
  return s.length > 220 ? s.slice(0, 217) + '...' : s;
}

function selfTest() {
  if (!corpus().length) { console.error('self-test: source files missing; run node fetch-data.js'); return 2; }
  let bad = 0;
  const ok = (cond, label) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) bad++; };
  const maya = resolve('Maya');
  ok(maya.some((g) => g.id === 'mexico-central-america'), 'the modern name "Maya" resolves to the book\'s "Mexico" and "Central America"');
  const refs = paragraphsFor(maya).map((p) => p.ref);
  ok(refs.includes('64:7.5') && refs.includes('79:5.8'), 'a search on "Maya" returns 64:7.5 and 79:5.8, the founders of those civilizations');
  const draft = '# The Maya world tree\n\nThe book places the only Andite trace in Peru (79:5.9), not among the Maya.\n';
  const r = checkText(draft);
  ok(r.unread.some((p) => p.ref === '64:7.5'), 'the 2026-09-27 failure is caught: a Maya draft citing only 79:5.9 is told to read 64:7.5');
  const passing = '# Trees\n\nThe Maya carved trees. The book speaks of the tree of life (85:2.4).\n';
  ok(checkText(passing).why.size === 0, 'a passing mention in a draft about something else triggers nothing');
  const all = r.unread.map((p) => p.ref); // Maya and, from the limiting claim, Peru
  const read = { reviewed: Object.fromEntries(all.map((ref) => [ref, 'read in full; recorded for the self-test'])) };
  ok(checkText(draft, { read }).unread.length === 0, 'recording every paragraph as read, with reasons, clears the draft');
  ok(checkText(draft, { read: { reviewed: { 64: 'n/a' } } }).weak.includes('64'), `a reason under ${MIN_REASON} characters does not count`);
  ok(!paragraphsFor(maya).some((p) => p.ref.startsWith('59:')), 'Paper 59 (geology) is skipped by default');
  console.log(bad ? `\n${bad} self-test case(s) FAILED` : '\nAll self-test cases passed');
  return bad ? 1 : 0;
}

module.exports = { resolve, paragraphsFor, checkText, triggers, citedRefs, excerpt, MIN_REASON };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) process.exit(selfTest());
  if (!corpus().length) { console.error('No book text found. Run: node fetch-data.js'); process.exit(3); }
  const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
  const allPapers = args.includes('--all-papers');
  const skipNote = allPapers ? '' : ' (Papers 57-61, geology, skipped; --all-papers to include)';
  const draftPath = val('--check');
  if (draftPath) {
    const read = val('--read') ? JSON.parse(fs.readFileSync(val('--read'), 'utf8')) : {};
    const terms = val('--terms') ? val('--terms').split(',').map((s) => s.trim()).filter(Boolean) : null;
    const r = checkText(fs.readFileSync(draftPath, 'utf8'), { read, terms, allPapers });
    if (!r.why.size) { console.log('No listed place is the subject of this draft or under a limiting claim. Use --terms to name places.'); process.exit(0); }
    for (const [id, w] of r.why) console.log(`  ${id}: ${w}`);
    if (r.weak.length) console.log(`  reasons under ${MIN_REASON} characters (not counted): ${r.weak.join(', ')}`);
    if (!r.unread.length) { console.log(`\nRECALL PASS: all ${r.required} paragraphs cited or recorded as read${skipNote}`); process.exit(0); }
    console.log(`\n${r.unread.length} of ${r.required} paragraphs neither cited nor recorded as read${skipNote}:\n`);
    for (const p of r.unread) console.log(`  ${p.ref.padEnd(9)} ${excerpt(p.text, places().groups.filter((g) => p.groups.includes(g.id)))}`);
    console.log('\nRead each in full (node ub-search.js --ref <ref>), then cite it or record why it does not change the claim in a --read file.');
    process.exit(1);
  }
  const terms = args.filter((a, i) => !a.startsWith('--') && !['--read', '--terms', '--check'].includes(args[i - 1]));
  if (!terms.length) { console.log('usage: node ub-recall.js <place> [...] | --check draft.md [--read read.json] [--terms a,b] | --self-test'); process.exit(1); }
  const groups = terms.flatMap((t) => resolve(t));
  const pars = paragraphsFor(groups, { allPapers });
  console.log(`Searched: ${groups.map((g) => g.id + ' ' + g.book).join('; ')}${skipNote}`);
  console.log(`${pars.length} paragraphs. Read every one before saying what the book says, or does not say, about it.\n`);
  for (const p of pars) console.log(`  ${p.ref.padEnd(9)} ${excerpt(p.text, groups)}`);
  console.log('\nExcerpts are for finding; quote only the full text from node ub-search.js --ref <ref>.');
}
