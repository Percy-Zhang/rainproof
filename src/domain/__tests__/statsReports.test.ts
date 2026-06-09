import {
  getStatsReport,
  getStatsReportDrilldownRows,
  getStatsReportRollupById,
  getStatsReportRollupRows,
  getRecentStatsReportRollupRows,
  sortStatsReportRows,
  type StatsReportLineRow,
} from '../statsReports';
import type { Account, Transaction, TransactionLine, TransactionLink } from '../types';

const range = {
  startIso: '2026-05-01T00:00:00.000Z',
  endIso: '2026-06-01T00:00:00.000Z',
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

function transaction(
  id: string,
  kind: Transaction['kind'],
  title: string,
  datetime = '2026-05-15T10:00:00.000Z',
): Transaction {
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
  note = '',
}: {
  id: string;
  transactionId: string;
  accountId?: string;
  amountMinor: number;
  currencyCode?: string;
  categoryId: string;
  subcategoryId: string;
  note?: string;
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
    note,
    createdAt: '',
  };
}

function link(overrides: Partial<TransactionLink> = {}): TransactionLink {
  return {
    id: 'link-1',
    sourceTransactionId: 'refund-income',
    targetTransactionId: 'split-expense',
    sourceLineId: null,
    targetLineId: null,
    linkType: 'refund',
    amountMinor: 1000,
    currencyCode: 'AUD',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function getBaseTransactions(): Transaction[] {
  return [
    transaction('split-expense', 'expense', 'Woolworths', '2026-05-20T10:00:00.000Z'),
    transaction('one-expense', 'expense', 'Cafe', '2026-05-18T10:00:00.000Z'),
    transaction('split-income', 'income', 'Apple Pay', '2026-05-19T10:00:00.000Z'),
    transaction('one-income', 'income', 'Bank interest', '2026-05-17T10:00:00.000Z'),
    transaction('transfer', 'transfer', 'Move money', '2026-05-16T10:00:00.000Z'),
    transaction('outside-period', 'expense', 'Old expense', '2026-04-01T10:00:00.000Z'),
    transaction('usd-expense', 'expense', 'Airport snack', '2026-05-21T10:00:00.000Z'),
    transaction('second-account-expense', 'expense', 'Fuel stop', '2026-05-22T10:00:00.000Z'),
  ];
}

function getBaseLines(): TransactionLine[] {
  return [
    line({
      id: 'split-food',
      transactionId: 'split-expense',
      amountMinor: -5000,
      categoryId: 'food',
      subcategoryId: 'groceries',
      note: 'Weekly food shop',
    }),
    line({
      id: 'split-home',
      transactionId: 'split-expense',
      amountMinor: -3000,
      categoryId: 'housing',
      subcategoryId: 'maintenance-repairs',
      note: 'Cleaning supplies',
    }),
    line({
      id: 'one-restaurant',
      transactionId: 'one-expense',
      amountMinor: -2000,
      categoryId: 'food',
      subcategoryId: 'restaurants',
      note: 'Lunch',
    }),
    line({
      id: 'split-salary',
      transactionId: 'split-income',
      amountMinor: 130000,
      categoryId: 'income',
      subcategoryId: 'salary',
      note: 'Base pay',
    }),
    line({
      id: 'split-bonus',
      transactionId: 'split-income',
      amountMinor: 20000,
      categoryId: 'income',
      subcategoryId: 'bonus',
      note: 'Quarterly bonus',
    }),
    line({
      id: 'one-interest',
      transactionId: 'one-income',
      amountMinor: 500,
      categoryId: 'income',
      subcategoryId: 'interest',
      note: '',
    }),
    line({
      id: 'transfer-out',
      transactionId: 'transfer',
      amountMinor: -2500,
      categoryId: 'other',
      subcategoryId: 'miscellaneous',
    }),
    line({
      id: 'transfer-in',
      transactionId: 'transfer',
      accountId: 'acct-b',
      amountMinor: 2500,
      categoryId: 'other',
      subcategoryId: 'miscellaneous',
    }),
    line({
      id: 'outside-line',
      transactionId: 'outside-period',
      amountMinor: -1000,
      categoryId: 'food',
      subcategoryId: 'groceries',
    }),
    line({
      id: 'usd-line',
      transactionId: 'usd-expense',
      accountId: 'acct-usd',
      amountMinor: -1200,
      currencyCode: 'USD',
      categoryId: 'food',
      subcategoryId: 'restaurants',
    }),
    line({
      id: 'fuel-line',
      transactionId: 'second-account-expense',
      accountId: 'acct-b',
      amountMinor: -1000,
      categoryId: 'transport',
      subcategoryId: 'fuel',
      note: 'Petrol',
    }),
  ];
}

function getExpenseReport(overrides: Partial<Parameters<typeof getStatsReport>[0]> = {}) {
  return getStatsReport({
    reportKind: 'expense',
    transactions: getBaseTransactions(),
    transactionLines: getBaseLines(),
    transactionLinks: [],
    accounts,
    range,
    currencyCode: 'AUD',
    ...overrides,
  });
}

function getIncomeReport(overrides: Partial<Parameters<typeof getStatsReport>[0]> = {}) {
  return getStatsReport({
    reportKind: 'income',
    transactions: getBaseTransactions(),
    transactionLines: getBaseLines(),
    transactionLinks: [],
    accounts,
    range,
    currencyCode: 'AUD',
    ...overrides,
  });
}

function ids(rows: StatsReportLineRow[]): string[] {
  return rows.map((row) => row.lineId);
}

describe('stats report helpers', () => {
  it('rolls split and one-line expenses into category and subcategory reports', () => {
    const report = getExpenseReport();

    expect(ids(report.rows)).toEqual(['fuel-line', 'split-food', 'split-home', 'one-restaurant']);
    expect(report.rows.find((row) => row.lineId === 'split-food')).toEqual(
      expect.objectContaining({
        transactionId: 'split-expense',
        transactionTitle: 'Woolworths',
        accountId: 'acct-a',
        accountName: 'Daily',
        grossAmountMinor: 5000,
        netAmountMinor: 5000,
        categoryId: 'food',
        categoryName: 'Food & Dining',
        subcategoryId: 'groceries',
        subcategoryName: 'Groceries',
        lineNote: 'Weekly food shop',
        lineItemName: 'Weekly food shop',
        isSplitTransaction: true,
      }),
    );
    expect(report.categoryRollups.map((rollup) => [rollup.categoryId, rollup.grossAmountMinor, rollup.netAmountMinor])).toEqual([
      ['food', 7000, 7000],
      ['housing', 3000, 3000],
      ['transport', 1000, 1000],
    ]);
    expect(report.subcategoryRollups.map((rollup) => [rollup.subcategoryId, rollup.netAmountMinor])).toEqual([
      ['groceries', 5000],
      ['maintenance-repairs', 3000],
      ['restaurants', 2000],
      ['fuel', 1000],
    ]);
    expect(report.categoryRollups[0].percentage).toBeCloseTo(63.636, 2);
  });

  it('rolls split and one-line incomes into category and subcategory reports', () => {
    const report = getIncomeReport();

    expect(ids(report.rows)).toEqual(['split-salary', 'split-bonus', 'one-interest']);
    expect(report.totalGrossAmountMinor).toBe(150500);
    expect(report.categoryRollups).toEqual([
      expect.objectContaining({
        id: 'category:income',
        categoryId: 'income',
        label: 'Income',
        grossAmountMinor: 150500,
        netAmountMinor: 150500,
        lineCount: 3,
      }),
    ]);
    expect(report.subcategoryRollups.map((rollup) => [rollup.subcategoryId, rollup.netAmountMinor])).toEqual([
      ['salary', 130000],
      ['bonus', 20000],
      ['interest', 500],
    ]);
  });

  it('counts mixed split lines by line sign instead of parent transaction kind', () => {
    const transactions = [
      transaction('mixed-pay', 'income', 'Pay with tax', '2026-05-20T10:00:00.000Z'),
      transaction('transfer', 'transfer', 'Move money', '2026-05-20T11:00:00.000Z'),
    ];
    const transactionLines = [
      line({
        id: 'mixed-salary',
        transactionId: 'mixed-pay',
        amountMinor: 230000,
        categoryId: 'income',
        subcategoryId: 'salary',
        note: 'Salary',
      }),
      line({
        id: 'mixed-tax',
        transactionId: 'mixed-pay',
        amountMinor: -60000,
        categoryId: 'tax',
        subcategoryId: 'withholding',
        note: 'Tax',
      }),
      line({
        id: 'transfer-out',
        transactionId: 'transfer',
        amountMinor: -999999,
        categoryId: 'food',
        subcategoryId: 'groceries',
      }),
    ];

    const expenseReport = getExpenseReport({ transactions, transactionLines });
    const incomeReport = getIncomeReport({ transactions, transactionLines });

    expect(ids(expenseReport.rows)).toEqual(['mixed-tax']);
    expect(expenseReport.rows[0]).toEqual(
      expect.objectContaining({
        reportKind: 'expense',
        transactionId: 'mixed-pay',
        lineId: 'mixed-tax',
        grossAmountMinor: 60000,
        netAmountMinor: 60000,
        isSplitTransaction: true,
      }),
    );
    expect(ids(incomeReport.rows)).toEqual(['mixed-salary']);
    expect(incomeReport.totalGrossAmountMinor).toBe(230000);
  });

  it('excludes transfers, transactions outside the period, and other currencies', () => {
    const report = getExpenseReport();

    expect(ids(report.rows)).not.toEqual(expect.arrayContaining(['transfer-out', 'transfer-in', 'outside-line', 'usd-line']));
  });

  it('respects account and currency filters', () => {
    expect(ids(getExpenseReport({ accountIds: ['acct-b'] }).rows)).toEqual(['fuel-line']);
    expect(ids(getExpenseReport({ accountIds: [] }).rows)).toEqual([]);
    expect(ids(getExpenseReport({ currencyCode: 'USD' }).rows)).toEqual(['usd-line']);
  });

  it('reduces only a selected target expense line for line-level target links', () => {
    const transactions = [
      transaction('refund-income', 'income', 'Refund', '2026-05-20T11:00:00.000Z'),
      transaction('split-expense', 'expense', 'Woolworths', '2026-05-20T10:00:00.000Z'),
    ];
    const transactionLines = [
      line({
        id: 'refund-line',
        transactionId: 'refund-income',
        amountMinor: 1000,
        categoryId: 'income',
        subcategoryId: 'refund',
      }),
      line({
        id: 'split-food',
        transactionId: 'split-expense',
        amountMinor: -5000,
        categoryId: 'food',
        subcategoryId: 'groceries',
      }),
      line({
        id: 'split-home',
        transactionId: 'split-expense',
        amountMinor: -3000,
        categoryId: 'housing',
        subcategoryId: 'maintenance-repairs',
      }),
    ];

    const report = getExpenseReport({
      transactions,
      transactionLines,
      transactionLinks: [link({ amountMinor: 1000, targetLineId: 'split-home' })],
    });

    expect(report.rows.map((row) => [row.lineId, row.grossAmountMinor, row.netAmountMinor])).toEqual([
      ['split-food', 5000, 5000],
      ['split-home', 3000, 2000],
    ]);
    expect(getStatsReportDrilldownRows({
      report,
      selection: { kind: 'category', categoryId: 'housing' },
    })).toEqual([
      expect.objectContaining({
        lineId: 'split-home',
        grossAmountMinor: 3000,
        netAmountMinor: 2000,
      }),
    ]);
  });

  it('keeps transaction-level target links proportional when targetLineId is null', () => {
    const transactions = [
      transaction('refund-income', 'income', 'Refund', '2026-05-20T11:00:00.000Z'),
      transaction('split-expense', 'expense', 'Woolworths', '2026-05-20T10:00:00.000Z'),
    ];
    const transactionLines = [
      line({
        id: 'refund-line',
        transactionId: 'refund-income',
        amountMinor: 4000,
        categoryId: 'income',
        subcategoryId: 'refund',
      }),
      line({
        id: 'split-food',
        transactionId: 'split-expense',
        amountMinor: -5000,
        categoryId: 'food',
        subcategoryId: 'groceries',
      }),
      line({
        id: 'split-home',
        transactionId: 'split-expense',
        amountMinor: -3000,
        categoryId: 'housing',
        subcategoryId: 'maintenance-repairs',
      }),
    ];

    const report = getExpenseReport({
      transactions,
      transactionLines,
      transactionLinks: [link({ amountMinor: 4000, targetLineId: null })],
    });

    expect(report.rows.map((row) => [row.lineId, row.netAmountMinor])).toEqual([
      ['split-food', 2500],
      ['split-home', 1500],
    ]);
  });

  it('hides fully offset parent transaction spending from recent and drilldown rows', () => {
    const transactions = [
      transaction('refund-income', 'income', 'Refund', '2026-05-20T11:00:00.000Z'),
      transaction('one-expense', 'expense', 'Cafe', '2026-05-20T10:00:00.000Z'),
    ];
    const transactionLines = [
      line({
        id: 'refund-line',
        transactionId: 'refund-income',
        amountMinor: 2000,
        categoryId: 'income',
        subcategoryId: 'refund',
      }),
      line({
        id: 'expense-line',
        transactionId: 'one-expense',
        amountMinor: -2000,
        categoryId: 'food',
        subcategoryId: 'restaurants',
      }),
    ];
    const report = getExpenseReport({
      transactions,
      transactionLines,
      transactionLinks: [
        link({
          sourceTransactionId: 'refund-income',
          targetTransactionId: 'one-expense',
          amountMinor: 2000,
        }),
      ],
    });

    expect(report.rows).toEqual([
      expect.objectContaining({
        lineId: 'expense-line',
        grossAmountMinor: 2000,
        netAmountMinor: 0,
      }),
    ]);
    expect(getStatsReportDrilldownRows({
      report,
      selection: { kind: 'category', categoryId: 'food' },
    })).toEqual([]);
    expect(getStatsReportRollupRows({
      report,
      rollupKind: 'category',
      rollupId: 'category:food',
    })).toEqual([]);
    expect(getRecentStatsReportRollupRows({
      report,
      rollupKind: 'category',
      rollupId: 'category:food',
    })).toEqual([]);
  });

  it('hides a fully offset split line while preserving its unlinked sibling', () => {
    const transactions = [
      transaction('refund-income', 'income', 'Refund', '2026-05-20T11:00:00.000Z'),
      transaction('split-expense', 'expense', 'Woolworths', '2026-05-20T10:00:00.000Z'),
    ];
    const transactionLines = [
      line({
        id: 'refund-line',
        transactionId: 'refund-income',
        amountMinor: 3000,
        categoryId: 'income',
        subcategoryId: 'refund',
      }),
      line({
        id: 'split-food',
        transactionId: 'split-expense',
        amountMinor: -5000,
        categoryId: 'food',
        subcategoryId: 'groceries',
      }),
      line({
        id: 'split-home',
        transactionId: 'split-expense',
        amountMinor: -3000,
        categoryId: 'housing',
        subcategoryId: 'maintenance-repairs',
      }),
    ];
    const report = getExpenseReport({
      transactions,
      transactionLines,
      transactionLinks: [
        link({
          amountMinor: 3000,
          targetLineId: 'split-home',
        }),
      ],
    });

    expect(report.rows.map((row) => [row.lineId, row.netAmountMinor])).toEqual([
      ['split-food', 5000],
      ['split-home', 0],
    ]);
    expect(getStatsReportDrilldownRows({
      report,
      selection: { kind: 'category', categoryId: 'housing' },
    })).toEqual([]);
    expect(getStatsReportDrilldownRows({
      report,
      selection: { kind: 'category', categoryId: 'food' },
    }).map((row) => row.lineId)).toEqual(['split-food']);
  });

  it('excludes only selected and allocated income amounts from income line reports', () => {
    const transactions = [
      transaction('split-income', 'income', 'Apple Pay', '2026-05-20T11:00:00.000Z'),
      transaction('split-expense', 'expense', 'Woolworths', '2026-05-20T10:00:00.000Z'),
    ];
    const transactionLines = [
      line({
        id: 'salary-line',
        transactionId: 'split-income',
        amountMinor: 3000,
        categoryId: 'income',
        subcategoryId: 'salary',
      }),
      line({
        id: 'bonus-line',
        transactionId: 'split-income',
        amountMinor: 2000,
        categoryId: 'income',
        subcategoryId: 'bonus',
      }),
      line({
        id: 'expense-line',
        transactionId: 'split-expense',
        amountMinor: -5000,
        categoryId: 'food',
        subcategoryId: 'groceries',
      }),
    ];

    const sourceLineReport = getIncomeReport({
      transactions,
      transactionLines,
      transactionLinks: [
        link({
          sourceTransactionId: 'split-income',
          sourceLineId: 'bonus-line',
          amountMinor: 1500,
          targetLineId: 'expense-line',
        }),
      ],
    });
    expect(sourceLineReport.rows.map((row) => [row.lineId, row.netAmountMinor])).toEqual([
      ['salary-line', 3000],
      ['bonus-line', 500],
    ]);

    const proportionalReport = getIncomeReport({
      transactions,
      transactionLines,
      transactionLinks: [
        link({
          sourceTransactionId: 'split-income',
          sourceLineId: null,
          amountMinor: 2500,
          targetLineId: 'expense-line',
        }),
      ],
    });
    expect(proportionalReport.totalGrossAmountMinor).toBe(5000);
    expect(proportionalReport.totalNetAmountMinor).toBe(2500);
  });

  it('returns drilldown rows with parent transaction context', () => {
    const report = getExpenseReport();
    const rows = getStatsReportDrilldownRows({
      report,
      selection: { kind: 'category', categoryId: 'food' },
      sort: 'date_oldest',
    });

    expect(ids(rows)).toEqual(['one-restaurant', 'split-food']);
    expect(rows[1]).toEqual(
      expect.objectContaining({
        transactionId: 'split-expense',
        transactionTitle: 'Woolworths',
        lineId: 'split-food',
      }),
    );
  });

  it('selects rollups and recent matching rows for chart interaction', () => {
    const report = getExpenseReport();
    const foodRollup = getStatsReportRollupById(report, 'category', 'category:food');

    expect(foodRollup).toEqual(
      expect.objectContaining({
        id: 'category:food',
        label: 'Food & Dining',
        lineIds: ['split-food', 'one-restaurant'],
      }),
    );
    expect(ids(getStatsReportRollupRows({ report, rollupKind: 'category', rollupId: foodRollup?.id }))).toEqual([
      'split-food',
      'one-restaurant',
    ]);
    expect(ids(getRecentStatsReportRollupRows({ report, rollupKind: 'category', rollupId: foodRollup?.id, limit: 1 }))).toEqual([
      'split-food',
    ]);
    expect(getStatsReportRollupById(report, 'category', 'missing')?.id).toBe('category:food');
  });

  it('returns no chart selection rows for empty rollups', () => {
    const report = getExpenseReport({ accountIds: [] });

    expect(getStatsReportRollupById(report, 'category')).toBeUndefined();
    expect(getRecentStatsReportRollupRows({ report, rollupKind: 'category' })).toEqual([]);
  });

  it('sorts drilldown line rows deterministically', () => {
    const rows = getExpenseReport().rows;

    expect(ids(sortStatsReportRows(rows, 'date_newest'))).toEqual(['fuel-line', 'split-food', 'split-home', 'one-restaurant']);
    expect(ids(sortStatsReportRows(rows, 'date_oldest'))).toEqual(['one-restaurant', 'split-food', 'split-home', 'fuel-line']);
    expect(ids(sortStatsReportRows(rows, 'net_amount_highest'))).toEqual(['split-food', 'split-home', 'one-restaurant', 'fuel-line']);
    expect(ids(sortStatsReportRows(rows, 'net_amount_lowest'))).toEqual(['fuel-line', 'one-restaurant', 'split-home', 'split-food']);
    expect(ids(sortStatsReportRows(rows, 'gross_amount_highest'))).toEqual(['split-food', 'split-home', 'one-restaurant', 'fuel-line']);
    expect(ids(sortStatsReportRows(rows, 'gross_amount_lowest'))).toEqual(['fuel-line', 'one-restaurant', 'split-home', 'split-food']);
    expect(ids(sortStatsReportRows(rows, 'item_az'))).toEqual(['split-home', 'one-restaurant', 'fuel-line', 'split-food']);
    expect(ids(sortStatsReportRows(rows, 'item_za'))).toEqual(['split-food', 'fuel-line', 'one-restaurant', 'split-home']);
    expect(ids(sortStatsReportRows(rows, 'category_subcategory'))).toEqual(['split-food', 'one-restaurant', 'split-home', 'fuel-line']);
    expect(ids(sortStatsReportRows(rows, 'account'))).toEqual(['fuel-line', 'split-food', 'split-home', 'one-restaurant']);
  });
});
