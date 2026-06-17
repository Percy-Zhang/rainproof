import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { getAccountBalances } from '../../domain/aggregates';
import { getBudgetUsageFromStatsReport } from '../../domain/budgets';
import { getStatsReport } from '../../domain/statsReports';
import type {
  Account,
  AppSnapshot,
  NewTransactionInput,
  RecurringItem,
  Transaction,
  TransactionLine,
  UpdateRecurringItemInput,
} from '../../domain/types';
import {
  createSQLiteFinanceRepositoryForDatabase,
  type FinanceRepository,
  type RepositoryDatabase,
} from '../repository';

type SQLitePrimitive = string | number | bigint | Uint8Array | null;
type SQLiteRunResult = {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
};
type NodeSQLiteStatement = {
  run: (...params: SQLitePrimitive[]) => SQLiteRunResult;
  get: (...params: SQLitePrimitive[]) => unknown;
  all: (...params: SQLitePrimitive[]) => unknown[];
};
type NodeSQLiteDatabase = {
  exec: (source: string) => void;
  prepare: (source: string) => NodeSQLiteStatement;
  close: () => void;
};

export class NodeSQLiteRepositoryDatabase {
  private readonly db: NodeSQLiteDatabase;

  constructor(databasePath: string) {
    this.db = new DatabaseSync(databasePath);
  }

  asRepositoryDatabase(): RepositoryDatabase {
    return this as unknown as RepositoryDatabase;
  }

  close(): void {
    this.db.close();
  }

  async execAsync(source: string): Promise<void> {
    this.db.exec(source);
  }

