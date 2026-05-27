import { normalizeCurrencyCode } from '../domain/money';
import {
  getBudgetScopeKey,
  validateBudgetInput,
} from '../domain/budgets';
import type { Budget, NewBudgetInput, NewRecurringBillInput, UpdateBudgetInput } from '../domain/types';
import type { RepositoryDatabase } from './database';
import { createLocalId } from './ids';
import { mapBudget, type BudgetRow } from './mappers';

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

export async function addRecurringBillStorage(
  db: RepositoryDatabase,
  input: NewRecurringBillInput,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO recurring_bills (
      id, name, amount_minor, currency_code, account_id, category_id, due_day,
      is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    createLocalId('bill'),
    input.name.trim() || 'Recurring bill',
    input.amountMinor,
    normalizeCurrencyCode(input.currencyCode),
    input.accountId,
    input.categoryId,
    Math.min(Math.max(input.dueDay, 1), 28),
    now,
    now,
  );
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
