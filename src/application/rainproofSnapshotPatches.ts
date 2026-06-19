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

export type OptimisticAddTransactionRollback = {
  lineIds: string[];
  optimisticAddTransactionDefaults?: AddTransactionDefaults;
  previousAddTransactionDefaults?: AddTransactionDefaults;
  transactionId: string;
};

export function canPatchSnapshotAfterAddTransaction(
  snapshot: AppSnapshot,
  patch: AddTransactionSnapshotPatch,
): boolean {
  if (patch.lines.length !== patch.input.lines.length) {
    return false;
  }

  if (!doesTransactionMatchInput(patch.transaction, patch.input)) {
    return false;
  }

  if (snapshot.transactions.some((transaction) => transaction.id === patch.transaction.id)) {
    return false;
  }

  const existingLineIds = new Set(snapshot.transactionLines.map((line) => line.id));
  if (
    patch.lines.some((line) =>
      existingLineIds.has(line.id) ||
      line.transactionId !== patch.transaction.id
    )
  ) {
    return false;
  }

  if (!patch.lines.every((line, index) => doesLineMatchInput(line, patch.input.lines[index]))) {
    return false;
  }

  return true;
}

export function patchSnapshotAfterAddTransaction(
  snapshot: AppSnapshot,
  patch: AddTransactionSnapshotPatch,
): AppSnapshot | null {
  if (!canPatchSnapshotAfterAddTransaction(snapshot, patch)) {
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

export function rollbackSnapshotAfterOptimisticAddTransaction(
  snapshot: AppSnapshot,
  rollback: OptimisticAddTransactionRollback,
): AppSnapshot | null {
  if (!snapshot.transactions.some((transaction) => transaction.id === rollback.transactionId)) {
    return null;
  }

  const rollbackLineIds = new Set(rollback.lineIds);
  const currentLineIds = new Set(snapshot.transactionLines.map((line) => line.id));
  if (!rollback.lineIds.every((lineId) => currentLineIds.has(lineId))) {
    return null;
  }

  if (
    snapshot.transactionLines.some((line) =>
      line.transactionId === rollback.transactionId &&
      !rollbackLineIds.has(line.id)
    )
  ) {
    return null;
  }

  const nextSettings = getRolledBackSettings(snapshot, rollback);

  return {
    ...snapshot,
    settings: nextSettings,
    transactions: snapshot.transactions.filter((transaction) => transaction.id !== rollback.transactionId),
    transactionLines: snapshot.transactionLines.filter((line) => !rollbackLineIds.has(line.id)),
  };
}

function getRolledBackSettings(
  snapshot: AppSnapshot,
  rollback: OptimisticAddTransactionRollback,
): AppSnapshot['settings'] {
  if (!rollback.optimisticAddTransactionDefaults) {
    return snapshot.settings;
  }

  const currentDefaults = normalizeAddTransactionDefaults(snapshot.settings.addTransactionDefaults);
  const optimisticDefaults = normalizeAddTransactionDefaults(rollback.optimisticAddTransactionDefaults);
  if (!areAddTransactionDefaultsEqual(currentDefaults, optimisticDefaults)) {
    return snapshot.settings;
  }

  return {
    ...snapshot.settings,
    addTransactionDefaults: normalizeAddTransactionDefaults(rollback.previousAddTransactionDefaults),
  };
}

function doesTransactionMatchInput(transaction: Transaction, input: NewTransactionInput): boolean {
  return transaction.kind === input.kind &&
    transaction.title === (input.title.trim() || fallbackTransactionTitle(input.kind)) &&
    transaction.datetime === input.datetime &&
    transaction.notes === (input.notes?.trim() ?? '') &&
    transaction.groupId === (input.groupId?.trim() ?? '') &&
    JSON.stringify(transaction.labels) === JSON.stringify(input.labels ?? []);
}

function doesLineMatchInput(
  line: TransactionLine,
  inputLine: NewTransactionInput['lines'][number],
): boolean {
  return line.accountId === inputLine.accountId &&
    line.amountMinor === inputLine.amountMinor &&
    line.currencyCode === inputLine.currencyCode &&
    line.categoryId === (inputLine.categoryId ?? '') &&
    line.subcategoryId === (inputLine.subcategoryId ?? '') &&
    line.externalParty === (inputLine.externalParty?.trim() ?? '') &&
    line.transferPeerAccountId === (inputLine.transferPeerAccountId ?? '') &&
    line.note === (inputLine.note?.trim() ?? '');
}

function fallbackTransactionTitle(kind: NewTransactionInput['kind']): string {
  if (kind === 'income') {
    return 'Income';
  }

  if (kind === 'transfer') {
    return 'Transfer';
  }

  return 'Expense';
}

function areAddTransactionDefaultsEqual(
  left: AddTransactionDefaults,
  right: AddTransactionDefaults,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
