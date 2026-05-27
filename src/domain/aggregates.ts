import { isWithinDateRange } from './dates';
import { getLinkedStatsAdjustments } from './linkedStats';
import { getUpcomingRecurringItems } from './recurringItems';
import type {
  Account,
  AccountBalance,
  Budget,
  BudgetUsage,
  CashFlowSummary,
  CurrencyCode,
  CurrencyTotal,
  DateRange,
  RainyDayFund,
  RainyDayProgress,
  RecurringItem,
  SpendingByCategory,
  Transaction,
  TransactionLine,
  TransactionLink,
  UpcomingBill,
} from './types';

export type TransactionDisplayEntry = {
  id: string;
  accountId: string;
  transaction: Transaction;
  lines: TransactionLine[];
  amountMinor: number;
  currencyCode: CurrencyCode;
};

export function compareTransactionsDescending(left: Transaction, right: Transaction): number {
  const datetimeDiff = new Date(right.datetime).getTime() - new Date(left.datetime).getTime();
  if (datetimeDiff !== 0) {
    return datetimeDiff;
  }

  const createdDiff = new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
  if (createdDiff !== 0) {
    return createdDiff;
  }

  return right.id.localeCompare(left.id);
}

export function compareTransactionDisplayEntriesDescending(
  left: TransactionDisplayEntry,
  right: TransactionDisplayEntry,
): number {
  const transactionDiff = compareTransactionsDescending(left.transaction, right.transaction);
  return transactionDiff !== 0 ? transactionDiff : right.id.localeCompare(left.id);
}

export function getAccountBalances(accounts: Account[], lines: TransactionLine[]): AccountBalance[] {
  return accounts
    .filter((account) => !account.isArchived)
    .map((account) => {
      const ledgerBalance = lines
        .filter((line) => line.accountId === account.id)
        .reduce((sum, line) => sum + line.amountMinor, 0);

      return {
        account,
        balanceMinor: account.openingBalanceMinor + ledgerBalance,
      };
    });
}

export function groupBalancesByCurrency(accountBalances: AccountBalance[]): CurrencyTotal[] {
  const totals = new Map<CurrencyCode, number>();

  for (const balance of accountBalances) {
    totals.set(
      balance.account.currencyCode,
      (totals.get(balance.account.currencyCode) ?? 0) + balance.balanceMinor,
    );
  }

  return Array.from(totals.entries())
    .map(([currencyCode, amountMinor]) => ({ currencyCode, amountMinor }))
    .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode));
}

export function getRainyDayProgress(fund: RainyDayFund, accountBalances: AccountBalance[]): RainyDayProgress {
  const linkedAccounts = new Set(fund.linkedAccountIds);
  const currentMinor = accountBalances
    .filter(
      (balance) =>
        linkedAccounts.has(balance.account.id) && balance.account.currencyCode === fund.currencyCode,
    )
    .reduce((sum, balance) => sum + balance.balanceMinor, 0);
  const clampedCurrent = Math.max(0, currentMinor);
  const percentage = fund.goalMinor <= 0 ? 0 : Math.min(100, Math.round((clampedCurrent / fund.goalMinor) * 100));

  return {
    fund,
    currentMinor: clampedCurrent,
    remainingMinor: Math.max(0, fund.goalMinor - clampedCurrent),
    percentage,
  };
}

