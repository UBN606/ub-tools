#!/usr/bin/env node
/**
 * UB Full-Text Search — searches all 196 papers locally
 *
 * Usage:
 *   node ub-search.js "search term" [--paper 133] [--limit 20] [--context 1]
 *   node ub-search.js "gravitation light electricity" --paper 133
 *   node ub-search.js "Amadon" --limit 50
 *   node ub-search.js "violet race" --context 2
 *   node ub-search.js --ref 180:2.1 180:2.2   (exact, untruncated text for verbatim use)
 *
 * Matching is whole-word from the start of a word: "vine" finds vine/vines, never "divine".
 * Common words (the, and, of...) are not counted as terms, but still count in exact-phrase matches.
 *
 * Library use (ub-mcp.js): require('./ub-search.js') exports searchUB() and getParagraphs().
 */

const fs = require('fs');
const path = require('path');

const INDEX_FILE = path.join(__dirname, 'source-texts', 'ub-search-index.json');
const PAPERS_DIR = path.join(__dirname, 'source-texts', 'papers');

// Exact paragraph text (par_content) with its place in the book, never truncated
function getParagraphs(refs) {
  return refs.map(ref => {
    const m = String(ref).trim().match(/^(\d+):(\d+)\.(\d+)$/);
    if (!m) return { ref, error: 'Bad reference; use Paper:Section.Paragraph' };
    const file = path.join(PAPERS_DIR, `Doc${m[1].padStart(3, '0')}.json`);
    if (!fs.existsSync(file)) return { ref, error: 'Reference not found' };
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const s of doc.sections) {
      const par = s.pars.find(p => p.par_ref === ref.trim());
      if (par) return { ref: par.par_ref, page: par.par_pageref, paper: doc.paper_index, paperTitle: doc.paper_title,
        section: s.section_title || 'Introduction', author: doc.author, text: par.par_content };
    }
    return { ref, error: 'Reference not found' };
  });
}

