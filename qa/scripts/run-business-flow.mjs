import { spawn, spawnSync } from 'node:child_process';
const env = { ...process.env };
function run(command, args) { return new Promise(resolve => { const child = spawn(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32' }); child.on('close', code => resolve(code ?? 1)); }); }
let exitCode = 1;
try {
  const bootstrap = spawnSync(process.execPath, ['scripts/business-flow-bootstrap.mjs'], { stdio: 'inherit', env });
  if (bootstrap.status !== 0) throw new Error('Business E2E bootstrap failed.');
  exitCode = await run('npx', ['playwright', 'test', 'tests/e2e/business-flow.spec.js', '--project=business-flow']);
} finally {
  const cleanup = spawnSync(process.execPath, ['scripts/business-flow-cleanup.mjs'], { stdio: 'inherit', env });
  if (cleanup.status !== 0 && exitCode === 0) exitCode = cleanup.status || 1;
}
process.exit(exitCode);
