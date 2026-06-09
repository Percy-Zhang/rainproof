import { validateTransactionTemplateInput } from '../domain/transactionTemplates';
import type {
  NewTransactionTemplateInput,
  NewTransactionTemplateLineInput,
  TransactionTemplate,
  UpdateTransactionTemplateInput,
} from '../domain/types';
import type { RepositoryDatabase } from './database';
import { createLocalId } from './ids';
import {
  mapAccount,
  mapTransactionTemplate,
  mapTransactionTemplateLine,
  type AccountRow,
  type TransactionTemplateLineRow,
  type TransactionTemplateRow,
} from './mappers';

export async function listTransactionTemplatesStorage(
  db: RepositoryDatabase,
): Promise<TransactionTemplate[]> {
  const rows = await db.getAllAsync<TransactionTemplateRow>(
    'SELECT * FROM transaction_templates ORDER BY is_active DESC, name ASC, created_at ASC, id ASC',
  );
  const lineRows = await db.getAllAsync<TransactionTemplateLineRow>(
    'SELECT * FROM transaction_template_lines ORDER BY template_id ASC, sort_order ASC, created_at ASC, id ASC',
  );
  const linesByTemplateId = groupTemplateLinesByTemplateId(lineRows);

  return rows.map((row) => mapTransactionTemplate(row, linesByTemplateId.get(row.id) ?? []));
}

export async function addTransactionTemplateStorage(
  db: RepositoryDatabase,
  input: NewTransactionTemplateInput,
): Promise<void> {
  const now = new Date().toISOString();
  const accounts = await listAccounts(db);
  const validated = validateTransactionTemplateInput(input, accounts);
  const templateId = createLocalId('template');

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO transaction_templates (
        id, name, kind, title, account_id, amount_minor, currency_code, category_id,
        subcategory_id, notes, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      templateId,
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

    await replaceTransactionTemplateLines(db, templateId, validated.splitLines, now);
  });
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

  await db.withTransactionAsync(async () => {
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

    await replaceTransactionTemplateLines(db, input.id, validated.splitLines, now);
  });
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
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM transaction_template_lines WHERE template_id = ?', templateId);
    await db.runAsync('DELETE FROM transaction_templates WHERE id = ?', templateId);
  });
}

async function listAccounts(db: RepositoryDatabase) {
  const rows = await db.getAllAsync<AccountRow>('SELECT * FROM accounts ORDER BY sort_order ASC, created_at ASC');
  return rows.map(mapAccount);
}

function groupTemplateLinesByTemplateId(
  rows: TransactionTemplateLineRow[],
): Map<string, ReturnType<typeof mapTransactionTemplateLine>[]> {
  const result = new Map<string, ReturnType<typeof mapTransactionTemplateLine>[]>();

  for (const row of rows) {
    const line = mapTransactionTemplateLine(row);
    const existing = result.get(line.templateId) ?? [];
    existing.push(line);
    result.set(line.templateId, existing);
  }

  return result;
}

async function replaceTransactionTemplateLines(
  db: RepositoryDatabase,
  templateId: string,
  lines: NewTransactionTemplateLineInput[],
  now: string,
): Promise<void> {
  await db.runAsync('DELETE FROM transaction_template_lines WHERE template_id = ?', templateId);

  for (const [index, line] of lines.entries()) {
    await db.runAsync(
      `INSERT INTO transaction_template_lines (
        id, template_id, kind, amount_minor, category_id, subcategory_id, note, sort_order, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      createLocalId('template_line'),
      templateId,
      line.kind ?? null,
      line.amountMinor,
      line.categoryId,
      line.subcategoryId,
      line.note ?? '',
      index,
      now,
    );
  }
}
