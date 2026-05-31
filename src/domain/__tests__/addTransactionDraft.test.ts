import {
  buildAddTransactionInput,
  canBuildAddTransactionInput,
  createAddTransactionInitialDraft,
  getAddTransactionPreviewAmountMinor,
} from '../addTransactionDraft';
import type { Account, AppSnapshot } from '../types';

const nowIso = '2026-05-30T10:00:00.000Z';

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
    includeInRainyDay: true,
    themeColor: '#1876A8',
    iconName: 'business-outline',
    showOnDashboard: true,
    sortOrder: 0,
    isArchived: false,
    createdAt: nowIso,
    updatedAt: nowIso,
    ...overrides,
  };
}

function snapshot(overrides: Partial<AppSnapshot> = {}): AppSnapshot {
  return {
    defaultCurrencyCode: 'AUD',
    settings: {
      defaultCurrencyCode: 'AUD',
      defaultCurrencyMode: 'manual',
      multiCurrencyEnabled: false,
      enabledCurrencyCodes: ['AUD'],
      dashboardSelectedAccountIds: null,
      addTransactionDefaults: {
        lastManualAccountId: 'remembered',
        lastCategoryByKind: {
          expense: { categoryId: 'transport', subcategoryId: 'public-transport' },
          income: { categoryId: 'income', subcategoryId: 'salary' },
        },
      },
    },
    accounts: [account('fallback'), account('dashboard'), account('remembered'), account('template')],
    transactions: [],
    transactionLines: [],
    transactionLinks: [],
    budgets: [],
    recurringItems: [],
    recurringBills: [],
    transactionTemplates: [],
    rainyDayFund: {
      id: 'rainy-day',
      name: 'Rainy Day Fund',
      currencyCode: 'AUD',
      goalMinor: 0,
      linkedAccountIds: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    ...overrides,
  };
}

describe('Add Transaction initial draft', () => {
  it('uses template prefill before dashboard and remembered defaults', () => {
    const draft = createAddTransactionInitialDraft({
      dashboardAccountIds: ['dashboard'],
      initialTemplate: {
        kind: 'income',
        title: 'Salary',
        amountExpression: '1200.00',
        date: '2026-05-31',
        time: '08:30',
        accountId: 'template',
        categoryId: 'income',
        subcategoryId: 'salary',
        notes: 'Monthly pay',
      },
      now: new Date(2026, 4, 30, 10, 0, 0, 0),
      snapshot: snapshot(),
    });

    expect(draft).toEqual(expect.objectContaining({
      amountExpression: '1200.00',
      categoryId: 'income',
      date: '2026-05-31',
      fromAccountId: 'template',
      item: 'Salary',
      kind: 'income',
      notes: 'Monthly pay',
      subcategoryId: 'salary',
      time: '08:30',
    }));
  });

  it('uses dashboard account context before remembered account for blank dashboard adds', () => {
    const draft = createAddTransactionInitialDraft({
      dashboardAccountIds: ['dashboard'],
      now: new Date(2026, 4, 30, 10, 0, 0, 0),
      snapshot: snapshot(),
    });

    expect(draft).toEqual(expect.objectContaining({
      categoryId: 'transport',
      date: '2026-05-30',
      fromAccountId: 'dashboard',
      kind: 'expense',
      subcategoryId: 'public-transport',
      time: '10:00',
    }));
  });

  it('falls back to remembered account when dashboard context is unavailable', () => {
    const draft = createAddTransactionInitialDraft({
      dashboardAccountIds: ['missing'],
      now: new Date(2026, 4, 30, 10, 0, 0, 0),
      snapshot: snapshot(),
    });

    expect(draft.fromAccountId).toBe('remembered');
  });

  it('builds a normal expense transaction input from the draft', () => {
    const input = buildAddTransactionInput({
      accounts: [account('everyday')],
      draft: {
        amountExpression: '12+3',
        categoryId: 'food',
        date: '2026-05-30',
        fromAccountId: 'everyday',
        groupId: 'Trip',
        item: 'Groceries',
        kind: 'expense',
        labels: 'shared, Shared, tax',
        notes: 'Weekly shop',
        splitLines: [],
        subcategoryId: 'groceries',
        time: '10:00',
        toAccountId: 'outside',
      },
    });

    expect(input).toEqual({
      kind: 'expense',
      title: 'Groceries',
      datetime: new Date(2026, 4, 30, 10, 0, 0, 0).toISOString(),
      notes: 'Weekly shop',
      labels: ['shared', 'tax'],
      groupId: 'Trip',
      lines: [
        {
          accountId: 'everyday',
          amountMinor: -1500,
          currencyCode: 'AUD',
          categoryId: 'food',
          subcategoryId: 'groceries',
          note: undefined,
        },
      ],
    });
  });

  it('builds a normal income transaction input from the draft', () => {
    const input = buildAddTransactionInput({
      accounts: [account('everyday')],
      draft: {
        amountExpression: '1250.00',
        categoryId: 'income',
        date: '2026-05-30',
        fromAccountId: 'everyday',
        groupId: '',
        item: 'Salary',
        kind: 'income',
        labels: '',
        notes: '',
        splitLines: [],
        subcategoryId: 'salary',
        time: '10:00',
        toAccountId: 'outside',
      },
    });

    expect(input.lines).toEqual([
      expect.objectContaining({
        accountId: 'everyday',
        amountMinor: 125000,
        currencyCode: 'AUD',
        categoryId: 'income',
        subcategoryId: 'salary',
      }),
    ]);
  });

  it('builds split expense and income transaction inputs from split lines', () => {
    const expense = buildAddTransactionInput({
      accounts: [account('everyday')],
      draft: {
        amountExpression: '30.00',
        categoryId: 'food',
        date: '2026-05-30',
        fromAccountId: 'everyday',
        groupId: '',
        item: 'Split expense',
        kind: 'expense',
        labels: '',
        notes: '',
        splitLines: [
          { id: 'food-line', amount: '10.00', categoryId: 'food', subcategoryId: 'groceries', note: 'Food' },
          { id: 'home-line', amount: '20.00', categoryId: 'housing', subcategoryId: 'rent', note: 'Rent' },
        ],
        subcategoryId: 'groceries',
        time: '10:00',
        toAccountId: 'outside',
      },
    });
    const income = buildAddTransactionInput({
      accounts: [account('everyday')],
      draft: {
        amountExpression: '30.00',
        categoryId: 'income',
        date: '2026-05-30',
        fromAccountId: 'everyday',
        groupId: '',
        item: 'Split income',
        kind: 'income',
        labels: '',
        notes: '',
        splitLines: [
          { id: 'salary-line', amount: '10.00', categoryId: 'income', subcategoryId: 'salary', note: 'Salary' },
          { id: 'bonus-line', amount: '20.00', categoryId: 'income', subcategoryId: 'bonus', note: 'Bonus' },
        ],
        subcategoryId: 'salary',
        time: '10:00',
        toAccountId: 'outside',
      },
    });

    expect(expense.lines).toEqual([
      expect.objectContaining({ amountMinor: -1000, categoryId: 'food', subcategoryId: 'groceries', note: 'Food' }),
      expect.objectContaining({ amountMinor: -2000, categoryId: 'housing', subcategoryId: 'rent', note: 'Rent' }),
    ]);
    expect(income.lines).toEqual([
      expect.objectContaining({ amountMinor: 1000, categoryId: 'income', subcategoryId: 'salary', note: 'Salary' }),
      expect.objectContaining({ amountMinor: 2000, categoryId: 'income', subcategoryId: 'bonus', note: 'Bonus' }),
    ]);
  });

  it('validates invalid amount, account, category, and split totals', () => {
    const baseDraft = {
      amountExpression: '10.00',
      categoryId: 'food',
      date: '2026-05-30',
      fromAccountId: 'everyday',
      groupId: '',
      item: 'Groceries',
      kind: 'expense' as const,
      labels: '',
      notes: '',
      splitLines: [],
      subcategoryId: 'groceries',
      time: '10:00',
      toAccountId: 'outside',
    };

    expect(() =>
      buildAddTransactionInput({
        accounts: [account('everyday')],
        draft: { ...baseDraft, amountExpression: '0' },
      }),
    ).toThrow('Amount must be greater than zero.');

    expect(() =>
      buildAddTransactionInput({
        accounts: [],
        draft: baseDraft,
      }),
    ).toThrow('Choose an account.');

    expect(() =>
      buildAddTransactionInput({
        accounts: [account('everyday')],
        draft: { ...baseDraft, subcategoryId: '' },
      }),
    ).toThrow('Choose a category and subcategory.');

    expect(canBuildAddTransactionInput({
      accounts: [account('everyday')],
      draft: {
        ...baseDraft,
        amountExpression: '30.00',
        splitLines: [
          { id: 'food-line', amount: '10.00', categoryId: 'food', subcategoryId: 'groceries', note: '' },
          { id: 'home-line', amount: '25.00', categoryId: 'housing', subcategoryId: 'rent', note: '' },
        ],
      },
    })).toBe(false);
  });

  it('keeps transfer save preparation unsplit and blocks invalid transfer endpoints', () => {
    const input = buildAddTransactionInput({
      accounts: [account('everyday'), account('savings')],
      draft: {
        amountExpression: '50.00',
        categoryId: '',
        date: '2026-05-30',
        fromAccountId: 'everyday',
        groupId: '',
        item: 'Transfer',
        kind: 'transfer',
        labels: '',
        notes: '',
        splitLines: [
          { id: 'ignored', amount: '50.00', categoryId: 'food', subcategoryId: 'groceries', note: '' },
        ],
        subcategoryId: '',
        time: '10:00',
        toAccountId: 'savings',
      },
    });

    expect(input.lines).toHaveLength(2);
    expect(input.lines[0]).toEqual(expect.objectContaining({ amountMinor: -5000, transferPeerAccountId: 'savings' }));
    expect(input.lines[1]).toEqual(expect.objectContaining({ amountMinor: 5000, transferPeerAccountId: 'everyday' }));
    expect(input.lines[0]).not.toHaveProperty('categoryId');
  });

  it('preserves preview amount behavior for expense, income, and outside transfers', () => {
    expect(getAddTransactionPreviewAmountMinor({
      amountExpression: '10.00',
      kind: 'expense',
      sourceAccountId: 'everyday',
    })).toBe(-1000);
    expect(getAddTransactionPreviewAmountMinor({
      amountExpression: '10.00',
      kind: 'income',
      sourceAccountId: 'everyday',
    })).toBe(1000);
    expect(getAddTransactionPreviewAmountMinor({
      amountExpression: '10.00',
      kind: 'transfer',
      sourceAccountId: 'outside',
    })).toBe(1000);
  });
});
