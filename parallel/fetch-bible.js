#!/usr/bin/env node
/**
 * Downloads the King James Bible text these tools need, then normalizes it to
 * verse-level JSON. Run once before first use:
 *
 *   node fetch-bible.js
 *
 * Source: thiagobodruk/bible (https://github.com/thiagobodruk/bible),
 * json/en_kjv.json. The KJV text is public domain. This repository does not
 * redistribute that content; each user downloads it directly, and the
 * normalized file is git-ignored (see parallel/.gitignore).
 * Output: parallel/data/kjv.json
 *   { books: [ { name, chapters: [ [verse, ...], ... ] } ] }   // 66 books, KJV order
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json';
const OUT = path.join(__dirname, 'data', 'kjv.json');

// Canonical KJV order. The source file's book names are Portuguese, so we map
// by position instead of trusting the name field.
const BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah',
  'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians',
  '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians',
  '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
  'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation',
];

function get(url, tries = 3) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ub-tools-fetch' } }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        return tries > 1
          ? setTimeout(() => get(url, tries - 1).then(resolve, reject), 1000)
          : reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', e => (tries > 1 ? setTimeout(() => get(url, tries - 1).then(resolve, reject), 1000) : reject(e)));
  });
}

const squash = s => s.replace(/\s+/g, ' ').trim();

(async () => {
  console.log('Downloading KJV text...');
  const raw = JSON.parse((await get(URL)).toString('utf8'));
  if (!Array.isArray(raw) || raw.length !== 66) {
    throw new Error(`expected 66 books, got ${Array.isArray(raw) ? raw.length : typeof raw}`);
  }
  const books = raw.map((b, i) => {
    if (!Array.isArray(b.chapters) || !b.chapters.length) throw new Error(`book ${i} has no chapters`);
    return { name: BOOKS[i], chapters: b.chapters.map(ch => ch.map(squash)) };
  });
  const verses = books.reduce((n, b) => n + b.chapters.reduce((m, c) => m + c.length, 0), 0);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ books }));
  console.log(`Wrote ${OUT}: ${books.length} books, ${verses} verses`);
  if (verses < 31000 || verses > 31300) console.warn(`WARNING: unexpected verse count ${verses} (KJV has 31,102)`);
})().catch(e => { console.error(`FAILED: ${e.message}`); process.exit(1); });
