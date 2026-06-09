import { parseMoneyInput } from './money';
import {
  buildMixedSplitTransactionLines,
  buildSplitTransactionLines,
  getSplitLineKindForMode,
  type SplitTransactionLineKind,
  type SplitTransactionMode,
} from './splitTransactions';
import type { CurrencyCode, NewTransactionInput, TransactionKind } from './types';

export type SplitTransactionFormLine = {
  id: string;
  kind?: SplitTransactionLineKind;
  amount: string;
  categoryId: string;
  subcategoryId: string;
  note: string;
};

export type SplitTransactionFormSummary = {
  allocatedMinor: number;
  remainingMinor: number;
  invalidLineCount: number;
  isBalanced: boolean;
};

export type MixedSplitTransactionFormSummary = {
  parentSignedMinor: number;
  incomeMinor: number;
  expenseMinor: number;
  signedLineTotalMinor: number;
  differenceMinor: number;
  invalidLineCount: number;
  hasIncome: boolean;
  hasExpense: boolean;
  isBalanced: boolean;
};

export function createSplitTransactionFormLine({
  id,
  kind,
  amount = '',
  categoryId,
  subcategoryId,
  note = '',
}: {
  id: string;
  kind?: SplitTransactionLineKind;
  amount?: string;
  categoryId: string;
  subcategoryId: string;
  note?: string;
}): SplitTransactionFormLine {
  return {
    id,
    amount,
    categoryId,
    subcategoryId,
    note,
    ...(kind ? { kind } : {}),
  };
}

export function updateSplitTransactionFormLine(
  lines: SplitTransactionFormLine[],
  lineId: string,
  patch: Partial<SplitTransactionFormLine>,
): SplitTransactionFormLine[] {
  return lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line));
}

export function removeSplitTransactionFormLine(
  lines: SplitTransactionFormLine[],
  lineId: string,
): SplitTransactionFormLine[] {
  return lines.filter((line) => line.id !== lineId);
}

export function getSplitTransactionFormSummary(
  totalMinor: number,
  lines: SplitTransactionFormLine[],
): SplitTransactionFormSummary {
  let allocatedMinor = 0;
  let invalidLineCount = 0;

  for (const line of lines) {
    try {
      const amountMinor = Math.abs(parseMoneyInput(line.amount));
      if (amountMinor <= 0 || !line.categoryId || !line.subcategoryId) {
        invalidLineCount += 1;
      }
      allocatedMinor += amountMinor;
    } catch {
      invalidLineCount += 1;
    }
  }

  return {
    allocatedMinor,
    remainingMinor: totalMinor - allocatedMinor,
    invalidLineCount,
    isBalanced: totalMinor > 0 && invalidLineCount === 0 && allocatedMinor === totalMinor,
  };
}

export function getSplitTransactionValidationMessage(totalMinor: number, lines: SplitTransactionFormLine[]): string {
  if (lines.length < 2) {
    return 'Add at least two split lines.';
  }

  const summary = getSplitTransactionFormSummary(totalMinor, lines);

  if (summary.invalidLineCount > 0) {
    return 'Enter an amount, category, and subcategory for every split line.';
  }

  if (summary.remainingMinor !== 0) {
    return 'Split line amounts must equal the transaction total.';
  }

  return '';
}

