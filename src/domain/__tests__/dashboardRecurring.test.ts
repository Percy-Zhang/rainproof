import { getDashboardRecurringSummary } from '../dashboardRecurring';
import type { RecurringItem } from '../types';

const now = '2026-05-15T12:00:00.000Z';

describe('dashboard recurring summary', () => {
  it('orders overdue, due soon, then upcoming recurring items deterministically', () => {
    const summary = getDashboardRecurringSummary(
      [
        recurringItem({ id: 'upcoming', name: 'Internet', nextDueDate: '2026-06-01' }),
        recurringItem({ id: 'due-soon', name: 'Streaming', nextDueDate: '2026-05-17' }),
        recurringItem({ id: 'overdue-late', name: 'Rent', nextDueDate: '2026-05-01' }),
        recurringItem({ id: 'overdue-early', name: 'Power', nextDueDate: '2026-05-10' }),
      ],
      { fromDate: '2026-05-15', limit: 4 },
    );

    expect(summary.rows.map((item) => `${item.id}:${item.dueStatus}`)).toEqual([
      'overdue-late:overdue',
      'overdue-early:overdue',
      'due-soon:due_soon',
      'upcoming:upcoming',
    ]);
  });

  it('excludes inactive items and limits rows without changing active count', () => {
    const summary = getDashboardRecurringSummary(
      [
        recurringItem({ id: 'one', nextDueDate: '2026-05-16' }),
        recurringItem({ id: 'two', nextDueDate: '2026-05-17' }),
        recurringItem({ id: 'three', nextDueDate: '2026-05-18' }),
        recurringItem({ id: 'inactive', nextDueDate: '2026-05-14', isActive: false }),
      ],
      { fromDate: '2026-05-15', limit: 2 },
    );

    expect(summary.activeCount).toBe(3);
    expect(summary.rows.map((item) => item.id)).toEqual(['one', 'two']);
  });

  it('returns no rows when there are no active recurring items', () => {
    expect(getDashboardRecurringSummary([
      recurringItem({ id: 'inactive', isActive: false }),
    ], { fromDate: '2026-05-15' })).toEqual({
      activeCount: 0,
      rows: [],
    });
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
