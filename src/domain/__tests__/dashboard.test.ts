import {
  getDashboardAccountPreview,
  getDashboardInitialSelectedAccountIds,
  getDashboardRecentTransactions,
  getDashboardSelectedAccountIds,
  toggleDashboardAccountSelection,
} from '../dashboard';
import type { Account, AccountBalance, AppSnapshot, Transaction, TransactionLine } from '../types';

function account(id: string, sortOrder: number): Account {
  return {
    id,
    name: `Account ${id}`,
    nickname: '',
    type: 'checking',
    currencyCode: 'AUD',
    openingBalanceMinor: 0,
    notes: '',
    institutionName: '',
    includeInRainyDay: true,
    themeColor: '#1876A8',
    iconName: 'business-outline',
    showOnDashboard: true,
    sortOrder,
    isArchived: false,
    createdAt: '',
    updatedAt: '',
  };
}

function accountBalance(id: string, sortOrder: number): AccountBalance {
  return {
    account: account(id, sortOrder),
    balanceMinor: 1000,
  };
}

function transaction(id: string, datetime: string, kind: Transaction['kind'] = 'expense', createdAt = ''): Transaction {
  return {
    id,
    kind,
    title: id,
    datetime,
    notes: '',
    labels: [],
    groupId: '',
    createdAt,
    updatedAt: '',
  };
}

function line(
  transactionId: string,
  accountId: string,
  overrides: Partial<TransactionLine> = {},
): TransactionLine {
  return {
    id: `${transactionId}-${accountId}-line`,
    transactionId,
    accountId,
    amountMinor: -100,
    currencyCode: 'AUD',
    categoryId: 'food',
    subcategoryId: 'Groceries',
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: '',
    ...overrides,
  };
}

function snapshot(accounts: Account[], transactions: Transaction[], transactionLines: TransactionLine[]): AppSnapshot {
  return {
    defaultCurrencyCode: 'AUD',
    settings: {
      defaultCurrencyCode: 'AUD',
      defaultCurrencyMode: 'auto',
      multiCurrencyEnabled: false,
      enabledCurrencyCodes: ['AUD'],
      dashboardSelectedAccountIds: null,
    },
    accounts,
    transactions,
    transactionLines,
    transactionLinks: [],
    budgets: [],
    recurringBills: [],
    rainyDayFund: {
      id: 'fund-1',
      name: 'Rainy day',
      currencyCode: 'AUD',
      goalMinor: 100000,
      linkedAccountIds: [],
      createdAt: '',
      updatedAt: '',
    },
  };
}

