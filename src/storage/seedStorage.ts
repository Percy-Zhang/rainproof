import { normalizeAccountThemeColor } from '../domain/accountThemes';
import type { AccountType, TransactionKind } from '../domain/types';
import type { RepositoryDatabase } from './database';
import { createLocalId } from './ids';
import type { SettingRow } from './mappers';
import {
  getExpandedSampleAccounts,
  getExpandedSampleBudgets,
  getExpandedSampleRecurringBills,
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
        id, category_id, currency_code, monthly_limit_minor, created_at, updated_at
      ) VALUES (?, 'food', ?, 70000, ?, ?)`,
      createLocalId('budget'),
      currencyCode,
      now,
      now,
    );
    await db.runAsync(
      `INSERT INTO recurring_bills (
        id, name, amount_minor, currency_code, account_id, category_id, due_day,
        is_active, created_at, updated_at
      ) VALUES (?, 'Internet', 8900, ?, ?, 'bills', 12, 1, ?, ?)`,
      createLocalId('bill'),
      currencyCode,
      everydayId,
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

    for (const bill of getExpandedSampleRecurringBills({
      billsId,
      creditCardId,
      currencyCode,
      everydayId,
    })) {
      await insertSeedRecurringBill(
        db,
        bill.name,
        bill.amountMinor,
        bill.currencyCode,
        bill.accountId,
        bill.categoryId,
        bill.dueDay,
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
  await db.runAsync(
    `INSERT INTO budgets (
      id, category_id, currency_code, monthly_limit_minor, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(category_id, currency_code)
    DO UPDATE SET monthly_limit_minor = excluded.monthly_limit_minor, updated_at = excluded.updated_at`,
    createLocalId('budget'),
    categoryId,
    currencyCode,
    monthlyLimitMinor,
    now,
    now,
  );
}

async function insertSeedRecurringBill(
  db: RepositoryDatabase,
  name: string,
  amountMinor: number,
  currencyCode: string,
  accountId: string,
  categoryId: string,
  dueDay: number,
  now: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO recurring_bills (
      id, name, amount_minor, currency_code, account_id, category_id, due_day,
      is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    createLocalId('bill'),
    name,
    amountMinor,
    currencyCode,
    accountId,
    categoryId,
    dueDay,
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
