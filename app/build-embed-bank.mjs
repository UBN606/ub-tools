#!/usr/bin/env node
/**
 * build-embed-bank.mjs — build the verified quote bank for embed-quote.js.
 *
 * Quotes are NEVER typed by hand. The script MACHINE-SLICES sentences from the
 * local book text (source-texts/papers/Doc*.json):
 *   1. split each paragraph into sentences, strip the repo's markup
 *      (same stripMarkup as ub-verify.js) and filter for short (60-160 chars),
 *      self-contained, uplifting sentences on ten topics
 *      (prayer, faith, love, service, courage, worship, forgiveness,
 *       wisdom, peace, joy);
 *   2. rank candidates per topic by an uplift-word score, then round-robin
 *      across topics (max 2 quotes per paper) for a balanced, spread bank;
 *   3. verify EVERY chosen quote with the real ub-verify.js CLI
 *      (--quotes-only --json) and require verdict PASS — failures are dropped
 *      and replaced from the ranked reserve list;
 *   4. rewrite only the __BANK__ ... __END_BANK__ marker region of
 *      app/embed-quote.js with the generated `var UBQ_BANK = [...]`.
 *
 * The widget code stays hand-written; only the bank is generated.
 * Deterministic: same book text always yields the same bank order
 * (final sort is by numeric citation).
 *
 * Usage: node app/build-embed-bank.mjs [--target 60]
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '..');
const widgetFile = path.join(dir, 'embed-quote.js');

const target = parseInt((process.argv.find(a => a.startsWith('--target=')) || '').split('=')[1] || '60', 10);
const MIN_BANK = 50; // hard floor: the widget tests require >= 50

// ---------- slicing ----------
// stripMarkup mirrors ub-verify.js so sliced quotes match its normalization.
function stripMarkup(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&rsquo;|&lsquo;/g, '’')
    .replace(/&rdquo;|&ldquo;|&quot;/g, '"').replace(/[*_]{1,3}/g, '')
    .replace(/^\s*>\s?/gm, ' ');
}

const TOPICS = [
  ['prayer',      ['prayer', 'pray', 'prayed', 'prays', 'praying']],
  ['faith',       ['faith', 'faithful', 'believe', 'believes', 'believed', 'belief']],
  ['love',        ['love', 'loved', 'loves', 'loving', 'beloved', 'affection']],
  ['service',     ['serve', 'serves', 'served', 'serving', 'service', 'servant', 'unselfish', 'ministering']],
  ['courage',     ['courage', 'courageous', 'fear not', 'fearless', 'brave', 'bravery', 'undaunted', 'daring', 'bold', 'boldness', 'valiant', 'heroic', 'heroism', 'steadfast', 'persevere', 'perseverance', 'endure', 'endurance', 'fortitude', 'good cheer']],
  ['worship',     ['worship', 'worships', 'adore', 'adoration', 'reverence']],
  ['forgiveness', ['forgive', 'forgives', 'forgiven', 'forgiveness', 'mercy', 'merciful']],
  ['wisdom',      ['wisdom', 'wise', 'wisely']],
  ['peace',       ['peace', 'peaceful']],
  ['joy',         ['joy', 'joyous', 'joyful', 'rejoice', 'rejoices', 'rejoiced', 'rejoicing', 'happy', 'happiness', 'glad', 'gladness']],
];
const kwOf = t => TOPICS.find(x => x[0] === t)[1].map(k => new RegExp('\\b' + k.replace(/ /g, '\\s+') + '\\b', 'i'));
const KW = TOPICS.map(([t]) => ({ t, res: kwOf(t) }));

const NEG = /\b(not|never|none|neither|nor|cannot|can't|won't|don't|isn't|wasn't|aren't|weren't|hasn't|haven't|hadn't|couldn't|shouldn't|wouldn't|n't)\b/i;
const DARK = /\b(evil|wicked|iniquity|hell|damn|murder|kill|killed|rebellion|lucifer|satan|caligastia|daligastia|devil|demon|wrath|doom|hatred|cruel|slavery|suffer|sorrow|grief|tears|death|died|dying|dead)\b/i;
const BADSTART = /^(and|but|for|so|yet|nor|then|now|thus|therefore|however|also|he|she|it|they|we|you|this|that|these|those|his|her|its|their|our|your|such|who|whom|whose|which|no|not|never|to)\b/i;
const UPLIFT = /\b(love|joy|peace|hope|faith|truth|beauty|goodness|happiness|happy|mercy|kindness|kind|light|eternal|spirit|spiritual|divine|heaven|paradise|blessed|grace|glory|noble|good|sweet|tender|gentle|free|freedom|victory|triumph|courage|brave|wisdom|wise|worship|prayer)\b/gi;
// Hand-tuned vetoes for sentences that pass the mechanical filters but read as
// bureaucratic, fragmentary, or downbeat out of context in a quote widget.
const VETO = [
  /\bseldom\b/i, /\bnot worthy\b/i, /\bghost\b/i, /\bancestor worship\b/i,
  /\bBy the nature of God\b/, /\bsentimental sophistry\b/i, /\btrade organizations\b/i,
  /^I do not\b/i, /\bI may not\b/i, /\bI have served as\b/i,
  /\bpotential mercy minister\b/i, /\bnot a substitute\b/i,
  /\bbreathe upon\b/i, /\bLater on we observed\b/i, /\bemotional life reaching upward\b/i,
  /\bself- or creature-interest\b/i, /\bPerfectors of Wisdom\b/i, /\bministering spirits\b/i,
  /\bto whom this order\b/i, /\bbargaining petition\b/i, /\bdestroyed the olden ways\b/i,
  /\billumination and enlightenment of scientific research\b/i,
  /\bThe possession of new courage\b/i, /\bpeace will not always attend\b/i,
  /\bgreat difficulty in leading\b/i, /\breally God-knowing\b/i,
  /\bendurance of nations\b/i, /\bfree states live together\b/i,
  /\bworship of false gods\b/i,
];
const MIN_LEN = 60, MAX_LEN = 160;

function candidates() {
  const papersDir = path.join(root, 'source-texts', 'papers');
  const files = fs.readdirSync(papersDir).filter(f => /^Doc\d{3}\.json$/.test(f)).sort();
  const byTopic = {};
  for (const f of files) {
    const doc = JSON.parse(fs.readFileSync(path.join(papersDir, f), 'utf8'));
    for (const s of doc.sections) for (const par of s.pars) {
      const text = stripMarkup(par.par_content).replace(/\s+/g, ' ').replace(/\*/g, '').trim();
      for (const m of (text.match(/[^.!?]+[.!?]+/g) || [])) {
        const q = m.trim();
        if (q.length < MIN_LEN || q.length > MAX_LEN) continue;
        if (!/^[A-Z]/.test(q)) continue;
        if (/["“”‘’()\[\]<>]/.test(q)) continue; // no partial dialogue, refs, or markup
        if (/\d/.test(q)) continue;
        if (/\bsaid\b/i.test(q)) continue;
        if (BADSTART.test(q) || DARK.test(q)) continue;
        if (VETO.some(rx => rx.test(q))) continue;
        let topic = null;
        for (const k of KW) {
          const r = k.res.find(rx => rx.test(q));
          if (r) {
            const before = q.slice(Math.max(0, q.search(r) - 30), q.search(r));
            if (!NEG.test(before)) { topic = k.t; break; } // skip negated keywords
          }
        }
        if (!topic) continue;
        const score = (q.match(UPLIFT) || []).length;
        (byTopic[topic] = byTopic[topic] || []).push({ q, c: par.par_ref, t: topic, score, paper: parseInt(par.par_ref, 10) });
      }
    }
  }
  const key = c => c.split(/[:.]/).map(Number);
  for (const t of Object.keys(byTopic)) {
    byTopic[t].sort((a, b) => b.score - a.score
      || (key(a.c)[0] - key(b.c)[0]) || (key(a.c)[1] - key(b.c)[1]) || (key(a.c)[2] - key(b.c)[2]));
  }
  return byTopic;
}

