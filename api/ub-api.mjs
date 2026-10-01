/**
 * UB API — a zero-cost, zero-dependency client for The Urantia Book's exact text.
 *
 * There is no server and no hosting bill. This client fetches the book's JSON text
 * at runtime from public CORS-enabled mirrors (the same Urantiapedia source the
 * repo's fetch-data.js downloads), caches aggressively (memory + IndexedDB in
 * browsers), and fails over between mirrors automatically.
 *
 * The book text is never bundled and never committed: each user downloads it
 * directly from Urantiapedia (CC BY-SA 4.0). Every method returns citations;
 * the client surfaces exact text and never paraphrases.
 *
 * Usage:
 *   <script src="ub-api.js"></script>            -> window.UBApi
 *   const UBApi = require('./ub-api.js');        -> Node (CJS)
 *   import { getParagraph } from './ub-api.mjs'; -> Node / bundlers (ESM)
 *
 * ub-api.mjs is the source of truth; ub-api.js is the UMD build (see build.mjs).
 */

export const UB_API_VERSION = '1.0.0';

export const DEFAULT_MIRRORS = [
  // jsDelivr CDN over the Urantiapedia GitHub repo. CORS: access-control-allow-origin: * (verified).
  'https://cdn.jsdelivr.net/gh/JanHerca/urantiapedia@master/input/json/book-en',
  // Raw GitHub fallback. CORS: Access-Control-Allow-Origin: * (verified).
  'https://raw.githubusercontent.com/JanHerca/urantiapedia/master/input/json/book-en',
];

export const TOTAL_PAPERS = 197; // Doc000.json .. Doc196.json

const REF_RE = /^(\d{1,3}):(\d{1,3})\.(\d{1,3})$/;
const STOP_WORDS = new Set(
  'a an and are as at be but by for from had has have he his i in is it its not of on or our that the their them they this to was we were which who will with you your'.split(' ')
);

// ---------- text utilities (same semantics as the repo's ub-verify.js / ub-search.js) ----------

const QUOTE_MARKS = /[“”„‟"‘’‚‛'`´]/g;

function foldQuotes(s) { return s.replace(QUOTE_MARKS, ''); }
function squash(s) { return s.replace(/\s+/g, ' ').trim(); }

function stripMarkup(s) {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&rsquo;|&lsquo;/g, '’')
    .replace(/&rdquo;|&ldquo;|&quot;/g, '"')
    .replace(/[*_]{1,3}/g, '');
}

// Exact form: only quote marks and spacing are ignored.
function exactForm(s) { return squash(foldQuotes(s)); }