let indexCache = null;
function searchUB({ query, paper = null, limit = 20, context = 0 }) {
  if (!indexCache) indexCache = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  const index = indexCache;

  // Build search terms (case-insensitive)
  const STOP = new Set('a an and are as at be but by for from had has have he his i in is it its not of on or our that the their them they this to was we were which who will with you your'.split(' '));
  const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exactPhrase = query.toLowerCase().trim().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  let terms = exactPhrase.split(/\s+/).map(t => t.replace(/[^\w'-]/g, '')).filter(t => t.length > 1 && !STOP.has(t));
  if (!terms.length) terms = exactPhrase.split(/\s+/).filter(Boolean);
  // Whole-word match from a word start: "vine" hits vine/vines/vineyard, not "divine"
  const termRes = terms.map(t => new RegExp('\\b' + escapeRe(t) + '\\w*', 'gi'));
  const phraseRe = new RegExp('\\b' + escapeRe(exactPhrase).replace(/\s+/g, '\\s+') + '\\b', 'i');

  const results = [];
  for (const p of index.papers) {
    if (paper !== null && paper !== undefined && p.paper_index !== paper) continue;
    for (const section of p.sections) {
      for (let pi = 0; pi < section.paragraphs.length; pi++) {
        const par = section.paragraphs[pi];
        // Fold curly quotes/apostrophes so a typed "Father's" matches the book's "Father’s" (display keeps the original)
        const textLower = par.text.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

        // Tiers: exact phrase 100, all terms 50, partial 10 per term; ties broken by occurrence count
        let score = 0;
        const counts = termRes.map(re => (textLower.match(re) || []).length);
        const matched = counts.filter(c => c > 0).length;
        const hits = counts.reduce((a, b) => a + b, 0);
        if (phraseRe.test(textLower)) score = 100;
        else if (matched === terms.length) score = 50;
        else if (matched > 0) score = matched * 10;
        if (score > 0) score += Math.min(hits, 49) / 50;

        if (score > 0) {
          const result = { score, ref: par.ref, paper: p.paper_index, paperTitle: p.paper_title, author: p.author,
            sectionTitle: section.section_title || '', text: par.text };
          if (context > 0) {
            result.before = [];
            result.after = [];
            for (let c = Math.max(0, pi - context); c < pi; c++) result.before.push(section.paragraphs[c].text);
            for (let c = pi + 1; c <= Math.min(section.paragraphs.length - 1, pi + context); c++) result.after.push(section.paragraphs[c].text);
          }
          results.push(result);
        }
      }
    }
  }
  // Sort by score descending, then by paper order
  results.sort((a, b) => b.score - a.score || a.paper - b.paper);
  return { total: results.length, results: results.slice(0, limit), termRes, phraseRe };
}

module.exports = { searchUB, getParagraphs };
if (require.main !== module) return;

// ---------- CLI ----------
const args = process.argv.slice(2);
let query = '';
let paperFilter = null;
let limit = 20;
let contextLines = 0;
let refMode = false;
const refs = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--paper' && args[i+1]) { paperFilter = parseInt(args[++i]); }
  else if (args[i] === '--limit' && args[i+1]) { limit = parseInt(args[++i]); }
  else if (args[i] === '--context' && args[i+1]) { contextLines = parseInt(args[++i]); }
  else if (args[i] === '--ref') { refMode = true; }
  else if (refMode && !args[i].startsWith('--')) { refs.push(args[i]); }
  else if (!args[i].startsWith('--')) { query += (query ? ' ' : '') + args[i]; }
}

// --ref mode: print the exact par_content from the paper JSON, never truncated
if (refMode) {
  if (!refs.length) { console.error('Usage: node ub-search.js --ref 180:2.1 [more refs]'); process.exit(1); }
  let missing = 0;
  for (const p of getParagraphs(refs)) {
    if (p.error) { console.log(`### ${p.ref}\n*${p.error}*\n`); missing++; continue; }
    console.log(`### ${p.ref}  [page ${p.page} | Paper ${p.paper}: ${p.paperTitle} | ${p.section} | ${p.author}]`);
    console.log(p.text);
    console.log();
  }
  process.exit(missing ? 1 : 0);
}

if (!query) {
  console.error('Usage: node ub-search.js "search term" [--paper N] [--limit N] [--context N]');
  process.exit(1);
}

const { total, results: showing, termRes, phraseRe } = searchUB({ query, paper: paperFilter, limit, context: contextLines });
console.log(`\n=== UB Search: "${query}" ===`);
console.log(`Found ${total} results. Showing top ${showing.length}.\n`);

for (const r of showing) {
  console.log(`--- (${r.ref}) Paper ${r.paper}: ${r.paperTitle} ---`);
  if (r.sectionTitle) console.log(`    Section: ${r.sectionTitle}`);
  console.log(`    Author: ${r.author}`);
  if (r.before) {
    for (const b of r.before) console.log(`    [BEFORE] ${b.substring(0, 150)}...`);
  }

  // Highlight matching terms in output
  let display = r.text;
  if (display.length > 500) {
    // Find first match position and show context around it
    const pos = Math.max(0, display.search(new RegExp(termRes[0] ? termRes[0].source : phraseRe.source, 'i')));
    const start = Math.max(0, pos - 100);
    const end = Math.min(display.length, pos + 400);
    display = (start > 0 ? '...' : '') + display.substring(start, end) + (end < display.length ? '...' : '');
  }
  console.log(`    "${display}"`);
  if (display !== r.text) console.log(`    (excerpt only; verbatim text: node ub-search.js --ref ${r.ref})`);

  if (r.after) {
    for (const a of r.after) console.log(`    [AFTER] ${a.substring(0, 150)}...`);
  }
  console.log();
}

if (total > limit) {
  console.log(`... and ${total - limit} more results. Use --limit ${total} to see all.`);
}
