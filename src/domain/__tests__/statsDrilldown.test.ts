import {
  getStatsDrilldownData,
  getStatsDrilldownOpenTransactionId,
  groupStatsDrilldownParentRows,
} from '../statsDrilldown';
import { getStatsReport, type StatsReportLineRow } from '../statsReports';
import type { Account, Transaction, TransactionLine } from '../types';

const range = {
  startIso: '2026-05-01T00:00:00.000Z',
  endIso: '2026-06-01T00:00:00.000Z',
};

const accounts: Account[] = [
  account('daily', 'Daily Checking', 'Daily', 'AUD'),
  account('bills', 'Bills Account', '', 'AUD'),
  account('usd', 'USD Cash', '', 'USD'),
];

const transactions: Transaction[] = [
  transaction('split-grocery', 'expense', 'Woolworths', '2026-05-20T10:00:00.000Z'),
  transaction('cafe', 'expense', 'Cafe', '2026-05-18T10:00:00.000Z'),
  transaction('fuel', 'expense', 'Fuel Stop', '2026-05-22T10:00:00.000Z'),
  transaction('old', 'expense', 'Old Food', '2026-04-20T10:00:00.000Z'),
  transaction('usd-food', 'expense', 'USD Food', '2026-05-19T10:00:00.000Z'),
];

const lines: TransactionLine[] = [
  line('groceries', 'split-grocery', -5000, 'food', 'groceries', 'daily', 'AUD', 'Weekly shop'),
  line('restaurants', 'split-grocery', -3000, 'food', 'restaurants', 'daily', 'AUD', 'Lunch kit'),
  line('cafe-line', 'cafe', -2000, 'food', 'restaurants', 'daily', 'AUD', 'Coffee'),
  line('fuel-line', 'fuel', -1000, 'transport', 'fuel', 'bills', 'AUD', 'Petrol'),
  line('old-line', 'old', -900, 'food', 'groceries', 'daily', 'AUD'),
  line('usd-line', 'usd-food', -1200, 'food', 'groceries', 'usd', 'USD'),
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
  datetime: string,
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

function line(
  id: string,
  transactionId: string,
  amountMinor: number,
  categoryId: string,
  subcategoryId: string,
  accountId = 'daily',
  currencyCode = 'AUD',
  note = '',
): TransactionLine {
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

function report(overrides: Partial<Parameters<typeof getStatsReport>[0]> = {}) {
  return getStatsReport({
    reportKind: 'expense',
    transactions,
    transactionLines: lines,
    transactionLinks: [],
    accounts,
    range,
    currencyCode: 'AUD',
    ...overrides,
  });
}

function ids(rows: (StatsReportLineRow | { transactionId: string })[]): string[] {
  return rows.map((row) => ('lineId' in row ? row.lineId : row.transactionId));
}

describe('stats drilldown helpers', () => {
  it('returns category drilldown data using current report filters', () => {
    const data = getStatsDrilldownData({
      report: report(),
      categoryId: 'food',
    });

    expect(ids(data.lineRows)).toEqual(['groceries', 'restaurants', 'cafe-line']);
    expect(ids(data.parentRows)).toEqual(['split-grocery', 'cafe']);
  });

  it('returns subcategory drilldown data', () => {
    const data = getStatsDrilldownData({
      report: report(),
      categoryId: 'food',
      subcategoryId: 'restaurants',
      sort: 'date_oldest',
    });

    expect(ids(data.lineRows)).toEqual(['cafe-line', 'restaurants']);
    expect(ids(data.parentRows)).toEqual(['cafe', 'split-grocery']);
  });

  it('respects account and currency filters from the report', () => {
    expect(
      ids(getStatsDrilldownData({ report: report({ accountIds: ['bills'] }), categoryId: 'transport' }).lineRows),
    ).toEqual(['fuel-line']);
    expect(
      ids(getStatsDrilldownData({ report: report({ accountIds: ['bills'] }), categoryId: 'food' }).lineRows),
    ).toEqual([]);
    expect(
      ids(getStatsDrilldownData({ report: report({ currencyCode: 'USD' }), categoryId: 'food' }).lineRows),
    ).toEqual(['usd-line']);
  });

  it('groups multiple matching split lines under one parent transaction', () => {
    const parentRows = groupStatsDrilldownParentRows(report().rows.filter((row) => row.categoryId === 'food'));

    expect(parentRows.find((row) => row.transactionId === 'split-grocery')).toEqual(
      expect.objectContaining({
        lineCount: 2,
        grossAmountMinor: 8000,
        netAmountMinor: 8000,
      }),
    );
  });

  it('sorts parent rows by amount and item name', () => {
    expect(ids(getStatsDrilldownData({ report: report(), categoryId: 'food', sort: 'net_amount_highest' }).parentRows)).toEqual([
      'split-grocery',
      'cafe',
    ]);
    expect(ids(getStatsDrilldownData({ report: report(), categoryId: 'food', sort: 'item_az' }).parentRows)).toEqual([
      'cafe',
      'split-grocery',
    ]);
  });

  it('opens the parent transaction id for parent and line rows', () => {
    const data = getStatsDrilldownData({ report: report(), categoryId: 'food' });

    expect(getStatsDrilldownOpenTransactionId(data.lineRows[0])).toBe('split-grocery');
    expect(getStatsDrilldownOpenTransactionId(data.parentRows[0])).toBe('split-grocery');
  });
});
