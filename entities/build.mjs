#!/usr/bin/env node
/**
 * entities/build.mjs — regenerate people.json / places.json / groups.json from the
 * curation source (entities/curate/entities.json).
 *
 * For each curated entry it either verifies the pinned `refs` or auto-selects up to
 * 3 key paragraphs: the home paper (most mentions) supplies the first mention plus
 * the two densest paragraphs. A ref is only accepted when the paragraph (or its
 * section title) actually contains one of the entry's match terms — every citation
 * is verified against source-texts/, never taken on trust.
 *
 * Usage: node entities/build.mjs
 * Exit code 0 = clean build, 1 = unresolved entries or pinned-ref failures (see report).
 * Zero npm dependencies.
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PAPERS_DIR = join(ROOT, 'source-texts', 'papers');
const CURATE_FILE = join(HERE, 'curate', 'entities.json');

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const REF_RE = /^\d+:\d+\.\d+$/;
const KINDS = new Set(['person', 'place', 'group']);

// ---------- load corpus ----------
const corpus = []; // {ref, paper, order, section, text, ltext}
{
  const files = readdirSync(PAPERS_DIR).filter(f => /^Doc\d{3}\.json$/.test(f)).sort();
  let order = 0;
  for (const f of files) {
    const paperNo = parseInt(f.slice(3, 6), 10);
    const doc = JSON.parse(readFileSync(join(PAPERS_DIR, f), 'utf8'));
    for (const s of doc.sections) {
      for (const p of s.pars) {
        const text = strip(p.par_content);
        corpus.push({ ref: p.par_ref, paper: paperNo, order: order++, section: s.section_title || '', text, ltext: text.toLowerCase() });
      }
    }
  }
}
const byRef = new Map(corpus.map(p => [p.ref, p]));

// ---------- load curation ----------
const curated = JSON.parse(readFileSync(CURATE_FILE, 'utf8'));
const errors = [];
const unresolved = [];
const pinnedFailures = [];
const autoSelected = [];
const thin = [];

function checkEntry(e, i) {
  const where = `curate/entities.json[${i}] (${e.name || '?'})`;
  if (typeof e.name !== 'string' || !e.name.trim()) errors.push(`${where}: missing name`);
  if (!KINDS.has(e.kind)) errors.push(`${where}: kind must be person|place|group, got ${JSON.stringify(e.kind)}`);
  if (typeof e.note !== 'string' || !e.note.trim()) errors.push(`${where}: missing note`);
  else if (e.note.includes('"')) errors.push(`${where}: note must not contain double quotes (describe; don't quote)`);
  if (e.refs !== undefined && (!Array.isArray(e.refs) || e.refs.some(r => typeof r !== 'string' || !REF_RE.test(r))))
    errors.push(`${where}: refs must be an array of Paper:Section.Paragraph strings`);
  const terms = e.match || [e.name];
  if (!Array.isArray(terms) || !terms.length || terms.some(t => typeof t !== 'string' || !t.trim()))
    errors.push(`${where}: match must be a non-empty array of strings`);
}

function termRegex(terms) {
  return new RegExp(`\\b(?:${terms.map(esc).join('|')})\\b`, 'i');
}

function buildEntry(e) {
  const terms = e.match || [e.name];
  const re = termRegex(terms);
  const matches = p => re.test(p.text) || re.test(p.section);
  let refs;
  if (e.refs && e.refs.length) {
    refs = [];
    for (const r of e.refs) {
      const p = byRef.get(r);
      if (!p) { pinnedFailures.push(`${e.name}: pinned ref ${r} does not exist`); continue; }
      if (!matches(p)) { pinnedFailures.push(`${e.name}: pinned ref ${r} contains none of the match terms`); continue; }
      refs.push(r);
    }
    if (!refs.length) { unresolved.push(e.name); return null; }
  } else {
    const hits = corpus.filter(matches);
    if (!hits.length) { unresolved.push(e.name); return null; }
    const byPaper = new Map();
    for (const h of hits) byPaper.set(h.paper, (byPaper.get(h.paper) || 0) + 1);
    const home = [...byPaper.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    const inHome = hits.filter(h => h.paper === home).sort((a, b) => a.order - b.order);
    const density = h => (h.ltext.match(new RegExp(`\\b(?:${terms.map(esc).join('|')})\\b`, 'gi')) || []).length;
    const rest = inHome.slice(1).sort((a, b) => density(b) - density(a) || a.order - b.order).slice(0, 2);
    refs = [inHome[0], ...rest].sort((a, b) => a.order - b.order).map(h => h.ref);
    autoSelected.push(`${e.name} -> ${refs.join(', ')} (paper ${home})`);
  }
  if (refs.length < 2) thin.push(`${e.name}: only ${refs.length} ref`);
  const out = { name: e.name, kind: e.kind, refs, note: e.note };
  if (e.aliases) out.aliases = e.aliases;
  return out;
}

curated.forEach(checkEntry);
if (errors.length) {
  console.error('CURATION ERRORS:');
  errors.forEach(x => console.error('  - ' + x));
  process.exit(1);
}

const seen = new Map();
const built = [];
for (const e of curated) {
  const key = e.name.toLowerCase();
  if (seen.has(key)) { errors.push(`duplicate name (case-insensitive): ${e.name}`); continue; }
  seen.set(key, true);
  const b = buildEntry(e);
  if (b) built.push(b);
}
if (errors.length) {
  console.error('BUILD ERRORS:');
  errors.forEach(x => console.error('  - ' + x));
  process.exit(1);
}

const byKind = k => built.filter(e => e.kind === k).sort((a, b) => a.name.localeCompare(b.name));
const people = byKind('person'), places = byKind('place'), groups = byKind('group');
const dump = arr => JSON.stringify(arr, null, 2) + '\n';
writeFileSync(join(HERE, 'people.json'), dump(people));
writeFileSync(join(HERE, 'places.json'), dump(places));
writeFileSync(join(HERE, 'groups.json'), dump(groups));

const papersCovered = [...new Set(built.flatMap(e => e.refs.map(r => parseInt(r.split(':')[0], 10))))].sort((a, b) => a - b);
const coverage = {
  generated: new Date().toISOString(),
  entries: built.length,
  people: people.length,
  places: places.length,
  groups: groups.length,
  totalRefs: built.reduce((n, e) => n + e.refs.length, 0),
  papersCovered,
  paperCount: papersCovered.length,
  unresolved,
  pinnedFailures,
  thinRefs: thin,
};
writeFileSync(join(HERE, 'coverage.json'), JSON.stringify(coverage, null, 2) + '\n');

// ---------- report ----------
console.log(`entries: ${built.length} (people ${people.length}, places ${places.length}, groups ${groups.length})`);
console.log(`refs: ${coverage.totalRefs} across ${papersCovered.length} papers`);
if (unresolved.length) { console.log(`\nUNRESOLVED (${unresolved.length}):`); unresolved.forEach(x => console.log('  - ' + x)); }
if (pinnedFailures.length) { console.log(`\nPINNED-REF FAILURES (${pinnedFailures.length}):`); pinnedFailures.forEach(x => console.log('  - ' + x)); }
if (thin.length) { console.log(`\nTHIN (<2 refs, ${thin.length}):`); thin.forEach(x => console.log('  - ' + x)); }
if (unresolved.length || pinnedFailures.length) { console.log('\nBUILD FAILED: fix curation and re-run'); process.exit(1); }
console.log('\nBUILD OK: people.json, places.json, groups.json, coverage.json written');
