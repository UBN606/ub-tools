// propose.js — suggest candidate Bible↔UB parallel links by distinctive-word overlap.
// Zero dependencies. Builds an inverted index over KJV verse text + UB paragraph
// text (distinctive words only, stopwords dropped), then for each UB paragraph
// (or each Bible verse, with --direction) scores candidates by shared-word
// weight. Output goes ONLY to review-queue.json — never merged automatically.
//
// Usage:
//   node parallel/propose.js [--direction ub2bible|bible2ub] [--min-score N]
//     [--top K] [--out review-queue.json] [--limit N] [--skip-known]
//   --direction  which side to iterate (default ub2bible)
//   --min-score  minimum shared-word score (default 3)
//   --top        keep at most K candidates per query (default 5)
//   --limit      only process the first N queries (for smoke tests)
//   --skip-known skip paragraphs already present in data/links.json (default on)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const has = k => args.includes(k);

const DIRECTION = opt('--direction', 'ub2bible');
const MIN_SCORE = parseFloat(opt('--min-score', '3'));
const TOP = parseInt(opt('--top', '5'), 10);
const LIMIT = parseInt(opt('--limit', '0'), 10);
const OUT = path.resolve(ROOT, opt('--out', 'review-queue.json'));
const SKIP_KNOWN = !has('--no-skip-known');

const STOP = new Set(('a,an,and,are,as,at,be,because,but,by,do,does,did,for,from,had,has,have,he,her,hers,his,him,i,in,into,is,it,its,of,on,or,our,ours,she,so,that,the,their,them,they,this,to,was,we,were,what,when,where,which,who,whom,with,ye,you,your,yours,thou,thy,thee,yea,hath,doth,shall,will,not,no,nor,if,then,there,here,all,also,am,can,could,would,should,may,might,must,been,being,out,up,down,over,under,again,once,two,three,one,very,much,more,most,such,than,these,those,each,every,any,some,say,said,sayeth,speak,spake,spoken,answered,came,come,go,went,gone,see,saw,seen,know,knew,known,make,made,take,took,taken,give,gave,given,put,bring,brought').split(','));

function words(text) {
  const out = new Map();
  for (const w of text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)) {
    if (w.length > 3 && !STOP.has(w)) out.set(w, (out.get(w) || 0) + 1);
  }
  return out;
}

// Rare words count more: score = sum over shared words of 1/log(1+docFreq).
function idfWeight(df, totalDocs) { return 1 / Math.log(1 + df / totalDocs * 1000 + 1); }

function main() {
  const texts = require('./lib/texts.js');
  if (!texts.kjv.available()) { console.error('FAIL: KJV data missing — run parallel/fetch-bible.js first.'); process.exit(1); }
  if (!texts.ub.available()) { console.error('FAIL: UB source-texts missing.'); process.exit(1); }

  const verses = texts.kjv.allVerses();
  const pars = texts.ub.allParagraphs();
  console.log(`Indexing ${verses.length} verses + ${pars.length} UB paragraphs...`);

  const docs = DIRECTION === 'ub2bible'
    ? { queries: pars, targets: verses, qlabel: 'ub', tlabel: 'kjv' }
    : { queries: verses, targets: pars, qlabel: 'kjv', tlabel: 'ub' };

  // Inverted index over targets.
  const index = new Map(); // word -> [targetIdx]
  const targetWords = docs.targets.map(t => words(t.text));
  targetWords.forEach((wm, ti) => {
    for (const w of wm.keys()) {
      if (!index.has(w)) index.set(w, []);
      index.get(w).push(ti);
    }
  });
  const total = docs.targets.length;

  const known = new Set();
  if (SKIP_KNOWN) {
    const lf = path.join(ROOT, 'data', 'links.json');
    if (fs.existsSync(lf)) {
      for (const l of JSON.parse(fs.readFileSync(lf, 'utf8')).links) known.add(`${l.bible_ref}→${l.ub_ref}`);
    }
  }

  const candidates = [];
  const queries = LIMIT > 0 ? docs.queries.slice(0, LIMIT) : docs.queries;
  queries.forEach((q, qi) => {
    const qw = words(q.text);
    const scores = new Map(); // targetIdx -> score
    for (const w of qw.keys()) {
      const postings = index.get(w);
      if (!postings) continue;
      const wgt = idfWeight(postings.length, total);
      for (const ti of postings) scores.set(ti, (scores.get(ti) || 0) + wgt);
    }
    const ranked = [...scores.entries()]
      .filter(([ti, s]) => s >= MIN_SCORE)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP);
    for (const [ti, s] of ranked) {
      const t = docs.targets[ti];
      const pair = DIRECTION === 'ub2bible'
        ? { bible_ref: t.ref, ub_ref: q.ref }
        : { bible_ref: q.ref, ub_ref: t.ref };
      if (SKIP_KNOWN && known.has(`${pair.bible_ref}→${pair.ub_ref}`)) continue;
      candidates.push({
        ...pair, relationship: null,
        score: Math.round(s * 100) / 100,
        status: 'proposed',
        note: `propose.js: shared distinctive words (score ${Math.round(s * 100) / 100}). Curator must verify both texts before accepting.`
      });
    }
    if ((qi + 1) % 1000 === 0) process.stderr.write(`\r  processed ${qi + 1}/${queries.length} queries...`);
  });
  process.stderr.write('\n');

  fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), direction: DIRECTION, candidates }, null, 2));
  console.log(`OK: ${candidates.length} candidates written to ${OUT}`);
  console.log('NOTE: candidates are unverified suggestions. Review both texts, set a relationship, and move accepted links into data/links.json by hand.');
}

main();
