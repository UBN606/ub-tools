// node --test app/test/mcp-ask.test.mjs
// ub_ask in ub-mcp.js must give the same answers as the Studio's Ask: the same top
// paragraphs, in the same order. Drives the real MCP server over stdio and compares
// with answer() given the byRef map app/engine.js builds for the browser.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { answer } from '../ask.js'

const require = createRequire(import.meta.url)
const search = require('../../ub-search.js')
const index = require('../../source-texts/ub-search-index.json')
const byRef = new Map()
for (const p of index.papers)
  for (const s of p.sections)
    for (const par of s.paragraphs)
      byRef.set(par.ref, { ...par, paper: p.paper_index, paperTitle: p.paper_title, author: p.author, sectionTitle: s.section_title })
const E = { search, byRef }

// The two examples from the report, plus questions whose answers come from the
// rules that read paragraph text (age of Urantia, Jesus' lifespan, whole words).
const QUESTIONS = [
  'Define the Supreme Being for me.',
  'how many midwayers were created and how many are left?',
  'How old is Urantia?',
  'How old was Jesus when he died?',
  'Do I have a guardian angel?',
  'What is the will of God?',
]

// Ask every question in one server session; resolves to { question: [refs] }.
function askMcp(questions) {
  return new Promise((resolve, reject) => {
    const server = spawn(process.execPath, [fileURLToPath(new URL('../../ub-mcp.js', import.meta.url))], { stdio: ['pipe', 'pipe', 'ignore'] })
    const got = {}
    let buffer = ''
    server.on('error', reject)
    server.stdout.setEncoding('utf8')
    server.stdout.on('data', (chunk) => {
      buffer += chunk
      let i
      while ((i = buffer.indexOf('\n')) >= 0) {
        const msg = JSON.parse(buffer.slice(0, i))
        buffer = buffer.slice(i + 1)
        if (msg.id >= 1 && msg.id <= questions.length) {
          if (msg.error || msg.result.isError) return reject(new Error(JSON.stringify(msg)))
          got[questions[msg.id - 1]] = JSON.parse(msg.result.content[0].text).passages.map((p) => p.ref)
          if (Object.keys(got).length === questions.length) { server.stdin.end(); resolve(got) }
        }
      }
    })
    const send = (m) => server.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n')
    send({ id: 0, method: 'initialize', params: { protocolVersion: '2024-11-05' } })
    questions.forEach((question, i) => send({ id: i + 1, method: 'tools/call', params: { name: 'ub_ask', arguments: { question } } }))
  })
}

test('ub_ask returns the same top refs as the Studio', { timeout: 60000 }, async () => {
  const mcp = await askMcp(QUESTIONS)
  for (const q of QUESTIONS) {
    const studio = answer(E, q).refs
    assert.ok(studio.length > 0, `Studio found nothing for "${q}"`)
    assert.deepEqual(mcp[q], studio, `"${q}"`)
  }
})

test('ub_ask without byRef would differ, so the comparison above can fail', () => {
  // Guards the test itself: if every question ranked the same without byRef,
  // dropping byRef from ub-mcp.js again would go unnoticed.
  assert.ok(QUESTIONS.some((q) => answer({ search: { searchUB: search.searchUB } }, q).refs.join() !== answer(E, q).refs.join()))
})
