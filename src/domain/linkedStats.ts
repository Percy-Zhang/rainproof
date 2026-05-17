import { normalizeCurrencyCode } from './money';
import type { CurrencyCode, Transaction, TransactionLine, TransactionLink } from './types';

type AdjustmentGroup = {
  transactionId: string;
  currencyCode: CurrencyCode;
  amountMinor: number;
};

type AllocationItem = {
  id: string;
  amountMinor: number;
};

export type LinkedStatsOverpayment = {
  targetTransactionId: string;
  currencyCode: CurrencyCode;
  overpaidMinor: number;
};

export type LinkedStatsAdjustments = {
  expenseLineReductionMinorByLineId: Map<string, number>;
  incomeLineExclusionMinorByLineId: Map<string, number>;
  overpayments: LinkedStatsOverpayment[];
  ignoredCurrencyMismatchLinkIds: string[];
};

export function getLinkedStatsAdjustments({
  transactions,
  lines,
  transactionLinks = [],
}: {
  transactions: Transaction[];
  lines: TransactionLine[];
  transactionLinks?: TransactionLink[];
}): LinkedStatsAdjustments {
  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const linesByTransactionId = groupLinesByTransaction(lines);
  const targetReductions = new Map<string, AdjustmentGroup>();
  const sourceExclusions = new Map<string, AdjustmentGroup>();
  const ignoredCurrencyMismatchLinkIds: string[] = [];

  for (const link of transactionLinks) {
    if (link.amountMinor <= 0) {
      continue;
    }

    const source = transactionById.get(link.sourceTransactionId);
    const target = transactionById.get(link.targetTransactionId);
    if (!source || !target || source.kind !== 'income' || target.kind !== 'expense') {
      continue;
    }

    const currencyCode = normalizeCurrencyCode(link.currencyCode);
    const targetExpenseLines = getSignedCurrencyLines(
      linesByTransactionId,
      target.id,
      currencyCode,
      (amountMinor) => amountMinor < 0,
    );
    if (!targetExpenseLines.length) {
      ignoredCurrencyMismatchLinkIds.push(link.id);
      continue;
    }

    const sourceIncomeLines = getSignedCurrencyLines(
      linesByTransactionId,
      source.id,
      currencyCode,
      (amountMinor) => amountMinor > 0,
    );
    if (!sourceIncomeLines.length) {
      ignoredCurrencyMismatchLinkIds.push(link.id);
      continue;
    }

    addAdjustment(targetReductions, target.id, currencyCode, link.amountMinor);
    addAdjustment(sourceExclusions, source.id, currencyCode, link.amountMinor);
  }

  const expenseLineReductionMinorByLineId = new Map<string, number>();
  const incomeLineExclusionMinorByLineId = new Map<string, number>();
  const overpayments: LinkedStatsOverpayment[] = [];

  for (const group of targetReductions.values()) {
    const targetExpenseLines = getSignedCurrencyLines(
      linesByTransactionId,
      group.transactionId,
      group.currencyCode,
      (amountMinor) => amountMinor < 0,
    );
    const grossItems = targetExpenseLines.map((line) => ({
      id: line.id,
      amountMinor: Math.abs(line.amountMinor),
    }));
    const grossTotal = sumAllocationItems(grossItems);

    if (group.amountMinor > grossTotal) {
      overpayments.push({
        targetTransactionId: group.transactionId,
        currencyCode: group.currencyCode,
        overpaidMinor: group.amountMinor - grossTotal,
      });
    }

    mergeAllocations(
      expenseLineReductionMinorByLineId,
      allocateReduction(grossItems, Math.min(group.amountMinor, grossTotal)),
    );
  }

  for (const group of sourceExclusions.values()) {
    const sourceIncomeLines = getSignedCurrencyLines(
      linesByTransactionId,
      group.transactionId,
      group.currencyCode,
      (amountMinor) => amountMinor > 0,
    );
    const grossItems = sourceIncomeLines.map((line) => ({
      id: line.id,
      amountMinor: line.amountMinor,
    }));
    const grossTotal = sumAllocationItems(grossItems);

    mergeAllocations(
      incomeLineExclusionMinorByLineId,
      allocateReduction(grossItems, Math.min(group.amountMinor, grossTotal)),
    );
  }

  return {
    expenseLineReductionMinorByLineId,
    incomeLineExclusionMinorByLineId,
    overpayments,
    ignoredCurrencyMismatchLinkIds,
  };
}

function groupLinesByTransaction(lines: TransactionLine[]): Map<string, TransactionLine[]> {
  const groups = new Map<string, TransactionLine[]>();

  for (const line of lines) {
    groups.set(line.transactionId, [...(groups.get(line.transactionId) ?? []), line]);
  }

  return groups;
}

function getSignedCurrencyLines(
  linesByTransactionId: Map<string, TransactionLine[]>,
  transactionId: string,
  currencyCode: CurrencyCode,
  amountFilter: (amountMinor: number) => boolean,
): TransactionLine[] {
  return (linesByTransactionId.get(transactionId) ?? []).filter(
    (line) => normalizeCurrencyCode(line.currencyCode) === currencyCode && amountFilter(line.amountMinor),
  );
}

function getAdjustmentKey(transactionId: string, currencyCode: CurrencyCode): string {
  return `${transactionId}:${currencyCode}`;
}

function addAdjustment(
  adjustments: Map<string, AdjustmentGroup>,
  transactionId: string,
  currencyCode: CurrencyCode,
  amountMinor: number,
) {
  const key = getAdjustmentKey(transactionId, currencyCode);
  const current = adjustments.get(key);
  adjustments.set(key, {
    transactionId,
    currencyCode,
    amountMinor: (current?.amountMinor ?? 0) + amountMinor,
  });
}

function sumAllocationItems(items: AllocationItem[]): number {
  return items.reduce((sum, item) => sum + item.amountMinor, 0);
}

function allocateReduction(items: AllocationItem[], reductionMinor: number): Map<string, number> {
  const total = sumAllocationItems(items);
  const cappedReduction = Math.min(Math.max(0, reductionMinor), total);
  const allocations = new Map<string, number>();

  if (!items.length || total <= 0 || cappedReduction <= 0) {
    return allocations;
  }

  const rankedAllocations = items.map((item) => {
    const numerator = cappedReduction * item.amountMinor;
    return {
      id: item.id,
      amountMinor: Math.floor(numerator / total),
      remainder: numerator % total,
    };
  });
  let allocatedMinor = rankedAllocations.reduce((sum, item) => sum + item.amountMinor, 0);

  rankedAllocations
    .sort((left, right) => right.remainder - left.remainder || left.id.localeCompare(right.id))
    .forEach((item) => {
      if (allocatedMinor < cappedReduction) {
        item.amountMinor += 1;
        allocatedMinor += 1;
      }
      allocations.set(item.id, item.amountMinor);
    });

  return allocations;
}

function mergeAllocations(target: Map<string, number>, source: Map<string, number>) {
  for (const [id, amountMinor] of source.entries()) {
    target.set(id, (target.get(id) ?? 0) + amountMinor);
  }
}
