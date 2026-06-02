import type * as SQLite from 'expo-sqlite';

import { DEFAULT_ACCOUNT_THEME_COLOR } from '../domain/accountThemes';
import { getNextMonthlyDueDateForDay } from '../domain/recurringItems';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema';

export type MigrationDatabase = Pick<
  SQLite.SQLiteDatabase,
  'execAsync' | 'getAllAsync' | 'getFirstAsync' | 'runAsync'
>;

type TableColumnRow = {
  name: string;
};

type UserVersionRow = {
  user_version: number;
};

type Migration = {
  version: number;
  migrate: (db: MigrationDatabase) => Promise<void>;
};

const TRANSACTION_LINKS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS transaction_links (
  id TEXT PRIMARY KEY NOT NULL,
  source_transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  target_transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  source_line_id TEXT REFERENCES transaction_lines(id) ON DELETE CASCADE,
  target_line_id TEXT REFERENCES transaction_lines(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (source_transaction_id <> target_transaction_id),
  CHECK (link_type IN ('refund', 'reimbursement', 'shared_expense_contribution')),
  CHECK (amount_minor > 0)
);

CREATE INDEX IF NOT EXISTS idx_transaction_links_source_transaction_id
ON transaction_links(source_transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_links_target_transaction_id
ON transaction_links(target_transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_links_source_line_id
ON transaction_links(source_line_id);

CREATE INDEX IF NOT EXISTS idx_transaction_links_target_line_id
ON transaction_links(target_line_id);

CREATE INDEX IF NOT EXISTS idx_transaction_links_link_type
ON transaction_links(link_type);
`;

const BUDGETS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  amount_minor INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  scope_type TEXT NOT NULL DEFAULT 'category',
  category_id TEXT,
  subcategory_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (amount_minor > 0),
  CHECK (period IN ('monthly')),
  CHECK (scope_type IN ('overall', 'category', 'subcategory')),
  CHECK (
    (scope_type = 'overall' AND category_id IS NULL AND subcategory_id IS NULL) OR
    (scope_type = 'category' AND category_id IS NOT NULL AND category_id <> '' AND subcategory_id IS NULL) OR
    (scope_type = 'subcategory' AND category_id IS NOT NULL AND category_id <> '' AND subcategory_id IS NOT NULL AND subcategory_id <> '')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_active_scope
ON budgets(period, currency_code, scope_type, COALESCE(category_id, ''), COALESCE(subcategory_id, ''))
WHERE is_active = 1;
`;

const RECURRING_ITEMS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS recurring_items (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  account_id TEXT NOT NULL DEFAULT '',
  category_id TEXT NOT NULL DEFAULT '',
  subcategory_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT 'monthly',
  next_due_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (kind IN ('expense', 'income')),
  CHECK (amount_minor > 0),
  CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'yearly')),
  CHECK (next_due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);

CREATE INDEX IF NOT EXISTS idx_recurring_items_active_due
ON recurring_items(is_active, next_due_date);
`;

const TRANSACTION_TEMPLATES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS transaction_templates (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  account_id TEXT NOT NULL DEFAULT '',
  amount_minor INTEGER,
  currency_code TEXT NOT NULL,
  category_id TEXT,
  subcategory_id TEXT,
  notes TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (kind IN ('expense', 'income')),
  CHECK (amount_minor IS NULL OR amount_minor > 0)
);

CREATE INDEX IF NOT EXISTS idx_transaction_templates_active_name
ON transaction_templates(is_active, name);
`;

const TRANSACTION_TEMPLATE_LINES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS transaction_template_lines (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES transaction_templates(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL,
  category_id TEXT NOT NULL DEFAULT '',
  subcategory_id TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  CHECK (amount_minor > 0),
  CHECK (category_id <> ''),
  CHECK (subcategory_id <> '')
);

CREATE INDEX IF NOT EXISTS idx_transaction_template_lines_template_sort
ON transaction_template_lines(template_id, sort_order, created_at, id);
`;

const PLANNING_AND_RAINY_DAY_SCHEMA_SQL = `
${RECURRING_ITEMS_SCHEMA_SQL}
${TRANSACTION_TEMPLATES_SCHEMA_SQL}
${TRANSACTION_TEMPLATE_LINES_SCHEMA_SQL}

CREATE TABLE IF NOT EXISTS rainy_day_funds (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  goal_minor INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rainy_day_fund_accounts (
  fund_id TEXT NOT NULL REFERENCES rainy_day_funds(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (fund_id, account_id)
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id TEXT PRIMARY KEY NOT NULL,
  base_currency_code TEXT NOT NULL,
  quote_currency_code TEXT NOT NULL,
  rate_decimal TEXT NOT NULL,
  source TEXT NOT NULL,
  effective_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

const migrations: Migration[] = [
  {
    version: 1,
    migrate: async () => {
      // Baseline schema creation is run before each migration pass.
    },
  },
  {
    version: 2,
    migrate: async (db) => {
      await ensureAccountCompatibilityColumns(db);
    },
  },
  {
    version: 3,
    migrate: async (db) => {
      await ensureTransactionCompatibilityColumns(db);
    },
  },
  {
    version: 4,
    migrate: async (db) => {
      await db.execAsync(TRANSACTION_LINKS_SCHEMA_SQL);
      await db.execAsync(PLANNING_AND_RAINY_DAY_SCHEMA_SQL);
    },
  },
  {
    version: 5,
    migrate: async (db) => {
      await ensureLineLevelTransactionLinkSchema(db);
    },
  },
  {
    version: 6,
    migrate: async (db) => {
      await ensureAccountCreditLimitColumn(db);
    },
  },
  {
    version: 7,
    migrate: async (db) => {
      await ensureBudgetSchema(db);
    },
  },
  {
    version: 8,
    migrate: async (db) => {
      await ensureRecurringItemsSchema(db);
    },
  },
  {
    version: 9,
    migrate: async (db) => {
      await ensureTransactionTemplatesSchema(db);
    },
  },
  {
    version: 10,
    migrate: async (db) => {
      await ensureTransactionTemplateLinesSchema(db);
    },
  },
];

export async function runMigrations(db: MigrationDatabase): Promise<void> {
  const currentVersion = await getUserVersion(db);
  validateMigrationList();

  await db.execAsync(SCHEMA_SQL);

  if (currentVersion > SCHEMA_VERSION) {
    return;
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }

    await migration.migrate(db);
    await setUserVersion(db, migration.version);
  }

  await ensureCurrentSchemaCompatibility(db);
}

async function ensureCurrentSchemaCompatibility(db: MigrationDatabase): Promise<void> {
  await db.execAsync(SCHEMA_SQL);
  await ensureAccountCompatibilityColumns(db);
  await ensureAccountCreditLimitColumn(db);
  await ensureTransactionCompatibilityColumns(db);
  await ensureLineLevelTransactionLinkSchema(db);
  await ensureBudgetSchema(db);
  await ensureRecurringItemsSchema(db);
  await ensureTransactionTemplatesSchema(db);
  await ensureTransactionTemplateLinesSchema(db);
  await db.execAsync(PLANNING_AND_RAINY_DAY_SCHEMA_SQL);
}

type LegacyBudgetRow = {
  id: string;
  category_id: string;
  currency_code: string;
  monthly_limit_minor: number;
  created_at: string;
  updated_at: string;
};

type CategoryCatalogSettingRow = {
  value: string;
};

type LegacyRecurringBillRow = {
  id: string;
  name: string;
  amount_minor: number;
  currency_code: string;
  account_id: string;
  category_id: string;
  due_day: number;
  is_active: number;
  created_at: string;
  updated_at: string;
};

async function ensureBudgetSchema(db: MigrationDatabase): Promise<void> {
  const columns = await db.getAllAsync<TableColumnRow>('PRAGMA table_info(budgets)');
  const columnNames = new Set(columns.map((column) => column.name));

  if (columnNames.has('amount_minor') && columnNames.has('scope_type') && columnNames.has('is_active')) {
    await db.execAsync(BUDGETS_SCHEMA_SQL);
    return;
  }

  const legacyRows = await db.getAllAsync<LegacyBudgetRow>(
    'SELECT id, category_id, currency_code, monthly_limit_minor, created_at, updated_at FROM budgets',
  );
  const categoryNames = await getBudgetMigrationCategoryNames(db);

  await db.execAsync(`
DROP TABLE IF EXISTS budgets_v1_next;
${BUDGETS_SCHEMA_SQL.replace(/CREATE TABLE IF NOT EXISTS budgets/, 'CREATE TABLE budgets_v1_next').replace(/CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_active_scope[\s\S]*$/, '')}
`);

  for (const row of legacyRows) {
    const categoryId = row.category_id?.trim() || 'other';
    const name = `${categoryNames.get(categoryId) ?? formatBudgetMigrationLabel(categoryId)} budget`;
    const amountMinor = Number(row.monthly_limit_minor);
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      continue;
    }

    await db.runAsync(
      `INSERT INTO budgets_v1_next (
        id, name, amount_minor, currency_code, period, scope_type, category_id,
        subcategory_id, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'monthly', 'category', ?, NULL, 1, ?, ?)`,
      row.id,
      name,
      amountMinor,
      row.currency_code,
      categoryId,
      row.created_at,
      row.updated_at,
    );
  }

  await db.execAsync(`
DROP TABLE budgets;
ALTER TABLE budgets_v1_next RENAME TO budgets;
${BUDGETS_SCHEMA_SQL.replace(/CREATE TABLE IF NOT EXISTS budgets[\s\S]*?\);\n\n/, '')}
`);
}

async function getBudgetMigrationCategoryNames(db: MigrationDatabase): Promise<Map<string, string>> {
  const setting = await db.getFirstAsync<CategoryCatalogSettingRow>(
    'SELECT value FROM settings WHERE key = ?',
    'category_catalog_json',
  );
  const names = new Map<string, string>();

  try {
    const parsed = JSON.parse(setting?.value ?? '[]');
    if (!Array.isArray(parsed)) {
      return names;
    }

    for (const category of parsed) {
      if (
        category &&
        typeof category === 'object' &&
        typeof category.id === 'string' &&
        typeof category.name === 'string' &&
        category.id.trim() &&
        category.name.trim()
      ) {
        names.set(category.id.trim(), category.name.trim());
      }
    }
  } catch {
    return names;
  }

  return names;
}

function formatBudgetMigrationLabel(value: string): string {
  const words = value
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words.length
    ? words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ')
    : 'Category';
}

async function ensureRecurringItemsSchema(db: MigrationDatabase): Promise<void> {
  await db.execAsync(RECURRING_ITEMS_SCHEMA_SQL);

  const hasLegacyRecurringBills = await tableExists(db, 'recurring_bills');
  if (!hasLegacyRecurringBills) {
    return;
  }

  const legacyRows = await db.getAllAsync<LegacyRecurringBillRow>(
    `SELECT id, name, amount_minor, currency_code, account_id, category_id, due_day,
            is_active, created_at, updated_at
     FROM recurring_bills`,
  );

  for (const row of legacyRows) {
    const amountMinor = Number(row.amount_minor);
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      continue;
    }

    await db.runAsync(
      `INSERT OR IGNORE INTO recurring_items (
        id, name, kind, amount_minor, currency_code, account_id, category_id,
        subcategory_id, note, frequency, next_due_date, is_active, created_at, updated_at
      ) VALUES (?, ?, 'expense', ?, ?, ?, ?, NULL, '', 'monthly', ?, ?, ?, ?)`,
      row.id,
      row.name?.trim() || 'Recurring item',
      amountMinor,
      row.currency_code,
      row.account_id ?? '',
      row.category_id ?? '',
      getNextMonthlyDueDateForDay(row.due_day),
      row.is_active === 1 ? 1 : 0,
      row.created_at,
      row.updated_at,
    );
  }
}

async function ensureTransactionTemplatesSchema(db: MigrationDatabase): Promise<void> {
  await db.execAsync(TRANSACTION_TEMPLATES_SCHEMA_SQL);
}

async function ensureTransactionTemplateLinesSchema(db: MigrationDatabase): Promise<void> {
  await db.execAsync(TRANSACTION_TEMPLATE_LINES_SCHEMA_SQL);
}

async function ensureLineLevelTransactionLinkSchema(db: MigrationDatabase): Promise<void> {
  const columns = await db.getAllAsync<TableColumnRow>('PRAGMA table_info(transaction_links)');
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has('source_line_id') || !columnNames.has('target_line_id')) {
    await rebuildTransactionLinksForLineLevelAllocation(db);
    return;
  }

  await db.execAsync(TRANSACTION_LINKS_SCHEMA_SQL);
}

async function rebuildTransactionLinksForLineLevelAllocation(db: MigrationDatabase): Promise<void> {
  await db.execAsync(`
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS transaction_links_line_level_next;

CREATE TABLE transaction_links_line_level_next (
  id TEXT PRIMARY KEY NOT NULL,
  source_transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  target_transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  source_line_id TEXT REFERENCES transaction_lines(id) ON DELETE CASCADE,
  target_line_id TEXT REFERENCES transaction_lines(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (source_transaction_id <> target_transaction_id),
  CHECK (link_type IN ('refund', 'reimbursement', 'shared_expense_contribution')),
  CHECK (amount_minor > 0)
);

INSERT INTO transaction_links_line_level_next (
  id, source_transaction_id, target_transaction_id, source_line_id, target_line_id,
  link_type, amount_minor, currency_code, created_at, updated_at
)
SELECT
  id, source_transaction_id, target_transaction_id, NULL, NULL,
  link_type, amount_minor, currency_code, created_at, updated_at
FROM transaction_links;

DROP TABLE transaction_links;
ALTER TABLE transaction_links_line_level_next RENAME TO transaction_links;

PRAGMA foreign_keys = ON;
`);

  await db.execAsync(TRANSACTION_LINKS_SCHEMA_SQL);
}

async function ensureAccountCompatibilityColumns(db: MigrationDatabase): Promise<void> {
  await ensureColumn(db, 'accounts', 'nickname', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'accounts', 'notes', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'accounts', 'institution_name', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'accounts', 'include_in_rainy_day', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'accounts', 'theme_color', `TEXT NOT NULL DEFAULT '${DEFAULT_ACCOUNT_THEME_COLOR}'`);
  await ensureColumn(db, 'accounts', 'icon_name', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'accounts', 'show_on_dashboard', 'INTEGER NOT NULL DEFAULT 1');
  await ensureColumn(db, 'accounts', 'sort_order', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'accounts', 'is_archived', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'accounts', 'created_at', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'accounts', 'updated_at', "TEXT NOT NULL DEFAULT ''");
}

async function ensureAccountCreditLimitColumn(db: MigrationDatabase): Promise<void> {
  await ensureColumn(db, 'accounts', 'credit_limit_minor', 'INTEGER');
}

async function ensureTransactionCompatibilityColumns(db: MigrationDatabase): Promise<void> {
  await ensureColumn(db, 'transactions', 'notes', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'transactions', 'labels_json', "TEXT NOT NULL DEFAULT '[]'");
  await ensureColumn(db, 'transactions', 'group_id', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'transactions', 'created_at', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'transactions', 'updated_at', "TEXT NOT NULL DEFAULT ''");

  await ensureColumn(db, 'transaction_lines', 'category_id', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'transaction_lines', 'subcategory_id', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'transaction_lines', 'external_party', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'transaction_lines', 'transfer_peer_account_id', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'transaction_lines', 'note', "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, 'transaction_lines', 'created_at', "TEXT NOT NULL DEFAULT ''");
}

async function ensureColumn(
  db: MigrationDatabase,
  tableName: string,
  columnName: string,
  columnDefinition: string,
): Promise<void> {
  const columns = await db.getAllAsync<TableColumnRow>(`PRAGMA table_info(${tableName})`);
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has(columnName)) {
    await db.runAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

async function tableExists(db: MigrationDatabase, tableName: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    tableName,
  );
  return !!row;
}

async function getUserVersion(db: MigrationDatabase): Promise<number> {
  const row = await db.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

async function setUserVersion(db: MigrationDatabase, version: number): Promise<void> {
  await db.execAsync(`PRAGMA user_version = ${version}`);
}

function validateMigrationList(): void {
  const latestMigration = migrations[migrations.length - 1];

  if (latestMigration?.version !== SCHEMA_VERSION) {
    throw new Error('SQLite migration list must end at the current schema version.');
  }

  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error('SQLite migrations must be sequential.');
    }
  });
}