export function getSpendingByCategory({
  transactions,
  lines,
  transactionLinks = [],
  range,
  currencyCode,
  accountIds,
}: {
  transactions: Transaction[];
  lines: TransactionLine[];
  transactionLinks?: TransactionLink[];
  range: DateRange;
  currencyCode: CurrencyCode;
  accountIds?: string[];
}): SpendingByCategory[] {
  const visibleTransactions = new Set(
    transactions
      .filter((transaction) => transaction.kind === 'expense' && isWithinDateRange(transaction.datetime, range))
      .map((transaction) => transaction.id),
  );
  const accountFilter = accountIds?.length ? new Set(accountIds) : null;
  const linkedStatsAdjustments = getLinkedStatsAdjustments({ transactions, lines, transactionLinks });
  const totals = new Map<string, number>();

  for (const line of lines) {
    if (
      visibleTransactions.has(line.transactionId) &&
      line.amountMinor < 0 &&
      line.currencyCode === currencyCode &&
      (!accountFilter || accountFilter.has(line.accountId))
    ) {
      const reductionMinor = linkedStatsAdjustments.expenseLineReductionMinorByLineId.get(line.id) ?? 0;
      const amountMinor = Math.max(0, Math.abs(line.amountMinor) - reductionMinor);
      if (amountMinor > 0) {
        totals.set(line.categoryId, (totals.get(line.categoryId) ?? 0) + amountMinor);
      }
    }
  }

  return Array.from(totals.entries())
    .map(([categoryId, amountMinor]) => ({ categoryId, currencyCode, amountMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
}

export function getBudgetUsage(budgets: Budget[], spending: SpendingByCategory[]): BudgetUsage[] {
  return budgets.filter((budget) => budget.isActive && budget.scopeType === 'category').map((budget) => {
    const spentMinor =
      spending.find(
        (item) => item.categoryId === budget.categoryId && item.currencyCode === budget.currencyCode,
      )?.amountMinor ?? 0;
    const percentageUsed =
      budget.amountMinor <= 0 ? 0 : Math.round((spentMinor / budget.amountMinor) * 100);

    return {
      budget,
      spentMinor,
      remainingMinor: budget.amountMinor - spentMinor,
      percentageUsed,
      status: percentageUsed >= 100 ? 'over_budget' : percentageUsed >= 80 ? 'near_limit' : 'under_budget',
      matchingLineIds: [],
    };
  });
}

export function getCashFlowSummary({
  transactions,
  lines,
  transactionLinks = [],
  range,
  currencyCode,
  accountIds,
}: {
  transactions: Transaction[];
  lines: TransactionLine[];
  transactionLinks?: TransactionLink[];
  range: DateRange;
  currencyCode: CurrencyCode;
  accountIds?: string[];
}): CashFlowSummary {
  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const accountFilter = accountIds?.length ? new Set(accountIds) : null;
  const linkedStatsAdjustments = getLinkedStatsAdjustments({ transactions, lines, transactionLinks });
  let incomeMinor = 0;
  let expenseMinor = 0;

  for (const line of lines) {
    const transaction = transactionById.get(line.transactionId);
    if (
      !transaction ||
      transaction.kind === 'transfer' ||
      line.currencyCode !== currencyCode ||
      !isWithinDateRange(transaction.datetime, range) ||
      (accountFilter && !accountFilter.has(line.accountId))
    ) {
      continue;
    }

    if (line.amountMinor > 0) {
      const exclusionMinor = linkedStatsAdjustments.incomeLineExclusionMinorByLineId.get(line.id) ?? 0;
      incomeMinor += Math.max(0, line.amountMinor - exclusionMinor);
    } else if (line.amountMinor < 0) {
      const reductionMinor =
        transaction.kind === 'expense'
          ? linkedStatsAdjustments.expenseLineReductionMinorByLineId.get(line.id) ?? 0
          : 0;
      expenseMinor += Math.max(0, Math.abs(line.amountMinor) - reductionMinor);
    }
  }

  return {
    currencyCode,
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
  };
}

export function getUpcomingBills(items: RecurringItem[], from = new Date(), daysAhead = 30): UpcomingBill[] {
  return getUpcomingRecurringItems(items, from, daysAhead);
}

export function getTransactionLineTotal(transactionId: string, lines: TransactionLine[], currencyCode: CurrencyCode): number {
  return lines
    .filter((line) => line.transactionId === transactionId && line.currencyCode === currencyCode)
    .reduce((sum, line) => sum + line.amountMinor, 0);
}

export function getTransactionDisplayEntries({
  transactions,
  lines,
  currencyCode,
  accountIds,
}: {
  transactions: Transaction[];
  lines: TransactionLine[];
  currencyCode?: CurrencyCode;
  accountIds?: string[];
}): TransactionDisplayEntry[] {
  if (accountIds && !accountIds.length) {
    return [];
  }

  const accountFilter = accountIds?.length ? new Set(accountIds) : null;
  const linesByTransaction = new Map<string, TransactionLine[]>();

  for (const line of lines) {
    if (
      (currencyCode && line.currencyCode !== currencyCode) ||
      (accountFilter && !accountFilter.has(line.accountId))
    ) {
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
      return visibleLines.map((line) => ({
        id: `${transaction.id}:${line.id}`,
        accountId: line.accountId,
        transaction,
        lines: [line],
        amountMinor: line.amountMinor,
        currencyCode: line.currencyCode,
      }));
    }

    const entryCurrencyCode = currencyCode ?? visibleLines[0].currencyCode;
    return [
      {
        id: transaction.id,
        accountId: visibleLines[0].accountId,
        transaction,
        lines: visibleLines,
        amountMinor: visibleLines
          .filter((line) => line.currencyCode === entryCurrencyCode)
          .reduce((sum, line) => sum + line.amountMinor, 0),
        currencyCode: entryCurrencyCode,
      },
    ];
  });
}

export function getBalanceAfterDisplayEntries({
  accounts,
  transactions,
  lines,
}: {
  accounts: Account[];
  transactions: Transaction[];
  lines: TransactionLine[];
}): Record<string, number> {
  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const transactionOrderById = new Map(transactions.map((transaction, index) => [transaction.id, index]));
  const balances = new Map(accounts.map((account) => [account.id, account.openingBalanceMinor]));
  const balancesByEntryId: Record<string, number> = {};

  const sortedLines = [...lines].sort((a, b) => {
    const transactionA = transactionById.get(a.transactionId);
    const transactionB = transactionById.get(b.transactionId);
    const timeDiff =
      new Date(transactionA?.datetime ?? 0).getTime() - new Date(transactionB?.datetime ?? 0).getTime();

    if (timeDiff !== 0) {
      return timeDiff;
    }

    const transactionOrderDiff =
      (transactionOrderById.get(a.transactionId) ?? 0) - (transactionOrderById.get(b.transactionId) ?? 0);
    if (transactionOrderDiff !== 0) {
      return transactionOrderDiff;
    }

    return a.id.localeCompare(b.id);
  });

  for (const line of sortedLines) {
    const transaction = transactionById.get(line.transactionId);
    const nextBalance = (balances.get(line.accountId) ?? 0) + line.amountMinor;
    balances.set(line.accountId, nextBalance);

    if (!transaction) {
      continue;
    }

    const entryId = transaction.kind === 'transfer' ? `${transaction.id}:${line.id}` : transaction.id;
    balancesByEntryId[entryId] = nextBalance;
  }

  return balancesByEntryId;
}

export function getAccountBalancesAt({
  accounts,
  transactions,
  lines,
  beforeIso,
  accountIds,
}: {
  accounts: Account[];
  transactions: Transaction[];
  lines: TransactionLine[];
  beforeIso: string;
  accountIds: string[];
}): AccountBalance[] {
  const selectedIds = new Set(accountIds);
  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const beforeTime = new Date(beforeIso).getTime();

  return accounts
    .filter((account) => selectedIds.has(account.id))
    .map((account) => {
      const ledgerBalance = lines
        .filter((line) => {
          const transaction = transactionById.get(line.transactionId);
          return (
            line.accountId === account.id &&
            !!transaction &&
            new Date(transaction.datetime).getTime() < beforeTime
          );
        })
        .reduce((sum, line) => sum + line.amountMinor, 0);

      return {
        account,
        balanceMinor: account.openingBalanceMinor + ledgerBalance,
      };
    });
}

export function getSortedTransactions(
  transactions: Transaction[],
  lines: TransactionLine[],
  currencyCode: CurrencyCode,
  sortBy: 'time' | 'amount',
): Transaction[] {
  return [...transactions].sort((a, b) => {
    if (sortBy === 'amount') {
      return (
        Math.abs(getTransactionLineTotal(b.id, lines, currencyCode)) -
        Math.abs(getTransactionLineTotal(a.id, lines, currencyCode))
      );
    }

    return compareTransactionsDescending(a, b);
  });
}
