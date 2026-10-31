import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('phone controls and links keep a 44px minimum target without changing desktop rules', async () => {
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  const phoneRules = css.match(/@media\s*\(max-width:\s*520px\)\s*\{([\s\S]*?)\}\s*(?=@media|$)/)?.[1];
  assert.ok(phoneRules, 'missing phone-only target-size rules');
  assert.match(phoneRules, /#load-sample,\s*details > summary,\s*\.sources a,\s*footer a\s*\{[^}]*min-height:\s*44px/);
  assert.match(phoneRules, /\.sources a,\s*footer a\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center/);
});
