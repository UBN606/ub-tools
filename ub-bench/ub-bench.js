#!/usr/bin/env node
/**
 * UB Bench: how accurately does an AI quote and cite The Urantia Book?
 *
 *   node ub-bench.js prompt                       print the standard prompt (paste into any assistant)
 *   node ub-bench.js grade <answers> [more]       grade answer files; prints a comparison table
 *   node ub-bench.js grade <answers> --json       machine-readable results
 *   node ub-bench.js --self-test                  gold answers must score 100%, corrupted ones must not
 *
 * Answer files: plain text with each answer starting "Q01:", "Q02:", ... on its own line
 * (the model name comes from a first line "MODEL: <name>", else the file name), or JSON
 * {"model": "...", "answers": {"Q01": "...", ...}}.
 *
 * Scoring per question (3 points):
 *   cite    the answer cites a gold paragraph (Paper:Section.Paragraph)
 *   quote   the answer contains at least one quotation + citation, and every one of them is
 *           verbatim per ub-verify.js (PASS; a PUNCTUATION finding also fails this point)
 *   fact    the expected fact appears in the answer, in the book's wording ("expect") or an
 *           accepted equivalent ("accept", e.g. "seven years" for "seven-year struggle")
 * Also reported: invented or altered quotes, the failure that matters most: cited quotes that are
 * MISMATCH / NOT FOUND, plus any quoted phrase of 4+ words that appears nowhere in the book.
 *
 * Grading is local and free. Collecting answers from a model is up to the operator: paste the
 * prompt into a chat, or call an API only after checking its cost.
 */
const fs = require('fs');
const path = require('path');
const V = require('../ub-verify.js');
const { getParagraphs } = require('../ub-search.js');

const Q = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8'));

function prompt() {
  return [
    'Answer each question below from The Urantia Book.',
    'For every answer, quote the exact passage from The Urantia Book in double quotation marks, followed immediately by its citation in the form (Paper:Section.Paragraph), for example "..." (180:2.1).',
    'Do not paraphrase inside quotation marks. If you are not sure of the exact wording, say so rather than guessing.',
    'Start each answer on a new line with its number, like "Q01:".',
    '',
    ...Q.questions.map(q => `${q.id}: ${q.question}`),
  ].join('\n');
}

function parseAnswers(file) {
  const raw = fs.readFileSync(file, 'utf8');
  try {
    const j = JSON.parse(raw);
    if (j && j.answers) return { model: j.model || path.basename(file), answers: j.answers };
  } catch { /* plain text */ }
  const lines = raw.split(/\r?\n/);
  let model = path.basename(file).replace(/\.[^.]+$/, '');
  if (/^MODEL:\s*/i.test(lines[0] || '')) model = lines.shift().replace(/^MODEL:\s*/i, '').trim();
  const answers = {};
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^\s*\**\s*(Q\d{2})\s*\**\s*[:.)-]\s*(.*)$/i);
    if (m) { cur = m[1].toUpperCase(); answers[cur] = m[2]; }
    else if (cur) answers[cur] += '\n' + line;
  }
  return { model, answers };
}

const norm = s => ' ' + V.words(s || '').join(' ') + ' ';

