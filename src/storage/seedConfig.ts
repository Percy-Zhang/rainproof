const ENABLE_DEMO_LEDGER_SEEDING = false;

export function shouldSeedDemoData(isDevRuntime = getIsDevRuntime()): boolean {
  return isDevRuntime && ENABLE_DEMO_LEDGER_SEEDING;
}

function getIsDevRuntime(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}
