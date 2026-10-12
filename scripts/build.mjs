import { copyFile, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
// Explicit files only: never publish the repository root, tests, docs or secrets.
export const PUBLIC_FILES = Object.freeze([
  'index.html', '404.html', 'check/index.html', 'community/index.html',
  'how-it-works/index.html', 'launch/index.html', 'privacy/index.html',
  'app.mjs', 'v1-engine.mjs', 'style.css', 'site.css', 'logo.png',
  'favicon.png', 'social-card.png', 'robots.txt', 'sitemap.xml', '_headers',
]);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function build() {
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: ROOT, encoding: 'utf8' }).trim());
  const out = resolve(ROOT, 'dist');
  await rm(out, { recursive: true, force: true });
  const assets = {};
  for (const name of PUBLIC_FILES) {
    const source = resolve(ROOT, name);
    if (!(await lstat(source)).isFile()) throw new Error(`Not a regular public file: ${name}`);
    await mkdir(dirname(resolve(out, name)), { recursive: true });
    await copyFile(source, resolve(out, name));
    assets[name] = sha256(await readFile(source));
  }
  const manifest = { schema: 1, repository: 'om1o/synapse-guard-launch', revision, source_dirty: sourceDirty, assets };
  await writeFile(resolve(out, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Built ${PUBLIC_FILES.length} allowlisted files for ${revision}${sourceDirty ? ' (uncommitted working tree)' : ''}.`);
  return manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
