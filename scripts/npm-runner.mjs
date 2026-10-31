import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';

export function runNpm(command, args, options = {}) {
  if (!['npm', 'npx'].includes(command)) throw new Error('Only npm and npx launchers are supported.');
  const env = options.env || process.env;
  const npmCli = env.npm_execpath || join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const cli = join(dirname(npmCli), `${command}-cli.js`);
  return execFileSync(process.execPath, [cli, ...args], { ...options, shell: false, windowsHide: true });
}
