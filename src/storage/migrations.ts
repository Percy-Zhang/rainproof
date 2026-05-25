import type * as SQLite from 'expo-sqlite';

import { DEFAULT_ACCOUNT_THEME_COLOR } from '../domain/accountThemes';
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

const PLANNING_AND_RAINY_DAY_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  monthly_limit_minor INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(category_id, currency_code)
);

CREATE TABLE IF NOT EXISTS recurring_bills (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  account_id TEXT NOT NULL DEFAULT '',
  category_id TEXT NOT NULL,
  due_day INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

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
  await db.execAsync(PLANNING_AND_RAINY_DAY_SCHEMA_SQL);
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
