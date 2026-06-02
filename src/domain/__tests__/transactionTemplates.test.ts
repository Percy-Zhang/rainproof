import {
  buildAddTransactionPrefillFromTemplate,
  getActiveTransactionTemplates,
  validateTransactionTemplateInput,
} from '../transactionTemplates';
import type { Account, TransactionTemplate } from '../types';

const nowIso = '2026-05-20T10:30:00.000Z';
const accounts: Account[] = [
  {
    id: 'everyday',
    name: 'Everyday',
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
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'wallet',
    name: 'USD Wallet',
    nickname: '',
    type: 'cash',
    currencyCode: 'USD',
    openingBalanceMinor: 0,
    creditLimitMinor: null,
    notes: '',
    institutionName: '',
    includeInRainyDay: false,
    themeColor: '#2E7D59',
    iconName: 'wallet-outline',
    showOnDashboard: true,
    sortOrder: 1,
    isArchived: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  },
];

describe('transaction template helpers', () => {
  it('validates income and expense template input and derives currency from the selected account', () => {
    const validated = validateTransactionTemplateInput(
      {
        name: 'Coffee',
        kind: 'expense',
        title: 'Coffee run',
        accountId: 'everyday',
        amountMinor: 650,
        currencyCode: 'USD',
        categoryId: 'food-dining',
        subcategoryId: 'coffee',
        notes: 'Morning',
      },
      accounts,
    );

    expect(validated).toEqual(
      expect.objectContaining({
        name: 'Coffee',
        kind: 'expense',
        title: 'Coffee run',
        amountMinor: 650,
        currencyCode: 'AUD',
      }),
    );
  });

  it('allows optional amount and category on saved templates', () => {
    expect(
      validateTransactionTemplateInput(
        {
          name: 'Manual lunch',
          kind: 'expense',
          title: 'Lunch',
          accountId: 'everyday',
          amountMinor: null,
          currencyCode: 'AUD',
          categoryId: null,
          subcategoryId: null,
        },
        accounts,
      ),
    ).toEqual(
      expect.objectContaining({
        amountMinor: null,
        categoryId: null,
        subcategoryId: null,
        splitLines: [],
      }),
    );
  });

  it('validates split expense template lines and defaults parent category from the first split line', () => {
    const validated = validateTransactionTemplateInput(
      {
        name: 'Split groceries',
        kind: 'expense',
        title: 'Groceries',
        accountId: 'everyday',
        amountMinor: 3000,
        currencyCode: 'AUD',
        categoryId: null,
        subcategoryId: null,
        splitLines: [
          { amountMinor: 1000, categoryId: 'food', subcategoryId: 'groceries', note: '' },
          { amountMinor: 2000, categoryId: 'housing', subcategoryId: 'rent', note: 'Rent' },
        ],
      },
      accounts,
    );

    expect(validated).toEqual(
      expect.objectContaining({
        amountMinor: 3000,
        categoryId: 'food',
        subcategoryId: 'groceries',
        splitLines: [
          { amountMinor: 1000, categoryId: 'food', subcategoryId: 'groceries', note: '' },
          { amountMinor: 2000, categoryId: 'housing', subcategoryId: 'rent', note: 'Rent' },
        ],
      }),
    );
  });

  it('validates split income template lines', () => {
    const validated = validateTransactionTemplateInput(
      {
        name: 'Split pay',
        kind: 'income',
        title: 'Pay',
        accountId: 'everyday',
        amountMinor: 3000,
        currencyCode: 'AUD',
        categoryId: 'income',
        subcategoryId: 'salary',
        splitLines: [
          { amountMinor: 2000, categoryId: 'income', subcategoryId: 'salary', note: '' },
          { amountMinor: 1000, categoryId: 'income', subcategoryId: 'bonus', note: 'Bonus' },
        ],
      },
      accounts,
    );

    expect(validated.splitLines).toEqual([
      { amountMinor: 2000, categoryId: 'income', subcategoryId: 'salary', note: '' },
      { amountMinor: 1000, categoryId: 'income', subcategoryId: 'bonus', note: 'Bonus' },
    ]);
  });

  it('builds Add Transaction prefill state with current date and time, not template creation date', () => {
    const prefill = buildAddTransactionPrefillFromTemplate({
      accounts,
      template: template({
        title: 'Salary',
        kind: 'income',
        accountId: 'wallet',
        amountMinor: 125000,
        currencyCode: 'USD',
        categoryId: 'income',
        subcategoryId: 'salary',
        notes: 'Monthly pay',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
      now: new Date(2026, 4, 21, 9, 15, 0, 0),
    });

    expect(prefill).toEqual({
      kind: 'income',
      title: 'Salary',
      amountExpression: '1250.00',
      date: '2026-05-21',
      time: '09:15',
      accountId: 'wallet',
      categoryId: 'income',
      subcategoryId: 'salary',
      notes: 'Monthly pay',
      splitLines: [],
    });
  });

  it('builds Add Transaction prefill state for split templates', () => {
    const prefill = buildAddTransactionPrefillFromTemplate({
      accounts,
      template: template({
        title: 'Groceries',
        amountMinor: 3000,
        categoryId: null,
        subcategoryId: null,
        splitLines: [
          {
            id: 'line-food',
            templateId: 'template-1',
            amountMinor: 1000,
            categoryId: 'food',
            subcategoryId: 'groceries',
            note: '',
            sortOrder: 0,
            createdAt: nowIso,
          },
          {
            id: 'line-home',
            templateId: 'template-1',
            amountMinor: 2000,
            categoryId: 'housing',
            subcategoryId: 'rent',
            note: 'Rent',
            sortOrder: 1,
            createdAt: nowIso,
          },
        ],
      }),
      now: new Date(2026, 4, 21, 9, 15, 0, 0),
    });

    expect(prefill).toEqual(expect.objectContaining({
      amountExpression: '30.00',
      categoryId: 'food',
      subcategoryId: 'groceries',
      splitLines: [
        { id: 'line-food', amount: '10.00', categoryId: 'food', subcategoryId: 'groceries', note: '' },
        { id: 'line-home', amount: '20.00', categoryId: 'housing', subcategoryId: 'rent', note: 'Rent' },
      ],
    }));
  });

  it('keeps active templates sorted and excludes archived templates', () => {
    const active = getActiveTransactionTemplates([
      template({ id: 'b', name: 'Rent', isActive: true, createdAt: '2026-02-01T00:00:00.000Z' }),
      template({ id: 'a', name: 'Coffee', isActive: true, createdAt: '2026-03-01T00:00:00.000Z' }),
      template({ id: 'c', name: 'Archived', isActive: false }),
    ]);

    expect(active.map((item) => item.name)).toEqual(['Coffee', 'Rent']);
  });

  it('blocks invalid template input', () => {
    expect(() =>
      validateTransactionTemplateInput(
        {
          name: '',
          kind: 'expense',
          title: 'Coffee',
          accountId: 'everyday',
          amountMinor: 650,
          currencyCode: 'AUD',
        },
        accounts,
      ),
    ).toThrow('Template name is required.');

    expect(() =>
      validateTransactionTemplateInput(
        {
          name: 'Coffee',
          kind: 'expense',
          title: 'Coffee',
          accountId: 'everyday',
          amountMinor: 0,
          currencyCode: 'AUD',
        },
        accounts,
      ),
    ).toThrow('Template amount must be greater than zero when set.');
  });

  it('blocks invalid split template input', () => {
    expect(() =>
      validateTransactionTemplateInput(
        {
          name: 'Split transfer',
          kind: 'transfer' as never,
          title: 'Transfer',
          accountId: 'everyday',
          amountMinor: 1000,
          currencyCode: 'AUD',
        },
        accounts,
      ),
    ).toThrow('Templates support income and expense transactions.');

    expect(() =>
      validateTransactionTemplateInput(
        {
          name: 'Split groceries',
          kind: 'expense',
          title: 'Groceries',
          accountId: 'everyday',
          amountMinor: null,
          currencyCode: 'AUD',
          splitLines: [
            { amountMinor: 1000, categoryId: 'food', subcategoryId: 'groceries' },
            { amountMinor: 2000, categoryId: 'housing', subcategoryId: 'rent' },
          ],
        },
        accounts,
      ),
    ).toThrow('Split templates need an amount.');

    expect(() =>
      validateTransactionTemplateInput(
        {
          name: 'Split groceries',
          kind: 'expense',
          title: 'Groceries',
          accountId: 'everyday',
          amountMinor: 3000,
          currencyCode: 'AUD',
          splitLines: [
            { amountMinor: 1000, categoryId: 'food', subcategoryId: 'groceries' },
            { amountMinor: 2500, categoryId: 'housing', subcategoryId: 'rent' },
          ],
        },
        accounts,
      ),
    ).toThrow('Split line amounts must equal the template amount.');
  });
});

function template(overrides: Partial<TransactionTemplate>): TransactionTemplate {
  return {
    id: 'template-1',
    name: 'Template',
    kind: 'expense',
    title: 'Template transaction',
    accountId: 'everyday',
    amountMinor: 1000,
    currencyCode: 'AUD',
    categoryId: 'food-dining',
    subcategoryId: 'restaurants',
    notes: '',
    splitLines: [],
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
    ...overrides,
  };
}
