import { normalizeCurrencyCode } from '../domain/money';
import { validateSplitTransactionLines } from '../domain/splitTransactions';
import type { NewTransactionInput, Transaction, TransactionKind, TransactionLine, UpdateTransactionInput } from '../domain/types';
import { logDevPerfDuration, type PerfMetadata, timeDevPerf, timeDevPerfAsync } from '../performance';
import type { RepositoryDatabase } from './database';
import { createLocalId } from './ids';
import {
  mapTransaction,
  mapTransactionLine,
  type TableColumnRow,
  type TransactionLineRow,
  type TransactionRow,
} from './mappers';
import { removeTransactionLinksForTransactionStorage } from './transactionLinkStorage';

type TransactionLineInput = NewTransactionInput['lines'][number];

type TransactionLinePersistencePlan = {
  existingLineId?: string;
  line: TransactionLineInput;
};

type TransactionWriteDatabase = Pick<RepositoryDatabase, 'runAsync'>;
type AddTransactionStrategy = 'manual';

export type AddTransactionStorageResult = {
  lines: TransactionLine[];
  transaction: Transaction;
};

export type UpdateTransactionStorageResult = {
  insertedLineIds: string[];
  lines: TransactionLine[];
  removedLineIds: string[];
  transaction: Transaction;
  updatedLineIds: string[];
};

type CreateAddTransactionRecordsOptions = {
  createdAt?: string;
  transactionId?: string;
};

type InsertTransactionRecordsOptions = CreateAddTransactionRecordsOptions & {
  records?: AddTransactionStorageResult;
};

type UpdateTransactionRecordsOptions = {
  updatedAt?: string;
};

export function createAddTransactionStorageRecords(
  input: NewTransactionInput,
  options: CreateAddTransactionRecordsOptions = {},
): AddTransactionStorageResult {
  validateTransactionLinesForStorage(input.kind, input.lines);

  const now = options.createdAt ?? new Date().toISOString();
  const transactionId = options.transactionId ?? createLocalId('txn');
  const transaction: Transaction = {
    id: transactionId,
    kind: input.kind,
    title: input.title.trim() || fallbackTransactionTitle(input.kind),
    datetime: input.datetime,
    notes: input.notes?.trim() ?? '',
    labels: [...(input.labels ?? [])],
    groupId: input.groupId?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
  };
  const lines = input.lines.map((line) => createTransactionLineRecord(transactionId, line, now));

  return { lines, transaction };
}

export function createUpdateTransactionStorageRecords(
  input: UpdateTransactionInput,
  existingTransaction: Transaction,
  existingLines: TransactionLine[],
  options: UpdateTransactionRecordsOptions = {},
): UpdateTransactionStorageResult {
  validateTransactionLinesForStorage(input.kind, input.lines);

  if (input.id !== existingTransaction.id) {
    throw new Error('Prepared transaction does not match the transaction id.');
  }

  const now = options.updatedAt ?? new Date().toISOString();
  const transaction: Transaction = {
    ...existingTransaction,
    kind: input.kind,
    title: input.title.trim() || fallbackTransactionTitle(input.kind),
    datetime: input.datetime,
    notes: input.notes?.trim() ?? '',
    labels: [...(input.labels ?? [])],
    groupId: input.groupId?.trim() ?? '',
    updatedAt: now,
  };
  const plans = getTransactionLinePersistencePlans(input.lines, existingLines);
  const updatedLineIds: string[] = [];
  const insertedLineIds: string[] = [];
  const lines = plans.map((plan) => {
    if (plan.existingLineId) {
      const existingLine = existingLines.find((line) => line.id === plan.existingLineId);
      if (!existingLine) {
        throw new Error('Prepared transaction line does not match existing lines.');
      }
      updatedLineIds.push(plan.existingLineId);
      return createTransactionLineRecordFromInput(input.id, plan.line, {
        createdAt: existingLine.createdAt,
        lineId: plan.existingLineId,
      });
    }

    const line = createTransactionLineRecord(input.id, plan.line, now);
    insertedLineIds.push(line.id);
    return line;
  });
  const keptLineIds = new Set(updatedLineIds);
  const removedLineIds = existingLines
    .filter((line) => !keptLineIds.has(line.id))
    .map((line) => line.id);
  const records = {
    insertedLineIds,
    lines,
    removedLineIds,
    transaction,
    updatedLineIds,
  };
  validateUpdateTransactionStorageRecords(input, records);
  return records;
}

