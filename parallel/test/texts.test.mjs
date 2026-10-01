// Smoke tests for parallel/lib/texts.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const texts = require('../lib/texts.js');

const needUB = !texts.ub.available() && 'UB source-texts not downloaded';
const needKJV = !texts.kjv.available() && 'KJV data not downloaded';

test('ub.get resolves a known paragraph', { skip: needUB }, () => {
  const p = texts.ub.get('180:2.1');
  assert.ok(p, '180:2.1 not found');
  assert.match(p.text, /true vine/i);
});

test('ub.get returns null for a bad ref', { skip: needUB }, () => {
  assert.equal(texts.ub.get('999:9.9'), null);
  assert.equal(texts.ub.get('bogus'), null);
});

test('ub.getRange returns a range', { skip: needUB }, () => {
  const pars = texts.ub.getRange('180:2.1-3');
  assert.equal(pars.length, 3);
});

test('ub.allParagraphs covers all 197 papers', { skip: needUB }, () => {
  const all = texts.ub.allParagraphs();
  assert.ok(all.length > 14000, `only ${all.length} paragraphs`);
  assert.ok(all.every(p => /^\d+:\d+\.\d+[a-z]?$/.test(p.ref)), 'bad ref format');
});

test('kjv.get resolves a known verse', { skip: needKJV }, () => {
  const v = texts.kjv.get('John 15:5');
  assert.ok(v && /I am the vine/i.test(v.text), 'John 15:5 text mismatch');
});

test('kjv ref parsing handles abbreviations and ranges', { skip: needKJV }, () => {
  assert.ok(texts.kjv.get('jn 3:16'), 'abbreviation failed');
  assert.ok(texts.kjv.get('1 Cor 13:4'), 'numbered book failed');
  const range = texts.kjv.getRange('John 15:1-2');
  assert.equal(range.length, 2);
});

test('kjv.getRange returns [] for a bad ref', { skip: needKJV }, () => {
  assert.deepEqual(texts.kjv.getRange('John 99:99'), []);
  assert.deepEqual(texts.kjv.getRange('bogus'), []);
});

test('kjv.allVerses has all 66 books', { skip: needKJV }, () => {
  const all = texts.kjv.allVerses();
  assert.ok(all.length >= 31000, `only ${all.length} verses`);
  assert.equal(texts.kjv.books().length, 66);
});
