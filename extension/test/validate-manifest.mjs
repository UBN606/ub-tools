/**
 * Validates extension/manifest.json against Manifest V3 requirements and
 * confirms every file the manifest references actually exists.
 *
 * Run:  node extension/test/validate-manifest.mjs   (from the repo root)
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
let bad = 0;
const fail = (m) => { bad++; console.log('FAIL ' + m); };
const ok = (m) => console.log('ok   ' + m);

const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));

if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
else ok('manifest_version is 3');
for (const f of ['name', 'version', 'description']) {
  if (!manifest[f]) fail(`missing required field: ${f}`); else ok(`has ${f}`);
}
if (!manifest.background || !manifest.background.service_worker) fail('background.service_worker required for MV3');
else ok('background.service_worker: ' + manifest.background.service_worker);
if (!manifest.action || !manifest.action.default_popup) fail('action.default_popup required');
else ok('action.default_popup: ' + manifest.action.default_popup);
for (const p of ['contextMenus', 'storage', 'scripting', 'activeTab']) {
  if (!(manifest.permissions || []).includes(p)) fail(`missing permission: ${p}`);
}
ok('permissions include contextMenus, storage, scripting, activeTab');
if (!(manifest.host_permissions || []).some((h) => h.includes('raw.githubusercontent.com'))) {
  fail('host_permissions must allow the Urantiapedia download host');
} else ok('host_permissions allow raw.githubusercontent.com');

const referenced = [
  manifest.background && manifest.background.service_worker,
  manifest.action && manifest.action.default_popup,
].filter(Boolean);
const html = referenced.find((f) => f.endsWith('.html'));
if (html) {
  const src = readFileSync(join(dir, html), 'utf8');
  for (const m of src.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (!m[1].startsWith('http')) referenced.push(m[1]);
  }
}
const bg = readFileSync(join(dir, manifest.background.service_worker), 'utf8');
for (const m of bg.matchAll(/importScripts\(([^)]+)\)/g)) {
  for (const q of m[1].matchAll(/['"]([^'"]+)['"]/g)) referenced.push(q[1]);
}
for (const f of [...new Set(referenced)]) {
  if (!existsSync(join(dir, f))) fail(`referenced file missing: ${f}`);
  else ok(`file exists: ${f}`);
}
// MV2 leftovers that Chrome/Edge reject
const raw = readFileSync(join(dir, 'manifest.json'), 'utf8');
for (const banned of ['"browser_action"', '"page_action"', '"background_page"', '"persistent"']) {
  if (raw.includes(banned)) fail(`MV2 leftover present: ${banned}`);
}
ok('no MV2 leftovers');

console.log(bad ? `\n${bad} manifest check(s) FAILED` : '\nManifest valid');
process.exit(bad ? 1 : 0);
