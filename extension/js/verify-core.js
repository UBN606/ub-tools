/**
 * UB Verify core — dependency-free quote verification for The Urantia Book.
 *
 * This is a faithful port of the comparison engine in ub-verify.js (repo root),
 * rewritten async so the text can come from anywhere: the filesystem (node tests),
 * IndexedDB (the browser extension), or any other provider.
 *
 * Works in browsers (MV3 service workers, popups) and in node. No dependencies.
 * In node:  const UBVerify = require('./js/verify-core.js');
 * In browser: <script src="js/verify-core.js"></script>  ->  globalThis.UBVerify
 *
 * Provider interface (all async):
 *   getParagraph(ref)  -> Promise<string|null>   exact paragraph text for "180:2.1"
 *   corpus()           -> Promise<Array<{ref, words}>>  every paragraph's word form,
 *                        used only to locate a quote whose citation is wrong
 *
 * Verdicts (same as ub-verify.js):
 *   PASS         exact (straight vs curly quote marks are treated as the same)
 *   PUNCTUATION  same words, different punctuation — detail shows where they diverge
 *   MISMATCH     words added, dropped or changed — detail shows the diff; when the
 *                words appear verbatim elsewhere, foundAt names the true paragraph(s)
 *   NOT FOUND    the cited paragraph does not exist
 *
 * An ellipsis (... or …) inside a quote means "words skipped"; each piece must
 * appear in order. [Square brackets] are treated as an editorial insertion and skipped.
 * A fitted first letter ("judgment" for the book's "Judgment") and closing
 * punctuation are tolerated, as in ub-verify.js.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.UBVerify = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------- normalizing (identical semantics to ub-verify.js) ----------
  const QUOTES = /[“”„‟"‘’‚‛'`´]/g;
  function foldQuotes(s) { return s.replace(QUOTES, ''); }
  function squash(s) { return s.replace(/\s+/g, ' ').trim(); }
  function stripMarkup(s) {
    return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&rsquo;|&lsquo;/g, '’')
      .replace(/&rdquo;|&ldquo;|&quot;/g, '"').replace(/[*_]{1,3}/g, '')
      .replace(/^\s*>\s?/gm, ' ');
  }
  // exact form: only quote marks and spacing are ignored
  function exactForm(s) { return squash(foldQuotes(s)); }
  // words form: punctuation and case ignored
  function words(s) {
    return foldQuotes(s).toLowerCase().replace(/[—–-]/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  }

  // ---------- citations ----------
  // "180:2.1-3", "180:2.1–2.3", "180:2.1 through 180:2.3", "180:2.1, 180:2.4", "180:2.1; 2.4"
  function expandCitation(inner) {
    const refs = [];
    const re = /(\d+):(\d+)\.(\d+)(?:\s*(?:-|–|—|through|to)\s*(?:(\d+):)?(?:(\d+)\.)?(\d+))?/g;
    let m;
    while ((m = re.exec(inner))) {
      const p = m[1], s = m[2], a = m[3], p2 = m[4], s2 = m[5], b = m[6];
      if (b === undefined) { refs.push(`${p}:${s}.${a}`); continue; }
      if ((p2 && p2 !== p) || (s2 && s2 !== s)) { refs.push(`${p}:${s}.${a}`, `${p2 || p}:${s2 || s}.${b}`); continue; }
      const lo = parseInt(a, 10), hi = parseInt(b, 10);
      if (hi < lo || hi - lo > 40) { refs.push(`${p}:${s}.${a}`); continue; }
      for (let i = lo; i <= hi; i++) refs.push(`${p}:${s}.${i}`);
    }
    return [...new Set(refs)];
  }

  const CITE_PAREN = /\(([^()]*?\d+:\d+\.\d+[^()]*?)\)/;
  const CITE_BARE = /(\d{1,3}:\d+\.\d+(?:\s*(?:-|–|—|through|to)\s*(?:\d+:)?(?:\d+\.)?\d+)?(?:\s*[,;]\s*\d{1,3}:\d+\.\d+)*)/;

  /**
   * Pull a UB citation out of selected text, e.g. '"...quote..." (180:2.1)'.
   * Returns { citation, quote } with the citation removed from the quote text.
   * citation is '' when none is found.
   */
  function extractCitation(text) {
    let m = text.match(CITE_PAREN);
    if (m) return { citation: m[1].trim(), quote: (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).trim() };
    m = text.match(CITE_BARE);
    if (m) return { citation: m[1].trim(), quote: (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).trim() };
    return { citation: '', quote: text.trim() };
  }

  // ---------- comparison ----------
  function lcsAlign(a, b) {
    // a = quote words, b = source words; returns matched index pairs
    const n = a.length, m = b.length;
    if (n * m > 4e6) return null;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const pairs = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
    }
    return pairs;
  }

  function describeWordDiff(qWords, sWords) {
    const pairs = lcsAlign(qWords, sWords);
    if (!pairs || !pairs.length) return { summary: 'no overlap with the cited paragraph; the quote may be invented or cite the wrong paragraph', changes: [] };
    const changes = [];
    let qi = 0, si = pairs[0][1];
    const all = [...pairs, [qWords.length, pairs[pairs.length - 1][1] + 1]];
    for (const [qa, sa] of all) {
      const added = qWords.slice(qi, qa), dropped = sWords.slice(si, sa);
      if (added.length || dropped.length) changes.push({ quoteSays: added.join(' ') || '(nothing)', bookSays: dropped.join(' ') || '(nothing)' });
      qi = qa + 1; si = sa + 1;
    }
    const matched = pairs.length / qWords.length;
    return { summary: `${Math.round(matched * 100)}% of the quote's words match the cited text`, changes: changes.slice(0, 8) };
  }

  // corpus index cache, one per provider instance
  const corpusCache = new WeakMap();
  async function getCorpus(provider) {
    if (!corpusCache.has(provider)) corpusCache.set(provider, await provider.corpus());
    return corpusCache.get(provider);
  }

  // Search the whole book for a quote's words (used when the cited paragraph does not match)
  async function findElsewhere(pieces, provider) {
    const index = await getCorpus(provider);
    const longest = pieces.map(p => words(p)).sort((a, b) => b.length - a.length)[0] || [];
    if (longest.length < 4) return [];
    const needle = ' ' + longest.join(' ') + ' ';
    return index.filter(e => e.words.includes(needle)).map(e => e.ref).slice(0, 5);
  }

  /**
   * Check one alleged quotation against the book.
   * @param {string} body     the quoted words (without the citation)
   * @param {string} citation e.g. "180:2.1" or "180:2.1-3"
   * @param {object} provider { getParagraph, corpus }
   * @returns {Promise<{status, detail, refs, foundAt?, changes?}>}
   */
  async function checkQuote(body, citation, provider) {
    const refs = expandCitation(citation || '');
    if (!refs.length) {
      return { status: 'NOT FOUND', detail: 'could not parse a Paper:Section.Paragraph citation — add one like (180:2.1)', refs, foundAt: [] };
    }
    const texts = [];
    const missing = [];
    for (const r of refs) {
      const t = await provider.getParagraph(r);
      if (t == null) missing.push(r); else texts.push(t);
    }
    if (missing.length === refs.length) {
      const where = await findElsewhere([stripMarkup(body)], provider);
      return {
        status: 'NOT FOUND',
        detail: `cited paragraph does not exist: ${missing.join(', ')}${where.length ? `. The quoted words appear verbatim at ${where.join(', ')}.` : ''}`,
        refs, foundAt: where,
      };
    }
    // the source JSON carries markup (<sup>th</sup>, <em>) and footnote asterisks; compare text only
    const source = stripMarkup(texts.join(' ')).replace(/\*/g, '');
    const pieces = stripMarkup(body).split(/\.\.\.|…|\[[^\]]*\]/).map(s => s.trim()).filter(s => words(s).length);
    if (!pieces.length) return { status: 'PASS', detail: 'empty after removing ellipses', refs };

    const srcExact = exactForm(source);
    const srcWordsStr = ' ' + words(source).join(' ') + ' ';
    let exact = true, wordsOk = true, from = 0, wfrom = 0;
    const punct = [];
    for (const piece of pieces) {
      // trim leading/trailing punctuation left by ellipsis splits
      // Standard quoting fits a quote into our sentence: the first letter's case and the closing
      // punctuation may change ("Judgment in such..." quoted as "judgment in such...", "him." as "him,").
      // Words, inner punctuation and the book's dashes must still match exactly.
      const pe = exactForm(piece).replace(/^[\s,;:.!?—–-]+|[\s,;:.!?—–-]+$/g, '');
      const swap = pe ? (pe[0] === pe[0].toLowerCase() ? pe[0].toUpperCase() : pe[0].toLowerCase()) + pe.slice(1) : pe;
      let idx = srcExact.indexOf(pe, from);
      if (idx < 0) idx = srcExact.indexOf(swap, from);
      if (idx >= 0) { from = idx + pe.length; } else exact = false;
      const pw = ' ' + words(piece).join(' ') + ' ';
      const widx = srcWordsStr.indexOf(pw, wfrom);
      if (widx >= 0) {
        wfrom = widx + pw.length - 1;
        if (idx < 0) punct.push(piece);
      } else wordsOk = false;
    }
    const note = missing.length ? ` (also cites missing paragraph ${missing.join(', ')})` : '';
    if (exact && !missing.length) return { status: 'PASS', detail: '', refs };
    if (exact) return { status: 'NOT FOUND', detail: `quote matches, but cites a paragraph that does not exist: ${missing.join(', ')}`, refs };
    if (wordsOk) {
      // show the first point where the draft's punctuation departs from the book's
      const draftText = exactForm(punct[0] || '').replace(/^[\s,;:.!?—–-]+|[\s,;:.!?—–-]+$/g, '');
      const w = words(draftText);
      let draftAt = '', bookAt = '';
      if (w.length) {
        const re = new RegExp(w.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^\\p{L}\\p{N}]+'), 'iu');
        const mm = srcExact.match(re);
        if (mm) {
          const book = mm[0];
          let i = 0;
          while (i < book.length && i < draftText.length && book[i].toLowerCase() === draftText[i].toLowerCase()) i++;
          const from = Math.max(0, i - 40);
          draftAt = (from ? '...' : '') + draftText.slice(from, i + 40) + '...';
          bookAt = (from ? '...' : '') + book.slice(from, i + 40) + '...';
        }
      }
      return {
        status: 'PUNCTUATION',
        detail: `same words, different punctuation${note}. Restore the book's punctuation.\nquote: ${draftAt || squash(punct[0] || '').slice(0, 120)}\nbook:  ${bookAt || '(see citation)'}`,
        refs,
      };
    }
    const d = describeWordDiff(words(pieces.join(' ')), words(source));
    const where = await findElsewhere(pieces, provider);
    const hint = where.length ? ` The quoted words appear verbatim at ${where.join(', ')}; the citation may be wrong.` : '';
    return {
      status: 'MISMATCH',
      detail: `${d.summary}${note}.${hint}`,
      changes: where.length ? [] : d.changes,
      foundAt: where,
      refs,
    };
  }

  return { foldQuotes, squash, stripMarkup, exactForm, words, expandCitation, extractCitation, checkQuote, findElsewhere };
});
