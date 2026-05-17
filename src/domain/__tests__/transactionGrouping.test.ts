import {
  getTransactionGroupGranularity,
  getTransactionGroupKey,
  getTransactionGroupLabel,
} from '../transactionGrouping';

describe('transaction grouping', () => {
  it('chooses day, week, or month grouping from the date span', () => {
    expect(
      getTransactionGroupGranularity({
        startIso: new Date(2026, 4, 1).toISOString(),
        endIso: new Date(2026, 4, 8).toISOString(),
      }),
    ).toBe('day');
    expect(
      getTransactionGroupGranularity({
        startIso: new Date(2026, 4, 1).toISOString(),
        endIso: new Date(2026, 5, 1).toISOString(),
      }),
    ).toBe('week');
    expect(
      getTransactionGroupGranularity({
        startIso: new Date(2026, 0, 1).toISOString(),
        endIso: new Date(2026, 6, 1).toISOString(),
      }),
    ).toBe('month');
  });

  it('builds stable keys and readable labels', () => {
    const dateIso = new Date(2026, 4, 19, 10).toISOString();

    expect(getTransactionGroupKey(dateIso, 'day')).toBe('2026-05-19');
    expect(getTransactionGroupKey(dateIso, 'month')).toBe('2026-05');
    expect(getTransactionGroupLabel(dateIso, 'day')).toBe('May 19');
    expect(getTransactionGroupLabel(dateIso, 'month')).toBe('May 2026');
  });
});
