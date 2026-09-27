// UB Tools app engine: runs the repository's own ub-search.js, ub-verify.js and ub-recall.js
// in the browser, so the app, the command line and the MCP server give the same answers.
// The book text is fetched once (from ../source-texts when served from a checkout that ran
// fetch-data.js, otherwise from Urantiapedia on GitHub, CC BY-SA 4.0) and kept in the
// browser's cache. Nothing is sent anywhere else.
'use strict';

const ROOT = '/ub';
const REMOTE = 'https://raw.githubusercontent.com/JanHerca/urantiapedia/master/input/json/book-en/';
const LOCAL = '../source-texts/papers/';
const CACHE = 'ub-tools-book-v1';
const DOCS = Array.from({ length: 197 }, (_, i) => `Doc${String(i).padStart(3, '0')}.json`);

// ---------- a tiny in-memory file system for the Node tools ----------
const files = new Map();
const norm = (p) => p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/\.\//g, '/');
const pathShim = {
  sep: '/',
  join: (...a) => norm(a.filter(Boolean).join('/')),
  dirname: (p) => norm(p).replace(/\/[^/]*$/, '') || '/',
  basename: (p, ext) => { const b = norm(p).split('/').pop(); return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; },
  resolve: (...a) => norm(a.join('/')),
  extname: (p) => (p.match(/\.[^./]*$/) || [''])[0],
};
const fsShim = {
  existsSync: (p) => { p = norm(p); return files.has(p) || [...files.keys()].some((k) => k.startsWith(p + '/')); },
  readFileSync: (p) => { p = norm(p); if (!files.has(p)) throw new Error(`ENOENT: ${p}`); return files.get(p); },
  writeFileSync: (p, data) => { files.set(norm(p), String(data)); },
  mkdirSync: () => {},
  readdirSync: (p) => {
    p = norm(p).replace(/\/$/, '') + '/';
    const names = new Set();
    for (const k of files.keys()) if (k.startsWith(p)) names.add(k.slice(p.length).split('/')[0]);
    return [...names].sort();
  },
  statSync: (p) => ({ isDirectory: () => !files.has(norm(p)), isFile: () => files.has(norm(p)) }),
};
const processShim = { argv: ['node', 'app'], env: {}, exit: () => {}, stdout: { write: () => {} }, platform: 'browser' };

const modules = new Map();
function makeRequire(fromDir) {
  return function require(name) {
    if (name === 'fs') return fsShim;
    if (name === 'path') return pathShim;
    if (name === 'https' || name === 'child_process') return {};
    const p = norm(name.startsWith('.') ? pathShim.join(fromDir, name) : name);
    const key = p.endsWith('.js') ? p : p + '.js';
    if (modules.has(key)) return modules.get(key).exports;
    const src = files.get(key);
    if (src == null) throw new Error(`module not loaded: ${key}`);
    const module = { exports: {} };
    modules.set(key, module);
    const body = src.replace(/^#!.*\n/, '');
    // Evaluates only this repository's own tool files, fetched from the app's folder above.
    // Never user input: drafts and searches are passed to the tools as data, not code.
    // eslint-disable-next-line no-new-func
    const fn = new Function('module', 'exports', 'require', '__dirname', '__filename', 'process', 'console', body);
    const quiet = { ...console, log: () => {} };
    fn(module, module.exports, makeRequire(pathShim.dirname(key)), pathShim.dirname(key), key, processShim, quiet);
    return module.exports;
  };
}

async function fetchText(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${r.status} for ${url}`);
  return r.text();
}

async function cachedText(url) {
  let cache = null;
  try { cache = await caches.open(CACHE); } catch { /* private window: no cache */ }
  if (cache) { const hit = await cache.match(url); if (hit) return hit.text(); }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} for ${url}`);
  const text = await r.clone().text();
  if (cache) { try { await cache.put(url, r); } catch { /* quota */ } }
  return text;
}

// Load the tools and the book. onProgress(done, total, source)
export async function loadEngine(onProgress = () => {}) {
  for (const f of ['ub-search.js', 'ub-verify.js', 'ub-recall.js', 'ub-claims.js', 'build-search-index.js', 'ub-recall-places.json']) {
    files.set(`${ROOT}/${f}`, await fetchText(`../${f}`));
  }
  let base = LOCAL, source = 'this folder';
  try { const t = await fetch(LOCAL + DOCS[0], { method: 'HEAD' }); if (!t.ok) throw 0; }
  catch { base = REMOTE; source = 'Urantiapedia'; }
  let done = 0;
  const queue = DOCS.slice();
  const worker = async () => {
    while (queue.length) {
      const name = queue.shift();
      const text = base === LOCAL ? await fetchText(base + name) : await cachedText(base + name);
      files.set(`${ROOT}/source-texts/papers/${name}`, text);
      onProgress(++done, DOCS.length, source);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  makeRequire(ROOT)('./build-search-index.js');
  const req = makeRequire(ROOT);
  const search = req('./ub-search.js');
  const verify = req('./ub-verify.js');
  const recall = req('./ub-recall.js')
  const claims = req('./ub-claims.js');
  const index = JSON.parse(files.get(`${ROOT}/source-texts/ub-search-index.json`));
  const byRef = new Map();
  const order = [];
  for (const p of index.papers) for (const s of p.sections) for (const par of s.paragraphs) {
    byRef.set(par.ref, { ...par, paper: p.paper_index, paperTitle: p.paper_title, author: p.author, sectionTitle: s.section_title });
    order.push(par.ref);
  }
  const places = JSON.parse(files.get(`${ROOT}/ub-recall-places.json`));
  return { search, verify, recall, claims, byRef, order, places, source, paragraphs: index.totalParagraphs };
}
