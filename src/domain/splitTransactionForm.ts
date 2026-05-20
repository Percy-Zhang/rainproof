import { parseMoneyInput } from './money';
import { buildSplitExpenseTransactionLines } from './splitTransactions';
import type { CurrencyCode, NewTransactionInput } from './types';

export type SplitExpenseFormLine = {
  id: string;
  amount: string;
  categoryId: string;
  subcategoryId: string;
  note: string;
};

export type SplitExpenseFormSummary = {
  allocatedMinor: number;
  remainingMinor: number;
  invalidLineCount: number;
  isBalanced: boolean;
};

export function createSplitExpenseFormLine({
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
}): SplitExpenseFormLine {
  return {
    id,
    amount,
    categoryId,
    subcategoryId,
    note,
  };
}

export function updateSplitExpenseFormLine(
  lines: SplitExpenseFormLine[],
  lineId: string,
  patch: Partial<SplitExpenseFormLine>,
): SplitExpenseFormLine[] {
  return lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line));
}

export function removeSplitExpenseFormLine(lines: SplitExpenseFormLine[], lineId: string): SplitExpenseFormLine[] {
  return lines.filter((line) => line.id !== lineId);
}

export function getSplitExpenseFormSummary(
  totalMinor: number,
  lines: SplitExpenseFormLine[],
): SplitExpenseFormSummary {
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

export function getSplitExpenseValidationMessage(totalMinor: number, lines: SplitExpenseFormLine[]): string {
  if (lines.length < 2) {
    return 'Add at least two split lines.';
  }

  const summary = getSplitExpenseFormSummary(totalMinor, lines);

  if (summary.invalidLineCount > 0) {
    return 'Enter an amount, category, and subcategory for every split line.';
  }

  if (summary.remainingMinor !== 0) {
    return 'Split line amounts must equal the transaction total.';
  }

  return '';
}

export function buildSplitExpenseLinesFromForm({
  accountId,
  currencyCode,
  totalMinor,
  lines,
}: {
  accountId: string;
  currencyCode: CurrencyCode;
  totalMinor: number;
  lines: SplitExpenseFormLine[];
}): NewTransactionInput['lines'] {
  return buildSplitExpenseTransactionLines({
    accountId,
    currencyCode,
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
