import { normalizeCurrencyCode } from './money';
import type { CurrencyCode, NewTransactionInput, Transaction, TransactionKind, TransactionLine } from './types';

export type SplitTransactionDraftLine = {
  id?: string;
  amountMinor: number;
  categoryId: string;
  subcategoryId: string;
  note?: string;
};

type SplitLine = Pick<
  TransactionLine,
  'accountId' | 'amountMinor' | 'currencyCode' | 'categoryId' | 'subcategoryId'
> & {
  note?: string;
};

export function isSplittableTransactionKind(kind: TransactionKind): boolean {
  return kind === 'expense' || kind === 'income';
}

export function getTransactionSplitLines(
  transaction: Pick<Transaction, 'kind'>,
  lines: TransactionLine[],
): TransactionLine[] {
  if (transaction.kind === 'expense') {
    return lines.filter((line) => line.amountMinor < 0);
  }

  if (transaction.kind === 'income') {
    return lines.filter((line) => line.amountMinor > 0);
  }

  return [];
}

export function isSplitTransaction(
  transaction: Pick<Transaction, 'kind'>,
  lines: TransactionLine[],
): boolean {
  return getTransactionSplitLines(transaction, lines).length > 1;
}

export function sumSplitTransactionLinesMinor(
  kind: TransactionKind,
  lines: Pick<TransactionLine, 'amountMinor'>[],
): number {
  return lines
    .filter((line) => (kind === 'expense' ? line.amountMinor < 0 : kind === 'income' ? line.amountMinor > 0 : false))
    .reduce((sum, line) => sum + Math.abs(line.amountMinor), 0);
}

export function validateSplitTransactionLines({
  kind,
  lines,
  totalMinor,
}: {
  kind: TransactionKind;
  lines: SplitLine[];
  totalMinor?: number;
}): void {
  if (!isSplittableTransactionKind(kind)) {
    throw new Error('Transfers cannot be split.');
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
      throw new Error('Split lines must use the same account.');
    }

    if (!line.currencyCode) {
      throw new Error('Choose a currency for every split line.');
    }

    if (normalizeCurrencyCode(line.currencyCode) !== firstCurrencyCode) {
      throw new Error('Split lines must use the same currency.');
    }

    if (!Number.isInteger(line.amountMinor) || line.amountMinor === 0) {
      throw new Error('Split line amounts must be greater than zero.');
    }

    if (kind === 'expense' && line.amountMinor >= 0) {
      throw new Error('Expense split line amounts must be negative.');
    }

    if (kind === 'income' && line.amountMinor <= 0) {
      throw new Error('Income split line amounts must be positive.');
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

export function buildSplitTransactionLines({
  kind,
  accountId,
  currencyCode,
  totalMinor,
  splitLines,
}: {
  kind: TransactionKind;
  accountId: string;
  currencyCode: CurrencyCode;
  totalMinor: number;
  splitLines: SplitTransactionDraftLine[];
}): NewTransactionInput['lines'] {
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
  const sign = kind === 'expense' ? -1 : 1;
  const lines = splitLines.map((line) => ({
    id: line.id,
    accountId,
    amountMinor: Math.abs(line.amountMinor) * sign,
    currencyCode: normalizedCurrencyCode,
    categoryId: line.categoryId,
    subcategoryId: line.subcategoryId,
    note: line.note?.trim() ?? '',
  }));

  validateSplitTransactionLines({
    kind,
    lines,
    totalMinor,
  });

  return lines;
}