  async runAsync(source: string, ...params: unknown[]): Promise<{ changes: number; lastInsertRowId: number }> {
    const result = this.db.prepare(source).run(...normalizeParams(params));
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  async getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null> {
    return (this.db.prepare(source).get(...normalizeParams(params)) as T | undefined) ?? null;
  }

  async getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]> {
    return this.db.prepare(source).all(...normalizeParams(params)) as T[];
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await task();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

export type RepositoryFixture = {
  db: NodeSQLiteRepositoryDatabase;
  repository: FinanceRepository;
  cleanup: () => void;
};

export function createFixture(): RepositoryFixture {
  const directory = mkdtempSync(join(tmpdir(), 'rainproof-storage-'));
  const db = new NodeSQLiteRepositoryDatabase(join(directory, 'test.sqlite'));
  const repository = createSQLiteFinanceRepositoryForDatabase(db.asRepositoryDatabase());

  return {
    db,
    repository,
    cleanup: () => {
      db.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

export async function withInitializedRepository(
  testBody: (fixture: RepositoryFixture) => Promise<void>,
): Promise<void> {
  const fixture = createFixture();
  try {
    await fixture.repository.initialize('AUD');
    await testBody(fixture);
  } finally {
    fixture.cleanup();
  }
}

function normalizeParams(params: unknown[]): SQLitePrimitive[] {
  const values = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
  return values.map(normalizeParam);
}

function normalizeParam(value: unknown): SQLitePrimitive {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    value === null ||
    value instanceof Uint8Array
  ) {
    return value;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  throw new Error('Unsupported SQLite test parameter.');
}

export async function getUserVersion(db: NodeSQLiteRepositoryDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export async function getSettingRows(db: NodeSQLiteRepositoryDatabase): Promise<{ key: string; value: string }[]> {
  return db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings ORDER BY key ASC');
}

export async function getTableNames(db: NodeSQLiteRepositoryDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC",
  );
  return rows.map((row) => row.name);
}

export async function getColumnNames(db: NodeSQLiteRepositoryDatabase, tableName: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
  return rows.map((row) => row.name);
}

export async function getIndexNames(db: NodeSQLiteRepositoryDatabase, tableName: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA index_list(${tableName})`);
  return rows
    .map((row) => row.name)
    .filter((name) => !name.startsWith('sqlite_autoindex_'))
    .sort();
}

export async function addAccount(
  repository: FinanceRepository,
  input: {
    name: string;
    type?: Account['type'];
    openingBalanceMinor?: number;
    creditLimitMinor?: number | null;
    iconName?: string;
    includeInRainyDay?: boolean;
    currencyCode?: string;
  },
): Promise<Account> {
  await repository.addAccount({
    name: input.name,
    type: input.type ?? 'checking',
    currencyCode: input.currencyCode ?? 'AUD',
    openingBalanceMinor: input.openingBalanceMinor ?? 0,
    creditLimitMinor: input.creditLimitMinor,
    iconName: input.iconName,
    includeInRainyDay: input.includeInRainyDay,
  });

  return getAccountByName(await repository.getSnapshot(), input.name);
}

export async function addTransaction(
  repository: FinanceRepository,
  input: {
    kind: Transaction['kind'];
    title: string;
    lines: {
      accountId: string;
      amountMinor: number;
      currencyCode?: string;
      transferPeerAccountId?: string;
      categoryId?: string;
      subcategoryId?: string;
      externalParty?: string;
      note?: string;
    }[];
  },
): Promise<Transaction> {
  await repository.addTransaction({
    kind: input.kind,
    title: input.title,
    datetime: `2026-05-18T0${Math.min(input.title.length, 9)}:00:00.000Z`,
    lines: input.lines.map((line) => ({
      ...line,
      currencyCode: line.currencyCode ?? 'AUD',
    })),
  });

  return getTransactionByTitle(await repository.getSnapshot(), input.title);
}

export function recurringExpenseInput(
  accountId: string,
  title: string,
  date: string,
): NewTransactionInput {
  return {
    kind: 'expense',
    title,
    datetime: `${date}T12:00:00.000Z`,
    lines: [{
      accountId,
      amountMinor: -10000,
      currencyCode: 'AUD',
      categoryId: 'housing',
      subcategoryId: 'rent',
    }],
  };
}

export function recurringUpdateInput(
  recurringItem: RecurringItem,
  nextDueDate: string,
): UpdateRecurringItemInput {
  return {
    id: recurringItem.id,
    name: recurringItem.name,
    kind: recurringItem.kind,
    amountMinor: recurringItem.amountMinor,
    currencyCode: recurringItem.currencyCode,
    accountId: recurringItem.accountId,
    categoryId: recurringItem.categoryId,
    subcategoryId: recurringItem.subcategoryId,
    note: recurringItem.note,
    frequency: recurringItem.frequency,
    nextDueDate,
    isActive: recurringItem.isActive,
  };
}

export function getAccountByName(snapshot: AppSnapshot, name: string): Account {
  const account = snapshot.accounts.find((item) => item.name === name);
  if (!account) {
    throw new Error(`Missing account ${name}`);
  }
  return account;
}

export function getTransactionByTitle(snapshot: AppSnapshot, title: string): Transaction {
  const transaction = snapshot.transactions.find((item) => item.title === title);
  if (!transaction) {
    throw new Error(`Missing transaction ${title}`);
  }
  return transaction;
}

export function getLineForTransaction(snapshot: AppSnapshot, transactionId: string): TransactionLine {
  const line = snapshot.transactionLines.find((item) => item.transactionId === transactionId);
  if (!line) {
    throw new Error(`Missing line for transaction ${transactionId}`);
  }
  return line;
}

export function getLinesForTransaction(snapshot: AppSnapshot, transactionId: string): TransactionLine[] {
  return snapshot.transactionLines.filter((item) => item.transactionId === transactionId);
}

export function getLineBySubcategory(snapshot: AppSnapshot, transactionId: string, subcategoryId: string): TransactionLine {
  const line = getLinesForTransaction(snapshot, transactionId).find((item) => item.subcategoryId === subcategoryId);
  if (!line) {
    throw new Error(`Missing ${subcategoryId} line for transaction ${transactionId}`);
  }
  return line;
}

export async function getStoredTransactionLineCount(
  db: NodeSQLiteRepositoryDatabase,
  transactionId: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transaction_lines WHERE transaction_id = ?',
    transactionId,
  );
  return row?.count ?? 0;
}

export function getBalanceByAccountId(snapshot: AppSnapshot): Record<string, number> {
  return Object.fromEntries(
    getAccountBalances(snapshot.accounts, snapshot.transactionLines).map((balance) => [
      balance.account.id,
      balance.balanceMinor,
    ]),
  );
}

export function getExpenseStatsAndBudgetSpent(snapshot: AppSnapshot): { stats: number; budget: number } {
  const report = getStatsReport({
    reportKind: 'expense',
    transactions: snapshot.transactions,
    transactionLines: snapshot.transactionLines,
    transactionLinks: snapshot.transactionLinks,
    accounts: snapshot.accounts,
    categories: snapshot.categories,
    range: {
      startIso: '2026-05-01T00:00:00.000Z',
      endIso: '2026-07-31T23:59:59.999Z',
    },
    currencyCode: 'AUD',
  });
  const usage = getBudgetUsageFromStatsReport({ budgets: snapshot.budgets, report })[0];

  return {
    stats: report.totalNetAmountMinor,
    budget: usage?.spentMinor ?? 0,
  };
}

const expectedCurrentTableColumns: Record<string, string[]> = {
  accounts: [
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
  ],
  budgets: [
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
  ],
  exchange_rates: [
    'id',
    'base_currency_code',
    'quote_currency_code',
    'rate_decimal',
    'source',
    'effective_at',
    'created_at',
  ],
  rainy_day_fund_accounts: [
    'fund_id',
    'account_id',
  ],
  rainy_day_funds: [
    'id',
    'name',
    'currency_code',
    'goal_minor',
    'created_at',
    'updated_at',
  ],
  recurring_items: [
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
  ],
  recurring_transaction_history: [
    'id',
    'recurring_item_id',
    'transaction_id',
    'previous_next_due_date',
    'advanced_next_due_date',
    'sequence',
    'created_at',
  ],
  settings: [
    'key',
    'value',
  ],
  transaction_lines: [
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
  ],
  transaction_links: [
    'id',
    'source_transaction_id',
    'target_transaction_id',
    'source_line_id',
    'target_line_id',
    'link_type',
    'amount_minor',
    'currency_code',
    'created_at',
    'updated_at',
  ],
  transaction_templates: [
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
  ],
  transaction_template_lines: [
    'id',
    'template_id',
    'kind',
    'amount_minor',
    'category_id',
    'subcategory_id',
    'note',
    'sort_order',
    'created_at',
  ],
  transactions: [
    'id',
    'kind',
    'title',
    'datetime',
    'notes',
    'labels_json',
    'group_id',
    'created_at',
    'updated_at',
  ],
};

const expectedCurrentIndexes: Record<string, string[]> = {
  budgets: ['idx_budgets_active_scope'],
  recurring_items: ['idx_recurring_items_active_due'],
  recurring_transaction_history: ['idx_recurring_transaction_history_item_sequence'],
  transaction_lines: ['idx_transaction_lines_account_id', 'idx_transaction_lines_transaction_id'],
  transaction_links: [
    'idx_transaction_links_link_type',
    'idx_transaction_links_source_line_id',
    'idx_transaction_links_source_transaction_id',
    'idx_transaction_links_target_line_id',
    'idx_transaction_links_target_transaction_id',
  ],
  transaction_template_lines: ['idx_transaction_template_lines_template_sort'],
  transaction_templates: ['idx_transaction_templates_active_name'],
};

export async function expectFreshCurrentSchema(db: NodeSQLiteRepositoryDatabase): Promise<void> {
  expect(await getTableNames(db)).toEqual(Object.keys(expectedCurrentTableColumns).sort());

  for (const [tableName, columnNames] of Object.entries(expectedCurrentTableColumns)) {
    expect(await getColumnNames(db, tableName)).toEqual(columnNames);
  }

  await expectCurrentIndexes(db);
}

export async function expectCompatibleCurrentSchema(db: NodeSQLiteRepositoryDatabase): Promise<void> {
  expect(await getTableNames(db)).toEqual(Object.keys(expectedCurrentTableColumns).sort());

  for (const [tableName, columnNames] of Object.entries(expectedCurrentTableColumns)) {
    expect((await getColumnNames(db, tableName)).sort()).toEqual([...columnNames].sort());
  }

  await expectCurrentIndexes(db);
}

async function expectCurrentIndexes(db: NodeSQLiteRepositoryDatabase): Promise<void> {
  for (const [tableName, indexNames] of Object.entries(expectedCurrentIndexes)) {
    expect(await getIndexNames(db, tableName)).toEqual(expect.arrayContaining(indexNames));
  }
}

