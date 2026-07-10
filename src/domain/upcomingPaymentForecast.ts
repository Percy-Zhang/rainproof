import { normalizeCurrencyCode } from './money';
import {
  calculateNextRecurringDueDate,
  dateOnlyToLocalDate,
  isValidDateOnly,
} from './recurringItems';
import type {
  Account,
  CurrencyCode,
  DateRange,
  RecurringFrequency,
  RecurringItem,
  RecurringItemKind,
} from './types';

export type UpcomingPaymentForecastOccurrence = {
  accountId: string;
  amountMinor: number;
  currencyCode: CurrencyCode;
  frequency: RecurringFrequency;
  kind: RecurringItemKind;
  occurrenceDate: string;
  occurrenceIndex: number;
  originalDueDate: string;
  planId: string;
  sourceType: 'upcoming_payment';
  title: string;
};

type ForecastOccurrenceWithSort = UpcomingPaymentForecastOccurrence & {
  sourceIndex: number;
};

export function getUpcomingPaymentForecastOccurrences({
  accountIds,
  accounts,
  currencyCode,
  maxOccurrencesPerPlan = 1000,
  range,
  recurringItems,
}: {
  accountIds: string[];
  accounts: Account[];
  currencyCode: CurrencyCode;
  maxOccurrencesPerPlan?: number;
  range: DateRange;
  recurringItems: RecurringItem[];
}): UpcomingPaymentForecastOccurrence[] {
  const rangeStartTime = new Date(range.startIso).getTime();
  const rangeEndTime = new Date(range.endIso).getTime();

  if (
    !Number.isFinite(rangeStartTime) ||
    !Number.isFinite(rangeEndTime) ||
    rangeEndTime <= rangeStartTime ||
    !accountIds.length
  ) {
    return [];
  }

  const selectedAccountIds = new Set(accountIds);
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const occurrences: ForecastOccurrenceWithSort[] = [];

  recurringItems.forEach((item, sourceIndex) => {
    if (!canForecastUpcomingPayment({
      accountById,
      item,
      normalizedCurrencyCode,
      selectedAccountIds,
    })) {
      return;
    }

    if (item.frequency === 'one_time') {
      if (isDateOnlyInsideRange(item.nextDueDate, rangeStartTime, rangeEndTime)) {
        occurrences.push(buildOccurrence(item, item.nextDueDate, 0, sourceIndex));
      }
      return;
    }

    if (!isSupportedRecurringForecastFrequency(item.frequency)) {
      return;
    }

    let occurrenceDate = item.nextDueDate;
    let occurrenceIndex = 0;
    const safeMaxOccurrences = Math.max(0, Math.trunc(maxOccurrencesPerPlan));

    while (
      occurrenceIndex < safeMaxOccurrences &&
      isValidDateOnly(occurrenceDate) &&
      getDateOnlyTime(occurrenceDate) < rangeStartTime
    ) {
      const nextDate = getNextForecastOccurrenceDate(occurrenceDate, item.frequency);
      if (!nextDate || nextDate <= occurrenceDate) {
        return;
      }

      occurrenceDate = nextDate;
      occurrenceIndex += 1;
    }

    while (
      occurrenceIndex < safeMaxOccurrences &&
      isValidDateOnly(occurrenceDate) &&
      isDateOnlyInsideRange(occurrenceDate, rangeStartTime, rangeEndTime)
    ) {
      occurrences.push(buildOccurrence(item, occurrenceDate, occurrenceIndex, sourceIndex));

      const nextDate = getNextForecastOccurrenceDate(occurrenceDate, item.frequency);
      if (!nextDate || nextDate <= occurrenceDate) {
        return;
      }

      occurrenceDate = nextDate;
      occurrenceIndex += 1;
    }
  });

  return occurrences
    .sort(compareForecastOccurrences)
    .map(({ sourceIndex: _sourceIndex, ...occurrence }) => occurrence);
}

function canForecastUpcomingPayment({
  accountById,
  item,
  normalizedCurrencyCode,
  selectedAccountIds,
}: {
  accountById: Map<string, Account>;
  item: RecurringItem;
  normalizedCurrencyCode: CurrencyCode;
  selectedAccountIds: Set<string>;
}): boolean {
  if (
    !item.isActive ||
    item.completedAt ||
    !isValidDateOnly(item.nextDueDate) ||
    !isForecastOccurrenceKind(item.kind)
  ) {
    return false;
  }

  const account = accountById.get(item.accountId);
  if (!account || account.isArchived || !selectedAccountIds.has(item.accountId)) {
    return false;
  }

  return (
    normalizeCurrencyCode(item.currencyCode) === normalizedCurrencyCode &&
    normalizeCurrencyCode(account.currencyCode) === normalizedCurrencyCode
  );
}

function buildOccurrence(
  item: RecurringItem,
  occurrenceDate: string,
  occurrenceIndex: number,
  sourceIndex: number,
): ForecastOccurrenceWithSort {
  return {
    accountId: item.accountId,
    amountMinor: item.kind === 'income' ? Math.abs(item.amountMinor) : -Math.abs(item.amountMinor),
    currencyCode: normalizeCurrencyCode(item.currencyCode),
    frequency: item.frequency,
    kind: item.kind,
    occurrenceDate,
    occurrenceIndex,
    originalDueDate: item.nextDueDate,
    planId: item.id,
    sourceIndex,
    sourceType: 'upcoming_payment',
    title: item.name,
  };
}

function isDateOnlyInsideRange(dateOnly: string, rangeStartTime: number, rangeEndTime: number): boolean {
  const dateTime = getDateOnlyTime(dateOnly);
  return dateTime >= rangeStartTime && dateTime < rangeEndTime;
}

function getDateOnlyTime(dateOnly: string): number {
  return dateOnlyToLocalDate(dateOnly).getTime();
}

function getNextForecastOccurrenceDate(
  occurrenceDate: string,
  frequency: RecurringFrequency,
): string | null {
  try {
    return calculateNextRecurringDueDate(occurrenceDate, frequency);
  } catch {
    return null;
  }
}

function isSupportedRecurringForecastFrequency(frequency: RecurringFrequency): boolean {
  return frequency === 'weekly' || frequency === 'fortnightly' || frequency === 'monthly' || frequency === 'yearly';
}

function isForecastOccurrenceKind(kind: RecurringItemKind): boolean {
  return kind === 'income' || kind === 'expense';
}

function compareForecastOccurrences(
  left: ForecastOccurrenceWithSort,
  right: ForecastOccurrenceWithSort,
): number {
  return (
    left.occurrenceDate.localeCompare(right.occurrenceDate) ||
    left.sourceIndex - right.sourceIndex ||
    left.occurrenceIndex - right.occurrenceIndex ||
    left.planId.localeCompare(right.planId)
  );
}
