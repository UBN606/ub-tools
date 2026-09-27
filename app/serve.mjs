#!/usr/bin/env node
// Run UB Tools Studio on this computer:  node app/serve.mjs   then open the address it prints.
// Serves this repository folder only, on 127.0.0.1, so the app can read ../ub-*.js and, if you
// ran node fetch-data.js, the book text in ../source-texts (otherwise it loads from Urantiapedia).
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.PORT || 4178)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' }

http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://localhost').pathname))
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end() }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html')
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('Not found') }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' })
  if (req.method === 'HEAD') return res.end()
  fs.createReadStream(f).pipe(res)
}).listen(PORT, '127.0.0.1', () => console.log(`UB Tools Studio: http://127.0.0.1:${PORT}/app/`))
