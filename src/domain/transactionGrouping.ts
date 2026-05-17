import type { DateRange } from './types';

export type TransactionGroupGranularity = 'day' | 'week' | 'month';

const dayMs = 24 * 60 * 60 * 1000;
const monthLabels = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function getTransactionGroupGranularity(range: DateRange): TransactionGroupGranularity {
  const start = new Date(range.startIso).getTime();
  const end = new Date(range.endIso).getTime();
  const days = Math.max(1, Math.ceil((end - start) / dayMs));

  if (days < 14) {
    return 'day';
  }

  if (days > 93) {
    return 'month';
  }

  return 'week';
}

export function getTransactionGroupKey(isoDate: string, granularity: TransactionGroupGranularity): string {
  const date = new Date(isoDate);

  if (granularity === 'day') {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  if (granularity === 'month') {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0')].join('-');
  }

  return `${date.getFullYear()}-W${String(getWeekOfYear(date)).padStart(2, '0')}`;
}

export function getTransactionGroupLabel(isoDate: string, granularity: TransactionGroupGranularity): string {
  const date = new Date(isoDate);

  if (granularity === 'day') {
    return `${monthLabels[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
  }

  if (granularity === 'month') {
    return `${monthLabels[date.getMonth()]} ${date.getFullYear()}`;
  }

  return `Week ${getWeekOfYear(date)}`;
}

export function getNextGroupBoundaryIso(isoDate: string, granularity: TransactionGroupGranularity): string {
  const date = new Date(isoDate);
  let next: Date;

  if (granularity === 'day') {
    next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  } else if (granularity === 'month') {
    next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  } else {
    const day = date.getDay();
    const daysUntilNextMonday = day === 0 ? 1 : 8 - day;
    next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + daysUntilNextMonday);
  }

  return next.toISOString();
}

function getWeekOfYear(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((startOfDay(date).getTime() - startOfDay(startOfYear).getTime()) / dayMs);
  return Math.floor((days + startOfYear.getDay()) / 7) + 1;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
