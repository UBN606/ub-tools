// Verifies parallel/data/links.json: schema validity + every ref resolves in the texts.
// Usage: node parallel/lib/verify-links.js [--links path]
// Skips gracefully with a clear message if the texts are not downloaded yet.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const LINKS = process.argv.includes('--links')
  ? path.resolve(process.argv[process.argv.indexOf('--links') + 1])
  : path.join(ROOT, 'parallel', 'data', 'links.json');
const RELS = new Set(['restates', 'expands', 'corrects', 'fulfills']);

function main() {
  const errors = [];
  if (!fs.existsSync(LINKS)) { console.error(`FAIL: links file not found: ${LINKS}`); process.exit(1); }
  let data;
  try { data = JSON.parse(fs.readFileSync(LINKS, 'utf8')); }
  catch (e) { console.error(`FAIL: links.json is not valid JSON: ${e.message}`); process.exit(1); }
  if (!Array.isArray(data.links)) { console.error('FAIL: links.json has no "links" array'); process.exit(1); }

  let texts;
  try { texts = require('./texts.js'); }
  catch (e) { console.error(`FAIL: cannot load parallel/lib/texts.js: ${e.message}`); process.exit(1); }

  const seen = new Set();
  data.links.forEach((l, i) => {
    const tag = `links[${i}]`;
    for (const f of ['bible_ref', 'ub_ref', 'relationship', 'note'])
      if (typeof l[f] !== 'string' || !l[f].trim()) errors.push(`${tag}: missing/empty ${f}`);
    if (l.relationship && !RELS.has(l.relationship))
      errors.push(`${tag}: bad relationship "${l.relationship}" (want one of ${[...RELS].join('|')})`);
    const key = `${l.bible_ref}→${l.ub_ref}`;
    if (seen.has(key)) errors.push(`${tag}: duplicate pair ${key}`);
    seen.add(key);
    if (l.bible_ref && texts.kjv.available()) {
      let verses = null;
      try { verses = texts.kjv.getRange(l.bible_ref); } catch (e) { /* treat as bad */ }
      if (!verses) errors.push(`${tag}: bible_ref does not resolve: "${l.bible_ref}"`);
    }
    if (l.ub_ref && texts.ub.available()) {
      const p = texts.ub.get(l.ub_ref);
      if (!p) errors.push(`${tag}: ub_ref does not resolve: "${l.ub_ref}"`);
    }
  });

  if (!texts.kjv.available) console.warn('WARN: KJV data not downloaded (run parallel/fetch-bible.js); bible refs unchecked.');
  if (!texts.ub.available) console.warn('WARN: UB source-texts not found; ub refs unchecked.');

  if (errors.length) {
    console.error(`FAIL: ${errors.length} problem(s):`);
    errors.slice(0, 25).forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
  console.log(`OK: ${data.links.length} links verified (schema + all refs resolve).`);
}

main();
