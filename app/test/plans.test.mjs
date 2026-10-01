// Tests for the reading plans build (app/build-plans.mjs -> app/plans-data.json).
// Loads the REAL book data from source-texts and verifies every day.
// Run: node --test app/test/plans.test.mjs        (from the repo root)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TEST_DIR, '..', '..');
const PAPERS_DIR = join(REPO_ROOT, 'source-texts', 'papers');
const DATA = JSON.parse(readFileSync(join(TEST_DIR, '..', 'plans-data.json'), 'utf8'));

// Real book order, straight from the source-texts JSON (not the generated file).
const files = Array.from({ length: 197 }, (_, i) => `Doc${String(i).padStart(3, '0')}.json`);
const order = [];          // all paragraph refs in book order
const titles = new Map();  // paper_index -> paper_title
const paperOf = new Map(); // ref -> paper_index
for (const f of files) {
  const d = JSON.parse(readFileSync(join(PAPERS_DIR, f), 'utf8'));
  titles.set(d.paper_index, d.paper_title);
  for (const s of d.sections) for (const p of s.pars) {
    order.push(p.par_ref);
    paperOf.set(p.par_ref, d.paper_index);
  }
}
const byRef = new Map(order.map((ref, i) => [ref, i]));
const byId = new Map(DATA.plans.map((p) => [p.id, p]));

test('plans-data.json holds exactly the 3 plans', () => {
  assert.equal(DATA.plans.length, 3);
  assert.deepEqual(DATA.plans.map((p) => p.id), ['year', 'jesus', 'central']);
});

test('day counts are exactly 365 / 90 / 30', () => {
  assert.equal(byId.get('year').days.length, 365);
  assert.equal(byId.get('jesus').days.length, 90);
  assert.equal(byId.get('central').days.length, 30);
});

test('day schema: n, title, startRef, endRef, paragraphs are present and typed', () => {
  for (const plan of DATA.plans) {
    plan.days.forEach((d, i) => {
      assert.equal(d.n, i + 1, `${plan.id}: day n`);
      assert.equal(typeof d.title, 'string', `${plan.id} day ${d.n}: title`);
      assert.ok(d.title.length > 0, `${plan.id} day ${d.n}: title non-empty`);
      assert.match(d.startRef, /^\d{1,3}:\d{1,2}\.\d{1,3}b?$/, `${plan.id} day ${d.n}: startRef shape`);
      assert.match(d.endRef, /^\d{1,3}:\d{1,2}\.\d{1,3}b?$/, `${plan.id} day ${d.n}: endRef shape`);
      assert.ok(Number.isInteger(d.paragraphs) && d.paragraphs > 0, `${plan.id} day ${d.n}: paragraphs`);
    });
  }
});

test('every startRef and endRef resolves against the real book data', () => {
  for (const plan of DATA.plans) {
    for (const d of plan.days) {
      assert.ok(byRef.has(d.startRef), `${plan.id} day ${d.n}: startRef ${d.startRef} resolves`);
      assert.ok(byRef.has(d.endRef), `${plan.id} day ${d.n}: endRef ${d.endRef} resolves`);
    }
  }
});

test('days are contiguous and non-overlapping within each plan', () => {
  for (const plan of DATA.plans) {
    let prevEnd = byRef.get(plan.days[0].startRef) - 1; // plans need not start at the book's first paragraph
    for (const d of plan.days) {
      const si = byRef.get(d.startRef);
      const ei = byRef.get(d.endRef);
      assert.ok(ei >= si, `${plan.id} day ${d.n}: endRef not before startRef`);
      assert.equal(si, prevEnd + 1, `${plan.id} day ${d.n}: starts exactly after previous day`);
      prevEnd = ei;
    }
  }
});

test('year plan covers all 197 papers (Foreword through 196) with no gaps', () => {
  const covered = new Set();
  for (const d of byId.get('year').days) {
    for (let i = byRef.get(d.startRef); i <= byRef.get(d.endRef); i++) covered.add(order[i]);
  }
  assert.equal(covered.size, order.length);
  assert.equal(order.length, 14596);
});

test('jesus plan covers exactly papers 120-196', () => {
  const covered = new Set();
  for (const d of byId.get('jesus').days) {
    for (let i = byRef.get(d.startRef); i <= byRef.get(d.endRef); i++) covered.add(order[i]);
  }
  const papers = new Set([...covered].map((r) => paperOf.get(r)));
  assert.deepEqual([...papers].sort((a, b) => a - b)[0] === 120 && [...papers].sort((a, b) => a - b).at(-1) === 196 ? [120, 196] : [], [120, 196]);
  assert.ok([...papers].every((p) => p >= 120 && p <= 196));
  for (let p = 120; p <= 196; p++) assert.ok(papers.has(p), `paper ${p} covered`);
});

test('central plan covers exactly papers 1-31', () => {
  const covered = new Set();
  for (const d of byId.get('central').days) {
    for (let i = byRef.get(d.startRef); i <= byRef.get(d.endRef); i++) covered.add(order[i]);
  }
  const papers = new Set([...covered].map((r) => paperOf.get(r)));
  assert.ok([...papers].every((p) => p >= 1 && p <= 31));
  for (let p = 1; p <= 31; p++) assert.ok(papers.has(p), `paper ${p} covered`);
});

test('plan bounds verified from the data, not memory', () => {
  assert.equal(titles.get(120), 'The Bestowal of Michael on Urantia');
  assert.equal(titles.get(119), 'The Bestowals of Christ Michael');
  assert.equal(titles.get(196), 'The Faith of Jesus');
  assert.equal(titles.get(1), 'The Universal Father');
  assert.equal(titles.get(31), 'The Corps of the Finality');
  assert.equal(titles.get(32), 'The Evolution of Local Universes');
});

test('paragraph counts match the refs actually spanned', () => {
  for (const plan of DATA.plans) {
    for (const d of plan.days) {
      const spanned = byRef.get(d.endRef) - byRef.get(d.startRef) + 1;
      assert.equal(d.paragraphs, spanned, `${plan.id} day ${d.n}: paragraphs == refs spanned`);
    }
  }
});

test('day titles name the papers the refs belong to', () => {
  for (const plan of DATA.plans) {
    for (const d of plan.days) {
      const a = paperOf.get(d.startRef), b = paperOf.get(d.endRef);
      if (a === b && a !== 0) assert.ok(d.title.startsWith(`Paper ${a}: `), `${plan.id} day ${d.n} title`);
      if (a === b && a === 0) assert.equal(d.title, 'Foreword', `${plan.id} day ${d.n} title`);
      if (a !== b && a !== 0) assert.equal(d.title, `Papers ${a}\u2013${b}`, `${plan.id} day ${d.n} title`);
    }
  }
});

test('no paragraph text is redistributed in plans-data.json', () => {
  const s = readFileSync(join(TEST_DIR, '..', 'plans-data.json'), 'utf8');
  assert.ok(!s.includes('IN THE MINDS of the mortals of Urantia'), 'no book text leaked');
  assert.ok(!s.includes('par_content'), 'no paragraph payload keys');
});
