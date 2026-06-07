import type * as SQLite from 'expo-sqlite';

import { runMigrations, type MigrationDatabase } from '../migrations';
import { SCHEMA_VERSION } from '../schema';

const currentAccountColumns = [
  'id',
  'name',
  'nickname',
  'type',
  'currency_code',
  'opening_balance_minor',
  'credit_limit_minor',
  'notes',
  'institution_name',
  'include_in_rainy_day',
  'theme_color',
  'icon_name',
  'show_on_dashboard',
  'sort_order',
  'is_archived',
  'created_at',
  'updated_at',
];

const currentTransactionColumns = [
  'id',
  'kind',
  'title',
  'datetime',
  'notes',
  'labels_json',
  'group_id',
  'created_at',
  'updated_at',
];

const currentTransactionLineColumns = [
  'id',
  'transaction_id',
  'account_id',
  'amount_minor',
  'currency_code',
  'category_id',
  'subcategory_id',
  'external_party',
  'transfer_peer_account_id',
  'note',
  'created_at',
];

const currentBudgetColumns = [
  'id',
  'name',
  'amount_minor',
  'currency_code',
  'period',
  'scope_type',
  'category_id',
  'subcategory_id',
  'scope_items_json',
  'sort_order',
  'is_active',
  'created_at',
  'updated_at',
];

const currentRecurringItemColumns = [
  'id',
  'name',
  'kind',
  'amount_minor',
  'currency_code',
  'account_id',
  'category_id',
  'subcategory_id',
  'note',
  'frequency',
  'next_due_date',
  'is_active',
  'created_at',
  'updated_at',
];

const currentTransactionTemplateColumns = [
  'id',
  'name',
  'kind',
  'title',
  'account_id',
  'amount_minor',
  'currency_code',
  'category_id',
  'subcategory_id',
  'notes',
  'is_active',
  'created_at',
  'updated_at',
];

const currentTransactionTemplateLineColumns = [
  'id',
  'template_id',
  'amount_minor',
  'category_id',
  'subcategory_id',
  'note',
  'sort_order',
  'created_at',
];

class FakeMigrationDatabase {
  readonly execStatements: string[] = [];
  readonly runStatements: string[] = [];
  readonly versionWrites: number[] = [];

  private readonly columnsByTable = new Map<string, Set<string>>();

  constructor(
    public userVersion: number,
    tableColumns: Record<string, string[]> = {},
    private readonly throwOnRunPattern?: RegExp,
  ) {
    Object.entries(tableColumns).forEach(([tableName, columnNames]) => {
      this.columnsByTable.set(tableName, new Set(columnNames));
    });
  }

  asMigrationDatabase(): MigrationDatabase {
    return this as unknown as MigrationDatabase;
  }

  getColumnNames(tableName: string): string[] {
    return Array.from(this.columnsByTable.get(tableName) ?? []);
  }

  async execAsync(source: string): Promise<void> {
    this.execStatements.push(source);

    const userVersionMatch = source.match(/PRAGMA\s+user_version\s*=\s*(\d+)/i);
    if (userVersionMatch) {
      const nextVersion = Number(userVersionMatch[1]);
      this.userVersion = nextVersion;
      this.versionWrites.push(nextVersion);
    }
  }

  async runAsync(source: string): Promise<SQLite.SQLiteRunResult> {
    this.runStatements.push(source);

    if (this.throwOnRunPattern?.test(source)) {
      throw new Error('migration failed');
    }

    const alterMatch = source.match(/ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)/i);
    if (alterMatch) {
      const [, tableName, columnName] = alterMatch;
      const columns = this.columnsByTable.get(tableName) ?? new Set<string>();
      columns.add(columnName);
      this.columnsByTable.set(tableName, columns);
    }

    return { changes: 1, lastInsertRowId: 0 };
  }

  async getAllAsync<T>(source: string): Promise<T[]> {
    const tableInfoMatch = source.match(/PRAGMA\s+table_info\((\w+)\)/i);
    if (tableInfoMatch) {
      const tableName = tableInfoMatch[1];
      return this.getColumnNames(tableName).map((name) => ({ name }) as T);
    }

    return [];
  }

  async getFirstAsync<T>(source: string): Promise<T | null> {
    if (/PRAGMA\s+user_version/i.test(source)) {
      return { user_version: this.userVersion } as T;
    }

    return null;
  }
}