// Words form: punctuation and case ignored.
function wordsOf(s) {
  return foldQuotes(s)
    .toLowerCase()
    .replace(/[—–-]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function plainText(parContent) {
  return squash(stripMarkup(parContent).replace(/\*/g, ''));
}

// ---------- citation parsing ----------

// "180:2.1-3", "180:2.1–2.3", "180:2.1" -> ["180:2.1", "180:2.2", "180:2.3"]
function expandCitation(citation) {
  const refs = [];
  const re = /(\d+):(\d+)\.(\d+)(?:\s*(?:-|–|—|through|to)\s*(?:(\d+):)?(?:(\d+)\.)?(\d+))?/g;
  let m;
  while ((m = re.exec(String(citation)))) {
    const p = m[1], s = m[2], a = m[3], p2 = m[4], s2 = m[5], b = m[6];
    if (b === undefined) { refs.push(`${p}:${s}.${a}`); continue; }
    if ((p2 && p2 !== p) || (s2 && s2 !== s)) { refs.push(`${p}:${s}.${a}`, `${p2 || p}:${s2 || s}.${b}`); continue; }
    const lo = parseInt(a, 10), hi = parseInt(b, 10);
    if (hi < lo || hi - lo > 40) { refs.push(`${p}:${s}.${a}`); continue; }
    for (let i = lo; i <= hi; i++) refs.push(`${p}:${s}.${i}`);
  }
  return [...new Set(refs)];
}

function parseRef(ref) {
  const m = String(ref).trim().match(REF_RE);
  if (!m) return null;
  const paper = parseInt(m[1], 10), section = parseInt(m[2], 10), par = parseInt(m[3], 10);
  if (paper < 0 || paper > 196) return null;
  return { paper, section, par };
}

function docFileName(paperIndex) {
  return `Doc${String(paperIndex).padStart(3, '0')}.json`;
}

// ---------- search term building (mirrors ub-search.js) ----------

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function buildSearchMatchers(query) {
  const exactPhrase = String(query).toLowerCase().trim().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  let terms = exactPhrase.split(/\s+/).map(t => t.replace(/[^\w'-]/g, '')).filter(t => t.length > 1 && !STOP_WORDS.has(t));
  if (!terms.length) terms = exactPhrase.split(/\s+/).filter(Boolean);
  // Whole-word match from a word start: "vine" hits vine/vines, never "divine".
  const termRes = terms.map(t => new RegExp('\\b' + escapeRe(t) + '\\w*', 'gi'));
  const phraseRe = new RegExp('\\b' + escapeRe(exactPhrase).replace(/\s+/g, '\\s+') + '\\b', 'i');
  return { terms, termRes, phraseRe, exactPhrase };
}

// ---------- optional persistent cache (IndexedDB in browsers; memory elsewhere) ----------

function openIdb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    try {
      const req = indexedDB.open('ub-api', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('papers');
      req.onsuccess = () => {
        const db = req.result;
        resolve({
          get(k) {
            return new Promise(res => {
              try {
                const t = db.transaction('papers').objectStore('papers').get(k);
                t.onsuccess = () => res(t.result || null);
                t.onerror = () => res(null);
              } catch (e) { res(null); }
            });
          },
          set(k, v) {
            try { db.transaction('papers', 'readwrite').objectStore('papers').put(v, k); } catch (e) { /* ignore */ }
          },
          clear() {
            try { db.transaction('papers', 'readwrite').objectStore('papers').clear(); } catch (e) { /* ignore */ }
          },
        });
      };
      req.onerror = () => resolve(null);
    } catch (e) { resolve(null); }
  });
}

// ---------- client ----------

export function createClient(options) {
  const opts = options || {};
  const mirrors = (opts.mirrors && opts.mirrors.length ? opts.mirrors : DEFAULT_MIRRORS).slice();
  const fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
  const persist = opts.persist !== false;
  const docs = new Map(); // paperIndex -> doc JSON (memory cache)
  const idbPromise = persist ? openIdb() : Promise.resolve(null);
  const stats = { fetches: 0, cacheHits: 0, persistentHits: 0, lastMirror: null, lastError: null };

  if (!fetchImpl) throw new Error('ub-api: no fetch available; use Node 18+, a browser, or pass { fetchImpl }');

  async function fetchDoc(paperIndex) {
    const url = `${mirrors[0]}/${docFileName(paperIndex)}`;
    void url;
    let lastErr = null;
    for (const base of mirrors) {
      const u = `${base}/${docFileName(paperIndex)}`;
      try {
        stats.fetches++;
        const res = await fetchImpl(u, { headers: { Accept: 'application/json' } });
        if (!res || !res.ok) { lastErr = new Error(`HTTP ${res ? res.status : 'no-response'} for ${u}`); continue; }
        const doc = await res.json();
        if (!doc || !Array.isArray(doc.sections)) { lastErr = new Error(`unexpected JSON shape from ${u}`); continue; }
        stats.lastMirror = base;
        stats.lastError = null;
        return doc;
      } catch (e) {
        lastErr = e;
      }
    }
    stats.lastError = lastErr ? String(lastErr.message || lastErr) : 'all mirrors failed';
    throw lastErr || new Error('all mirrors failed');
  }

  async function getDoc(paperIndex) {
    if (docs.has(paperIndex)) { stats.cacheHits++; return docs.get(paperIndex); }
    const idb = await idbPromise;
    if (idb) {
      const cached = await idb.get(paperIndex);
      if (cached) { stats.persistentHits++; docs.set(paperIndex, cached); return cached; }
    }
    const doc = await fetchDoc(paperIndex);
    docs.set(paperIndex, doc);
    if (idb) idb.set(paperIndex, doc);
    return doc;
  }

  function findParagraph(doc, ref) {
    for (const s of doc.sections) {
      const par = (s.pars || []).find(p => p.par_ref === ref);
      if (par) return { section: s, par };
    }
    return null;
  }

  function paragraphResult(doc, section, par) {
    return {
      ref: par.par_ref,
      page: par.par_pageref,
      paper: doc.paper_index,
      paperTitle: doc.paper_title,
      section: section.section_index,
      sectionTitle: section.section_title || 'Introduction',
      author: doc.author,
      text: par.par_content,       // exact source text, verbatim (canonical for quoting)
      textPlain: plainText(par.par_content), // readable form, markup stripped
    };
  }

  async function getParagraph(ref) {
    const parsed = parseRef(ref);
    if (!parsed) return { ref: String(ref), error: 'Bad reference; use Paper:Section.Paragraph, e.g. 180:2.1' };
    let doc;
    try { doc = await getDoc(parsed.paper); }
    catch (e) { return { ref: String(ref).trim(), error: `Could not load paper ${parsed.paper}: ${e.message || e}` }; }
    const found = findParagraph(doc, String(ref).trim());
    if (!found) return { ref: String(ref).trim(), error: 'Reference not found' };
    return paragraphResult(doc, found.section, found.par);
  }

  async function getSection(paper, section) {
    const paperIndex = Number(paper), sectionIndex = Number(section);
    if (!Number.isInteger(paperIndex) || paperIndex < 0 || paperIndex > 196 ||
        !Number.isInteger(sectionIndex) || sectionIndex < 0) {
      return { error: 'Bad paper/section; use e.g. getSection(180, 2)' };
    }
    let doc;
    try { doc = await getDoc(paperIndex); }
    catch (e) { return { error: `Could not load paper ${paperIndex}: ${e.message || e}` }; }
    const s = doc.sections.find(x => x.section_index === sectionIndex);
    if (!s) return { error: `Section ${sectionIndex} not found in paper ${paperIndex}` };
    return {
      paper: doc.paper_index,
      paperTitle: doc.paper_title,
      section: s.section_index,
      sectionTitle: s.section_title || 'Introduction',
      author: doc.author,
      paragraphs: (s.pars || []).map(p => paragraphResult(doc, s, p)),
    };
  }

  async function prefetchAll(onProgress, concurrency) {
    const total = TOTAL_PAPERS;
    const limit = Math.max(1, Number(concurrency) || 6);
    let done = 0;
    const queue = [];
    for (let i = 0; i < total; i++) if (!docs.has(i)) queue.push(i);
    async function worker() {
      while (queue.length) {
        const idx = queue.shift();
        try { await getDoc(idx); } catch (e) { /* keep going; stats.lastError records it */ }
        done++;
        if (typeof onProgress === 'function') { try { onProgress(done, total); } catch (e) { /* ignore */ } }
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, queue.length || 1) }, worker));
    return { cachedPapers: docs.size, totalPapers: total };
  }

  async function listPapers() {
    await prefetchAll();
    const out = [];
    for (let i = 0; i < TOTAL_PAPERS; i++) {
      const doc = docs.get(i);
      if (doc) out.push({ paper: doc.paper_index, title: doc.paper_title, author: doc.author });
    }
    return out;
  }

  function getStats() {
    return { ...stats, cachedPapers: docs.size, totalPapers: TOTAL_PAPERS, mirrors: mirrors.slice() };
  }

  async function clearCache() {
    docs.clear();
    const idb = await idbPromise;
    if (idb) idb.clear();
    return { cleared: true };
  }

  // ---- search and verifyQuote close over the client's cache (defined below) ----

  function search(query, searchOpts) {
    const so = searchOpts || {};
    const limit = Math.max(1, Number(so.limit) || 20);
    const paperFilter = so.paper === undefined || so.paper === null ? null : Number(so.paper);
    const snippetRadius = Math.max(20, Number(so.snippetRadius) || 80);
    const { terms, termRes, phraseRe } = buildSearchMatchers(query);
    if (!terms.length) return { query: String(query), total: 0, results: [], searchedPapers: docs.size, complete: docs.size >= TOTAL_PAPERS };
    const results = [];
    for (const doc of docs.values()) {
      if (paperFilter !== null && doc.paper_index !== paperFilter) continue;
      for (const s of doc.sections) {
        for (const p of (s.pars || [])) {
          const display = p.par_content;
          const textLower = display.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
          let score = 0;
          const counts = termRes.map(re => (textLower.match(re) || []).length);
          const matched = counts.filter(c => c > 0).length;
          const hits = counts.reduce((a, b) => a + b, 0);
          if (phraseRe.test(textLower)) score = 100;
          else if (matched === terms.length) score = 50;
          else if (matched > 0) score = matched * 10;
          if (score > 0) score += Math.min(hits, 49) / 50;
          if (score <= 0) continue;
          results.push({
            score: Math.round(score * 100) / 100,
            ref: p.par_ref,
            paper: doc.paper_index,
            paperTitle: doc.paper_title,
            sectionTitle: s.section_title || 'Introduction',
            snippet: makeSnippet(display, textLower, termRes, phraseRe, snippetRadius),
          });
        }
      }
    }
    results.sort((a, b) => b.score - a.score);
    return {
      query: String(query),
      total: results.length,
      results: results.slice(0, limit),
      searchedPapers: docs.size,
      complete: docs.size >= TOTAL_PAPERS,
    };
  }

  function makeSnippet(display, textLower, termRes, phraseRe, radius) {
    let pos = -1;
    const pm = phraseRe.exec(textLower);
    if (pm) pos = pm.index;
    else {
      for (const re of termRes) {
        re.lastIndex = 0;
        const m = re.exec(textLower);
        if (m && (pos < 0 || m.index < pos)) pos = m.index;
      }
    }
    if (pos < 0) pos = 0;
    const start = Math.max(0, pos - radius);
    const end = Math.min(display.length, pos + radius);
    return (start > 0 ? '…' : '') + squash(display.slice(start, end)) + (end < display.length ? '…' : '');
  }

  // ---- verifyQuote: same verdict semantics as the repo's ub-verify.js ----

  function lcsAlign(a, b) {
    const n = a.length, m = b.length;
    if (n * m > 400000) return null;
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

  async function verifyQuote(text, citation) {
    const quoteText = String(text || '');
    const refs = expandCitation(citation);
    if (!refs.length) return { status: 'ERROR', detail: 'No citation found; use Paper:Section.Paragraph, e.g. 180:2.1' };
    const parsed = refs.map(parseRef);
    if (parsed.some(p => !p)) return { status: 'NOT FOUND', detail: `cited paragraph does not exist: ${refs.join(', ')}`, refs };

    // Load the cited paragraphs (usually a single paper).
    let source = '', missing = [];
    const papersNeeded = [...new Set(parsed.map(p => p.paper))];
    for (const pi of papersNeeded) {
      let doc;
      try { doc = await getDoc(pi); }
      catch (e) { return { status: 'ERROR', detail: `Could not load paper ${pi}: ${e.message || e}`, refs }; }
      for (const r of refs.filter(x => parseRef(x).paper === pi)) {
        const found = findParagraph(doc, r);
        if (!found) missing.push(r);
        else source += (source ? ' ' : '') + found.par.par_content;
      }
    }
    if (!refs.length || missing.length === refs.length) {
      return { status: 'NOT FOUND', detail: `cited paragraph does not exist: ${(missing.length ? missing : refs).join(', ')}`, refs };
    }
    const src = stripMarkup(source).replace(/\*/g, '');
    const pieces = stripMarkup(quoteText).split(/\.\.\.|…|\[[^\]]*\]/).map(s => s.trim()).filter(s => wordsOf(s).length);
    if (!pieces.length) return { status: 'PASS', detail: 'empty after removing ellipses', refs };

    const srcExact = exactForm(src);
    const srcWordsStr = ' ' + wordsOf(src).join(' ') + ' ';
    let exact = true, wordsOk = true, from = 0, wfrom = 0;
    const punct = [];
    for (const piece of pieces) {
      const pe = exactForm(piece).replace(/^[\s,;:.!?—–-]+|[\s,;:.!?—–-]+$/g, '');
      const swap = pe ? (pe[0] === pe[0].toLowerCase() ? pe[0].toUpperCase() : pe[0].toLowerCase()) + pe.slice(1) : pe;
      let idx = pe ? srcExact.indexOf(pe, from) : -1;
      if (idx < 0 && swap) idx = srcExact.indexOf(swap, from);
      if (idx >= 0) { from = idx + pe.length; } else exact = false;
      const pw = ' ' + wordsOf(piece).join(' ') + ' ';
      const widx = srcWordsStr.indexOf(pw, wfrom);
      if (widx >= 0) { wfrom = widx + pw.length - 1; if (idx < 0) punct.push(piece); }
      else wordsOk = false;
    }
    const note = missing.length ? ` (also cites missing paragraph ${missing.join(', ')})` : '';
    if (exact && !missing.length) return { status: 'PASS', detail: '', refs };
    if (exact) return { status: 'NOT FOUND', detail: `quote matches, but cites a paragraph that does not exist: ${missing.join(', ')}`, refs };
    if (wordsOk) {
      return { status: 'PUNCTUATION', detail: `same words, different punctuation${note}. Restore the book's punctuation.`, refs };
    }
    const d = describeWordDiff(wordsOf(pieces.join(' ')), wordsOf(src));
    return { status: 'MISMATCH', detail: `${d}${note}.`, refs };
  }

  function describeWordDiff(qWords, sWords) {
    const pairs = lcsAlign(qWords, sWords);
    if (!pairs || !pairs.length) return 'no overlap with the cited paragraph; the quote may be invented or cite the wrong paragraph';
    const changes = [];
    let qi = 0, si = pairs[0][1];
    const all = [...pairs, [qWords.length, pairs[pairs.length - 1][1] + 1]];
    for (const [qa, sa] of all) {
      const added = qWords.slice(qi, qa), dropped = sWords.slice(si, sa);
      if (added.length || dropped.length) {
        changes.push(`draft says "${added.join(' ') || '(nothing)'}" / book says "${dropped.join(' ') || '(nothing)'}"`);
        if (changes.length >= 3) break;
      }
      qi = qa + 1; si = sa + 1;
    }
    const matched = Math.round((pairs.length / qWords.length) * 100);
    return `${matched}% of the quote's words match the cited text` + (changes.length ? '; ' + changes.join('; ') : '');
  }

  return {
    getParagraph, getSection, search, verifyQuote, prefetchAll, listPapers, clearCache,
    stats: getStats, mirrors: mirrors.slice(),
    _getDoc: getDoc, // exposed for tests
  };
}

// ---------- default client + convenience functions ----------

const defaultClient = createClient();

export function getParagraph(ref) { return defaultClient.getParagraph(ref); }
export function getSection(paper, section) { return defaultClient.getSection(paper, section); }
export function search(query, options) { return defaultClient.search(query, options); }
export function verifyQuote(text, citation) { return defaultClient.verifyQuote(text, citation); }
export function prefetchAll(onProgress, concurrency) { return defaultClient.prefetchAll(onProgress, concurrency); }
export function listPapers() { return defaultClient.listPapers(); }
export function clearCache() { return defaultClient.clearCache(); }
export function stats() { return defaultClient.stats(); }
