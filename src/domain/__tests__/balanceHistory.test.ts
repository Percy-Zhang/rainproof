import { getAccountBalances } from '../aggregates';
import { getBalanceHistoryPoints } from '../balanceHistory';
import { getInclusiveDateRange, parseDateTimeInput } from '../dates';
import type { Account, Transaction, TransactionLine } from '../types';

describe('balance history helpers', () => {
  it('derives daily history for one selected account with only income', () => {
    const accounts = [account('checking', { openingBalanceMinor: 1000 })];
    const transactions = [transaction('income', 'income', '2026-05-02')];
    const lines = [line('income-line', 'income', 'checking', 500)];

    expect(history({ accounts, transactions, lines, accountIds: ['checking'], endDate: '2026-05-03' })).toEqual([
      point('2026-05-01', 1000),
      point('2026-05-02', 1500),
      point('2026-05-03', 1500),
    ]);
  });

  it('derives daily history for one selected account with only expenses', () => {
    const accounts = [account('checking', { openingBalanceMinor: 1000 })];
    const transactions = [transaction('expense', 'expense', '2026-05-02')];
    const lines = [line('expense-line', 'expense', 'checking', -300)];

    expect(history({ accounts, transactions, lines, accountIds: ['checking'], endDate: '2026-05-03' })).toEqual([
      point('2026-05-01', 1000),
      point('2026-05-02', 700),
      point('2026-05-03', 700),
    ]);
  });

  it('combines mixed income and expenses and carries balances through quiet days', () => {
    const accounts = [account('checking', { openingBalanceMinor: 1000 })];
    const transactions = [
      transaction('income', 'income', '2026-05-02'),
      transaction('expense', 'expense', '2026-05-03'),
    ];
    const lines = [
      line('income-line', 'income', 'checking', 500),
      line('expense-line', 'expense', 'checking', -200),
    ];

    expect(history({ accounts, transactions, lines, accountIds: ['checking'], endDate: '2026-05-04' })).toEqual([
      point('2026-05-01', 1000),
      point('2026-05-02', 1500),
      point('2026-05-03', 1300),
      point('2026-05-04', 1300),
    ]);
  });

  it('combines multiple selected same-currency accounts', () => {
    const accounts = [
      account('checking', { openingBalanceMinor: 1000 }),
      account('savings', { openingBalanceMinor: 2000 }),
    ];
    const transactions = [
      transaction('income', 'income', '2026-05-02'),
      transaction('expense', 'expense', '2026-05-03'),
    ];
    const lines = [
      line('income-line', 'income', 'checking', 500),
      line('expense-line', 'expense', 'savings', -300),
    ];

    expect(history({ accounts, transactions, lines, accountIds: ['checking', 'savings'], endDate: '2026-05-04' })).toEqual([
      point('2026-05-01', 3000),
      point('2026-05-02', 3500),
      point('2026-05-03', 3200),
      point('2026-05-04', 3200),
    ]);
  });

  it('applies only the selected side of a same-currency transfer', () => {
    const accounts = [
      account('checking', { openingBalanceMinor: 1000 }),
      account('savings', { openingBalanceMinor: 500 }),
    ];
    const transactions = [transaction('transfer', 'transfer', '2026-05-02')];
    const lines = [
      line('transfer-out', 'transfer', 'checking', -200, { transferPeerAccountId: 'savings' }),
      line('transfer-in', 'transfer', 'savings', 200, { transferPeerAccountId: 'checking' }),
    ];

    expect(history({ accounts, transactions, lines, accountIds: ['checking'], endDate: '2026-05-03' })).toEqual([
      point('2026-05-01', 1000),
      point('2026-05-02', 800),
      point('2026-05-03', 800),
    ]);
    expect(history({ accounts, transactions, lines, accountIds: ['savings'], endDate: '2026-05-03' })).toEqual([
      point('2026-05-01', 500),
      point('2026-05-02', 700),
      point('2026-05-03', 700),
    ]);
  });

  it('nets same-currency transfers between selected accounts to zero', () => {
    const accounts = [
      account('checking', { openingBalanceMinor: 1000 }),
      account('savings', { openingBalanceMinor: 2000 }),
    ];
    const transactions = [transaction('transfer', 'transfer', '2026-05-02')];
    const lines = [
      line('transfer-out', 'transfer', 'checking', -200, { transferPeerAccountId: 'savings' }),
      line('transfer-in', 'transfer', 'savings', 200, { transferPeerAccountId: 'checking' }),
    ];

    expect(history({ accounts, transactions, lines, accountIds: ['checking', 'savings'], endDate: '2026-05-03' })).toEqual([
      point('2026-05-01', 3000),
      point('2026-05-02', 3000),
      point('2026-05-03', 3000),
    ]);
  });

  it('uses the actual selected-currency side of a cross-currency transfer', () => {
    const accounts = [
      account('aud-checking', { currencyCode: 'AUD', openingBalanceMinor: 5000 }),
      account('usd-wallet', { currencyCode: 'USD', openingBalanceMinor: 500 }),
    ];
    const transactions = [transaction('transfer', 'transfer', '2026-05-02')];
    const lines = [
      line('transfer-out', 'transfer', 'aud-checking', -1700, {
        currencyCode: 'AUD',
        transferPeerAccountId: 'usd-wallet',
      }),
      line('transfer-in', 'transfer', 'usd-wallet', 1100, {
        currencyCode: 'USD',
        transferPeerAccountId: 'aud-checking',
      }),
    ];

    expect(
      history({
        accounts,
        transactions,
        lines,
        accountIds: ['aud-checking', 'usd-wallet'],
        currencyCode: 'USD',
        endDate: '2026-05-03',
      }),
    ).toEqual([
      point('2026-05-01', 500),
      point('2026-05-02', 1600),
      point('2026-05-03', 1600),
    ]);
  });

  it('counts split transaction lines once as account-level movement', () => {
    const accounts = [account('checking', { openingBalanceMinor: 1000 })];
    const transactions = [transaction('split-expense', 'expense', '2026-05-02')];
    const lines = [
      line('split-food', 'split-expense', 'checking', -300),
      line('split-home', 'split-expense', 'checking', -200),
    ];

    expect(history({ accounts, transactions, lines, accountIds: ['checking'], endDate: '2026-05-03' })).toEqual([
      point('2026-05-01', 1000),
      point('2026-05-02', 500),
      point('2026-05-03', 500),
    ]);
  });

  it('counts mixed split transaction lines once as net account-level movement', () => {
    const accounts = [account('checking', { openingBalanceMinor: 1000 })];
    const transactions = [transaction('mixed-pay', 'income', '2026-05-02')];
    const lines = [
      line('salary', 'mixed-pay', 'checking', 1000),
      line('tax', 'mixed-pay', 'checking', -300),
    ];

    expect(history({ accounts, transactions, lines, accountIds: ['checking'], endDate: '2026-05-03' })).toEqual([
      point('2026-05-01', 1000),
      point('2026-05-02', 1700),
      point('2026-05-03', 1700),
    ]);
  });

  it('supports negative balances without clamping', () => {
    const accounts = [account('checking', { openingBalanceMinor: 100 })];
    const transactions = [transaction('expense', 'expense', '2026-05-02')];
    const lines = [line('expense-line', 'expense', 'checking', -250)];

    expect(history({ accounts, transactions, lines, accountIds: ['checking'], endDate: '2026-05-03' })).toEqual([
      point('2026-05-01', 100),
      point('2026-05-02', -150),
      point('2026-05-03', -150),
    ]);
  });

  it('uses inclusive day boundaries and excludes transactions at the exclusive range end', () => {
    const accounts = [account('checking', { openingBalanceMinor: 1000 })];
    const transactions = [
      transaction('start-boundary', 'income', '2026-05-01', '00:00'),
      transaction('end-day', 'expense', '2026-05-03', '23:59'),
      transaction('exclusive-end', 'income', '2026-05-04', '00:00'),
    ];
    const lines = [
      line('start-line', 'start-boundary', 'checking', 100),
      line('end-day-line', 'end-day', 'checking', -50),
      line('exclusive-end-line', 'exclusive-end', 'checking', 999),
    ];

    expect(history({ accounts, transactions, lines, accountIds: ['checking'], endDate: '2026-05-03' })).toEqual([
      point('2026-05-01', 1100),
      point('2026-05-02', 1100),
      point('2026-05-03', 1050),
    ]);
  });

  it('caps points at now when the selected range extends into the future', () => {
    const accounts = [account('checking', { openingBalanceMinor: 1000 })];

    expect(history({
      accounts,
      transactions: [],
      lines: [],
      accountIds: ['checking'],
      endDate: '2026-05-10',
      now: new Date(2026, 4, 3, 12),
    })).toEqual([
      point('2026-05-01', 1000),
      point('2026-05-02', 1000),
      point('2026-05-03', 1000),
    ]);
  });

  it('reconciles the current-day endpoint with the current selected combined balance', () => {
    const accounts = [
      account('checking', { openingBalanceMinor: 1000 }),
      account('savings', { openingBalanceMinor: 2000 }),
    ];
    const transactions = [
      transaction('income', 'income', '2026-05-02'),
      transaction('expense', 'expense', '2026-05-04'),
    ];
    const lines = [
      line('income-line', 'income', 'checking', 500),
      line('expense-line', 'expense', 'savings', -200),
    ];
    const points = history({
      accounts,
      transactions,
      lines,
      accountIds: ['checking', 'savings'],
      endDate: '2026-05-04',
    });
    const currentSelectedBalance = getAccountBalances(accounts, lines)
      .filter((balance) => ['checking', 'savings'].includes(balance.account.id))
      .reduce((sum, balance) => sum + balance.balanceMinor, 0);

    expect(points.at(-1)).toEqual(point('2026-05-04', currentSelectedBalance));
  });

  it('returns no points when no selected accounts are eligible for the active currency', () => {
    const accounts = [account('checking', { currencyCode: 'AUD', openingBalanceMinor: 1000 })];

    expect(history({ accounts, transactions: [], lines: [], accountIds: ['checking'], currencyCode: 'USD' })).toEqual([]);
    expect(history({ accounts, transactions: [], lines: [], accountIds: [] })).toEqual([]);
  });

  it('includes hidden accounts but excludes archived and missing accounts like current balances', () => {
    const accounts = [
      account('hidden', { openingBalanceMinor: 100, showOnDashboard: false }),
      account('archived', { openingBalanceMinor: 1000, isArchived: true }),
    ];
    const transactions = [
      transaction('hidden-income', 'income', '2026-05-02'),
      transaction('archived-income', 'income', '2026-05-02'),
      transaction('missing-income', 'income', '2026-05-02'),
    ];
    const lines = [
      line('hidden-line', 'hidden-income', 'hidden', 50),
      line('archived-line', 'archived-income', 'archived', 1000),
      line('missing-line', 'missing-income', 'missing', 2000),
    ];

    expect(history({
      accounts,
      transactions,
      lines,
      accountIds: ['hidden', 'archived', 'missing'],
      endDate: '2026-05-03',
    })).toEqual([
      point('2026-05-01', 100),
      point('2026-05-02', 150),
      point('2026-05-03', 150),
    ]);
    expect(history({ accounts, transactions, lines, accountIds: ['archived'], endDate: '2026-05-03' })).toEqual([]);
  });
});