export async function addTransactionStorage(
  db: RepositoryDatabase,
  input: NewTransactionInput,
  records?: AddTransactionStorageResult,
): Promise<AddTransactionStorageResult> {
  const metadata = getTransactionWritePerfMetadata(input, 'manual');
  const beforeTransactionStartedAt = Date.now();
  let callbackFinishedAt: number | null = null;
  let result: AddTransactionStorageResult | null = null;

  await timeDevPerfAsync(
    'transactionStorage.addTransaction.total',
    async () => {
      await timeDevPerfAsync(
        'transactionStorage.addTransaction.transaction',
        () =>
          runAddTransactionWriteTransaction(db, metadata, async (transactionDb) => {
            logAddTransactionBoundary('transactionStorage.addTransaction.beforeCallback', beforeTransactionStartedAt, metadata);
            const callbackStartedAt = Date.now();
            try {
              result = await insertTransactionRecordsStorage(transactionDb, input, { records });
            } finally {
              callbackFinishedAt = Date.now();
              logAddTransactionBoundary('transactionStorage.addTransaction.callback', callbackStartedAt, metadata);
            }
          }),
        metadata,
      );

      if (callbackFinishedAt !== null) {
        logAddTransactionBoundary('transactionStorage.addTransaction.afterCallbackToResolved', callbackFinishedAt, metadata);
      }
    },
    metadata,
  );

  if (!result) {
    throw new Error('Transaction was not saved.');
  }

  return result;
}

