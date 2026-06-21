const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const shouldListOnly = args.includes('--list');
const shouldSkipPerf = args.includes('--skip-perf');
const shouldUseQuietConsole = args.includes('--quiet');

const checks = [
  {
    args: ['diff', '--check'],
    command: 'git',
    name: 'git diff --check',
  },
  {
    args: ['run', 'typecheck'],
    command: 'npm',
    name: 'npm run typecheck',
  },
  {
    args: ['run', 'lint'],
    command: 'npm',
    name: 'npm run lint',
  },
  {
    args: ['run', 'test'],
    command: 'npm',
    name: 'npm run test',
  },
  {
    args: ['run', 'expo:check'],
    command: 'npm',
    name: 'npm run expo:check',
  },
  {
    args: ['run', 'perf:large-data', '--', '--sizes=1000'],
    command: 'npm',
    name: 'npm run perf:large-data -- --sizes=1000',
    optionalKey: 'perf',
  },
].filter((check) => !(shouldSkipPerf && check.optionalKey === 'perf'));

if (shouldListOnly) {
  console.log('Rainproof local verification will run:');
  for (const check of checks) {
    console.log(`- ${check.name}`);
  }
  console.log('');
  console.log('Use --skip-perf to omit the 1k performance harness.');
  console.log('Use --quiet to hide per-check PASS output.');
  process.exit(0);
}

const startedAt = new Date();
const logDir = path.join(process.cwd(), 'verification-logs');
fs.mkdirSync(logDir, { recursive: true });

const stamp = startedAt.toISOString()
  .replace(/:/g, '')
  .replace(/\..+$/, '')
  .replace('T', '-');
const logPath = path.join(logDir, `verify-${stamp}.log`);

function appendLog(text) {
  fs.appendFileSync(logPath, text);
}

function formatDuration(durationMs) {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function runCheck(check) {
  if (process.platform === 'win32' && check.command === 'npm') {
    return spawnSync(`${check.command} ${check.args.join(' ')}`, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: process.env,
      shell: true,
      windowsHide: true,
    });
  }

  return spawnSync(check.command, check.args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
    windowsHide: true,
  });
}

appendLog(`Rainproof local verification\n`);
appendLog(`Started: ${startedAt.toISOString()}\n`);
appendLog(`Working directory: ${process.cwd()}\n\n`);

console.log('Rainproof local verification');
console.log(`Full log: ${path.relative(process.cwd(), logPath)}`);
if (!shouldUseQuietConsole) {
  console.log('Console output is concise; paste the log file if a check fails.');
  console.log('');
}

const failures = [];

for (const check of checks) {
  const checkStartedAt = Date.now();
  if (!shouldUseQuietConsole) {
    console.log(`Running ${check.name}...`);
  }
  appendLog(`================================================================================\n`);
  appendLog(`${check.name}\n`);
  appendLog(`Command: ${check.command} ${check.args.join(' ')}\n`);
  appendLog(`Started: ${new Date(checkStartedAt).toISOString()}\n\n`);

  const result = runCheck(check);

  const durationMs = Date.now() - checkStartedAt;
  const exitCode = result.status ?? 1;

  if (result.stdout) {
    appendLog(`--- stdout ---\n${result.stdout}\n`);
  }
  if (result.stderr) {
    appendLog(`--- stderr ---\n${result.stderr}\n`);
  }
  if (result.error) {
    appendLog(`--- error ---\n${result.error.stack || result.error.message}\n`);
  }
  appendLog(`Exit code: ${exitCode}\n`);
  appendLog(`Duration: ${formatDuration(durationMs)}\n\n`);

  if (exitCode === 0 && !result.error) {
    if (!shouldUseQuietConsole) {
      console.log(`PASS ${check.name} (${formatDuration(durationMs)})`);
    }
    continue;
  }

  failures.push({
    durationMs,
    exitCode,
    name: check.name,
  });
  console.log(`FAIL ${check.name} (${formatDuration(durationMs)}, exit ${exitCode})`);
}

appendLog(`================================================================================\n`);
appendLog(`Finished: ${new Date().toISOString()}\n`);

if (failures.length === 0) {
  appendLog('Result: all checks passed\n');
  console.log('');
  console.log('All checks passed.');
  console.log(`Full log: ${path.relative(process.cwd(), logPath)}`);
  process.exit(0);
}

appendLog(`Result: ${failures.length} check(s) failed\n`);
for (const failure of failures) {
  appendLog(`- ${failure.name} failed with exit ${failure.exitCode} after ${formatDuration(failure.durationMs)}\n`);
}

console.log('');
console.log(`${failures.length} check(s) failed:`);
for (const failure of failures) {
  console.log(`- ${failure.name} failed with exit ${failure.exitCode}`);
}
console.log(`Full log: ${path.relative(process.cwd(), logPath)}`);
console.log('Paste the failed section or the full log if you want me to inspect it.');

process.exit(1);
