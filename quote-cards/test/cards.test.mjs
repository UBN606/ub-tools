import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const cards = JSON.parse(fs.readFileSync(path.join(dir, '..', 'cards.json'), 'utf8'));
const CITE = /^\d{1,3}:\d{1,2}\.\d{1,2}$/;

describe('cards.json schema', () => {
  it('is a non-empty array of 24-64 cards', () => {
    assert.ok(Array.isArray(cards), 'cards.json must be an array');
    assert.ok(cards.length >= 24 && cards.length <= 64,
      `expected 24-64 cards, got ${cards.length}`);
  });

  it('every card has the required shape', () => {
    cards.forEach((c, k) => {
      assert.equal(typeof c.topic, 'string', `card ${k}: topic`);
      assert.ok(c.topic.trim().length > 0, `card ${k}: topic empty`);
      assert.equal(typeof c.quote, 'string', `card ${k}: quote`);
      assert.ok(c.quote.trim().length >= 10, `card ${k}: quote too short`);
      assert.ok(c.quote.length <= 600, `card ${k}: quote too long for a card`);
      assert.equal(typeof c.citation, 'string', `card ${k}: citation`);
      assert.match(c.citation, CITE, `card ${k}: citation format`);
      assert.equal(c.verified, true, `card ${k}: verified must be true (run verify-cards.mjs)`);
    });
  });

  it('covers at least 8 distinct topics', () => {
    const topics = new Set(cards.map(c => c.topic));
    assert.ok(topics.size >= 8, `expected >= 8 topics, got ${topics.size}`);
  });

  it('has no duplicate cards', () => {
    const seen = new Set();
    cards.forEach((c, k) => {
      const key = c.citation + '|' + c.quote;
      assert.ok(!seen.has(key), `card ${k}: duplicate of an earlier card`);
      seen.add(key);
    });
  });
});
