#!/usr/bin/env node
// build-plans.mjs — builds app/plans-data.json from source-texts/papers/*.json.
//
// Three reading plans, each a list of days; every day is a CONTIGUOUS ref range
// { n, title, startRef, endRef, paragraphs }. Paper ranges, titles and paragraph
// counts all come from the local book data — nothing from memory. The build
// FAILS LOUDLY (exit 1) if any ref does not resolve or any day is not a clean,
// non-overlapping tile of its plan's paragraph list.
//
// Run: node app/build-plans.mjs        (from the repo root)
'use strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(APP_DIR);
const PAPERS_DIR = join(REPO_ROOT, 'source-texts', 'papers');
const OUT = join(APP_DIR, 'plans-data.json');

// Matches the ref shapes in the data, including the three star-separator
// paragraphs (31:10.21b, 56:10.22b, 120:3.11b).
const REF_RE = /^\d{1,3}:\d{1,2}\.\d{1,3}b?$/;

const fail = (msg) => { console.error(`build-plans: FAIL: ${msg}`); process.exit(1); };

// ---------- load the book ----------
function loadBook() {
  const files = readdirSync(PAPERS_DIR).filter((f) => /^Doc\d{3}\.json$/.test(f)).sort();
  if (files.length !== 197) fail(`expected 197 paper docs (Doc000..Doc196), found ${files.length}`);
  const papers = [];
  for (const f of files) {
    const d = JSON.parse(readFileSync(join(PAPERS_DIR, f), 'utf8'));
    const paragraphs = [];
    for (const s of d.sections) {
      for (const p of s.pars) {
        if (!REF_RE.test(p.par_ref)) fail(`bad ref ${JSON.stringify(p.par_ref)} in ${f}`);
        paragraphs.push({ ref: p.par_ref, paper: d.paper_index, sectionRef: s.section_ref });
      }
    }
    if (!paragraphs.length) fail(`${f} has no paragraphs`);
    papers.push({ index: d.paper_index, title: d.paper_title, file: f, paragraphs });
  }
  papers.sort((a, b) => a.index - b.index);
  papers.forEach((p, i) => { if (p.index !== i) fail(`paper index gap: expected ${i}, got ${p.index}`); });
  return papers;
}

// ---------- plan specs ----------
// Paper ranges were determined by reading the paper titles in the data:
//
// (b) "The Life and Teachings of Jesus": Paper 120 "The Bestowal of Michael on
//     Urantia" is where the Jesus narrative begins (its first section is
//     "The Seventh Bestowal Commission"); Paper 119 "The Bestowals of Christ
//     Michael" describes all seven bestowals and closes the previous run.
//     Paper 196 "The Faith of Jesus" is the last paper of the book.
//     Range: papers 120-196.
//
// (c) "The Central Universe": Papers 1-31 run from "The Universal Father"
//     through "The Corps of the Finality", covering Paradise, Havona, the
//     superuniverses and the personalities of the grand universe. Paper 32
//     "The Evolution of Local Universes" starts a new subject.
//     Range: papers 1-31.
const PLAN_SPECS = [
  {
    id: 'year',
    title: 'The Whole Book in a Year',
    blurb: 'The Foreword and all 196 papers, in 365 daily portions.',
    dayCount: 365,
    firstPaper: 0,
    lastPaper: 196,
  },
  {
    id: 'jesus',
    title: 'The Life and Teachings of Jesus in 90 Days',
    blurb: 'Papers 120-196, from "The Bestowal of Michael on Urantia" to "The Faith of Jesus", in 90 daily portions.',
    dayCount: 90,
    firstPaper: 120,
    lastPaper: 196,
    boundaryChecks: { 120: 'The Bestowal of Michael on Urantia', 119: 'The Bestowals of Christ Michael', 196: 'The Faith of Jesus' },
  },
  {
    id: 'central',
    title: 'The Central Universe in 30 Days',
    blurb: 'Papers 1-31, from "The Universal Father" to "The Corps of the Finality", in 30 daily portions.',
    dayCount: 30,
    firstPaper: 1,
    lastPaper: 31,
    boundaryChecks: { 1: 'The Universal Father', 31: 'The Corps of the Finality', 32: 'The Evolution of Local Universes' },
  },
];

// ---------- build ----------
function main() {
  const book = loadBook();
  const byIndex = new Map(book.map((p) => [p.index, p]));

  // Every paper title used by the plans must match the data exactly.
  const expectTitle = (idx, title) => {
    const got = byIndex.get(idx)?.title;
    if (got !== title) fail(`paper ${idx}: expected title ${JSON.stringify(title)}, data says ${JSON.stringify(got)}`);
  };
  for (const spec of PLAN_SPECS) for (const [idx, title] of Object.entries(spec.boundaryChecks || {})) expectTitle(Number(idx), title);

  const plans = [];
  for (const spec of PLAN_SPECS) {
    const range = [];
    for (let i = spec.firstPaper; i <= spec.lastPaper; i++) range.push(byIndex.get(i));
    const paras = range.flatMap((p) => p.paragraphs);
    const refToPos = new Map(paras.map((p, i) => [p.ref, i]));

    // Chunk into dayCount roughly-equal days by paragraph count.
    const days = [];
    let prev = 0;
    for (let k = 1; k <= spec.dayCount; k++) {
      const cut = Math.round((k * paras.length) / spec.dayCount);
      const slice = paras.slice(prev, cut);
      if (!slice.length) fail(`${spec.id}: day ${k} is empty`);
      const first = slice[0], last = slice[slice.length - 1];
      // Paper 0 is the Foreword: label it by name, never "Paper 0".
      const title = first.paper === last.paper
        ? (first.paper === 0 ? 'Foreword' : `Paper ${first.paper}: ${byIndex.get(first.paper).title}`)
        : first.paper === 0
          ? `Foreword\u2013Paper ${last.paper}`
          : `Papers ${first.paper}\u2013${last.paper}`;
      days.push({ n: k, title, startRef: first.ref, endRef: last.ref, paragraphs: slice.length });
      prev = cut;
    }

    // Verify: every ref resolves, days are contiguous, non-overlapping,
    // and tile the plan's paragraph list exactly.
    let pos = 0;
    for (const day of days) {
      const si = refToPos.get(day.startRef);
      const ei = refToPos.get(day.endRef);
      if (si == null) fail(`${spec.id} day ${day.n}: startRef ${day.startRef} does not resolve`);
      if (ei == null) fail(`${spec.id} day ${day.n}: endRef ${day.endRef} does not resolve`);
      if (si !== pos) fail(`${spec.id} day ${day.n}: starts at position ${si}, expected ${pos} (gap or overlap)`);
      if (ei < si) fail(`${spec.id} day ${day.n}: endRef ${day.endRef} is before startRef ${day.startRef}`);
      if (day.paragraphs !== ei - si + 1) fail(`${spec.id} day ${day.n}: paragraph count ${day.paragraphs} != refs spanned ${ei - si + 1}`);
      pos = ei + 1;
    }
    if (pos !== paras.length) fail(`${spec.id}: days cover ${pos} of ${paras.length} paragraphs`);

    plans.push({ id: spec.id, title: spec.title, blurb: spec.blurb, days });
    console.log(`build-plans: ${spec.id}: ${days.length} days, ${paras.length} paragraphs (papers ${spec.firstPaper}-${spec.lastPaper}), ${days[0].startRef} .. ${days[days.length - 1].endRef}`);
  }

  writeFileSync(OUT, JSON.stringify({ plans }, null, 2) + '\n');
  console.log(`build-plans: wrote ${OUT}`);
}

main();
