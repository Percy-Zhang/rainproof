import type { CreateRecurringTransactionInput } from '../domain/types';
import type { RepositoryDatabase } from './database';
import { createLocalId } from './ids';
import type { RecurringItemRow, RecurringTransactionHistoryRow } from './mappers';
import { updateRecurringItemStorage } from './planningStorage';
import {
  deleteTransactionRecordsStorage,
  insertTransactionRecordsStorage,
} from './transactionStorage';

export async function createRecurringTransactionStorage(
  db: RepositoryDatabase,
  input: CreateRecurringTransactionInput,
): Promise<void> {
  if (input.recurringItemInput.id !== input.recurringItemId) {
    throw new Error('Recurring transaction item does not match the recurring update.');
  }

  await db.withTransactionAsync(async () => {
    const recurringItem = await db.getFirstAsync<RecurringItemRow>(
      'SELECT * FROM recurring_items WHERE id = ?',
      input.recurringItemId,
    );
    if (!recurringItem) {
      throw new Error('Recurring item not found.');
    }
    if (!recurringItem.is_active) {
      throw new Error('Recurring item is archived.');
    }
    if (recurringItem.next_due_date !== input.previousNextDueDate) {
      throw new Error('Recurring item due date changed. Review it before marking it paid or received.');
    }

    const now = new Date().toISOString();
    const transactionId = createLocalId('txn');
    const sequenceRow = await db.getFirstAsync<{ next_sequence: number | null }>(
      `SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence
       FROM recurring_transaction_history
       WHERE recurring_item_id = ?`,
      input.recurringItemId,
    );
    const sequence = sequenceRow?.next_sequence ?? 1;

    await insertTransactionRecordsStorage(db, input.transactionInput, {
      transactionId,
      createdAt: now,
    });
    await updateRecurringItemStorage(db, input.recurringItemInput);
    await db.runAsync(
      `INSERT INTO recurring_transaction_history (
        id, recurring_item_id, transaction_id, previous_next_due_date,
        advanced_next_due_date, sequence, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      createLocalId('recurring_action'),
      input.recurringItemId,
      transactionId,
      input.previousNextDueDate,
      input.recurringItemInput.nextDueDate,
      sequence,
      now,
    );
  });
}

export async function undoLatestRecurringTransactionStorage(
  db: RepositoryDatabase,
  recurringItemId: string,
): Promise<boolean> {
  let undone = false;

  await db.withTransactionAsync(async () => {
    const history = await db.getFirstAsync<RecurringTransactionHistoryRow>(
      `SELECT * FROM recurring_transaction_history
       WHERE recurring_item_id = ?
       ORDER BY sequence DESC
       LIMIT 1`,
      recurringItemId,
    );
    if (!history) {
      return;
    }

    const recurringItem = await db.getFirstAsync<RecurringItemRow>(
      'SELECT * FROM recurring_items WHERE id = ?',
      recurringItemId,
    );
    if (!recurringItem) {
      await db.runAsync('DELETE FROM recurring_transaction_history WHERE id = ?', history.id);
      return;
    }
    if (recurringItem.next_due_date !== history.advanced_next_due_date) {
      throw new Error(
        "Undo unavailable because this recurring item's due date was changed after the transaction was created.",
      );
    }

    await deleteTransactionRecordsStorage(db, history.transaction_id, { allowMissing: true });
    await db.runAsync(
      'UPDATE recurring_items SET next_due_date = ?, updated_at = ? WHERE id = ?',
      history.previous_next_due_date,
      new Date().toISOString(),
      recurringItemId,
    );
    await db.runAsync('DELETE FROM recurring_transaction_history WHERE id = ?', history.id);
    undone = true;
  });

  return undone;
}
