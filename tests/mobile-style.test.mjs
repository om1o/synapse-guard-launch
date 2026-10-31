import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('checker phone controls and links keep a 44px minimum target without changing desktop rules', async () => {
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  const phoneRules = css.match(/@media\s*\(max-width:\s*520px\)\s*\{([\s\S]*?)\}\s*(?=@media|$)/)?.[1];
  assert.ok(phoneRules, 'missing phone-only target-size rules');
  assert.match(phoneRules, /\.brand,\s*#load-sample,\s*details > summary,\s*\.help a,\s*\.sources a,\s*footer a\s*\{[^}]*min-height:\s*44px/);
  assert.match(phoneRules, /\.brand,\s*\.help a,\s*\.sources a,\s*footer a\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center/);
});

test('site phone navigation, text, article, and footer links keep a 44px minimum target', async () => {
  const css = await readFile(new URL('../site.css', import.meta.url), 'utf8');
  const phoneRules = css.match(/@media\s*\(max-width:\s*520px\)\s*\{([\s\S]*?)\}\s*$/)?.[1];
  assert.ok(phoneRules, 'missing site phone-only target-size rules');
  assert.match(phoneRules, /\.brand,\.nav-links a,\.text-link,\.article a:not\(\.primary\),footer a\{[^}]*display:inline-flex;[^}]*align-items:center;[^}]*min-height:44px/);
  assert.match(css, /\.primary\{[^}]*min-height:49px/);
});
