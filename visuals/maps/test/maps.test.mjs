// Tests for visuals/maps/index.html — run: node --test visuals/maps/test/  (from repo root)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const HTML = readFileSync(join(ROOT, "visuals", "maps", "index.html"), "utf8");

function extractDataset() {
  const m = HTML.match(
    /<script id="places-data" type="application\/json">([\s\S]*?)<\/script>/
  );
  assert.ok(m, "embedded dataset <script id=\"places-data\"> not found");
  return JSON.parse(m[1]);
}

const DATA = extractDataset();
const REF_RE = /^\d+:\d+\.\d+$/;
const ID_RE = /^[a-z0-9-]+$/;

// Sane Levant bounding box (covers Palestine + Damascus + Mt Hermon)
const LAT_MIN = 30.0, LAT_MAX = 34.5, LON_MIN = 33.5, LON_MAX = 37.0;

const parCache = new Map();
function paperHasRef(ref) {
  const paper = ref.split(":")[0].padStart(3, "0");
  if (!parCache.has(paper)) {
    const p = join(ROOT, "source-texts", "papers", `Doc${paper}.json`);
    parCache.set(paper, JSON.parse(readFileSync(p, "utf8")));
  }
  const doc = parCache.get(paper);
  for (const s of doc.sections)
    for (const par of s.pars) if (par.par_ref === ref) return true;
  return false;
}

test("dataset extracts and is a non-empty array", () => {
  assert.ok(Array.isArray(DATA), "dataset is not an array");
  assert.ok(DATA.length >= 20, `expected >=20 places, got ${DATA.length}`);
});

test("schema: every place has id, name, lat, lon, refs[], note", () => {
  for (const p of DATA) {
    assert.ok(typeof p.id === "string" && ID_RE.test(p.id), `bad id: ${JSON.stringify(p.id)}`);
    assert.ok(typeof p.name === "string" && p.name.length > 0, `${p.id}: bad name`);
    assert.ok(typeof p.lat === "number" && Number.isFinite(p.lat), `${p.id}: bad lat`);
    assert.ok(typeof p.lon === "number" && Number.isFinite(p.lon), `${p.id}: bad lon`);
    assert.ok(Array.isArray(p.refs) && p.refs.length > 0, `${p.id}: refs must be a non-empty array`);
    assert.ok(typeof p.note === "string" && p.note.trim().length > 0, `${p.id}: bad note`);
  }
});

test("no duplicate ids", () => {
  const ids = DATA.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate ids found");
});

test("lat/lon within sane Levant bounding box", () => {
  for (const p of DATA) {
    assert.ok(p.lat >= LAT_MIN && p.lat <= LAT_MAX,
      `${p.id}: lat ${p.lat} outside [${LAT_MIN}, ${LAT_MAX}]`);
    assert.ok(p.lon >= LON_MIN && p.lon <= LON_MAX,
      `${p.id}: lon ${p.lon} outside [${LON_MIN}, ${LON_MAX}]`);
  }
});

test("refs match citation format and resolve to real paragraphs", () => {
  let checked = 0;
  for (const p of DATA) {
    for (const ref of p.refs) {
      assert.ok(REF_RE.test(ref), `${p.id}: ref ${ref} fails /^\\d+:\\d+\\.\\d+$/`);
      assert.ok(paperHasRef(ref), `${p.id}: ref ${ref} has no matching par_ref in source-texts`);
      checked++;
    }
  }
  assert.ok(checked > 0, "no refs checked");
});

test("SVG dots <-> dataset ids match exactly", () => {
  const dotIds = [...HTML.matchAll(/<g class="dot[^"]*" data-id="([a-z0-9-]+)"/g)].map(m => m[1]);
  assert.ok(dotIds.length > 0, "no plotted SVG dots found");
  const dataIds = DATA.map(p => p.id);
  const dotSet = new Set(dotIds);
  assert.equal(dotSet.size, dotIds.length, "duplicate dot ids in SVG");
  for (const id of dataIds)
    assert.ok(dotSet.has(id), `dataset entry ${id} has no matching SVG dot`);
  const dataSet = new Set(dataIds);
  for (const id of dotIds)
    assert.ok(dataSet.has(id), `SVG dot ${id} has no matching dataset entry`);
});

test("no external references outside visuals/maps", () => {
  // data: URIs and the SVG xmlns namespace identifier are not network references
  const scrubbed = HTML
    .replace(/"data:[^"]*"/g, '""')
    .replace(/xmlns='[^']*'/g, "xmlns=''");
  const banned = [
    [/https?:\/\//, "http(s):// URL"],
    [/\.\.\//, "../ path"],
  ];
  for (const [re, label] of banned)
    assert.ok(!re.test(scrubbed), `index.html contains external reference: ${label}`);
  // Only script/link tags allowed are inline or data: URIs
  for (const m of HTML.matchAll(/<(script|link|img|source|video|audio)[^>]*>/gi)) {
    const tag = m[0];
    if (/\b(src|href)=/i.test(tag))
      assert.ok(/(src|href)="data:/i.test(tag), `external asset in tag: ${tag.slice(0, 80)}`);
  }
});

test("places listed as off-map/omitted are not plotted", () => {
  const dotIds = new Set([...HTML.matchAll(/data-id="([a-z0-9-]+)"/g)].map(m => m[1]));
  for (const id of ["alexandria", "rome", "eden", "edentia"]) {
    assert.ok(!dotIds.has(id), `${id} should not be plotted`);
  }
});