export async function insertTransactionRecordsStorage(
  db: TransactionWriteDatabase,
  input: NewTransactionInput,
  options: InsertTransactionRecordsOptions = {},
): Promise<AddTransactionStorageResult> {
  const metadata = getTransactionWritePerfMetadata(input);
  timeDevPerf(
    'transactionStorage.insertRecords.validation',
    () => {
      validateTransactionLinesForStorage(input.kind, input.lines);
      if (options.records) {
        validateAddTransactionStorageRecords(input, options.records);
      }
    },
    metadata,
  );

  const records = timeDevPerf(
    'transactionStorage.insertRecords.identifiers',
    () => options.records ?? createAddTransactionStorageRecords(input, options),
    metadata,
  );

  await timeDevPerfAsync(
    'transactionStorage.insertRecords.parent',
    () =>
      db.runAsync(
        `INSERT INTO transactions (
          id, kind, title, datetime, notes, labels_json, group_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        records.transaction.id,
        records.transaction.kind,
        records.transaction.title,
        records.transaction.datetime,
        records.transaction.notes,
        JSON.stringify(records.transaction.labels),
        records.transaction.groupId,
        records.transaction.createdAt,
        records.transaction.updatedAt,
      ),
    metadata,
  );

  await timeDevPerfAsync(
    'transactionStorage.insertRecords.lines',
    async () => {
      for (const line of records.lines) {
        await insertTransactionLineStorage(db, line);
      }
    },
    metadata,
  );

  return records;
}

export async function updateTransactionStorage(
  db: RepositoryDatabase,
  input: UpdateTransactionInput,
  records?: UpdateTransactionStorageResult,
): Promise<UpdateTransactionStorageResult> {
  validateTransactionLinesForStorage(input.kind, input.lines);

  let result: UpdateTransactionStorageResult | null = null;
  await db.withTransactionAsync(async () => {
    if (records) {
      validateUpdateTransactionStorageRecords(input, records);
      result = records;
    } else {
      const existingTransactionRow = await db.getFirstAsync<TransactionRow>(
        'SELECT * FROM transactions WHERE id = ?',
        input.id,
      );
      if (!existingTransactionRow) {
        throw new Error('Transaction not found.');
      }
      const existingLineRows = await db.getAllAsync<TransactionLineRow>(
        'SELECT * FROM transaction_lines WHERE transaction_id = ? ORDER BY created_at ASC, id ASC',
        input.id,
      );
      result = createUpdateTransactionStorageRecords(
        input,
        mapTransaction(existingTransactionRow),
        existingLineRows.map(mapTransactionLine),
      );
    }

    const updateResult = await db.runAsync(
      `UPDATE transactions
       SET kind = ?, title = ?, datetime = ?, notes = ?, labels_json = ?, group_id = ?, updated_at = ?
       WHERE id = ?`,
      result.transaction.kind,
      result.transaction.title,
      result.transaction.datetime,
      result.transaction.notes,
      JSON.stringify(result.transaction.labels),
      result.transaction.groupId,
      result.transaction.updatedAt,
      input.id,
    );
    if (updateResult.changes === 0) {
      throw new Error('Transaction not found.');
    }

    for (const removedLineId of result.removedLineIds) {
      await db.runAsync('DELETE FROM transaction_lines WHERE id = ? AND transaction_id = ?', removedLineId, input.id);
    }

    const insertedLineIds = new Set(result.insertedLineIds);
    const updatedLineIds = new Set(result.updatedLineIds);
    for (const line of result.lines) {
      if (updatedLineIds.has(line.id)) {
        await updateTransactionLineRecordStorage(db, line);
      } else if (insertedLineIds.has(line.id)) {
        await insertTransactionLineStorage(db, line);
      } else {
        throw new Error('Prepared transaction line action is invalid.');
      }
    }
  });

  if (!result) {
    throw new Error('Transaction was not updated.');
  }

  return result;
}

export async function deleteTransactionStorage(
  db: RepositoryDatabase,
  transactionId: string,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await deleteTransactionRecordsStorage(db, transactionId);
  });
}

export async function deleteTransactionRecordsStorage(
  db: RepositoryDatabase,
  transactionId: string,
  options: { allowMissing?: boolean } = {},
): Promise<boolean> {
  const transaction = await db.getFirstAsync<TransactionRow>(
    'SELECT * FROM transactions WHERE id = ?',
    transactionId,
  );
  if (!transaction) {
    if (options.allowMissing) {
      return false;
    }

    throw new Error('Transaction not found.');
  }

  await removeTransactionLinksForTransactionStorage(db, transactionId);
  await deleteTransactionLinkedRecords(db, transactionId);
  await db.runAsync('DELETE FROM transaction_lines WHERE transaction_id = ?', transactionId);
  await db.runAsync('DELETE FROM transactions WHERE id = ?', transactionId);
  return true;
}

async function deleteTransactionLinkedRecords(
  db: RepositoryDatabase,
  transactionId: string,
): Promise<void> {
  const columns = await db.getAllAsync<TableColumnRow>('PRAGMA table_info(transaction_links)');
  const linkColumns = columns
    .map((column) => column.name)
    .filter((columnName) =>
      [
        'transaction_id',
        'source_transaction_id',
        'target_transaction_id',
        'linked_transaction_id',
        'refund_transaction_id',
        'reimbursement_transaction_id',
        'contribution_transaction_id',
      ].includes(columnName),
    );

  if (!linkColumns.length) {
    return;
  }

  await db.runAsync(
    `DELETE FROM transaction_links WHERE ${linkColumns.map((columnName) => `${columnName} = ?`).join(' OR ')}`,
    ...linkColumns.map(() => transactionId),
  );
}

function fallbackTransactionTitle(kind: TransactionKind): string {
  if (kind === 'income') {
    return 'Income';
  }

  if (kind === 'transfer') {
    return 'Transfer';
  }

  return 'Expense';
}

async function insertTransactionLineStorage(
  db: TransactionWriteDatabase,
  line: TransactionLine,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO transaction_lines (
      id, transaction_id, account_id, amount_minor, currency_code, category_id,
      subcategory_id, external_party, transfer_peer_account_id, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    line.id,
    line.transactionId,
    line.accountId,
    line.amountMinor,
    line.currencyCode,
    line.categoryId,
    line.subcategoryId,
    line.externalParty,
    line.transferPeerAccountId,
    line.note,
    line.createdAt,
  );
}

function createTransactionLineRecord(
  transactionId: string,
  line: TransactionLineInput,
  createdAt: string,
): TransactionLine {
  return createTransactionLineRecordFromInput(transactionId, line, { createdAt });
}

function createTransactionLineRecordFromInput(
  transactionId: string,
  line: TransactionLineInput,
  options: { createdAt: string; lineId?: string },
): TransactionLine {
  return {
    id: options.lineId ?? createLocalId('line'),
    transactionId,
    accountId: line.accountId,
    amountMinor: line.amountMinor,
    currencyCode: normalizeCurrencyCode(line.currencyCode),
    categoryId: line.categoryId ?? '',
    subcategoryId: line.subcategoryId ?? '',
    externalParty: line.externalParty?.trim() ?? '',
    transferPeerAccountId: line.transferPeerAccountId ?? '',
    note: line.note?.trim() ?? '',
    createdAt: options.createdAt,
  };
}

function validateAddTransactionStorageRecords(
  input: NewTransactionInput,
  records: AddTransactionStorageResult,
): void {
  if (records.transaction.kind !== input.kind) {
    throw new Error('Prepared transaction does not match the transaction kind.');
  }
  if (
    records.transaction.title !== (input.title.trim() || fallbackTransactionTitle(input.kind)) ||
    records.transaction.datetime !== input.datetime ||
    records.transaction.notes !== (input.notes?.trim() ?? '') ||
    records.transaction.groupId !== (input.groupId?.trim() ?? '') ||
    JSON.stringify(records.transaction.labels) !== JSON.stringify(input.labels ?? [])
  ) {
    throw new Error('Prepared transaction does not match the input.');
  }

  if (records.lines.length !== input.lines.length) {
    throw new Error('Prepared transaction line count does not match the input.');
  }

  records.lines.forEach((line, index) => {
    const inputLine = input.lines[index];
    if (
      line.transactionId !== records.transaction.id ||
      line.accountId !== inputLine.accountId ||
      line.amountMinor !== inputLine.amountMinor ||
      line.currencyCode !== normalizeCurrencyCode(inputLine.currencyCode) ||
      line.categoryId !== (inputLine.categoryId ?? '') ||
      line.subcategoryId !== (inputLine.subcategoryId ?? '') ||
      line.externalParty !== (inputLine.externalParty?.trim() ?? '') ||
      line.transferPeerAccountId !== (inputLine.transferPeerAccountId ?? '') ||
      line.note !== (inputLine.note?.trim() ?? '')
    ) {
      throw new Error('Prepared transaction line does not match the input.');
    }
  });
}

function validateUpdateTransactionStorageRecords(
  input: UpdateTransactionInput,
  records: UpdateTransactionStorageResult,
): void {
  if (records.transaction.id !== input.id || records.transaction.kind !== input.kind) {
    throw new Error('Prepared transaction does not match the input.');
  }
  if (
    records.transaction.title !== (input.title.trim() || fallbackTransactionTitle(input.kind)) ||
    records.transaction.datetime !== input.datetime ||
    records.transaction.notes !== (input.notes?.trim() ?? '') ||
    records.transaction.groupId !== (input.groupId?.trim() ?? '') ||
    JSON.stringify(records.transaction.labels) !== JSON.stringify(input.labels ?? [])
  ) {
    throw new Error('Prepared transaction does not match the input.');
  }

  if (records.lines.length !== input.lines.length) {
    throw new Error('Prepared transaction line count does not match the input.');
  }

  const actionLineIds = new Set([...records.insertedLineIds, ...records.updatedLineIds]);
  if (actionLineIds.size !== records.lines.length) {
    throw new Error('Prepared transaction line actions are invalid.');
  }

  records.lines.forEach((line, index) => {
    const inputLine = input.lines[index];
    if (
      !actionLineIds.has(line.id) ||
      records.removedLineIds.includes(line.id) ||
      line.transactionId !== input.id ||
      line.accountId !== inputLine.accountId ||
      line.amountMinor !== inputLine.amountMinor ||
      line.currencyCode !== normalizeCurrencyCode(inputLine.currencyCode) ||
      line.categoryId !== (inputLine.categoryId ?? '') ||
      line.subcategoryId !== (inputLine.subcategoryId ?? '') ||
      line.externalParty !== (inputLine.externalParty?.trim() ?? '') ||
      line.transferPeerAccountId !== (inputLine.transferPeerAccountId ?? '') ||
      line.note !== (inputLine.note?.trim() ?? '')
    ) {
      throw new Error('Prepared transaction line does not match the input.');
    }
  });
}

async function updateTransactionLineRecordStorage(
  db: RepositoryDatabase,
  line: TransactionLine,
): Promise<void> {
  const updateResult = await db.runAsync(
    `UPDATE transaction_lines
     SET account_id = ?, amount_minor = ?, currency_code = ?, category_id = ?,
         subcategory_id = ?, external_party = ?, transfer_peer_account_id = ?, note = ?
     WHERE id = ? AND transaction_id = ?`,
    line.accountId,
    line.amountMinor,
    line.currencyCode,
    line.categoryId,
    line.subcategoryId,
    line.externalParty,
    line.transferPeerAccountId ?? '',
    line.note,
    line.id,
    line.transactionId,
  );
  if (updateResult.changes === 0) {
    throw new Error('Transaction line not found.');
  }
}

function getTransactionLinePersistencePlans(
  lines: TransactionLineInput[],
  existingLines: Pick<TransactionLine, 'id'>[],
): TransactionLinePersistencePlan[] {
  const existingLineIds = new Set(existingLines.map((line) => line.id));
  const usedExistingLineIds = new Set<string>();
  const plans: TransactionLinePersistencePlan[] = lines.map((line) => ({ line }));

  for (let index = 0; index < lines.length; index += 1) {
    const requestedLineId = lines[index].id?.trim() ?? '';
    if (requestedLineId && existingLineIds.has(requestedLineId) && !usedExistingLineIds.has(requestedLineId)) {
      plans[index].existingLineId = requestedLineId;
      usedExistingLineIds.add(requestedLineId);
    }
  }

  if (usedExistingLineIds.size > 0) {
    return plans;
  }

  return plans.map((plan, index) => ({
    ...plan,
    existingLineId: existingLines[index]?.id,
  }));
}

function validateTransactionLinesForStorage(
  kind: TransactionKind,
  lines: TransactionLineInput[],
): void {
  if (!lines.length) {
    throw new Error('Add at least one transaction line.');
  }

  if (kind === 'transfer') {
    validateTransferLinesForStorage(lines);
    return;
  }

  if (lines.length > 1) {
    validateSplitTransactionLines({
      kind,
      lines: lines.map((line) => ({
        accountId: line.accountId,
        amountMinor: line.amountMinor,
        currencyCode: line.currencyCode,
        categoryId: line.categoryId ?? '',
        subcategoryId: line.subcategoryId ?? '',
        note: line.note,
      })),
      mode: 'auto',
    });
  }
}

function validateTransferLinesForStorage(lines: TransactionLineInput[]): void {
  if (lines.length > 2) {
    throw new Error('Transfers cannot be split.');
  }

  if (lines.some((line) => line.categoryId?.trim() || line.subcategoryId?.trim())) {
    throw new Error('Transfers cannot use categories.');
  }

  if (lines.length === 1) {
    if (lines[0].amountMinor === 0) {
      throw new Error('Transfer amount must be greater than zero.');
    }
    return;
  }

  const sourceLine = lines.find((line) => line.amountMinor < 0);
  const targetLine = lines.find((line) => line.amountMinor > 0);

  if (!sourceLine || !targetLine) {
    throw new Error('Transfers need one sent line and one received line.');
  }

  if (sourceLine.accountId === targetLine.accountId) {
    throw new Error('Source and destination accounts must be different.');
  }

  const sourceCurrencyCode = normalizeCurrencyCode(sourceLine.currencyCode);
  const targetCurrencyCode = normalizeCurrencyCode(targetLine.currencyCode);

  if (sourceCurrencyCode === targetCurrencyCode && Math.abs(sourceLine.amountMinor) !== targetLine.amountMinor) {
    throw new Error('Same-currency transfer amounts must match.');
  }
}

async function runAddTransactionWriteTransaction(
  db: RepositoryDatabase,
  metadata: PerfMetadata,
  task: (transactionDb: TransactionWriteDatabase) => Promise<void>,
): Promise<void> {
  let transactionOpen = false;
  try {
    await timeDevPerfAsync(
      'transactionStorage.addTransaction.manual.begin',
      () => db.execAsync('BEGIN IMMEDIATE TRANSACTION'),
      metadata,
    );
    transactionOpen = true;
    await task(db);
    await timeDevPerfAsync(
      'transactionStorage.addTransaction.manual.commit',
      () => db.execAsync('COMMIT'),
      metadata,
    );
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) {
      try {
        await timeDevPerfAsync(
          'transactionStorage.addTransaction.manual.rollback',
          () => db.execAsync('ROLLBACK'),
          metadata,
        );
      } catch {
        // Preserve the original insert/commit error; rollback can fail if SQLite already closed the transaction.
      }
    }
    throw error;
  }
}

function getTransactionWritePerfMetadata(input: NewTransactionInput, strategy?: AddTransactionStrategy) {
  return {
    kind: input.kind,
    lines: input.lines.length,
    split: input.kind !== 'transfer' && input.lines.length > 1,
    transfer: input.kind === 'transfer',
    crossCurrencyTransfer: isCrossCurrencyTransferInput(input),
    ...(strategy ? { strategy } : {}),
  };
}

function isCrossCurrencyTransferInput(input: NewTransactionInput): boolean {
  if (input.kind !== 'transfer') {
    return false;
  }

  return new Set(input.lines.map((line) => normalizeCurrencyCode(line.currencyCode))).size > 1;
}

function logAddTransactionBoundary(label: string, startedAt: number, metadata: PerfMetadata): void {
  logDevPerfDuration(label, startedAt, metadata);
}
