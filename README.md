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

## UB Tools Studio: the same tools in your browser

`app/` is a web app over these tools: search the book, read every paragraph on a place, and check a draft's quotes, its claims about the book and what it left unread. It runs the same `ub-search.js`, `ub-verify.js`, `ub-recall.js` and `ub-claims.js` files, so it gives the same answers as the command line and the MCP server. Nothing you type leaves your computer.

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
