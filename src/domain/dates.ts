import type { DatePreset, DateRange } from './types';

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function toDateInputValue(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function toTimeInputValue(date: Date): string {
  return [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
  ].join(':');
}

export function formatLongDateLabel(dateValue: string): string {
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day, 12));
}

export function parseDateInput(value: string): string {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error('Use YYYY-MM-DD for the date.');
  }

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Enter a valid date.');
  }

  return parsed.toISOString();
}

export function parseDateTimeInput(dateValue: string, timeValue: string): string {
  const dateMatch = dateValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) {
    throw new Error('Use YYYY-MM-DD for the date.');
  }

  const timeMatch = timeValue.trim().match(/^(\d{2}):(\d{2})$/);
  if (!timeMatch) {
    throw new Error('Use HH:MM for the time.');
  }

  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  );

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day) ||
    parsed.getHours() !== Number(hour) ||
    parsed.getMinutes() !== Number(minute)
  ) {
    throw new Error('Enter a valid date and time.');
  }

  return parsed.toISOString();
}

export function getDateRangeForPreset(preset: DatePreset, now = new Date()): DateRange {
  const end = addDays(startOfDay(now), 1);
  const endIso = end.toISOString();

  switch (preset) {
    case 'last_week':
      return { startIso: addDays(end, -7).toISOString(), endIso };
    case 'last_month':
      return { startIso: addMonths(end, -1).toISOString(), endIso };
    case 'last_quarter':
      return { startIso: addMonths(end, -3).toISOString(), endIso };
    case 'last_6_months':
      return { startIso: addMonths(end, -6).toISOString(), endIso };
    case 'last_year':
      return { startIso: addMonths(end, -12).toISOString(), endIso };
    case 'custom':
      return { startIso: addMonths(end, -1).toISOString(), endIso };
  }
}

export function getInclusiveDateRange(startDate: string, endDate: string): DateRange {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const normalizedStart = start <= end ? start : end;
  const normalizedEnd = start <= end ? end : start;
  normalizedEnd.setDate(normalizedEnd.getDate() + 1);

  return {
    startIso: normalizedStart.toISOString(),
    endIso: normalizedEnd.toISOString(),
  };
}

export function isWithinDateRange(isoDate: string, range: DateRange): boolean {
  const timestamp = new Date(isoDate).getTime();
  return timestamp >= new Date(range.startIso).getTime() && timestamp < new Date(range.endIso).getTime();
}

export const datePresetLabels: Record<DatePreset, string> = {
  last_week: 'Week',
  last_month: 'Month',
  last_quarter: 'Quarter',
  last_6_months: '6 months',
  last_year: 'Year',
  custom: 'Custom',
};
