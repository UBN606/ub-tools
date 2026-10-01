import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const timelineDir = path.join(dir, '..');
const repoRoot = path.join(dir, '..', '..', '..');
const htmlPath = path.join(timelineDir, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

function extractDataset() {
  const m = html.match(/<script id="timeline-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'index.html must contain a <script id="timeline-data" type="application/json"> block');
  return JSON.parse(m[1]);
}

const CITE = /^\d{1,3}:\d{1,2}\.\d{1,2}$/;
const norm = s => String(s).replace(/\s+/g, ' ').trim();

function getParagraph(ref) {
  const paper = ref.split(':')[0];
  const file = path.join(repoRoot, 'source-texts', 'papers', `Doc${paper.padStart(3, '0')}.json`);
  assert.ok(fs.existsSync(file), `source text missing for paper ${paper}`);
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const s of doc.sections) {
    const par = s.pars.find(p => p.par_ref === ref);
    if (par) return par;
  }
  return null;
}

describe('timeline dataset extraction', () => {
  it('parses as a non-empty JSON array of 25-45 events', () => {
    const data = extractDataset();
    assert.ok(Array.isArray(data), 'dataset must be an array');
    assert.ok(data.length >= 25 && data.length <= 45, `expected 25-45 events, got ${data.length}`);
  });
});

describe('event schema', () => {
  it('every event has id, dateLabel, title, citation, quote', () => {
    extractDataset().forEach((e, k) => {
      for (const f of ['id', 'dateLabel', 'title', 'citation', 'quote']) {
        assert.equal(typeof e[f], 'string', `event ${k}: ${f} must be a string`);
        assert.ok(e[f].trim().length > 0, `event ${k}: ${f} empty`);
      }
      assert.equal(typeof e.sortKey, 'number', `event ${k}: sortKey must be a number`);
      assert.equal(typeof e.paperRange, 'string', `event ${k}: paperRange must be a string`);
    });
  });

  it('every citation matches Paper:Section.Paragraph format', () => {
    extractDataset().forEach((e, k) => {
      assert.match(e.citation, CITE, `event ${k} (${e.id}): citation "${e.citation}"`);
    });
  });

  it('every citation resolves to a real paragraph in source-texts', () => {
    extractDataset().forEach((e, k) => {
      const par = getParagraph(e.citation);
      assert.ok(par, `event ${k} (${e.id}): ${e.citation} not found in source-texts`);
    });
  });

  it('every quote is short (<= 400 chars)', () => {
    extractDataset().forEach((e, k) => {
      assert.ok(e.quote.length <= 400, `event ${k} (${e.id}): quote is ${e.quote.length} chars`);
      assert.ok(e.quote.length >= 8, `event ${k} (${e.id}): quote suspiciously short`);
    });
  });

  it('every quote appears verbatim in its cited paragraph', () => {
    extractDataset().forEach((e, k) => {
      const par = getParagraph(e.citation);
      const text = norm(par.par_content);
      assert.ok(text.includes(norm(e.quote)),
        `event ${k} (${e.id}): quote not found verbatim in ${e.citation}`);
    });
  });
});

describe('ordering and uniqueness', () => {
  it('sortKeys are strictly increasing (chronological order)', () => {
    const data = extractDataset();
    for (let k = 1; k < data.length; k++) {
      assert.ok(data[k].sortKey > data[k - 1].sortKey,
        `event ${k} (${data[k].id}): sortKey ${data[k].sortKey} not after ${data[k - 1].sortKey}`);
    }
  });

  it('citation paper numbers are non-decreasing (paper order)', () => {
    const data = extractDataset();
    let prev = 0;
    data.forEach((e, k) => {
      const paper = parseInt(e.citation.split(':')[0], 10);
      assert.ok(paper >= prev, `event ${k} (${e.id}): paper ${paper} before ${prev}`);
      prev = paper;
    });
  });

  it('has no duplicate ids', () => {
    const seen = new Set();
    extractDataset().forEach((e, k) => {
      assert.ok(!seen.has(e.id), `event ${k}: duplicate id "${e.id}"`);
      seen.add(e.id);
    });
  });
});

describe('portability — no references outside visuals/timeline/', () => {
  it('index.html contains no http(s) URLs', () => {
    assert.ok(!/https?:\/\//.test(html), 'index.html must not reference http(s) URLs');
  });

  it('index.html contains no parent-directory traversals', () => {
    assert.ok(!/\.\.\//.test(html), 'index.html must not reference ../ paths');
  });

  it('all linked assets live inside the timeline folder', () => {
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1])
      .filter(u => !u.startsWith('data:') && !u.startsWith('#'));
    assert.deepEqual(refs, [], `external/local references found: ${refs.join(', ')}`);
  });
});
