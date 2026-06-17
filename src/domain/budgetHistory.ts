import {
  budgetMonthLabels,
  formatBudgetPeriodRange,
  getBudgetPeriodRange,
  getRollingBudgetDays,
  isRollingBudgetPeriod,
} from './budgetPeriods';
import { getBudgetUsageForRows } from './budgetUsage';
import { normalizeCurrencyCode } from './money';
import { getStatsReport, type StatsReportLineRow } from './statsReports';
import type {
  Account,
  Budget,
  CategoryDefinition,
  DateRange,
  Transaction,
  TransactionLine,
  TransactionLink,
} from './types';

export type BudgetHistoryPoint = {
  id: string;
  offset: number;
  shortLabel: string;
  rangeLabel: string;
  range: DateRange;
  limitMinor: number;
  spentMinor: number;
  remainingMinor: number;
  percentageUsed: number;
  status: ReturnType<typeof getBudgetUsageForRows>['status'];
};

type BudgetHistoryInput = {
  accounts: Account[];
  anchorDate?: Date;
  budget: Budget;
  categories: CategoryDefinition[];
  endOffset?: number;
  offsetStep?: number;
  pointCount?: number;
  transactionLines: TransactionLine[];
  transactionLinks: TransactionLink[];
  transactions: Transaction[];
};

export function getBudgetCurrentHistoryPointsForBudget(input: BudgetHistoryInput): BudgetHistoryPoint[] {
  if (input.budget.period === 'yearly') {
    return getYearlyBudgetProgressHistory(input);
  }

  return getDailyCumulativeBudgetHistory(input);
}

export function getBudgetCompareHistoryPointsForBudget(input: BudgetHistoryInput): BudgetHistoryPoint[] {
  switch (input.budget.period) {
    case 'weekly':
      return getBudgetHistoryForBudget({ ...input, pointCount: input.pointCount ?? 6 });
    case 'monthly':
      return getBudgetHistoryForBudget({ ...input, pointCount: input.pointCount ?? 12 });
    case 'yearly':
      return getBudgetHistoryForBudget({ ...input, pointCount: input.pointCount ?? 6 });
    case 'rolling_7':
    case 'rolling_30':
    case 'rolling_365':
      return getBudgetHistoryForBudget({
        ...input,
        offsetStep: input.offsetStep ?? getRollingBudgetDays(input.budget.period),
        pointCount: input.pointCount ?? 6,
      });
  }
}

export function getBudgetHistoryForBudget({
  accounts,
  anchorDate = new Date(),
  budget,
  categories,
  endOffset = 0,
  offsetStep = 1,
  pointCount = 6,
  transactionLines,
  transactionLinks,
  transactions,
}: BudgetHistoryInput): BudgetHistoryPoint[] {
  const count = Math.max(1, Math.floor(pointCount));
  const step = Math.max(1, Math.floor(offsetStep));
  const firstOffset = endOffset - (count - 1) * step;

  return Array.from({ length: count }, (_, index) => firstOffset + index * step).map((offset) => {
    const range = getBudgetPeriodRange(budget.period, anchorDate, offset);
    const usage = getBudgetUsageForRange({
      accounts,
      budget,
      categories,
      range,
      transactionLines,
      transactionLinks,
      transactions,
    });

    return {
      id: `${budget.id}:${offset}`,
      offset,
      shortLabel: getBudgetHistoryShortLabel(budget.period, range),
      rangeLabel: formatBudgetPeriodRange(range),
      range,
      limitMinor: budget.amountMinor,
      spentMinor: usage.spentMinor,
      remainingMinor: usage.remainingMinor,
      percentageUsed: usage.percentageUsed,
      status: usage.status,
    };
  });
}

function getDailyCumulativeBudgetHistory({
  accounts,
  anchorDate = new Date(),
  budget,
  categories,
  endOffset = 0,
  transactionLines,
  transactionLinks,
  transactions,
}: BudgetHistoryInput): BudgetHistoryPoint[] {
  const fullRange = getBudgetPeriodRange(budget.period, anchorDate, endOffset);
  const start = new Date(fullRange.startIso);
  const end = new Date(fullRange.endIso);
  const dayEnds = getDailyRangeEndDates(start, end);
  const reportRows = getBudgetReportRowsForRange({
    accounts,
    budget,
    categories,
    range: fullRange,
    transactionLines,
    transactionLinks,
    transactions,
  });

  return dayEnds.map((dayEnd, index) => {
    const range = {
      startIso: start.toISOString(),
      endIso: dayEnd.toISOString(),
    };
    const usage = getBudgetUsageForRows(
      budget,
      reportRows.filter((row) => row.transactionDatetime < range.endIso),
    );

    return {
      id: `${budget.id}:current:${endOffset}:${index}`,
      offset: index,
      shortLabel: formatBudgetDayLabel(addLocalDays(dayEnd, -1)),
      rangeLabel: formatBudgetPeriodRange(range),
      range,
      limitMinor: budget.amountMinor,
      spentMinor: usage.spentMinor,
      remainingMinor: usage.remainingMinor,
      percentageUsed: usage.percentageUsed,
      status: usage.status,
    };
  });
}

