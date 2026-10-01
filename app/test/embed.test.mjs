/**
 * embed.test.mjs — tests for the embeddable daily-quote widget.
 *
 * Run: node --test app/test/embed.test.mjs   (from repo root)
 *
 * Covers:
 *  - the widget file is dependency-free plain script (no import/export,
 *    no fetch/XHR -> offline guarantee: zero network beyond the script tag)
 *  - bank size >= 50 and every entry well-formed
 *  - pick() determinism (same date -> same quote; consecutive days differ;
 *    full bank-length cycle returns to the same quote)
 *  - EVERY bank quote verifies PASS with the real ub-verify.js CLI against
 *    its own citation
 *  - mount() renders namespaced, XSS-escaped HTML with citation + verified link
 *  - auto-mount on DOMContentLoaded for [data-ub-quote] elements
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const dir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(dir, '..');
const root = path.resolve(appDir, '..');
const SRC = fs.readFileSync(path.join(appDir, 'embed-quote.js'), 'utf8');

function extractBank() {
  const m = SRC.match(/var UBQ_BANK = (\[[\s\S]*?\]);/);
  assert.ok(m, 'generated bank array found in embed-quote.js');
  return JSON.parse(m[1]);
}

// Run the plain (non-module) script with stub window/document.
function loadWidget(readyState = 'complete', initialEls = []) {
  const window = {};
  const listeners = {};
  const els = initialEls.slice();
  const document = {
    readyState,
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    querySelectorAll: (sel) => (sel === '[data-ub-quote]' ? els : []),
    createElement: () => ({
      attrs: {}, children: [],
      appendChild(c) { this.children.push(c); return c; },
      setAttribute(k, v) { this.attrs[k] = v; },
    }),
    createTextNode: (t) => ({ text: t }),
    getElementById: () => null,
    getElementsByTagName: () => [{ appendChild() {} }],
    documentElement: { appendChild() {} },
  };
  const factory = new Function('window', 'document', SRC + '\nreturn window.UBQuoteWidget;');
  const widget = factory(window, document);
  return { widget, document, listeners, els };
}

function fakeEl(theme) {
  return {
    innerHTML: '',
    attrs: theme ? { 'data-theme': theme } : {},
    getAttribute(n) { return this.attrs[n] || null; },
  };
}

test('widget file is dependency-free plain script (offline guarantee)', () => {
  assert.ok(!/^\s*import\b/m.test(SRC), 'no import statements');
  assert.ok(!/\bexport\b/.test(SRC), 'no export statements');
  assert.ok(!/require\s*\(/.test(SRC), 'no require() calls');
  assert.ok(!/fetch\s*\(/.test(SRC), 'no fetch() calls');
  assert.ok(!/XMLHttpRequest/.test(SRC), 'no XMLHttpRequest');
  assert.ok(!/\.ajax\s*\(/.test(SRC), 'no jQuery-style ajax');
});

test('bank has >= 50 entries and every entry is well-formed', () => {
  const bank = extractBank();
  assert.ok(bank.length >= 50, `bank size ${bank.length} >= 50`);
  const seen = new Set();
  bank.forEach((x, i) => {
    assert.ok(typeof x.q === 'string' && x.q.length >= 60 && x.q.length <= 160,
      `#${i + 1}: quote is 60-160 chars`);
    assert.ok(/^\d{1,3}:\d{1,2}\.\d{1,2}$/.test(x.c), `#${i + 1}: citation format (${x.c})`);
    assert.ok(typeof x.t === 'string' && x.t.length > 0, `#${i + 1}: topic tag present`);
    assert.ok(!seen.has(x.q), `#${i + 1}: no duplicate quotes`);
    seen.add(x.q);
  });
});

test('widget exposes window.UBQuoteWidget with mount and pick', () => {
  const { widget } = loadWidget();
  assert.equal(typeof widget.mount, 'function', 'mount is a function');
  assert.equal(typeof widget.pick, 'function', 'pick is a function');
});

test('pick() is deterministic: same date -> same quote', () => {
  const { widget } = loadWidget();
  const a = widget.pick('2026-09-30');
  const b = widget.pick('2026-09-30');
  assert.deepEqual(a, b, 'same date string gives same quote');
  assert.deepEqual(widget.pick(new Date('2026-09-30T00:00:00Z')), a, 'Date object matches date string');
  assert.deepEqual(widget.pick(new Date(Date.UTC(2026, 8, 30))), a, 'UTC midnight matches');
});

test('pick() defaults to today when no date is given', () => {
  const { widget } = loadWidget();
  const q = widget.pick();
  assert.ok(q && typeof q.q === 'string' && typeof q.c === 'string', 'pick() returns a bank entry');
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  assert.deepEqual(q, widget.pick(todayStr), 'pick() equals pick(today)');
});

test('pick(): consecutive days differ; a full cycle returns to the same quote', () => {
  const { widget } = loadWidget();
  const bank = extractBank();
  const d0 = widget.pick('2026-09-30');
  const d1 = widget.pick('2026-10-01');
  assert.notDeepEqual(d0, d1, 'consecutive days give different quotes');
  const later = new Date(Date.UTC(2026, 8, 30) + bank.length * 86400000);
  assert.deepEqual(widget.pick(later.toISOString().slice(0, 10)), d0,
    `date + ${bank.length} days cycles back to the same quote`);
});

test('every bank quote verifies PASS with ub-verify.js against its citation', () => {
  const bank = extractBank();
  const tmp = path.join(os.tmpdir(), `ubq-embed-test-${process.pid}.txt`);
  fs.writeFileSync(tmp, bank.map((x) => `"${x.q}" (${x.c})`).join('\n') + '\n');
  let report;
  try {
    const out = execFileSync('node', [path.join(root, 'ub-verify.js'), tmp, '--quotes-only', '--json'],
      { encoding: 'utf8', cwd: root });
    report = JSON.parse(out);
  } finally {
    fs.unlinkSync(tmp);
  }
  const quotes = (report[0] && report[0].quotes) || [];
  assert.equal(quotes.length, bank.length, 'ub-verify saw every bank quote');
  quotes.forEach((q, i) => {
    assert.equal(q.status, 'PASS', `quote #${i + 1} (${q.citation}) verifies PASS, got ${q.status}`);
  });
});

test('mount() renders namespaced HTML with citation and verified link', () => {
  const { widget } = loadWidget();
  const el = fakeEl();
  const item = widget.mount(el, { theme: 'light' });
  assert.ok(item, 'mount returns the picked quote');
  assert.ok(el.innerHTML.includes('class="ubq-widget ubq-light"'), 'namespaced widget classes');
  assert.ok(el.innerHTML.includes('class="ubq-quote"'), 'blockquote class');
  assert.ok(el.innerHTML.includes(`(The Urantia Book, ${item.c})`), 'citation rendered');
  assert.ok(el.innerHTML.includes('https://ubn606.github.io/ub-tools/app/'), 'Studio link present');
  assert.ok(el.innerHTML.includes('Verified with UB Tools'), 'verified label present');
  assert.ok(el.innerHTML.includes(item.q), 'quote text rendered');
});

test('mount() themes: dark, invalid fallback, showCitation:false', () => {
  const { widget } = loadWidget();
  const dark = fakeEl();
  widget.mount(dark, { theme: 'dark' });
  assert.ok(dark.innerHTML.includes('ubq-dark'), 'dark theme class applied');
  const bogus = fakeEl();
  widget.mount(bogus, { theme: 'nope' });
  assert.ok(bogus.innerHTML.includes('ubq-auto'), 'invalid theme falls back to auto');
  const noCite = fakeEl();
  widget.mount(noCite, { showCitation: false });
  assert.ok(!noCite.innerHTML.includes('ubq-cite'), 'citation hidden when showCitation:false');
  assert.ok(!noCite.innerHTML.includes('Verified with UB Tools'), 'verified link hidden when showCitation:false');
  assert.equal(widget.mount(null), null, 'mount(null) returns null without throwing');
});

test('mount() output is XSS-escaped (esc unit check + wired into render)', () => {
  const m = SRC.match(/function esc\(s\) \{[\s\S]*?\n  \}/);
  assert.ok(m, 'esc() helper present in widget source');
  const esc = new Function(m[0] + '\nreturn esc;')();
  assert.equal(
    esc('<script>alert("x")</script> & \'quoted\''),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quoted&#39;',
    'esc() neutralizes HTML metacharacters');
  assert.ok(/esc\(item\.q\)/.test(SRC), 'quote rendered through esc()');
  assert.ok(/esc\(item\.c\)/.test(SRC), 'citation rendered through esc()');
  const { widget } = loadWidget();
  const el = fakeEl();
  widget.mount(el, {});
  assert.ok(!/<script/i.test(el.innerHTML), 'rendered HTML contains no script tag');
});

test('auto-mount: mounts into every [data-ub-quote] on DOMContentLoaded', () => {
  const { listeners, els } = loadWidget('loading');
  const el = fakeEl('dark');
  els.push(el);
  assert.ok(listeners.DOMContentLoaded && listeners.DOMContentLoaded.length === 1,
    'DOMContentLoaded listener registered while loading');
  listeners.DOMContentLoaded.forEach((fn) => fn());
  assert.ok(el.innerHTML.includes('ubq-widget ubq-dark'),
    'auto-mount rendered with data-theme="dark"');
});

test('auto-mount: mounts immediately when script loads after DOM is ready', () => {
  const el = fakeEl('light');
  const { listeners } = loadWidget('complete', [el]);
  assert.ok(!listeners.DOMContentLoaded, 'no listener needed when DOM is already ready');
  assert.ok(el.innerHTML.includes('ubq-widget ubq-light'),
    'elements present at load get mounted immediately');
});
