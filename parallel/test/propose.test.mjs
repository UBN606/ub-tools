// Smoke test for parallel/propose.js: small run, check output schema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const texts = require('../lib/texts.js');
const needData = (!texts.ub.available() || !texts.kjv.available()) && 'texts not downloaded';

test('propose.js produces a valid review queue', { skip: needData, timeout: 120000 }, () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'propose-')), 'q.json');
  execFileSync('node', ['parallel/propose.js', '--limit', '30', '--out', out, '--min-score', '2'],
    { cwd: path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..') });
  const q = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.ok(Array.isArray(q.candidates), 'no candidates array');
  for (const c of q.candidates) {
    assert.ok(typeof c.bible_ref === 'string' && c.bible_ref, 'bad bible_ref');
    assert.ok(typeof c.ub_ref === 'string' && c.ub_ref, 'bad ub_ref');
    assert.equal(c.relationship, null, 'proposer must not assign relationships');
    assert.equal(c.status, 'proposed');
    assert.ok(typeof c.score === 'number' && c.score >= 2, 'bad score');
    assert.ok(typeof c.note === 'string' && c.note.includes('Curator must verify'),
      'candidate must carry the verify-before-accepting warning');
  }
});
