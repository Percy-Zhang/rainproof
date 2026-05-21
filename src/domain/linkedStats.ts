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
  const lineById = new Map(lines.map((line) => [line.id, line]));
  const linesByTransactionId = groupLinesByTransaction(lines);
  const targetTransactionReductions = new Map<string, AdjustmentGroup>();
  const sourceTransactionExclusions = new Map<string, AdjustmentGroup>();
  const targetLineReductions = new Map<string, number>();
  const sourceLineExclusions = new Map<string, number>();
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
    const targetScope = getLinkedTargetScope({ link, target, lineById, linesByTransactionId, currencyCode });
    const sourceScope = getLinkedSourceScope({ link, source, lineById, linesByTransactionId, currencyCode });

    if (!targetScope || !sourceScope) {
      ignoredCurrencyMismatchLinkIds.push(link.id);
      continue;
    }

    if (targetScope.lineId) {
      addLineAdjustment(targetLineReductions, targetScope.lineId, link.amountMinor);
    } else {
      addAdjustment(targetTransactionReductions, target.id, currencyCode, link.amountMinor);
    }

    if (sourceScope.lineId) {
      addLineAdjustment(sourceLineExclusions, sourceScope.lineId, link.amountMinor);
    } else {
      addAdjustment(sourceTransactionExclusions, source.id, currencyCode, link.amountMinor);
    }
  }

  const expenseLineReductionMinorByLineId = new Map<string, number>();
  const incomeLineExclusionMinorByLineId = new Map<string, number>();
  const overpayments: LinkedStatsOverpayment[] = [];

  applyDirectLineAdjustments({
    target: expenseLineReductionMinorByLineId,
    directAdjustments: targetLineReductions,
    lineById,
    getLineGrossMinor: (line) => Math.abs(Math.min(0, line.amountMinor)),
    overpayments,
  });

  for (const group of targetTransactionReductions.values()) {
    const targetExpenseLines = getSignedCurrencyLines(
      linesByTransactionId,
      group.transactionId,
      group.currencyCode,
      (amountMinor) => amountMinor < 0,
    );
    const grossItems = targetExpenseLines.map((line) => ({
      id: line.id,
      amountMinor: Math.max(
        0,
        Math.abs(line.amountMinor) - (expenseLineReductionMinorByLineId.get(line.id) ?? 0),
      ),
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

  applyDirectLineAdjustments({
    target: incomeLineExclusionMinorByLineId,
    directAdjustments: sourceLineExclusions,
    lineById,
    getLineGrossMinor: (line) => Math.max(0, line.amountMinor),
  });

  for (const group of sourceTransactionExclusions.values()) {
    const sourceIncomeLines = getSignedCurrencyLines(
      linesByTransactionId,
      group.transactionId,
      group.currencyCode,
      (amountMinor) => amountMinor > 0,
    );
    const grossItems = sourceIncomeLines.map((line) => ({
      id: line.id,
      amountMinor: Math.max(
        0,
        line.amountMinor - (incomeLineExclusionMinorByLineId.get(line.id) ?? 0),
      ),
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

function getLinkedTargetScope({
  link,
  target,
  lineById,
  linesByTransactionId,
  currencyCode,
}: {
  link: TransactionLink;
  target: Transaction;
  lineById: Map<string, TransactionLine>;
  linesByTransactionId: Map<string, TransactionLine[]>;
  currencyCode: CurrencyCode;
}): { lineId?: string } | null {
  if (link.targetLineId) {
    const targetLine = lineById.get(link.targetLineId);
    if (
      !targetLine ||
      targetLine.transactionId !== target.id ||
      targetLine.amountMinor >= 0 ||
      normalizeCurrencyCode(targetLine.currencyCode) !== currencyCode
    ) {
      return null;
    }

    return { lineId: targetLine.id };
  }

  const targetExpenseLines = getSignedCurrencyLines(
    linesByTransactionId,
    target.id,
    currencyCode,
    (amountMinor) => amountMinor < 0,
  );
  return targetExpenseLines.length ? {} : null;
}

function getLinkedSourceScope({
  link,
  source,
  lineById,
  linesByTransactionId,
  currencyCode,
}: {
  link: TransactionLink;
  source: Transaction;
  lineById: Map<string, TransactionLine>;
  linesByTransactionId: Map<string, TransactionLine[]>;
  currencyCode: CurrencyCode;
}): { lineId?: string } | null {
  if (link.sourceLineId) {
    const sourceLine = lineById.get(link.sourceLineId);
    if (
      !sourceLine ||
      sourceLine.transactionId !== source.id ||
      sourceLine.amountMinor <= 0 ||
      normalizeCurrencyCode(sourceLine.currencyCode) !== currencyCode
    ) {
      return null;
    }

    return { lineId: sourceLine.id };
  }

  const sourceIncomeLines = getSignedCurrencyLines(
    linesByTransactionId,
    source.id,
    currencyCode,
    (amountMinor) => amountMinor > 0,
  );
  return sourceIncomeLines.length ? {} : null;
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

function addLineAdjustment(adjustments: Map<string, number>, lineId: string, amountMinor: number) {
  adjustments.set(lineId, (adjustments.get(lineId) ?? 0) + amountMinor);
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

function applyDirectLineAdjustments({
  target,
  directAdjustments,
  lineById,
  getLineGrossMinor,
  overpayments,
}: {
  target: Map<string, number>;
  directAdjustments: Map<string, number>;
  lineById: Map<string, TransactionLine>;
  getLineGrossMinor: (line: TransactionLine) => number;
  overpayments?: LinkedStatsOverpayment[];
}) {
  for (const [lineId, amountMinor] of directAdjustments.entries()) {
    const line = lineById.get(lineId);
    if (!line) {
      continue;
    }

    const grossMinor = getLineGrossMinor(line);
    if (amountMinor > grossMinor && overpayments) {
      overpayments.push({
        targetTransactionId: line.transactionId,
        currencyCode: normalizeCurrencyCode(line.currencyCode),
        overpaidMinor: amountMinor - grossMinor,
      });
    }

    target.set(lineId, Math.min(amountMinor, grossMinor));
  }
}
