#!/usr/bin/env node
/**
 * Downloads the text these tools need, then builds the search index. Run once before first use.
 *
 *   node fetch-data.js                 download from Urantiapedia's GitHub (about 14 MB, 223 files)
 *   node fetch-data.js --from <dir>    copy from a local folder with the same layout instead
 *
 * Source: Urantiapedia (https://urantiapedia.org, https://github.com/JanHerca/urantiapedia),
 * content under the Creative Commons Attribution-ShareAlike 4.0 license. This repository does not
 * redistribute that content; each user downloads it directly from Urantiapedia.
 *   input/json/book-en/Doc000.json ... Doc196.json  ->  source-texts/papers/
 *   input/txt/topic-index-en/a.txt ... z.txt        ->  source-texts/topic-index/
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');

const BASE = 'https://raw.githubusercontent.com/JanHerca/urantiapedia/master/input';
const OUT = path.join(__dirname, 'source-texts');
const fromIdx = process.argv.indexOf('--from');
const FROM = fromIdx > 0 ? process.argv[fromIdx + 1] : null;

const jobs = [];
for (let i = 0; i <= 196; i++) {
  const n = `Doc${String(i).padStart(3, '0')}.json`;
  jobs.push({ url: `${BASE}/json/book-en/${n}`, local: FROM && path.join(FROM, 'papers', n), out: path.join(OUT, 'papers', n) });
}
for (const c of 'abcdefghijklmnopqrstuvwxyz') {
  jobs.push({ url: `${BASE}/txt/topic-index-en/${c}.txt`, local: FROM && path.join(FROM, 'topic-index', `${c}.txt`), out: path.join(OUT, 'topic-index', `${c}.txt`), optional: true });
}

function get(url, tries = 3) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ub-tools-fetch' } }, res => {
      if (res.statusCode !== 200) { res.resume(); return tries > 1 ? setTimeout(() => get(url, tries - 1).then(resolve, reject), 1000) : reject(new Error(`HTTP ${res.statusCode} for ${url}`)); }
      const chunks = []; res.on('data', d => chunks.push(d)); res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', e => (tries > 1 ? setTimeout(() => get(url, tries - 1).then(resolve, reject), 1000) : reject(e)));
  });
}

(async () => {
  fs.mkdirSync(path.join(OUT, 'papers'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'topic-index'), { recursive: true });
  let done = 0, skipped = 0, bytes = 0;
  const queue = jobs.slice();
  async function worker() {
    for (let j; (j = queue.shift());) {
      try {
        const buf = FROM ? fs.readFileSync(j.local) : await get(j.url);
        if (j.out.endsWith('.json')) JSON.parse(buf.toString('utf8')); // refuse to save a corrupt paper
        fs.writeFileSync(j.out, buf);
        done++; bytes += buf.length;
        if (done % 25 === 0) process.stdout.write(`  ${done}/${jobs.length}\n`);
      } catch (e) {
        if (j.optional) { skipped++; continue; }
        console.error(`FAILED: ${e.message}`); process.exitCode = 1;
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`Saved ${done} files (${(bytes / 1048576).toFixed(1)} MB)${skipped ? `, ${skipped} optional topic files missing` : ''}.`);
  const papers = fs.readdirSync(path.join(OUT, 'papers')).filter(f => /^Doc\d{3}\.json$/.test(f)).length;
  if (papers !== 197) { console.error(`Expected 197 paper files, found ${papers}. Not building the index.`); process.exit(1); }
  console.log('Building the search index...');
  execFileSync(process.execPath, [path.join(__dirname, 'build-search-index.js')], { stdio: 'inherit' });
  console.log('\nReady. Try:  node ub-search.js "vine branches"   and   node ub-verify.js --self-test');
})();
