import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(here, '..', 'index.html');
const papersDir = path.join(here, '..', '..', '..', 'source-texts', 'papers');

const html = readFileSync(htmlPath, 'utf8');
const m = html.match(/<script id="cosmos-data" type="application\/json">\s*([\s\S]*?)\s*<\/script>/);
assert.ok(m, 'embedded dataset <script id="cosmos-data"> block must exist');
const regions = JSON.parse(m[1]);

const CIT_RE = /^\d+:\d+\.\d+$/;
function paperDoc(citation) {
  const paper = citation.split(':')[0].padStart(3, '0');
  const p = path.join(papersDir, `Doc${paper}.json`);
  assert.ok(existsSync(p), `source doc for citation ${citation} must exist`);
  return JSON.parse(readFileSync(p, 'utf8'));
}
const norm = s => s.replace(/\*/g, '').replace(/\s+/g, ' ').trim();

test('dataset is a non-empty array', () => {
  assert.ok(Array.isArray(regions) && regions.length >= 12, 'expect >= 12 regions');
});

test('every region has id, name, quote, citation', () => {
  for (const r of regions) {
    for (const k of ['id', 'name', 'quote', 'citation']) {
      assert.ok(typeof r[k] === 'string' && r[k].trim().length > 0,
        `region ${JSON.stringify(r.id)} missing/empty field ${k}`);
    }
    assert.match(r.id, /^[a-z0-9-]+$/, `region id ${r.id} must be slug-like`);
  }
});

test('region ids are unique', () => {
  const ids = regions.map(r => r.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate region ids');
});

test('every citation matches N:N.N and resolves to a real par_ref', () => {
  for (const r of regions) {
    assert.match(r.citation, CIT_RE, `citation format for ${r.id}: ${r.citation}`);
    const doc = paperDoc(r.citation);
    const refs = new Set();
    for (const s of doc.sections) for (const p of s.pars) refs.add(p.par_ref);
    assert.ok(refs.has(r.citation), `citation ${r.citation} not found in source text`);
  }
});

test('every quote is short and verbatim in the cited paragraph', () => {
  for (const r of regions) {
    assert.ok(r.quote.length <= 400,
      `quote for ${r.id} is ${r.quote.length} chars (> 400)`);
    const doc = paperDoc(r.citation);
    let content = null;
    for (const s of doc.sections) for (const p of s.pars) {
      if (p.par_ref === r.citation) content = norm(p.par_content);
    }
    assert.ok(content !== null, `paragraph ${r.citation} not found`);
    assert.ok(content.includes(norm(r.quote)),
      `quote for ${r.id} is not a verbatim substring of ${r.citation}`);
  }
});

test('no orphan regions: SVG data-region <-> dataset ids match exactly', () => {
  const svg = html.slice(html.indexOf('<svg'), html.indexOf('</svg>'));
  const inSvg = new Set([...svg.matchAll(/data-region="([^"]+)"/g)].map(x => x[1]));
  const inData = new Set(regions.map(r => r.id));
  for (const id of inSvg) assert.ok(inData.has(id), `SVG references unknown region ${id}`);
  for (const id of inData) assert.ok(inSvg.has(id), `dataset region ${id} has no SVG element`);
  assert.ok(inSvg.size > 0, 'expected data-region attributes in the SVG');
});

test('no external URLs or out-of-folder references in index.html', () => {
  const bad = [
    [/https?:\/\//, 'absolute http(s) URL'],
    [/src="\//, 'root-absolute src'],
    [/href="\//, 'root-absolute href'],
    [/\.\.\//, 'parent-directory traversal'],
  ];
  for (const [re, what] of bad) {
    assert.ok(!re.test(html), `index.html contains ${what}: ${html.match(re)?.[0]}`);
  }
});