function getYearlyBudgetProgressHistory({
  accounts,
  anchorDate = new Date(),
  budget,
  categories,
  endOffset = 0,
  pointCount,
  transactionLines,
  transactionLinks,
  transactions,
}: BudgetHistoryInput): BudgetHistoryPoint[] {
  const yearRange = getBudgetPeriodRange('yearly', anchorDate, endOffset);
  const yearStart = new Date(yearRange.startIso);
  const reportRows = getBudgetReportRowsForRange({
    accounts,
    budget,
    categories,
    range: yearRange,
    transactionLines,
    transactionLinks,
    transactions,
  });
  const monthCount = Math.max(
    1,
    Math.min(12, Math.floor(pointCount ?? 12)),
  );

  return Array.from({ length: monthCount }, (_, monthIndex) => {
    const range = {
      startIso: yearStart.toISOString(),
      endIso: new Date(yearStart.getFullYear(), monthIndex + 1, 1, 0, 0, 0, 0).toISOString(),
    };
    const usage = getBudgetUsageForRows(
      budget,
      reportRows.filter((row) => row.transactionDatetime < range.endIso),
    );

    return {
      id: `${budget.id}:yearly:${endOffset}:${monthIndex}`,
      offset: monthIndex,
      shortLabel: budgetMonthLabels[monthIndex],
      rangeLabel: formatBudgetPeriodRange(range),
      range,
      limitMinor: budget.amountMinor,
      spentMinor: usage.spentMinor,
      remainingMinor: usage.remainingMinor,
      percentageUsed: usage.percentageUsed,
      status: usage.status,
    };
  });
}

function getBudgetUsageForRange({
  accounts,
  budget,
  categories,
  range,
  transactionLines,
  transactionLinks,
  transactions,
}: {
  accounts: Account[];
  budget: Budget;
  categories: CategoryDefinition[];
  range: DateRange;
  transactionLines: TransactionLine[];
  transactionLinks: TransactionLink[];
  transactions: Transaction[];
}) {
  return getBudgetUsageForRows(
    budget,
    getBudgetReportRowsForRange({
      accounts,
      budget,
      categories,
      range,
      transactionLines,
      transactionLinks,
      transactions,
    }),
  );
}

function getBudgetReportRowsForRange({
  accounts,
  budget,
  categories,
  range,
  transactionLines,
  transactionLinks,
  transactions,
}: {
  accounts: Account[];
  budget: Budget;
  categories: CategoryDefinition[];
  range: DateRange;
  transactionLines: TransactionLine[];
  transactionLinks: TransactionLink[];
  transactions: Transaction[];
}): StatsReportLineRow[] {
  const report = getStatsReport({
    reportKind: 'expense',
    transactions,
    transactionLines,
    transactionLinks,
    accounts,
    categories,
    range,
    currencyCode: normalizeCurrencyCode(budget.currencyCode),
  });

  return report.rows;
}

function getDailyRangeEndDates(start: Date, end: Date): Date[] {
  const days: Date[] = [];

  for (let dayEnd = addLocalDays(start, 1); dayEnd.getTime() <= end.getTime(); dayEnd = addLocalDays(dayEnd, 1)) {
    days.push(dayEnd);
  }

  return days;
}

function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 0, 0, 0, 0);
}

function formatBudgetDayLabel(date: Date): string {
  return `${date.getDate()} ${budgetMonthLabels[date.getMonth()]}`;
}

function getBudgetHistoryShortLabel(period: Budget['period'], range: DateRange): string {
  const start = new Date(range.startIso);
  const end = new Date(range.endIso);
  end.setDate(end.getDate() - 1);

  if (period === 'yearly') {
    return String(start.getFullYear());
  }

  if (period === 'monthly') {
    return budgetMonthLabels[start.getMonth()];
  }

  const labelDate = isRollingBudgetPeriod(period) ? end : start;
  return `${labelDate.getDate()} ${budgetMonthLabels[labelDate.getMonth()]}`;
}
