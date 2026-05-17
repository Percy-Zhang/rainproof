import type { Transaction, TransactionKind, TransactionLine } from './types';

export type CategorySuggestionMode = 'frequent' | 'recent';

export type CategorySuggestion = {
  categoryId: string;
  subcategoryId: string;
};

type CategorySuggestionInput = {
  transactions: Transaction[];
  lines: TransactionLine[];
  kind: TransactionKind;
  mode: CategorySuggestionMode;
  limit?: number;
};

type PairStats = CategorySuggestion & {
  count: number;
  latestDatetime: string;
  latestCreatedAt: string;
  latestTransactionId: string;
};

export function getCategorySuggestions({
  transactions,
  lines,
  kind,
  mode,
  limit = 5,
}: CategorySuggestionInput): CategorySuggestion[] {
  if (kind === 'transfer' || limit <= 0) {
    return [];
  }

  const linesByTransaction = groupLinesByTransaction(lines);
  const statsByPair = new Map<string, PairStats>();

  for (const transaction of transactions) {
    if (transaction.kind !== kind) {
      continue;
    }

    const transactionLines = linesByTransaction.get(transaction.id) ?? [];
    for (const line of transactionLines) {
      if (!line.categoryId) {
        continue;
      }

      const key = getPairKey(line.categoryId, line.subcategoryId);
      const current = statsByPair.get(key);
      if (!current) {
        statsByPair.set(key, {
          categoryId: line.categoryId,
          subcategoryId: line.subcategoryId,
          count: 1,
          latestDatetime: transaction.datetime,
          latestCreatedAt: transaction.createdAt,
          latestTransactionId: transaction.id,
        });
        continue;
      }

      current.count += 1;
      if (compareTransactions(transaction, current) < 0) {
        current.latestDatetime = transaction.datetime;
        current.latestCreatedAt = transaction.createdAt;
        current.latestTransactionId = transaction.id;
      }
    }
  }

  const stats = Array.from(statsByPair.values());
  const sorted =
    mode === 'frequent'
      ? stats.sort((left, right) => right.count - left.count || comparePairStats(left, right))
      : stats.sort(comparePairStats);

  return sorted.slice(0, limit).map(({ categoryId, subcategoryId }) => ({ categoryId, subcategoryId }));
}

function groupLinesByTransaction(lines: TransactionLine[]): Map<string, TransactionLine[]> {
  const groups = new Map<string, TransactionLine[]>();
  for (const line of lines) {
    const current = groups.get(line.transactionId) ?? [];
    current.push(line);
    groups.set(line.transactionId, current);
  }
  return groups;
}

function comparePairStats(left: PairStats, right: PairStats): number {
  return (
    compareIsoDesc(left.latestDatetime, right.latestDatetime) ||
    compareIsoDesc(left.latestCreatedAt, right.latestCreatedAt) ||
    right.latestTransactionId.localeCompare(left.latestTransactionId)
  );
}

function compareTransactions(transaction: Transaction, current: PairStats): number {
  return (
    compareIsoDesc(transaction.datetime, current.latestDatetime) ||
    compareIsoDesc(transaction.createdAt, current.latestCreatedAt) ||
    current.latestTransactionId.localeCompare(transaction.id)
  );
}

function compareIsoDesc(left: string, right: string): number {
  return new Date(right || 0).getTime() - new Date(left || 0).getTime();
}

function getPairKey(categoryId: string, subcategoryId: string): string {
  return `${categoryId}\u0000${subcategoryId}`;
}