export function getMixedSplitTransactionFormSummary({
  kind,
  totalMinor,
  lines,
}: {
  kind: SplitTransactionLineKind;
  totalMinor: number;
  lines: SplitTransactionFormLine[];
}): MixedSplitTransactionFormSummary {
  let incomeMinor = 0;
  let expenseMinor = 0;
  let invalidLineCount = 0;

  for (const line of lines) {
    try {
      const amountMinor = Math.abs(parseMoneyInput(line.amount));
      if (amountMinor <= 0 || !line.kind || !line.categoryId || !line.subcategoryId) {
        invalidLineCount += 1;
        continue;
      }

      if (line.kind === 'income') {
        incomeMinor += amountMinor;
      } else {
        expenseMinor += amountMinor;
      }
    } catch {
      invalidLineCount += 1;
    }
  }

  const parentSignedMinor = kind === 'income' ? totalMinor : -totalMinor;
  const signedLineTotalMinor = incomeMinor - expenseMinor;
  const differenceMinor = parentSignedMinor - signedLineTotalMinor;
  const hasIncome = incomeMinor > 0;
  const hasExpense = expenseMinor > 0;

  return {
    parentSignedMinor,
    incomeMinor,
    expenseMinor,
    signedLineTotalMinor,
    differenceMinor,
    invalidLineCount,
    hasIncome,
    hasExpense,
    isBalanced:
      totalMinor > 0 &&
      invalidLineCount === 0 &&
      hasIncome &&
      hasExpense &&
      differenceMinor === 0,
  };
}

export function getMixedSplitTransactionValidationMessage({
  kind,
  totalMinor,
  lines,
}: {
  kind: SplitTransactionLineKind;
  totalMinor: number;
  lines: SplitTransactionFormLine[];
}): string {
  if (lines.length < 2) {
    return 'Add at least two split lines.';
  }

  const summary = getMixedSplitTransactionFormSummary({ kind, totalMinor, lines });
  if (summary.invalidLineCount > 0) {
    return 'Enter a kind, amount, category, and subcategory for every split line.';
  }

  if (!summary.hasIncome || !summary.hasExpense) {
    return 'Mixed split lines need at least one income line and one expense line.';
  }

  if (summary.differenceMinor !== 0) {
    return 'Mixed split lines must net to the transaction total.';
  }

  return '';
}

export function getSplitLineCategoryKind({
  line,
  parentKind,
  splitMode,
}: {
  line?: Pick<SplitTransactionFormLine, 'kind'>;
  parentKind: SplitTransactionLineKind;
  splitMode: SplitTransactionMode;
}): SplitTransactionLineKind {
  return getSplitLineKindForMode({
    lineKind: line?.kind,
    parentKind,
    splitMode,
  });
}

export function buildSplitLinesFromForm({
  kind,
  accountId,
  currencyCode,
  parentTitle,
  totalMinor,
  lines,
}: {
  kind: Extract<TransactionKind, 'expense' | 'income'>;
  accountId: string;
  currencyCode: CurrencyCode;
  parentTitle?: string;
  totalMinor: number;
  lines: SplitTransactionFormLine[];
}): NewTransactionInput['lines'] {
  return buildSplitTransactionLines({
    kind,
    accountId,
    currencyCode,
    parentTitle,
    totalMinor,
    splitLines: lines.map((line) => ({
      id: line.id,
      amountMinor: Math.abs(parseMoneyInput(line.amount)),
      categoryId: line.categoryId,
      subcategoryId: line.subcategoryId,
      note: line.note,
    })),
  });
}

export function buildMixedSplitLinesFromForm({
  kind,
  accountId,
  currencyCode,
  parentTitle,
  totalMinor,
  lines,
}: {
  kind: Extract<TransactionKind, 'expense' | 'income'>;
  accountId: string;
  currencyCode: CurrencyCode;
  parentTitle?: string;
  totalMinor: number;
  lines: (SplitTransactionFormLine & { kind: SplitTransactionLineKind })[];
}): NewTransactionInput['lines'] {
  return buildMixedSplitTransactionLines({
    kind,
    accountId,
    currencyCode,
    parentTitle,
    totalMinor,
    splitLines: lines.map((line) => ({
      id: line.id,
      kind: line.kind,
      amountMinor: Math.abs(parseMoneyInput(line.amount)),
      categoryId: line.categoryId,
      subcategoryId: line.subcategoryId,
      note: line.note,
    })),
  });
}

export function formatMinorInput(amountMinor: number): string {
  const absolute = Math.abs(amountMinor);
  const whole = Math.floor(absolute / 100);
  const cents = String(absolute % 100).padStart(2, '0');
  return `${whole}.${cents}`;
}
