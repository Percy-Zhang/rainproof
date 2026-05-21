import { normalizeCurrencyCode } from './money';
import type {
  CurrencyCode,
  NewTransactionLinkInput,
  Transaction,
  TransactionLine,
  TransactionLink,
  TransactionLinkType,
} from './types';

const transactionLinkTypes = new Set<TransactionLinkType>([
  'refund',
  'reimbursement',
  'shared_expense_contribution',
]);

export type ValidatedTransactionLinkInput = {
  sourceTransactionId: string;
  targetTransactionId: string;
  sourceLineId: string | null;
  targetLineId: string | null;
  linkType: TransactionLinkType;
  amountMinor: number;
  currencyCode: CurrencyCode;
};

type ValidateTransactionLinkInputOptions = {
  input: NewTransactionLinkInput;
  transactions: Transaction[];
  lines: TransactionLine[];
  existingLinks?: TransactionLink[];
  currentLinkId?: string;
};

export function validateTransactionLinkInput({
  input,
  transactions,
  lines,
  existingLinks = [],
  currentLinkId,
}: ValidateTransactionLinkInputOptions): ValidatedTransactionLinkInput {
  const sourceTransactionId = input.sourceTransactionId.trim();
  const targetTransactionId = input.targetTransactionId.trim();
  const sourceLineId = normalizeOptionalId(input.sourceLineId);
  const targetLineId = normalizeOptionalId(input.targetLineId);
  const currencyCode = normalizeCurrencyCode(input.currencyCode);

  if (!sourceTransactionId) {
    throw new Error('Choose a source transaction.');
  }

  if (!targetTransactionId) {
    throw new Error('Choose a target transaction.');
  }

  if (sourceTransactionId === targetTransactionId) {
    throw new Error('A transaction cannot link to itself.');
  }

  if (!transactionLinkTypes.has(input.linkType)) {
    throw new Error('Choose a valid transaction link type.');
  }

  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error('Link amount must be greater than zero.');
  }

  const source = transactions.find((transaction) => transaction.id === sourceTransactionId);
  if (!source) {
    throw new Error('Source transaction not found.');
  }

  const target = transactions.find((transaction) => transaction.id === targetTransactionId);
  if (!target) {
    throw new Error('Target transaction not found.');
  }

  if (source.kind !== 'income') {
    throw new Error('Source transaction must be income.');
  }

  if (target.kind !== 'expense') {
    throw new Error('Target transaction must be expense.');
  }

  const sourceLine = sourceLineId ? lines.find((line) => line.id === sourceLineId) : undefined;
  if (sourceLineId && !sourceLine) {
    throw new Error('Source transaction line not found.');
  }

  if (sourceLine && sourceLine.transactionId !== sourceTransactionId) {
    throw new Error('Source transaction line does not belong to the source transaction.');
  }

  if (sourceLine && sourceLine.amountMinor <= 0) {
    throw new Error('Source transaction line must be income.');
  }

  const targetLine = targetLineId ? lines.find((line) => line.id === targetLineId) : undefined;
  if (targetLineId && !targetLine) {
    throw new Error('Target transaction line not found.');
  }

  if (targetLine && targetLine.transactionId !== targetTransactionId) {
    throw new Error('Target transaction line does not belong to the target transaction.');
  }

  if (targetLine && targetLine.amountMinor >= 0) {
    throw new Error('Target transaction line must be expense.');
  }

  const sourceCurrencyCodes = getTransactionCurrencyCodes(lines, source.id, (amountMinor) => amountMinor > 0);
  if (!sourceCurrencyCodes.has(currencyCode)) {
    throw new Error('Link currency must match the source income transaction.');
  }

  const targetCurrencyCodes = getTransactionCurrencyCodes(lines, target.id, (amountMinor) => amountMinor < 0);
  if (!targetCurrencyCodes.has(currencyCode)) {
    throw new Error('Link currency must match the target expense transaction.');
  }

  if (sourceLine && normalizeCurrencyCode(sourceLine.currencyCode) !== currencyCode) {
    throw new Error('Link currency must match the source income line.');
  }

  if (targetLine && normalizeCurrencyCode(targetLine.currencyCode) !== currencyCode) {
    throw new Error('Link currency must match the target expense line.');
  }

  const relatedExistingLinks = existingLinks.filter((link) => link.id !== currentLinkId);
  if (
    relatedExistingLinks.some(
      (link) =>
        link.sourceTransactionId === sourceTransactionId &&
        link.targetTransactionId === targetTransactionId &&
        normalizeOptionalId(link.sourceLineId) === sourceLineId &&
        normalizeOptionalId(link.targetLineId) === targetLineId &&
        link.linkType === input.linkType &&
        link.amountMinor === input.amountMinor &&
        link.currencyCode === currencyCode,
    )
  ) {
    throw new Error('This transaction link already exists.');
  }

  validateAllocationLimits({
    input: {
      sourceTransactionId,
      targetTransactionId,
      sourceLineId,
      targetLineId,
      amountMinor: input.amountMinor,
      currencyCode,
    },
    lines,
    relatedExistingLinks,
  });

  return {
    sourceTransactionId,
    targetTransactionId,
    sourceLineId,
    targetLineId,
    linkType: input.linkType,
    amountMinor: input.amountMinor,
    currencyCode,
  };
}

