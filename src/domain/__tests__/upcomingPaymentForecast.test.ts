import { getInclusiveDateRange } from '../dates';
import { getUpcomingPaymentForecastOccurrences } from '../upcomingPaymentForecast';
import type { Account, RecurringFrequency, RecurringItem } from '../types';

describe('upcoming payment forecast occurrences', () => {
  it('includes a one-time expense inside the requested range', () => {
    expect(occurrences([
      recurringItem({ id: 'vet', name: 'Vet bill', frequency: 'one_time', nextDueDate: '2026-07-10' }),
    ])).toEqual([
      expect.objectContaining({
        planId: 'vet',
        occurrenceDate: '2026-07-10',
        amountMinor: -12000,
        kind: 'expense',
        title: 'Vet bill',
      }),
    ]);
  });

  it('includes a one-time income inside the requested range', () => {
    expect(occurrences([
      recurringItem({
        id: 'rebate',
        name: 'Rebate',
        kind: 'income',
        frequency: 'one_time',
        amountMinor: 45000,
        nextDueDate: '2026-07-10',
        categoryId: 'income',
        subcategoryId: 'salary',
      }),
    ])).toEqual([
      expect.objectContaining({
        planId: 'rebate',
        occurrenceDate: '2026-07-10',
        amountMinor: 45000,
        kind: 'income',
      }),
    ]);
  });

  it('excludes a one-time plan outside the requested range', () => {
    expect(occurrences([
      recurringItem({ frequency: 'one_time', nextDueDate: '2026-10-01' }),
    ])).toEqual([]);
  });

  it('excludes completed one-time plans', () => {
    expect(occurrences([
      recurringItem({
        frequency: 'one_time',
        nextDueDate: '2026-07-10',
        completedAt: '2026-07-10T09:00:00.000Z',
      }),
    ])).toEqual([]);
  });

  it('excludes inactive plans and plans attached to archived accounts', () => {
    expect(occurrences([
      recurringItem({ id: 'inactive', isActive: false, nextDueDate: '2026-07-10' }),
      recurringItem({ id: 'archived-account', accountId: 'archived', nextDueDate: '2026-07-10' }),
    ], {
      accountIds: ['everyday', 'archived'],
      accounts: [
        account('everyday', 'AUD'),
        account('archived', 'AUD', { isArchived: true }),
      ],
    })).toEqual([]);
  });

  it('expands a monthly recurring expense from the authoritative current due date', () => {
    expect(occurrences([
      recurringItem({
        id: 'rent',
        amountMinor: 200000,
        frequency: 'monthly',
        nextDueDate: '2026-07-15',
      }),
    ], {
      endDate: '2026-09-30',
      startDate: '2026-07-01',
    }).map(summary)).toEqual([
      ['rent', '2026-07-15', -200000, 0],
      ['rent', '2026-08-15', -200000, 1],
      ['rent', '2026-09-15', -200000, 2],
    ]);
  });

  it('expands recurring income consistently as positive balance movement', () => {
    expect(occurrences([
      recurringItem({
        id: 'salary',
        kind: 'income',
        amountMinor: 320000,
        frequency: 'fortnightly',
        nextDueDate: '2026-07-03',
        categoryId: 'income',
        subcategoryId: 'salary',
      }),
    ], {
      endDate: '2026-07-31',
      startDate: '2026-07-01',
    }).map(summary)).toEqual([
      ['salary', '2026-07-03', 320000, 0],
      ['salary', '2026-07-17', 320000, 1],
      ['salary', '2026-07-31', 320000, 2],
    ]);
  });

  it('does not duplicate completed recurring occurrences that already advanced the current due date', () => {
    expect(occurrences([
      recurringItem({
        id: 'rent',
        frequency: 'monthly',
        nextDueDate: '2026-08-15',
      }),
    ], {
      endDate: '2026-09-30',
      startDate: '2026-07-01',
    }).map(summary)).toEqual([
      ['rent', '2026-08-15', -12000, 0],
      ['rent', '2026-09-15', -12000, 1],
    ]);
  });

  it('uses start-inclusive and end-exclusive date boundaries', () => {
    expect(occurrences([
      recurringItem({ id: 'start', frequency: 'one_time', nextDueDate: '2026-07-15' }),
      recurringItem({ id: 'end', frequency: 'one_time', nextDueDate: '2026-07-16' }),
    ], {
      endDate: '2026-07-15',
      startDate: '2026-07-15',
    }).map((occurrence) => occurrence.planId)).toEqual(['start']);
  });

  it('includes due-today items when today is inside the requested range', () => {
    expect(occurrences([
      recurringItem({ id: 'today', frequency: 'one_time', nextDueDate: '2026-07-10' }),
    ], {
      endDate: '2026-07-10',
      startDate: '2026-07-10',
    }).map((occurrence) => occurrence.planId)).toEqual(['today']);
  });

  it('counts split expense plans once using the plan amount', () => {
    expect(occurrences([
      recurringItem({
        id: 'rates',
        amountMinor: 12000,
        nextDueDate: '2026-07-10',
        splitLines: [
          recurringSplitLine({ amountMinor: 7000, note: 'Council' }),
          recurringSplitLine({ id: 'split-2', amountMinor: 5000, note: 'Water', sortOrder: 1 }),
        ],
      }),
    ]).map(summary)).toEqual([
      ['rates', '2026-07-10', -12000, 0],
    ]);
  });

  it('filters by selected account IDs', () => {
    expect(occurrences([
      recurringItem({ id: 'selected', accountId: 'everyday', nextDueDate: '2026-07-10' }),
      recurringItem({ id: 'other', accountId: 'savings', nextDueDate: '2026-07-10' }),
    ], {
      accountIds: ['everyday'],
      accounts: [account('everyday', 'AUD'), account('savings', 'AUD')],
    }).map((occurrence) => occurrence.planId)).toEqual(['selected']);
  });

  it('filters by active currency without converting currencies', () => {
    expect(occurrences([
      recurringItem({ id: 'aud', accountId: 'everyday', currencyCode: 'AUD', nextDueDate: '2026-07-10' }),
      recurringItem({ id: 'usd', accountId: 'usd-wallet', currencyCode: 'USD', nextDueDate: '2026-07-10' }),
      recurringItem({ id: 'mismatch', accountId: 'usd-wallet', currencyCode: 'AUD', nextDueDate: '2026-07-10' }),
    ], {
      accountIds: ['everyday', 'usd-wallet'],
      accounts: [account('everyday', 'AUD'), account('usd-wallet', 'USD')],
      currencyCode: 'USD',
    }).map((occurrence) => occurrence.planId)).toEqual(['usd']);
  });

  it('returns multiple same-day occurrences separately with deterministic ordering', () => {
    expect(occurrences([
      recurringItem({ id: 'second', name: 'Second', nextDueDate: '2026-07-12' }),
      recurringItem({ id: 'first', name: 'First', nextDueDate: '2026-07-10' }),
      recurringItem({ id: 'third', name: 'Third', nextDueDate: '2026-07-12' }),
    ]).map((occurrence) => occurrence.planId)).toEqual(['first', 'second', 'third']);
  });

  it('skips malformed recurrence data instead of looping forever', () => {
    expect(occurrences([
      recurringItem({
        id: 'bad-frequency',
        frequency: 'broken' as RecurringFrequency,
        nextDueDate: '2026-07-10',
      }),
      recurringItem({
        id: 'bad-date',
        frequency: 'monthly',
        nextDueDate: 'not-a-date',
      }),
    ])).toEqual([]);
  });

  it('limits generated occurrences per plan as a final safety guard', () => {
    expect(occurrences([
      recurringItem({ id: 'weekly', frequency: 'weekly', nextDueDate: '2026-07-01' }),
    ], {
      endDate: '2026-12-31',
      maxOccurrencesPerPlan: 2,
      startDate: '2026-07-01',
    }).map(summary)).toEqual([
      ['weekly', '2026-07-01', -12000, 0],
      ['weekly', '2026-07-08', -12000, 1],
    ]);
  });

  it('does not invent transfer forecast behavior', () => {
    expect(occurrences([
      recurringItem({
        id: 'transfer-like',
        kind: 'transfer' as RecurringItem['kind'],
        nextDueDate: '2026-07-10',
      }),
    ])).toEqual([]);
  });
});

