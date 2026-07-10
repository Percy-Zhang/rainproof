import { getAccountBalancesAt } from './aggregates';
import { isWithinDateRange } from './dates';
import { normalizeCurrencyCode } from './money';
import type { StatsReport, StatsReportKind, StatsReportRollup } from './statsReports';
import type { Account, CurrencyCode, DateRange, Transaction, TransactionLine } from './types';

export type StatsCashFlowWaterfallStepKind =
  | 'start'
  | 'income'
  | 'expense-category'
  | 'other-expenses'
  | 'transfers'
  | 'other-balance-movement'
  | 'end';

export type StatsCashFlowWaterfallStep = {
  id: string;
  label: string;
  kind: StatsCashFlowWaterfallStepKind;
  deltaMinor: number;
  startBalanceMinor: number;
  endBalanceMinor: number;
  categoryId?: string;
  drilldownReportKind?: StatsReportKind;
};

export type StatsCashFlowWaterfall = {
  currencyCode: CurrencyCode;
  eligibleAccountIds: string[];
  startingBalanceMinor: number;
  endingBalanceMinor: number;
  steps: StatsCashFlowWaterfallStep[];
};

type MovementDefinition = Pick<
  StatsCashFlowWaterfallStep,
  'id' | 'label' | 'kind' | 'deltaMinor' | 'categoryId' | 'drilldownReportKind'
>;

export function getStatsCashFlowWaterfall({
  accounts,
  accountIds,
  currencyCode,
  expenseCategoryLimit = 4,
  expenseReport,
  incomeReport,
  range,
  transactionLines,
  transactions,
}: {
  accounts: Account[];
  accountIds: string[];
  currencyCode: CurrencyCode;
  expenseCategoryLimit?: number;
  expenseReport: StatsReport;
  incomeReport: StatsReport;
  range: DateRange;
  transactionLines: TransactionLine[];
  transactions: Transaction[];
}): StatsCashFlowWaterfall {
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
  const requestedAccountIds = new Set(accountIds);
  const eligibleAccounts = accounts.filter(
    (account) =>
      !account.isArchived &&
      requestedAccountIds.has(account.id) &&
      normalizeCurrencyCode(account.currencyCode) === normalizedCurrencyCode,
  );
  const eligibleAccountIds = eligibleAccounts.map((account) => account.id);

  if (!eligibleAccountIds.length) {
    return {
      currencyCode: normalizedCurrencyCode,
      eligibleAccountIds: [],
      startingBalanceMinor: 0,
      endingBalanceMinor: 0,
      steps: [],
    };
  }

  const eligibleAccountIdSet = new Set(eligibleAccountIds);
  const eligibleLines = transactionLines.filter(
    (line) =>
      eligibleAccountIdSet.has(line.accountId) &&
      normalizeCurrencyCode(line.currencyCode) === normalizedCurrencyCode,
  );
  const startingBalanceMinor = getCombinedBalanceBefore({
    accounts: eligibleAccounts,
    accountIds: eligibleAccountIds,
    beforeIso: range.startIso,
    lines: eligibleLines,
    transactions,
  });
  const endingBalanceMinor = getCombinedBalanceBefore({
    accounts: eligibleAccounts,
    accountIds: eligibleAccountIds,
    beforeIso: range.endIso,
    lines: eligibleLines,
    transactions,
  });
  const movementDefinitions = getReportMovementDefinitions({
    expenseCategoryLimit,
    expenseReport,
    incomeReport,
  });
  const transferDeltaMinor = getSelectedTransferDelta({
    accountIds: eligibleAccountIdSet,
    currencyCode: normalizedCurrencyCode,
    range,
    transactionLines: eligibleLines,
    transactions,
  });

  if (transferDeltaMinor !== 0) {
    movementDefinitions.push({
      id: 'transfers',
      label: 'Transfers',
      kind: 'transfers',
      deltaMinor: transferDeltaMinor,
    });
  }

  const displayedDeltaMinor = movementDefinitions.reduce(
    (sum, movement) => sum + movement.deltaMinor,
    0,
  );
  const otherBalanceMovementMinor =
    endingBalanceMinor - startingBalanceMinor - displayedDeltaMinor;

  if (otherBalanceMovementMinor !== 0) {
    movementDefinitions.push({
      id: 'other-balance-movement',
      label: 'Other balance movement',
      kind: 'other-balance-movement',
      deltaMinor: otherBalanceMovementMinor,
    });
  }

  const steps: StatsCashFlowWaterfallStep[] = [
    {
      id: 'start',
      label: 'Start',
      kind: 'start',
      deltaMinor: 0,
      startBalanceMinor: startingBalanceMinor,
      endBalanceMinor: startingBalanceMinor,
    },
  ];
  let runningBalanceMinor = startingBalanceMinor;

  for (const movement of movementDefinitions) {
    const nextBalanceMinor = runningBalanceMinor + movement.deltaMinor;
    steps.push({
      ...movement,
      startBalanceMinor: runningBalanceMinor,
      endBalanceMinor: nextBalanceMinor,
    });
    runningBalanceMinor = nextBalanceMinor;
  }

  steps.push({
    id: 'end',
    label: 'End',
    kind: 'end',
    deltaMinor: 0,
    startBalanceMinor: endingBalanceMinor,
    endBalanceMinor: endingBalanceMinor,
  });

  return {
    currencyCode: normalizedCurrencyCode,
    eligibleAccountIds,
    startingBalanceMinor,
    endingBalanceMinor,
    steps,
  };
}

