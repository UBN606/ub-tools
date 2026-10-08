# UB Tools: quote The Urantia Book from the source, not from memory

AI assistants misquote The Urantia Book. They mostly do it with small, believable changes: a dropped word, the Bible's wording in place of the UB's, a citation one paragraph off. When we checked our own articles at the Urantia Book Network, we found 11 misquotes and dozens of imprecise figures, all written with care. In a test of five leading models answering from memory, only one cited passage came back word-perfect; six quotes had changed or invented wording, including the Bible's version of a parable offered as the UB's.

These free tools let any AI, or any person, pull the book's exact wording and check a draft before it's published. Nothing is sent anywhere: the tools run on your computer, work offline after setup, and need no API keys or accounts.

## What's here

| Tool | What it does |
|---|---|
| `ub-mcp.js` | A **Model Context Protocol server** that gives Claude, Codex or any MCP-capable assistant six tools: `ub_search`, `ub_get_paragraphs` (exact text by reference), `ub_get_section`, `ub_topic_lookup`, `ub_verify_text`, `ub_recall` and `ub_check_claims` |
| `ub-search.js` | Command-line search of the whole book (whole-word matching; `--ref 180:2.1` prints a paragraph's exact text) |
| `ub-verify.js` | Checks every `"quote" (Paper:Section.Paragraph)` in a draft against the book. Results are PASS, PUNCTUATION (for example, the book's em dash turned into a comma), MISMATCH (reports where the words really are when the citation is wrong) or NOT FOUND |
| `ub-recall.js` | Before you say what the book says, or does not say, about a place or people, it lists **every** paragraph on it, resolving modern names to the book's (Maya to Mexico and Central America, Rapa Nui to Easter Island). `--check draft.md` reports the paragraphs on the draft's subject that it neither cites nor records as read |
| `ub-claims.js` | Checks what a draft says the book says, beyond exact quotes: a claim credited to the book with no citation, a date or figure the cited paragraph does not contain (it reads the book's number words, so "eighty-five thousand" matches 85,000), and the book's words in quotation marks with no citation |
| `ub-bench/` | A 21-question benchmark of how accurately an AI quotes and cites the UB, with first results |
| `extension/` | A Manifest V3 browser extension (Chrome, Edge, Firefox): select any alleged UB quote on any webpage and verify it against the book's exact text, with the same verdicts as `ub-verify.js` |
| `parallel/` | UB Parallel — a better Paramony: 78 verified Bible ↔ UB links typed by relationship (restates / expands / corrects / fulfills), a side-by-side explorer in `parallel/app/`, and a proposer that finds candidate parallels for human review |
| `entities/` | An open JSON index of 156 people, places and groups in the book (455 citations across 87 papers), with a build script that verifies every citation and a coverage report |
| `quote-cards/` | 34 verbatim, cited quote cards across 10 topics, plus a renderer for square and story-size social graphics — the build refuses any card that isn't verified word-for-word |
| `visuals/` | Four self-contained interactive visuals, each one portable folder that works offline and drops onto any static site: a clickable map of the master universe (Papers 11–15), a scrubbable timeline of Jesus' life (Papers 120–196), a schematic ancient Palestine map built from the entity index, and clickable family trees — every quote, date and relationship verified against the book's exact text |

## UB Tools Studio: the same tools in your browser

`app/` is a web app over these tools: search the book, read every paragraph on a place, and check a draft's quotes, its claims about the book and what it left unread. It runs the same `ub-search.js`, `ub-verify.js`, `ub-recall.js` and `ub-claims.js` files, so it gives the same answers as the command line and the MCP server. Searches run in your browser. Questions asked in Ask are logged (question text, page address and time only, no name or account) so the term mappings can be improved; see `app/feedback.js`.

The Studio is organized in six views, switched from the tab bar at the top:

- **Read** — ask, search, places, and check-a-draft, as before. Any paragraph link like `app/?ref=180:2.1` (or a range, `app/?ref=180:2.1-3`) opens the Studio on that exact paragraph, highlighted; bad links get a clean error, never a crash. Every paragraph and result has a **Copy link** button.
- **Listen** — read-along with human narration: pick a paper, choose your own downloaded audio file (it never leaves your computer), and each word lights up as it is spoken. Word timings come from `audio/aligned/`; where timings aren't published yet, the Studio says so and offers the built-in reading voice instead.
- **Plans** — reading plans with check-offs and progress bars, all in your browser's local storage: the whole book in a year (365 days), the life and teachings of Jesus in 90 days (Papers 120–196), and the central universe in 30 days (Papers 1–31). "Continue where you left off" resumes your last-read paragraph.
- **Quiz** — flashcards: 197 machine-sliced quotes (one per paper), every one verified word-for-word by `ub-verify.js`. Multiple choice or type-the-citation, score kept for the session.
- **Explore** — the imagery: the `visuals/` cosmos map, Jesus timeline, Palestine map and genealogy trees, plus a gallery of the 34 verified `quote-cards/`, each opening its paragraph in the book.
- **Tools** — the front door to everything else in the kit: the quote-verifier browser extension, UB Parallel, the entity index, the quote cards, the UB API, the visuals, and the read-along audio data. Each card says what the tool does and how to open it; local copies are preferred when the Studio is served from this repo.

Display settings in the header, shared across the Studio and all four visuals pages: **dark mode** (follows your device until you pick one) and **text size A− A A+** (four levels, remembered). Contrast ratios are asserted by `app/test/a11y.test.mjs` — real math, not inversion — and touch targets are 44px.

`app/embed-quote.js` is a separate drop-in widget any website can use: one script tag shows a verified quote-of-the-day (deterministic by date, 60 machine-sliced and `ub-verify.js`-checked quotes, no network needed). See `app/embed.md`.

## Browser extension: verify a quote on any webpage

`extension/` is a Manifest V3 extension (Chrome, Edge, Firefox): select any alleged UB quote on any page, right-click **Verify UB quote**, and check it against the book's exact text — the same PASS / PUNCTUATION / MISMATCH / NOT FOUND verdicts as `ub-verify.js`, with the diff and the true paragraph when the citation is wrong. The popup also accepts a pasted quote and reads the current page selection.

Like everything here, it never redistributes the book: on first run it downloads the text once from Urantiapedia and caches it in IndexedDB, works fully offline after that, and nothing you check ever leaves your computer. Load it unpacked from `chrome://extensions` (Developer mode) or Firefox's `about:debugging`; see `extension/README.md` for the file layout and tests.

## UB Parallel: a better Paramony

`parallel/` maps Bible verses to Urantia Book paragraphs and back — 78 verified links in v1, each typed by relationship: **restates** (the same event or saying in both), **expands** (the book gives more detail), **corrects** (the accounts differ — both texts shown side by side, no editorializing), **fulfills**. Open `parallel/app/` in a browser for the explorer: search "John 15:5" or "180:2.1" and read both texts with their relationship badge. A link like `parallel/app/?ref=180:2.1` opens it on that reference — the Studio's Read view uses this for its "Compare with the Bible" button.

`propose.js` scans all 31,102 KJV verses against all 14,596 UB paragraphs for candidate parallels and writes them to a review queue. Candidates never enter the dataset until a person has read both texts and set the relationship; judgment calls stay in the queue until reviewed. See `parallel/README.md`.

## Entity index: people, places, groups

`entities/` is an open JSON index of 156 people, places and orders of beings named in the book — 455 citations across 87 papers. `node entities/build.mjs` rebuilds it from the curation file, verifies every citation against the text, and writes a coverage report that is honest about thin spots. To add an entry, edit `curate/entities.json`, rebuild, run the tests. See `entities/README.md`.

## Quote cards: verbatim, cited, ready to share

`quote-cards/` holds 34 quote cards across 10 topics (prayer, faith, love, service, courage, worship, forgiveness, wisdom, peace, joy). Quotes are never typed by hand — they are machine-sliced from the paragraph text, so transcription errors are impossible — and the build verifies every card word-for-word, refusing any that fail. `python3 render.py` produces 1080x1080 and 1080x1920 PNGs: dark ink, serif type, the citation under the words, no imagery. See `quote-cards/README.md`.

## Visuals: see the book, not just read it

`visuals/` holds four interactive pages, each a single self-contained folder — no dependencies, no network calls, works straight from `file://` and can be dropped as-is onto any static website:

- **`visuals/cosmos/`** — a clickable schematic map of the master universe from Papers 11–15: the Isle of Paradise, the Havona circuits, the seven superuniverses (only Orvonton is named in the text — the rest are numbered, and the page says so), the dark gravity bodies, and the outer space levels. Every region opens its exact quote and paragraph citation.
- **`visuals/timeline/`** — a scrubbable timeline of Jesus' life across Papers 120–196: 40 dated events from the bestowal commission to Paper 196's closing reflection, each with the date as the book states it (or an honest "date not given") plus its paragraph citation and one short quote.
- **`visuals/maps/`** — a schematic ancient Palestine map plotting 27 mappable places from the entity index (Sea of Galilee, Jerusalem, Capernaum, …), each clickable to its citations; off-map and unlocatable entries are listed with reasons instead of being guessed at.
- **`visuals/genealogy/`** — clickable family trees for the lineages the book traces: Adam's descendants, the Sethite priesthood, and Jesus' family. Every parent–child edge is drawn only where the text states the relationship — uncertain links are left unlinked and flagged.

Like everything else here, every quote, date, name and relationship was verified against the book's exact text, and each visual ships a `test/` suite (`node --test visuals/<name>/test/`) that re-verifies every citation against the source text. Open any `index.html` directly in a browser.

## Aligned audio: read-along timestamps

`audio/` is an open word-level alignment dataset for the book: which word is spoken when. It ships **timestamps only, never audio** — you download the narration yourself (see `audio/SOURCES.md` for the human-narrated source and the rights basis), and the Studio's Listen tab pairs your audio file with the timings for word-by-word highlighting.

- **`audio/aligned/Doc001.json`** — the v1 sample: all of Paper 1 (70 paragraphs, 6,155 words, 99.2% of words locked to measured speech timestamps)
- **`audio/align.py`** — the pipeline: transcribe with faster-whisper, align at token level against the book text, interpolate the rest and flag it (`x:false` = estimated, `x:true` = measured)
- **`audio/qc.py`** — automated quality gate: schema, monotonicity, speaking-rate sanity; the listening check is still a human ear
- Tests: `pytest audio/tests/test_align.py` (10/10) and `node --test audio/tests/test_schema.mjs` (4/4, including "no audio files shipped")

```bash
node app/serve.mjs
```

Then open the address it prints. If you ran `node fetch-data.js`, the app reads the book from `source-texts/`; otherwise it loads it once from Urantiapedia and keeps it in the browser.

## Setup (needs [Node.js](https://nodejs.org) 18 or newer)

```bash
git clone <this repository>
cd <repository folder>
node fetch-data.js
```

`fetch-data.js` downloads the book's text (about 14 MB) from [Urantiapedia](https://urantiapedia.org) and builds a search index. It runs once.

Try it:

```bash
node ub-search.js "vine branches"
node ub-search.js --ref 180:2.1
node ub-verify.js my-article.md
```

## Use it from an AI assistant

**Claude Code:**
```bash
claude mcp add --scope user ub-tools -- node /full/path/to/ub-mcp.js
```

**Claude Desktop** (`claude_desktop_config.json`):
```json
{ "mcpServers": { "ub-tools": { "command": "node", "args": ["/full/path/to/ub-mcp.js"] } } }
```

**Codex** (`~/.codex/config.toml`):
```toml
[mcp_servers.ub-tools]
command = "node"
args = ["/full/path/to/ub-mcp.js"]
```

Then ask naturally, for example: "What does the Urantia Book say about the vine and the branches? Quote it exactly." The assistant will find the passage, fetch the exact text and cite it. For drafts, ask it to "check this with ub_verify_text".

## Read everything before you say what the book says

`ub-verify.js` proves each quote is exact. It cannot prove you read everything the book says on the subject, and a draft can quote perfectly and still leave out the paragraph that changes the answer. We learned this on our own articles: two pieces on the Maya passed every quote check while saying the book counts against an outside link to Mesoamerica. Nobody had searched "Central America". The book never says "Maya", and 64:7.5 and 79:5.8 name the mixed red, yellow, orange and blue race that founded the civilizations of Mexico and Central America.

```bash
node ub-recall.js Maya                    # every paragraph on Mexico and Central America
node ub-recall.js "Easter Island" Japan
node ub-recall.js --check draft.md        # what the draft left unread
node ub-recall.js --check draft.md --read read.json
node ub-recall.js --self-test
```

A draft is checked for a place when the place is its subject (title or heading, or three or more sentences about the book that name it) or when one such sentence makes a limiting claim ("the book never...", "only...", "counts against..."). Every paragraph on that place must then be cited in the draft or recorded in `read.json` with a reason of at least 20 characters:

```json
{ "reviewed": { "89:9.2": "Mother of God cult in Mexico; about sacrifice, not the claim here", "94": "whole paper read: China and India, no bearing on the Americas" } }
```

Papers 57 to 61 (the planet's geology) are skipped unless you pass `--all-papers`, and the tool says so. `ub-recall-places.json` holds the place names; add a group when you write about a place it does not list. From an assistant, ask it to "check this with ub_recall" or "list everything the book says about Peru with ub_recall".

## Check what you say the book says

A draft can quote every passage exactly and still credit the book with something it does not say. Ours once said "the UB's dating ... c. 6000-2000 BCE" of a passage that gives no date, and every quote check passed. `ub-claims.js` reads the sentences that speak of the book:

```bash
node ub-claims.js draft.md
node ub-claims.js draft.md --allow allow.json
node ub-claims.js --self-test
```

It reports three things. A sentence that credits the book (says, dates, places, describes, "according to the UB") with no Paper:Section.Paragraph citation in it, its paragraph or the next. A date or figure in such a sentence that the cited paragraphs do not contain; figures you mark as your own ("by our arithmetic") are left alone, and so is a study's figure in a separate clause. Six or more of the book's words in quotation marks with no citation. A claim that the book never mentions something is left to `ub-recall.js`, which proves it by listing every paragraph.

## Check your own writing

```bash
node ub-verify.js article.md another.md
node ub-verify.js article.md --quotes-only   # skip the dash check (a Urantia Book Network house style)
node ub-verify.js --self-test
```

It never edits your file. Exit code 0 means clean and 1 means something needs fixing, so it also works as a pre-commit or CI check.

## Test an AI

```bash
node ub-bench/ub-bench.js prompt > prompt.txt
```

Paste `prompt.txt` into any assistant, save its reply as a text file with the first line `MODEL: <name>`, then:

```bash
node ub-bench/ub-bench.js grade reply.txt
```

Results for five models (Claude Opus, Sonnet and Haiku; ChatGPT GPT-6 Sol; Gemini 3.1 Pro) are in `ub-bench/results/`; see `2026-09-24/RESULTS.md`.

## Credits and licenses

- **Book text and topic index:** [Urantiapedia](https://urantiapedia.org) ([GitHub](https://github.com/JanHerca/urantiapedia)), under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). This repository does not include or redistribute that content; `fetch-data.js` downloads it from Urantiapedia.
- **The Urantia Book** was first published in 1955.
- **Code:** see `LICENSE`.
- Made by the [Urantia Book Network](https://urantiabooknetwork.com).
