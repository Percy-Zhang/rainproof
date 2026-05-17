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

  const sourceCurrencyCodes = getTransactionCurrencyCodes(lines, source.id, (amountMinor) => amountMinor > 0);
  if (!sourceCurrencyCodes.has(currencyCode)) {
    throw new Error('Link currency must match the source income transaction.');
  }

  const targetCurrencyCodes = getTransactionCurrencyCodes(lines, target.id, (amountMinor) => amountMinor < 0);
  if (!targetCurrencyCodes.has(currencyCode)) {
    throw new Error('Link currency must match the target expense transaction.');
  }

  const relatedExistingLinks = existingLinks.filter((link) => link.id !== currentLinkId);
  if (
    relatedExistingLinks.some(
      (link) =>
        link.sourceTransactionId === sourceTransactionId &&
        link.targetTransactionId === targetTransactionId &&
        link.linkType === input.linkType &&
        link.amountMinor === input.amountMinor &&
        link.currencyCode === currencyCode,
    )
  ) {
    throw new Error('This transaction link already exists.');
  }

  if (relatedExistingLinks.some((link) => link.sourceTransactionId === sourceTransactionId)) {
    throw new Error('This income transaction is already linked to another expense.');
  }

  return {
    sourceTransactionId,
    targetTransactionId,
    linkType: input.linkType,
    amountMinor: input.amountMinor,
    currencyCode,
  };
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
