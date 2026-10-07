// scripts/bump-sw.mjs — stamp a fresh version into app/sw.js before pushing.
// Usage:  node scripts/bump-sw.mjs
// Then:   git add app/sw.js && git commit && git push
//
// Why: the browser only looks for a new service worker when sw.js itself
// changes byte-for-byte. Bumping VERSION on every push is what makes the
// "A new version is ready" banner actually appear for readers. Skip this
// step and readers sit on the old cached app (the Polish-bug scenario).
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const swPath = join(root, 'app', 'sw.js')

const now = new Date()
// UTC timestamp, sortable: 20261007T143022
const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '')
const version = `ub-tools-${stamp}`

let sw = readFileSync(swPath, 'utf8')
const before = sw
sw = sw.replace(/const VERSION = 'ub-tools-[^']*'/, `const VERSION = '${version}'`)
if (sw === before) {
  console.error('bump-sw: VERSION line not found in app/sw.js — is the format still "const VERSION = \'ub-tools-...\'"?')
  process.exit(1)
}
writeFileSync(swPath, sw)
console.log(`bump-sw: app/sw.js VERSION -> ${version}`)
console.log('Next: git add app/sw.js && git commit -m "..." && git push')
