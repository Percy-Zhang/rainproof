import {
  getCashFlowSummary,
  getSpendingByCategory,
  groupBalancesByCurrency,
} from './aggregates';
import { isWithinDateRange } from './dates';
import type {
  AccountBalance,
  CashFlowSummary,
  CurrencyCode,
  CurrencyTotal,
  DateRange,
  SpendingByCategory,
  Transaction,
  TransactionLine,
  TransactionLink,
} from './types';

export type DashboardTopSpendingCurrencyGroup = {
  currencyCode: CurrencyCode;
  rows: SpendingByCategory[];
};

export function getDashboardBalanceTotals({
  accountBalances,
  selectedAccountIds,
}: {
  accountBalances: AccountBalance[];
  selectedAccountIds?: string[];
}): CurrencyTotal[] {
  const selectedAccountFilter = getSelectedAccountFilter(selectedAccountIds);
  if (selectedAccountFilter === 'empty') {
    return [];
  }

  return groupBalancesByCurrency(
    selectedAccountFilter
      ? accountBalances.filter(({ account }) => selectedAccountFilter.has(account.id))
      : accountBalances,
  );
}

export function getDashboardCashFlowByCurrency({
  accountIds,
  lines,
  range,
  transactionLinks = [],
  transactions,
}: {
  accountIds?: string[];
  lines: TransactionLine[];
  range: DateRange;
  transactionLinks?: TransactionLink[];
  transactions: Transaction[];
}): CashFlowSummary[] {
  const currencyCodes = getMatchingCurrencyCodes({
    accountIds,
    lines,
    range,
    transactions,
    includeKinds: new Set(['expense', 'income']),
  });

  return currencyCodes
    .map((currencyCode) =>
      getCashFlowSummary({
        transactions,
        lines,
        transactionLinks,
        range,
        currencyCode,
        accountIds,
      }),
    )
    .filter((summary) => summary.incomeMinor > 0 || summary.expenseMinor > 0);
}

export function getDashboardTopSpendingByCurrency({
  accountIds,
  lines,
  perCurrencyLimit = 3,
  range,
  transactionLinks = [],
  transactions,
}: {
  accountIds?: string[];
  lines: TransactionLine[];
  perCurrencyLimit?: number;
  range: DateRange;
  transactionLinks?: TransactionLink[];
  transactions: Transaction[];
}): DashboardTopSpendingCurrencyGroup[] {
  const currencyCodes = getMatchingCurrencyCodes({
    accountIds,
    lines,
    range,
    transactions,
    includeKinds: new Set(['expense', 'income']),
    onlyNegativeLines: true,
  });
  const safeLimit = Math.max(1, Math.trunc(perCurrencyLimit));

  return currencyCodes
    .map((currencyCode) => ({
      currencyCode,
      rows: getSpendingByCategory({
        transactions,
        lines,
        transactionLinks,
        range,
        currencyCode,
        accountIds,
      }).slice(0, safeLimit),
    }))
    .filter((group) => group.rows.length > 0);
}

function getMatchingCurrencyCodes({
  accountIds,
  includeKinds,
  lines,
  onlyNegativeLines = false,
  range,
  transactions,
}: {
  accountIds?: string[];
  includeKinds: Set<Transaction['kind']>;
  lines: TransactionLine[];
  onlyNegativeLines?: boolean;
  range: DateRange;
  transactions: Transaction[];
}): CurrencyCode[] {
  const selectedAccountFilter = getSelectedAccountFilter(accountIds);
  if (selectedAccountFilter === 'empty') {
    return [];
  }

  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const currencyCodes = new Set<CurrencyCode>();

  for (const line of lines) {
    if (selectedAccountFilter && !selectedAccountFilter.has(line.accountId)) {
      continue;
    }

    if (onlyNegativeLines && line.amountMinor >= 0) {
      continue;
    }

    const transaction = transactionById.get(line.transactionId);
    if (
      !transaction ||
      !includeKinds.has(transaction.kind) ||
      !isWithinDateRange(transaction.datetime, range)
    ) {
      continue;
    }

    currencyCodes.add(line.currencyCode);
  }

  return Array.from(currencyCodes).sort((left, right) => left.localeCompare(right));
}

function getSelectedAccountFilter(selectedAccountIds?: string[]): Set<string> | 'empty' | null {
  if (!selectedAccountIds) {
    return null;
  }

  if (!selectedAccountIds.length) {
    return 'empty';
  }

  return new Set(selectedAccountIds);
}
