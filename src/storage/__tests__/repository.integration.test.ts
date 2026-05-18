import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { getAccountBalances, getRainyDayProgress } from '../../domain/aggregates';
import type {
  Account,
  AppSnapshot,
  Transaction,
  TransactionLine,
} from '../../domain/types';
import {
  createSQLiteFinanceRepositoryForDatabase,
  type FinanceRepository,
  type RepositoryDatabase,
} from '../repository';
import { SCHEMA_VERSION } from '../schema';

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

class NodeSQLiteRepositoryDatabase {
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

type RepositoryFixture = {
  db: NodeSQLiteRepositoryDatabase;
  repository: FinanceRepository;
  cleanup: () => void;
};

function createFixture(): RepositoryFixture {
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

async function withInitializedRepository(
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

async function getUserVersion(db: NodeSQLiteRepositoryDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

async function getSettingRows(db: NodeSQLiteRepositoryDatabase): Promise<{ key: string; value: string }[]> {
  return db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings ORDER BY key ASC');
}

async function getColumnNames(db: NodeSQLiteRepositoryDatabase, tableName: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
  return rows.map((row) => row.name);
}

async function addAccount(
  repository: FinanceRepository,
  input: {
    name: string;
    type?: Account['type'];
    openingBalanceMinor?: number;
    iconName?: string;
    includeInRainyDay?: boolean;
  },
): Promise<Account> {
  await repository.addAccount({
    name: input.name,
    type: input.type ?? 'checking',
    currencyCode: 'AUD',
    openingBalanceMinor: input.openingBalanceMinor ?? 0,
    iconName: input.iconName,
    includeInRainyDay: input.includeInRainyDay,
  });

  return getAccountByName(await repository.getSnapshot(), input.name);
}

async function addTransaction(
  repository: FinanceRepository,
  input: {
    kind: Transaction['kind'];
    title: string;
    lines: {
      accountId: string;
      amountMinor: number;
      transferPeerAccountId?: string;
      categoryId?: string;
      subcategoryId?: string;
    }[];
  },
): Promise<Transaction> {
  await repository.addTransaction({
    kind: input.kind,
    title: input.title,
    datetime: `2026-05-18T0${Math.min(input.title.length, 9)}:00:00.000Z`,
    lines: input.lines.map((line) => ({
      ...line,
      currencyCode: 'AUD',
    })),
  });

  return getTransactionByTitle(await repository.getSnapshot(), input.title);
}

function getAccountByName(snapshot: AppSnapshot, name: string): Account {
  const account = snapshot.accounts.find((item) => item.name === name);
  if (!account) {
    throw new Error(`Missing account ${name}`);
  }
  return account;
}

function getTransactionByTitle(snapshot: AppSnapshot, title: string): Transaction {
  const transaction = snapshot.transactions.find((item) => item.title === title);
  if (!transaction) {
    throw new Error(`Missing transaction ${title}`);
  }
  return transaction;
}

function getLineForTransaction(snapshot: AppSnapshot, transactionId: string): TransactionLine {
  const line = snapshot.transactionLines.find((item) => item.transactionId === transactionId);
  if (!line) {
    throw new Error(`Missing line for transaction ${transactionId}`);
  }
  return line;
}

function getBalanceByAccountId(snapshot: AppSnapshot): Record<string, number> {
  return Object.fromEntries(
    getAccountBalances(snapshot.accounts, snapshot.transactionLines).map((balance) => [
      balance.account.id,
      balance.balanceMinor,
    ]),
  );
}

describe('SQLite finance repository integration', () => {
  it('initializes an empty database with required defaults and no demo ledger data', async () => {
    await withInitializedRepository(async ({ db, repository }) => {
      const snapshot = await repository.getSnapshot();
      const settings = await getSettingRows(db);

      expect(await getUserVersion(db)).toBe(SCHEMA_VERSION);
      expect(settings.map((setting) => setting.key)).toEqual(
        expect.arrayContaining([
          'category_catalog_json',
          'default_currency_code',
          'enabled_currency_codes',
          'multi_currency_enabled',
        ]),
      );
      expect(snapshot.defaultCurrencyCode).toBe('AUD');
      expect(snapshot.settings.enabledCurrencyCodes).toContain('AUD');
      expect(snapshot.categories?.length).toBeGreaterThan(0);
      expect(snapshot.accounts).toEqual([]);
      expect(snapshot.transactions).toEqual([]);
      expect(snapshot.transactionLines).toEqual([]);
      expect(snapshot.transactionLinks).toEqual([]);
      expect(snapshot.budgets).toEqual([]);
      expect(snapshot.recurringBills).toEqual([]);
      expect(snapshot.rainyDayFund.goalMinor).toBe(0);
      expect(snapshot.rainyDayFund.linkedAccountIds).toEqual([]);
    });
  });

  it('persists account create, edit, icon, visibility, closed state, and derived balance inputs', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const account = await addAccount(repository, {
        name: 'Everyday',
        openingBalanceMinor: 12500,
        iconName: 'cash-outline',
        includeInRainyDay: true,
      });

      let snapshot = await repository.getSnapshot();
      expect(getAccountByName(snapshot, 'Everyday')).toEqual(
        expect.objectContaining({
          currencyCode: 'AUD',
          iconName: 'cash-outline',
          includeInRainyDay: true,
          openingBalanceMinor: 12500,
          showOnDashboard: true,
        }),
      );
      expect(getAccountBalances(snapshot.accounts, snapshot.transactionLines)[0]?.balanceMinor).toBe(12500);

      await repository.updateAccount({
        id: account.id,
        name: 'Daily',
        nickname: 'Main',
        notes: 'Updated notes',
        institutionName: 'Bank',
        includeInRainyDay: false,
        themeColor: '#0F7B45',
        iconName: 'card-outline',
      });
      await repository.updateAccountDashboardVisibility(account.id, false);

      snapshot = await repository.getSnapshot();
      expect(getAccountByName(snapshot, 'Daily')).toEqual(
        expect.objectContaining({
          nickname: 'Main',
          notes: 'Updated notes',
          institutionName: 'Bank',
          includeInRainyDay: false,
          themeColor: '#0F7B45',
          iconName: 'card-outline',
          showOnDashboard: false,
        }),
      );

      await repository.closeAccount(account.id);
      snapshot = await repository.getSnapshot();
      expect(getAccountByName(snapshot, 'Daily')).toEqual(
        expect.objectContaining({
          isArchived: true,
          includeInRainyDay: false,
          showOnDashboard: false,
        }),
      );

      await repository.reopenAccount(account.id);
      snapshot = await repository.getSnapshot();
      expect(getAccountByName(snapshot, 'Daily').isArchived).toBe(false);
    });
  });

  it('persists expense, income, transfer, edit, and delete transaction behavior', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday', openingBalanceMinor: 10000 });
      const savings = await addAccount(repository, { name: 'Savings', type: 'savings', openingBalanceMinor: 5000 });

      const expense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Groceries',
        lines: [{ accountId: everyday.id, amountMinor: -2500, categoryId: 'food-dining', subcategoryId: 'groceries' }],
      });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'Salary',
        lines: [{ accountId: everyday.id, amountMinor: 80000, categoryId: 'income', subcategoryId: 'salary' }],
      });
      const transfer = await addTransaction(repository, {
        kind: 'transfer',
        title: 'Move to savings',
        lines: [
          { accountId: everyday.id, amountMinor: -5000, transferPeerAccountId: savings.id },
          { accountId: savings.id, amountMinor: 5000, transferPeerAccountId: everyday.id },
        ],
      });

      let snapshot = await repository.getSnapshot();
      expect(snapshot.transactions.map((transaction) => transaction.title)).toEqual(
        expect.arrayContaining(['Groceries', 'Salary', 'Move to savings']),
      );
      expect(snapshot.transactionLines.filter((line) => line.transactionId === transfer.id)).toHaveLength(2);
      expect(getAccountBalances(snapshot.accounts, snapshot.transactionLines)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ account: expect.objectContaining({ id: everyday.id }), balanceMinor: 82500 }),
          expect.objectContaining({ account: expect.objectContaining({ id: savings.id }), balanceMinor: 10000 }),
        ]),
      );

      await repository.updateTransaction({
        id: expense.id,
        kind: 'expense',
        title: 'Groceries updated',
        datetime: '2026-05-18T12:00:00.000Z',
        labels: ['weekly'],
        groupId: 'home',
        lines: [
          {
            accountId: everyday.id,
            amountMinor: -3000,
            currencyCode: 'AUD',
            categoryId: 'food-dining',
            subcategoryId: 'groceries',
          },
        ],
      });

      snapshot = await repository.getSnapshot();
      const updatedExpense = getTransactionByTitle(snapshot, 'Groceries updated');
      expect(updatedExpense).toEqual(expect.objectContaining({ labels: ['weekly'], groupId: 'home' }));
      expect(getLineForTransaction(snapshot, updatedExpense.id).amountMinor).toBe(-3000);

      await repository.deleteTransaction(income.id);
      snapshot = await repository.getSnapshot();
      expect(snapshot.transactions.some((transaction) => transaction.id === income.id)).toBe(false);
      expect(snapshot.transactionLines.some((line) => line.transactionId === income.id)).toBe(false);
    });
  });

  it('persists transaction links, queries links, cleans dangling links, and rejects transfer links', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const savings = await addAccount(repository, { name: 'Savings', type: 'savings' });
      const expense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Dinner',
        lines: [{ accountId: everyday.id, amountMinor: -6000, categoryId: 'food-dining', subcategoryId: 'restaurants' }],
      });
      const secondExpense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Groceries',
        lines: [{ accountId: everyday.id, amountMinor: -4000, categoryId: 'food-dining', subcategoryId: 'groceries' }],
      });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'Alex paid back',
        lines: [{ accountId: everyday.id, amountMinor: 3000, categoryId: 'income', subcategoryId: 'reimbursement' }],
      });
      const secondIncome = await addTransaction(repository, {
        kind: 'income',
        title: 'Refund',
        lines: [{ accountId: everyday.id, amountMinor: 1000, categoryId: 'income', subcategoryId: 'refund' }],
      });
      const transfer = await addTransaction(repository, {
        kind: 'transfer',
        title: 'Transfer',
        lines: [
          { accountId: everyday.id, amountMinor: -1000, transferPeerAccountId: savings.id },
          { accountId: savings.id, amountMinor: 1000, transferPeerAccountId: everyday.id },
        ],
      });

      const beforeBalances = getAccountBalances(
        (await repository.getSnapshot()).accounts,
        (await repository.getSnapshot()).transactionLines,
      );

      await repository.addTransactionLink({
        sourceTransactionId: income.id,
        targetTransactionId: expense.id,
        linkType: 'reimbursement',
        amountMinor: 3000,
        currencyCode: 'AUD',
      });

      let links = await repository.getTransactionLinks();
      expect(links).toHaveLength(1);
      expect(await repository.getTransactionLinksForSourceTransaction(income.id)).toHaveLength(1);
      expect(await repository.getTransactionLinksForTargetTransaction(expense.id)).toHaveLength(1);
      expect(await repository.getTransactionLinksForTransaction(income.id)).toHaveLength(1);
      expect(
        getAccountBalances((await repository.getSnapshot()).accounts, (await repository.getSnapshot()).transactionLines),
      ).toEqual(beforeBalances);

      await repository.updateTransactionLink({
        id: links[0].id,
        sourceTransactionId: income.id,
        targetTransactionId: secondExpense.id,
        linkType: 'shared_expense_contribution',
        amountMinor: 3000,
        currencyCode: 'AUD',
      });
      links = await repository.getTransactionLinksForTargetTransaction(secondExpense.id);
      expect(links[0]).toEqual(
        expect.objectContaining({
          linkType: 'shared_expense_contribution',
          targetTransactionId: secondExpense.id,
        }),
      );

      await repository.deleteTransactionLink(links[0].id);
      expect(await repository.getTransactionLinks()).toEqual([]);

      await repository.addTransactionLink({
        sourceTransactionId: income.id,
        targetTransactionId: expense.id,
        linkType: 'reimbursement',
        amountMinor: 3000,
        currencyCode: 'AUD',
      });
      await repository.deleteTransaction(income.id);
      expect(await repository.getTransactionLinks()).toEqual([]);

      await repository.addTransactionLink({
        sourceTransactionId: secondIncome.id,
        targetTransactionId: expense.id,
        linkType: 'refund',
        amountMinor: 1000,
        currencyCode: 'AUD',
      });
      await repository.deleteTransaction(expense.id);
      expect(await repository.getTransactionLinks()).toEqual([]);

      await expect(
        repository.addTransactionLink({
          sourceTransactionId: secondIncome.id,
          targetTransactionId: transfer.id,
          linkType: 'refund',
          amountMinor: 1000,
          currencyCode: 'AUD',
        }),
      ).rejects.toThrow();
    });
  });

  it('persists Rainy Day settings without creating transactions or changing balances', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday', openingBalanceMinor: 12000 });
      const savings = await addAccount(repository, { name: 'Savings', type: 'savings', openingBalanceMinor: 30000 });
      const beforeSnapshot = await repository.getSnapshot();
      const beforeBalancesByAccountId = getBalanceByAccountId(beforeSnapshot);

      await repository.updateRainyDayFund({
        currencyCode: 'AUD',
        goalMinor: 50000,
        linkedAccountIds: [everyday.id, savings.id],
      });

      let snapshot = await repository.getSnapshot();
      expect(snapshot.rainyDayFund).toEqual(
        expect.objectContaining({
          currencyCode: 'AUD',
          goalMinor: 50000,
          linkedAccountIds: [everyday.id, savings.id],
        }),
      );
      expect(getRainyDayProgress(snapshot.rainyDayFund, getAccountBalances(snapshot.accounts, snapshot.transactionLines))).toEqual(
        expect.objectContaining({
          currentMinor: 42000,
          remainingMinor: 8000,
          percentage: 84,
        }),
      );
      expect(snapshot.transactions).toEqual([]);
      expect(getBalanceByAccountId(snapshot)).toEqual(beforeBalancesByAccountId);

      await repository.deleteAccount(savings.id);
      snapshot = await repository.getSnapshot();
      expect(snapshot.rainyDayFund.linkedAccountIds).toEqual([everyday.id]);
      expect(snapshot.transactions).toEqual([]);
    });
  });

  it('upgrades an older database shape without losing existing account data', async () => {
    const fixture = createFixture();
    try {
      await fixture.db.execAsync(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );

        CREATE TABLE accounts (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          currency_code TEXT NOT NULL,
          opening_balance_minor INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        INSERT INTO accounts (
          id, name, type, currency_code, opening_balance_minor, created_at, updated_at
        ) VALUES (
          'legacy_acct', 'Legacy account', 'checking', 'AUD', 12300,
          '2026-05-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z'
        );

        PRAGMA user_version = 1;
      `);

      await fixture.repository.initialize('AUD');

      const snapshot = await fixture.repository.getSnapshot();
      expect(await getUserVersion(fixture.db)).toBe(SCHEMA_VERSION);
      expect(getAccountByName(snapshot, 'Legacy account')).toEqual(
        expect.objectContaining({
          id: 'legacy_acct',
          iconName: 'business-outline',
          openingBalanceMinor: 12300,
          showOnDashboard: true,
        }),
      );
      expect(await getColumnNames(fixture.db, 'accounts')).toEqual(
        expect.arrayContaining(['icon_name', 'theme_color', 'show_on_dashboard', 'sort_order']),
      );
      expect(await getColumnNames(fixture.db, 'transaction_links')).toEqual(
        expect.arrayContaining(['source_transaction_id', 'target_transaction_id', 'link_type']),
      );
    } finally {
      fixture.cleanup();
    }
  });
});
