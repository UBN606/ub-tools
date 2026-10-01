/**
 * Node-only text provider for the verify-core unit tests.
 * Reads the same source-texts/papers/DocNNN.json files that fetch-data.js
 * downloads — fixtures are derived from the real book text at test time, so
 * no book paragraphs are pasted into the test files.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PAPERS_DIR = join(here, '..', '..', 'source-texts', 'papers');

export function hasBookText() {
  if (!existsSync(PAPERS_DIR)) return false;
  return readdirSync(PAPERS_DIR).filter((f) => /^Doc\d{3}\.json$/.test(f)).length === 197;
}

export function makeNodeProvider(UBVerify) {
  const cache = new Map();
  function paper(n) {
    if (!cache.has(n)) {
      const map = new Map();
      const file = join(PAPERS_DIR, `Doc${String(n).padStart(3, '0')}.json`);
      if (existsSync(file)) {
        const doc = JSON.parse(readFileSync(file, 'utf8'));
        for (const s of doc.sections) for (const p of s.pars) map.set(p.par_ref, p.par_content);
      }
      cache.set(n, map);
    }
    return cache.get(n);
  }
  let corpusCache = null;
  return {
    async getParagraph(ref) {
      const m = /^(\d+):(\d+)\.(\d+)$/.exec(ref);
      if (!m) return null;
      return paper(parseInt(m[1], 10)).get(ref) || null;
    },
    async corpus() {
      if (corpusCache) return corpusCache;
      corpusCache = [];
      for (const f of readdirSync(PAPERS_DIR).filter((f) => /^Doc\d{3}\.json$/.test(f))) {
        const doc = JSON.parse(readFileSync(join(PAPERS_DIR, f), 'utf8'));
        for (const s of doc.sections) {
          for (const p of s.pars) {
            corpusCache.push({
              ref: p.par_ref,
              words: ' ' + UBVerify.words(UBVerify.stripMarkup(p.par_content)).join(' ') + ' ',
            });
          }
        }
      }
      return corpusCache;
    },
  };
}
