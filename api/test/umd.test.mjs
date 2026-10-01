/**
 * UMD parity test: rebuilds api/ub-api.js from the ESM source, then asserts the
 * UMD build exposes exactly the same exports (for <script> and require() users).
 *   node --test api/test/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esm from '../ub-api.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

test('UMD build exposes the same exports as the ESM source', () => {
  execFileSync(process.execPath, [join(dir, '..', 'build.mjs')], { stdio: 'pipe' });
  delete require.cache[require.resolve('../ub-api.js')];
  const umd = require('../ub-api.js');
  const esmKeys = Object.keys(esm).sort();
  const umdKeys = Object.keys(umd).sort();
  assert.deepEqual(umdKeys, esmKeys, `UMD keys differ: esm=[${esmKeys}] umd=[${umdKeys}]`);
  for (const k of ['createClient', 'getParagraph', 'search', 'verifyQuote']) {
    assert.equal(typeof umd[k], typeof esm[k], `typeof ${k} differs`);
  }
  // The UMD factory path works without a DOM.
  const c = umd.createClient({ persist: false, fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(typeof c.getParagraph, 'function');
});
