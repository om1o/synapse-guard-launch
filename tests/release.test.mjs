import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, PUBLIC_FILES, sha256 } from '../scripts/build.mjs';

test('release package contains only the allowlisted static site and matching asset hashes', async () => {
  const manifest = await build();
  const files = (await readdir(new URL('../dist/', import.meta.url), { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile()).map(entry => relative(fileURLToPath(new URL('../dist/', import.meta.url)), join(entry.parentPath, entry.name))).sort();
  assert.deepEqual(files, [...PUBLIC_FILES, 'release.json'].sort());
  for (const [path, expected] of Object.entries(manifest.assets)) {
    assert.equal(sha256(await readFile(new URL(`../dist/${path}`, import.meta.url))), expected);
  }
  assert.match(await readFile(new URL('../dist/_headers', import.meta.url), 'utf8'), /connect-src 'none'/);
});

test('Cloudflare target has no private integration code, bindings, or routes', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(config).sort(), ['$schema', 'assets', 'compatibility_date', 'name', 'preview_urls', 'workers_dev']);
  assert.equal(config.name, 'synapse-guard-v1');
  assert.equal(config.assets.directory, './dist');
  assert.equal(config.assets.not_found_handling, '404-page');
  assert.equal(config.preview_urls, false);
});
