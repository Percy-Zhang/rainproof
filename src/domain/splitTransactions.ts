import { normalizeCurrencyCode } from './money';
import type { CurrencyCode, NewTransactionInput, Transaction, TransactionKind, TransactionLine } from './types';

export type SplitTransactionLineKind = Extract<TransactionKind, 'expense' | 'income'>;
export type SplitTransactionMode = 'standard' | 'mixed';
export type SplitTransactionValidationMode = SplitTransactionMode | 'auto';

export type SplitTransactionDraftLine = {
  id?: string;
  kind?: SplitTransactionLineKind;
  amountMinor: number;
  categoryId: string;
  subcategoryId: string;
  note?: string;
};

export type MixedSplitTransactionDraftLine = SplitTransactionDraftLine & {
  kind: SplitTransactionLineKind;
};

type SplitLine = Pick<
  TransactionLine,
  'accountId' | 'amountMinor' | 'currencyCode' | 'categoryId' | 'subcategoryId'
> & {
  note?: string;
};

export function isSplittableTransactionKind(kind: TransactionKind): kind is SplitTransactionLineKind {
  return kind === 'expense' || kind === 'income';
}

export function getTransactionSplitLines(
  transaction: Pick<Transaction, 'kind'>,
  lines: TransactionLine[],
): TransactionLine[] {
  if (isSplittableTransactionKind(transaction.kind)) {
    return lines.filter((line) => line.amountMinor !== 0);
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
  if (!isSplittableTransactionKind(kind)) {
    return 0;
  }

  return Math.abs(lines.reduce((sum, line) => sum + line.amountMinor, 0));
}

export function validateSplitTransactionLines({
  kind,
  lines,
  mode = 'standard',
  totalMinor,
}: {
  kind: TransactionKind;
  lines: SplitLine[];
  mode?: SplitTransactionValidationMode;
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
  let standardTotalMinor = 0;
  let signedTotalMinor = 0;
  let positiveLineCount = 0;
  let negativeLineCount = 0;

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

    if (!line.categoryId || !line.subcategoryId) {
      throw new Error('Choose a category and subcategory for every split line.');
    }

    standardTotalMinor += Math.abs(line.amountMinor);
    signedTotalMinor += line.amountMinor;
    if (line.amountMinor > 0) {
      positiveLineCount += 1;
    } else {
      negativeLineCount += 1;
    }
  }

  const resolvedMode = mode === 'auto' ? resolveSplitValidationMode(kind, lines) : mode;

  if (resolvedMode === 'standard') {
    validateStandardSplitLineSigns(kind, lines);
    if (totalMinor !== undefined && standardTotalMinor !== totalMinor) {
      throw new Error('Split line amounts must equal the transaction total.');
    }
    return;
  }

  if (positiveLineCount === 0 || negativeLineCount === 0) {
    throw new Error('Mixed split lines need at least one income line and one expense line.');
  }

  const expectedSignedTotalMinor = kind === 'income' ? totalMinor : totalMinor === undefined ? undefined : -totalMinor;
  if (expectedSignedTotalMinor !== undefined && signedTotalMinor !== expectedSignedTotalMinor) {
    throw new Error('Mixed split lines must net to the transaction total.');
  }

  if (expectedSignedTotalMinor === undefined && (kind === 'income' ? signedTotalMinor <= 0 : signedTotalMinor >= 0)) {
    throw new Error('Mixed split lines must net to the transaction kind.');
  }
}

export function buildMixedSplitTransactionLines({
  kind,
  accountId,
  currencyCode,
  parentTitle,
  totalMinor,
  splitLines,
}: {
  kind: SplitTransactionLineKind;
  accountId: string;
  currencyCode: CurrencyCode;
  parentTitle?: string;
  totalMinor: number;
  splitLines: MixedSplitTransactionDraftLine[];
}): NewTransactionInput['lines'] {
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
  const lines = splitLines.map((line) => ({
    id: line.id,
    accountId,
    amountMinor: Math.abs(line.amountMinor) * getSplitLineKindSign(line.kind),
    currencyCode: normalizedCurrencyCode,
    categoryId: line.categoryId,
    subcategoryId: line.subcategoryId,
    note: resolveSplitLineNote(line.note, parentTitle),
  }));

  validateSplitTransactionLines({
    kind,
    lines,
    mode: 'mixed',
    totalMinor,
  });

  return lines;
}

export function getSplitLineKindFromAmount(amountMinor: number): SplitTransactionLineKind | null {
  if (amountMinor > 0) {
    return 'income';
  }

  if (amountMinor < 0) {
    return 'expense';
  }

  return null;
}

export function isMixedSplitTransactionLines(
  lines: Pick<TransactionLine, 'amountMinor'>[],
): boolean {
  let hasIncome = false;
  let hasExpense = false;

  for (const line of lines) {
    hasIncome ||= line.amountMinor > 0;
    hasExpense ||= line.amountMinor < 0;
  }

  return hasIncome && hasExpense;
}

export function getSplitLineKindForMode({
  lineKind,
  parentKind,
  splitMode,
}: {
  lineKind?: SplitTransactionLineKind;
  parentKind: SplitTransactionLineKind;
  splitMode: SplitTransactionMode;
}): SplitTransactionLineKind {
  return splitMode === 'mixed' ? lineKind ?? parentKind : parentKind;
}

function resolveSplitValidationMode(
  kind: SplitTransactionLineKind,
  lines: Pick<TransactionLine, 'amountMinor'>[],
): SplitTransactionValidationMode {
  return lines.some((line) => getSplitLineKindFromAmount(line.amountMinor) !== kind) ? 'mixed' : 'standard';
}

function validateStandardSplitLineSigns(
  kind: SplitTransactionLineKind,
  lines: Pick<TransactionLine, 'amountMinor'>[],
): void {
  for (const line of lines) {
    if (kind === 'expense' && line.amountMinor >= 0) {
      throw new Error('Expense split line amounts must be negative.');
    }

    if (kind === 'income' && line.amountMinor <= 0) {
      throw new Error('Income split line amounts must be positive.');
    }
  }
}

function getSplitLineKindSign(kind: SplitTransactionLineKind): 1 | -1 {
  return kind === 'expense' ? -1 : 1;
}

export function buildSplitTransactionLines({
  kind,
  accountId,
  currencyCode,
  parentTitle,
  totalMinor,
  splitLines,
}: {
  kind: TransactionKind;
  accountId: string;
  currencyCode: CurrencyCode;
  parentTitle?: string;
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
    note: resolveSplitLineNote(line.note, parentTitle),
  }));

  validateSplitTransactionLines({
    kind,
    lines,
    totalMinor,
  });

  return lines;
}

function resolveSplitLineNote(note: string | undefined, parentTitle: string | undefined): string {
  const trimmedNote = note?.trim() ?? '';
  if (trimmedNote) {
    return trimmedNote;
  }

  return parentTitle?.trim() ?? '';
}
