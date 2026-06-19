const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
const sizesArg = args.find((arg) => arg.startsWith('--sizes='));
const jestBin = require.resolve('jest/bin/jest');
const env = {
  ...process.env,
  RAINPROOF_PERF_HARNESS: '1',
};

if (sizesArg) {
  env.RAINPROOF_PERF_SIZES = sizesArg.slice('--sizes='.length);
}

const result = spawnSync(
  process.execPath,
  [jestBin, '--runInBand', 'src/performance/__tests__/largeDatasetPerf.test.ts'],
  {
    env,
    stdio: 'inherit',
  },
);

process.exit(result.status ?? 1);
