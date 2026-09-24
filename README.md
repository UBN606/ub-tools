# UB Tools: quote The Urantia Book from the source, not from memory

AI assistants misquote The Urantia Book. They mostly do it with small, believable changes: a dropped word, the Bible's wording in place of the UB's, a citation one paragraph off. When we checked our own articles at the Urantia Book Network, we found 11 misquotes and dozens of imprecise figures, all written with care. In a closed-book test of three Claude models, they mostly declined to quote, and 3 of the 4 quotes they did attempt had a word changed.

These free tools let any AI, or any person, pull the book's exact wording and check a draft before it's published. Nothing is sent anywhere: the tools run on your computer, work offline after setup, and need no API keys or accounts.

## What's here

| Tool | What it does |
|---|---|
| `ub-mcp.js` | A **Model Context Protocol server** that gives Claude, Codex or any MCP-capable assistant five tools: `ub_search`, `ub_get_paragraphs` (exact text by reference), `ub_get_section`, `ub_topic_lookup` and `ub_verify_text` |
| `ub-search.js` | Command-line search of the whole book (whole-word matching; `--ref 180:2.1` prints a paragraph's exact text) |
| `ub-verify.js` | Checks every `"quote" (Paper:Section.Paragraph)` in a draft against the book. Results are PASS, PUNCTUATION (for example, the book's em dash turned into a comma), MISMATCH (reports where the words really are when the citation is wrong) or NOT FOUND |
| `ub-bench/` | A 21-question benchmark of how accurately an AI quotes and cites the UB, with first results |

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

First results (closed book, 2026-09-23) are in `ub-bench/results/`.

## Credits and licenses

- **Book text and topic index:** [Urantiapedia](https://urantiapedia.org) ([GitHub](https://github.com/JanHerca/urantiapedia)), under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). This repository does not include or redistribute that content; `fetch-data.js` downloads it from Urantiapedia.
- **The Urantia Book** was first published in 1955.
- **Code:** see `LICENSE`.
- Made by the [Urantia Book Network](https://urantiabooknetwork.com).
