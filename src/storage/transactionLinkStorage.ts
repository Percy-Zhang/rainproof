import { validateTransactionLinkInput } from '../domain/transactionLinks';
import type {
  NewTransactionLinkInput,
  Transaction,
  TransactionLine,
  TransactionLink,
  UpdateTransactionLinkInput,
} from '../domain/types';
import type { RepositoryDatabase } from './database';
import { createLocalId } from './ids';
import {
  mapTransaction,
  mapTransactionLine,
  mapTransactionLink,
  type TransactionLineRow,
  type TransactionLinkRow,
  type TransactionRow,
} from './mappers';

export async function addTransactionLinkStorage(
  db: RepositoryDatabase,
  input: NewTransactionLinkInput,
): Promise<void> {
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    const { transactions, lines, links } = await getTransactionLinkValidationState(db);
    const validated = validateTransactionLinkInput({
      input,
      transactions,
      lines,
      existingLinks: links,
    });

    await db.runAsync(
      `INSERT INTO transaction_links (
        id, source_transaction_id, target_transaction_id, link_type, amount_minor,
        currency_code, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      createLocalId('link'),
      validated.sourceTransactionId,
      validated.targetTransactionId,
      validated.linkType,
      validated.amountMinor,
      validated.currencyCode,
      now,
      now,
    );
  });
}

export async function updateTransactionLinkStorage(
  db: RepositoryDatabase,
  input: UpdateTransactionLinkInput,
): Promise<void> {
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    const existingLink = await db.getFirstAsync<TransactionLinkRow>(
      'SELECT * FROM transaction_links WHERE id = ?',
      input.id,
    );
    if (!existingLink) {
      throw new Error('Transaction link not found.');
    }

    const { transactions, lines, links } = await getTransactionLinkValidationState(db);
    const validated = validateTransactionLinkInput({
      input,
      transactions,
      lines,
      existingLinks: links,
      currentLinkId: input.id,
    });

    await db.runAsync(
      `UPDATE transaction_links
       SET source_transaction_id = ?, target_transaction_id = ?, link_type = ?,
           amount_minor = ?, currency_code = ?, updated_at = ?
       WHERE id = ?`,
      validated.sourceTransactionId,
      validated.targetTransactionId,
      validated.linkType,
      validated.amountMinor,
      validated.currencyCode,
      now,
      input.id,
    );
  });
}

export async function deleteTransactionLinkStorage(
  db: RepositoryDatabase,
  linkId: string,
): Promise<void> {
  await db.runAsync('DELETE FROM transaction_links WHERE id = ?', linkId);
}

export async function getTransactionLinksStorage(db: RepositoryDatabase): Promise<TransactionLink[]> {
  const rows = await db.getAllAsync<TransactionLinkRow>(
    'SELECT * FROM transaction_links ORDER BY created_at ASC, id ASC',
  );
  return rows.map(mapTransactionLink);
}

export async function getTransactionLinksForSourceTransactionStorage(
  db: RepositoryDatabase,
  transactionId: string,
): Promise<TransactionLink[]> {
  const rows = await db.getAllAsync<TransactionLinkRow>(
    'SELECT * FROM transaction_links WHERE source_transaction_id = ? ORDER BY created_at ASC, id ASC',
    transactionId,
  );
  return rows.map(mapTransactionLink);
}

export async function getTransactionLinksForTargetTransactionStorage(
  db: RepositoryDatabase,
  transactionId: string,
): Promise<TransactionLink[]> {
  const rows = await db.getAllAsync<TransactionLinkRow>(
    'SELECT * FROM transaction_links WHERE target_transaction_id = ? ORDER BY created_at ASC, id ASC',
    transactionId,
  );
  return rows.map(mapTransactionLink);
}

export async function getTransactionLinksForTransactionStorage(
  db: RepositoryDatabase,
  transactionId: string,
): Promise<TransactionLink[]> {
  const rows = await db.getAllAsync<TransactionLinkRow>(
    `SELECT * FROM transaction_links
     WHERE source_transaction_id = ? OR target_transaction_id = ?
     ORDER BY created_at ASC, id ASC`,
    transactionId,
    transactionId,
  );
  return rows.map(mapTransactionLink);
}

export async function removeTransactionLinksForTransactionStorage(
  db: RepositoryDatabase,
  transactionId: string,
): Promise<void> {
  await db.runAsync(
    'DELETE FROM transaction_links WHERE source_transaction_id = ? OR target_transaction_id = ?',
    transactionId,
    transactionId,
  );
}

async function getTransactionLinkValidationState(db: RepositoryDatabase): Promise<{
  transactions: Transaction[];
  lines: TransactionLine[];
  links: TransactionLink[];
}> {
  const transactionRows = await db.getAllAsync<TransactionRow>('SELECT * FROM transactions');
  const lineRows = await db.getAllAsync<TransactionLineRow>('SELECT * FROM transaction_lines');
  const linkRows = await db.getAllAsync<TransactionLinkRow>('SELECT * FROM transaction_links');

  return {
    transactions: transactionRows.map(mapTransaction),
    lines: lineRows.map(mapTransactionLine),
    links: linkRows.map(mapTransactionLink),
  };
}
