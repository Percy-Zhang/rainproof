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
      }),
    );
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
    });
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
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
    ...overrides,
  };
}
