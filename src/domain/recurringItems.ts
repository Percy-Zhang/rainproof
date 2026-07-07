import {
  defaultCategories,
  getDefaultSubcategoryId,
} from './categories';
import { formatOptionalMoneyInput } from './accountForm';
import { parseDateTimeInput, toTimeInputValue } from './dates';
import { isCurrencyCode, normalizeCurrencyCode } from './money';
import { formatMinorInput } from './splitTransactionForm';
import type { AddTransactionTemplatePrefill } from './transactionTemplates';
import type {
  Account,
  CategoryDefinition,
  NewTransactionInput,
  NewRecurringItemInput,
  NewRecurringItemSplitLineInput,
  RecurringFrequency,
  RecurringItem,
  RecurringTransactionHistory,
  RecurringItemKind,
  UpdateRecurringItemInput,
  UpcomingRecurringItem,
} from './types';

export function getLatestRecurringTransactionHistoryByItem(
  history: RecurringTransactionHistory[],
): Map<string, RecurringTransactionHistory> {
  const latestByItem = new Map<string, RecurringTransactionHistory>();

  for (const entry of history) {
    const current = latestByItem.get(entry.recurringItemId);
    if (
      !current ||
      entry.sequence > current.sequence ||
      (entry.sequence === current.sequence && entry.createdAt > current.createdAt)
    ) {
      latestByItem.set(entry.recurringItemId, entry);
    }
  }

  return latestByItem;
}

export const RECURRING_DUE_SOON_DAYS = 7;

export type RecurringDueGroups = {
  overdue: UpcomingRecurringItem[];
  dueSoon: UpcomingRecurringItem[];
  upcoming: UpcomingRecurringItem[];
};

export type ValidatedRecurringItemInput = {
  name: string;
  kind: RecurringItemKind;
  amountMinor: number;
  currencyCode: string;
  accountId: string;
  categoryId: string;
  subcategoryId: string | null;
  note: string;
  frequency: RecurringFrequency;
  nextDueDate: string;
  completedAt: string | null;
  splitLines: NewRecurringItemSplitLineInput[];
  isActive: boolean;
};

type LocalDateParts = {
  year: number;
  monthIndex: number;
  day: number;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const recurringFrequencies: RecurringFrequency[] = ['one_time', 'weekly', 'fortnightly', 'monthly', 'yearly'];

export function validateRecurringItemInput(
  input: NewRecurringItemInput | UpdateRecurringItemInput,
): ValidatedRecurringItemInput {
  const name = input.name.trim();
  const accountId = input.accountId.trim();
  const categoryId = input.categoryId.trim();
  const subcategoryId = input.subcategoryId?.trim() || null;
  const note = input.note?.trim() ?? '';
  const currencyCode = input.currencyCode.trim().toUpperCase();
  const completedAt = input.completedAt?.trim() || null;

  if (!name) {
    throw new Error('Upcoming payment name is required.');
  }

  if (input.kind !== 'expense' && input.kind !== 'income') {
    throw new Error('Upcoming payment type must be income or expense.');
  }

  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('Upcoming payment amount must be greater than zero.');
  }

  if (!isCurrencyCode(currencyCode)) {
    throw new Error('Upcoming payment currency is required.');
  }

  if (!accountId) {
    throw new Error('Upcoming payment account is required.');
  }

  if (!categoryId) {
    throw new Error('Upcoming payment category is required.');
  }

  if (!recurringFrequencies.includes(input.frequency)) {
    throw new Error('Upcoming payment frequency is required.');
  }

  if (!isValidDateOnly(input.nextDueDate)) {
    throw new Error('Upcoming payment due date must use YYYY-MM-DD.');
  }
  const splitLines = normalizeRecurringSplitLines(input.splitLines);
  if (splitLines.length > 0) {
    validateRecurringSplitLines(input.kind, splitLines, input.amountMinor);
  }

  return {
    name,
    kind: input.kind,
    amountMinor: input.amountMinor,
    currencyCode: normalizeCurrencyCode(currencyCode),
    accountId,
    categoryId,
    subcategoryId,
    note,
    frequency: input.frequency,
    nextDueDate: input.nextDueDate,
    completedAt,
    splitLines,
    isActive: input.isActive ?? true,
  };
}

