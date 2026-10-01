// node --test app/test/tools.test.mjs
// Tests the Tools view's data table (pure data, no DOM needed).
// The tab must stay jargon-free: no code-hosting sites, no developer terms.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TOOLS } from '../tools.js'

const BANNED = ['github', 'JSON', 'repo', 'npm', 'server', 'API']

test('TOOLS covers the kit in plain language', () => {
  const ids = TOOLS.map((t) => t.id).sort()
  assert.deepEqual(ids, ['api', 'audio', 'entities', 'extension', 'parallel', 'quote-cards', 'visuals'])
})

test('every tool has a plain title and blurb', () => {
  for (const t of TOOLS) {
    assert.ok(t.title && t.title.length > 3, `${t.id} needs a title`)
    assert.ok(t.blurb && t.blurb.length > 20, `${t.id} needs a blurb`)
    for (const word of BANNED) {
      assert.ok(!t.title.includes(word), `${t.id} title mentions ${word}`)
      assert.ok(!t.blurb.includes(word), `${t.id} blurb mentions ${word}`)
    }
  }
})

test('no tool shows a code-hosting site to the reader', () => {
  // Visible strings only — fetch fallbacks may use the public website host.
  const visible = TOOLS.map((t) => [t.title, t.blurb, t.hint || '', t.action.label || ''].join(' ')).join(' ').toLowerCase()
  assert.ok(!visible.includes('github'), 'a GitHub mention leaked into the Tools tab')
})

test('every action is a known kind with what it needs', () => {
  for (const t of TOOLS) {
    const a = t.action
    assert.ok(['page', 'view', 'entities', 'extension'].includes(a.kind), `${t.id} has unknown action kind`)
    if (a.kind === 'page') assert.ok(a.local && a.remote && a.label, `${t.id} page action incomplete`)
    if (a.kind === 'view') assert.ok(a.view && a.label, `${t.id} view action incomplete`)
  }
})

test('tool ids are unique', () => {
  const ids = TOOLS.map((t) => t.id)
  assert.equal(new Set(ids).size, ids.length)
})
