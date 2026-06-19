import { normalizeAddTransactionDefaults } from '../domain/addTransactionDefaults';
import { compareTransactionsDescending } from '../domain/aggregates';
import type {
  AddTransactionDefaults,
  AppSnapshot,
  NewTransactionInput,
  Transaction,
  TransactionLine,
} from '../domain/types';

export type AddTransactionSnapshotPatch = {
  addTransactionDefaults?: AddTransactionDefaults;
  input: NewTransactionInput;
  lines: TransactionLine[];
  transaction: Transaction;
};

export function patchSnapshotAfterAddTransaction(
  snapshot: AppSnapshot,
  patch: AddTransactionSnapshotPatch,
): AppSnapshot | null {
  if (patch.lines.length !== patch.input.lines.length) {
    return null;
  }

  if (snapshot.transactions.some((transaction) => transaction.id === patch.transaction.id)) {
    return null;
  }

  const existingLineIds = new Set(snapshot.transactionLines.map((line) => line.id));
  if (
    patch.lines.some((line) =>
      existingLineIds.has(line.id) ||
      line.transactionId !== patch.transaction.id
    )
  ) {
    return null;
  }

  return {
    ...snapshot,
    settings: patch.addTransactionDefaults
      ? {
          ...snapshot.settings,
          addTransactionDefaults: normalizeAddTransactionDefaults(patch.addTransactionDefaults),
        }
      : snapshot.settings,
    transactions: [...snapshot.transactions, patch.transaction].sort(compareTransactionsDescending),
    transactionLines: [...snapshot.transactionLines, ...patch.lines],
  };
}
