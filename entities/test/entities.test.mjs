#!/usr/bin/env node
/**
 * entities/test/entities.test.mjs — validates the published entity JSON artifacts.
 * Run: node --test entities/test/entities.test.mjs   (from repo root)
 * Zero npm dependencies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, '..');
const REF_RE = /^\d+:\d+\.\d+$/;

const people = JSON.parse(readFileSync(join(DIR, 'people.json'), 'utf8'));
const places = JSON.parse(readFileSync(join(DIR, 'places.json'), 'utf8'));
const groups = JSON.parse(readFileSync(join(DIR, 'groups.json'), 'utf8'));
const all = [...people, ...places, ...groups];

// paragraph ref -> true, from source-texts/
const knownRefs = new Set();
for (const f of readdirSync(join(DIR, '..', 'source-texts', 'papers')).filter(f => /^Doc\d{3}\.json$/.test(f))) {
  const doc = JSON.parse(readFileSync(join(DIR, '..', 'source-texts', 'papers', f), 'utf8'));
  for (const s of doc.sections) for (const p of s.pars) knownRefs.add(p.par_ref);
}

test('files are non-empty arrays', () => {
  assert.ok(Array.isArray(people) && people.length > 0);
  assert.ok(Array.isArray(places) && places.length > 0);
  assert.ok(Array.isArray(groups) && groups.length > 0);
});

test('entry schema: required fields and constrained kinds', () => {
  const expect = { 'people.json': 'person', 'places.json': 'place', 'groups.json': 'group' };
  for (const [file, entries] of Object.entries({ 'people.json': people, 'places.json': places, 'groups.json': groups })) {
    for (const e of entries) {
      assert.equal(typeof e.name, 'string', `${file}: name`);
      assert.ok(e.name.trim().length > 0, `${file}: name non-empty`);
      assert.equal(e.kind, expect[file], `${e.name}: kind`);
      assert.ok(Array.isArray(e.refs) && e.refs.length >= 1 && e.refs.length <= 3, `${e.name}: 1-3 refs`);
      for (const r of e.refs) assert.match(r, REF_RE, `${e.name}: ref format`);
      assert.equal(typeof e.note, 'string', `${e.name}: note`);
      assert.ok(e.note.trim().length > 0, `${e.name}: note non-empty`);
      assert.ok(!e.note.includes('"'), `${e.name}: note must not quote book wording`);
      if (e.aliases !== undefined) {
        assert.ok(Array.isArray(e.aliases) && e.aliases.every(a => typeof a === 'string' && a.trim()), `${e.name}: aliases`);
      }
    }
  }
});

test('every ref resolves to a real paragraph in source-texts/', () => {
  for (const e of all) for (const r of e.refs) assert.ok(knownRefs.has(r), `${e.name}: ref ${r} does not exist`);
});

test('no duplicate names (case-insensitive) across all files', () => {
  const seen = new Map();
  for (const e of all) {
    const k = e.name.toLowerCase();
    assert.ok(!seen.has(k), `duplicate name: ${e.name} (also in ${seen.get(k)})`);
    seen.set(k, e.kind);
  }
});

test('files sorted by name', () => {
  for (const entries of [people, places, groups]) {
    const names = entries.map(e => e.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(names, sorted, 'not sorted');
  }
});

test('coverage.json exists and counts match the published files', () => {
  const covPath = join(DIR, 'coverage.json');
  assert.ok(existsSync(covPath), 'coverage.json missing — run node entities/build.mjs');
  const cov = JSON.parse(readFileSync(covPath, 'utf8'));
  assert.equal(cov.entries, all.length);
  assert.equal(cov.people, people.length);
  assert.equal(cov.places, places.length);
  assert.equal(cov.groups, groups.length);
  assert.deepEqual(cov.unresolved, []);
  assert.deepEqual(cov.pinnedFailures, []);
});
