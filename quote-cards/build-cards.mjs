#!/usr/bin/env node
/**
 * build-cards.mjs — build cards.json from cards.src.json.
 *
 * Quotes are NEVER typed by hand. Each source entry gives a citation plus
 * start/end anchors; the quote is sliced as an exact substring of the book's
 * own paragraph text (via the repo's getParagraph + stripMarkup). This makes
 * transcription errors impossible: a wrong anchor fails loudly here instead
 * of shipping a misquote.
 *
 * Output quotes carry verified:false; run verify-cards.mjs to verify them.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { getParagraph, stripMarkup } = require('../ub-verify.js');
const dir = path.dirname(fileURLToPath(import.meta.url));

const src = JSON.parse(fs.readFileSync(path.join(dir, 'cards.src.json'), 'utf8'));
const cards = [];
let n = 0;
for (const s of src) {
  n++;
  const raw = getParagraph(s.citation);
  if (!raw) { console.error(`#${n} [${s.topic}] ${s.citation}: paragraph not found`); process.exit(1); }
  const text = stripMarkup(raw);
  const i = text.indexOf(s.start);
  if (i < 0) { console.error(`#${n} [${s.topic}] ${s.citation}: start anchor not found:\n  ${s.start}`); process.exit(1); }
  const j = text.indexOf(s.end, i);
  if (j < 0) { console.error(`#${n} [${s.topic}] ${s.citation}: end anchor not found:\n  ${s.end}`); process.exit(1); }
  const quote = text.slice(i, j + s.end.length).replace(/\s+/g, ' ').trim();
  cards.push({ topic: s.topic, quote, citation: s.citation, verified: false });
}
fs.writeFileSync(path.join(dir, 'cards.json'), JSON.stringify(cards, null, 2) + '\n');
console.log(`built ${cards.length} cards -> cards.json (verified:false; run verify-cards.mjs)`);