describe('SQLite migrations', () => {
  it('initializes an empty database to the latest schema version sequentially', async () => {
    const db = new FakeMigrationDatabase(0);

    await runMigrations(db.asMigrationDatabase());

    expect(db.userVersion).toBe(SCHEMA_VERSION);
    expect(db.versionWrites).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(db.execStatements.some((statement) => statement.includes('CREATE TABLE IF NOT EXISTS accounts'))).toBe(
      true,
    );
    expect(
      db.execStatements.some((statement) => statement.includes('CREATE TABLE IF NOT EXISTS transaction_links')),
    ).toBe(true);
  });

  it('adds budget sort order when migrating from the previous current schema', async () => {
    const db = new FakeMigrationDatabase(10, {
      accounts: currentAccountColumns,
      transactions: currentTransactionColumns,
      transaction_lines: currentTransactionLineColumns,
      budgets: currentBudgetColumns.filter(
        (columnName) => columnName !== 'sort_order' && columnName !== 'scope_items_json',
      ),
      recurring_items: currentRecurringItemColumns,
      transaction_templates: currentTransactionTemplateColumns,
      transaction_template_lines: currentTransactionTemplateLineColumns,
    });

    await runMigrations(db.asMigrationDatabase());

    expect(db.userVersion).toBe(SCHEMA_VERSION);
    expect(db.versionWrites).toEqual([11, 12, 13]);
    expect(db.getColumnNames('budgets')).toEqual(expect.arrayContaining(['sort_order']));
  });

  it('adds budget scope items when migrating from the previous current schema', async () => {
    const db = new FakeMigrationDatabase(11, {
      accounts: currentAccountColumns,
      transactions: currentTransactionColumns,
      transaction_lines: currentTransactionLineColumns,
      budgets: currentBudgetColumns.filter((columnName) => columnName !== 'scope_items_json'),
      recurring_items: currentRecurringItemColumns,
      transaction_templates: currentTransactionTemplateColumns,
      transaction_template_lines: currentTransactionTemplateLineColumns,
    });

    await runMigrations(db.asMigrationDatabase());

    expect(db.userVersion).toBe(SCHEMA_VERSION);
    expect(db.versionWrites).toEqual([12, 13]);
    expect(
      db.execStatements.some((statement) => statement.includes('CREATE TABLE budgets_scope_next')),
    ).toBe(true);
  });

  it('adds recurring transaction undo history when migrating from the previous schema', async () => {
    const db = new FakeMigrationDatabase(12, {
      accounts: currentAccountColumns,
      transactions: currentTransactionColumns,
      transaction_lines: currentTransactionLineColumns,
      budgets: currentBudgetColumns,
      recurring_items: currentRecurringItemColumns,
      transaction_templates: currentTransactionTemplateColumns,
      transaction_template_lines: currentTransactionTemplateLineColumns,
    });

    await runMigrations(db.asMigrationDatabase());

    expect(db.userVersion).toBe(SCHEMA_VERSION);
    expect(db.versionWrites).toEqual([13]);
    expect(
      db.execStatements.some((statement) =>
        statement.includes('CREATE TABLE IF NOT EXISTS recurring_transaction_history')),
    ).toBe(true);
  });

  it('keeps a current database version stable when the current columns exist', async () => {
    const db = new FakeMigrationDatabase(SCHEMA_VERSION, {
      accounts: currentAccountColumns,
      transactions: currentTransactionColumns,
      transaction_lines: currentTransactionLineColumns,
      budgets: currentBudgetColumns,
      recurring_items: currentRecurringItemColumns,
      transaction_templates: currentTransactionTemplateColumns,
      transaction_template_lines: currentTransactionTemplateLineColumns,
    });

    await runMigrations(db.asMigrationDatabase());

    expect(db.versionWrites).toEqual([]);
    expect(db.runStatements.filter((statement) => statement.startsWith('ALTER TABLE'))).toEqual([]);
  });

  it('repairs missing current columns even if an older build already marked the database current', async () => {
    const db = new FakeMigrationDatabase(SCHEMA_VERSION, {
      accounts: ['id', 'name', 'type', 'currency_code', 'opening_balance_minor', 'created_at', 'updated_at'],
      transactions: ['id', 'kind', 'title', 'datetime', 'created_at', 'updated_at'],
      transaction_lines: ['id', 'transaction_id', 'account_id', 'amount_minor', 'currency_code'],
    });

    await runMigrations(db.asMigrationDatabase());

    expect(db.versionWrites).toEqual([]);
    expect(db.getColumnNames('accounts')).toEqual(
      expect.arrayContaining(['credit_limit_minor', 'icon_name', 'show_on_dashboard']),
    );
    expect(db.getColumnNames('transactions')).toEqual(expect.arrayContaining(['labels_json', 'group_id']));
    expect(db.getColumnNames('transaction_lines')).toEqual(
      expect.arrayContaining(['external_party', 'transfer_peer_account_id', 'note']),
    );
  });

  it('does not advance user_version when a migration step fails', async () => {
    const db = new FakeMigrationDatabase(
      1,
      { accounts: ['id'] },
      /ALTER TABLE accounts ADD COLUMN nickname/i,
    );

    await expect(runMigrations(db.asMigrationDatabase())).rejects.toThrow('migration failed');

    expect(db.userVersion).toBe(1);
    expect(db.versionWrites).toEqual([]);
  });
});
