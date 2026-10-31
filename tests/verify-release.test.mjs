import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { sha256 } from '../scripts/build.mjs';
import { verifyRelease } from '../scripts/verify-release.mjs';

// Controlled HTTP fixture tests the release verifier, not Cloudflare's runtime.
async function fixture(scenario, fn) {
  const manifest = { schema: 1, revision: 'synthetic', source_dirty: false, assets: {
    'check/index.html': sha256('checker'), 'app.mjs': sha256('script'),
    '404.html': sha256('not found'), '_headers': sha256('headers'),
  } };
  const server = createServer((req, res) => {
    res.setHeader('content-security-policy', scenario === 'bad CSP' ? "connect-src *" : "default-src 'self'; connect-src 'none';");
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('x-content-type-options', 'nosniff');
    if (req.url === '/release.json') return res.end(JSON.stringify(scenario === 'old release' ? { ...manifest, revision: 'old' } : manifest));
    if (req.url === '/check/') return res.end('checker');
    if (req.url === '/app.mjs') return res.end(scenario === 'changed bytes' ? 'old script' : 'script');
    if (req.url === '/package.json' && scenario === 'source leak') return res.end('{}');
    res.statusCode = 404; res.end('not found');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await fn(`http://127.0.0.1:${server.address().port}`, manifest); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('release verifier accepts a matching package with restrictive headers and private paths absent', async () => {
  await fixture('correct', (base, manifest) => verifyRelease(base, manifest));
});
for (const scenario of ['old release', 'changed bytes', 'bad CSP', 'source leak']) {
  test(`release verifier rejects ${scenario}`, async () => {
    await fixture(scenario, (base, manifest) => assert.rejects(verifyRelease(base, manifest)));
  });
}
