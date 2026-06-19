import { normalizeAddTransactionDefaults } from '../domain/addTransactionDefaults';
import { compareTransactionsDescending } from '../domain/aggregates';
import type {
  AddTransactionDefaults,
  AppSnapshot,
  NewTransactionInput,
  Transaction,
  TransactionLink,
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

type IndexedSnapshotItem<T> = {
  index: number;
  item: T;
};

export type OptimisticDeleteTransactionRollback = {
  links: IndexedSnapshotItem<TransactionLink>[];
  lines: IndexedSnapshotItem<TransactionLine>[];
  transaction: IndexedSnapshotItem<Transaction>;
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

export function getRollbackForDeleteTransaction(
  snapshot: AppSnapshot,
  transactionId: string,
): OptimisticDeleteTransactionRollback | null {
  const transactionIndex = snapshot.transactions.findIndex((transaction) => transaction.id === transactionId);
  if (transactionIndex < 0) {
    return null;
  }

  const lines = getIndexedMatches(snapshot.transactionLines, (line) => line.transactionId === transactionId);
  const lineIds = new Set(lines.map(({ item }) => item.id));
  const links = getIndexedMatches(snapshot.transactionLinks, (link) =>
    link.sourceTransactionId === transactionId ||
    link.targetTransactionId === transactionId ||
    Boolean(link.sourceLineId && lineIds.has(link.sourceLineId)) ||
    Boolean(link.targetLineId && lineIds.has(link.targetLineId))
  );

  return {
    links,
    lines,
    transaction: {
      index: transactionIndex,
      item: snapshot.transactions[transactionIndex],
    },
  };
}

export function canPatchSnapshotAfterDeleteTransaction(
  snapshot: AppSnapshot,
  transactionId: string,
): boolean {
  return getRollbackForDeleteTransaction(snapshot, transactionId) !== null;
}

export function patchSnapshotAfterDeleteTransaction(
  snapshot: AppSnapshot,
  transactionId: string,
): AppSnapshot | null {
  const rollback = getRollbackForDeleteTransaction(snapshot, transactionId);
  if (!rollback) {
    return null;
  }

  return patchSnapshotAfterDeleteTransactionWithRollback(snapshot, rollback);
}

export function patchSnapshotAfterDeleteTransactionWithRollback(
  snapshot: AppSnapshot,
  rollback: OptimisticDeleteTransactionRollback,
): AppSnapshot | null {
  if (!snapshot.transactions.some((transaction) => transaction.id === rollback.transaction.item.id)) {
    return null;
  }

  const lineIds = new Set(rollback.lines.map(({ item }) => item.id));
  const linkIds = new Set(rollback.links.map(({ item }) => item.id));

  return {
    ...snapshot,
    transactions: snapshot.transactions.filter((transaction) => transaction.id !== rollback.transaction.item.id),
    transactionLines: snapshot.transactionLines.filter((line) => !lineIds.has(line.id)),
    transactionLinks: snapshot.transactionLinks.filter((link) => !linkIds.has(link.id)),
  };
}

export function rollbackSnapshotAfterOptimisticDeleteTransaction(
  snapshot: AppSnapshot,
  rollback: OptimisticDeleteTransactionRollback,
): AppSnapshot | null {
  if (snapshot.transactions.some((transaction) => transaction.id === rollback.transaction.item.id)) {
    return null;
  }

  const existingLineIds = new Set(snapshot.transactionLines.map((line) => line.id));
  if (rollback.lines.some(({ item }) => existingLineIds.has(item.id))) {
    return null;
  }

  const existingLinkIds = new Set(snapshot.transactionLinks.map((link) => link.id));
  if (rollback.links.some(({ item }) => existingLinkIds.has(item.id))) {
    return null;
  }

  const lineIdsToRestore = new Set(rollback.lines.map(({ item }) => item.id));
  if (!canRestoreDeletedLinks(snapshot, rollback, lineIdsToRestore)) {
    return null;
  }

  return {
    ...snapshot,
    transactions: restoreIndexedItems(snapshot.transactions, [rollback.transaction]),
    transactionLines: restoreIndexedItems(snapshot.transactionLines, rollback.lines),
    transactionLinks: restoreIndexedItems(snapshot.transactionLinks, rollback.links),
  };
}

export function isSnapshotAfterDeleteTransaction(
  snapshot: AppSnapshot,
  rollback: OptimisticDeleteTransactionRollback,
): boolean {
  const transactionId = rollback.transaction.item.id;
  const lineIds = new Set(rollback.lines.map(({ item }) => item.id));
  const linkIds = new Set(rollback.links.map(({ item }) => item.id));

  return !snapshot.transactions.some((transaction) => transaction.id === transactionId) &&
    !snapshot.transactionLines.some((line) => lineIds.has(line.id)) &&
    !snapshot.transactionLinks.some((link) => linkIds.has(link.id));
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

function getIndexedMatches<T>(
  items: T[],
  predicate: (item: T) => boolean,
): IndexedSnapshotItem<T>[] {
  return items.reduce<IndexedSnapshotItem<T>[]>((result, item, index) => {
    if (predicate(item)) {
      result.push({ index, item });
    }
    return result;
  }, []);
}

function restoreIndexedItems<T>(
  currentItems: T[],
  entries: IndexedSnapshotItem<T>[],
): T[] {
  return [...entries]
    .sort((left, right) => left.index - right.index)
    .reduce<T[]>((result, entry) => {
      const next = [...result];
      next.splice(Math.min(entry.index, next.length), 0, entry.item);
      return next;
    }, [...currentItems]);
}

function canRestoreDeletedLinks(
  snapshot: AppSnapshot,
  rollback: OptimisticDeleteTransactionRollback,
  lineIdsToRestore: Set<string>,
): boolean {
  const transactionIds = new Set([
    rollback.transaction.item.id,
    ...snapshot.transactions.map((transaction) => transaction.id),
  ]);
  const lineIds = new Set([
    ...lineIdsToRestore,
    ...snapshot.transactionLines.map((line) => line.id),
  ]);

  return rollback.links.every(({ item }) =>
    transactionIds.has(item.sourceTransactionId) &&
    transactionIds.has(item.targetTransactionId) &&
    (!item.sourceLineId || lineIds.has(item.sourceLineId)) &&
    (!item.targetLineId || lineIds.has(item.targetLineId))
  );
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
