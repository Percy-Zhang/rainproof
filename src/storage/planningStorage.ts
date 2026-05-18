import { normalizeCurrencyCode } from '../domain/money';
import type { NewBudgetInput, NewRecurringBillInput } from '../domain/types';
import type { RepositoryDatabase } from './database';
import { createLocalId } from './ids';

export async function addBudgetStorage(
  db: RepositoryDatabase,
  input: NewBudgetInput,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO budgets (
      id, category_id, currency_code, monthly_limit_minor, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(category_id, currency_code)
    DO UPDATE SET monthly_limit_minor = excluded.monthly_limit_minor, updated_at = excluded.updated_at`,
    createLocalId('budget'),
    input.categoryId,
    normalizeCurrencyCode(input.currencyCode),
    input.monthlyLimitMinor,
    now,
    now,
  );
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
