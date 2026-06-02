import { parseMoneyInput } from './money';
import { buildSplitTransactionLines } from './splitTransactions';
import type { CurrencyCode, NewTransactionInput, TransactionKind } from './types';

export type SplitTransactionFormLine = {
  id: string;
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

export function createSplitTransactionFormLine({
  id,
  amount = '',
  categoryId,
  subcategoryId,
  note = '',
}: {
  id: string;
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

export function formatMinorInput(amountMinor: number): string {
  const absolute = Math.abs(amountMinor);
  const whole = Math.floor(absolute / 100);
  const cents = String(absolute % 100).padStart(2, '0');
  return `${whole}.${cents}`;
}
