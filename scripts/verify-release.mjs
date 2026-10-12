import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { sha256 } from './build.mjs';

export function assetRoute(path) { return '/' + path.replace(/(^|\/)index\.html$/, '$1'); }
export async function verifyRelease(base, manifest) {
  const url = new URL(base);
  assert.ok(url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)), 'Use HTTPS or a loopback development server');
  const get = path => fetch(new URL(path, url), { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) });
  const deployed = await get('/release.json');
  assert.equal(deployed.status, 200, 'release manifest is missing');
  assert.deepEqual(await deployed.json(), manifest, 'deployed release differs from the local candidate');
  for (const [name, hash] of Object.entries(manifest.assets)) {
    if (name === '_headers') continue;
    const res = await get(name === '404.html' ? '/not-a-public-route' : assetRoute(name));
    assert.equal(res.status, name === '404.html' ? 404 : 200, `${name}: unexpected status`);
    assert.equal(sha256(Buffer.from(await res.arrayBuffer())), hash, `${name}: deployed bytes differ`);
  }
  const checker = await get('/check/');
  assert.match(checker.headers.get('content-security-policy') || '', /(?:^|;)\s*connect-src 'none'(?:;|$)/);
  assert.equal(checker.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(checker.headers.get('referrer-policy'), 'no-referrer');
  for (const path of ['/not-a-public-route', '/.env', '/.git/config', '/wrangler.json', '/package.json', '/tests/app.test.mjs', '/docs/CLOUDFLARE_DEPLOYMENT.md']) {
    assert.equal((await get(path)).status, 404, `${path} must not be publicly served`);
  }
  console.log(`Verified deployed asset bytes, security headers, and private-path 404s for ${manifest.revision}. Browser and phone checks are separate.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(await readFile(new URL('../dist/release.json', import.meta.url), 'utf8'));
  await verifyRelease(process.argv[2] || 'https://synapse-guard-v1.synapse-guard.workers.dev', manifest);
}