// Round-robin across topics, max 2 quotes per paper, dedupe by quote text.
function select(byTopic, n) {
  const topics = TOPICS.map(([t]) => t);
  const used = new Set(), perPaper = {}, chosen = [], reserve = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (const t of topics) {
      const c = (byTopic[t] || []).find(x => !used.has(x.q) && (perPaper[x.paper] || 0) < 2);
      if (!c) continue;
      used.add(c.q);
      perPaper[c.paper] = (perPaper[c.paper] || 0) + 1;
      (chosen.length < n ? chosen : reserve).push(c);
      progress = true;
    }
  }
  const key = c => c.split(/[:.]/).map(Number);
  const sortCite = (a, b) => (key(a.c)[0] - key(b.c)[0]) || (key(a.c)[1] - key(b.c)[1]) || (key(a.c)[2] - key(b.c)[2]);
  chosen.sort(sortCite);
  return { chosen, reserve };
}

// ---------- verification with the real ub-verify.js CLI ----------
function verifyPass(items) {
  if (!items.length) return [];
  const tmp = path.join(os.tmpdir(), `ubq-verify-${process.pid}-${Date.now()}.txt`);
  fs.writeFileSync(tmp, items.map(x => `"${x.q}" (${x.c})`).join('\n') + '\n');
  let report;
  try {
    const out = execFileSync('node', [path.join(root, 'ub-verify.js'), tmp, '--quotes-only', '--json'], { encoding: 'utf8', cwd: root });
    report = JSON.parse(out);
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
  const byLine = {};
  for (const q of (report[0] && report[0].quotes) || []) byLine[q.line] = q.status;
  return items.filter((_, i) => byLine[i + 1] === 'PASS');
}

// ---------- main ----------
const byTopic = candidates();
const counts = Object.fromEntries(Object.entries(byTopic).map(([t, v]) => [t, v.length]));
console.log(`sliced candidates per topic: ${JSON.stringify(counts)}`);

let { chosen, reserve } = select(byTopic, target);
let bank = verifyPass(chosen);
let failed = chosen.length - bank.length;
console.log(`first pass: ${bank.length} PASS, ${failed} failed`);
while (bank.length < target && reserve.length) {
  const need = target - bank.length;
  const batch = reserve.splice(0, need * 2);
  const ok = verifyPass(batch);
  failed += batch.length - ok.length;
  bank = bank.concat(ok);
  console.log(`refill: +${ok.length} PASS (${batch.length - ok.length} failed), bank=${bank.length}`);
}
bank = bank.slice(0, target);
if (bank.length < MIN_BANK) {
  console.error(`FATAL: only ${bank.length} PASS-verified quotes (need >= ${MIN_BANK}); not writing bank`);
  process.exit(1);
}
const key = c => c.split(/[:.]/).map(Number);
bank.sort((a, b) => (key(a.c)[0] - key(b.c)[0]) || (key(a.c)[1] - key(b.c)[1]) || (key(a.c)[2] - key(b.c)[2]));

// ---------- write into embed-quote.js ----------
let src = fs.readFileSync(widgetFile, 'utf8');
const START = '/*__BANK__*/', END = '/*__END_BANK__*/';
const i = src.indexOf(START), j = src.indexOf(END);
if (i < 0 || j < 0 || j < i) { console.error('FATAL: bank placeholder markers not found in embed-quote.js'); process.exit(1); }
const entries = bank.map(x => ({ q: x.q, c: x.c, t: x.t }));
const generated = '  var UBQ_BANK = ' + JSON.stringify(entries, null, 2).replace(/\n/g, '\n  ') + ';';
src = src.slice(0, i + START.length) + '\n' + generated + '\n  ' + src.slice(j);
fs.writeFileSync(widgetFile, src);

const bytes = fs.statSync(widgetFile).size;
const topics = [...new Set(bank.map(x => x.t))].sort();
const papers = new Set(bank.map(x => x.paper)).size;
console.log(`wrote ${bank.length} PASS-verified quotes (${failed} dropped) into ${path.relative(root, widgetFile)}`);
console.log(`topics: ${topics.join(', ')} | papers: ${papers} | widget size: ${(bytes / 1024).toFixed(1)} KB`);
