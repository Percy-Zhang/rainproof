import {
  getDashboardBalanceTotals,
  getDashboardCashFlowByCurrency,
  getDashboardCashFlowByCurrencyFromContext,
  getDashboardTopSpendingByCurrency,
  getDashboardTopSpendingByCurrencyFromContext,
} from '../dashboardFinancial';
import { buildDashboardSelectedAccountContext } from '../dashboardSelectedAccountContext';
import type { Account, AccountBalance, DateRange, Transaction, TransactionLine, TransactionLink } from '../types';

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

  it('reuses selected-account context for cash flow and top spending without counting transfers', () => {
    const transactions = [
      transaction({ id: 'aud_income', kind: 'income' }),
      transaction({ id: 'aud_expense', kind: 'expense' }),
      transaction({ id: 'usd_mixed_income', kind: 'income' }),
      transaction({ id: 'transfer', kind: 'transfer' }),
    ];
    const lines = [
      line({ id: 'aud_income_line', transactionId: 'aud_income', amountMinor: 320000, currencyCode: 'AUD', categoryId: 'income' }),
      line({ id: 'aud_food', transactionId: 'aud_expense', amountMinor: -80000, currencyCode: 'AUD', categoryId: 'food' }),
      line({ id: 'usd_salary', transactionId: 'usd_mixed_income', accountId: 'usd_1', amountMinor: 20000, currencyCode: 'USD', categoryId: 'income' }),
      line({ id: 'usd_tax', transactionId: 'usd_mixed_income', accountId: 'usd_1', amountMinor: -5000, currencyCode: 'USD', categoryId: 'tax' }),
      line({ id: 'transfer_out', transactionId: 'transfer', amountMinor: -999999, currencyCode: 'AUD', categoryId: 'ignored' }),
      line({ id: 'transfer_in', transactionId: 'transfer', amountMinor: 999999, currencyCode: 'AUD', categoryId: 'ignored' }),
    ];
    const context = buildDashboardSelectedAccountContext({
      lines,
      range,
      selectedAccountIds: ['aud_1', 'usd_1'],
      transactions,
    });

    expect(getDashboardCashFlowByCurrencyFromContext(context)).toEqual([
      { currencyCode: 'AUD', incomeMinor: 320000, expenseMinor: 80000, netMinor: 240000 },
      { currencyCode: 'USD', incomeMinor: 20000, expenseMinor: 5000, netMinor: 15000 },
    ]);
    expect(getDashboardTopSpendingByCurrencyFromContext(context)).toEqual([
      {
        currencyCode: 'AUD',
        rows: [{ categoryId: 'food', currencyCode: 'AUD', amountMinor: 80000 }],
      },
      {
        currencyCode: 'USD',
        rows: [{ categoryId: 'tax', currencyCode: 'USD', amountMinor: 5000 }],
      },
    ]);
  });

  it('applies linked reimbursement adjustments once through selected-account context', () => {
    const transactions = [
      transaction({ id: 'income_1', kind: 'income' }),
      transaction({ id: 'expense_1', kind: 'expense' }),
    ];
    const lines = [
      line({ id: 'income_line', transactionId: 'income_1', amountMinor: 10000, currencyCode: 'AUD', categoryId: 'income' }),
      line({ id: 'expense_line', transactionId: 'expense_1', amountMinor: -10000, currencyCode: 'AUD', categoryId: 'food' }),
    ];
    const transactionLinks = [link({
      amountMinor: 6000,
      currencyCode: 'AUD',
      sourceTransactionId: 'income_1',
      targetTransactionId: 'expense_1',
    })];
    const context = buildDashboardSelectedAccountContext({
      lines,
      range,
      selectedAccountIds: ['aud_1'],
      transactionLinks,
      transactions,
    });

    expect(getDashboardCashFlowByCurrencyFromContext(context)).toEqual([
      { currencyCode: 'AUD', incomeMinor: 4000, expenseMinor: 4000, netMinor: 0 },
    ]);
    expect(getDashboardTopSpendingByCurrencyFromContext(context)).toEqual([
      {
        currencyCode: 'AUD',
        rows: [{ categoryId: 'food', currencyCode: 'AUD', amountMinor: 4000 }],
      },
    ]);
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

function link(overrides: Partial<TransactionLink>): TransactionLink {
  return {
    id: 'link',
    sourceTransactionId: 'income',
    targetTransactionId: 'expense',
    sourceLineId: null,
    targetLineId: null,
    linkType: 'reimbursement',
    amountMinor: 1000,
    currencyCode: 'AUD',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
