import {
  advanceRecurringDueDate,
  buildTransactionInputFromRecurringItem,
  calculateNextRecurringDueDate,
  classifyRecurringItemsByDueDate,
  dateOnlyToLocalDate,
  getLatestRecurringTransactionHistoryByItem,
  getRecurringCurrencyCodeForAccount,
  getNextMonthlyDueDateForDay,
  toLocalDateOnly,
  validateRecurringItemInput,
} from '../recurringItems';
import type { Account, RecurringItem, RecurringTransactionHistory } from '../types';

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
];

describe('recurring item helpers', () => {
  it('calculates weekly, fortnightly, monthly, and yearly next due dates', () => {
    expect(calculateNextRecurringDueDate('2026-05-01', 'weekly')).toBe('2026-05-08');
    expect(calculateNextRecurringDueDate('2026-05-01', 'fortnightly')).toBe('2026-05-15');
    expect(calculateNextRecurringDueDate('2026-05-01', 'monthly')).toBe('2026-06-01');
    expect(calculateNextRecurringDueDate('2026-05-01', 'yearly')).toBe('2027-05-01');
  });

  it('handles month-end recurrence deterministically', () => {
    expect(calculateNextRecurringDueDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(calculateNextRecurringDueDate('2026-02-28', 'monthly')).toBe('2026-03-31');
    expect(calculateNextRecurringDueDate('2024-02-29', 'yearly')).toBe('2025-02-28');
  });

  it('maps a legacy monthly due day to the next local date', () => {
    expect(getNextMonthlyDueDateForDay(12, new Date(2026, 4, 10, 9))).toBe('2026-05-12');
    expect(getNextMonthlyDueDateForDay(12, new Date(2026, 4, 13, 9))).toBe('2026-06-12');
  });

  it('converts date-only values to local picker dates without changing the date', () => {
    const pickerDate = dateOnlyToLocalDate('2026-05-31');

    expect(pickerDate.getFullYear()).toBe(2026);
    expect(pickerDate.getMonth()).toBe(4);
    expect(pickerDate.getDate()).toBe(31);
    expect(toLocalDateOnly(pickerDate)).toBe('2026-05-31');
  });

  it('derives recurring currency from the selected active account', () => {
    expect(getRecurringCurrencyCodeForAccount(accounts, 'everyday')).toBe('AUD');
    expect(getRecurringCurrencyCodeForAccount(accounts, 'missing')).toBe('');
    expect(getRecurringCurrencyCodeForAccount([{ ...accounts[0], isArchived: true }], 'everyday')).toBe('');
  });

  it('groups active items into overdue, due soon, and upcoming buckets', () => {
    const groups = classifyRecurringItemsByDueDate(
      [
        recurringItem({ id: 'overdue', name: 'Overdue', nextDueDate: '2026-05-01' }),
        recurringItem({ id: 'due', name: 'Due soon', nextDueDate: '2026-05-20' }),
        recurringItem({ id: 'upcoming', name: 'Upcoming', nextDueDate: '2026-06-10' }),
        recurringItem({ id: 'inactive', name: 'Inactive', nextDueDate: '2026-05-16', isActive: false }),
      ],
      { fromDate: '2026-05-15', dueSoonDays: 7 },
    );

    expect(groups.overdue.map((item) => item.id)).toEqual(['overdue']);
    expect(groups.dueSoon.map((item) => item.id)).toEqual(['due']);
    expect(groups.upcoming.map((item) => item.id)).toEqual(['upcoming']);
  });

  it('validates recurring item input', () => {
    expect(
      validateRecurringItemInput({
        name: ' Rent ',
        kind: 'expense',
        amountMinor: 215000,
        currencyCode: 'aud',
        accountId: 'everyday',
        categoryId: 'housing',
        subcategoryId: 'rent',
        frequency: 'monthly',
        nextDueDate: '2026-05-31',
      }),
    ).toEqual(
      expect.objectContaining({
        name: 'Rent',
        currencyCode: 'AUD',
        isActive: true,
      }),
    );

    expect(() =>
      validateRecurringItemInput({
        name: '',
        kind: 'expense',
        amountMinor: 0,
        currencyCode: 'AUD',
        accountId: '',
        categoryId: '',
        frequency: 'monthly',
        nextDueDate: 'bad',
      }),
    ).toThrow('Recurring item name is required.');
  });

  it('builds a normal expense transaction input from a recurring item', () => {
    const input = buildTransactionInputFromRecurringItem({
      accounts,
      item: recurringItem({
        name: 'Streaming',
        kind: 'expense',
        amountMinor: 1899,
        categoryId: 'entertainment',
        subcategoryId: 'streaming',
        note: 'Family plan',
        nextDueDate: '2026-05-14',
      }),
    });

    expect(input).toEqual({
      kind: 'expense',
      title: 'Streaming',
      datetime: new Date(2026, 4, 14, 12, 0, 0, 0).toISOString(),
      notes: 'Family plan',
      lines: [
        {
          accountId: 'everyday',
          amountMinor: -1899,
          currencyCode: 'AUD',
          categoryId: 'entertainment',
          subcategoryId: 'streaming',
          note: 'Family plan',
        },
      ],
    });
  });

  it('builds a normal income transaction input from a recurring item', () => {
    const input = buildTransactionInputFromRecurringItem({
      accounts,
      item: recurringItem({
        name: 'Salary',
        kind: 'income',
        amountMinor: 320000,
        categoryId: 'income',
        subcategoryId: 'salary',
        nextDueDate: '2026-05-29',
      }),
      transactionDate: '2026-05-30',
      transactionTime: '09:15',
    });

    expect(input.kind).toBe('income');
    expect(input.datetime).toBe(new Date(2026, 4, 30, 9, 15, 0, 0).toISOString());
    expect(input.lines[0]).toEqual(
      expect.objectContaining({
        amountMinor: 320000,
        categoryId: 'income',
        subcategoryId: 'salary',
      }),
    );
  });

  it('blocks transaction input creation when template references are invalid', () => {
    expect(() =>
      buildTransactionInputFromRecurringItem({
        accounts,
        item: recurringItem({ categoryId: 'missing', subcategoryId: 'missing' }),
      }),
    ).toThrow('Recurring item category needs attention.');

    expect(() =>
      buildTransactionInputFromRecurringItem({
        accounts: [],
        item: recurringItem({}),
      }),
    ).toThrow('Recurring item account needs attention.');
  });

  it('advances the next due date from the recorded occurrence date', () => {
    expect(advanceRecurringDueDate(recurringItem({ frequency: 'fortnightly', nextDueDate: '2026-05-15' }))).toBe(
      '2026-05-29',
    );
  });

  it('selects the newest undoable transaction for each recurring item', () => {
    const latestByItem = getLatestRecurringTransactionHistoryByItem([
      recurringHistory({ id: 'rent-1', recurringItemId: 'rent', sequence: 1 }),
      recurringHistory({ id: 'salary-1', recurringItemId: 'salary', sequence: 1 }),
      recurringHistory({ id: 'rent-2', recurringItemId: 'rent', sequence: 2 }),
    ]);

    expect(latestByItem.get('rent')?.id).toBe('rent-2');
    expect(latestByItem.get('salary')?.id).toBe('salary-1');
  });
});

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

function recurringHistory(
  overrides: Partial<RecurringTransactionHistory>,
): RecurringTransactionHistory {
  return {
    id: 'history-1',
    recurringItemId: 'recurring-1',
    transactionId: 'transaction-1',
    previousNextDueDate: '2026-05-01',
    advancedNextDueDate: '2026-06-01',
    sequence: 1,
    createdAt: now,
    ...overrides,
  };
}
