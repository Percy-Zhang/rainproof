import type { TransactionDisplayEntry } from '../aggregates';
import {
  filterTransactionDisplayEntriesBySearch,
  formatTransactionCurrencyTotals,
  getTransactionGroupCurrencyTotals,
  groupTransactionDisplayEntries,
} from '../transactionList';
import type { Account, Transaction, TransactionLine } from '../types';

const baseTransaction: Transaction = {
  id: 'tx-1',
  kind: 'expense',
  title: 'Groceries',
  datetime: '2026-05-18T12:00:00.000Z',
  notes: '',
  groupId: '',
  labels: [],
  createdAt: '2026-05-18T12:00:00.000Z',
  updatedAt: '2026-05-18T12:00:00.000Z',
};

const baseLine: TransactionLine = {
  id: 'line-1',
  transactionId: 'tx-1',
  accountId: 'a1',
  amountMinor: -1200,
  currencyCode: 'USD',
  categoryId: 'food-dining',
  subcategoryId: 'groceries',
  transferPeerAccountId: '',
  externalParty: '',
  note: '',
  createdAt: '2026-05-18T12:00:00.000Z',
};

const accounts: Account[] = [
  {
    id: 'a1',
    name: 'Everyday Checking',
    nickname: 'Daily',
    type: 'checking',
    currencyCode: 'USD',
    openingBalanceMinor: 0,
    notes: '',
    institutionName: '',
    includeInRainyDay: true,
    themeColor: '#1876A8',
    iconName: 'wallet-outline',
    showOnDashboard: true,
    sortOrder: 0,
    isArchived: false,
    createdAt: '2026-05-18T12:00:00.000Z',
    updatedAt: '2026-05-18T12:00:00.000Z',
  },
  {
    id: 'a2',
    name: 'Savings',
    nickname: '',
    type: 'savings',
    currencyCode: 'USD',
    openingBalanceMinor: 0,
    notes: '',
    institutionName: '',
    includeInRainyDay: true,
    themeColor: '#2F8F64',
    iconName: 'leaf-outline',
    showOnDashboard: true,
    sortOrder: 1,
    isArchived: false,
    createdAt: '2026-05-18T12:00:00.000Z',
    updatedAt: '2026-05-18T12:00:00.000Z',
  },
];

function entry(overrides: Partial<TransactionDisplayEntry>): TransactionDisplayEntry {
  return {
    id: overrides.id ?? 'entry-1',
    accountId: overrides.accountId ?? 'a1',
    transaction: overrides.transaction ?? baseTransaction,
    lines: overrides.lines ?? [baseLine],
    amountMinor: overrides.amountMinor ?? -1200,
    currencyCode: overrides.currencyCode ?? 'USD',
  };
}

function search(entries: TransactionDisplayEntry[], query: string): string[] {
  return filterTransactionDisplayEntriesBySearch({ entries, query, accounts }).map((item) => item.id);
}

describe('transaction list helpers', () => {
  it('groups entries by the requested transaction date granularity', () => {
    const groups = groupTransactionDisplayEntries(
      [
        entry({ id: 'newer', transaction: { ...baseTransaction, id: 'tx-2', datetime: '2026-05-19T12:00:00.000Z' } }),
        entry({ id: 'older', transaction: baseTransaction }),
      ],
      'day',
    );

    expect(groups.map((group) => group.label)).toEqual(['May 19', 'May 18']);
    expect(groups.map((group) => group.entries.map((item) => item.id))).toEqual([['newer'], ['older']]);
  });

  it('totals grouped transactions by currency with deterministic currency ordering', () => {
    const totals = getTransactionGroupCurrencyTotals([
      entry({ id: 'usd-1', amountMinor: -1200, currencyCode: 'USD' }),
      entry({ id: 'aud-1', amountMinor: 700, currencyCode: 'AUD' }),
      entry({ id: 'usd-2', amountMinor: 200, currencyCode: 'USD' }),
    ]);

    expect(totals).toEqual([
      { currencyCode: 'AUD', amountMinor: 700 },
      { currencyCode: 'USD', amountMinor: -1000 },
    ]);
  });

  it('formats empty and populated currency totals for group headers', () => {
    expect(formatTransactionCurrencyTotals([], false)).toBe('$0.00');
    expect(formatTransactionCurrencyTotals([{ currencyCode: 'USD', amountMinor: -1000 }], true)).toBe('(USD $10.00)');
  });

  it('searches transactions by item name case-insensitively', () => {
    const entries = [
      entry({ id: 'groceries', transaction: { ...baseTransaction, title: 'Weekly Groceries' } }),
      entry({ id: 'rent', transaction: { ...baseTransaction, id: 'tx-2', title: 'Rent' } }),
    ];

    expect(search(entries, 'WEEKLY')).toEqual(['groceries']);
    expect(search(entries, '')).toEqual(['groceries', 'rent']);
  });

  it('searches split line notes and category fields', () => {
    const splitEntry = entry({
      id: 'split',
      lines: [
        {
          ...baseLine,
          id: 'line-food',
          categoryId: 'food',
          subcategoryId: 'groceries',
          note: 'Weekly food shop',
        },
        {
          ...baseLine,
          id: 'line-home',
          categoryId: 'shopping',
          subcategoryId: 'home-goods',
          note: 'Cleaning supplies',
        },
      ],
    });

    expect(search([splitEntry], 'cleaning')).toEqual(['split']);
    expect(search([splitEntry], 'home goods')).toEqual(['split']);
    expect(search([splitEntry], 'food dining')).toEqual(['split']);
  });

  it('searches visible account names on already-filtered entries', () => {
    const visibleEntry = entry({
      id: 'visible',
      accountId: 'a2',
      lines: [{ ...baseLine, accountId: 'a2' }],
    });
    const hiddenByExistingFilters = entry({
      id: 'hidden',
      lines: [{ ...baseLine, accountId: 'a1' }],
    });

    expect(search([visibleEntry], 'savings')).toEqual(['visible']);
    expect(search([visibleEntry], 'daily')).toEqual([]);
    expect(search([visibleEntry, hiddenByExistingFilters], 'daily')).toEqual(['hidden']);
  });
});
