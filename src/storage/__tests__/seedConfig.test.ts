import { shouldSeedDemoData } from '../seedConfig';

describe('seed config', () => {
  it('keeps demo ledger seeding disabled by default, even in dev runtime', () => {
    expect(shouldSeedDemoData(true)).toBe(false);
  });

  it('does not seed demo data in release runtime', () => {
    expect(shouldSeedDemoData(false)).toBe(false);
  });
});