function history({
  accounts,
  transactions,
  lines,
  accountIds,
  currencyCode = 'AUD',
  startDate = '2026-05-01',
  endDate = '2026-05-03',
  now = new Date(2026, 4, 4, 12),
}: {
  accounts: Account[];
  transactions: Transaction[];
  lines: TransactionLine[];
  accountIds: string[];
  currencyCode?: string;
  startDate?: string;
  endDate?: string;
  now?: Date;
}) {
  return getBalanceHistoryPoints({
    accounts,
    transactions,
    transactionLines: lines,
    accountIds,
    currencyCode,
    range: getInclusiveDateRange(startDate, endDate),
    now,
  });
}

function point(date: string, balanceMinor: number) {
  return { date, balanceMinor };
}

function account(id: string, overrides: Partial<Account> = {}): Account {
  return {
    id,
    name: id,
    nickname: '',
    type: 'checking',
    currencyCode: 'AUD',
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
    ...overrides,
  };
}

function transaction(
  id: string,
  kind: Transaction['kind'],
  date: string,
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
  accountId: string,
  amountMinor: number,
  overrides: Partial<TransactionLine> = {},
): TransactionLine {
  return {
    id,
    transactionId,
    accountId,
    amountMinor,
    currencyCode: 'AUD',
    categoryId: amountMinor >= 0 ? 'income' : 'food',
    subcategoryId: amountMinor >= 0 ? 'salary' : 'groceries',
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: '',
    ...overrides,
  };
}
