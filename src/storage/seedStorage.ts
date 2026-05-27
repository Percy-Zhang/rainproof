import { normalizeAccountThemeColor } from '../domain/accountThemes';
import type { AccountType, TransactionKind } from '../domain/types';
import type { RepositoryDatabase } from './database';
import { createLocalId } from './ids';
import type { SettingRow } from './mappers';
import {
  getExpandedSampleAccounts,
  getExpandedSampleBudgets,
  getExpandedSampleRecurringItems,
  getExpandedSampleTransactions,
  SAMPLE_DATA_VERSION,
  type SeedTransactionLine,
} from './sampleData';

export async function seedDemoFirstRunStorage(
  db: RepositoryDatabase,
  currencyCode: string,
): Promise<void> {
  const now = new Date().toISOString();
  const everydayId = createLocalId('acct');
  const rainyId = createLocalId('acct');
  const groceryTxnId = createLocalId('txn');
  const salaryTxnId = createLocalId('txn');
  const transferTxnId = createLocalId('txn');
  const fundId = createLocalId('fund');

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO accounts (
        id, name, nickname, type, currency_code, opening_balance_minor, notes, institution_name,
        include_in_rainy_day, theme_color, sort_order, is_archived, created_at, updated_at
      ) VALUES (?, 'Everyday', '', 'checking', ?, 245000, 'Daily spending account.', '', 0, '#1876A8', 0, 0, ?, ?)`,
      everydayId,
      currencyCode,
      now,
      now,
    );
    await db.runAsync(
      `INSERT INTO accounts (
        id, name, nickname, type, currency_code, opening_balance_minor, notes, institution_name,
        include_in_rainy_day, theme_color, sort_order, is_archived, created_at, updated_at
      ) VALUES (?, 'Rainy Day', '', 'savings', ?, 80000, 'Emergency savings account.', '', 1, '#5E9C92', 1, 0, ?, ?)`,
      rainyId,
      currencyCode,
      now,
      now,
    );
    await db.runAsync(
      `INSERT INTO rainy_day_funds (
        id, name, currency_code, goal_minor, created_at, updated_at
      ) VALUES (?, 'Rainy day fund', ?, 1000000, ?, ?)`,
      fundId,
      currencyCode,
      now,
      now,
    );
    await db.runAsync(
      'INSERT INTO rainy_day_fund_accounts (fund_id, account_id) VALUES (?, ?)',
      fundId,
      rainyId,
    );

    await insertSeedTransaction(db, salaryTxnId, 'income', 'Salary', now, [
      [everydayId, 320000, currencyCode, 'income', 'salary'],
    ]);
    await insertSeedTransaction(db, groceryTxnId, 'expense', 'Groceries', now, [
      [everydayId, -8640, currencyCode, 'food', 'groceries'],
    ]);
    await insertSeedTransaction(db, transferTxnId, 'transfer', 'Rainy day transfer', now, [
      [everydayId, -25000, currencyCode, '', '', rainyId],
      [rainyId, 25000, currencyCode, '', '', everydayId],
    ]);

    await db.runAsync(
      `INSERT INTO budgets (
        id, name, amount_minor, currency_code, period, scope_type, category_id,
        subcategory_id, is_active, created_at, updated_at
      ) VALUES (?, 'Food & Dining budget', 70000, ?, 'monthly', 'category', 'food', NULL, 1, ?, ?)`,
      createLocalId('budget'),
      currencyCode,
      now,
      now,
    );
    await db.runAsync(
      `INSERT INTO recurring_items (
        id, name, kind, amount_minor, currency_code, account_id, category_id,
        subcategory_id, note, frequency, next_due_date, is_active, created_at, updated_at
      ) VALUES (?, 'Internet', 'expense', 8900, ?, ?, 'bills', 'internet', '', 'monthly', ?, 1, ?, ?)`,
      createLocalId('recurring'),
      currencyCode,
      everydayId,
      formatSeedDateOnly(new Date()),
      now,
      now,
    );
  });
}

export async function ensureDemoSampleDataVersionStorage(
  db: RepositoryDatabase,
  currencyCode: string,
): Promise<void> {
  const currentVersion = Number(
    (await db.getFirstAsync<SettingRow>(
      'SELECT value FROM settings WHERE key = ?',
      'sample_data_version',
    ))?.value ?? '0',
  );

  if (currentVersion >= SAMPLE_DATA_VERSION) {
    return;
  }

  await seedExpandedSampleData(db, currencyCode);
  await db.runAsync(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    'sample_data_version',
    String(SAMPLE_DATA_VERSION),
  );
}

async function seedExpandedSampleData(
  db: RepositoryDatabase,
  currencyCode: string,
): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  const everydayId = await findAccountIdByName(db, 'Everyday');
  const rainyId = await findAccountIdByName(db, 'Rainy Day');

  if (!everydayId || !rainyId) {
    return;
  }

  const billsId = createLocalId('acct');
  const travelId = createLocalId('acct');
  const usdCashId = createLocalId('acct');
  const creditCardId = createLocalId('acct');

  await db.withTransactionAsync(async () => {
    for (const account of getExpandedSampleAccounts({
      billsId,
      creditCardId,
      currencyCode,
      nowIso,
      travelId,
      usdCashId,
    })) {
      await insertSeedAccount(db, account);
    }

    for (const transaction of getExpandedSampleTransactions({
      billsId,
      creditCardId,
      currencyCode,
      everydayId,
      now,
      rainyId,
      travelId,
      usdCashId,
    })) {
      await insertSeedTransaction(
        db,
        createLocalId('txn'),
        transaction.kind,
        transaction.title,
        transaction.datetime,
        transaction.lines,
      );
    }

    for (const budget of getExpandedSampleBudgets(currencyCode)) {
      await upsertSeedBudget(
        db,
        budget.categoryId,
        budget.currencyCode,
        budget.monthlyLimitMinor,
        nowIso,
      );
    }

    for (const item of getExpandedSampleRecurringItems({
      billsId,
      creditCardId,
      currencyCode,
      everydayId,
      now,
    })) {
      await insertSeedRecurringItem(
        db,
        item.name,
        item.amountMinor,
        item.currencyCode,
        item.accountId,
        item.categoryId,
        item.subcategoryId,
        item.nextDueDate,
        nowIso,
      );
    }
  });
}

async function findAccountIdByName(
  db: RepositoryDatabase,
  name: string,
): Promise<string | null> {
  return (await db.getFirstAsync<{ id: string }>('SELECT id FROM accounts WHERE name = ? LIMIT 1', name))?.id ?? null;
}

async function insertSeedAccount(
  db: RepositoryDatabase,
  {
    id,
    name,
    type,
    currencyCode,
    openingBalanceMinor,
    notes,
    institutionName,
    includeInRainyDay,
    themeColor,
    sortOrder,
    now,
  }: {
    id: string;
    name: string;
    type: AccountType;
    currencyCode: string;
    openingBalanceMinor: number;
    notes: string;
    institutionName: string;
    includeInRainyDay: boolean;
    themeColor: string;
    sortOrder: number;
    now: string;
  },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO accounts (
      id, name, nickname, type, currency_code, opening_balance_minor, notes, institution_name,
      include_in_rainy_day, theme_color, sort_order, is_archived, created_at, updated_at
    ) VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    id,
    name,
    type,
    currencyCode,
    openingBalanceMinor,
    notes,
    institutionName,
    includeInRainyDay ? 1 : 0,
    normalizeAccountThemeColor(themeColor),
    sortOrder,
    now,
    now,
  );
}

async function upsertSeedBudget(
  db: RepositoryDatabase,
  categoryId: string,
  currencyCode: string,
  monthlyLimitMinor: number,
  now: string,
): Promise<void> {
  const updated = await db.runAsync(
    `UPDATE budgets
     SET amount_minor = ?, updated_at = ?
     WHERE period = 'monthly' AND scope_type = 'category' AND currency_code = ?
       AND category_id = ? AND subcategory_id IS NULL AND is_active = 1`,
    monthlyLimitMinor,
    now,
    currencyCode,
    categoryId,
  );

  if (updated.changes > 0) {
    return;
  }

  await db.runAsync(
    `INSERT INTO budgets (
      id, name, amount_minor, currency_code, period, scope_type, category_id,
      subcategory_id, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'monthly', 'category', ?, NULL, 1, ?, ?)`,
    createLocalId('budget'),
    `${categoryId.replace(/[_-]+/g, ' ')} budget`,
    monthlyLimitMinor,
    currencyCode,
    categoryId,
    now,
    now,
  );
}

async function insertSeedRecurringItem(
  db: RepositoryDatabase,
  name: string,
  amountMinor: number,
  currencyCode: string,
  accountId: string,
  categoryId: string,
  subcategoryId: string,
  nextDueDate: string,
  now: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO recurring_items (
      id, name, kind, amount_minor, currency_code, account_id, category_id,
      subcategory_id, note, frequency, next_due_date, is_active, created_at, updated_at
    ) VALUES (?, ?, 'expense', ?, ?, ?, ?, ?, '', 'monthly', ?, 1, ?, ?)`,
    createLocalId('recurring'),
    name,
    amountMinor,
    currencyCode,
    accountId,
    categoryId,
    subcategoryId,
    nextDueDate,
    now,
    now,
  );
}

async function insertSeedTransaction(
  db: RepositoryDatabase,
  transactionId: string,
  kind: TransactionKind,
  title: string,
  now: string,
  lines: SeedTransactionLine[],
): Promise<void> {
  await db.runAsync(
    `INSERT INTO transactions (
      id, kind, title, datetime, notes, labels_json, group_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, '', '[]', '', ?, ?)`,
    transactionId,
    kind,
    title,
    now,
    now,
    now,
  );

  for (const [accountId, amountMinor, lineCurrencyCode, categoryId, subcategoryId, peerAccountId = ''] of lines) {
    await db.runAsync(
      `INSERT INTO transaction_lines (
        id, transaction_id, account_id, amount_minor, currency_code, category_id,
        subcategory_id, external_party, transfer_peer_account_id, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, '', ?)`,
      createLocalId('line'),
      transactionId,
      accountId,
      amountMinor,
      lineCurrencyCode,
      categoryId,
      subcategoryId,
      peerAccountId,
      now,
    );
  }
}

function formatSeedDateOnly(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
