// node --test app/test/pwa.test.mjs
// The PWA install bits: a valid manifest with icons that exist on disk.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(appDir, 'manifest.webmanifest'), 'utf8'))

test('manifest has the fields browsers require', () => {
  assert.ok(manifest.name && manifest.name.length > 0, 'name')
  assert.ok(manifest.short_name && manifest.short_name.length > 0, 'short_name')
  assert.ok(manifest.start_url, 'start_url')
  assert.equal(manifest.display, 'standalone')
  assert.ok(manifest.theme_color, 'theme_color')
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'icons')
})

test('manifest icons exist on disk at the declared sizes', () => {
  const sizes = new Set()
  for (const icon of manifest.icons) {
    assert.ok(icon.src && icon.sizes && icon.type === 'image/png', `icon entry malformed: ${icon.src}`)
    const disk = join(appDir, icon.src.replace(/^\.\//, ''))
    assert.ok(existsSync(disk), `missing icon file: ${icon.src}`)
    sizes.add(icon.sizes)
  }
  assert.ok(sizes.has('192x192'), 'needs a 192px icon')
  assert.ok(sizes.has('512x512'), 'needs a 512px icon')
})

test('index.html links the manifest', () => {
  const html = readFileSync(join(appDir, 'index.html'), 'utf8')
  assert.ok(html.includes('rel="manifest"'), 'no manifest link in index.html')
  assert.ok(html.includes('apple-touch-icon'), 'no apple touch icon in index.html')
})
