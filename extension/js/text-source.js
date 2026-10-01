/**
 * UB text source for the browser extension.
 *
 * The repository never redistributes the book's text (see LICENSE / README).
 * On first run this downloads the 197 paper files from Urantiapedia's GitHub —
 * the same files fetch-data.js pulls for the command-line tools — and caches
 * them in IndexedDB. Everything after that works fully offline, and nothing
 * the user checks ever leaves their computer.
 *
 * Source: Urantiapedia (https://urantiapedia.org),
 * https://github.com/JanHerca/urantiapedia, CC BY-SA 4.0.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(root.UBVerify);
  else root.UBTextSource = factory(root.UBVerify);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (UBVerify) {
  'use strict';

  const BASE = 'https://raw.githubusercontent.com/JanHerca/urantiapedia/master/input/json/book-en';
  const DB_NAME = 'ub-quote-verifier';
  const DB_VERSION = 1;
  const STORE = 'paragraphs';   // key: par_ref ("180:2.1"), value: { text, words }
  const META = 'meta';          // key "state", value: { downloadedAt, paragraphs }
  const EXPECTED_PAPERS = 197;
  const CONCURRENCY = 6;

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'ref' });
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    });
  }

  function txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    });
  }

  async function getState(db) {
    return new Promise((resolve, reject) => {
      const req = db.transaction(META, 'readonly').objectStore(META).get('state');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function isDownloaded() {
    try {
      const db = await openDB();
      const st = await getState(db);
      db.close();
      return !!(st && st.paragraphs > 10000);
    } catch (e) { return false; }
  }

  async function fetchPaper(n) {
    const name = 'Doc' + String(n).padStart(3, '0') + '.json';
    const res = await fetch(`${BASE}/${name}`, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${name}`);
    const doc = await res.json();
    const out = [];
    for (const s of doc.sections || []) {
      for (const p of s.pars || []) {
        if (!p.par_ref || !p.par_content) continue;
        out.push({ ref: p.par_ref, text: p.par_content, words: ' ' + UBVerify.words(UBVerify.stripMarkup(p.par_content)).join(' ') + ' ' });
      }
    }
    return out;
  }

  /**
   * Download all papers and cache them. onProgress(done, total) is called per paper.
   * Safe to call when already downloaded (no-op).
   */
  async function ensureLoaded(onProgress) {
    if (await isDownloaded()) { if (onProgress) onProgress(EXPECTED_PAPERS, EXPECTED_PAPERS); return; }
    const db = await openDB();
    const queue = [];
    for (let i = 0; i < EXPECTED_PAPERS; i++) queue.push(i);
    let done = 0, failed = [];
    async function worker() {
      while (queue.length) {
        const n = queue.shift();
        try {
          const pars = await fetchPaper(n);
          const tx = db.transaction(STORE, 'readwrite');
          const store = tx.objectStore(STORE);
          for (const p of pars) store.put(p);
          await txDone(tx);
        } catch (e) { failed.push(n); }
        done++;
        if (onProgress) onProgress(done, EXPECTED_PAPERS);
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (failed.length) { db.close(); throw new Error(`Download failed for ${failed.length} paper file(s): ${failed.join(', ')}`); }
    // verify the paragraph count looks like a whole book before marking complete
    const count = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (count < 10000) { db.close(); throw new Error(`Download incomplete: only ${count} paragraphs stored`); }
    const tx = db.transaction(META, 'readwrite');
    tx.objectStore(META).put({ key: 'state', downloadedAt: new Date().toISOString(), paragraphs: count });
    await txDone(tx);
    db.close();
  }

  function makeProvider() {
    let dbPromise = null;
    let corpusCache = null;
    const db = () => (dbPromise || (dbPromise = openDB()));

    async function getParagraph(ref) {
      const d = await db();
      return new Promise((resolve, reject) => {
        const req = d.transaction(STORE, 'readonly').objectStore(STORE).get(ref);
        req.onsuccess = () => resolve(req.result ? req.result.text : null);
        req.onerror = () => reject(req.error);
      });
    }

    async function corpus() {
      if (corpusCache) return corpusCache;
      const d = await db();
      corpusCache = await new Promise((resolve, reject) => {
        const out = [];
        const req = d.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
        req.onsuccess = () => {
          const c = req.result;
          if (c) { out.push({ ref: c.value.ref, words: c.value.words }); c.continue(); }
          else resolve(out);
        };
        req.onerror = () => reject(req.error);
      });
      return corpusCache;
    }

    // Neighboring paragraphs for the "read in context" view: P:S.(P-1), P:S.P, P:S.(P+1).
    async function context(ref) {
      const m = /^(\d+):(\d+)\.(\d+)$/.exec(ref);
      if (!m) return [];
      const out = [];
      for (const pn of [parseInt(m[3], 10) - 1, parseInt(m[3], 10), parseInt(m[3], 10) + 1]) {
        if (pn < 0) continue;
        const r = `${m[1]}:${m[2]}.${pn}`;
        const t = await getParagraph(r);
        if (t != null) out.push({ ref: r, text: t, current: r === ref });
      }
      return out;
    }

    return { getParagraph, corpus, context, ensureLoaded, isDownloaded };
  }

  return { makeProvider, ensureLoaded, isDownloaded, EXPECTED_PAPERS };
});