export function calculateNextRecurringDueDate(
  currentDueDate: string,
  frequency: RecurringFrequency,
): string {
  assertDateOnly(currentDueDate);

  switch (frequency) {
    case 'one_time':
      throw new Error('One-time upcoming payments do not repeat.');
    case 'weekly':
      return addDaysDateOnly(currentDueDate, 7);
    case 'fortnightly':
      return addDaysDateOnly(currentDueDate, 14);
    case 'monthly':
      return addMonthsDateOnly(currentDueDate, 1);
    case 'yearly':
      return addMonthsDateOnly(currentDueDate, 12);
  }
}

export function calculatePreviousRecurringDueDate(
  currentDueDate: string,
  frequency: RecurringFrequency,
): string {
  assertDateOnly(currentDueDate);

  switch (frequency) {
    case 'one_time':
      throw new Error('One-time upcoming payments cannot move between periods.');
    case 'weekly':
      return addDaysDateOnly(currentDueDate, -7);
    case 'fortnightly':
      return addDaysDateOnly(currentDueDate, -14);
    case 'monthly':
      return addMonthsDateOnly(currentDueDate, -1);
    case 'yearly':
      return addMonthsDateOnly(currentDueDate, -12);
  }
}

export function advanceRecurringDueDate(
  item: Pick<RecurringItem, 'nextDueDate' | 'frequency'>,
  occurrenceDate = item.nextDueDate,
): string {
  return calculateNextRecurringDueDate(occurrenceDate, item.frequency);
}

export function getNextMonthlyDueDateForDay(dueDay: number, from = new Date()): string {
  const startDate = toLocalDateOnly(from);
  const start = parseDateOnly(startDate);
  const day = clampDueDay(dueDay, start.year, start.monthIndex);
  let candidate = formatDateOnly(start.year, start.monthIndex, day);

  if (candidate < startDate) {
    const nextMonth = normalizeMonth(start.year, start.monthIndex + 1);
    candidate = formatDateOnly(
      nextMonth.year,
      nextMonth.monthIndex,
      clampDueDay(dueDay, nextMonth.year, nextMonth.monthIndex),
    );
  }

  return candidate;
}

export function classifyRecurringItemsByDueDate(
  items: RecurringItem[],
  options: { fromDate?: string | Date; dueSoonDays?: number } = {},
): RecurringDueGroups {
  const fromDate = normalizeDateOnlyOption(options.fromDate ?? new Date());
  const dueSoonEnd = addDaysDateOnly(fromDate, options.dueSoonDays ?? RECURRING_DUE_SOON_DAYS);
  const groups: RecurringDueGroups = {
    overdue: [],
    dueSoon: [],
    upcoming: [],
  };

  for (const item of items) {
    if (!item.isActive || item.completedAt || !isValidDateOnly(item.nextDueDate)) {
      continue;
    }

    const dueStatus: UpcomingRecurringItem['dueStatus'] =
      item.nextDueDate < fromDate
        ? 'overdue'
        : item.nextDueDate <= dueSoonEnd
          ? 'due_soon'
          : 'upcoming';
    const upcomingItem = { ...item, dueStatus };

    if (dueStatus === 'overdue') {
      groups.overdue.push(upcomingItem);
    } else if (dueStatus === 'due_soon') {
      groups.dueSoon.push(upcomingItem);
    } else {
      groups.upcoming.push(upcomingItem);
    }
  }

  groups.overdue.sort(compareUpcomingRecurringItems);
  groups.dueSoon.sort(compareUpcomingRecurringItems);
  groups.upcoming.sort(compareUpcomingRecurringItems);
  return groups;
}

export function getUpcomingRecurringItems(
  items: RecurringItem[],
  from = new Date(),
  daysAhead = 30,
): UpcomingRecurringItem[] {
  const fromDate = toLocalDateOnly(from);
  const horizon = addDaysDateOnly(fromDate, daysAhead);
  const groups = classifyRecurringItemsByDueDate(items, { fromDate, dueSoonDays: daysAhead });

  return [
    ...groups.overdue,
    ...groups.dueSoon,
  ].filter((item) => item.nextDueDate <= horizon || item.dueStatus === 'overdue');
}

