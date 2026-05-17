import type { TransactionDisplayEntry } from './aggregates';
import { formatMoneyAccounting } from './money';
import {
  getNextGroupBoundaryIso,
  getTransactionGroupKey,
  getTransactionGroupLabel,
  type TransactionGroupGranularity,
} from './transactionGrouping';

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
