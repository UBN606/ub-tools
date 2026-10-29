#!/usr/bin/env node
// desktop/scripts/smoke.mjs — launch a built UBN Tools app and check it really works.
//   node scripts/smoke.mjs "dist/mac-universal/UBN Tools.app/Contents/MacOS/UBN Tools" [extra args...]
// Checks, through Chrome DevTools: the Studio opens from the bundled files at its web
// address (UB_SITE_SOURCE=bundled, so the build is tested on its own files rather than
// the live website the app uses when online), the page knows it is in the Mac app, no service worker registers, the page
// has no Node.js access, and (needs internet) the whole book loads.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const bin = process.argv[2]
if (!bin || !fs.existsSync(bin)) { console.error(`smoke: no app at ${bin}`); process.exit(2) }
const PORT = 9333
// A throwaway profile, so the check never touches a real reader's data.
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ub-tools-smoke-'))
const child = spawn(bin, [...process.argv.slice(3), `--remote-debugging-port=${PORT}`], {
  stdio: 'inherit',
  env: { ...process.env, UB_USER_DATA: profile, UB_SITE_SOURCE: 'bundled' },
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); if (!ok) failed++ }

async function pageTarget() {
  for (let i = 0; i < 90; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      // By address, not title: the title is branding and changes (it did, to UBN Tools).
      const page = list.find((t) => t.type === 'page' && t.url.startsWith('https://ubn606.github.io/ub-tools/app/'))
      if (page) return page
    } catch { /* not up yet */ }
    await sleep(1000)
  }
  return null
}

async function run() {
  const page = await pageTarget()
  check('app window opens the Studio', Boolean(page), page ? page.url : 'no page after 90s')
  if (!page) return
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
  let id = 0
  const evaluate = (expression) => new Promise((resolve) => {
    const my = ++id
    const onMsg = (e) => {
      const m = JSON.parse(e.data)
      if (m.id !== my) return
      ws.removeEventListener('message', onMsg)
      resolve(m.result?.exceptionDetails ? { error: m.result.exceptionDetails.exception?.description } : m.result?.result?.value)
    }
    ws.addEventListener('message', onMsg)
    ws.send(JSON.stringify({ id: my, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }))
  })

  // The page's title appears as soon as <head> is parsed; wait for the whole page and its scripts.
  let ready = false
  for (let i = 0; i < 30 && !ready; i++) {
    ready = (await evaluate("document.readyState === 'complete' && Boolean(document.getElementById('mic'))")) === true
    if (!ready) await sleep(1000)
  }
  check('page finishes loading', ready)
  check('served at the Studio address', page.url === 'https://ubn606.github.io/ub-tools/app/', page.url)
  const desktop = await evaluate('JSON.stringify(window.ubDesktop || null)')
  check('page knows it is the Mac app', /"platform":"darwin"/.test(String(desktop)) || process.platform !== 'darwin', String(desktop))
  check('no Node.js in the page', (await evaluate('typeof require + typeof process')) === 'undefinedundefined')
  check('bundled tool files load', (await evaluate("fetch('../ub-search.js').then(r => r.status)")) === 200)
  check('dead mic button hidden (use Mac Dictation)', (await evaluate("document.getElementById('mic').hidden")) === true)
  await sleep(3000) // give app.js time to (not) register a service worker
  check('no service worker on desktop', (await evaluate('navigator.serviceWorker.getRegistrations().then(r => r.length)')) === 0)

  // Needs internet (Urantiapedia on GitHub); reported, but not a build failure.
  const book = await evaluate("import('./engine.js').then(m => m.loadEngine()).then(e => e.paragraphs).catch(e => 'ERR ' + e.message)")
  console.log(`${book === 14596 ? 'PASS' : 'WARN'}  whole book loads (${book} paragraphs)`)
  ws.close()
}

try { await run() } catch (e) { check('smoke test ran', false, e.message) }
// Let the app finish writing its profile before removing it.
const exited = new Promise((r) => child.once('exit', r))
child.kill()
await Promise.race([exited, sleep(10000)])
try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }) } catch { /* temp dir: the OS cleans it */ }
process.exit(failed ? 1 : 0)
