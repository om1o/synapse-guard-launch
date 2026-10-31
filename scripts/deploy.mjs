import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { ROOT } from './build.mjs';
import { runNpm } from './npm-runner.mjs';

if (process.argv.length > 2) throw new Error('Deployment overrides are not accepted. Use the reviewed public-demo configuration.');
if (!/^[a-f0-9]{32}$/i.test(process.env.CLOUDFLARE_ACCOUNT_ID || '') || !process.env.CLOUDFLARE_API_TOKEN) {
  throw new Error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in a secure deployment environment. Never put credentials in source files or chat.');
}
if (execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: ROOT, encoding: 'utf8' }).trim()) {
  throw new Error('Commit the reviewed release candidate before deployment; the working tree must be clean.');
}
const config = JSON.parse(await readFile(new URL('../wrangler.json', import.meta.url), 'utf8'));
if (config.name !== 'synapse-guard-v1' || config.assets.directory !== './dist' || config.main || config.d1_databases || config.services) {
  throw new Error('Expected the isolated public static demo configuration.');
}
const run = (cmd, args) => runNpm(cmd, args, { cwd: ROOT, stdio: 'inherit' });
run('npm', ['run', 'check']);
// Verify the selected account already has the named worker; do not silently create it elsewhere.
const api = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/workers`;
const options = { headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` }, signal: AbortSignal.timeout(20000) };
const account = await fetch(`${api}/subdomain`, options);
const accountInfo = await account.json();
if (!account.ok || accountInfo.result?.subdomain !== 'synapse-guard') throw new Error('Cannot verify the expected synapse-guard.workers.dev account. No deployment attempted.');
const response = await fetch(`${api}/scripts/synapse-guard-v1/deployments`, { ...options, signal: AbortSignal.timeout(20000) });
if (!response.ok) throw new Error(`Cannot verify the existing public Worker (HTTP ${response.status}). No deployment attempted.`);
const previous = await response.json();
console.log('Previous public Worker deployment (keep for rollback):', JSON.stringify(previous.result));
run('npx', ['--no-install', 'wrangler', 'deploy', '--config', 'wrangler.json']);
run('npm', ['run', 'verify:release']);
