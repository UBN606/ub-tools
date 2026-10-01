# Quote Cards

An open dataset of **verified verbatim** Urantia Book quote cards, plus a
renderer that turns them into shareable graphics — 1080x1080 (feed) and
1080x1920 (story) PNGs.

## The rule

Quotes are **never typed by hand**. Every card's quote is sliced by machine
as an exact substring of the book's own paragraph text, then verified
word-for-word against the source with the repo's own normalization
(`ub-verify.js`). The build fails on any unverified card. Fix or drop the
card — never weaken the check.

## Card schema (`cards.json`)

```json
{ "topic": "prayer",
  "quote": "<exact book wording>",
  "citation": "91:8.1",
  "verified": true }
```

`verified` is set by `verify-cards.mjs`; do not set it yourself.

## How to add a card

1. Add an entry to `cards.src.json` — a topic, a citation, and **start/end
   anchors** (short distinctive phrases from the paragraph; the quote is
   everything between them, sliced from the source text):
   ```json
   {"topic": "prayer", "citation": "146:2.12",
    "start": "Many resort to prayer only when in trouble.",
    "end": "Such a practice is thoughtless and misleading."}
   ```
2. `node build-cards.mjs` — slices the exact quotes into `cards.json`.
   A wrong anchor fails loudly here; fix the anchor, never the quote.
3. `node verify-cards.mjs` — verifies every card word-for-word. Any
   failure exits non-zero and names the card.
4. `sh run-tests.sh` — schema tests + verification + render smoke test.

## Render usage

```
python3 render.py                    # all cards, both sizes -> out/
python3 render.py --cards 0,1,5      # selected cards by index
python3 render.py --out ./my-cards   # custom output dir
python3 render.py --smoke            # cards 0-1 -> /tmp/qc-smoke
```

Output: `out/square/<topic>-<nn>.png` (1080x1080) and
`out/story/<topic>-<nn>.png` (1080x1920).

Design: dark ink background, warm off-white DejaVu Serif quote (system
font, nothing bundled), muted gold topic/citation accents, "THE URANTIA
BOOK" attribution. Text only — no imagery, no wings/halos/church-art
cliches. The quote auto-fits from 72px down to 28px; if it still does not
fit, the script prints `OVERFLOW` and exits non-zero instead of clipping
text.

## Honesty note

v1 is a **curated seed** (34 cards, 10 topics), not an exhaustive topical
index. Every quote is machine-sliced from the source text and verified —
but curation is human, and coverage will grow card by card.
