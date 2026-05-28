import type {
  RecurringItem,
  Transaction,
  TransactionLine,
  TransactionTemplate,
} from './types';

export type TransactionItemSuggestionInput = {
  transactions: Transaction[];
  transactionLines?: TransactionLine[];
  transactionTemplates?: TransactionTemplate[];
  recurringItems?: RecurringItem[];
  excludeTransactionId?: string;
  excludeTemplateId?: string;
  excludeRecurringItemId?: string;
};

type SuggestionScore = {
  value: string;
  frequency: number;
  lastSeen: number;
};

const FALLBACK_TIME = 0;

export function getTransactionItemNameSuggestionValues({
  excludeRecurringItemId,
  excludeTemplateId,
  excludeTransactionId,
  recurringItems = [],
  transactionLines = [],
  transactionTemplates = [],
  transactions,
}: TransactionItemSuggestionInput): string[] {
  const scores = new Map<string, SuggestionScore>();
  const transactionTimeById = new Map(
    transactions.map((transaction) => [
      transaction.id,
      getSortableTime(transaction.datetime || transaction.updatedAt || transaction.createdAt),
    ]),
  );

  for (const transaction of transactions) {
    if (transaction.id === excludeTransactionId) {
      continue;
    }

    addSuggestion(scores, transaction.title, getSortableTime(transaction.datetime || transaction.updatedAt || transaction.createdAt));
  }

  for (const line of transactionLines) {
    if (line.transactionId === excludeTransactionId) {
      continue;
    }

    addSuggestion(scores, line.note, transactionTimeById.get(line.transactionId) ?? getSortableTime(line.createdAt));
  }

  for (const template of transactionTemplates) {
    if (!template.isActive || template.id === excludeTemplateId) {
      continue;
    }

    const timestamp = getSortableTime(template.updatedAt || template.createdAt);
    addSuggestion(scores, template.title, timestamp);
    addSuggestion(scores, template.name, timestamp);
  }

  for (const item of recurringItems) {
    if (!item.isActive || item.id === excludeRecurringItemId) {
      continue;
    }

    addSuggestion(scores, item.name, getSortableTime(item.updatedAt || item.createdAt));
  }

  return Array.from(scores.values())
    .sort((left, right) =>
      right.frequency - left.frequency ||
      right.lastSeen - left.lastSeen ||
      left.value.localeCompare(right.value),
    )
    .map((entry) => entry.value);
}

export function getFilteredTransactionItemNameSuggestions(
  values: string[],
  query: string,
  limit = 4,
): string[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const seen = new Set<string>();
  const matches: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key) || !key.includes(normalizedQuery)) {
      continue;
    }

    seen.add(key);
    matches.push(trimmed);
    if (matches.length >= limit) {
      break;
    }
  }

  return matches;
}

function addSuggestion(scores: Map<string, SuggestionScore>, value: string, timestamp: number): void {
  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }

  const key = trimmed.toLowerCase();
  const existing = scores.get(key);
  if (!existing) {
    scores.set(key, {
      value: trimmed,
      frequency: 1,
      lastSeen: timestamp,
    });
    return;
  }

  existing.frequency += 1;
  existing.lastSeen = Math.max(existing.lastSeen, timestamp);
}

function getSortableTime(value: string | undefined): number {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : FALLBACK_TIME;
}
