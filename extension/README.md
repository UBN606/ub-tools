# UB Quote Verifier — browser extension (Manifest V3)

Select any alleged Urantia Book quote on any webpage, right-click **Verify UB quote**,
and check it against the book's exact text. Same verdicts as `ub-verify.js`:
**PASS** (word-perfect), **PUNCTUATION** (same words, different punctuation),
**MISMATCH** (words changed — shows the diff, and names the true paragraph when the
citation is wrong), **NOT FOUND** (the cited paragraph doesn't exist).

Works in Chrome, Edge, and Firefox (Manifest V3).

## File layout

| File | What it is |
|---|---|
| `manifest.json` | MV3 manifest: context menu, popup, service worker, host permission for the text download |
| `background.js` | Service worker: registers the context-menu item, stashes the selection, opens the popup |
| `popup.html` / `popup.css` / `popup.js` | The checker UI: quote textarea, citation field, verdict badge, diff table, read-in-context view |
| `js/verify-core.js` | **Dependency-free** verification engine — a faithful async port of `ub-verify.js`'s comparison logic. Shared between the extension and the node tests; works in service workers, popups, and node with no build step |
| `js/text-source.js` | First-run download of the 197 paper files from Urantiapedia's GitHub + IndexedDB cache (offline afterwards) |
| `js/ext.js` | Tiny `browser`/`chrome` namespace shim so one codebase runs on Chrome, Edge, and Firefox |
| `test/verify-core.test.mjs` | Unit tests, runnable with `node --test` — zero dependencies |
| `test/node-source.mjs` | Test-only adapter: builds fixtures from your local `source-texts/` at test time |
| `test/validate-manifest.mjs` | Checks the manifest against MV3 requirements and confirms every referenced file exists |

## The redistribution rule

This repository never ships the book's text, and neither does the extension.
On first run the popup downloads the papers from Urantiapedia
(`raw.githubusercontent.com/JanHerca/urantiapedia`, CC BY-SA 4.0 — the same files
`fetch-data.js` pulls for the command-line tools) and caches them in IndexedDB.
Everything after that works fully offline, and **nothing you check ever leaves your
computer** — verification runs locally against the cached text.

## Try it

```bash
# unit tests (needs source-texts/ — run `node fetch-data.js` once if missing)
node --test extension/test/verify-core.test.mjs
node extension/test/validate-manifest.mjs
```

**Load unpacked:**
- Chrome / Edge: `chrome://extensions` → Developer mode → Load unpacked → this `extension/` folder.
- Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `extension/manifest.json`.

Then select a quote plus its citation on any page (e.g. `"Some quoted words from the page." (180:2.1)`),
right-click → **Verify UB quote**. First run downloads the text (~14 MB, once);
after that it works offline.

## Deliberately left out

- **Draft scanning / dash checking** (`extractQuotes`, `dashCheck` from `ub-verify.js`) — those scan whole documents; the extension checks one selected quote at a time.
- **Paper/section title detection** — the CLI skips quoted titles; the extension assumes the user is checking paragraph text.
- **Web-store publishing** — not submitted anywhere; load unpacked for now.
