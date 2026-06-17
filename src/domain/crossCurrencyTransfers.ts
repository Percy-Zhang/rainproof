import { normalizeCurrencyCode } from './money';
import type { Account, CurrencyCode, NewTransactionInput } from './types';

const RATE_SCALE = 100_000_000n;

export type CrossCurrencyTransferRate = {
  baseCurrencyCode: CurrencyCode;
  quoteCurrencyCode: CurrencyCode;
  rateDecimal: string;
};

export function buildCrossCurrencyTransferLines({
  accounts,
  sourceAccountId,
  targetAccountId,
  sourceAmountMinor,
  targetAmountMinor,
  sourceLineId,
  targetLineId,
}: {
  accounts: Account[];
  sourceAccountId: string;
  targetAccountId: string;
  sourceAmountMinor: number;
  targetAmountMinor: number;
  sourceLineId?: string;
  targetLineId?: string;
}): NewTransactionInput['lines'] {
  const sourceAccount = accounts.find((account) => account.id === sourceAccountId);
  const targetAccount = accounts.find((account) => account.id === targetAccountId);

  if (!sourceAccount || !targetAccount) {
    throw new Error('Choose source and destination accounts.');
  }

  if (sourceAccount.id === targetAccount.id) {
    throw new Error('Source and destination accounts must be different.');
  }

  if (sourceAccount.currencyCode === targetAccount.currencyCode) {
    throw new Error('Cross-currency transfers require accounts with different currencies.');
  }

  assertPositiveMinor(sourceAmountMinor, 'Sent amount');
  assertPositiveMinor(targetAmountMinor, 'Received amount');

  return [
    {
      id: sourceLineId,
      accountId: sourceAccount.id,
      amountMinor: -sourceAmountMinor,
      currencyCode: sourceAccount.currencyCode,
      transferPeerAccountId: targetAccount.id,
    },
    {
      id: targetLineId,
      accountId: targetAccount.id,
      amountMinor: targetAmountMinor,
      currencyCode: targetAccount.currencyCode,
      transferPeerAccountId: sourceAccount.id,
    },
  ];
}

export function getCrossCurrencyTransferRate({
  sourceAmountMinor,
  sourceCurrencyCode,
  targetAmountMinor,
  targetCurrencyCode,
}: {
  sourceAmountMinor: number;
  sourceCurrencyCode: CurrencyCode;
  targetAmountMinor: number;
  targetCurrencyCode: CurrencyCode;
}): CrossCurrencyTransferRate {
  assertPositiveMinor(sourceAmountMinor, 'Sent amount');
  assertPositiveMinor(targetAmountMinor, 'Received amount');

  return {
    baseCurrencyCode: sourceCurrencyCode,
    quoteCurrencyCode: targetCurrencyCode,
    rateDecimal: divideMinorAmounts(targetAmountMinor, sourceAmountMinor),
  };
}

export function isCrossCurrencyTransferLinePair(
  lines: NewTransactionInput['lines'],
): boolean {
  if (lines.length !== 2) {
    return false;
  }

  const sourceLine = lines.find((line) => line.amountMinor < 0);
  const targetLine = lines.find((line) => line.amountMinor > 0);

  return Boolean(
    sourceLine &&
      targetLine &&
      sourceLine.accountId !== targetLine.accountId &&
      normalizeCurrencyCode(sourceLine.currencyCode) !== normalizeCurrencyCode(targetLine.currencyCode),
  );
}

export function isCrossCurrencyTransferAccountPair({
  accounts,
  sourceAccountId,
  targetAccountId,
}: {
  accounts: Account[];
  sourceAccountId: string;
  targetAccountId: string;
}): boolean {
  const sourceAccount = accounts.find((account) => account.id === sourceAccountId);
  const targetAccount = accounts.find((account) => account.id === targetAccountId);

  return Boolean(
    sourceAccount &&
      targetAccount &&
      sourceAccount.id !== targetAccount.id &&
      normalizeCurrencyCode(sourceAccount.currencyCode) !== normalizeCurrencyCode(targetAccount.currencyCode),
  );
}

export function formatCrossCurrencyTransferRateLabel({
  sourceAmountMinor,
  sourceCurrencyCode,
  targetAmountMinor,
  targetCurrencyCode,
}: {
  sourceAmountMinor: number;
  sourceCurrencyCode: CurrencyCode;
  targetAmountMinor: number;
  targetCurrencyCode: CurrencyCode;
}): string {
  const rate = getCrossCurrencyTransferRate({
    sourceAmountMinor,
    sourceCurrencyCode,
    targetAmountMinor,
    targetCurrencyCode,
  });

  return `1 ${rate.baseCurrencyCode} = ${rate.rateDecimal} ${rate.quoteCurrencyCode}`;
}

function assertPositiveMinor(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
}

function divideMinorAmounts(numeratorMinor: number, denominatorMinor: number): string {
  const numerator = BigInt(numeratorMinor);
  const denominator = BigInt(denominatorMinor);
  const scaled = (numerator * RATE_SCALE + denominator / 2n) / denominator;
  const whole = scaled / RATE_SCALE;
  const fraction = (scaled % RATE_SCALE).toString().padStart(8, '0').replace(/0+$/, '');

  return fraction ? `${whole}.${fraction}` : whole.toString();
}
