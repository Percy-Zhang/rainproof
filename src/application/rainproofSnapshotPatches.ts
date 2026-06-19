import { normalizeAddTransactionDefaults } from '../domain/addTransactionDefaults';
import { compareTransactionsDescending } from '../domain/aggregates';
import type {
  AddTransactionDefaults,
  AppSnapshot,
  NewTransactionInput,
  Transaction,
  TransactionLink,
  TransactionLine,
  UpdateTransactionInput,
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

export type OptimisticTransactionRollback = {
  links: IndexedSnapshotItem<TransactionLink>[];
  lines: IndexedSnapshotItem<TransactionLine>[];
  transaction: IndexedSnapshotItem<Transaction>;
};

export type OptimisticDeleteTransactionRollback = OptimisticTransactionRollback;

export type EditTransactionSnapshotPatch = {
  input: UpdateTransactionInput;
  insertedLineIds: string[];
  lines: TransactionLine[];
  removedLineIds: string[];
  transaction: Transaction;
  updatedLineIds: string[];
};

export type OptimisticEditTransactionRollback = OptimisticTransactionRollback;

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
  return getRollbackForTransactionScope(snapshot, transactionId);
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

export function getRollbackForEditTransaction(
  snapshot: AppSnapshot,
  transactionId: string,
): OptimisticEditTransactionRollback | null {
  return getRollbackForTransactionScope(snapshot, transactionId);
}

function getRollbackForTransactionScope(
  snapshot: AppSnapshot,
  transactionId: string,
): OptimisticTransactionRollback | null {
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

export function canPatchSnapshotAfterEditTransaction(
  snapshot: AppSnapshot,
  patch: EditTransactionSnapshotPatch,
): boolean {
  const rollback = getRollbackForEditTransaction(snapshot, patch.input.id);
  return rollback !== null && canPatchSnapshotAfterEditTransactionWithRollback(snapshot, patch, rollback);
}

export function patchSnapshotAfterEditTransaction(
  snapshot: AppSnapshot,
  patch: EditTransactionSnapshotPatch,
): AppSnapshot | null {
  const rollback = getRollbackForEditTransaction(snapshot, patch.input.id);
  if (!rollback) {
    return null;
  }

  return patchSnapshotAfterEditTransactionWithRollback(snapshot, patch, rollback);
}

export function patchSnapshotAfterEditTransactionWithRollback(
  snapshot: AppSnapshot,
  patch: EditTransactionSnapshotPatch,
  rollback: OptimisticEditTransactionRollback,
): AppSnapshot | null {
  if (!canPatchSnapshotAfterEditTransactionWithRollback(snapshot, patch, rollback)) {
    return null;
  }

  const removedLineIds = new Set(patch.removedLineIds);
  const currentLineIds = new Set(rollback.lines.map(({ item }) => item.id));
  const nextLines = sortTransactionLinesByCreatedAt([
    ...snapshot.transactionLines.filter((line) => line.transactionId !== patch.transaction.id),
    ...patch.lines,
  ]);

  return {
    ...snapshot,
    transactions: snapshot.transactions
      .map((transaction) => (transaction.id === patch.transaction.id ? patch.transaction : transaction))
      .sort(compareTransactionsDescending),
    transactionLines: nextLines,
    transactionLinks: snapshot.transactionLinks.filter((link) =>
      !doesLinkReferenceAnyLine(link, removedLineIds) &&
      (
        link.sourceTransactionId !== patch.transaction.id ||
        !link.sourceLineId ||
        currentLineIds.has(link.sourceLineId)
      ) &&
      (
        link.targetTransactionId !== patch.transaction.id ||
        !link.targetLineId ||
        currentLineIds.has(link.targetLineId)
      )
    ),
  };
}

export function rollbackSnapshotAfterOptimisticEditTransaction(
  snapshot: AppSnapshot,
  rollback: OptimisticEditTransactionRollback,
  patch: EditTransactionSnapshotPatch,
): AppSnapshot | null {
  if (!isSnapshotAfterEditTransaction(snapshot, rollback, patch)) {
    return null;
  }

  const transactionId = rollback.transaction.item.id;
  const currentLineIds = new Set(patch.lines.map((line) => line.id));
  const previousLineIds = new Set(rollback.lines.map(({ item }) => item.id));
  const lineIds = new Set([...currentLineIds, ...previousLineIds]);
  const affectedLinkIds = new Set(rollback.links.map(({ item }) => item.id));
  const nextLinks = restoreIndexedItems(
    snapshot.transactionLinks.filter((link) =>
      !affectedLinkIds.has(link.id) &&
      link.sourceTransactionId !== transactionId &&
      link.targetTransactionId !== transactionId &&
      !doesLinkReferenceAnyLine(link, lineIds)
    ),
    rollback.links,
  );

  return {
    ...snapshot,
    transactions: restoreIndexedItems(
      snapshot.transactions.filter((transaction) => transaction.id !== transactionId),
      [rollback.transaction],
    ).sort(compareTransactionsDescending),
    transactionLines: sortTransactionLinesByCreatedAt(restoreIndexedItems(
      snapshot.transactionLines.filter((line) => line.transactionId !== transactionId),
      rollback.lines,
    )),
    transactionLinks: nextLinks,
  };
}

export function isSnapshotAfterEditTransaction(
  snapshot: AppSnapshot,
  rollback: OptimisticEditTransactionRollback,
  patch: EditTransactionSnapshotPatch,
): boolean {
  const transactionId = rollback.transaction.item.id;
  const currentTransaction = snapshot.transactions.find((transaction) => transaction.id === transactionId);
  if (!currentTransaction || JSON.stringify(currentTransaction) !== JSON.stringify(patch.transaction)) {
    return false;
  }

  const currentLines = snapshot.transactionLines.filter((line) => line.transactionId === transactionId);
  if (JSON.stringify(currentLines) !== JSON.stringify(sortTransactionLinesByCreatedAt(patch.lines))) {
    return false;
  }

  const removedLineIds = new Set(patch.removedLineIds);
  if (snapshot.transactionLinks.some((link) => doesLinkReferenceAnyLine(link, removedLineIds))) {
    return false;
  }

  const expectedLinks = getExpectedLinksAfterEdit(rollback, patch);
  const currentAffectedLinks = getAffectedLinksForEditSnapshot(snapshot, rollback, patch);
  return JSON.stringify(currentAffectedLinks) === JSON.stringify(expectedLinks);
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

function canPatchSnapshotAfterEditTransactionWithRollback(
  snapshot: AppSnapshot,
  patch: EditTransactionSnapshotPatch,
  rollback: OptimisticEditTransactionRollback,
): boolean {
  if (rollback.transaction.item.id !== patch.input.id || patch.transaction.id !== patch.input.id) {
    return false;
  }

  const currentLineIds = new Set(rollback.lines.map(({ item }) => item.id));
  const keptLineIds = new Set(patch.updatedLineIds);
  const insertedLineIds = new Set(patch.insertedLineIds);
  const removedLineIds = new Set(patch.removedLineIds);

  if (!doesTransactionMatchInput(patch.transaction, patch.input)) {
    return false;
  }

  if (patch.lines.length !== patch.input.lines.length) {
    return false;
  }

  if (keptLineIds.size + insertedLineIds.size !== patch.lines.length) {
    return false;
  }

  if (![...keptLineIds].every((lineId) => currentLineIds.has(lineId))) {
    return false;
  }

  const expectedRemovedLineIds = [...currentLineIds].filter((lineId) => !keptLineIds.has(lineId));
  if (JSON.stringify([...removedLineIds].sort()) !== JSON.stringify(expectedRemovedLineIds.sort())) {
    return false;
  }

  const existingOtherLineIds = new Set(
    snapshot.transactionLines
      .filter((line) => line.transactionId !== patch.input.id)
      .map((line) => line.id),
  );
  if ([...insertedLineIds].some((lineId) => existingOtherLineIds.has(lineId) || currentLineIds.has(lineId))) {
    return false;
  }

  return patch.lines.every((line, index) =>
    line.transactionId === patch.input.id &&
    (keptLineIds.has(line.id) || insertedLineIds.has(line.id)) &&
    !removedLineIds.has(line.id) &&
    doesLineMatchInput(line, patch.input.lines[index])
  );
}

function getExpectedLinksAfterEdit(
  rollback: OptimisticEditTransactionRollback,
  patch: EditTransactionSnapshotPatch,
): TransactionLink[] {
  const removedLineIds = new Set(patch.removedLineIds);
  return rollback.links
    .map(({ item }) => item)
    .filter((link) => !doesLinkReferenceAnyLine(link, removedLineIds));
}

function getAffectedLinksForEditSnapshot(
  snapshot: AppSnapshot,
  rollback: OptimisticEditTransactionRollback,
  patch: EditTransactionSnapshotPatch,
): TransactionLink[] {
  const transactionId = rollback.transaction.item.id;
  const lineIds = new Set([
    ...rollback.lines.map(({ item }) => item.id),
    ...patch.lines.map((line) => line.id),
  ]);

  return snapshot.transactionLinks.filter((link) =>
    link.sourceTransactionId === transactionId ||
    link.targetTransactionId === transactionId ||
    Boolean(link.sourceLineId && lineIds.has(link.sourceLineId)) ||
    Boolean(link.targetLineId && lineIds.has(link.targetLineId))
  );
}

function doesLinkReferenceAnyLine(link: TransactionLink, lineIds: Set<string>): boolean {
  return Boolean(
    (link.sourceLineId && lineIds.has(link.sourceLineId)) ||
    (link.targetLineId && lineIds.has(link.targetLineId)),
  );
}

function sortTransactionLinesByCreatedAt(lines: TransactionLine[]): TransactionLine[] {
  return [...lines].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
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
