import type { BudgetPeriod, DateRange } from './types';

export const budgetMonthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type BudgetPeriodOption = {
  description: string;
  group: 'calendar' | 'rolling';
  label: string;
  value: BudgetPeriod;
};

export const budgetPeriodOptions: BudgetPeriodOption[] = [
  { value: 'weekly', label: 'Weekly', description: 'Calendar week', group: 'calendar' },
  { value: 'monthly', label: 'Monthly', description: 'Calendar month', group: 'calendar' },
  { value: 'yearly', label: 'Yearly', description: 'Calendar year', group: 'calendar' },
  { value: 'rolling_7', label: 'Rolling 7 days', description: 'Last 7 days, updates daily', group: 'rolling' },
  { value: 'rolling_30', label: 'Rolling 30 days', description: 'Last 30 days, updates daily', group: 'rolling' },
  {
    value: 'rolling_365',
    label: 'Rolling 365 days',
    description: 'Last 365 days, updates daily',
    group: 'rolling',
  },
];

export function getBudgetMonthlyRange(date = new Date()): DateRange {
  return getBudgetPeriodRange('monthly', date);
}

export function getBudgetPeriodRange(
  period: BudgetPeriod,
  date = new Date(),
  offset = 0,
): DateRange {
  const year = date.getFullYear();
  const month = date.getMonth();
  let start: Date;
  let end: Date;

  switch (period) {
    case 'weekly': {
      const dayOffsetFromMonday = (date.getDay() + 6) % 7;
      start = new Date(year, month, date.getDate() - dayOffsetFromMonday + offset * 7);
      end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
      break;
    }
    case 'monthly':
      start = new Date(year, month + offset, 1);
      end = new Date(year, month + offset + 1, 1);
      break;
    case 'yearly':
      start = new Date(year + offset, 0, 1);
      end = new Date(year + offset + 1, 0, 1);
      break;
    case 'rolling_7':
    case 'rolling_30':
    case 'rolling_365': {
      const rollingDays = getRollingBudgetDays(period);
      const anchor = new Date(year, month, date.getDate() + offset);
      start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - rollingDays + 1);
      end = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 1);
      break;
    }
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function getBudgetPeriodCurrentLabel(period: BudgetPeriod): string {
  switch (period) {
    case 'weekly':
      return 'This week';
    case 'monthly':
      return 'This month';
    case 'yearly':
      return 'This year';
    case 'rolling_7':
      return 'Rolling 7 days';
    case 'rolling_30':
      return 'Rolling 30 days';
    case 'rolling_365':
      return 'Rolling 365 days';
  }
}

export function getBudgetPeriodUnitLabel(period: BudgetPeriod): string {
  switch (period) {
    case 'weekly':
      return 'week';
    case 'monthly':
      return 'month';
    case 'yearly':
      return 'year';
    case 'rolling_7':
    case 'rolling_30':
    case 'rolling_365':
      return 'day';
  }
}

export function getBudgetPeriodOffsetLabel(period: BudgetPeriod, offset: number): string {
  if (isRollingBudgetPeriod(period)) {
    if (offset === 0) {
      return getBudgetPeriodCurrentLabel(period);
    }
    return offset < 0
      ? `${Math.abs(offset)} ${pluralizeDay(Math.abs(offset))} back`
      : `${offset} ${pluralizeDay(offset)} ahead`;
  }

  const unit = getBudgetPeriodUnitLabel(period);
  if (offset === 0) {
    return getBudgetPeriodCurrentLabel(period);
  }
  if (offset === -1) {
    return `Previous ${unit}`;
  }
  if (offset === 1) {
    return `Next ${unit}`;
  }
  return offset < 0
    ? `${Math.abs(offset)} ${unit}s ago`
    : `${offset} ${unit}s ahead`;
}

export function getBudgetPeriodLabel(period: BudgetPeriod): string {
  return budgetPeriodOptions.find((option) => option.value === period)?.label ?? 'Monthly';
}

export function getBudgetPeriodDescription(period: BudgetPeriod): string {
  return budgetPeriodOptions.find((option) => option.value === period)?.description ?? 'Calendar month';
}

export function isRollingBudgetPeriod(
  period: BudgetPeriod,
): period is 'rolling_7' | 'rolling_30' | 'rolling_365' {
  return period === 'rolling_7' || period === 'rolling_30' || period === 'rolling_365';
}

export function getRollingBudgetDays(period: BudgetPeriod): number {
  switch (period) {
    case 'rolling_7':
      return 7;
    case 'rolling_30':
      return 30;
    case 'rolling_365':
      return 365;
    default:
      throw new Error('Budget period is not rolling.');
  }
}

export function formatBudgetPeriodRange(range: DateRange): string {
  const start = new Date(range.startIso);
  const end = new Date(range.endIso);
  end.setDate(end.getDate() - 1);

  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = budgetMonthLabels[start.getMonth()];
  const endMonth = budgetMonthLabels[end.getMonth()];
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startYear === endYear && start.getMonth() === end.getMonth()) {
    return `${startDay}-${endDay} ${endMonth} ${endYear}`;
  }
  if (startYear === endYear) {
    return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${endYear}`;
  }
  return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`;
}

export function pluralizeDay(value: number): string {
  return value === 1 ? 'day' : 'days';
}