function occurrences(
  recurringItems: RecurringItem[],
  options: {
    accountIds?: string[];
    accounts?: Account[];
    currencyCode?: string;
    endDate?: string;
    maxOccurrencesPerPlan?: number;
    startDate?: string;
  } = {},
) {
  return getUpcomingPaymentForecastOccurrences({
    accountIds: options.accountIds ?? ['everyday'],
    accounts: options.accounts ?? [account('everyday', 'AUD')],
    currencyCode: options.currencyCode ?? 'AUD',
    maxOccurrencesPerPlan: options.maxOccurrencesPerPlan,
    range: getInclusiveDateRange(options.startDate ?? '2026-07-01', options.endDate ?? '2026-07-31'),
    recurringItems,
  });
}

function summary(
  occurrence: ReturnType<typeof getUpcomingPaymentForecastOccurrences>[number],
): [string, string, number, number] {
  return [
    occurrence.planId,
    occurrence.occurrenceDate,
    occurrence.amountMinor,
    occurrence.occurrenceIndex,
  ];
}

function account(id: string, currencyCode: string, overrides: Partial<Account> = {}): Account {
  return {
    id,
    name: id,
    nickname: '',
    type: 'checking',
    currencyCode,
    openingBalanceMinor: 0,
    notes: '',
    institutionName: '',
    includeInRainyDay: false,
    themeColor: '#1876A8',
    iconName: 'wallet-outline',
    showOnDashboard: true,
    sortOrder: 0,
    isArchived: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function recurringItem(overrides: Partial<RecurringItem> = {}): RecurringItem {
  return {
    id: 'plan',
    name: 'Plan',
    kind: 'expense',
    amountMinor: 12000,
    currencyCode: 'AUD',
    accountId: 'everyday',
    categoryId: 'housing',
    subcategoryId: 'rent',
    note: '',
    frequency: 'one_time',
    nextDueDate: '2026-07-10',
    completedAt: null,
    splitLines: [],
    isActive: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function recurringSplitLine(
  overrides: Partial<RecurringItem['splitLines'][number]> = {},
): RecurringItem['splitLines'][number] {
  return {
    id: 'split-1',
    recurringItemId: 'plan',
    amountMinor: 1000,
    categoryId: 'housing',
    subcategoryId: 'rent',
    note: '',
    sortOrder: 0,
    createdAt: '',
    ...overrides,
  };
}
