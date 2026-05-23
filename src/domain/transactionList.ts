import type { TransactionDisplayEntry } from './aggregates';
import { getAccountDisplayName } from './accountThemes';
import { getCategory, getSubcategoryName } from './categories';
import { formatMoneyAccounting } from './money';
import {
  getNextGroupBoundaryIso,
  getTransactionGroupKey,
  getTransactionGroupLabel,
  type TransactionGroupGranularity,
} from './transactionGrouping';
import type { Account, CategoryDefinition } from './types';

export type TransactionDisplayGroup = {
  key: string;
  label: string;
  endIso: string;
  entries: TransactionDisplayEntry[];
};

export type TransactionCurrencyTotal = {
  currencyCode: string;
  amountMinor: number;
};

export function groupTransactionDisplayEntries(
  entries: TransactionDisplayEntry[],
  granularity: TransactionGroupGranularity,
): TransactionDisplayGroup[] {
  const groups = new Map<string, TransactionDisplayGroup>();

  for (const entry of entries) {
    const key = getTransactionGroupKey(entry.transaction.datetime, granularity);
    const existingGroup = groups.get(key);
    if (existingGroup) {
      existingGroup.entries.push(entry);
      continue;
    }

    groups.set(key, {
      key,
      label: getTransactionGroupLabel(entry.transaction.datetime, granularity),
      endIso: getNextGroupBoundaryIso(entry.transaction.datetime, granularity),
      entries: [entry],
    });
  }

  return Array.from(groups.values());
}

export function filterTransactionDisplayEntriesBySearch({
  entries,
  query,
  accounts,
  categories,
}: {
  entries: TransactionDisplayEntry[];
  query: string;
  accounts: Account[];
  categories?: CategoryDefinition[];
}): TransactionDisplayEntry[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return entries;
  }

  return entries.filter((entry) => {
    const searchableValues = [
      entry.transaction.title,
      entry.transaction.notes,
      entry.transaction.groupId,
      ...entry.transaction.labels,
      ...entry.lines.flatMap((line) => {
        const account = accounts.find((item) => item.id === line.accountId);
        const category = getCategory(line.categoryId, categories);
        return [
          line.note,
          account ? getAccountDisplayName(account) : '',
          category.name,
          getSubcategoryName(line.categoryId, line.subcategoryId, categories),
        ];
      }),
    ];

    return searchableValues.some((value) => normalizeSearchText(value).includes(normalizedQuery));
  });
}

export function getTransactionGroupCurrencyTotals(
  entries: TransactionDisplayEntry[],
): TransactionCurrencyTotal[] {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    totals.set(entry.currencyCode, (totals.get(entry.currencyCode) ?? 0) + entry.amountMinor);
  }

  return Array.from(totals.entries())
    .map(([currencyCode, amountMinor]) => ({ currencyCode, amountMinor }))
    .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode));
}

export function formatTransactionCurrencyTotals(
  totals: TransactionCurrencyTotal[],
  showCurrencyCodes: boolean,
): string {
  if (!totals.length) {
    return '$0.00';
  }

  return totals
    .map((total) =>
      formatMoneyAccounting(total.amountMinor, total.currencyCode, { showCurrencyCode: showCurrencyCodes }),
    )
    .join(' / ');
}

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
