# UB API — a zero-cost hosted API for The Urantia Book

There is no server and no hosting bill. `ub-api.js` / `ub-api.mjs` is a
**zero-dependency JavaScript client** that reads the book's JSON text at runtime
from public CORS-enabled mirrors — the same Urantiapedia source the repo's
`fetch-data.js` downloads — caches it aggressively, and fails over between
mirrors automatically.

The book text (CC BY-SA 4.0, via Urantiapedia) is **never bundled and never
committed**: each user's browser or app downloads it directly from the source,
exactly like the repo's own tools do. Nothing you look up is sent anywhere
except the mirror you download the text from.

## Use it

**Script tag** (any static page, no build step):

```html
<script src="https://cdn.jsdelivr.net/gh/UBN606/ub-tools@main/api/ub-api.js"></script>
<script>
  const p = await UBApi.getParagraph('180:2.1');
  console.log(p.text); // exact source text, verbatim
</script>
```

**Node / ESM:**

```js
import { getParagraph, verifyQuote, search } from './ub-api.mjs';
// or: const UBApi = require('./ub-api.js');  (UMD: also works with <script> and AMD)
```

**Examples:**

```js
await getParagraph('180:2.1');
// { ref, paper, paperTitle, section, sectionTitle, author, page,
//   text (exact, verbatim), textPlain (markup stripped) }

await getSection(180, 2);
// { paper, paperTitle, section, sectionTitle, paragraphs: [...] }

search('vine');                    // sync; scans cached papers
// { query, total, results: [{ score, ref, paper, paperTitle, sectionTitle, snippet }],
//   searchedPapers, complete }

await verifyQuote('I am the true vine, and my Father is the husbandman.', '180:2.1');
// { status: 'PASS' | 'PUNCTUATION' | 'MISMATCH' | 'NOT FOUND' | 'ERROR', detail, refs }

await prefetchAll((done, total) => console.log(done + '/' + total)); // ~14 MB once
await listPapers();                // [{ paper, title, author }] — all 197

const client = createClient({ mirrors: [...], fetchImpl, persist: false });
client.stats(); // { fetches, cacheHits, persistentHits, lastMirror, cachedPapers, ... }
```

## Method reference

| Method | Notes |
|---|---|
| `getParagraph(ref)` | `ref` like `'180:2.1'`. Returns exact text + full citation metadata, or `{ ref, error }`. |
| `getSection(paper, section)` | All paragraphs of a section; untitled section 0 reports `'Introduction'`. |
| `search(query, { paper, limit, snippetRadius })` | **Synchronous**, scans papers already cached. Same matching semantics as `ub-search.js`: whole-word from word start (`vine` hits *vine/vines*, never *divine*), stop-word handling, exact-phrase ranking. `complete: false` until `prefetchAll()` has run — the result tells you honestly how much of the book was searched. |
| `verifyQuote(text, citation)` | Same verdicts as `ub-verify.js`: `PASS`, `PUNCTUATION` (same words, different punctuation), `MISMATCH` (wording changed, with a diff), `NOT FOUND` (cited paragraph doesn't exist). Ranges like `'180:2.1-3'` join paragraphs; `...`/`[…]` skips are honored. Network failure returns `ERROR` — never misreported as `NOT FOUND`. |
| `prefetchAll(onProgress?, concurrency?)` | Downloads all 197 paper JSONs (~14 MB) with 6 parallel requests by default. |
| `listPapers()` | All 197 papers with titles (runs `prefetchAll` first). |
| `clearCache()` | Clears memory + IndexedDB caches. |
| `createClient({ mirrors, fetchImpl, persist })` | Custom client: own mirror list, injected fetch (tests, older Node), `persist: false` to skip IndexedDB. |

## Mirrors

| Mirror | CORS | Notes |
|---|---|---|
| `https://cdn.jsdelivr.net/gh/JanHerca/urantiapedia@master/input/json/book-en` | `access-control-allow-origin: *` (verified) | Primary: CDN, fast, correct JSON content-type |
| `https://raw.githubusercontent.com/JanHerca/urantiapedia/master/input/json/book-en` | `Access-Control-Allow-Origin: *` (verified) | Fallback, same repo |

URL pattern: `{mirror}/Doc{NNN}.json` (`Doc000.json`–`Doc196.json`), the same files
`fetch-data.js` downloads. The client tries mirrors in order and fails over on any
error; `stats().lastMirror` tells you which one served.

**Adding a mirror:** `createClient({ mirrors: ['https://my-mirror.example/ub', ...DEFAULT_MIRRORS] })`.
Any static host serving the `DocNNN.json` files with `Access-Control-Allow-Origin: *` works.

## Caching

- **Memory:** every fetched paper doc is kept for the session.
- **IndexedDB** (browsers only): fetched docs persist across visits, so the ~14 MB downloads once. Disable with `createClient({ persist: false })`.
- Node has no persistent cache yet — memory only per process.

## Be kind to the mirrors

Paper JSONs are fetched lazily (one paper per lookup). `prefetchAll()` pulls ~14 MB
across 197 requests — fine occasionally, but don't put it on a hot page path; fetch
once and let the cache do the work. Heavy or automated users should run the repo's
local tools (`fetch-data.js` + `ub-search.js`) instead of hammering the CDN.

## Honesty notes

- This is a **client-side** API: search only covers papers already fetched until you
  run `prefetchAll()`; every search result says so (`searchedPapers`, `complete`).
- The client surfaces exact text and citations; it never paraphrases or invents text.
- `ub-api.mjs` is the source of truth; `ub-api.js` is the UMD build — regenerate
  with `node api/build.mjs` (it self-checks the build).
- Tests: `node --test "api/test/*.test.mjs"` — all offline with mocked fetch and
  synthetic fixtures. `api/demo.html` is a minimal try-it page.

## Files

| File | Purpose |
|---|---|
| `ub-api.mjs` | ESM source of truth (also importable from Node/bundlers) |
| `ub-api.js` | UMD build: `<script>` global `UBApi`, `require()`, AMD (generated — do not edit) |
| `build.mjs` | Zero-dependency ESM→UMD transform + build self-check |
| `test/` | Offline tests: `client.test.mjs`, `umd.test.mjs`, `fixtures.mjs` (synthetic) |
| `demo.html` | Minimal browser demo |