export function buildTransactionInputFromRecurringItem({
  accounts,
  categories = defaultCategories,
  item,
  transactionDate,
  transactionTime = '12:00',
}: {
  accounts: Account[];
  categories?: CategoryDefinition[];
  item: RecurringItem;
  transactionDate?: string;
  transactionTime?: string;
}): NewTransactionInput {
  const account = accounts.find((candidate) => candidate.id === item.accountId && !candidate.isArchived);
  if (!account) {
    throw new Error('Recurring item account needs attention.');
  }

  const category = categories.find((candidate) => candidate.id === item.categoryId);
  if (!category || category.type !== item.kind) {
    throw new Error('Recurring item category needs attention.');
  }

  const subcategoryId = resolveRecurringSubcategoryId(item, category);
  if (!subcategoryId) {
    throw new Error('Recurring item subcategory needs attention.');
  }

  return {
    kind: item.kind,
    title: item.name,
    datetime: parseDateTimeInput(transactionDate ?? item.nextDueDate, transactionTime),
    notes: item.note,
    lines: [
      {
        accountId: item.accountId,
        amountMinor: item.kind === 'expense' ? -item.amountMinor : item.amountMinor,
        currencyCode: item.currencyCode,
        categoryId: item.categoryId,
        subcategoryId,
        note: item.note,
      },
    ],
  };
}

export function buildAddTransactionPrefillFromRecurringItem({
  accounts,
  categories = defaultCategories,
  item,
  now = new Date(),
}: {
  accounts: Account[];
  categories?: CategoryDefinition[];
  item: RecurringItem;
  now?: Date;
}): AddTransactionTemplatePrefill {
  const account = accounts.find((candidate) => candidate.id === item.accountId && !candidate.isArchived);
  if (!account) {
    throw new Error('Upcoming payment account needs attention.');
  }

  const category = categories.find((candidate) => candidate.id === item.categoryId);
  if (!category || category.type !== item.kind) {
    throw new Error('Upcoming payment category needs attention.');
  }

  const subcategoryId = resolveRecurringSubcategoryId(item, category, 'Upcoming payment');

  return {
    kind: item.kind,
    splitMode: 'standard',
    title: item.name,
    amountExpression: formatOptionalMoneyInput(item.amountMinor),
    date: item.nextDueDate,
    time: toTimeInputValue(now),
    accountId: account.id,
    categoryId: item.categoryId,
    subcategoryId,
    notes: item.note,
    splitLines: item.kind === 'expense'
      ? item.splitLines.map((line) => ({
        id: line.id,
        amount: formatMinorInput(line.amountMinor),
        categoryId: line.categoryId,
        subcategoryId: line.subcategoryId,
        note: line.note,
      }))
      : [],
  };
}

export function buildUpcomingPaymentPostSaveInput(
  item: RecurringItem,
  accounts: Account[] = [],
  completedAt = new Date().toISOString(),
): UpdateRecurringItemInput {
  const baseInput = buildRecurringItemUpdateInput(item, accounts);

  if (item.frequency === 'one_time') {
    return {
      ...baseInput,
      nextDueDate: item.nextDueDate,
      completedAt,
    };
  }

  return {
    ...baseInput,
    nextDueDate: advanceRecurringDueDate(item),
    completedAt: null,
  };
}

export function buildRecurringDueDateShiftInput(
  item: RecurringItem,
  direction: 'previous' | 'next',
  accounts: Account[] = [],
): UpdateRecurringItemInput {
  if (item.frequency === 'one_time') {
    throw new Error('One-time upcoming payments cannot move between periods.');
  }

  const baseInput = buildRecurringItemUpdateInput(item, accounts);
  return {
    ...baseInput,
    nextDueDate: direction === 'previous'
      ? calculatePreviousRecurringDueDate(item.nextDueDate, item.frequency)
      : calculateNextRecurringDueDate(item.nextDueDate, item.frequency),
    completedAt: null,
  };
}

export function isValidDateOnly(value: string): boolean {
  try {
    parseDateOnly(value);
    return true;
  } catch {
    return false;
  }
}

export function toLocalDateOnly(date: Date): string {
  return formatDateOnly(date.getFullYear(), date.getMonth(), date.getDate());
}

export function dateOnlyToLocalDate(value: string): Date {
  const parts = parseDateOnly(value);
  return new Date(parts.year, parts.monthIndex, parts.day, 12, 0, 0, 0);
}

export function getRecurringCurrencyCodeForAccount(accounts: Account[], accountId: string): string {
  return accounts.find((account) => account.id === accountId && !account.isArchived)?.currencyCode ?? '';
}

function resolveRecurringSubcategoryId(
  item: Pick<RecurringItem, 'subcategoryId'>,
  category: CategoryDefinition,
  label = 'Recurring item',
): string {
  if (!item.subcategoryId) {
    return getDefaultSubcategoryId(category);
  }

  const subcategory = category.subcategories.find((candidate) => candidate.id === item.subcategoryId);
  if (!subcategory) {
    throw new Error(`${label} subcategory needs attention.`);
  }

  return subcategory.id;
}

