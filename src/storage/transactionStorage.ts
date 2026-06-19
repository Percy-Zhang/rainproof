import { normalizeCurrencyCode } from '../domain/money';
import { validateSplitTransactionLines } from '../domain/splitTransactions';
import type { NewTransactionInput, Transaction, TransactionKind, TransactionLine, UpdateTransactionInput } from '../domain/types';
import { logDevPerfDuration, type PerfMetadata, timeDevPerf, timeDevPerfAsync } from '../performance';
import type { RepositoryDatabase } from './database';
import { createLocalId } from './ids';
import type { TableColumnRow, TransactionLineRow, TransactionRow } from './mappers';
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

export async function addTransactionStorage(
  db: RepositoryDatabase,
  input: NewTransactionInput,
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
              result = await insertTransactionRecordsStorage(transactionDb, input);
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
  options: { transactionId?: string; createdAt?: string } = {},
): Promise<AddTransactionStorageResult> {
  const metadata = getTransactionWritePerfMetadata(input);
  timeDevPerf(
    'transactionStorage.insertRecords.validation',
    () => {
      validateTransactionLinesForStorage(input.kind, input.lines);
    },
    metadata,
  );

  const { now, transactionId } = timeDevPerf(
    'transactionStorage.insertRecords.identifiers',
    () => ({
      now: options.createdAt ?? new Date().toISOString(),
      transactionId: options.transactionId ?? createLocalId('txn'),
    }),
    metadata,
  );

  await timeDevPerfAsync(
    'transactionStorage.insertRecords.parent',
    () =>
      db.runAsync(
        `INSERT INTO transactions (
          id, kind, title, datetime, notes, labels_json, group_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        transactionId,
        input.kind,
        input.title.trim() || fallbackTransactionTitle(input.kind),
        input.datetime,
        input.notes?.trim() ?? '',
        JSON.stringify(input.labels ?? []),
        input.groupId?.trim() ?? '',
        now,
        now,
      ),
    metadata,
  );

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
  const lines: TransactionLine[] = [];

  await timeDevPerfAsync(
    'transactionStorage.insertRecords.lines',
    async () => {
      for (const line of input.lines) {
        lines.push(await insertTransactionLineStorage(db, transactionId, line, now));
      }
    },
    metadata,
  );

  return { lines, transaction };
}

export async function updateTransactionStorage(
  db: RepositoryDatabase,
  input: UpdateTransactionInput,
): Promise<void> {
  validateTransactionLinesForStorage(input.kind, input.lines);

  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE transactions
       SET kind = ?, title = ?, datetime = ?, notes = ?, labels_json = ?, group_id = ?, updated_at = ?
       WHERE id = ?`,
      input.kind,
      input.title.trim() || fallbackTransactionTitle(input.kind),
      input.datetime,
      input.notes?.trim() ?? '',
      JSON.stringify(input.labels ?? []),
      input.groupId?.trim() ?? '',
      now,
      input.id,
    );

    const existingLines = await db.getAllAsync<TransactionLineRow>(
      'SELECT * FROM transaction_lines WHERE transaction_id = ? ORDER BY created_at ASC, id ASC',
      input.id,
    );
    const plans = getTransactionLinePersistencePlans(input.lines, existingLines);
    const keptLineIds = new Set(plans.flatMap((plan) => (plan.existingLineId ? [plan.existingLineId] : [])));

    for (const existingLine of existingLines) {
      if (!keptLineIds.has(existingLine.id)) {
        await db.runAsync('DELETE FROM transaction_lines WHERE id = ? AND transaction_id = ?', existingLine.id, input.id);
      }
    }

    for (const plan of plans) {
      if (plan.existingLineId) {
        await updateTransactionLineStorage(db, plan.existingLineId, input.id, plan.line);
      } else {
        await insertTransactionLineStorage(db, input.id, plan.line, now);
      }
    }
  });
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
  transactionId: string,
  line: TransactionLineInput,
  createdAt: string,
): Promise<TransactionLine> {
  const lineId = createLocalId('line');
  const persistedLine: TransactionLine = {
    id: lineId,
    transactionId,
    accountId: line.accountId,
    amountMinor: line.amountMinor,
    currencyCode: normalizeCurrencyCode(line.currencyCode),
    categoryId: line.categoryId ?? '',
    subcategoryId: line.subcategoryId ?? '',
    externalParty: line.externalParty?.trim() ?? '',
    transferPeerAccountId: line.transferPeerAccountId ?? '',
    note: line.note?.trim() ?? '',
    createdAt,
  };

  await db.runAsync(
    `INSERT INTO transaction_lines (
      id, transaction_id, account_id, amount_minor, currency_code, category_id,
      subcategory_id, external_party, transfer_peer_account_id, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    persistedLine.id,
    transactionId,
    persistedLine.accountId,
    persistedLine.amountMinor,
    persistedLine.currencyCode,
    persistedLine.categoryId,
    persistedLine.subcategoryId,
    persistedLine.externalParty,
    persistedLine.transferPeerAccountId,
    persistedLine.note,
    createdAt,
  );

  return persistedLine;
}

async function updateTransactionLineStorage(
  db: RepositoryDatabase,
  lineId: string,
  transactionId: string,
  line: TransactionLineInput,
): Promise<void> {
  await db.runAsync(
    `UPDATE transaction_lines
     SET account_id = ?, amount_minor = ?, currency_code = ?, category_id = ?,
         subcategory_id = ?, external_party = ?, transfer_peer_account_id = ?, note = ?
     WHERE id = ? AND transaction_id = ?`,
    line.accountId,
    line.amountMinor,
    normalizeCurrencyCode(line.currencyCode),
    line.categoryId ?? '',
    line.subcategoryId ?? '',
    line.externalParty?.trim() ?? '',
    line.transferPeerAccountId ?? '',
    line.note?.trim() ?? '',
    lineId,
    transactionId,
  );
}

function getTransactionLinePersistencePlans(
  lines: TransactionLineInput[],
  existingLines: TransactionLineRow[],
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
