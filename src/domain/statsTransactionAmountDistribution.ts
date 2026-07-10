import { isWithinDateRange } from './dates';
import { normalizeCurrencyCode } from './money';
import type { StatsReportKind } from './statsReports';
import type { CurrencyCode, DateRange, Transaction, TransactionLine } from './types';

export type StatsTransactionAmountBucket = {
  id: string;
  minMinor: number;
  maxExclusiveMinor: number | null;
  count: number;
};

export type StatsTransactionAmountDistribution = {
  currencyCode: CurrencyCode;
  reportKind: StatsReportKind;
  totalCount: number;
  buckets: StatsTransactionAmountBucket[];
};

const TRANSACTION_AMOUNT_BUCKETS: readonly Omit<StatsTransactionAmountBucket, 'count'>[] = [
  { id: '0-10', minMinor: 0, maxExclusiveMinor: 1000 },
  { id: '10-25', minMinor: 1000, maxExclusiveMinor: 2500 },
  { id: '25-50', minMinor: 2500, maxExclusiveMinor: 5000 },
  { id: '50-100', minMinor: 5000, maxExclusiveMinor: 10000 },
  { id: '100-250', minMinor: 10000, maxExclusiveMinor: 25000 },
  { id: '250-plus', minMinor: 25000, maxExclusiveMinor: null },
];

export function getStatsTransactionAmountDistribution({
  accountIds,
  currencyCode,
  range,
  reportKind,
  transactionLines,
  transactions,
}: {
  accountIds: string[];
  currencyCode: CurrencyCode;
  range: DateRange;
  reportKind: StatsReportKind;
  transactionLines: TransactionLine[];
  transactions: Transaction[];
}): StatsTransactionAmountDistribution {
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);
  const countsByBucketId = new Map(TRANSACTION_AMOUNT_BUCKETS.map((bucket) => [bucket.id, 0]));

  if (accountIds.length) {
    const selectedAccountIds = new Set(accountIds);
    const eligibleTransactionIds = new Set(
      transactions
        .filter(
          (transaction) =>
            transaction.kind !== 'transfer' && isWithinDateRange(transaction.datetime, range),
        )
        .map((transaction) => transaction.id),
    );
    const amountMinorByTransactionId = new Map<string, number>();

    for (const line of transactionLines) {
      if (
        !eligibleTransactionIds.has(line.transactionId) ||
        !selectedAccountIds.has(line.accountId) ||
        normalizeCurrencyCode(line.currencyCode) !== normalizedCurrencyCode
      ) {
        continue;
      }

      amountMinorByTransactionId.set(
        line.transactionId,
        (amountMinorByTransactionId.get(line.transactionId) ?? 0) + line.amountMinor,
      );
    }

    for (const amountMinor of amountMinorByTransactionId.values()) {
      if (!matchesReportKind(amountMinor, reportKind)) {
        continue;
      }

      const absoluteAmountMinor = Math.abs(amountMinor);
      const bucket = TRANSACTION_AMOUNT_BUCKETS.find(
        ({ minMinor, maxExclusiveMinor }) =>
          absoluteAmountMinor >= minMinor &&
          (maxExclusiveMinor === null || absoluteAmountMinor < maxExclusiveMinor),
      );

      if (bucket) {
        countsByBucketId.set(bucket.id, (countsByBucketId.get(bucket.id) ?? 0) + 1);
      }
    }
  }

  const buckets = TRANSACTION_AMOUNT_BUCKETS.map((bucket) => ({
    ...bucket,
    count: countsByBucketId.get(bucket.id) ?? 0,
  }));

  return {
    currencyCode: normalizedCurrencyCode,
    reportKind,
    totalCount: buckets.reduce((sum, bucket) => sum + bucket.count, 0),
    buckets,
  };
}

function matchesReportKind(amountMinor: number, reportKind: StatsReportKind): boolean {
  return reportKind === 'income' ? amountMinor > 0 : amountMinor < 0;
}
