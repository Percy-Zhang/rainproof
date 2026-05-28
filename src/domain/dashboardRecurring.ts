import { classifyRecurringItemsByDueDate } from './recurringItems';
import type { RecurringItem, UpcomingRecurringItem } from './types';

export type DashboardRecurringSummary = {
  activeCount: number;
  rows: UpcomingRecurringItem[];
};

export function getDashboardRecurringSummary(
  recurringItems: RecurringItem[],
  options: { dueSoonDays?: number; fromDate?: string | Date; limit?: number } = {},
): DashboardRecurringSummary {
  const groups = classifyRecurringItemsByDueDate(recurringItems, {
    dueSoonDays: options.dueSoonDays,
    fromDate: options.fromDate,
  });
  const orderedRows = [
    ...groups.overdue,
    ...groups.dueSoon,
    ...groups.upcoming,
  ];
  const limit = Math.max(0, Math.trunc(options.limit ?? 4));

  return {
    activeCount: orderedRows.length,
    rows: orderedRows.slice(0, limit),
  };
}