function gradeOne(q, text) {
  text = text || '';
  const cited = [...text.matchAll(/(\d{1,3}):(\d{1,2})\.(\d{1,3})/g)].map(m => m[0]);
  const cite = q.gold.some(g => cited.includes(g));
  // One quotation per answer is the norm; ub-verify expects paragraphs, so let each line stand alone.
  const rep = V.verifyText(text.split(/\n/).join('\n\n'), { quotesOnly: true });
  const bad = rep.results.filter(r => r.status === 'MISMATCH' || r.status === 'NOT FOUND');
  const punct = rep.results.filter(r => r.status === 'PUNCTUATION');
  // Quoted phrases with no exact citation ("... (Paper 95, section 4)") are still claims of UB
  // wording: any quoted span of 4+ words must appear verbatim (words) somewhere in the book.
  const checked = new Set(rep.results.map(r => r.body));
  const uncitedBad = [];
  for (const m of text.matchAll(/["“]([^"“”]{8,600})["”]/g)) {
    const body = m[1];
    if (checked.has(body) || V.words(body).length < 4) continue;
    if (!V.findElsewhere([body]).length) uncitedBad.push({ citation: 'none', status: 'NOT IN BOOK', quote: body.slice(0, 120) });
  }
  const quote = rep.results.length > 0 && !bad.length && !punct.length && !uncitedBad.length;
  // fact: the book's wording, or an accepted equivalent statement of the same fact (q.accept)
  const fact = [q.expect, ...(q.accept || [])].some(e => norm(text).includes(norm(e)));
  const invented = [...bad.map(b => ({ citation: b.citation, status: b.status, quote: b.body.slice(0, 120) })), ...uncitedBad];
  return { id: q.id, cite, quote, fact, points: cite + quote + fact, quotes: rep.results.length + uncitedBad.length,
    invented, punctuation: punct.length };
}

function grade(file) {
  const { model, answers } = parseAnswers(file);
  const per = Q.questions.map(q => gradeOne(q, answers[q.id]));
  const total = per.reduce((a, r) => a + r.points, 0);
  return { model, file, answered: Object.keys(answers).length, score: total, max: Q.questions.length * 3,
    pct: Math.round((100 * total) / (Q.questions.length * 3)),
    citeHits: per.filter(r => r.cite).length, verbatim: per.filter(r => r.quote).length, facts: per.filter(r => r.fact).length,
    inventedQuotes: per.reduce((a, r) => a + r.invented.length, 0), per };
}

function printTable(results) {
  const n = Q.questions.length;
  console.log(`\nUB Bench ${Q.version}: ${n} questions, 3 points each\n`);
  console.log('| Model | Score | Correct paragraph cited | All quotes verbatim | Fact right | Invented or altered quotes |');
  console.log('|---|---|---|---|---|---|');
  for (const r of results.sort((a, b) => b.score - a.score))
    console.log(`| ${r.model} | ${r.pct}% (${r.score}/${r.max}) | ${r.citeHits}/${n} | ${r.verbatim}/${n} | ${r.facts}/${n} | ${r.inventedQuotes} |`);
  for (const r of results) {
    const worst = r.per.filter(p => p.invented.length);
    if (!worst.length) continue;
    console.log(`\n${r.model}: invented or altered quotes`);
    for (const p of worst) for (const i of p.invented) console.log(`  ${p.id} (${i.citation}) ${i.status}: "${i.quote}${i.quote.length >= 120 ? '...' : ''}"`);
  }
}

function selfTest() {
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ubbench-'));
  // gold: each answer quotes its first gold paragraph exactly
  const gold = { model: 'gold', answers: {} };
  const broken = { model: 'broken', answers: {} };
  for (const q of Q.questions) {
    const p = getParagraphs([q.gold[0]])[0];
    if (p.error) { console.log(`FAIL gold ref missing: ${q.id} ${q.gold[0]}`); return 1; }
    gold.answers[q.id] = `"${p.text}" (${p.ref})`;
    // corrupt: drop one word from the middle, keep the right citation
    const w = p.text.split(' ');
    w.splice(Math.floor(w.length / 2), 1);
    broken.answers[q.id] = `"${w.join(' ')}" (${p.ref})`;
  }
  fs.writeFileSync(path.join(tmp, 'gold.json'), JSON.stringify(gold));
  fs.writeFileSync(path.join(tmp, 'broken.json'), JSON.stringify(broken));
  const g = grade(path.join(tmp, 'gold.json')), b = grade(path.join(tmp, 'broken.json'));
  const factMiss = g.per.filter(p => !p.fact).map(p => p.id);
  const checks = [
    ['every gold "expect" fact appears in its gold paragraph', factMiss.length === 0, factMiss.join(',')],
    ['gold answers score 100%', g.pct === 100, `${g.pct}%`],
    ['one dropped word fails the verbatim point on every question', b.verbatim === 0, `${b.verbatim} verbatim`],
    ['dropped words are reported as invented or altered', b.inventedQuotes >= Q.questions.length - 2, `${b.inventedQuotes}`],
  ];
  let bad = 0;
  for (const [name, ok, got] of checks) { if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} (${got})`); }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(bad ? `\n${bad} check(s) FAILED` : '\nAll ub-bench self-test checks passed');
  return bad ? 1 : 0;
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) process.exit(selfTest());
if (args[0] === 'prompt') { console.log(prompt()); process.exit(0); }
if (args[0] === 'grade') {
  const files = args.slice(1).filter(a => !a.startsWith('--'));
  if (!files.length) { console.error('Usage: node ub-bench.js grade <answers> [more]'); process.exit(2); }
  const results = files.map(grade);
  if (args.includes('--json')) console.log(JSON.stringify(results, null, 2)); else printTable(results);
  process.exit(0);
}
console.error('Usage: node ub-bench.js prompt | grade <answers...> [--json] | --self-test');
process.exit(2);