function buildRecurringItemUpdateInput(
  item: RecurringItem,
  accounts: Account[] = [],
): UpdateRecurringItemInput {
  const accountCurrencyCode = getRecurringCurrencyCodeForAccount(accounts, item.accountId);

  return {
    id: item.id,
    name: item.name,
    kind: item.kind,
    amountMinor: item.amountMinor,
    currencyCode: accountCurrencyCode || item.currencyCode,
    accountId: item.accountId,
    categoryId: item.categoryId,
    subcategoryId: item.subcategoryId,
    note: item.note,
    frequency: item.frequency,
    nextDueDate: item.nextDueDate,
    completedAt: item.completedAt,
    splitLines: item.splitLines.map((line) => ({
      amountMinor: line.amountMinor,
      categoryId: line.categoryId,
      subcategoryId: line.subcategoryId,
      note: line.note,
    })),
    isActive: item.isActive,
  };
}

function normalizeRecurringSplitLines(
  lines: NewRecurringItemSplitLineInput[] | undefined,
): NewRecurringItemSplitLineInput[] {
  return (lines ?? []).map((line) => ({
    amountMinor: line.amountMinor,
    categoryId: line.categoryId.trim(),
    subcategoryId: line.subcategoryId.trim(),
    note: line.note?.trim() ?? '',
  }));
}

function validateRecurringSplitLines(
  kind: RecurringItemKind,
  lines: NewRecurringItemSplitLineInput[],
  amountMinor: number,
): void {
  if (kind !== 'expense') {
    throw new Error('Upcoming Payment split lines are only supported for expenses.');
  }

  if (lines.length < 2) {
    throw new Error('Split upcoming payments need at least two lines.');
  }

  let splitTotalMinor = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.amountMinor) || line.amountMinor <= 0) {
      throw new Error('Split line amounts must be greater than zero.');
    }

    if (!line.categoryId || !line.subcategoryId) {
      throw new Error('Choose a category and subcategory for every split line.');
    }

    splitTotalMinor += line.amountMinor;
  }

  if (splitTotalMinor !== amountMinor) {
    throw new Error('Split line amounts must equal the upcoming payment amount.');
  }
}

function compareUpcomingRecurringItems(left: UpcomingRecurringItem, right: UpcomingRecurringItem): number {
  return (
    left.nextDueDate.localeCompare(right.nextDueDate) ||
    left.name.localeCompare(right.name) ||
    left.id.localeCompare(right.id)
  );
}

function normalizeDateOnlyOption(value: string | Date): string {
  if (value instanceof Date) {
    return toLocalDateOnly(value);
  }

  assertDateOnly(value);
  return value;
}

function assertDateOnly(value: string): void {
  parseDateOnly(value);
}

function parseDateOnly(value: string): LocalDateParts {
  const match = value.trim().match(DATE_ONLY_PATTERN);
  if (!match) {
    throw new Error('Use YYYY-MM-DD for the date.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new Error('Enter a valid date.');
  }

  return {
    year,
    monthIndex: month - 1,
    day,
  };
}

function addDaysDateOnly(value: string, days: number): string {
  const parts = parseDateOnly(value);
  const date = new Date(parts.year, parts.monthIndex, parts.day, 12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return toLocalDateOnly(date);
}

function addMonthsDateOnly(value: string, months: number): string {
  const parts = parseDateOnly(value);
  const target = normalizeMonth(parts.year, parts.monthIndex + months);
  const sourceMonthLastDay = getDaysInMonth(parts.year, parts.monthIndex);
  const targetMonthLastDay = getDaysInMonth(target.year, target.monthIndex);
  const shouldUseMonthEnd = parts.day === sourceMonthLastDay;
  const day = shouldUseMonthEnd ? targetMonthLastDay : Math.min(parts.day, targetMonthLastDay);

  return formatDateOnly(target.year, target.monthIndex, day);
}

function normalizeMonth(year: number, monthIndex: number): { year: number; monthIndex: number } {
  const normalized = new Date(year, monthIndex, 1, 12, 0, 0, 0);
  return {
    year: normalized.getFullYear(),
    monthIndex: normalized.getMonth(),
  };
}

function clampDueDay(dueDay: number, year: number, monthIndex: number): number {
  if (!Number.isFinite(dueDay)) {
    return 1;
  }

  return Math.min(Math.max(Math.trunc(dueDay), 1), getDaysInMonth(year, monthIndex));
}

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0, 12, 0, 0, 0).getDate();
}

function formatDateOnly(year: number, monthIndex: number, day: number): string {
  return [
    String(year).padStart(4, '0'),
    String(monthIndex + 1).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}
