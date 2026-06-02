import {
  compareTransactionDisplayEntriesDescending,
  type TransactionDisplayEntry,
} from './aggregates';
import { getTransactionDisplayLinkStatus } from './transactionLinks';
import type { Account, AccountBalance, AppSnapshot, CurrencyCode, Transaction, TransactionLine, TransactionLink } from './types';

export const dashboardRecentTransactionLimit = 5;

export function getDashboardAccountPreview(accountBalances: AccountBalance[]): AccountBalance[] {
  return accountBalances
    .filter(({ account }) => !account.isArchived && account.showOnDashboard);
}

export function getDashboardInitialSelectedAccountIds(accountBalances: AccountBalance[]): string[] {
  return getDashboardAccountPreview(accountBalances).map(({ account }) => account.id);
}

export function getDashboardSelectedAccountIds(
  accountBalances: AccountBalance[],
  storedSelectedAccountIds: string[] | null,
): string[] {
  const previewAccountIds = getDashboardInitialSelectedAccountIds(accountBalances);
  if (storedSelectedAccountIds === null) {
    return previewAccountIds;
  }

  const previewIds = new Set(previewAccountIds);
  return storedSelectedAccountIds.filter((accountId) => previewIds.has(accountId));
}

export function getDashboardDefaultSelectedAccountIds({
  accountBalances,
  fallbackAccounts,
  storedSelectedAccountIds,
}: {
  accountBalances: AccountBalance[];
  fallbackAccounts?: Account[];
  storedSelectedAccountIds: string[] | null;
}): string[] {
  const previewAccountIds = getDashboardInitialSelectedAccountIds(accountBalances);

  if (storedSelectedAccountIds === null) {
    return previewAccountIds.length ? previewAccountIds : getFallbackActiveAccountIds(accountBalances, fallbackAccounts);
  }

  if (storedSelectedAccountIds.length === 0) {
    return [];
  }

  const selectedAccountIds = getDashboardSelectedAccountIds(accountBalances, storedSelectedAccountIds);
  if (selectedAccountIds.length) {
    return selectedAccountIds;
  }

  return previewAccountIds.length ? previewAccountIds : getFallbackActiveAccountIds(accountBalances, fallbackAccounts);
}

export function toggleDashboardAccountSelection(
  selectedAccountIds: string[],
  accountId: string,
): string[] {
  return selectedAccountIds.includes(accountId)
    ? selectedAccountIds.filter((id) => id !== accountId)
    : [...selectedAccountIds, accountId];
}

export function normalizeDashboardSelectedAccountIds(
  selectedAccountIds: string[],
  accountBalances: AccountBalance[],
): string[] {
  const availableIds = new Set(getDashboardInitialSelectedAccountIds(accountBalances));
  return selectedAccountIds.filter((id) => availableIds.has(id));
}

export function getDashboardRecentTransactions({
  snapshot,
  previewAccountIds,
  selectedAccountIds,
  limit = dashboardRecentTransactionLimit,
}: {
  snapshot: AppSnapshot;
  previewAccountIds: string[];
  selectedAccountIds: string[];
  limit?: number;
}): TransactionDisplayEntry[] {
  const previewIds = new Set(previewAccountIds);
  const visibleSelectedAccountIds = selectedAccountIds.filter((accountId) => previewIds.has(accountId));
  if (!visibleSelectedAccountIds.length) {
    return [];
  }

  return getRecentTransactionEntries({
    transactions: snapshot.transactions,
    lines: snapshot.transactionLines,
    transactionLinks: snapshot.transactionLinks,
    accountIds: visibleSelectedAccountIds,
  })
    .sort(compareTransactionDisplayEntriesDescending)
    .slice(0, limit);
}

function getRecentTransactionEntries({
  transactions,
  lines,
  transactionLinks,
  accountIds,
}: {
  transactions: Transaction[];
  lines: TransactionLine[];
  transactionLinks: TransactionLink[];
  accountIds: string[];
}): TransactionDisplayEntry[] {
  const accountFilter = new Set(accountIds);
  const linesByTransaction = new Map<string, TransactionLine[]>();

  for (const line of lines) {
    if (!accountFilter.has(line.accountId)) {
      continue;
    }

    linesByTransaction.set(line.transactionId, [
      ...(linesByTransaction.get(line.transactionId) ?? []),
      line,
    ]);
  }

  return transactions.flatMap((transaction) => {
    const visibleLines = linesByTransaction.get(transaction.id) ?? [];
    if (!visibleLines.length) {
      return [];
    }

    if (transaction.kind === 'transfer') {
      const displayLine = getTransferDisplayLine(visibleLines);
      const linkStatus = getTransactionDisplayLinkStatus({
        transactionId: transaction.id,
        lineIds: [displayLine.id],
        links: transactionLinks,
        showLineLevel: false,
      });
      return [
        {
          id: transaction.id,
          accountId: displayLine.accountId,
          transaction,
          lines: [displayLine],
          amountMinor: displayLine.amountMinor,
          currencyCode: displayLine.currencyCode,
          isLinked: linkStatus.isParentLinked,
          linkedLineIds: linkStatus.linkedLineIds,
        },
      ];
    }

    const entryCurrencyCode = visibleLines[0].currencyCode;
    const linkStatus = getTransactionDisplayLinkStatus({
      transactionId: transaction.id,
      lineIds: visibleLines.map((line) => line.id),
      links: transactionLinks,
      showLineLevel: visibleLines.length > 1,
    });
    return [
      {
        id: transaction.id,
        accountId: visibleLines[0].accountId,
        transaction,
        lines: visibleLines,
        amountMinor: sumLinesByCurrency(visibleLines, entryCurrencyCode),
        currencyCode: entryCurrencyCode,
        isLinked: linkStatus.isParentLinked,
        linkedLineIds: linkStatus.linkedLineIds,
      },
    ];
  });
}

function getTransferDisplayLine(lines: TransactionLine[]): TransactionLine {
  return lines.find((line) => line.amountMinor < 0) ?? lines.find((line) => line.amountMinor > 0) ?? lines[0];
}

function sumLinesByCurrency(lines: TransactionLine[], currencyCode: CurrencyCode): number {
  return lines
    .filter((line) => line.currencyCode === currencyCode)
    .reduce((sum, line) => sum + line.amountMinor, 0);
}

function getFallbackActiveAccountIds(accountBalances: AccountBalance[], fallbackAccounts?: Account[]): string[] {
  const accounts = fallbackAccounts ?? accountBalances.map(({ account }) => account);
  return accounts.filter((account) => !account.isArchived).map((account) => account.id);
}
