#!/usr/bin/env node
// desktop/scripts/stage.mjs — copy the Studio's files into desktop/site/ for the
// Mac app to bundle, and the 1024px app icon into desktop/build/icon.png.
//
// Only files tracked by git are copied, so nothing local leaks into a build:
// never source-texts/ (Urantiapedia's text is downloaded by each reader, as on
// the web), never app/i18n/ (translation zips with their own rights).
// Left out on purpose, and fetched from the live site when a reader needs them:
// the 100 MB read-along timings (audio/aligned/) and the quote-card PNGs.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DESKTOP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(DESKTOP, '..')
const OUT = path.join(DESKTOP, 'site')

// Path prefixes (relative to the repository root) that never ship in the app.
export const EXCLUDE = [
  '.github/', 'desktop/', 'audio/aligned/', 'quote-cards/png/', 'ub-bench/', 'server/', 'scripts/',
  'source-texts/', 'app/i18n/', 'node_modules/',
]
// Development-only files anywhere in the tree.
export const EXCLUDE_RE = [/(^|\/)test\//, /(^|\/)tests\//, /\.py$/, /(^|\/)\.gitignore$/, /(^|\/)\.DS_Store$/]

export function shipped(rel) {
  return !EXCLUDE.some((p) => rel.startsWith(p)) && !EXCLUDE_RE.some((re) => re.test(rel))
}

function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
  return out.split('\0').filter(Boolean)
}

function main() {
  const files = trackedFiles().filter(shipped)
  for (const must of ['app/index.html', 'ub-search.js', 'ub-verify.js', 'ub-recall.js', 'ub-claims.js', 'build-search-index.js']) {
    if (!files.includes(must)) throw new Error(`stage: ${must} is missing from the repository`)
  }
  fs.rmSync(OUT, { recursive: true, force: true })
  let bytes = 0
  for (const rel of files) {
    const from = path.join(ROOT, rel)
    if (!fs.existsSync(from)) continue // deleted in the working tree, not yet committed
    const to = path.join(OUT, rel)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(from, to)
    bytes += fs.statSync(to).size
  }
  fs.mkdirSync(path.join(DESKTOP, 'build'), { recursive: true })
  fs.copyFileSync(path.join(ROOT, 'app', 'icons', 'icon-1024.png'), path.join(DESKTOP, 'build', 'icon.png'))
  console.log(`stage: ${files.length} files, ${(bytes / 1e6).toFixed(1)} MB -> desktop/site/`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
