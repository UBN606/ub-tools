# UB Parallel

The Gospels and *The Urantia Book*, verse by verse and paragraph by paragraph — side by side,
with the relationship between each pair stated plainly.

**Honesty note (v1):** the seed dataset is 78 links across the Jesus papers (Papers 120–196),
each individually verified against the actual text of both sources. It is **not exhaustive** —
it is a verified starting point. Nothing here was generated from memory.

## Relationship types

| Type | Meaning |
|---|---|
| `restates` | Same event or saying, in both accounts |
| `expands` | The UB gives more detail on the Gospel account |
| `corrects` | The accounts differ. Both texts are shown, neutrally — **you judge**. These touch doctrine and were curated with extra care |
| `fulfills` | The UB presents itself as the fuller revelation of the theme |

Notes describe; they never preach.

## Setup

```bash
# from the ub-tools repo root
node fetch-data.js        # downloads the Urantia Book text (already needed by ub-tools)
node parallel/fetch-bible.js   # downloads KJV (public domain) to parallel/data/kjv.json
```

Fetch-don't-bundle: no Bible text is committed (`parallel/data/kjv.json` is gitignored,
same convention as `fetch-data.js`). Nothing you check leaves your computer.

## The explorer

`parallel/app/index.html` — a static page, no build step, no server required. Serve the
repo root (any static host, e.g. `npx serve .`) and open `parallel/app/`.

- Search a Bible verse (`John 15:5`), a chapter (`Luke 2`), a UB paragraph (`180:2.1`),
  or a UB section (`180:2`) — both texts appear side by side with the relationship badge.
- Filter by relationship type.
- Texts load from the local checkout when hosted; otherwise they fall back to public
  mirrors and are cached in your browser (IndexedDB), so the page also works from `file://`.

## Proposing new links

```bash
node parallel/propose.js [--direction ub2bible|bible2ub] [--min-score 3] [--top 5]
```

Zero-dependency distinctive-word overlap over all 31,102 KJV verses × ~14,600 UB paragraphs
(via an inverted index — no naive pairwise comparison). Output goes **only** to
`review-queue.json` (gitignored): unverified candidates with `relationship: null` and a
warning that both texts must be checked by a human before accepting. Nothing is ever
auto-merged into the dataset.

Review workflow: read both texts for each candidate, set `relationship`, write a one-sentence
neutral note, and move accepted links into `parallel/data/links.json` by hand. When in doubt
about doctrine, leave it in the queue — the curator decides, not the tool.

## Tests

```bash
node --test parallel/test/links.test.mjs parallel/test/texts.test.mjs parallel/test/propose.test.mjs
```

- `links.test.mjs` — schema validation (all fields, relationship enum, no duplicate pairs),
  referential integrity (every `ub_ref` resolves in source-texts, every `bible_ref` in KJV;
  skips gracefully with a clear message if the texts aren't downloaded), and a guard that
  `corrects` notes don't editorialize.
- `texts.test.mjs` — smoke tests for `parallel/lib/texts.js` (ref parsing, ranges, bulk accessors).
- `propose.test.mjs` — small proposer run; checks output schema and that relationships stay `null`.

## Layout

```
parallel/
  fetch-bible.js      download + normalize KJV → data/kjv.json (gitignored)
  propose.js          candidate-link proposer → review-queue.json (gitignored)
  README.md           this file
  .gitignore          keeps kjv.json + review-queue.json out of the repo
  data/links.json     the curated seed dataset (committed)
  lib/texts.js        shared UB + KJV text access (ref parsing, ranges, bulk)
  lib/verify-links.js dataset verifier (schema + ref resolution)
  app/index.html      the explorer (static, no build)
  test/               node --test suite
```
