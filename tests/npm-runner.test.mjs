import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { runNpm } from '../scripts/npm-runner.mjs';

for (const command of ['npm', 'npx']) {
  test(`${command} version-only launcher works without a command shell`, { timeout: 15000 }, () => {
    assert.match(runNpm(command, ['--version'], { encoding: 'utf8', timeout: 10000 }).trim(), /^\d+\.\d+\.\d+$/);
  });
}

test('actual deployment runner can perform version probes without executing a deployment', { timeout: 30000 }, async () => {
  const source = await readFile(new URL('../scripts/deploy.mjs', import.meta.url), 'utf8');
  assert.match(source, /import \{ runNpm \} from '\.\/npm-runner\.mjs';/);
  const declaration = source.match(/^const run = .*;$/m)?.[0];
  assert.ok(declaration);
  const run = vm.runInNewContext(`${declaration}\nrun`, {
    runNpm, ROOT: fileURLToPath(new URL('../', import.meta.url)),
  });
  for (const command of ['npm', 'npx']) run(command, ['--version']);
});

test('Windows fallback works when npm lifecycle metadata is absent', { skip: process.platform !== 'win32', timeout: 30000 }, () => {
  const env = { ...process.env };
  delete env.npm_execpath;
  for (const command of ['npm', 'npx']) {
    assert.match(runNpm(command, ['--version'], { env, encoding: 'utf8', timeout: 10000 }).trim(), /^\d+\.\d+\.\d+$/);
  }
});

async function cliFixture(t, script) {
  const directory = await mkdtemp(join(tmpdir(), 'sg-npm-runner-'));
  const cliDirectory = join(directory, 'CLI path with spaces & symbols');
  t.after(async () => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    assert.ok(basename(directory).startsWith('sg-npm-runner-'));
    await rm(directory, { recursive: true, force: true });
  });
  await mkdir(cliDirectory);
  for (const command of ['npm', 'npx']) await writeFile(join(cliDirectory, `${command}-cli.js`), script);
  return { ...process.env, npm_execpath: join(cliDirectory, 'npm-cli.js') };
}

test('lifecycle CLI path and arguments remain literal even when a shell is requested', async (t) => {
  const env = await cliFixture(t, 'process.stdout.write(JSON.stringify(process.argv.slice(2)));');
  const args = ['with spaces', '& literal', '$(not-a-command)', '; literal', 'quote"literal'];
  for (const command of ['npm', 'npx']) {
    const result = runNpm(command, args, { env, shell: true, encoding: 'utf8', timeout: 10000 });
    assert.deepEqual(JSON.parse(result), args);
  }
});

test('launcher propagates a CLI failure instead of allowing release to continue', async (t) => {
  const env = await cliFixture(t, 'process.exit(7);');
  assert.throws(() => runNpm('npm', [], { env, encoding: 'utf8', timeout: 10000 }), (error) => error.status === 7);
});

test('launcher accepts only npm and npx', () => {
  assert.throws(() => runNpm('../node', ['--version']), /Only npm and npx/);
});
