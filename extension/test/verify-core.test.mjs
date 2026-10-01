/**
 * Unit tests for extension/js/verify-core.js — the dependency-free port of
 * ub-verify.js's comparison engine used by the UB Quote Verifier extension.
 *
 * Run:  node --test extension/test/verify-core.test.mjs   (from the repo root)
 *
 * Fixtures are derived from the local book text (source-texts/, downloaded by
 * fetch-data.js) at test time — no real paragraphs are pasted into this file.
 * If the text was never downloaded, the suite skips with a clear message.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const UBVerify = require('../js/verify-core.js');
const { hasBookText, makeNodeProvider } = await import('./node-source.mjs');

const HAS_TEXT = hasBookText();
if (!HAS_TEXT) {
  console.log('SKIP: source-texts/ not present — run `node fetch-data.js` first, then re-run these tests.');
}

describe('verify-core', { skip: !HAS_TEXT }, () => {
  let provider;
  it('builds a provider over the local book text', async () => {
    provider = makeNodeProvider(UBVerify);
    const t = await provider.getParagraph('180:2.2');
    assert.ok(t && t.length > 50, 'expected real paragraph text for 180:2.2');
    const missing = await provider.getParagraph('180:2.99');
    assert.equal(missing, null);
  });

  it('PASS: exact wording with the correct citation', async () => {
    const text = await provider.getParagraph('180:2.2');
    const res = await UBVerify.checkQuote(text, '180:2.2', provider);
    assert.equal(res.status, 'PASS');
  });

  it('PASS: range citation over two consecutive paragraphs', async () => {
    const a = await provider.getParagraph('180:2.1');
    const b = await provider.getParagraph('180:2.2');
    const res = await UBVerify.checkQuote(a + ' ' + b, '180:2.1-2', provider);
    assert.equal(res.status, 'PASS');
    assert.deepEqual(res.refs, ['180:2.1', '180:2.2']);
  });

  it('PASS: ellipsis means words skipped, pieces in order', async () => {
    const text = UBVerify.stripMarkup(await provider.getParagraph('180:2.1'));
    const w = text.split(/\s+/);
    const body = w.slice(0, Math.floor(w.length / 2)).join(' ') + ' ... ' + w.slice(Math.floor(w.length / 2)).join(' ');
    const res = await UBVerify.checkQuote(body, '180:2.1', provider);
    assert.equal(res.status, 'PASS');
  });

  it('PUNCTUATION: em dash turned into a comma', async () => {
    const text = await provider.getParagraph('180:2.1');
    assert.ok(text.includes('—'), 'precondition: 180:2.1 contains an em dash');
    const altered = text.replace(/—/g, ',');
    const res = await UBVerify.checkQuote(altered, '180:2.1', provider);
    assert.equal(res.status, 'PUNCTUATION');
    assert.match(res.detail, /same words, different punctuation/);
  });

  it('MISMATCH: right words, wrong citation — reports the true paragraph', async () => {
    const text = await provider.getParagraph('180:2.2');
    const res = await UBVerify.checkQuote(text, '53:1.6', provider);
    assert.equal(res.status, 'MISMATCH');
    assert.ok(res.foundAt.includes('180:2.2'), `expected foundAt to include 180:2.2, got ${res.foundAt}`);
  });

  it('MISMATCH: substituted word is caught and shown', async () => {
    const text = await provider.getParagraph('180:2.2');
    assert.match(text, /loved/);
    const altered = text.replace('loved', 'cherished');
    const res = await UBVerify.checkQuote(altered, '180:2.2', provider);
    assert.equal(res.status, 'MISMATCH');
    assert.ok(res.changes.some((c) => /cherished/.test(c.quoteSays) && /loved/.test(c.bookSays)),
      `expected a cherished/loved diff, got ${JSON.stringify(res.changes)}`);
  });

  it('MISMATCH: Bible wording offered as UB text is caught (bench Q02 case)', async () => {
    // Gemini 3.1 Pro's bench answer: KJV Luke 15:20 wording cited to UB 169:1.9.
    // Recorded verbatim in ub-bench/results/2026-09-24/RESULTS.md.
    const kjv = 'But when he was yet a great way off, his father saw him, and had compassion, and ran, and fell on his neck, and kissed him';
    const res = await UBVerify.checkQuote(kjv, '169:1.9', provider);
    assert.equal(res.status, 'MISMATCH');
    assert.ok(!res.foundAt.includes('169:1.9'), 'the KJV wording must not verify against 169:1.9');
    // and the book's real paragraph still passes, proving the citation exists
    const real = await provider.getParagraph('169:1.9');
    assert.ok(real && real.length > 50);
    const ok = await UBVerify.checkQuote(real, '169:1.9', provider);
    assert.equal(ok.status, 'PASS');
  });

  it('NOT FOUND: cited paragraph does not exist', async () => {
    const res = await UBVerify.checkQuote(
      'The midwayers held their annual conclave beneath the violet seas of Andronover.',
      '180:2.99',
      provider
    );
    assert.equal(res.status, 'NOT FOUND');
    assert.match(res.detail, /does not exist/);
  });

  it('NOT FOUND: unparseable citation', async () => {
    const text = await provider.getParagraph('180:2.2');
    const res = await UBVerify.checkQuote(text, 'not a citation', provider);
    assert.equal(res.status, 'NOT FOUND');
  });
});

describe('parity with ub-verify.js', { skip: !HAS_TEXT }, () => {
  // The port must return the same verdicts as the original engine on the same inputs.
  // Drafts are built from the provider's text at test time — no book excerpts in this file.
  const cli = require('../../ub-verify.js');
  it('matches ub-verify.js verdict for verdict', async () => {
    const prov = makeNodeProvider(UBVerify);
    const t22 = await prov.getParagraph('180:2.2');
    const t21 = await prov.getParagraph('180:2.1');
    const cases = [
      [`"${t22}" (180:2.2)`, '180:2.2'],                            // exact -> PASS
      [`"${t21.replace(/—/g, ',')}" (180:2.1)`, '180:2.1'],         // punctuation-only change
      [`"${t22.replace('loved', 'cherished')}" (180:2.2)`, '180:2.2'], // word substituted
      [`"The Prince's schools were the world's first university." (66:5.6)`, '66:5.6'], // invented
      [`"Anything at all" (180:2.99)`, '180:2.99'],                 // missing paragraph
    ];
    for (const [draft, citation] of cases) {
      const q = cli.extractQuotes(draft)[0];
      assert.ok(q, `ub-verify.js should extract the quote: ${draft.slice(0, 60)}`);
      const expected = cli.checkQuote(q).status;
      const got = (await UBVerify.checkQuote(q.body, citation, prov)).status;
      assert.equal(got, expected, `${citation}: port said ${got}, ub-verify.js said ${expected}`);
    }
  });
});

describe('citations', () => {
  it('expandCitation handles ranges and lists', () => {
    assert.deepEqual(UBVerify.expandCitation('180:2.1'), ['180:2.1']);
    assert.deepEqual(UBVerify.expandCitation('180:2.1-3'), ['180:2.1', '180:2.2', '180:2.3']);
    assert.deepEqual(UBVerify.expandCitation('180:2.1, 180:2.4'), ['180:2.1', '180:2.4']);
    assert.deepEqual(UBVerify.expandCitation('53:1.6'), ['53:1.6']);
  });

  it('extractCitation pulls (P:S.P) out of selected text', () => {
    const r = UBVerify.extractCitation('"Some quoted words from the page." (180:2.1)');
    assert.equal(r.citation, '180:2.1');
    assert.ok(!r.quote.includes('180:2.1'));
    assert.ok(r.quote.includes("quoted words"));
  });

  it('extractCitation finds a bare reference', () => {
    const r = UBVerify.extractCitation('see 180:2.1-3 for the full passage');
    assert.equal(r.citation, '180:2.1-3');
  });

  it('extractCitation returns empty citation when there is none', () => {
    const r = UBVerify.extractCitation('just some words with no reference');
    assert.equal(r.citation, '');
    assert.equal(r.quote, 'just some words with no reference');
  });
});

describe('normalizing', () => {
  it('curly quotes fold to nothing, like ub-verify.js', () => {
    assert.deepEqual(UBVerify.words('“Hello,” she said.'), ['hello', 'she', 'said']);
    assert.equal(UBVerify.exactForm('“Hello”  world'), 'Hello world');
  });
  it('em/en dashes become word separators', () => {
    assert.deepEqual(UBVerify.words('fruit-bearing branches—my friends'), ['fruit', 'bearing', 'branches', 'my', 'friends']);
  });
});