function validateAllocationLimits({
  input,
  lines,
  relatedExistingLinks,
}: {
  input: {
    sourceTransactionId: string;
    targetTransactionId: string;
    sourceLineId: string | null;
    targetLineId: string | null;
    amountMinor: number;
    currencyCode: CurrencyCode;
  };
  lines: TransactionLine[];
  relatedExistingLinks: TransactionLink[];
}): void {
  const sourceAvailableMinor = getTransactionSignedCurrencyTotal(
    lines,
    input.sourceTransactionId,
    input.currencyCode,
    (amountMinor) => amountMinor > 0,
  );
  const targetAvailableMinor = getTransactionSignedCurrencyTotal(
    lines,
    input.targetTransactionId,
    input.currencyCode,
    (amountMinor) => amountMinor < 0,
  );
  const sourceAllocatedMinor = getAllocatedTransactionMinor(
    relatedExistingLinks,
    input.sourceTransactionId,
    input.currencyCode,
    'source',
  ) + input.amountMinor;
  const targetAllocatedMinor = getAllocatedTransactionMinor(
    relatedExistingLinks,
    input.targetTransactionId,
    input.currencyCode,
    'target',
  ) + input.amountMinor;

  if (sourceAllocatedMinor > sourceAvailableMinor) {
    throw new Error('Linked amounts cannot exceed the source income transaction.');
  }

  if (targetAllocatedMinor > targetAvailableMinor) {
    throw new Error('Linked amounts cannot exceed the target expense transaction.');
  }

  if (input.sourceLineId) {
    const sourceLineAvailableMinor = getLineAvailableMinor(lines, input.sourceLineId, input.currencyCode, (amountMinor) => amountMinor > 0);
    const sourceLineAllocatedMinor = getAllocatedLineMinor(relatedExistingLinks, input.sourceLineId, input.currencyCode, 'source') + input.amountMinor;
    if (sourceLineAllocatedMinor > sourceLineAvailableMinor) {
      throw new Error('Linked amounts cannot exceed the source income line.');
    }
  }

  if (input.targetLineId) {
    const targetLineAvailableMinor = getLineAvailableMinor(lines, input.targetLineId, input.currencyCode, (amountMinor) => amountMinor < 0);
    const targetLineAllocatedMinor = getAllocatedLineMinor(relatedExistingLinks, input.targetLineId, input.currencyCode, 'target') + input.amountMinor;
    if (targetLineAllocatedMinor > targetLineAvailableMinor) {
      throw new Error('Linked amounts cannot exceed the target expense line.');
    }
  }
}

function getTransactionSignedCurrencyTotal(
  lines: TransactionLine[],
  transactionId: string,
  currencyCode: CurrencyCode,
  amountFilter: (amountMinor: number) => boolean,
): number {
  return lines
    .filter(
      (line) =>
        line.transactionId === transactionId &&
        normalizeCurrencyCode(line.currencyCode) === currencyCode &&
        amountFilter(line.amountMinor),
    )
    .reduce((sum, line) => sum + Math.abs(line.amountMinor), 0);
}

function getLineAvailableMinor(
  lines: TransactionLine[],
  lineId: string,
  currencyCode: CurrencyCode,
  amountFilter: (amountMinor: number) => boolean,
): number {
  const line = lines.find((item) => item.id === lineId);
  if (!line || normalizeCurrencyCode(line.currencyCode) !== currencyCode || !amountFilter(line.amountMinor)) {
    return 0;
  }

  return Math.abs(line.amountMinor);
}

function getAllocatedTransactionMinor(
  links: TransactionLink[],
  transactionId: string,
  currencyCode: CurrencyCode,
  side: 'source' | 'target',
): number {
  return links
    .filter((link) => {
      const linkedTransactionId = side === 'source' ? link.sourceTransactionId : link.targetTransactionId;
      return linkedTransactionId === transactionId && normalizeCurrencyCode(link.currencyCode) === currencyCode;
    })
    .reduce((sum, link) => sum + link.amountMinor, 0);
}

function getAllocatedLineMinor(
  links: TransactionLink[],
  lineId: string,
  currencyCode: CurrencyCode,
  side: 'source' | 'target',
): number {
  return links
    .filter((link) => {
      const linkedLineId = side === 'source' ? normalizeOptionalId(link.sourceLineId) : normalizeOptionalId(link.targetLineId);
      return linkedLineId === lineId && normalizeCurrencyCode(link.currencyCode) === currencyCode;
    })
    .reduce((sum, link) => sum + link.amountMinor, 0);
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed || null;
}

function getTransactionCurrencyCodes(
  lines: TransactionLine[],
  transactionId: string,
  amountFilter: (amountMinor: number) => boolean,
): Set<CurrencyCode> {
  return new Set(
    lines
      .filter((line) => line.transactionId === transactionId && amountFilter(line.amountMinor))
      .map((line) => normalizeCurrencyCode(line.currencyCode)),
  );
}
