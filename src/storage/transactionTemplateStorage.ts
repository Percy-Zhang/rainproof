import { validateTransactionTemplateInput } from '../domain/transactionTemplates';
import type {
  NewTransactionTemplateInput,
  TransactionTemplate,
  UpdateTransactionTemplateInput,
} from '../domain/types';
import type { RepositoryDatabase } from './database';
import { createLocalId } from './ids';
import { mapTransactionTemplate, type AccountRow, type TransactionTemplateRow, mapAccount } from './mappers';

export async function listTransactionTemplatesStorage(
  db: RepositoryDatabase,
): Promise<TransactionTemplate[]> {
  const rows = await db.getAllAsync<TransactionTemplateRow>(
    'SELECT * FROM transaction_templates ORDER BY is_active DESC, name ASC, created_at ASC, id ASC',
  );
  return rows.map(mapTransactionTemplate);
}

export async function addTransactionTemplateStorage(
  db: RepositoryDatabase,
  input: NewTransactionTemplateInput,
): Promise<void> {
  const now = new Date().toISOString();
  const accounts = await listAccounts(db);
  const validated = validateTransactionTemplateInput(input, accounts);

  await db.runAsync(
    `INSERT INTO transaction_templates (
      id, name, kind, title, account_id, amount_minor, currency_code, category_id,
      subcategory_id, notes, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    createLocalId('template'),
    validated.name,
    validated.kind,
    validated.title,
    validated.accountId,
    validated.amountMinor,
    validated.currencyCode,
    validated.categoryId,
    validated.subcategoryId,
    validated.notes,
    validated.isActive ? 1 : 0,
    now,
    now,
  );
}

export async function updateTransactionTemplateStorage(
  db: RepositoryDatabase,
  input: UpdateTransactionTemplateInput,
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.getFirstAsync<TransactionTemplateRow>(
    'SELECT * FROM transaction_templates WHERE id = ?',
    input.id,
  );
  if (!existing) {
    throw new Error('Transaction template not found.');
  }

  const accounts = await listAccounts(db);
  const validated = validateTransactionTemplateInput(input, accounts);

  await db.runAsync(
    `UPDATE transaction_templates
     SET name = ?, kind = ?, title = ?, account_id = ?, amount_minor = ?,
         currency_code = ?, category_id = ?, subcategory_id = ?, notes = ?,
         is_active = ?, updated_at = ?
     WHERE id = ?`,
    validated.name,
    validated.kind,
    validated.title,
    validated.accountId,
    validated.amountMinor,
    validated.currencyCode,
    validated.categoryId,
    validated.subcategoryId,
    validated.notes,
    validated.isActive ? 1 : 0,
    now,
    input.id,
  );
}

export async function archiveTransactionTemplateStorage(
  db: RepositoryDatabase,
  templateId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE transaction_templates SET is_active = 0, updated_at = ? WHERE id = ?',
    now,
    templateId,
  );
}

export async function deleteTransactionTemplateStorage(
  db: RepositoryDatabase,
  templateId: string,
): Promise<void> {
  await db.runAsync('DELETE FROM transaction_templates WHERE id = ?', templateId);
}

async function listAccounts(db: RepositoryDatabase) {
  const rows = await db.getAllAsync<AccountRow>('SELECT * FROM accounts ORDER BY sort_order ASC, created_at ASC');
  return rows.map(mapAccount);
}
