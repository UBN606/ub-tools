/**
 * Offline tests for ub-api. All network is mocked; fixtures are synthetic.
 *   node --test api/test/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, UB_API_VERSION, DEFAULT_MIRRORS, TOTAL_PAPERS } from '../ub-api.mjs';
import { FIXTURE_DOCS, mockFetch, mockFetchAllPapers } from './fixtures.mjs';

const GOOD = 'https://good.example/b';
const BAD = 'https://bad.example/a';

function clientWith(opts = {}) {
  const { fetchImpl } = mockFetch(opts.mock || {});
  return createClient({ persist: false, fetchImpl, mirrors: opts.mirrors || [GOOD], ...opts.extra });
}

// ---------- mirror failover ----------

test('mirror fallback: tries mirrors in order, uses the first that works', async () => {
  const { fetchImpl, calls } = mockFetch({ failBases: [BAD] });
  const c = createClient({ persist: false, fetchImpl, mirrors: [BAD, GOOD] });
  const r = await c.getParagraph('0:0.1');
  assert.equal(r.text, FIXTURE_DOCS[0].sections[0].pars[0].par_content);
  assert.ok(calls[0].startsWith(BAD), 'first attempt hits the first mirror');
  assert.ok(calls[1].startsWith(GOOD), 'second attempt fails over');
  assert.equal(c.stats().lastMirror, GOOD);
});

test('mirror fallback: all mirrors down surfaces an error, not a fake result', async () => {
  const { fetchImpl } = mockFetch({ failAll: true });
  const c = createClient({ persist: false, fetchImpl, mirrors: [BAD, GOOD] });
  const r = await c.getParagraph('0:0.1');
  assert.match(r.error, /mock network failure|all mirrors failed/);
  const v = await c.verifyQuote('anything', '0:0.1');
  assert.equal(v.status, 'ERROR', 'verifyQuote must not report NOT FOUND on network failure');
});

// ---------- getParagraph ----------

test('getParagraph: exact text with full citation metadata', async () => {
  const c = clientWith();
  const r = await c.getParagraph('1:1.1');
  assert.equal(r.ref, '1:1.1');
  assert.equal(r.text, 'I am the true vine of the garden, and the gardener tends it.');
  assert.equal(r.paper, 1);
  assert.equal(r.paperTitle, 'The Test Paper');
  assert.equal(r.section, 1);
  assert.equal(r.sectionTitle, '1. The Garden');
  assert.ok(r.textPlain && !r.textPlain.includes('<'), 'textPlain strips markup');
});

test('getParagraph: bad references are rejected, not fetched', async () => {
  const { fetchImpl, calls } = mockFetch();
  const c = createClient({ persist: false, fetchImpl, mirrors: [GOOD] });
  for (const bad of ['abc', '1:2', '999:1.1', '1:1.9999x', '']) {
    const r = await c.getParagraph(bad);
    assert.ok(r.error, `expected error for ${JSON.stringify(bad)}`);
  }
  const missing = await c.getParagraph('1:9.9');
  assert.equal(missing.error, 'Reference not found');
  assert.equal(calls.length, 1, 'only the well-formed unknown ref triggered a fetch');
});

test('getParagraph: paper docs are cached in memory', async () => {
  const { fetchImpl, calls } = mockFetch();
  const c = createClient({ persist: false, fetchImpl, mirrors: [GOOD] });
  await c.getParagraph('0:0.1');
  await c.getParagraph('0:0.2');
  assert.equal(calls.filter(u => u.includes('Doc000.json')).length, 1);
  assert.ok(c.stats().cacheHits >= 1);
});

// ---------- getSection ----------

test('getSection: paragraphs with titles; untitled section becomes Introduction', async () => {
  const c = clientWith();
  const s = await c.getSection(1, 1);
  assert.equal(s.paperTitle, 'The Test Paper');
  assert.equal(s.sectionTitle, '1. The Garden');
  assert.equal(s.paragraphs.length, 3);
  assert.equal(s.paragraphs[0].ref, '1:1.1');
  const intro = await c.getSection(1, 0);
  assert.equal(intro.sectionTitle, 'Introduction');
  const nope = await c.getSection(1, 99);
  assert.ok(nope.error);
});

// ---------- search ----------

async function searchedClient() {
  const c = clientWith();
  await c.getParagraph('0:0.1');
  await c.getParagraph('1:1.1');
  await c.getParagraph('2:3.1');
  return c;
}

test('search: whole-word from word start — "vine" hits vine/vines, never "divine"', async () => {
  const c = await searchedClient();
  const r = c.search('vine');
  const refs = r.results.map(x => x.ref);
  assert.ok(refs.includes('1:1.1'), 'vine');
  assert.ok(refs.includes('1:1.2'), 'vines');
  assert.ok(!refs.includes('1:1.3'), 'must not match "divine"');
  assert.equal(r.complete, false, 'only 3 of 197 papers cached');
  assert.equal(r.searchedPapers, 3);
});

test('search: spans cached papers, honors paper filter and limit', async () => {
  const c = await searchedClient();
  const all = c.search('fox');
  assert.ok(all.results.some(r => r.ref === '0:0.1'));
  assert.ok(all.results.some(r => r.ref === '2:3.1'));
  const filtered = c.search('fox', { paper: 0 });
  assert.ok(filtered.results.length > 0 && filtered.results.every(r => r.paper === 0));
  const limited = c.search('the', { limit: 2 });
  assert.equal(limited.results.length, 2);
  for (const r of all.results) {
    assert.ok(r.snippet && r.snippet.length > 0, 'snippet present');
    assert.ok(r.ref && r.paperTitle, 'citation present');
  }
});

test('search: exact phrase outranks partial matches', async () => {
  const c = await searchedClient();
  const r = c.search('true vine');
  assert.equal(r.results[0].ref, '1:1.1');
});

// ---------- verifyQuote ----------

test('verifyQuote: PASS on exact wording', async () => {
  const c = clientWith();
  const v = await c.verifyQuote('The fox — swift and brown — jumps over fences.', '2:3.1');
  assert.equal(v.status, 'PASS');
});

test('verifyQuote: PUNCTUATION when only punctuation differs', async () => {
  const c = clientWith();
  const v = await c.verifyQuote('The fox, swift and brown, jumps over fences.', '2:3.1');
  assert.equal(v.status, 'PUNCTUATION');
});

test('verifyQuote: MISMATCH on changed wording, with a diff', async () => {
  const c = clientWith();
  const v = await c.verifyQuote('The fox — slow and brown — jumps over fences.', '2:3.1');
  assert.equal(v.status, 'MISMATCH');
  assert.match(v.detail, /slow|swift/);
});

test('verifyQuote: range citations join paragraphs', async () => {
  const c = clientWith();
  const v = await c.verifyQuote(
    'The fox — swift and brown — jumps over fences. Testing one two three, the fixture paper ends here.',
    '2:3.1-2'
  );
  assert.equal(v.status, 'PASS');
});

test('verifyQuote: NOT FOUND for a nonexistent paragraph', async () => {
  const c = clientWith();
  const v = await c.verifyQuote('The fox jumps.', '2:3.99');
  assert.equal(v.status, 'NOT FOUND');
});

test('verifyQuote: ellipsis and bracket insertions are allowed', async () => {
  const c = clientWith();
  const v = await c.verifyQuote('The fox — swift and brown — [truly] jumps ... over fences.', '2:3.1');
  assert.equal(v.status, 'PASS');
});

// ---------- prefetchAll / listPapers ----------

test('prefetchAll loads every paper; listPapers lists them', async () => {
  const { fetchImpl, calls } = mockFetchAllPapers();
  const c = createClient({ persist: false, fetchImpl, mirrors: [GOOD] });
  let progressCalls = 0;
  const pre = await c.prefetchAll(() => progressCalls++, 8);
  assert.equal(pre.cachedPapers, TOTAL_PAPERS);
  assert.ok(progressCalls > 0, 'onProgress fires');
  assert.equal(new Set(calls).size, TOTAL_PAPERS, 'one fetch per paper');
  const papers = await c.listPapers();
  assert.equal(papers.length, TOTAL_PAPERS);
  assert.equal(papers[0].title, 'Paper 0');
  assert.equal(papers[196].title, 'Paper 196');
}, { timeout: 30000 });

// ---------- module surface ----------

test('module exposes version, mirrors, and paper count', () => {
  assert.match(UB_API_VERSION, /^\d+\.\d+\.\d+$/);
  assert.ok(Array.isArray(DEFAULT_MIRRORS) && DEFAULT_MIRRORS.length >= 2);
  assert.equal(TOTAL_PAPERS, 197);
});
