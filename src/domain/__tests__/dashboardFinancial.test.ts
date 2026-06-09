import {
  getDashboardBalanceTotals,
  getDashboardCashFlowByCurrency,
  getDashboardTopSpendingByCurrency,
} from '../dashboardFinancial';
import type { Account, AccountBalance, DateRange, Transaction, TransactionLine } from '../types';

const now = '2026-05-15T12:00:00.000Z';
const range: DateRange = {
  startIso: '2026-05-01T00:00:00.000Z',
  endIso: '2026-06-01T00:00:00.000Z',
};

describe('dashboard financial card helpers', () => {
  it('groups balance summary totals by currency for selected dashboard accounts', () => {
    const balances: AccountBalance[] = [
      { account: account({ id: 'aud_1', currencyCode: 'AUD' }), balanceMinor: 120000 },
      { account: account({ id: 'aud_2', currencyCode: 'AUD' }), balanceMinor: 5000 },
      { account: account({ id: 'usd_1', currencyCode: 'USD' }), balanceMinor: 32000 },
      { account: account({ id: 'jpy_1', currencyCode: 'JPY' }), balanceMinor: 1200000 },
    ];

    expect(getDashboardBalanceTotals({ accountBalances: balances })).toEqual([
      { currencyCode: 'AUD', amountMinor: 125000 },
      { currencyCode: 'JPY', amountMinor: 1200000 },
      { currencyCode: 'USD', amountMinor: 32000 },
    ]);
    expect(getDashboardBalanceTotals({ accountBalances: balances, selectedAccountIds: ['aud_1', 'usd_1'] })).toEqual([
      { currencyCode: 'AUD', amountMinor: 120000 },
      { currencyCode: 'USD', amountMinor: 32000 },
    ]);
  });

  it('groups this-month income and spending by currency and excludes transfers', () => {
    const transactions = [
      transaction({ id: 'aud_income', kind: 'income' }),
      transaction({ id: 'aud_expense', kind: 'expense' }),
      transaction({ id: 'usd_expense', kind: 'expense' }),
      transaction({ id: 'transfer', kind: 'transfer' }),
    ];
    const lines = [
      line({ id: 'aud_income_line', transactionId: 'aud_income', amountMinor: 320000, currencyCode: 'AUD' }),
      line({ id: 'aud_food', transactionId: 'aud_expense', amountMinor: -80000, currencyCode: 'AUD', categoryId: 'food' }),
      line({
        id: 'aud_transport',
        transactionId: 'aud_expense',
        amountMinor: -4000,
        currencyCode: 'AUD',
        categoryId: 'transport',
      }),
      line({ id: 'usd_subscription', transactionId: 'usd_expense', amountMinor: -4500, currencyCode: 'USD' }),
      line({ id: 'transfer_out', transactionId: 'transfer', amountMinor: -10000, currencyCode: 'AUD' }),
      line({ id: 'transfer_in', transactionId: 'transfer', amountMinor: 10000, currencyCode: 'AUD' }),
    ];

    expect(getDashboardCashFlowByCurrency({ transactions, lines, range })).toEqual([
      { currencyCode: 'AUD', incomeMinor: 320000, expenseMinor: 84000, netMinor: 236000 },
      { currencyCode: 'USD', incomeMinor: 0, expenseMinor: 4500, netMinor: -4500 },
    ]);
  });

  it('keeps top spending grouped by currency and counts split expense lines', () => {
    const transactions = [
      transaction({ id: 'aud_expense', kind: 'expense' }),
      transaction({ id: 'usd_expense', kind: 'expense' }),
      transaction({ id: 'transfer', kind: 'transfer' }),
    ];
    const lines = [
      line({ id: 'aud_food', transactionId: 'aud_expense', amountMinor: -22000, currencyCode: 'AUD', categoryId: 'food' }),
      line({
        id: 'aud_transport',
        transactionId: 'aud_expense',
        amountMinor: -8000,
        currencyCode: 'AUD',
        categoryId: 'transport',
      }),
      line({
        id: 'usd_subscription',
        transactionId: 'usd_expense',
        amountMinor: -1500,
        currencyCode: 'USD',
        categoryId: 'subscriptions',
      }),
      line({ id: 'transfer_out', transactionId: 'transfer', amountMinor: -999999, currencyCode: 'AUD', categoryId: 'ignored' }),
    ];

    expect(getDashboardTopSpendingByCurrency({ transactions, lines, range })).toEqual([
      {
        currencyCode: 'AUD',
        rows: [
          { categoryId: 'food', currencyCode: 'AUD', amountMinor: 22000 },
          { categoryId: 'transport', currencyCode: 'AUD', amountMinor: 8000 },
        ],
      },
      {
        currencyCode: 'USD',
        rows: [{ categoryId: 'subscriptions', currencyCode: 'USD', amountMinor: 1500 }],
      },
    ]);
  });

  it('includes negative mixed split lines in top spending without combining currencies', () => {
    const transactions = [
      transaction({ id: 'aud_mixed_income', kind: 'income' }),
      transaction({ id: 'usd_mixed_income', kind: 'income' }),
    ];
    const lines = [
      line({
        id: 'aud_salary',
        transactionId: 'aud_mixed_income',
        amountMinor: 230000,
        currencyCode: 'AUD',
        categoryId: 'income',
      }),
      line({
        id: 'aud_tax',
        transactionId: 'aud_mixed_income',
        amountMinor: -60000,
        currencyCode: 'AUD',
        categoryId: 'tax',
      }),
      line({
        id: 'usd_tax',
        transactionId: 'usd_mixed_income',
        accountId: 'usd_1',
        amountMinor: -5000,
        currencyCode: 'USD',
        categoryId: 'tax',
      }),
    ];

    expect(getDashboardTopSpendingByCurrency({ transactions, lines, range })).toEqual([
      {
        currencyCode: 'AUD',
        rows: [{ categoryId: 'tax', currencyCode: 'AUD', amountMinor: 60000 }],
      },
      {
        currencyCode: 'USD',
        rows: [{ categoryId: 'tax', currencyCode: 'USD', amountMinor: 5000 }],
      },
    ]);
  });

  it('returns empty grouped stats only when selected accounts have no relevant data', () => {
    const transactions = [transaction({ id: 'aud_income', kind: 'income' })];
    const lines = [
      line({ id: 'aud_income_line', accountId: 'aud_1', transactionId: 'aud_income', amountMinor: 1000, currencyCode: 'AUD' }),
    ];

    expect(getDashboardCashFlowByCurrency({ transactions, lines, range, accountIds: [] })).toEqual([]);
    expect(getDashboardTopSpendingByCurrency({ transactions, lines, range, accountIds: ['usd_1'] })).toEqual([]);
  });
});

function account(overrides: Partial<Account>): Account {
  return {
    id: 'account',
    name: 'Account',
    nickname: '',
    type: 'checking',
    currencyCode: 'AUD',
    openingBalanceMinor: 0,
    creditLimitMinor: null,
    notes: '',
    institutionName: '',
    includeInRainyDay: false,
    themeColor: '#1876A8',
    iconName: 'business-outline',
    showOnDashboard: true,
    sortOrder: 0,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'transaction',
    kind: 'expense',
    title: 'Transaction',
    datetime: now,
    notes: '',
    labels: [],
    groupId: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function line(overrides: Partial<TransactionLine>): TransactionLine {
  return {
    id: 'line',
    transactionId: 'transaction',
    accountId: 'aud_1',
    amountMinor: -1000,
    currencyCode: 'AUD',
    categoryId: 'food',
    subcategoryId: 'food_default',
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: now,
    ...overrides,
  };
}
