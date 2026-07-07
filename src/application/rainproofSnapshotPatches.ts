import { normalizeAddTransactionDefaults } from '../domain/addTransactionDefaults';
import { compareTransactionsDescending } from '../domain/aggregates';
import type {
  AddTransactionDefaults,
  AppSnapshot,
  CreateUpcomingPaymentTransactionInput,
  NewTransactionInput,
  RecurringItem,
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

export type OptimisticRecurringItemStateRollback = IndexedSnapshotItem<RecurringItem>;

export type IndexedSnapshotItem<T> = {
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

export type OptimisticTransactionLinkRollback = IndexedSnapshotItem<TransactionLink>;

export type TransactionLinkBatchSnapshotPatch = {
  addedLinks: TransactionLink[];
  deletedLinkIds: string[];
  updatedLinks: TransactionLink[];
};

export type OptimisticTransactionLinkBatchRollback = {
  addedLinkIds: string[];
  links: IndexedSnapshotItem<TransactionLink>[];
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

export function getRollbackForRecurringItemStateChange(
  snapshot: AppSnapshot,
  recurringItemId: string,
): OptimisticRecurringItemStateRollback | null {
  const index = snapshot.recurringItems.findIndex((item) => item.id === recurringItemId);
  if (index < 0) {
    return null;
  }

  return {
    index,
    item: snapshot.recurringItems[index],
  };
}

export function patchSnapshotAfterRecurringItemStateChangeWithRollback(
  snapshot: AppSnapshot,
  input: CreateUpcomingPaymentTransactionInput['recurringItemInput'],
  rollback: OptimisticRecurringItemStateRollback,
): AppSnapshot | null {
  const nextRecurringItem = getRecurringItemAfterStateChange(input, rollback.item);
  if (!nextRecurringItem) {
    return null;
  }

  const currentItem = snapshot.recurringItems.find((item) => item.id === rollback.item.id);
  if (!currentItem || !areRecurringItemsEqualForStatePatch(currentItem, rollback.item)) {
    return null;
  }

  const nextRecurringItems = snapshot.recurringItems.map((item) =>
    item.id === rollback.item.id ? nextRecurringItem : item);

  return {
    ...snapshot,
    recurringBills: nextRecurringItems,
    recurringItems: nextRecurringItems,
  };
}

export function rollbackSnapshotAfterOptimisticRecurringItemStateChange(
  snapshot: AppSnapshot,
  rollback: OptimisticRecurringItemStateRollback,
  optimisticItem: RecurringItem,
): AppSnapshot | null {
  const currentItem = snapshot.recurringItems.find((item) => item.id === rollback.item.id);
  if (!currentItem || !areRecurringItemsEqualForStatePatch(currentItem, optimisticItem)) {
    return null;
  }

  const nextRecurringItems = restoreIndexedItems(
    snapshot.recurringItems.filter((item) => item.id !== rollback.item.id),
    [rollback],
  );

  return {
    ...snapshot,
    recurringBills: nextRecurringItems,
    recurringItems: nextRecurringItems,
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

export function canPatchSnapshotAfterAddTransactionLink(
  snapshot: AppSnapshot,
  link: TransactionLink,
): boolean {
  return !snapshot.transactionLinks.some((item) => item.id === link.id) &&
    canRepresentTransactionLink(snapshot, link);
}

export function patchSnapshotAfterAddTransactionLink(
  snapshot: AppSnapshot,
  link: TransactionLink,
): AppSnapshot | null {
  if (!canPatchSnapshotAfterAddTransactionLink(snapshot, link)) {
    return null;
  }

  return {
    ...snapshot,
    transactionLinks: sortTransactionLinksByCreatedAt([...snapshot.transactionLinks, link]),
  };
}

export function rollbackSnapshotAfterOptimisticAddTransactionLink(
  snapshot: AppSnapshot,
  link: TransactionLink,
): AppSnapshot | null {
  const currentLink = snapshot.transactionLinks.find((item) => item.id === link.id);
  if (!currentLink || !areTransactionLinksEqual(currentLink, link)) {
    return null;
  }

  return {
    ...snapshot,
    transactionLinks: snapshot.transactionLinks.filter((item) => item.id !== link.id),
  };
}

export function getRollbackForUpdateTransactionLink(
  snapshot: AppSnapshot,
  linkId: string,
): OptimisticTransactionLinkRollback | null {
  const index = snapshot.transactionLinks.findIndex((link) => link.id === linkId);
  if (index < 0) {
    return null;
  }

  return {
    index,
    item: snapshot.transactionLinks[index],
  };
}

export function canPatchSnapshotAfterUpdateTransactionLink(
  snapshot: AppSnapshot,
  link: TransactionLink,
  rollback: OptimisticTransactionLinkRollback,
): boolean {
  const currentLink = snapshot.transactionLinks.find((item) => item.id === rollback.item.id);
  return link.id === rollback.item.id &&
    Boolean(currentLink) &&
    areTransactionLinksEqual(currentLink as TransactionLink, rollback.item) &&
    canRepresentTransactionLink(snapshot, link);
}

export function patchSnapshotAfterUpdateTransactionLinkWithRollback(
  snapshot: AppSnapshot,
  link: TransactionLink,
  rollback: OptimisticTransactionLinkRollback,
): AppSnapshot | null {
  if (!canPatchSnapshotAfterUpdateTransactionLink(snapshot, link, rollback)) {
    return null;
  }

  return {
    ...snapshot,
    transactionLinks: snapshot.transactionLinks.map((item) => (item.id === link.id ? link : item)),
  };
}

export function rollbackSnapshotAfterOptimisticUpdateTransactionLink(
  snapshot: AppSnapshot,
  rollback: OptimisticTransactionLinkRollback,
  optimisticLink: TransactionLink,
): AppSnapshot | null {
  const currentLink = snapshot.transactionLinks.find((link) => link.id === optimisticLink.id);
  if (!currentLink || !areTransactionLinksEqual(currentLink, optimisticLink)) {
    return null;
  }

  return {
    ...snapshot,
    transactionLinks: restoreIndexedItems(
      snapshot.transactionLinks.filter((link) => link.id !== rollback.item.id),
      [rollback],
    ),
  };
}

export function getRollbackForDeleteTransactionLink(
  snapshot: AppSnapshot,
  linkId: string,
): OptimisticTransactionLinkRollback | null {
  const index = snapshot.transactionLinks.findIndex((link) => link.id === linkId);
  if (index < 0) {
    return null;
  }

  return {
    index,
    item: snapshot.transactionLinks[index],
  };
}

export function patchSnapshotAfterDeleteTransactionLinkWithRollback(
  snapshot: AppSnapshot,
  rollback: OptimisticTransactionLinkRollback,
): AppSnapshot | null {
  const currentLink = snapshot.transactionLinks.find((link) => link.id === rollback.item.id);
  if (!currentLink || !areTransactionLinksEqual(currentLink, rollback.item)) {
    return null;
  }

  return {
    ...snapshot,
    transactionLinks: snapshot.transactionLinks.filter((link) => link.id !== rollback.item.id),
  };
}

export function rollbackSnapshotAfterOptimisticDeleteTransactionLink(
  snapshot: AppSnapshot,
  rollback: OptimisticTransactionLinkRollback,
): AppSnapshot | null {
  if (snapshot.transactionLinks.some((link) => link.id === rollback.item.id)) {
    return null;
  }

  if (!canRepresentTransactionLink(snapshot, rollback.item)) {
    return null;
  }

  return {
    ...snapshot,
    transactionLinks: restoreIndexedItems(snapshot.transactionLinks, [rollback]),
  };
}

export function isSnapshotAfterAddTransactionLink(
  snapshot: AppSnapshot,
  link: TransactionLink,
): boolean {
  const currentLink = snapshot.transactionLinks.find((item) => item.id === link.id);
  return Boolean(currentLink) && areTransactionLinksEqual(currentLink as TransactionLink, link);
}

export function isSnapshotAfterUpdateTransactionLink(
  snapshot: AppSnapshot,
  link: TransactionLink,
): boolean {
  return isSnapshotAfterAddTransactionLink(snapshot, link);
}

export function isSnapshotAfterDeleteTransactionLink(
  snapshot: AppSnapshot,
  rollback: OptimisticTransactionLinkRollback,
): boolean {
  return !snapshot.transactionLinks.some((link) => link.id === rollback.item.id);
}

export function getRollbackForTransactionLinkBatch(
  snapshot: AppSnapshot,
  patch: TransactionLinkBatchSnapshotPatch,
): OptimisticTransactionLinkBatchRollback | null {
  const affectedExistingIds = uniqueIds([
    ...patch.deletedLinkIds,
    ...patch.updatedLinks.map((link) => link.id),
  ]);
  const addedLinkIds = uniqueIds(patch.addedLinks.map((link) => link.id));

  if (addedLinkIds.some((linkId) => snapshot.transactionLinks.some((link) => link.id === linkId))) {
    return null;
  }

  const links = affectedExistingIds.map((linkId) => {
    const index = snapshot.transactionLinks.findIndex((link) => link.id === linkId);
    return index >= 0
      ? { index, item: snapshot.transactionLinks[index] }
      : null;
  });

  if (links.some((link) => !link)) {
    return null;
  }

  return {
    addedLinkIds,
    links: links.filter((link): link is IndexedSnapshotItem<TransactionLink> => Boolean(link)),
  };
}

export function canPatchSnapshotAfterTransactionLinkBatch(
  snapshot: AppSnapshot,
  patch: TransactionLinkBatchSnapshotPatch,
  rollback: OptimisticTransactionLinkBatchRollback,
): boolean {
  const addedLinkIds = new Set(patch.addedLinks.map((link) => link.id));
  const updatedLinkIds = new Set(patch.updatedLinks.map((link) => link.id));
  const deletedLinkIds = new Set(patch.deletedLinkIds);

  if (addedLinkIds.size !== patch.addedLinks.length || updatedLinkIds.size !== patch.updatedLinks.length) {
    return false;
  }

  if ([...addedLinkIds].some((linkId) => updatedLinkIds.has(linkId) || deletedLinkIds.has(linkId))) {
    return false;
  }

  if ([...updatedLinkIds].some((linkId) => deletedLinkIds.has(linkId))) {
    return false;
  }

  if (![...updatedLinkIds].every((linkId) => rollback.links.some(({ item }) => item.id === linkId))) {
    return false;
  }

  if (![...deletedLinkIds].every((linkId) => rollback.links.some(({ item }) => item.id === linkId))) {
    return false;
  }

  if (!rollback.links.every(({ item }) => {
    const currentLink = snapshot.transactionLinks.find((link) => link.id === item.id);
    return Boolean(currentLink) && areTransactionLinksEqual(currentLink as TransactionLink, item);
  })) {
    return false;
  }

  return [...patch.addedLinks, ...patch.updatedLinks].every((link) =>
    canRepresentTransactionLink(snapshot, link));
}

export function patchSnapshotAfterTransactionLinkBatchWithRollback(
  snapshot: AppSnapshot,
  patch: TransactionLinkBatchSnapshotPatch,
  rollback: OptimisticTransactionLinkBatchRollback,
): AppSnapshot | null {
  if (!canPatchSnapshotAfterTransactionLinkBatch(snapshot, patch, rollback)) {
    return null;
  }

  return {
    ...snapshot,
    transactionLinks: getTransactionLinksAfterBatch(snapshot.transactionLinks, patch),
  };
}

export function rollbackSnapshotAfterOptimisticTransactionLinkBatch(
  snapshot: AppSnapshot,
  rollback: OptimisticTransactionLinkBatchRollback,
  patch: TransactionLinkBatchSnapshotPatch,
): AppSnapshot | null {
  if (!isSnapshotAfterTransactionLinkBatch(snapshot, patch, rollback)) {
    return null;
  }

  if (!rollback.links.every(({ item }) => canRepresentTransactionLink(snapshot, item))) {
    return null;
  }

  const affectedLinkIds = new Set([
    ...rollback.addedLinkIds,
    ...rollback.links.map(({ item }) => item.id),
  ]);

  return {
    ...snapshot,
    transactionLinks: restoreIndexedItems(
      snapshot.transactionLinks.filter((link) => !affectedLinkIds.has(link.id)),
      rollback.links,
    ),
  };
}

export function isSnapshotAfterTransactionLinkBatch(
  snapshot: AppSnapshot,
  patch: TransactionLinkBatchSnapshotPatch,
  rollback: OptimisticTransactionLinkBatchRollback,
): boolean {
  const deletedLinkIds = new Set(patch.deletedLinkIds);
  const addedOrUpdatedLinks = [...patch.addedLinks, ...patch.updatedLinks];
  const addedOrUpdatedLinkIds = new Set(addedOrUpdatedLinks.map((link) => link.id));

  if (snapshot.transactionLinks.some((link) =>
    deletedLinkIds.has(link.id) && !addedOrUpdatedLinkIds.has(link.id))) {
    return false;
  }

  if (!addedOrUpdatedLinks.every((expectedLink) => {
    const currentLink = snapshot.transactionLinks.find((link) => link.id === expectedLink.id);
    return Boolean(currentLink) && areTransactionLinksEqual(currentLink as TransactionLink, expectedLink);
  })) {
    return false;
  }

  return rollback.addedLinkIds.every((linkId) =>
    snapshot.transactionLinks.some((link) => link.id === linkId));
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

function getRecurringItemAfterStateChange(
  input: CreateUpcomingPaymentTransactionInput['recurringItemInput'],
  previousItem: RecurringItem,
): RecurringItem | null {
  if (!doesRecurringItemInputMatchExistingPlan(input, previousItem)) {
    return null;
  }

  return {
    ...previousItem,
    completedAt: input.completedAt?.trim() || null,
    isActive: input.isActive ?? true,
    nextDueDate: input.nextDueDate,
  };
}

function areRecurringItemsEqualForStatePatch(left: RecurringItem, right: RecurringItem): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function doesRecurringItemInputMatchExistingPlan(
  input: CreateUpcomingPaymentTransactionInput['recurringItemInput'],
  item: RecurringItem,
): boolean {
  return input.id === item.id &&
    input.name.trim() === item.name &&
    input.kind === item.kind &&
    input.amountMinor === item.amountMinor &&
    input.currencyCode.trim().toUpperCase() === item.currencyCode &&
    input.accountId.trim() === item.accountId &&
    input.categoryId.trim() === item.categoryId &&
    (input.subcategoryId?.trim() || null) === item.subcategoryId &&
    (input.note?.trim() ?? '') === item.note &&
    input.frequency === item.frequency &&
    areRecurringSplitLineInputsEqual(input.splitLines ?? [], item.splitLines);
}

function areRecurringSplitLineInputsEqual(
  inputLines: NonNullable<CreateUpcomingPaymentTransactionInput['recurringItemInput']['splitLines']>,
  existingLines: RecurringItem['splitLines'],
): boolean {
  if (inputLines.length !== existingLines.length) {
    return false;
  }

  return inputLines.every((line, index) => {
    const existingLine = existingLines[index];
    return Boolean(existingLine) &&
      line.amountMinor === existingLine.amountMinor &&
      line.categoryId.trim() === existingLine.categoryId &&
      line.subcategoryId.trim() === existingLine.subcategoryId &&
      (line.note?.trim() ?? '') === existingLine.note;
  });
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

function canRepresentTransactionLink(snapshot: AppSnapshot, link: TransactionLink): boolean {
  const sourceTransaction = snapshot.transactions.find((transaction) => transaction.id === link.sourceTransactionId);
  const targetTransaction = snapshot.transactions.find((transaction) => transaction.id === link.targetTransactionId);
  if (!sourceTransaction || !targetTransaction) {
    return false;
  }

  if (link.sourceLineId) {
    const sourceLine = snapshot.transactionLines.find((line) => line.id === link.sourceLineId);
    if (!sourceLine || sourceLine.transactionId !== link.sourceTransactionId) {
      return false;
    }
  }

  if (link.targetLineId) {
    const targetLine = snapshot.transactionLines.find((line) => line.id === link.targetLineId);
    if (!targetLine || targetLine.transactionId !== link.targetTransactionId) {
      return false;
    }
  }

  return true;
}

function getTransactionLinksAfterBatch(
  links: TransactionLink[],
  patch: TransactionLinkBatchSnapshotPatch,
): TransactionLink[] {
  const affectedLinkIds = new Set([
    ...patch.deletedLinkIds,
    ...patch.updatedLinks.map((link) => link.id),
  ]);

  return sortTransactionLinksByCreatedAt([
    ...links.filter((link) => !affectedLinkIds.has(link.id)),
    ...patch.updatedLinks,
    ...patch.addedLinks,
  ]);
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function areTransactionLinksEqual(
  left: TransactionLink,
  right: TransactionLink,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
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

function sortTransactionLinksByCreatedAt(links: TransactionLink[]): TransactionLink[] {
  return [...links].sort((left, right) => {
    const createdAtComparison = left.createdAt.localeCompare(right.createdAt);
    return createdAtComparison || left.id.localeCompare(right.id);
  });
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
