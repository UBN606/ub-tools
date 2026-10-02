// node --test app/test/parse-i18n.test.mjs
// Parser parity: the JS parser (app/parse-i18n.js) must reproduce the Python
// parsers' output on the three official TXT editions. Every paragraph ref must
// match exactly; paragraph text must match modulo whitespace normalization
// (the Python join uses single spaces; the JS does the same, so in practice
// this is exact).
//
// The official TXTs live outside the repo (rights): /tmp/ub-{es,fr,ko}-txt.zip,
// downloaded from urantia.org. The reference outputs are the Python builds in
// ~/workspace/ub-{es,fr,ko}-build/papers-*/.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseTranslation } from '../parse-i18n.js'

const require = createRequire(import.meta.url)
const HOME = process.env.HOME || '/home/hatch'
const norm = (s) => s.replace(/\s+/g, ' ').trim()

function officialText(lang) {
  const zip = `/tmp/ub-${lang}-txt.zip`
  const out = `/tmp/ub-${lang}-official.txt`
  assert.ok(existsSync(zip), `missing ${zip} — download the official TXT from urantia.org`)
  if (!existsSync(out)) execSync(`unzip -p ${zip} > ${out}`, { stdio: 'pipe' })
  return readFileSync(out, 'utf-8')
}

function referenceDocs(lang) {
  const dir = `${HOME}/workspace/ub-${lang}-build/papers-${lang}`
  const docs = []
  for (let i = 0; i <= 196; i++) {
    docs.push(JSON.parse(readFileSync(`${dir}/Doc${String(i).padStart(3, '0')}.json`, 'utf-8')))
  }
  return docs
}

function englishAuthor(pidx) {
  const d = JSON.parse(readFileSync(
    `${HOME}/workspace/repos/ub-tools/source-texts/papers/Doc${String(pidx).padStart(3, '0')}.json`, 'utf-8'))
  return d.author || ''
}

for (const lang of ['es']) { // FR/KO parity after those ship
  test(`parse-i18n parity with the Python ${lang} parser`, { timeout: 120000, skip: !existsSync(`/tmp/ub-${lang}-txt.zip`) }, () => {
    const { docs, stats } = parseTranslation(officialText(lang), lang, { englishAuthor })
    const refDocs = referenceDocs(lang)
    assert.equal(docs.length, 197)
    let parCount = 0, textDiffs = []
    for (let i = 0; i <= 196; i++) {
      const got = docs[i], want = refDocs[i]
      assert.equal(got.paper_index, i)
      assert.equal(got.paper_title, want.paper_title, `Doc${i} title`)
      assert.equal(got.author, want.author, `Doc${i} author`)
      const gotSecs = got.sections, wantSecs = want.sections
      assert.equal(gotSecs.length, wantSecs.length, `Doc${i} section count`)
      for (let si = 0; si < wantSecs.length; si++) {
        const gs = gotSecs[si], ws = wantSecs[si]
        assert.equal(gs.section_index, ws.section_index, `Doc${i} sec ${si} index`)
        assert.equal(gs.section_ref, ws.section_ref, `Doc${i} sec ${si} ref`)
        assert.equal(gs.section_title, ws.section_title, `Doc${i} sec ${si} title`)
        const gp = gs.paragraphs, wp = ws.pars
        assert.equal(gp.length, wp.length, `Doc${i} sec ${si} paragraph count`)
        for (let pi = 0; pi < wp.length; pi++) {
          parCount++
          assert.equal(gp[pi].ref, wp[pi].par_ref, `Doc${i} sec ${si} par ${pi} ref`)
          if (norm(gp[pi].text) !== norm(wp[pi].par_content)) {
            if (textDiffs.length < 5) textDiffs.push(`${gp[pi].ref}: ${norm(gp[pi].text).slice(0, 60)}...`)
          }
        }
      }
    }
    assert.deepEqual(textDiffs, [], `text diffs in ${textDiffs.length} paragraphs`)
    console.log(`  ${lang}: ${parCount} paragraphs, all refs + text match; ` +
      `kept brackets=${stats.keptBrackets.length}, backfilled=${stats.backfilled.length}, ` +
      `mismatches=${stats.mismatches.length}`)
  })
}
