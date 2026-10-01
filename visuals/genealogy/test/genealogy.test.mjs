// Tests for visuals/genealogy/index.html — run: node --test visuals/genealogy/test/  (from repo root)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const HTML = readFileSync(join(ROOT, "visuals", "genealogy", "index.html"), "utf8");

function extractDataset() {
  const m = HTML.match(
    /<script id="genealogy-data" type="application\/json">([\s\S]*?)<\/script>/
  );
  assert.ok(m, 'embedded dataset <script id="genealogy-data"> not found');
  return JSON.parse(m[1]);
}

const DATA = extractDataset();
const REF_RE = /^\d+:\d+\.\d+$/;
const ID_RE = /^[a-z0-9-]+$/;
const KIND_RE = /^(parent|spouse|adoptive)$/;

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

test("dataset extracts with trees, persons, edges", () => {
  assert.ok(Array.isArray(DATA.trees) && DATA.trees.length >= 2, "need >=2 trees");
  assert.ok(Array.isArray(DATA.persons) && DATA.persons.length >= 10, "need >=10 persons");
  assert.ok(Array.isArray(DATA.edges) && DATA.edges.length >= 5, "need >=5 edges");
});

test("schema: every person has id, name, tree, refs[], rel, quote", () => {
  const treeIds = new Set(DATA.trees.map((t) => t.id));
  for (const p of DATA.persons) {
    assert.ok(typeof p.id === "string" && ID_RE.test(p.id), `bad id: ${JSON.stringify(p.id)}`);
    assert.ok(typeof p.name === "string" && p.name.trim().length > 0, `${p.id}: bad name`);
    assert.ok(treeIds.has(p.tree), `${p.id}: unknown tree ${JSON.stringify(p.tree)}`);
    assert.ok(Array.isArray(p.refs) && p.refs.length > 0, `${p.id}: refs must be a non-empty array`);
    for (const r of p.refs) assert.ok(REF_RE.test(r), `${p.id}: bad ref format ${JSON.stringify(r)}`);
    assert.ok(typeof p.rel === "string" && p.rel.trim().length > 0, `${p.id}: bad rel`);
    assert.ok(typeof p.quote === "string" && p.quote.trim().length > 0, `${p.id}: bad quote`);
  }
});

test("schema: every edge has from/to/kind", () => {
  for (const e of DATA.edges) {
    assert.ok(typeof e.from === "string" && e.from.length > 0, `edge missing from: ${JSON.stringify(e)}`);
    assert.ok(typeof e.to === "string" && e.to.length > 0, `edge missing to: ${JSON.stringify(e)}`);
    assert.ok(KIND_RE.test(e.kind || "parent"), `edge bad kind: ${JSON.stringify(e)}`);
  }
});

test("no duplicate person ids", () => {
  const ids = DATA.persons.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate person ids found");
});

test("no duplicate tree ids", () => {
  const ids = DATA.trees.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate tree ids found");
});

test("every edge endpoint references an existing person (no orphans)", () => {
  const ids = new Set(DATA.persons.map((p) => p.id));
  for (const e of DATA.edges) {
    assert.ok(ids.has(e.from), `edge from unknown person: ${e.from}`);
    assert.ok(ids.has(e.to), `edge to unknown person: ${e.to}`);
  }
});

test("every ref resolves to a real par_ref in source-texts", () => {
  for (const p of DATA.persons) {
    for (const r of p.refs) {
      assert.ok(paperHasRef(r), `${p.id}: ref ${r} not found in source-texts/papers/Doc*.json`);
    }
  }
});

test("no cycles in parent/adoptive edges", () => {
  const adj = new Map();
  for (const e of DATA.edges) {
    if (e.kind === "spouse") continue;
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from).push(e.to);
  }
  const state = new Map(); // 0=unvisited 1=in-stack 2=done
  function visit(id, path) {
    const s = state.get(id) || 0;
    if (s === 1) assert.fail(`cycle detected: ${[...path, id].join(" -> ")}`);
    if (s === 2) return;
    state.set(id, 1);
    for (const n of adj.get(id) || []) visit(n, [...path, id]);
    state.set(id, 2);
  }
  for (const id of adj.keys()) visit(id, []);
});

test("no external URLs or parent-directory references in index.html", () => {
  assert.ok(!HTML.includes("http://"), "index.html contains http://");
  assert.ok(!HTML.includes("https://"), "index.html contains https://");
  assert.ok(!HTML.includes("../"), "index.html contains ../");
});

test("each tree has at least one rendered person and one parent edge", () => {
  for (const t of DATA.trees) {
    const ps = DATA.persons.filter((p) => p.tree === t.id);
    assert.ok(ps.length >= 3, `tree ${t.id}: expected >=3 persons, got ${ps.length}`);
    const ids = new Set(ps.map((p) => p.id));
    const pe = DATA.edges.filter(
      (e) => (e.kind === "parent" || !e.kind) && ids.has(e.from) && ids.has(e.to)
    );
    assert.ok(pe.length >= 1, `tree ${t.id}: no parent edges`);
  }
});
