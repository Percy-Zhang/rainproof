import { normalizeCurrencyCode } from '../domain/money';
import { validateSplitTransactionLines } from '../domain/splitTransactions';
import type { NewTransactionInput, TransactionKind, UpdateTransactionInput } from '../domain/types';
import type { RepositoryDatabase } from './database';
import { createLocalId } from './ids';
import type { TableColumnRow, TransactionLineRow, TransactionRow } from './mappers';
import { removeTransactionLinksForTransactionStorage } from './transactionLinkStorage';

type TransactionLineInput = NewTransactionInput['lines'][number];

type TransactionLinePersistencePlan = {
  existingLineId?: string;
  line: TransactionLineInput;
};

export async function addTransactionStorage(
  db: RepositoryDatabase,
  input: NewTransactionInput,
): Promise<void> {
  validateTransactionLinesForStorage(input.kind, input.lines);

  const now = new Date().toISOString();
  const transactionId = createLocalId('txn');

  await db.withTransactionAsync(async () => {
    await db.runAsync(
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
    );

    for (const line of input.lines) {
      await db.runAsync(
        `INSERT INTO transaction_lines (
          id, transaction_id, account_id, amount_minor, currency_code, category_id,
          subcategory_id, external_party, transfer_peer_account_id, note, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        createLocalId('line'),
        transactionId,
        line.accountId,
        line.amountMinor,
        normalizeCurrencyCode(line.currencyCode),
        line.categoryId ?? '',
        line.subcategoryId ?? '',
        line.externalParty?.trim() ?? '',
        line.transferPeerAccountId ?? '',
        line.note?.trim() ?? '',
        now,
      );
    }
  });
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
    const transaction = await db.getFirstAsync<TransactionRow>(
      'SELECT * FROM transactions WHERE id = ?',
      transactionId,
    );
    if (!transaction) {
      throw new Error('Transaction not found.');
    }

    await removeTransactionLinksForTransactionStorage(db, transactionId);
    await deleteTransactionLinkedRecords(db, transactionId);
    await db.runAsync('DELETE FROM transaction_lines WHERE transaction_id = ?', transactionId);
    await db.runAsync('DELETE FROM transactions WHERE id = ?', transactionId);
  });
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
  db: RepositoryDatabase,
  transactionId: string,
  line: TransactionLineInput,
  createdAt: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO transaction_lines (
      id, transaction_id, account_id, amount_minor, currency_code, category_id,
      subcategory_id, external_party, transfer_peer_account_id, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    createLocalId('line'),
    transactionId,
    line.accountId,
    line.amountMinor,
    normalizeCurrencyCode(line.currencyCode),
    line.categoryId ?? '',
    line.subcategoryId ?? '',
    line.externalParty?.trim() ?? '',
    line.transferPeerAccountId ?? '',
    line.note?.trim() ?? '',
    createdAt,
  );
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
    if (lines.length > 2) {
      throw new Error('Transfers cannot be split.');
    }

    if (lines.some((line) => line.categoryId?.trim() || line.subcategoryId?.trim())) {
      throw new Error('Transfers cannot use categories.');
    }

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
    });
  }
}
