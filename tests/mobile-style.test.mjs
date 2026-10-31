import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('checker skip link targets main content and exposes a 44px focused target', async () => {
  const [html, css] = await Promise.all([
    readFile(new URL('../check/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
  ]);
  const skip = html.match(/<body>\s*<a class="skip" href="#([^"]+)">Skip to content<\/a>/);
  assert.ok(skip, 'checker should start with a skip-to-content link');
  assert.match(html, new RegExp(`<main id="${skip[1]}">`), 'skip link target should exist on the main element');

  const skipRules = css.match(/\.skip\s*\{([^}]*)\}/)?.[1];
  assert.ok(skipRules, 'missing checker skip-link styles');
  assert.match(skipRules, /display:\s*inline-flex/);
  assert.match(skipRules, /align-items:\s*center/);
  assert.match(skipRules, /min-height:\s*44px/);
  assert.match(css, /\.skip:focus\s*\{[^}]*top:\s*12px/);
  assert.match(css, /\.skip:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--signal\)/);
});

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

test('phone typography keeps substantive and helper copy readable while metadata stays compact', async () => {
  const [siteCss, checkerCss] = await Promise.all([
    readFile(new URL('../site.css', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
  ]);
  const sitePhoneRules = siteCss.match(/@media\s*\(max-width:\s*520px\)\s*\{([\s\S]*?)\}\s*$/)?.[1];
  const checkerPhoneRules = checkerCss.match(/@media\s*\(max-width:\s*520px\)\s*\{([\s\S]*?)\}\s*(?=@media|$)/)?.[1];
  assert.ok(sitePhoneRules, 'missing site phone-only typography rules');
  assert.ok(checkerPhoneRules, 'missing checker phone-only typography rules');
  assert.match(sitePhoneRules, /\.preview-result>p\{font-size:1rem\}/);
  assert.match(sitePhoneRules, /\.fine\{font-size:\.875rem\}/);
  assert.match(checkerPhoneRules, /\.help\s*\{[^}]*font-size:\s*\.875rem/);
  assert.match(siteCss, /\.eyebrow\{font-size:\.77rem/);
});
