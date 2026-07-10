import { toDateInputValue } from './dates';
import type { UpcomingPaymentForecastOccurrence } from './upcomingPaymentForecast';
import type { DateRange } from './types';

export type ForecastBalancePoint = {
  date: string;
  balanceMinor: number;
};

export type ForecastDayEvent = {
  date: string;
  netChangeMinor: number;
  projectedBalanceMinor: number;
  occurrences: UpcomingPaymentForecastOccurrence[];
};

export type ForecastBalanceResult = {
  points: ForecastBalancePoint[];
  events: ForecastDayEvent[];
};

type IndexedOccurrence = {
  occurrence: UpcomingPaymentForecastOccurrence;
  sourceIndex: number;
};

export function getForecastBalanceProjection({
  occurrences,
  range,
  startingBalanceMinor,
}: {
  occurrences: UpcomingPaymentForecastOccurrence[];
  range: DateRange;
  startingBalanceMinor: number;
}): ForecastBalanceResult {
  const startDay = startOfLocalDay(new Date(range.startIso));
  const lastPointDay = getInclusiveEndDay(range.endIso);
  const rangeStartTime = new Date(range.startIso).getTime();
  const rangeEndTime = new Date(range.endIso).getTime();

  if (
    Number.isNaN(startDay.getTime()) ||
    Number.isNaN(lastPointDay.getTime()) ||
    !Number.isFinite(rangeStartTime) ||
    !Number.isFinite(rangeEndTime) ||
    rangeEndTime <= rangeStartTime ||
    lastPointDay < startDay
  ) {
    return { events: [], points: [] };
  }

  const occurrencesByDate = groupOccurrencesByDate(occurrences, rangeStartTime, rangeEndTime);
  const points: ForecastBalancePoint[] = [];
  const events: ForecastDayEvent[] = [];
  let projectedBalanceMinor = startingBalanceMinor;

  for (let day = startDay; day <= lastPointDay; day = addLocalDays(day, 1)) {
    const date = toDateInputValue(day);
    const dayOccurrences = occurrencesByDate.get(date) ?? [];

    if (dayOccurrences.length) {
      const netChangeMinor = dayOccurrences.reduce(
        (sum, occurrence) => sum + occurrence.amountMinor,
        0,
      );
      projectedBalanceMinor += netChangeMinor;
      events.push({
        date,
        netChangeMinor,
        occurrences: dayOccurrences,
        projectedBalanceMinor,
      });
    }

    points.push({
      date,
      balanceMinor: projectedBalanceMinor,
    });
  }

  return { events, points };
}

function groupOccurrencesByDate(
  occurrences: UpcomingPaymentForecastOccurrence[],
  rangeStartTime: number,
  rangeEndTime: number,
): Map<string, UpcomingPaymentForecastOccurrence[]> {
  const sortedOccurrences = occurrences
    .map((occurrence, sourceIndex) => ({ occurrence, sourceIndex }))
    .filter(({ occurrence }) => isOccurrenceInsideRange(occurrence, rangeStartTime, rangeEndTime))
    .sort(compareIndexedOccurrences);
  const occurrencesByDate = new Map<string, UpcomingPaymentForecastOccurrence[]>();

  for (const { occurrence } of sortedOccurrences) {
    const existing = occurrencesByDate.get(occurrence.occurrenceDate) ?? [];
    existing.push(occurrence);
    occurrencesByDate.set(occurrence.occurrenceDate, existing);
  }

  return occurrencesByDate;
}

function isOccurrenceInsideRange(
  occurrence: UpcomingPaymentForecastOccurrence,
  rangeStartTime: number,
  rangeEndTime: number,
): boolean {
  const occurrenceTime = getDateOnlyTime(occurrence.occurrenceDate);
  return (
    Number.isFinite(occurrenceTime) &&
    occurrenceTime >= rangeStartTime &&
    occurrenceTime < rangeEndTime
  );
}

function compareIndexedOccurrences(left: IndexedOccurrence, right: IndexedOccurrence): number {
  return (
    left.occurrence.occurrenceDate.localeCompare(right.occurrence.occurrenceDate) ||
    left.sourceIndex - right.sourceIndex
  );
}

function getDateOnlyTime(dateOnly: string): number {
  const match = dateOnly.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return Number.NaN;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day, 12, 0, 0, 0);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return Number.NaN;
  }

  return date.getTime();
}

function getInclusiveEndDay(endIso: string): Date {
  return startOfLocalDay(new Date(new Date(endIso).getTime() - 1));
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
