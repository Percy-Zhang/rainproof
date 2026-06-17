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
        splitMode: 'standard',
        title: 'Salary',
        amountExpression: '1200.00',
        date: '2026-05-31',
        time: '08:30',
        accountId: 'template',
        categoryId: 'income',
        subcategoryId: 'salary',
        notes: 'Monthly pay',
        splitLines: [],
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

  it('uses template split lines in the initial Add Transaction draft', () => {
    const draft = createAddTransactionInitialDraft({
      initialTemplate: {
        kind: 'expense',
        splitMode: 'standard',
        title: 'Groceries',
        amountExpression: '30.00',
        date: '2026-05-31',
        time: '08:30',
        accountId: 'template',
        categoryId: 'food',
        subcategoryId: 'groceries',
        notes: '',
        splitLines: [
          { id: 'food-line', amount: '10.00', categoryId: 'food', subcategoryId: 'groceries', note: '' },
          { id: 'home-line', amount: '20.00', categoryId: 'housing', subcategoryId: 'rent', note: 'Rent' },
        ],
      },
      now: new Date(2026, 4, 30, 10, 0, 0, 0),
      snapshot: snapshot(),
    });

    expect(draft.splitLines).toEqual([
      { id: 'food-line', amount: '10.00', categoryId: 'food', subcategoryId: 'groceries', note: '' },
      { id: 'home-line', amount: '20.00', categoryId: 'housing', subcategoryId: 'rent', note: 'Rent' },
    ]);
    expect(draft.splitMode).toBe('standard');
  });

  it('uses mixed template mode and line kinds in the initial Add Transaction draft', () => {
    const draft = createAddTransactionInitialDraft({
      initialTemplate: {
        kind: 'income',
        splitMode: 'mixed',
        title: 'Salary',
        amountExpression: '1700.00',
        date: '2026-05-31',
        time: '08:30',
        accountId: 'template',
        categoryId: 'income',
        subcategoryId: 'salary',
        notes: '',
        splitLines: [
          {
            id: 'salary-line',
            kind: 'income',
            amount: '2300.00',
            categoryId: 'income',
            subcategoryId: 'salary',
            note: 'Salary',
          },
          {
            id: 'tax-line',
            kind: 'expense',
            amount: '600.00',
            categoryId: 'tax',
            subcategoryId: 'withholding',
            note: 'Tax',
          },
        ],
      },
      now: new Date(2026, 4, 30, 10, 0, 0, 0),
      snapshot: snapshot(),
    });

    expect(draft.splitMode).toBe('mixed');
    expect(draft.splitLines).toEqual([
      expect.objectContaining({ id: 'salary-line', kind: 'income', amount: '2300.00' }),
      expect.objectContaining({ id: 'tax-line', kind: 'expense', amount: '600.00' }),
    ]);
  });

  it('saves template-prefilled split lines with blank item names falling back to the parent item', () => {
    const initialDraft = createAddTransactionInitialDraft({
      initialTemplate: {
        kind: 'expense',
        splitMode: 'standard',
        title: 'Groceries',
        amountExpression: '30.00',
        date: '2026-05-31',
        time: '08:30',
        accountId: 'template',
        categoryId: 'food',
        subcategoryId: 'groceries',
        notes: '',
        splitLines: [
          { id: 'food-line', amount: '10.00', categoryId: 'food', subcategoryId: 'groceries', note: '' },
          { id: 'home-line', amount: '20.00', categoryId: 'housing', subcategoryId: 'rent', note: 'Rent' },
        ],
      },
      now: new Date(2026, 4, 30, 10, 0, 0, 0),
      snapshot: snapshot(),
    });
    const input = buildAddTransactionInput({
      accounts: [account('template')],
      draft: {
        ...initialDraft,
        groupId: '',
        labels: '',
        notes: '',
        toAccountId: 'outside',
      },
    });

    expect(input.lines).toEqual([
      expect.objectContaining({ amountMinor: -1000, note: 'Groceries' }),
      expect.objectContaining({ amountMinor: -2000, note: 'Rent' }),
    ]);
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
          { id: 'food-line', amount: '10.00', categoryId: 'food', subcategoryId: 'groceries', note: '' },
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
          { id: 'salary-line', amount: '10.00', categoryId: 'income', subcategoryId: 'salary', note: '  ' },
          { id: 'bonus-line', amount: '20.00', categoryId: 'income', subcategoryId: 'bonus', note: 'Bonus' },
        ],
        subcategoryId: 'salary',
        time: '10:00',
        toAccountId: 'outside',
      },
    });

    expect(expense.lines).toEqual([
      expect.objectContaining({ amountMinor: -1000, categoryId: 'food', subcategoryId: 'groceries', note: 'Split expense' }),
      expect.objectContaining({ amountMinor: -2000, categoryId: 'housing', subcategoryId: 'rent', note: 'Rent' }),
    ]);
    expect(income.lines).toEqual([
      expect.objectContaining({ amountMinor: 1000, categoryId: 'income', subcategoryId: 'salary', note: 'Split income' }),
      expect.objectContaining({ amountMinor: 2000, categoryId: 'income', subcategoryId: 'bonus', note: 'Bonus' }),
    ]);
  });

  it('builds a mixed net-income transaction from positive line inputs and line kinds', () => {
    const input = buildAddTransactionInput({
      accounts: [account('everyday')],
      draft: {
        amountExpression: '1700.00',
        categoryId: 'income',
        date: '2026-05-30',
        fromAccountId: 'everyday',
        groupId: '',
        item: 'Pay',
        kind: 'income',
        labels: '',
        notes: '',
        splitMode: 'mixed',
        splitLines: [
          {
            id: 'salary-line',
            kind: 'income',
            amount: '2300.00',
            categoryId: 'income',
            subcategoryId: 'salary',
            note: 'Salary',
          },
          {
            id: 'tax-line',
            kind: 'expense',
            amount: '600.00',
            categoryId: 'food',
            subcategoryId: 'groceries',
            note: 'Tax',
          },
        ],
        subcategoryId: 'salary',
        time: '10:00',
        toAccountId: 'outside',
      },
    });

    expect(input.lines).toEqual([
      expect.objectContaining({ id: 'salary-line', amountMinor: 230000, note: 'Salary' }),
      expect.objectContaining({ id: 'tax-line', amountMinor: -60000, note: 'Tax' }),
    ]);
    expect(input.lines.reduce((sum, line) => sum + line.amountMinor, 0)).toBe(170000);
  });

  it('builds a mixed net-expense transaction and rejects mismatched signed totals', () => {
    const draft = {
      amountExpression: '300.00',
      categoryId: 'food',
      date: '2026-05-30',
      fromAccountId: 'everyday',
      groupId: '',
      item: 'Net expense',
      kind: 'expense' as const,
      labels: '',
      notes: '',
      splitMode: 'mixed' as const,
      splitLines: [
        {
          id: 'refund-line',
          kind: 'income' as const,
          amount: '200.00',
          categoryId: 'income',
          subcategoryId: 'refund',
          note: 'Refund',
        },
        {
          id: 'expense-line',
          kind: 'expense' as const,
          amount: '500.00',
          categoryId: 'food',
          subcategoryId: 'groceries',
          note: 'Purchase',
        },
      ],
      subcategoryId: 'groceries',
      time: '10:00',
      toAccountId: 'outside',
    };

    expect(buildAddTransactionInput({ accounts: [account('everyday')], draft }).lines.map((line) => line.amountMinor)).toEqual([
      20000,
      -50000,
    ]);
    expect(canBuildAddTransactionInput({
      accounts: [account('everyday')],
      draft: { ...draft, amountExpression: '299.99' },
    })).toBe(false);
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

  it('builds a cross-currency transfer from sent and received amounts', () => {
    const input = buildAddTransactionInput({
      accounts: [
        account('aud', { currencyCode: 'AUD' }),
        account('usd', { currencyCode: 'USD' }),
      ],
      draft: {
        amountExpression: '150.00',
        targetAmountExpression: '97.50',
        categoryId: '',
        date: '2026-05-30',
        fromAccountId: 'aud',
        groupId: '',
        item: 'Transfer',
        kind: 'transfer',
        labels: '',
        notes: '',
        splitLines: [],
        subcategoryId: '',
        time: '10:00',
        toAccountId: 'usd',
      },
    });

    expect(input.lines).toEqual([
      expect.objectContaining({
        accountId: 'aud',
        amountMinor: -15000,
        currencyCode: 'AUD',
        transferPeerAccountId: 'usd',
      }),
      expect.objectContaining({
        accountId: 'usd',
        amountMinor: 9750,
        currencyCode: 'USD',
        transferPeerAccountId: 'aud',
      }),
    ]);
  });

  it('requires a received amount for cross-currency transfers only', () => {
    const draft = {
      amountExpression: '150.00',
      categoryId: '',
      date: '2026-05-30',
      fromAccountId: 'aud',
      groupId: '',
      item: 'Transfer',
      kind: 'transfer' as const,
      labels: '',
      notes: '',
      splitLines: [],
      subcategoryId: '',
      time: '10:00',
      toAccountId: 'usd',
    };

    expect(() =>
      buildAddTransactionInput({
        accounts: [
          account('aud', { currencyCode: 'AUD' }),
          account('usd', { currencyCode: 'USD' }),
        ],
        draft,
      }),
    ).toThrow('Received amount must be greater than zero.');
    expect(canBuildAddTransactionInput({
      accounts: [
        account('aud', { currencyCode: 'AUD' }),
        account('usd', { currencyCode: 'USD' }),
      ],
      draft,
    })).toBe(false);

    expect(canBuildAddTransactionInput({
      accounts: [
        account('aud', { currencyCode: 'AUD' }),
        account('savings', { currencyCode: 'AUD' }),
      ],
      draft: { ...draft, toAccountId: 'savings' },
    })).toBe(true);
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
