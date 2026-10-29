// node --test test/cli.test.mjs
// The command-line output other tools read. Prophet (github.com/UBN606/prophet, prophet_ub.py) runs
// ub-search.js and parses its text: the "Found N results." line, the "--- (ref) Paper N: title ---"
// result lines and the "### ref  [page | Paper | section | author]" blocks of --ref. ub-ask.js prints
// the Studio's answers in the same --ref blocks. A change to any of these formats breaks those tools,
// so it has to be deliberate: change this test and tell the tools that read it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { answer } from '../app/ask.js'

const require = createRequire(import.meta.url)
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const search = require('../ub-search.js')
const index = require('../source-texts/ub-search-index.json')
const byRef = new Map()
for (const p of index.papers)
  for (const s of p.sections)
    for (const par of s.paragraphs)
      byRef.set(par.ref, { ...par, paper: p.paper_index, paperTitle: p.paper_title, author: p.author, sectionTitle: s.section_title })

const run = (script, ...args) => spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8' })

// The same patterns prophet_ub.py uses (FOUND_RE, HIT_RE, and the --ref header it splits on " | ").
const FOUND_RE = /^Found (\d+) results\./m
const HIT_RE = /^--- \((\d+:\d+\.\d+)\) Paper (\d+): (.+?) ---\s*$/gm
const BLOCK_RE = /^### (\d+:\d+\.\d+)  \[page ([^|\]]+) \| Paper (\d+): ([^|\]]+) \| (.+) \| ([^|\]]+)\]\n([\s\S]*?)\n\n/gm
const blocks = (out) => [...out.matchAll(BLOCK_RE)].map((m) => ({ ref: m[1], page: m[2], paper: Number(m[3]), paperTitle: m[4], section: m[5], author: m[6], text: m[7] }))

test('ub-search.js: a search prints the count line and one header line per result', () => {
  const r = run('ub-search.js', 'vine branches', '--limit', '3')
  assert.equal(r.status, 0)
  assert.ok(Number(r.stdout.match(FOUND_RE)?.[1]) >= 3, r.stdout.slice(0, 200))
  const hits = [...r.stdout.matchAll(HIT_RE)]
  assert.equal(hits.length, 3)
  assert.deepEqual([hits[0][1], hits[0][2], hits[0][3]], ['180:2.1', '180', 'The Farewell Discourse'])
})

test('ub-search.js --ref: exact text in ### blocks; a missing ref is reported and exits 1', () => {
  const r = run('ub-search.js', '--ref', '180:2.2', '180:2.99')
  assert.equal(r.status, 1)
  const [b] = blocks(r.stdout)
  const exact = search.getParagraphs(['180:2.2'])[0]
  assert.deepEqual(b, { ref: '180:2.2', page: exact.page, paper: 180, paperTitle: exact.paperTitle, section: exact.section, author: exact.author, text: exact.text })
  assert.match(r.stdout, /^### 180:2\.99\n\*Reference not found\*$/m)
})

for (const q of ['How old is Urantia?', 'Do I have a guardian angel?']) {
  test(`ub-ask.js gives the Studio's answer in --ref blocks: "${q}"`, () => {
    const r = run('ub-ask.js', q)
    assert.equal(r.status, 0, r.stderr)
    const got = blocks(r.stdout)
    assert.deepEqual(got.map((b) => b.ref), answer({ search, byRef }, q).refs)
    for (const b of got) assert.equal(b.text, search.getParagraphs([b.ref])[0].text, `${b.ref} is not the exact text`)
  })
}

test('ub-ask.js --json: the same passages, exact text, plus the next refs and book terms', () => {
  const q = 'What is the will of God?'
  const r = run('ub-ask.js', q, '--max', '3', '--json')
  assert.equal(r.status, 0, r.stderr)
  const j = JSON.parse(r.stdout)
  const studio = answer({ search, byRef }, q, { max: 3 })
  assert.equal(j.question, q)
  assert.deepEqual(j.passages.map((p) => p.ref), studio.refs)
  assert.deepEqual(j.morePassages, studio.more)
  for (const p of j.passages) assert.equal(p.text, search.getParagraphs([p.ref])[0].text)
})

test('ub-ask.js: no question is a usage error', () => {
  const r = run('ub-ask.js')
  assert.equal(r.status, 1)
  assert.match(r.stderr, /Usage: node ub-ask\.js/)
})
