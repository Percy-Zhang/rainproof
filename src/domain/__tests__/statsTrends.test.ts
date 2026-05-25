import { getStatsReport } from '../statsReports';
import { getStatsMonthlyTrendSummary, getStatsRollupMonthlyTrend } from '../statsTrends';
import type { Account, DateRange, Transaction, TransactionLine, TransactionLink } from '../types';

const fullRange: DateRange = {
  startIso: '2026-01-01T00:00:00.000Z',
  endIso: '2026-04-01T00:00:00.000Z',
};

const februaryRange: DateRange = {
  startIso: '2026-02-01T00:00:00.000Z',
  endIso: '2026-03-01T00:00:00.000Z',
};

const accounts: Account[] = [
  account('acct-a', 'Everyday', 'Daily', 'AUD'),
  account('acct-b', 'Bills', '', 'AUD'),
  account('acct-usd', 'USD Cash', '', 'USD'),
];

function account(id: string, name: string, nickname: string, currencyCode: string): Account {
  return {
    id,
    name,
    nickname,
    type: 'checking',
    currencyCode,
    openingBalanceMinor: 0,
    notes: '',
    institutionName: '',
    includeInRainyDay: false,
    themeColor: '#1876A8',
    iconName: 'business-outline',
    showOnDashboard: true,
    sortOrder: 0,
    isArchived: false,
    createdAt: '',
    updatedAt: '',
  };
}

function transaction(id: string, kind: Transaction['kind'], title: string, datetime: string): Transaction {
  return {
    id,
    kind,
    title,
    datetime,
    notes: '',
    labels: [],
    groupId: '',
    createdAt: datetime,
    updatedAt: datetime,
  };
}

function line({
  id,
  transactionId,
  accountId = 'acct-a',
  amountMinor,
  currencyCode = 'AUD',
  categoryId,
  subcategoryId,
}: {
  id: string;
  transactionId: string;
  accountId?: string;
  amountMinor: number;
  currencyCode?: string;
  categoryId: string;
  subcategoryId: string;
}): TransactionLine {
  return {
    id,
    transactionId,
    accountId,
    amountMinor,
    currencyCode,
    categoryId,
    subcategoryId,
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: '',
  };
}

