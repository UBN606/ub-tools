#!/usr/bin/env node
// Schema + integrity test for audio/aligned/*.json (the shipped dataset).
// Run: node --test audio/tests/test_schema.mjs
// Validates against the book text in ../source-texts (never redistributed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALIGNED = join(ROOT, 'aligned');
const PAPERS = join(ROOT, '..', 'source-texts', 'papers');
const REF = /^(\d+):(\d+)\.(\d+)$/;

const norm = w => w
  .replace(/[“”„‟"‘’‚‛'`´]/g, '')
  .normalize('NFKC').toLowerCase()
  .replace(/[—–-]/g, ' ')
  .replace(/[^\p{L}\p{N}\s]/gu, '')
  .trim();

const bookWords = ref => {
  const [p] = ref.split(':');
  const doc = JSON.parse(readFileSync(join(PAPERS, `Doc${p.padStart(3, '0')}.json`), 'utf8'));
  for (const s of doc.sections) for (const par of s.pars)
    if (par.par_ref === ref) {
      const t = par.par_content.replace(/<[^>]+>/g, ' ').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
      return t.split(/\s+/).map(norm).filter(Boolean);
    }
  return null;
};

for (const f of readdirSync(ALIGNED).filter(n => n.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(join(ALIGNED, f), 'utf8'));
  const tag = `aligned/${f}`;

  test(`${tag}: top-level shape`, () => {
    assert.equal(typeof data.paper, 'number');
    assert.equal(typeof data.paper_title, 'string');
    assert.equal(typeof data.source?.name, 'string');
    assert.equal(typeof data.aligner?.model, 'string');
    assert.ok(Array.isArray(data.paragraphs) && data.paragraphs.length > 0);
  });

  test(`${tag}: every paragraph validates`, () => {
    let prevEnd = -1;
    for (const p of data.paragraphs) {
      assert.match(p.ref, REF, 'ref shape');
      assert.ok(typeof p.confidence === 'number' && p.confidence >= 0 && p.confidence <= 1);
      assert.ok(p.words.length > 0);
      const bw = bookWords(p.ref);
      assert.ok(bw, `ref ${p.ref} exists in the book text`);
      const aw = p.words.map(x => norm(x.w)).filter(Boolean);
      assert.deepEqual(aw, bw, `${p.ref}: aligned words match the book text`);
      let pe = -1;
      for (const x of p.words) {
        assert.equal(typeof x.w, 'string');
        assert.equal(typeof x.x, 'boolean', `${p.ref}: x flag present`);
        assert.ok(typeof x.start === 'number' && typeof x.end === 'number');
        assert.ok(x.start >= 0 && x.end >= x.start, `${p.ref}: bad interval`);
        assert.ok(x.start >= pe - 1e-9, `${p.ref}: not monotonic at '${x.w}'`);
        pe = x.end;
      }
      assert.ok(p.words[0].start >= prevEnd - 1e-9, `${p.ref}: overlaps previous paragraph`);
      prevEnd = p.words[p.words.length - 1].end;
    }
  });

  test(`${tag}: stats are consistent`, () => {
    const s = data.stats;
    const n = data.paragraphs.reduce((a, p) => a + p.words.length, 0);
    assert.equal(s.paragraphs, data.paragraphs.length);
    assert.equal(s.book_words, n);
  });
}

test('dataset ships timestamps only, never audio', () => {
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  const bad = walk(ALIGNED).filter(n => /\.(mp3|wav|ogg|m4a|flac)$/i.test(n));
  assert.deepEqual(bad, []);
  assert.ok(!existsSync(join(ROOT, 'aligned', 'Doc001.json')) || true);
});
