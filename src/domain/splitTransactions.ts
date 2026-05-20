import { normalizeCurrencyCode } from './money';
import type { CurrencyCode, NewTransactionInput, Transaction, TransactionKind, TransactionLine } from './types';

export type SplitExpenseDraftLine = {
  id?: string;
  amountMinor: number;
  categoryId: string;
  subcategoryId: string;
  note?: string;
};

type SplitExpenseLine = Pick<
  TransactionLine,
  'accountId' | 'amountMinor' | 'currencyCode' | 'categoryId' | 'subcategoryId'
> & {
  note?: string;
};

export function isSplitExpenseTransaction(
  transaction: Pick<Transaction, 'kind'>,
  lines: Pick<TransactionLine, 'amountMinor'>[],
): boolean {
  return transaction.kind === 'expense' && lines.filter((line) => line.amountMinor < 0).length > 1;
}

export function sumSplitExpenseLinesMinor(lines: Pick<TransactionLine, 'amountMinor'>[]): number {
  return lines
    .filter((line) => line.amountMinor < 0)
    .reduce((sum, line) => sum + Math.abs(line.amountMinor), 0);
}

export function validateSplitExpenseTransactionLines({
  kind,
  lines,
  totalMinor,
}: {
  kind: TransactionKind;
  lines: SplitExpenseLine[];
  totalMinor?: number;
}): void {
  if (kind !== 'expense') {
    throw new Error('Only expense transactions can be split.');
  }

  if (lines.length < 2) {
    throw new Error('Add at least two split lines.');
  }

  const firstAccountId = lines[0]?.accountId;
  const firstCurrencyCode = normalizeCurrencyCode(lines[0]?.currencyCode ?? '');
  let splitTotalMinor = 0;

  for (const line of lines) {
    if (!line.accountId) {
      throw new Error('Choose an account for every split line.');
    }

    if (line.accountId !== firstAccountId) {
      throw new Error('Split expense lines must use the same account.');
    }

    if (!line.currencyCode) {
      throw new Error('Choose a currency for every split line.');
    }

    if (normalizeCurrencyCode(line.currencyCode) !== firstCurrencyCode) {
      throw new Error('Split expense lines must use the same currency.');
    }

    if (!Number.isInteger(line.amountMinor) || line.amountMinor >= 0) {
      throw new Error('Split expense line amounts must be negative.');
    }

    if (!line.categoryId || !line.subcategoryId) {
      throw new Error('Choose a category and subcategory for every split line.');
    }

    splitTotalMinor += Math.abs(line.amountMinor);
  }

  if (totalMinor !== undefined && splitTotalMinor !== totalMinor) {
    throw new Error('Split line amounts must equal the transaction total.');
  }
}

export function buildSplitExpenseTransactionLines({
  accountId,
  currencyCode,
  totalMinor,
  splitLines,
}: {
  accountId: string;
  currencyCode: CurrencyCode;
  totalMinor: number;
  splitLines: SplitExpenseDraftLine[];
}): NewTransactionInput['lines'] {
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
  const lines = splitLines.map((line) => ({
    accountId,
    amountMinor: -Math.abs(line.amountMinor),
    currencyCode: normalizedCurrencyCode,
    categoryId: line.categoryId,
    subcategoryId: line.subcategoryId,
    note: line.note?.trim() ?? '',
  }));

  validateSplitExpenseTransactionLines({
    kind: 'expense',
    lines,
    totalMinor,
  });

  return lines;
}
