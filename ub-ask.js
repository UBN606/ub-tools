#!/usr/bin/env node
/**
 * UB Ask — a plain question answered in the book's own words, the same answers as the Studio app
 *
 * Usage:
 *   node ub-ask.js "How old is Urantia?"            exact text of the top passages
 *   node ub-ask.js "Do I have a guardian angel?" --max 3
 *   node ub-ask.js "What is the will of God?" --json
 *
 * Text output uses the same blocks as `node ub-search.js --ref` (### ref  [page | Paper | section | author],
 * then the exact paragraph), so a tool that already reads --ref output reads these answers too.
 * --json gives the question, the passages, the next refs, the book terms used and where the book is silent.
 *
 * Library use (ub-mcp.js): require('./ub-ask.js') exports askUB(question, { max }).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { searchUB, getParagraphs } = require('./ub-search.js');

const INDEX_FILE = path.join(__dirname, 'source-texts', 'ub-search-index.json');

let askModule = null;
// Every paragraph with its paper and section titles, built the way app/engine.js builds it:
// answer() needs it for the exact-words refinement, the section-about-it boost and the
// age questions, so without it the answers would not be the Studio's.
let byRef = null;
function paragraphsByRef() {
  if (byRef) return byRef;
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  byRef = new Map();
  for (const p of index.papers) for (const s of p.sections) for (const par of s.paragraphs)
    byRef.set(par.ref, { ...par, paper: p.paper_index, paperTitle: p.paper_title, author: p.author, sectionTitle: s.section_title });
  return byRef;
}

// The Studio's answer() (app/ask.js) with the exact text of each passage.
async function askUB(question, { max = 5 } = {}) {
  if (!askModule) askModule = await import(pathToFileURL(path.join(__dirname, 'app', 'ask.js')).href);
  const r = askModule.answer({ search: { searchUB }, byRef: paragraphsByRef() }, String(question), { max });
  return { ...r, passages: getParagraphs(r.refs).filter(p => !p.error) };
}

// Where the book is silent on a word of the question (shared with ub_ask in ub-mcp.js).
function silence(quiet) {
  if (!quiet.length) return undefined;
  return quiet.map(x => x.total === 0 ? `The book never uses the word "${x.word}".` : `The book uses the word "${x.word}" only ${x.total} time(s): ${x.refs.join(', ')}.`).join(' ') + ' The passages below are the closest to the question; they may not answer it.';
}

module.exports = { askUB, silence };
if (require.main !== module) return;

// ---------- CLI ----------
const args = process.argv.slice(2);
let question = '';
let max = 5;
let json = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--max' && args[i + 1]) max = Math.min(Math.max(parseInt(args[++i]) || 5, 1), 15);
  else if (args[i] === '--json') json = true;
  else if (!args[i].startsWith('--')) question += (question ? ' ' : '') + args[i];
}
if (!question.trim()) {
  console.error('Usage: node ub-ask.js "your question" [--max N] [--json]');
  process.exit(1);
}

askUB(question, { max }).then(r => {
  if (json) {
    console.log(JSON.stringify({
      question,
      silence: silence(r.quiet),
      passages: r.passages.map(p => ({ ref: p.ref, page: p.page, paper: p.paper, paperTitle: p.paperTitle, section: p.section, author: p.author, text: p.text, foundBecauseItSpeaksOf: [...(r.why.get(p.ref) || [])] })),
      morePassages: r.more,
      bookTermsUsed: r.mapped,
    }, null, 2));
    return;
  }
  const quiet = silence(r.quiet);
  if (quiet) console.log(quiet + '\n');
  for (const p of r.passages) {
    console.log(`### ${p.ref}  [page ${p.page} | Paper ${p.paper}: ${p.paperTitle} | ${p.section} | ${p.author}]`);
    console.log(p.text);
    console.log();
  }
  if (!r.passages.length) process.exit(1);
}).catch(e => { console.error(`ub-ask: ${e.message}`); process.exit(2); });