describe('dashboard helpers', () => {
  it('returns all dashboard-visible accounts for the dashboard preview', () => {
    const balances = [
      accountBalance('a1', 0),
      accountBalance('a2', 1),
      accountBalance('a3', 2),
      accountBalance('a4', 3),
      accountBalance('a5', 4),
    ];
    const preview = getDashboardAccountPreview(balances);

    expect(preview.map(({ account: item }) => item.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
    expect(getDashboardInitialSelectedAccountIds(balances)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
  });

  it('does not include archived or dashboard-hidden accounts in the preview', () => {
    const hiddenBalance = accountBalance('hidden', 1);
    hiddenBalance.account.showOnDashboard = false;
    const archivedBalance = accountBalance('archived', 2);
    archivedBalance.account.isArchived = true;
    const balances = [
      accountBalance('a1', 0),
      hiddenBalance,
      archivedBalance,
      accountBalance('a2', 3),
    ];

    expect(getDashboardAccountPreview(balances).map(({ account: item }) => item.id)).toEqual(['a1', 'a2']);
    expect(getDashboardInitialSelectedAccountIds(balances)).toEqual(['a1', 'a2']);
  });

  it('restores stored dashboard selections only within the account preview', () => {
    const balances = [
      accountBalance('a1', 0),
      accountBalance('a2', 1),
      accountBalance('a3', 2),
      accountBalance('a4', 3),
      accountBalance('a5', 4),
    ];

    expect(getDashboardSelectedAccountIds(balances, null)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
    expect(getDashboardSelectedAccountIds(balances, ['a2', 'a5'])).toEqual(['a2', 'a5']);
    expect(getDashboardSelectedAccountIds(balances, [])).toEqual([]);
  });

  it('drops stored dashboard selections for hidden or archived accounts', () => {
    const hiddenBalance = accountBalance('hidden', 1);
    hiddenBalance.account.showOnDashboard = false;
    const archivedBalance = accountBalance('archived', 2);
    archivedBalance.account.isArchived = true;
    const balances = [
      accountBalance('a1', 0),
      hiddenBalance,
      archivedBalance,
    ];

    expect(getDashboardSelectedAccountIds(balances, ['a1', 'hidden', 'archived'])).toEqual(['a1']);
  });

  it('filters recent transactions by selected accounts', () => {
    const accounts = [account('a1', 0), account('a2', 1)];
    const tx1 = transaction('tx-1', new Date(2026, 4, 18, 9).toISOString());
    const tx2 = transaction('tx-2', new Date(2026, 4, 19, 9).toISOString());

    const recent = getDashboardRecentTransactions({
      previewAccountIds: ['a1', 'a2'],
      snapshot: snapshot(accounts, [tx1, tx2], [line('tx-1', 'a1'), line('tx-2', 'a2')]),
      selectedAccountIds: ['a1'],
    });

    expect(recent.map((entry) => entry.transaction.id)).toEqual(['tx-1']);
  });

  it('sorts recent transactions globally before taking the latest five', () => {
    const accounts = [account('a1', 0), account('a2', 1)];
    const transactions = [
      transaction('older', new Date(2026, 4, 16, 9).toISOString()),
      transaction('newest', new Date(2026, 4, 22, 9).toISOString()),
      transaction('mid-1', new Date(2026, 4, 19, 9).toISOString()),
      transaction('mid-2', new Date(2026, 4, 20, 9).toISOString()),
      transaction('mid-3', new Date(2026, 4, 18, 9).toISOString()),
      transaction('mid-4', new Date(2026, 4, 21, 9).toISOString()),
    ];

    const recent = getDashboardRecentTransactions({
      previewAccountIds: ['a1', 'a2'],
      snapshot: snapshot(accounts, transactions, transactions.map((item) => line(item.id, item.id === 'older' ? 'a2' : 'a1'))),
      selectedAccountIds: ['a1', 'a2'],
    });

    expect(recent.map((entry) => entry.transaction.id)).toEqual(['newest', 'mid-4', 'mid-2', 'mid-1', 'mid-3']);
  });

  it('counts split child lines under a parent transaction outside the recent limit', () => {
    const accounts = [account('a1', 0)];
    const transactions = [
      transaction('newest', new Date(2026, 4, 22, 9).toISOString()),
      transaction('split-income', new Date(2026, 4, 21, 9).toISOString(), 'income'),
      transaction('mid-2', new Date(2026, 4, 20, 9).toISOString()),
      transaction('mid-1', new Date(2026, 4, 19, 9).toISOString()),
      transaction('mid-3', new Date(2026, 4, 18, 9).toISOString()),
      transaction('older', new Date(2026, 4, 16, 9).toISOString()),
    ];

    const recent = getDashboardRecentTransactions({
      previewAccountIds: ['a1'],
      snapshot: snapshot(accounts, transactions, [
        line('newest', 'a1'),
        line('split-income', 'a1', { id: 'salary-line', amountMinor: 1200, categoryId: 'income', subcategoryId: 'salary' }),
        line('split-income', 'a1', { id: 'bonus-line', amountMinor: 3400, categoryId: 'income', subcategoryId: 'bonus' }),
        line('split-income', 'a1', { id: 'interest-line', amountMinor: 400, categoryId: 'income', subcategoryId: 'interest' }),
        line('mid-2', 'a1'),
        line('mid-1', 'a1'),
        line('mid-3', 'a1'),
        line('older', 'a1'),
      ]),
      selectedAccountIds: ['a1'],
    });

    expect(recent.map((entry) => entry.transaction.id)).toEqual(['newest', 'split-income', 'mid-2', 'mid-1', 'mid-3']);
    expect(recent[1].lines.map((item) => item.id)).toEqual(['salary-line', 'bonus-line', 'interest-line']);
  });

  it('shows one recent row per transfer and uses the source leg when both accounts are visible', () => {
    const accounts = [account('a1', 0), account('a2', 1)];
    const transfer = transaction('transfer', new Date(2026, 4, 23, 9).toISOString(), 'transfer');

    const recent = getDashboardRecentTransactions({
      previewAccountIds: ['a1', 'a2'],
      snapshot: snapshot(accounts, [transfer], [
        line('transfer', 'a1', { amountMinor: -3500, transferPeerAccountId: 'a2' }),
        line('transfer', 'a2', { amountMinor: 3500, transferPeerAccountId: 'a1' }),
      ]),
      selectedAccountIds: ['a1', 'a2'],
    });

    expect(recent).toHaveLength(1);
    expect(recent[0]).toEqual(expect.objectContaining({ accountId: 'a1', amountMinor: -3500 }));
  });

  it('shows one recent row per split expense instead of duplicating split lines', () => {
    const accounts = [account('a1', 0)];
    const splitExpense = transaction('split', new Date(2026, 4, 23, 9).toISOString());

    const recent = getDashboardRecentTransactions({
      previewAccountIds: ['a1'],
      snapshot: snapshot(accounts, [splitExpense], [
        line('split', 'a1', { id: 'food-line', amountMinor: -1500, categoryId: 'food' }),
        line('split', 'a1', { id: 'housing-line', amountMinor: -3000, categoryId: 'housing' }),
      ]),
      selectedAccountIds: ['a1'],
    });

    expect(recent).toHaveLength(1);
    expect(recent[0]).toEqual(expect.objectContaining({ id: 'split', amountMinor: -4500 }));
    expect(recent[0].lines.map((item) => item.id)).toEqual(['food-line', 'housing-line']);
  });

  it('uses the target transfer leg when only the target account is selected', () => {
    const accounts = [account('a1', 0), account('a2', 1)];
    const transfer = transaction('transfer', new Date(2026, 4, 23, 9).toISOString(), 'transfer');

    const recent = getDashboardRecentTransactions({
      previewAccountIds: ['a1', 'a2'],
      snapshot: snapshot(accounts, [transfer], [
        line('transfer', 'a1', { amountMinor: -3500, transferPeerAccountId: 'a2' }),
        line('transfer', 'a2', { amountMinor: 3500, transferPeerAccountId: 'a1' }),
      ]),
      selectedAccountIds: ['a2'],
    });

    expect(recent).toHaveLength(1);
    expect(recent[0]).toEqual(expect.objectContaining({ accountId: 'a2', amountMinor: 3500 }));
  });

  it('does not show transactions from accounts outside the dashboard preview', () => {
    const accounts = [
      account('a1', 0),
      account('a2', 1),
      account('a3', 2),
      account('a4', 3),
      account('a5', 4),
    ];
    const tx1 = transaction('tx-1', new Date(2026, 4, 18, 9).toISOString());
    const tx2 = transaction('tx-2', new Date(2026, 4, 19, 9).toISOString());

    const recent = getDashboardRecentTransactions({
      previewAccountIds: ['a1', 'a2', 'a3', 'a4'],
      snapshot: snapshot(accounts, [tx1, tx2], [line('tx-1', 'a1'), line('tx-2', 'a5')]),
      selectedAccountIds: ['a1', 'a5'],
    });

    expect(recent.map((entry) => entry.transaction.id)).toEqual(['tx-1']);
  });

  it('shows no transactions when all preview accounts are unselected', () => {
    const accounts = [account('a1', 0), account('a2', 1)];
    const tx1 = transaction('tx-1', new Date(2026, 4, 18, 9).toISOString());

    const recent = getDashboardRecentTransactions({
      previewAccountIds: ['a1', 'a2'],
      snapshot: snapshot(accounts, [tx1], [line('tx-1', 'a1')]),
      selectedAccountIds: [],
    });

    expect(recent).toEqual([]);
  });

  it('toggles individual accounts', () => {
    const balances = [
      accountBalance('a1', 0),
      accountBalance('a2', 1),
      accountBalance('a3', 2),
      accountBalance('a4', 3),
      accountBalance('a5', 4),
    ];
    const initial = getDashboardInitialSelectedAccountIds(balances);

    expect(initial).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
    expect(toggleDashboardAccountSelection(initial, 'a1')).toEqual(['a2', 'a3', 'a4', 'a5']);
  });
});
