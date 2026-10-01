# UB Entities: an open index of the people, places, and groups in The Urantia Book

`people.json`, `places.json`, and `groups.json` are open data: named persons,
places, and orders of beings in the book, each with the key paragraphs where
the entity is introduced or most substantively described. Built for study apps,
games, timelines, and anything else that needs to answer "who/what is X, and
where does the book say so" — with a citation you can verify, not a summary
you have to trust.

## The honesty note

This is a **verified seed, not an exhaustive concordance**: 156 entries
(54 people, 59 places, 43 groups), 455 citations across 87 of the 197 papers.
`refs` are the key paragraphs — where the entity is introduced or described at
length — not every mention. Every ref is machine-verified to exist in the book
text and to actually mention the entity; anything that failed verification was
left out, not fudged. `coverage.json` records exactly what is covered, what is
thin (<2 refs), and what failed. Extend it: the format is designed for that.

## Entry schema

```json
{
  "name": "Gabriel",
  "kind": "person",
  "aliases": ["Bright and Morning Star"],
  "refs": ["122:2.2", "122:2.6"],
  "note": "Chief executive of Nebadon and personal representative of the Creator Son."
}
```

- `name` — the name as the book uses it (disambiguated in parentheses when needed: "Mary (mother of Jesus)").
- `kind` — `person` | `place` | `group`. Groups cover celestial orders (Seraphim, Melchizedek Sons), human races (Andonites, Nodites), and historical parties (Pharisees).
- `aliases` — other names the book uses (optional).
- `refs` — 1–3 paragraphs, `Paper:Section.Paragraph`, verified against `source-texts/`.
- `note` — one neutral descriptive sentence, written by the curators. Notes never quote the book and never invent doctrine; the book's own words live at the `refs`.

## How it is built

The published JSON is generated, not hand-edited:

```
node entities/build.mjs
```

1. Reads `entities/curate/entities.json` — the curation source.
2. For each entry, either verifies the curator's pinned `refs` (each must resolve
   in `source-texts/` *and* contain one of the entry's match terms, in the
   paragraph or its section heading) or auto-selects up to 3 refs: the entity's
   home paper (most mentions) contributes its first mention plus its two
   densest paragraphs.
3. Writes `people.json`, `places.json`, `groups.json` (sorted by name),
   `coverage.json`, and prints a report. Exits non-zero on any unresolved
   entry or pinned-ref failure, so bad curation can never ship silently.

```
node --test entities/test/entities.test.mjs
```

Tests validate the published artifacts: schema, kinds, ref format, every ref
resolving to a real paragraph, no duplicate names (case-insensitive), sort
order, and coverage counts matching the files. Zero npm dependencies throughout.

## Contributing an entry

1. Add it to `entities/curate/entities.json`:
   ```json
   {"name": "New Entity", "kind": "person",
    "match": ["New Entity", "Alternate Name"],
    "aliases": ["Alternate Name"],
    "note": "One neutral sentence describing the entity.",
    "refs": ["12:3.4"]}
   ```
   - `match` (optional, defaults to `[name]`) — the terms used to find and
     verify paragraphs. Include aliases here when the book rarely uses the
     display name.
   - `refs` (optional) — pin citations you have checked yourself. Omit it and
     the builder auto-selects from the entity's home paper; pinned refs are
     still re-verified on every build.
   - `note` — describe, don't quote: no double quotes, no doctrine beyond what
     the cited paragraphs support.
2. Run `node entities/build.mjs` — fix anything it flags.
3. Run `node --test entities/test/entities.test.mjs` — all green before sharing.

## Relationship to the rest of ub-tools

- `ub-recall-places.json` (repo root) maps the names *writers* use (Maya, Rapa Nui)
  to the names the *book* uses, for recall checking. This index starts from the
  book's own names and points at key paragraphs. Complementary, not duplicative.
- `ub-search.js --ref <ref>` prints any cited paragraph's exact text; `ub-verify.js`
  checks quotations. Use them together: find the entity here, read it there.

## License

The JSON files contain only names, citations, and original curator-written
notes — no book text is quoted or redistributed. Book text and topic index
remain © Urantiapedia under CC BY-SA 4.0 (see the repo's root README); these
files are offered under the repo's `LICENSE`.
