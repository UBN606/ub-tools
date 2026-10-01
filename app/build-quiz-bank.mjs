#!/usr/bin/env node
/**
 * build-quiz-bank.mjs — machine-slices the quiz question bank from the local book text.
 *
 * Run: node app/build-quiz-bank.mjs   (from the repo root)
 * Writes: app/quiz-bank.json — { built: 'YYYY-MM-DD', questions: [{ quote, ref }] }
 *
 * RULE: quiz quotes are NEVER hand-typed. Every candidate is a sentence sliced from
 * paragraph text, and it ships only if the repo's own ub-verify.js (checkQuote)
 * returns verdict PASS for `"candidate" (ref)`. Deterministic: papers, sections and
 * paragraphs are walked in document order, no randomness anywhere.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(here); // repo root: app/ lives one level down
const require = createRequire(join(ROOT, 'ub-verify.js'));
const verify = require('./ub-verify.js'); // __dirname inside points at the repo root

const N_PAPERS = 197;
const MIN_LEN = 80;
const MAX_LEN = 220;

// Do not split a sentence after these abbreviations ("e.g. the ..." stays one sentence).
const ABBR = /\b(e\.g|i\.e|etc|Mr|Mrs|Ms|Dr|St|vs|No|Fig|Figs|cf|viz|pp|Ch)\.$/i;

function sentences(text) {
  const out = [];
  let start = 0;
  const re = /[.!?]\s+/g;
  let m;
  while ((m = re.exec(text))) {
    const frag = text.slice(start, m.index + 1);
    if (!ABBR.test(frag.trim())) {
      if (frag.trim()) out.push(frag.trim());
      start = m.index + m[0].length;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

// A quiz-worthy sentence: full sentence, real length, no footnote/markup traces,
// starts like a sentence (capital letter, after any opening quote).
function usable(s) {
  if (s.length < MIN_LEN || s.length > MAX_LEN) return false;
  if (!/[.!?]$/.test(s)) return false;
  if (!/^[A-Z"“'‘]/.test(s)) return false;
  if (/[*_]/.test(s)) return false; // footnote asterisks or emphasis markup
  if (/[<>]/.test(s)) return false; // markup remnants
  if (/&\w+;/.test(s)) return false; // unhandled HTML entity
  if (/[\[\]]/.test(s)) return false; // editorial brackets break clean slicing
  return true;
}

function* paragraphs() {
  for (let n = 0; n < N_PAPERS; n++) {
    const file = `Doc${String(n).padStart(3, '0')}.json`;
    const doc = JSON.parse(readFileSync(join(ROOT, 'source-texts', 'papers', file), 'utf8'));
    for (const s of doc.sections) for (const p of s.pars) yield p;
  }
}

const questions = [];
const seen = new Set();
let checked = 0;
let currentPaper = -1;

for (const p of paragraphs()) {
  const paper = parseInt(p.par_ref.split(':')[0], 10);
  if (paper === currentPaper) continue; // cap: one question per paper
  const plain = verify
    .stripMarkup(p.par_content)
    .replace(/\s+/g, ' ')
    .trim();
  for (const s of sentences(plain)) {
    if (!usable(s) || seen.has(s)) continue;
    checked++;
    const verdict = verify.checkQuote({ body: s, citation: p.par_ref, refs: [p.par_ref] });
    if (verdict.status === 'PASS') {
      questions.push({ quote: s, ref: p.par_ref });
      seen.add(s);
      currentPaper = paper;
      break; // move to the next paper
    }
  }
}

const out = {
  built: new Date().toISOString().slice(0, 10),
  questions,
};
writeFileSync(join(here, 'quiz-bank.json'), JSON.stringify(out, null, 2) + '\n');

const papers = new Set(questions.map((q) => q.ref.split(':')[0]));
console.log(`checked ${checked} candidate sentences, kept ${questions.length} questions across ${papers.size} papers`);
console.log(`wrote app/quiz-bank.json`);
