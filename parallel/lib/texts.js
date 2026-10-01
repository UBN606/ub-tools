#!/usr/bin/env node
/**
 * Shared text access for UB Parallel: reads The Urantia Book paragraphs from
 * the repo's source-texts/ (downloaded by fetch-data.js) and KJV verses from
 * parallel/data/kjv.json (downloaded by parallel/fetch-bible.js).
 *
 *   const { ub, kjv } = require('./texts');
 *   ub.get('180:2.1')          -> { ref, text, paperTitle, sectionTitle, page } | null
 *   kjv.get('John 15:5')       -> { ref, text, book, chapter, verse } | null
 *   kjv.getRange('John 15:1-5') -> [ ...verses ]
 *   ub.getRange('180:2.1-3')   -> [ ...paragraphs ]
 */
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const PAPERS_DIR = path.join(REPO, 'source-texts', 'papers');
const KJV_FILE = path.join(__dirname, '..', 'data', 'kjv.json');

const stripMarkup = s => s
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
  .replace(/[*_]{1,3}/g, ' ')
  .replace(/\s+/g, ' ').trim();

// ---------------- Urantia Book ----------------
const paperCache = new Map();
function loadPaper(n) {
  if (!paperCache.has(n)) {
    const file = path.join(PAPERS_DIR, `Doc${String(n).padStart(3, '0')}.json`);
    const map = new Map();
    let title = '', sections = new Map();
    if (fs.existsSync(file)) {
      const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
      title = doc.paper_title || '';
      for (const s of doc.sections || []) {
        for (const p of s.pars || []) {
          map.set(p.par_ref, {
            ref: p.par_ref,
            text: stripMarkup(p.par_content || '').replace(/\*/g, ''),
            paperTitle: title,
            sectionTitle: (s.section_title || '').replace(/^\d+\.\s*/, ''),
            sectionRef: s.section_ref || '',
            page: p.par_pageref || '',
          });
        }
      }
    }
    paperCache.set(n, map);
  }
  return paperCache.get(n);
}

const UB_REF = /^(\d{1,3}):(\d{1,2})\.(\d{1,3})$/;
function ubGet(ref) {
  const m = String(ref).trim().match(UB_REF);
  if (!m) return null;
  return loadPaper(parseInt(m[1], 10)).get(`${m[1]}:${m[2]}.${m[3]}`) || null;
}

function ubGetRange(ref) {
  const m = String(ref).trim().match(/^(\d{1,3}):(\d{1,2})\.(\d{1,3})(?:\s*(?:-|–|—|through|to)\s*(\d{1,3}))?$/);
  if (!m) return [];
  const [, p, s, a, b] = m;
  const out = [];
  const lo = parseInt(a, 10), hi = b ? parseInt(b, 10) : lo;
  if (hi < lo || hi - lo > 40) return ubGet(ref) ? [ubGet(ref)] : [];
  for (let i = lo; i <= hi; i++) {
    const par = ubGet(`${p}:${s}.${i}`);
    if (par) out.push(par);
  }
  return out;
}

function ubAvailable() {
  return fs.existsSync(path.join(PAPERS_DIR, 'Doc180.json'));
}

// ---------------- KJV ----------------
let kjvData = null;
function loadKJV() {
  if (!kjvData && fs.existsSync(KJV_FILE)) kjvData = JSON.parse(fs.readFileSync(KJV_FILE, 'utf8'));
  return kjvData;
}
function kjvAvailable() { return fs.existsSync(KJV_FILE); }

