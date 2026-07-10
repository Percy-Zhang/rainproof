import { getInclusiveDateRange, parseDateTimeInput } from '../dates';
import { getStatsTransactionAmountDistribution } from '../statsTransactionAmountDistribution';
import type { StatsReportKind } from '../statsReports';
import type { Transaction, TransactionLine } from '../types';

describe('stats transaction amount distribution', () => {
  it('counts standard, split, and mixed parents once by their net account movement', () => {
    const transactions = [
      transaction('expense', 'expense'),
      transaction('income', 'income'),
      transaction('split-expense', 'expense'),
      transaction('mixed-income', 'income'),
      transaction('mixed-expense', 'expense'),
      transaction('transfer', 'transfer'),
    ];
    const transactionLines = [
      line('expense-line', 'expense', -500),
      line('income-line', 'income', 500),
      line('split-a', 'split-expense', -600),
      line('split-b', 'split-expense', -700),
      line('mixed-income-positive', 'mixed-income', 4000),
      line('mixed-income-negative', 'mixed-income', -1000),
      line('mixed-expense-positive', 'mixed-expense', 1000),
      line('mixed-expense-negative', 'mixed-expense', -4500),
      line('transfer-out', 'transfer', -9000),
      line('transfer-in', 'transfer', 9000, 'other-account'),
    ];

    expect(counts(distribution('expense', transactions, transactionLines))).toEqual([1, 1, 1, 0, 0, 0]);
    expect(counts(distribution('income', transactions, transactionLines))).toEqual([1, 0, 1, 0, 0, 0]);
  });

  it('uses mutually exclusive boundaries, excludes zero, and keeps deterministic bucket order', () => {
    const amountsMinor = [-1, -999, -1000, -2499, -2500, -4999, -5000, -9999, -10000, -24999, -25000, 0];
    const transactions = amountsMinor.map((_, index) => transaction(`tx-${index}`, 'expense'));
    const transactionLines = amountsMinor.map((amountMinor, index) => line(`line-${index}`, `tx-${index}`, amountMinor));
    const result = distribution('expense', transactions, transactionLines);

    expect(result.buckets.map((bucket) => bucket.id)).toEqual([
      '0-10',
      '10-25',
      '25-50',
      '50-100',
      '100-250',
      '250-plus',
    ]);
    expect(counts(result)).toEqual([2, 2, 2, 2, 2, 1]);
    expect(result.totalCount).toBe(11);
  });

  it('applies selected accounts, active currency, and start-inclusive/end-exclusive dates', () => {
    const transactions = [
      transaction('start', 'expense', '2026-05-10', '00:00'),
      transaction('end', 'expense', '2026-05-21', '00:00'),
      transaction('other-account', 'expense'),
      transaction('other-currency', 'expense'),
      transaction('matching', 'expense'),
    ];
    const transactionLines = [
      line('start-line', 'start', -100),
      line('end-line', 'end', -200),
      line('other-account-line', 'other-account', -300, 'other-account'),
      line('other-currency-line', 'other-currency', -400, 'selected', 'USD'),
      line('matching-line', 'matching', -500),
    ];
    const audResult = distribution('expense', transactions, transactionLines);
    const usdResult = distribution('expense', transactions, transactionLines, {
      accountIds: ['selected'],
      currencyCode: 'USD',
    });

    expect(audResult.totalCount).toBe(2);
    expect(counts(audResult)).toEqual([2, 0, 0, 0, 0, 0]);
    expect(usdResult.totalCount).toBe(1);
    expect(counts(usdResult)).toEqual([1, 0, 0, 0, 0, 0]);
  });

  it('returns all zero-count buckets for empty data or no selected accounts', () => {
    const empty = distribution('expense', [], []);
    const noAccounts = distribution(
      'expense',
      [transaction('expense', 'expense')],
      [line('expense-line', 'expense', -500)],
      { accountIds: [] },
    );

    expect(empty.totalCount).toBe(0);
    expect(noAccounts.totalCount).toBe(0);
    expect(counts(empty)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(counts(noAccounts)).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

const range = getInclusiveDateRange('2026-05-10', '2026-05-20');

function distribution(
  reportKind: StatsReportKind,
  transactions: Transaction[],
  transactionLines: TransactionLine[],
  overrides: Partial<Parameters<typeof getStatsTransactionAmountDistribution>[0]> = {},
) {
  return getStatsTransactionAmountDistribution({
    accountIds: ['selected'],
    currencyCode: 'AUD',
    range,
    reportKind,
    transactionLines,
    transactions,
    ...overrides,
  });
}

function counts(result: ReturnType<typeof getStatsTransactionAmountDistribution>): number[] {
  return result.buckets.map((bucket) => bucket.count);
}

function transaction(
  id: string,
  kind: Transaction['kind'],
  date = '2026-05-15',
  time = '12:00',
): Transaction {
  const datetime = parseDateTimeInput(date, time);
  return {
    id,
    kind,
    title: id,
    datetime,
    notes: '',
    labels: [],
    groupId: '',
    createdAt: datetime,
    updatedAt: datetime,
  };
}

function line(
  id: string,
  transactionId: string,
  amountMinor: number,
  accountId = 'selected',
  currencyCode = 'AUD',
): TransactionLine {
  return {
    id,
    transactionId,
    accountId,
    amountMinor,
    currencyCode,
    categoryId: amountMinor >= 0 ? 'income' : 'food',
    subcategoryId: amountMinor >= 0 ? 'salary' : 'groceries',
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: '',
  };
}
