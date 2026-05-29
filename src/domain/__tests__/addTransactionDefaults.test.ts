import {
  getAddTransactionDefaultsAfterSave,
  normalizeAddTransactionDefaults,
  resolveAddTransactionDefaultAccountId,
  resolveAddTransactionDefaultCategory,
} from '../addTransactionDefaults';
import type { Account, NewTransactionInput } from '../types';

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
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function savedTransaction(overrides: Partial<NewTransactionInput> = {}): NewTransactionInput {
  return {
    kind: 'expense',
    title: 'Groceries',
    datetime: '2026-05-29T10:00:00.000Z',
    lines: [
      {
        accountId: 'bank',
        amountMinor: -2500,
        currencyCode: 'AUD',
        categoryId: 'food',
        subcategoryId: 'groceries',
      },
    ],
    ...overrides,
  };
}

describe('Add Transaction defaults', () => {
  it('uses explicit account before dashboard, remembered, and first active defaults', () => {
    expect(resolveAddTransactionDefaultAccountId({
      accounts: [account('template'), account('dashboard'), account('remembered')],
      dashboardAccountIds: ['dashboard'],
      explicitAccountId: 'template',
      rememberedAccountId: 'remembered',
    })).toBe('template');
  });

  it('does not replace an existing explicit source account with remembered defaults', () => {
    expect(resolveAddTransactionDefaultAccountId({
      accounts: [account('template', { isArchived: true }), account('remembered')],
      explicitAccountId: 'template',
      rememberedAccountId: 'remembered',
    })).toBe('template');
  });

  it('uses the first valid dashboard account when no explicit account exists', () => {
    expect(resolveAddTransactionDefaultAccountId({
      accounts: [account('hidden', { isArchived: true }), account('first'), account('second')],
      dashboardAccountIds: ['hidden', 'second', 'first'],
      rememberedAccountId: 'first',
    })).toBe('second');
  });

  it('falls back to remembered account and ignores invalid remembered accounts', () => {
    expect(resolveAddTransactionDefaultAccountId({
      accounts: [account('first'), account('remembered')],
      rememberedAccountId: 'remembered',
    })).toBe('remembered');

    expect(resolveAddTransactionDefaultAccountId({
      accounts: [account('first'), account('archived', { isArchived: true })],
      rememberedAccountId: 'archived',
    })).toBe('first');
  });

  it('keeps expense and income category defaults separate', () => {
    const defaults = {
      lastCategoryByKind: {
        expense: { categoryId: 'transport', subcategoryId: 'public-transport' },
        income: { categoryId: 'income', subcategoryId: 'salary' },
      },
    };

    expect(resolveAddTransactionDefaultCategory({
      defaults,
      kind: 'expense',
    })).toEqual({ categoryId: 'transport', subcategoryId: 'public-transport' });

    expect(resolveAddTransactionDefaultCategory({
      defaults,
      kind: 'income',
    })).toEqual({ categoryId: 'income', subcategoryId: 'salary' });
  });

  it('uses explicit category before remembered category', () => {
    expect(resolveAddTransactionDefaultCategory({
      defaults: {
        lastCategoryByKind: {
          expense: { categoryId: 'transport', subcategoryId: 'public-transport' },
        },
      },
      explicitCategoryId: 'food',
      explicitSubcategoryId: 'restaurants',
      kind: 'expense',
    })).toEqual({ categoryId: 'food', subcategoryId: 'restaurants' });
  });

  it('ignores wrong-kind or missing category defaults and falls back safely', () => {
    expect(resolveAddTransactionDefaultCategory({
      defaults: {
        lastCategoryByKind: {
          expense: { categoryId: 'income', subcategoryId: 'salary' },
        },
      },
      kind: 'expense',
    })).toEqual({ categoryId: 'food', subcategoryId: 'groceries' });
  });

  it('keeps a valid parent category when a remembered subcategory is no longer valid', () => {
    expect(resolveAddTransactionDefaultCategory({
      defaults: {
        lastCategoryByKind: {
          expense: { categoryId: 'food', subcategoryId: 'missing' },
        },
      },
      kind: 'expense',
    })).toEqual({ categoryId: 'food', subcategoryId: 'groceries' });
  });

  it('builds remembered defaults from a successfully saved real transaction', () => {
    expect(getAddTransactionDefaultsAfterSave({
      accounts: [account('bank')],
      input: savedTransaction(),
    })).toEqual({
      lastManualAccountId: 'bank',
      lastCategoryByKind: {
        expense: { categoryId: 'food', subcategoryId: 'groceries' },
      },
    });
  });

  it('updates only the account default for transfers', () => {
    expect(getAddTransactionDefaultsAfterSave({
      accounts: [account('bank')],
      currentDefaults: {
        lastCategoryByKind: {
          expense: { categoryId: 'food', subcategoryId: 'groceries' },
        },
      },
      input: savedTransaction({
        kind: 'transfer',
        lines: [
          {
            accountId: 'bank',
            amountMinor: -1000,
            currencyCode: 'AUD',
            transferPeerAccountId: 'savings',
          },
        ],
      }),
    })).toEqual({
      lastManualAccountId: 'bank',
      lastCategoryByKind: {
        expense: { categoryId: 'food', subcategoryId: 'groceries' },
      },
    });
  });

  it('normalizes corrupt stored defaults to an empty object', () => {
    expect(normalizeAddTransactionDefaults({ lastManualAccountId: 10, lastCategoryByKind: 'bad' })).toEqual({});
  });
});