function link(overrides: Partial<TransactionLink>): TransactionLink {
  return {
    id: 'link-1',
    sourceTransactionId: 'refund-jan',
    targetTransactionId: 'groceries-jan',
    sourceLineId: 'refund-jan-line',
    targetLineId: 'groceries-jan-line',
    linkType: 'refund',
    amountMinor: 2000,
    currencyCode: 'AUD',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const transactions: Transaction[] = [
  transaction('salary-jan', 'income', 'January salary', '2026-01-05T10:00:00.000Z'),
  transaction('refund-jan', 'income', 'Grocery refund', '2026-01-06T10:00:00.000Z'),
  transaction('groceries-jan', 'expense', 'Groceries', '2026-01-07T10:00:00.000Z'),
  transaction('usd-expense', 'expense', 'Airport snack', '2026-01-08T10:00:00.000Z'),
  transaction('salary-feb', 'income', 'February salary', '2026-02-05T10:00:00.000Z'),
  transaction('reimburse-feb', 'income', 'Roommate reimbursement', '2026-02-06T10:00:00.000Z'),
  transaction('split-feb', 'expense', 'Big shop', '2026-02-07T10:00:00.000Z'),
  transaction('transfer-feb', 'transfer', 'Move money', '2026-02-08T10:00:00.000Z'),
  transaction('fuel-mar', 'expense', 'Fuel', '2026-03-03T10:00:00.000Z'),
];

const lines: TransactionLine[] = [
  line({
    id: 'salary-jan-line',
    transactionId: 'salary-jan',
    amountMinor: 300000,
    categoryId: 'income',
    subcategoryId: 'salary',
  }),
  line({
    id: 'refund-jan-line',
    transactionId: 'refund-jan',
    amountMinor: 2000,
    categoryId: 'income',
    subcategoryId: 'refund',
  }),
  line({
    id: 'groceries-jan-line',
    transactionId: 'groceries-jan',
    amountMinor: -10000,
    categoryId: 'food',
    subcategoryId: 'groceries',
  }),
  line({
    id: 'usd-expense-line',
    transactionId: 'usd-expense',
    accountId: 'acct-usd',
    amountMinor: -7000,
    currencyCode: 'USD',
    categoryId: 'food',
    subcategoryId: 'restaurants',
  }),
  line({
    id: 'salary-feb-line',
    transactionId: 'salary-feb',
    amountMinor: 250000,
    categoryId: 'income',
    subcategoryId: 'salary',
  }),
  line({
    id: 'reimburse-feb-line',
    transactionId: 'reimburse-feb',
    amountMinor: 5000,
    categoryId: 'income',
    subcategoryId: 'reimbursement',
  }),
  line({
    id: 'split-feb-food',
    transactionId: 'split-feb',
    amountMinor: -6000,
    categoryId: 'food',
    subcategoryId: 'groceries',
  }),
  line({
    id: 'split-feb-home',
    transactionId: 'split-feb',
    amountMinor: -4000,
    categoryId: 'housing',
    subcategoryId: 'maintenance-repairs',
  }),
  line({
    id: 'transfer-feb-out',
    transactionId: 'transfer-feb',
    amountMinor: -999999,
    categoryId: 'other',
    subcategoryId: 'miscellaneous',
  }),
  line({
    id: 'transfer-feb-in',
    transactionId: 'transfer-feb',
    accountId: 'acct-b',
    amountMinor: 999999,
    categoryId: 'other',
    subcategoryId: 'miscellaneous',
  }),
  line({
    id: 'fuel-mar-line',
    transactionId: 'fuel-mar',
    accountId: 'acct-b',
    amountMinor: -9000,
    categoryId: 'transport',
    subcategoryId: 'fuel',
  }),
];

const transactionLinks: TransactionLink[] = [
  link({
    id: 'jan-refund-link',
    amountMinor: 2000,
    sourceTransactionId: 'refund-jan',
    sourceLineId: 'refund-jan-line',
    targetTransactionId: 'groceries-jan',
    targetLineId: 'groceries-jan-line',
  }),
  link({
    id: 'feb-reimbursement-link',
    linkType: 'reimbursement',
    amountMinor: 5000,
    sourceTransactionId: 'reimburse-feb',
    sourceLineId: null,
    targetTransactionId: 'split-feb',
    targetLineId: null,
  }),
];

function report(reportKind: 'expense' | 'income', range = fullRange, accountIds?: string[], currencyCode = 'AUD') {
  return getStatsReport({
    reportKind,
    transactions,
    transactionLines: lines,
    transactionLinks,
    accounts,
    range,
    currencyCode,
    accountIds,
  });
}

describe('stats trend helpers', () => {
  it('builds monthly cash-flow buckets, averages, and gross vs net spending from net-aware line rows', () => {
    const summary = getStatsMonthlyTrendSummary({
      incomeReport: report('income'),
      expenseReport: report('expense'),
      range: fullRange,
    });

    expect(summary.buckets.map((bucket) => [
      bucket.monthKey,
      bucket.incomeNetMinor,
      bucket.spendingGrossMinor,
      bucket.spendingNetMinor,
      bucket.linkedSpendingAdjustmentMinor,
      bucket.netCashFlowMinor,
    ])).toEqual([
      ['2026-01', 300000, 10000, 8000, 2000, 292000],
      ['2026-02', 250000, 10000, 5000, 5000, 245000],
      ['2026-03', 0, 9000, 9000, 0, -9000],
    ]);
    expect(summary.grossNetSpending).toEqual({
      grossSpendingMinor: 29000,
      linkedAdjustmentMinor: 7000,
      netSpendingMinor: 22000,
    });
    expect(summary.averages).toEqual(
      expect.objectContaining({
        monthCount: 3,
        averageIncomeMinor: 183333,
        averageSpendingMinor: 7333,
        averageNetCashFlowMinor: 176000,
        basisLabel: '3 selected months',
      }),
    );
  });

  it('respects period, account, and currency filters through the input reports', () => {
    const februarySummary = getStatsMonthlyTrendSummary({
      incomeReport: report('income', februaryRange),
      expenseReport: report('expense', februaryRange),
      range: februaryRange,
    });
    expect(februarySummary.buckets.map((bucket) => [bucket.monthKey, bucket.spendingNetMinor])).toEqual([
      ['2026-02', 5000],
    ]);

    const accountSummary = getStatsMonthlyTrendSummary({
      incomeReport: report('income', fullRange, ['acct-b']),
      expenseReport: report('expense', fullRange, ['acct-b']),
      range: fullRange,
    });
    expect(accountSummary.buckets.map((bucket) => [bucket.monthKey, bucket.spendingNetMinor])).toEqual([
      ['2026-01', 0],
      ['2026-02', 0],
      ['2026-03', 9000],
    ]);

    const usdSummary = getStatsMonthlyTrendSummary({
      incomeReport: report('income', fullRange, undefined, 'USD'),
      expenseReport: report('expense', fullRange, undefined, 'USD'),
      range: fullRange,
    });
    expect(usdSummary.buckets.map((bucket) => [bucket.monthKey, bucket.spendingNetMinor])).toEqual([
      ['2026-01', 7000],
      ['2026-02', 0],
      ['2026-03', 0],
    ]);
  });

  it('builds category and subcategory trends from selected rollups', () => {
    const expenseReport = report('expense');
    const foodTrend = getStatsRollupMonthlyTrend({
      report: expenseReport,
      rollupKind: 'category',
      rollupId: 'category:food',
      range: fullRange,
    });
    const housingTrend = getStatsRollupMonthlyTrend({
      report: expenseReport,
      rollupKind: 'subcategory',
      rollupId: 'subcategory:housing:maintenance-repairs',
      range: fullRange,
    });

    expect(foodTrend.rollup?.label).toBe('Food & Dining');
    expect(foodTrend.buckets.map((bucket) => [bucket.monthKey, bucket.grossAmountMinor, bucket.netAmountMinor, bucket.lineCount])).toEqual([
      ['2026-01', 10000, 8000, 1],
      ['2026-02', 6000, 3000, 1],
      ['2026-03', 0, 0, 0],
    ]);
    expect(foodTrend.totalGrossAmountMinor).toBe(16000);
    expect(foodTrend.totalNetAmountMinor).toBe(11000);
    expect(foodTrend.averageNetAmountMinor).toBe(3667);
    expect(housingTrend.buckets.map((bucket) => [bucket.monthKey, bucket.netAmountMinor])).toEqual([
      ['2026-01', 0],
      ['2026-02', 2000],
      ['2026-03', 0],
    ]);
  });

  it('returns empty monthly trend data safely when no rollup exists', () => {
    const emptyReport = report('expense', fullRange, []);
    const trend = getStatsRollupMonthlyTrend({
      report: emptyReport,
      rollupKind: 'category',
      rollupId: 'missing',
      range: fullRange,
    });

    expect(trend.rollup).toBeUndefined();
    expect(trend.totalNetAmountMinor).toBe(0);
    expect(trend.buckets.map((bucket) => [bucket.monthKey, bucket.netAmountMinor])).toEqual([
      ['2026-01', 0],
      ['2026-02', 0],
      ['2026-03', 0],
    ]);
  });
});
