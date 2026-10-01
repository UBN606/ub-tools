// Schema + referential-integrity tests for parallel/data/links.json
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LINKS_FILE = path.join(__dirname, '..', 'data', 'links.json');
const RELS = new Set(['restates', 'expands', 'corrects', 'fulfills']);
const texts = require('../lib/texts.js');

const data = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));

test('links.json parses and has a links array', () => {
  assert.ok(Array.isArray(data.links), 'no links array');
  assert.ok(data.links.length > 0, 'links array is empty');
});

test('every link has all required fields with valid values', () => {
  const seen = new Set();
  data.links.forEach((l, i) => {
    for (const f of ['bible_ref', 'ub_ref', 'relationship', 'note']) {
      assert.ok(typeof l[f] === 'string' && l[f].trim(), `links[${i}] missing/empty ${f}`);
    }
    assert.ok(RELS.has(l.relationship), `links[${i}] bad relationship "${l.relationship}"`);
    const key = `${l.bible_ref}→${l.ub_ref}`;
    assert.ok(!seen.has(key), `links[${i}] duplicate pair ${key}`);
    seen.add(key);
  });
});

test('every ub_ref resolves in the UB text', { skip: !texts.ub.available() && 'UB source-texts not downloaded' }, () => {
  const bad = data.links.filter(l => !texts.ub.get(l.ub_ref)).map(l => l.ub_ref);
  assert.deepEqual(bad, [], `unresolvable ub_refs: ${bad.join(', ')}`);
});

test('every bible_ref resolves in the KJV text', { skip: !texts.kjv.available() && 'KJV data not downloaded' }, () => {
  const bad = data.links.filter(l => texts.kjv.getRange(l.bible_ref).length === 0).map(l => l.bible_ref);
  assert.deepEqual(bad, [], `unresolvable bible_refs: ${bad.join(', ')}`);
});

test('corrects links carry a neutral note (no preaching)', () => {
  const preachy = /\b(therefore you should|repent|the truth is that you must)\b/i;
  data.links.filter(l => l.relationship === 'corrects').forEach(l => {
    assert.ok(!preachy.test(l.note), `corrects note editorializes at ${l.bible_ref}↔${l.ub_ref}`);
  });
});
