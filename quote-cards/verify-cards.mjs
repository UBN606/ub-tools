#!/usr/bin/env node
/**
 * verify-cards.mjs — verify every card in cards.json word-for-word against
 * the book text, using the repo's own normalization (ub-verify.js).
 *
 * Exact PASS required: the card's quote must be an exact substring of the
 * cited paragraph after the repo's standard normalization. Anything else
 * (wrong citation, changed wording, missing paragraph) fails the build with
 * a non-zero exit code. Fix or drop the card; never weaken the check.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { getParagraph, stripMarkup, exactForm } = require('../ub-verify.js');
const dir = path.dirname(fileURLToPath(import.meta.url));

const file = path.join(dir, 'cards.json');
if (!fs.existsSync(file)) { console.error('cards.json not found; run build-cards.mjs first'); process.exit(2); }
const cards = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(cards) || !cards.length) { console.error('cards.json is empty or not an array'); process.exit(2); }

const CITE = /^\d{1,3}:\d{1,2}\.\d{1,2}$/;
let bad = 0;
cards.forEach((c, k) => {
  const id = `#${k + 1} [${c.topic}] (${c.citation})`;
  const problems = [];
  if (typeof c.topic !== 'string' || !c.topic.trim()) problems.push('bad topic');
  if (typeof c.quote !== 'string' || c.quote.trim().length < 10) problems.push('bad quote');
  if (typeof c.citation !== 'string' || !CITE.test(c.citation)) problems.push('bad citation format');
  const raw = CITE.test(c.citation || '') ? getParagraph(c.citation) : null;
  if (!raw) problems.push('cited paragraph does not exist');
  else {
    const qExact = exactForm(c.quote || '');
    if (!qExact) problems.push('quote empty after normalization');
    else if (!exactForm(stripMarkup(raw)).includes(qExact)) problems.push('quote is NOT an exact substring of the cited paragraph');
  }
  if (typeof c.quote === 'string' && c.quote.length > 600) problems.push('quote too long for a card (>600 chars)');
  if (problems.length) { bad++; console.error(`FAIL ${id}: ${problems.join('; ')}`); }
  else { c.verified = true; console.log(`ok   ${id}`); }
});
if (bad) { console.error(`\n${bad} card(s) FAILED verification — fix or drop them, then re-run`); process.exit(1); }
fs.writeFileSync(file, JSON.stringify(cards, null, 2) + '\n');
console.log(`\nAll ${cards.length} cards verified word-for-word. cards.json updated (verified:true).`);
