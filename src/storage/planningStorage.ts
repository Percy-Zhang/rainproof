import { normalizeCurrencyCode } from '../domain/money';
import {
  getBudgetScopeKey,
  validateBudgetInput,
} from '../domain/budgets';
import { validateRecurringItemInput } from '../domain/recurringItems';
import type {
  Budget,
  NewBudgetInput,
  NewRecurringItemInput,
  RecurringItem,
  UpdateBudgetInput,
  UpdateRecurringItemInput,
} from '../domain/types';
import type { RepositoryDatabase } from './database';
import { createLocalId } from './ids';
import { mapBudget, mapRecurringItem, type BudgetRow, type RecurringItemRow } from './mappers';

export async function addBudgetStorage(
  db: RepositoryDatabase,
  input: NewBudgetInput,
): Promise<void> {
  const now = new Date().toISOString();
  const validated = validateBudgetInput(input);

  await db.withTransactionAsync(async () => {
    await assertNoDuplicateActiveBudgetScope(db, validated);
    await db.runAsync(
      `INSERT INTO budgets (
        id, name, amount_minor, currency_code, period, scope_type, category_id,
        subcategory_id, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      createLocalId('budget'),
      validated.name,
      validated.amountMinor,
      validated.currencyCode,
      validated.period,
      validated.scopeType,
      validated.categoryId,
      validated.subcategoryId,
      validated.isActive ? 1 : 0,
      now,
      now,
    );
  });
}

export async function updateBudgetStorage(
  db: RepositoryDatabase,
  input: UpdateBudgetInput,
): Promise<void> {
  const now = new Date().toISOString();
  const validated = validateBudgetInput(input);

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<BudgetRow>('SELECT * FROM budgets WHERE id = ?', input.id);
    if (!existing) {
      throw new Error('Budget not found.');
    }

    await assertNoDuplicateActiveBudgetScope(db, validated, input.id);
    await db.runAsync(
      `UPDATE budgets
       SET name = ?, amount_minor = ?, currency_code = ?, period = ?, scope_type = ?,
           category_id = ?, subcategory_id = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
      validated.name,
      validated.amountMinor,
      validated.currencyCode,
      validated.period,
      validated.scopeType,
      validated.categoryId,
      validated.subcategoryId,
      validated.isActive ? 1 : 0,
      now,
      input.id,
    );
  });
}

export async function archiveBudgetStorage(
  db: RepositoryDatabase,
  budgetId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE budgets SET is_active = 0, updated_at = ? WHERE id = ?',
    now,
    budgetId,
  );
}

export async function listBudgetsStorage(db: RepositoryDatabase): Promise<Budget[]> {
  const rows = await db.getAllAsync<BudgetRow>(
    `SELECT * FROM budgets
     ORDER BY is_active DESC, currency_code ASC, scope_type ASC, name ASC, created_at ASC`,
  );
  return rows.map(mapBudget);
}

export async function listRecurringItemsStorage(db: RepositoryDatabase): Promise<RecurringItem[]> {
  const rows = await db.getAllAsync<RecurringItemRow>(
    `SELECT * FROM recurring_items
     ORDER BY is_active DESC, next_due_date ASC, name ASC, id ASC`,
  );
  return rows.map(mapRecurringItem);
}

export async function addRecurringItemStorage(
  db: RepositoryDatabase,
  input: NewRecurringItemInput,
): Promise<void> {
  const now = new Date().toISOString();
  const validated = validateRecurringItemInput(input);
  await db.runAsync(
    `INSERT INTO recurring_items (
      id, name, kind, amount_minor, currency_code, account_id, category_id,
      subcategory_id, note, frequency, next_due_date, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    createLocalId('recurring'),
    validated.name,
    validated.kind,
    validated.amountMinor,
    normalizeCurrencyCode(validated.currencyCode),
    validated.accountId,
    validated.categoryId,
    validated.subcategoryId,
    validated.note,
    validated.frequency,
    validated.nextDueDate,
    validated.isActive ? 1 : 0,
    now,
    now,
  );
}

export async function updateRecurringItemStorage(
  db: RepositoryDatabase,
  input: UpdateRecurringItemInput,
): Promise<void> {
  const now = new Date().toISOString();
  const validated = validateRecurringItemInput(input);
  const existing = await db.getFirstAsync<RecurringItemRow>('SELECT * FROM recurring_items WHERE id = ?', input.id);
  if (!existing) {
    throw new Error('Recurring item not found.');
  }

  await db.runAsync(
    `UPDATE recurring_items
     SET name = ?, kind = ?, amount_minor = ?, currency_code = ?, account_id = ?,
         category_id = ?, subcategory_id = ?, note = ?, frequency = ?, next_due_date = ?,
         is_active = ?, updated_at = ?
     WHERE id = ?`,
    validated.name,
    validated.kind,
    validated.amountMinor,
    normalizeCurrencyCode(validated.currencyCode),
    validated.accountId,
    validated.categoryId,
    validated.subcategoryId,
    validated.note,
    validated.frequency,
    validated.nextDueDate,
    validated.isActive ? 1 : 0,
    now,
    input.id,
  );
}

export async function archiveRecurringItemStorage(
  db: RepositoryDatabase,
  recurringItemId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE recurring_items SET is_active = 0, updated_at = ? WHERE id = ?',
    now,
    recurringItemId,
  );
}

export async function deleteRecurringItemStorage(
  db: RepositoryDatabase,
  recurringItemId: string,
): Promise<void> {
  await db.runAsync('DELETE FROM recurring_items WHERE id = ?', recurringItemId);
}

async function assertNoDuplicateActiveBudgetScope(
  db: RepositoryDatabase,
  input: ReturnType<typeof validateBudgetInput>,
  currentBudgetId?: string,
): Promise<void> {
  if (!input.isActive) {
    return;
  }

  const rows = await db.getAllAsync<BudgetRow>('SELECT * FROM budgets WHERE is_active = 1');
  const nextScopeKey = getBudgetScopeKey(input);
  const duplicate = rows
    .map(mapBudget)
    .find((budget) => budget.id !== currentBudgetId && getBudgetScopeKey(budget) === nextScopeKey);

  if (duplicate) {
    throw new Error('An active budget already exists for this scope.');
  }
}