const BOOK_ALIASES = {};
function bookIndex(name) {
  const norm = name.toLowerCase().replace(/[.]/g, '').replace(/\s+/g, ' ').trim();
  if (BOOK_ALIASES[norm] !== undefined) return BOOK_ALIASES[norm];
  const data = loadKJV();
  if (!data) return -1;
  const i = data.books.findIndex(b => b.name.toLowerCase() === norm);
  BOOK_ALIASES[norm] = i;
  return i;
}
// common abbreviations
for (const [ab, full] of [
  ['gen', 'Genesis'], ['ex', 'Exodus'], ['lev', 'Leviticus'], ['num', 'Numbers'], ['deut', 'Deuteronomy'],
  ['josh', 'Joshua'], ['judg', 'Judges'], ['1 sam', '1 Samuel'], ['2 sam', '2 Samuel'],
  ['1 kgs', '1 Kings'], ['2 kgs', '2 Kings'], ['1 chr', '1 Chronicles'], ['2 chr', '2 Chronicles'],
  ['neh', 'Nehemiah'], ['esth', 'Esther'], ['ps', 'Psalms'], ['psa', 'Psalms'], ['prov', 'Proverbs'],
  ['eccl', 'Ecclesiastes'], ['song', 'Song of Solomon'], ['isa', 'Isaiah'], ['jer', 'Jeremiah'],
  ['lam', 'Lamentations'], ['ezek', 'Ezekiel'], ['dan', 'Daniel'], ['hos', 'Hosea'], ['mic', 'Micah'],
  ['zech', 'Zechariah'], ['mal', 'Malachi'], ['matt', 'Matthew'], ['mt', 'Matthew'], ['mk', 'Mark'],
  ['lk', 'Luke'], ['jn', 'John'], ['rom', 'Romans'], ['1 cor', '1 Corinthians'], ['2 cor', '2 Corinthians'],
  ['gal', 'Galatians'], ['eph', 'Ephesians'], ['phil', 'Philippians'], ['col', 'Colossians'],
  ['1 thess', '1 Thessalonians'], ['2 thess', '2 Thessalonians'], ['1 tim', '1 Timothy'],
  ['2 tim', '2 Timothy'], ['heb', 'Hebrews'], ['jas', 'James'], ['1 pet', '1 Peter'],
  ['2 pet', '2 Peter'], ['1 jn', '1 John'], ['2 jn', '2 John'], ['3 jn', '3 John'], ['rev', 'Revelation'],
]) BOOK_ALIASES[ab] = -2, BOOK_ALIASES['__' + ab] = full;

const BIBLE_REF = /^(.+?)\s+(\d{1,3}):(\d{1,3})(?:\s*(?:-|–|—)\s*(\d{1,3}))?$/;
function kjvGet(ref) {
  const arr = kjvGetRange(ref);
  return arr.length ? arr[0] : null;
}
function kjvGetRange(ref) {
  const m = String(ref).trim().match(BIBLE_REF);
  if (!m) return [];
  let [, bookName, ch, v1, v2] = m;
  let bi = bookIndex(bookName);
  if (bi === -2) bi = bookIndex(BOOK_ALIASES['__' + bookName.toLowerCase().replace(/[.]/g, '').trim()] || '');
  const data = loadKJV();
  if (!data || bi < 0 || bi >= data.books.length) return [];
  const book = data.books[bi];
  const ci = parseInt(ch, 10) - 1;
  if (ci < 0 || ci >= book.chapters.length) return [];
  const chapter = book.chapters[ci];
  const lo = parseInt(v1, 10), hi = v2 ? parseInt(v2, 10) : lo;
  const out = [];
  for (let v = lo; v <= hi && v <= chapter.length; v++) {
    out.push({ ref: `${book.name} ${ch}:${v}`, text: chapter[v - 1], book: book.name, chapter: parseInt(ch, 10), verse: v });
  }
  return out;
}

function kjvBookList() { return (loadKJV() || { books: [] }).books; }
function kjvAllVerses() {
  const out = [];
  for (const book of kjvBookList()) {
    book.chapters.forEach((ch, ci) => {
      ch.forEach((verse, vi) => out.push({ ref: `${book.name} ${ci + 1}:${vi + 1}`, text: verse }));
    });
  }
  return out;
}
function ubAllParagraphs() {
  const out = [];
  if (!ubAvailable()) return out;
  const files = fs.readdirSync(PAPERS_DIR).filter(f => /^Doc\d+\.json$/.test(f)).sort();
  for (const f of files) {
    const map = loadPaper(parseInt(f.slice(3, 6), 10));
    for (const par of map.values()) out.push({ ref: par.ref, text: par.text });
  }
  return out;
}
module.exports = {
  ub: { get: ubGet, getRange: ubGetRange, available: ubAvailable, allParagraphs: ubAllParagraphs },
  kjv: { get: kjvGet, getRange: kjvGetRange, available: kjvAvailable, books: () => kjvBookList().map(b => b.name), allVerses: kjvAllVerses },
};