function getCombinedBalanceBefore({
  accounts,
  accountIds,
  beforeIso,
  lines,
  transactions,
}: {
  accounts: Account[];
  accountIds: string[];
  beforeIso: string;
  lines: TransactionLine[];
  transactions: Transaction[];
}): number {
  return getAccountBalancesAt({
    accounts,
    transactions,
    lines,
    beforeIso,
    accountIds,
  }).reduce((sum, balance) => sum + balance.balanceMinor, 0);
}

function getReportMovementDefinitions({
  expenseCategoryLimit,
  expenseReport,
  incomeReport,
}: {
  expenseCategoryLimit: number;
  expenseReport: StatsReport;
  incomeReport: StatsReport;
}): MovementDefinition[] {
  const movements: MovementDefinition[] = [];
  const incomeRollups = incomeReport.categoryRollups.filter((rollup) => rollup.netAmountMinor > 0);

  if (incomeReport.totalNetAmountMinor > 0) {
    movements.push({
      id: 'income',
      label: 'Income',
      kind: 'income',
      deltaMinor: incomeReport.totalNetAmountMinor,
      categoryId: incomeRollups.length === 1 ? incomeRollups[0].categoryId : undefined,
      drilldownReportKind: incomeRollups.length === 1 ? 'income' : undefined,
    });
  }

  const sortedExpenseRollups = expenseReport.categoryRollups
    .filter((rollup) => rollup.netAmountMinor > 0)
    .sort(compareExpenseRollups);
  const safeCategoryLimit = Math.max(0, Math.trunc(expenseCategoryLimit));
  const visibleExpenseRollups = sortedExpenseRollups.slice(0, safeCategoryLimit);
  const groupedExpenseRollups = sortedExpenseRollups.slice(safeCategoryLimit);

  for (const rollup of visibleExpenseRollups) {
    movements.push({
      id: `expense:${rollup.categoryId}`,
      label: rollup.label,
      kind: 'expense-category',
      deltaMinor: -rollup.netAmountMinor,
      categoryId: rollup.categoryId,
      drilldownReportKind: 'expense',
    });
  }

  const otherExpensesMinor = groupedExpenseRollups.reduce(
    (sum, rollup) => sum + rollup.netAmountMinor,
    0,
  );
  if (otherExpensesMinor > 0) {
    movements.push({
      id: 'other-expenses',
      label: 'Other expenses',
      kind: 'other-expenses',
      deltaMinor: -otherExpensesMinor,
    });
  }

  return movements;
}

function getSelectedTransferDelta({
  accountIds,
  currencyCode,
  range,
  transactionLines,
  transactions,
}: {
  accountIds: Set<string>;
  currencyCode: CurrencyCode;
  range: DateRange;
  transactionLines: TransactionLine[];
  transactions: Transaction[];
}): number {
  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));

  return transactionLines.reduce((sum, line) => {
    const transaction = transactionById.get(line.transactionId);
    if (
      !transaction ||
      transaction.kind !== 'transfer' ||
      !accountIds.has(line.accountId) ||
      normalizeCurrencyCode(line.currencyCode) !== currencyCode ||
      !isWithinDateRange(transaction.datetime, range)
    ) {
      return sum;
    }

    return sum + line.amountMinor;
  }, 0);
}

function compareExpenseRollups(left: StatsReportRollup, right: StatsReportRollup): number {
  return (
    right.netAmountMinor - left.netAmountMinor ||
    left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }) ||
    left.categoryId.localeCompare(right.categoryId)
  );
}
