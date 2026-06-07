import {
  buildRecurringItemAdvanceInput,
  buildRecurringTransactionInputFromDraft,
  saveRecurringTransactionFromDraft,
  type RecurringTransactionReviewDraft,
} from '../recurringTransactionReview';
import type { Account, RecurringItem } from '../types';

const now = '2026-05-15T12:00:00.000Z';
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
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'usd',
    name: 'USD Wallet',
    nickname: '',
    type: 'checking',
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
    createdAt: now,
    updatedAt: now,
  },
];

describe('recurring transaction review helpers', () => {
  it('builds a real expense transaction input from the reviewed draft', () => {
    const input = buildRecurringTransactionInputFromDraft({
      accounts,
      recurringItem: recurringItem({}),
      draft: draft({
        title: 'Reviewed rent',
        amountMinor: 220000,
        transactionDate: '2026-05-03',
        note: 'Paid early',
      }),
    });

    expect(input).toEqual({
      kind: 'expense',
      title: 'Reviewed rent',
      datetime: new Date(2026, 4, 3, 12, 0, 0, 0).toISOString(),
      notes: 'Paid early',
      lines: [
        expect.objectContaining({
          accountId: 'everyday',
          amountMinor: -220000,
          currencyCode: 'AUD',
          categoryId: 'housing',
          subcategoryId: 'rent',
          note: 'Paid early',
        }),
      ],
    });
  });

  it('builds a real income transaction input from the reviewed draft', () => {
    const input = buildRecurringTransactionInputFromDraft({
      accounts,
      recurringItem: recurringItem({
        kind: 'income',
        categoryId: 'income',
        subcategoryId: 'salary',
      }),
      draft: draft({
        title: 'Salary',
        amountMinor: 320000,
        categoryId: 'income',
        subcategoryId: 'salary',
      }),
    });

    expect(input.kind).toBe('income');
    expect(input.lines[0]).toEqual(
      expect.objectContaining({
        amountMinor: 320000,
        categoryId: 'income',
        subcategoryId: 'salary',
      }),
    );
  });

  it('derives transaction currency from the reviewed account without converting amount', () => {
    const input = buildRecurringTransactionInputFromDraft({
      accounts,
      recurringItem: recurringItem({}),
      draft: draft({
        accountId: 'usd',
        amountMinor: 215000,
      }),
    });

    expect(input.lines[0]).toEqual(
      expect.objectContaining({
        accountId: 'usd',
        amountMinor: -215000,
        currencyCode: 'USD',
      }),
    );
  });

  it('advances the recurring item from the stored next due date', () => {
    const input = buildRecurringItemAdvanceInput(
      recurringItem({
        frequency: 'monthly',
        nextDueDate: '2026-01-31',
      }),
      accounts,
    );

    expect(input.nextDueDate).toBe('2026-02-28');
  });

  it('submits one recurring transaction action with the previous and advanced due dates', async () => {
    const createRecurringTransaction = jest.fn(async () => undefined);

    const result = await saveRecurringTransactionFromDraft({
      accounts,
      recurringItem: recurringItem({ frequency: 'fortnightly', nextDueDate: '2026-05-15' }),
      draft: draft({ transactionDate: '2026-05-20' }),
      createRecurringTransaction,
    });

    expect(result.recurringItemInput.nextDueDate).toBe('2026-05-29');
    expect(createRecurringTransaction).toHaveBeenCalledWith({
      recurringItemId: 'recurring-1',
      previousNextDueDate: '2026-05-15',
      transactionInput: result.transactionInput,
      recurringItemInput: result.recurringItemInput,
    });
  });

  it('surfaces atomic recurring transaction creation failures', async () => {
    const createRecurringTransaction = jest.fn(async () => {
      throw new Error('Could not save recurring payment.');
    });

    await expect(
      saveRecurringTransactionFromDraft({
        accounts,
        recurringItem: recurringItem({}),
        draft: draft({}),
        createRecurringTransaction,
      }),
    ).rejects.toThrow('Could not save recurring payment.');
  });

  it('blocks creation when reviewed references are invalid', () => {
    expect(() =>
      buildRecurringTransactionInputFromDraft({
        accounts: [],
        recurringItem: recurringItem({}),
        draft: draft({}),
      }),
    ).toThrow('Recurring item account needs attention.');
  });
});

function draft(overrides: Partial<RecurringTransactionReviewDraft>): RecurringTransactionReviewDraft {
  return {
    title: 'Rent',
    amountMinor: 215000,
    transactionDate: '2026-05-01',
    accountId: 'everyday',
    categoryId: 'housing',
    subcategoryId: 'rent',
    note: '',
    ...overrides,
  };
}

function recurringItem(overrides: Partial<RecurringItem>): RecurringItem {
  return {
    id: 'recurring-1',
    name: 'Rent',
    kind: 'expense',
    amountMinor: 215000,
    currencyCode: 'AUD',
    accountId: 'everyday',
    categoryId: 'housing',
    subcategoryId: 'rent',
    note: '',
    frequency: 'monthly',
    nextDueDate: '2026-05-01',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
