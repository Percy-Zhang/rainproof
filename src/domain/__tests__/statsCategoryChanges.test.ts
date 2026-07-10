import { defaultCategories } from '../categories';
import { getInclusiveDateRange, getPreviousEquivalentDateRange } from '../dates';
import { getStatsCategoryChanges } from '../statsCategoryChanges';
import { getStatsReport, type StatsReport, type StatsReportKind, type StatsReportRollup } from '../statsReports';
import type { Account, Transaction, TransactionLine } from '../types';

describe('category changes', () => {
  it('merges both periods, handles percentage edges, and sorts by absolute change', () => {
    const rows = getStatsCategoryChanges({
      currentReport: report('expense', [
        rollup('food', 'Food', 5000),
        rollup('shopping', 'Shopping', 3000),
        rollup('unchanged', 'Unchanged', 1000),
        rollup('zero', 'Zero', 0),
      ]),
      previousReport: report('expense', [
        rollup('food', 'Food', 3000),
        rollup('housing', 'Housing', 4000),
        rollup('unchanged', 'Unchanged', 1000),
        rollup('zero', 'Zero', 0),
      ]),
    });

    expect(rows.map((row) => row.categoryId)).toEqual(['housing', 'shopping', 'food', 'unchanged']);
    expect(rows.find((row) => row.categoryId === 'shopping')).toEqual(expect.objectContaining({
      currentMinor: 3000,
      previousMinor: 0,
      changeMinor: 3000,
      percentageChange: null,
      direction: 'increase',
    }));
    expect(rows.find((row) => row.categoryId === 'housing')).toEqual(expect.objectContaining({
      currentMinor: 0,
      previousMinor: 4000,
      changeMinor: -4000,
      percentageChange: -100,
      direction: 'decrease',
    }));
    expect(rows.find((row) => row.categoryId === 'food')?.percentageChange).toBeCloseTo(66.667, 2);
    expect(rows.find((row) => row.categoryId === 'unchanged')?.direction).toBe('unchanged');
    expect(rows.some((row) => row.categoryId === 'zero')).toBe(false);
  });

  it('uses deterministic category-name and id tie breakers', () => {
    const rows = getStatsCategoryChanges({
      currentReport: report('expense', [
        rollup('z', 'Beta', 1000),
        rollup('b', 'Alpha', 1000),
        rollup('a', 'Alpha', 1000),
      ]),
      previousReport: report('expense', []),
    });

    expect(rows.map((row) => row.categoryId)).toEqual(['a', 'b', 'z']);
  });

  it('reuses report filtering for mode, transfers, mixed splits, accounts, and currency', () => {
    const currentRange = getInclusiveDateRange('2026-05-11', '2026-05-20');
    const previousRange = getPreviousEquivalentDateRange(currentRange);
    const transactions: Transaction[] = [
      transaction('previous-expense', 'expense', '2026-05-05T12:00:00.000Z'),
      transaction('previous-income', 'income', '2026-05-06T12:00:00.000Z'),
      transaction('mixed-current', 'income', '2026-05-15T12:00:00.000Z'),
      transaction('transfer-current', 'transfer', '2026-05-16T12:00:00.000Z'),
      transaction('other-account', 'expense', '2026-05-17T12:00:00.000Z'),
      transaction('usd-current', 'expense', '2026-05-18T12:00:00.000Z'),
    ];
    const transactionLines: TransactionLine[] = [
      line('previous-food', 'previous-expense', 'acct-a', -1000, 'food'),
      line('previous-income-line', 'previous-income', 'acct-a', 1000, 'income'),
      line('current-income', 'mixed-current', 'acct-a', 2000, 'income'),
      line('current-housing', 'mixed-current', 'acct-a', -500, 'housing'),
      line('transfer-line', 'transfer-current', 'acct-a', -9999, 'food'),
      line('other-account-line', 'other-account', 'acct-b', -600, 'housing'),
      line('usd-line', 'usd-current', 'acct-usd', -700, 'food', 'USD'),
    ];

    const expenseChanges = getStatsCategoryChanges({
      currentReport: buildReport('expense', currentRange, transactions, transactionLines),
      previousReport: buildReport('expense', previousRange, transactions, transactionLines),
    });
    const incomeChanges = getStatsCategoryChanges({
      currentReport: buildReport('income', currentRange, transactions, transactionLines),
      previousReport: buildReport('income', previousRange, transactions, transactionLines),
    });

    expect(expenseChanges.map((row) => [row.categoryId, row.currentMinor, row.previousMinor])).toEqual([
      ['food', 0, 1000],
      ['housing', 500, 0],
    ]);
    expect(incomeChanges).toEqual([
      expect.objectContaining({ categoryId: 'income', currentMinor: 2000, previousMinor: 1000 }),
    ]);
    expect(expenseChanges.some((row) => row.currentMinor === 9999 || row.currentMinor === 600 || row.currentMinor === 700)).toBe(false);

    const usdChanges = getStatsCategoryChanges({
      currentReport: buildReport('expense', currentRange, transactions, transactionLines, ['acct-usd'], 'USD'),
      previousReport: buildReport('expense', previousRange, transactions, transactionLines, ['acct-usd'], 'USD'),
    });
    expect(usdChanges).toEqual([
      expect.objectContaining({ categoryId: 'food', currentMinor: 700, previousMinor: 0 }),
    ]);
  });

  it('returns no rows when both periods have no category totals', () => {
    expect(getStatsCategoryChanges({
      currentReport: report('expense', []),
      previousReport: report('expense', []),
    })).toEqual([]);
  });
});

const accounts: Account[] = [
  account('acct-a', 'AUD'),
  account('acct-b', 'AUD'),
  account('acct-usd', 'USD'),
];

function buildReport(
  reportKind: StatsReportKind,
  range: ReturnType<typeof getInclusiveDateRange>,
  transactions: Transaction[],
  transactionLines: TransactionLine[],
  accountIds = ['acct-a'],
  currencyCode = 'AUD',
): StatsReport {
  return getStatsReport({
    reportKind,
    transactions,
    transactionLines,
    transactionLinks: [],
    accounts,
    categories: defaultCategories,
    range,
    currencyCode,
    accountIds,
  });
}

function report(reportKind: StatsReportKind, categoryRollups: StatsReportRollup[]): StatsReport {
  return {
    reportKind,
    currencyCode: 'AUD',
    rows: [],
    categoryRollups,
    subcategoryRollups: [],
    totalGrossAmountMinor: 0,
    totalNetAmountMinor: categoryRollups.reduce((sum, item) => sum + item.netAmountMinor, 0),
  };
}

function rollup(categoryId: string, label: string, netAmountMinor: number): StatsReportRollup {
  return {
    id: `category:${categoryId}`,
    reportKind: 'expense',
    kind: 'category',
    categoryId,
    label,
    icon: 'pricetag-outline',
    color: '#1876A8',
    grossAmountMinor: netAmountMinor,
    netAmountMinor,
    lineCount: netAmountMinor === 0 ? 0 : 1,
    percentage: 0,
    lineIds: [],
  };
}

function account(id: string, currencyCode: string): Account {
  return {
    id,
    name: id,
    nickname: '',
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

function transaction(id: string, kind: Transaction['kind'], datetime: string): Transaction {
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
  accountId: string,
  amountMinor: number,
  categoryId: string,
  currencyCode = 'AUD',
): TransactionLine {
  return {
    id,
    transactionId,
    accountId,
    amountMinor,
    currencyCode,
    categoryId,
    subcategoryId: categoryId === 'income' ? 'salary' : categoryId === 'housing' ? 'rent' : 'groceries',
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: '',
  };
}
