// node --test app/test/tools.test.mjs
// Tests the Tools view's data table (pure data, no DOM needed).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TOOLS } from '../tools.js'

const GH_PREFIX = 'https://github.com/UBN606/ub-tools/tree/main/'

test('TOOLS covers every new tool in the kit', () => {
  const ids = TOOLS.map((t) => t.id).sort()
  assert.deepEqual(ids, ['api', 'audio', 'entities', 'extension', 'parallel', 'quote-cards', 'visuals'])
})

test('every tool has a title, blurb, and how-to-use line', () => {
  for (const t of TOOLS) {
    assert.ok(t.title && t.title.length > 3, `${t.id} needs a title`)
    assert.ok(t.blurb && t.blurb.length > 20, `${t.id} needs a blurb`)
    assert.ok(t.use && t.use.length > 10, `${t.id} needs a how-to-use line`)
  }
})

test('every tool opens somewhere: a Studio view, a local page, or GitHub', () => {
  for (const t of TOOLS) {
    assert.ok(t.view || t.local || t.github, `${t.id} has no destination`)
    if (t.github) assert.ok(t.github.startsWith(GH_PREFIX), `${t.id} GitHub URL malformed`)
    if (t.local) assert.ok(t.local.startsWith('../'), `${t.id} local path should be repo-relative`)
  }
})

test('in-Studio tools point at real views', () => {
  const views = { visuals: 'explore', audio: 'listen' }
  for (const t of TOOLS) {
    if (views[t.id]) assert.equal(t.view, views[t.id])
  }
})

test('tool ids are unique', () => {
  const ids = TOOLS.map((t) => t.id)
  assert.equal(new Set(ids).size, ids.length)
})
