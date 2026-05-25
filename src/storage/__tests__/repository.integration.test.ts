import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  getAccountBalances,
  getCashFlowSummary,
  getRainyDayProgress,
  getSpendingByCategory,
  getTransactionDisplayEntries,
} from '../../domain/aggregates';
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

async function addTransaction(
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

function getLinesForTransaction(snapshot: AppSnapshot, transactionId: string): TransactionLine[] {
  return snapshot.transactionLines.filter((item) => item.transactionId === transactionId);
}

function getLineBySubcategory(snapshot: AppSnapshot, transactionId: string, subcategoryId: string): TransactionLine {
  const line = getLinesForTransaction(snapshot, transactionId).find((item) => item.subcategoryId === subcategoryId);
  if (!line) {
    throw new Error(`Missing ${subcategoryId} line for transaction ${transactionId}`);
  }
  return line;
}

async function getStoredTransactionLineCount(
  db: NodeSQLiteRepositoryDatabase,
  transactionId: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transaction_lines WHERE transaction_id = ?',
    transactionId,
  );
  return row?.count ?? 0;
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
          'default_currency_mode',
          'enabled_currency_codes',
          'multi_currency_enabled',
        ]),
      );
      expect(snapshot.defaultCurrencyCode).toBe('AUD');
      expect(snapshot.settings.defaultCurrencyMode).toBe('auto');
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

  it('promotes the automatic default currency to the first account currency', async () => {
    const fixture = createFixture();
    try {
      await fixture.repository.initialize('USD');

      await addAccount(fixture.repository, { name: 'Everyday', currencyCode: 'AUD', includeInRainyDay: true });
      const snapshot = await fixture.repository.getSnapshot();

      expect(snapshot.defaultCurrencyCode).toBe('AUD');
      expect(snapshot.settings.defaultCurrencyMode).toBe('auto');
      expect(snapshot.settings.enabledCurrencyCodes).toEqual(expect.arrayContaining(['AUD', 'USD']));
      expect(snapshot.rainyDayFund.currencyCode).toBe('AUD');
      expect(snapshot.rainyDayFund.linkedAccountIds).toHaveLength(1);
    } finally {
      fixture.cleanup();
    }
  });

  it.each(['EUR', 'GBP', 'JPY'])(
    'promotes the automatic default currency to a first %s account',
    async (currencyCode) => {
      const fixture = createFixture();
      try {
        await fixture.repository.initialize('USD');

        await addAccount(fixture.repository, { name: `${currencyCode} account`, currencyCode });
        const snapshot = await fixture.repository.getSnapshot();

        expect(snapshot.defaultCurrencyCode).toBe(currencyCode);
        expect(snapshot.settings.enabledCurrencyCodes).toContain(currencyCode);
      } finally {
        fixture.cleanup();
      }
    },
  );

  it('does not overwrite a manual default currency when adding the first account', async () => {
    const fixture = createFixture();
    try {
      await fixture.repository.initialize('USD');
      await fixture.repository.updateSettings({
        defaultCurrencyCode: 'USD',
        multiCurrencyEnabled: false,
        enabledCurrencyCodes: ['USD'],
      });

      await addAccount(fixture.repository, { name: 'Everyday', currencyCode: 'AUD' });
      const snapshot = await fixture.repository.getSnapshot();

      expect(snapshot.defaultCurrencyCode).toBe('USD');
      expect(snapshot.settings.defaultCurrencyMode).toBe('manual');
      expect(snapshot.settings.enabledCurrencyCodes).toContain('AUD');
    } finally {
      fixture.cleanup();
    }
  });

  it('uses a single existing account currency when older settings have no manual default flag', async () => {
    const fixture = createFixture();
    try {
      await fixture.repository.initialize('USD');
      await addAccount(fixture.repository, { name: 'Everyday', currencyCode: 'AUD' });
      await fixture.db.runAsync(
        `INSERT INTO settings (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        'default_currency_code',
        'USD',
      );
      await fixture.db.runAsync('DELETE FROM settings WHERE key = ?', 'default_currency_mode');

      const snapshot = await fixture.repository.getSnapshot();

      expect(snapshot.defaultCurrencyCode).toBe('AUD');
      expect(snapshot.settings.defaultCurrencyMode).toBe('auto');
    } finally {
      fixture.cleanup();
    }
  });

  it.each(['AUD', 'EUR'])('uses the effective single %s currency for stats calculations', async (currencyCode) => {
    const fixture = createFixture();
    try {
      await fixture.repository.initialize('USD');
      const everyday = await addAccount(fixture.repository, { name: 'Everyday', currencyCode });
      await fixture.repository.addTransaction({
        kind: 'expense',
        title: 'Groceries',
        datetime: '2026-05-18T12:00:00.000Z',
        lines: [
          {
            accountId: everyday.id,
            amountMinor: -4200,
            currencyCode,
            categoryId: 'food-dining',
            subcategoryId: 'groceries',
          },
        ],
      });

      const snapshot = await fixture.repository.getSnapshot();
      const range = {
        startIso: '2026-05-01T00:00:00.000Z',
        endIso: '2026-06-01T00:00:00.000Z',
      };

      expect(snapshot.defaultCurrencyCode).toBe(currencyCode);
      expect(
        getSpendingByCategory({
          transactions: snapshot.transactions,
          lines: snapshot.transactionLines,
          transactionLinks: snapshot.transactionLinks,
          range,
          currencyCode: snapshot.defaultCurrencyCode,
        }),
      ).toEqual([{ categoryId: 'food-dining', currencyCode, amountMinor: 4200 }]);
      expect(
        getCashFlowSummary({
          transactions: snapshot.transactions,
          lines: snapshot.transactionLines,
          transactionLinks: snapshot.transactionLinks,
          range,
          currencyCode: snapshot.defaultCurrencyCode,
        }).expenseMinor,
      ).toBe(4200);
    } finally {
      fixture.cleanup();
    }
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
          creditLimitMinor: null,
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
        creditLimitMinor: null,
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

  it('persists nullable credit card limits without affecting ledger balances', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const card = await addAccount(repository, {
        name: 'Rewards card',
        type: 'credit_card',
        openingBalanceMinor: -42000,
        creditLimitMinor: 200000,
      });
      await addAccount(repository, {
        name: 'Everyday',
        type: 'checking',
        creditLimitMinor: 999999,
      });

      let snapshot = await repository.getSnapshot();
      expect(getAccountByName(snapshot, 'Rewards card')).toEqual(
        expect.objectContaining({
          creditLimitMinor: 200000,
          openingBalanceMinor: -42000,
          type: 'credit_card',
        }),
      );
      expect(getAccountByName(snapshot, 'Everyday').creditLimitMinor).toBeNull();
      expect(getAccountBalances(snapshot.accounts, snapshot.transactionLines)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            account: expect.objectContaining({ id: card.id }),
            balanceMinor: -42000,
          }),
        ]),
      );

      await repository.updateAccount({
        id: card.id,
        name: 'Rewards card',
        nickname: '',
        notes: '',
        institutionName: '',
        includeInRainyDay: false,
        creditLimitMinor: 250000,
        themeColor: '#1876A8',
        iconName: 'card-outline',
      });

      snapshot = await repository.getSnapshot();
      expect(getAccountByName(snapshot, 'Rewards card').creditLimitMinor).toBe(250000);
      expect(getAccountBalances(snapshot.accounts, snapshot.transactionLines)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            account: expect.objectContaining({ id: card.id }),
            balanceMinor: -42000,
          }),
        ]),
      );
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

  it('preserves one-line transaction line IDs during edits', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const savings = await addAccount(repository, { name: 'Savings', type: 'savings' });
      const expense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Line ID expense',
        lines: [{ accountId: everyday.id, amountMinor: -2500, categoryId: 'food-dining', subcategoryId: 'groceries' }],
      });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'Line ID income',
        lines: [{ accountId: everyday.id, amountMinor: 80000, categoryId: 'income', subcategoryId: 'salary' }],
      });
      const transfer = await addTransaction(repository, {
        kind: 'transfer',
        title: 'Line ID transfer',
        lines: [
          { accountId: everyday.id, amountMinor: -5000, transferPeerAccountId: savings.id },
          { accountId: savings.id, amountMinor: 5000, transferPeerAccountId: everyday.id },
        ],
      });

      let snapshot = await repository.getSnapshot();
      const expenseLine = getLineForTransaction(snapshot, expense.id);
      const incomeLine = getLineForTransaction(snapshot, income.id);
      const transferLines = getLinesForTransaction(snapshot, transfer.id);
      const transferSourceLine = transferLines.find((line) => line.amountMinor < 0);
      const transferTargetLine = transferLines.find((line) => line.amountMinor > 0);

      expect(transferSourceLine).toBeDefined();
      expect(transferTargetLine).toBeDefined();

      await repository.updateTransaction({
        id: expense.id,
        kind: 'expense',
        title: 'Line ID expense updated',
        datetime: '2026-05-18T12:00:00.000Z',
        lines: [
          {
            accountId: everyday.id,
            amountMinor: -3000,
            currencyCode: 'AUD',
            categoryId: 'food-dining',
            subcategoryId: 'groceries',
            note: 'Still same line',
          },
        ],
      });
      await repository.updateTransaction({
        id: income.id,
        kind: 'income',
        title: 'Line ID income updated',
        datetime: '2026-05-18T13:00:00.000Z',
        lines: [
          {
            id: incomeLine.id,
            accountId: everyday.id,
            amountMinor: 90000,
            currencyCode: 'AUD',
            categoryId: 'income',
            subcategoryId: 'salary',
            note: 'Still same line',
          },
        ],
      });
      await repository.updateTransaction({
        id: transfer.id,
        kind: 'transfer',
        title: 'Line ID transfer updated',
        datetime: '2026-05-18T14:00:00.000Z',
        lines: [
          {
            id: transferSourceLine!.id,
            accountId: everyday.id,
            amountMinor: -6000,
            currencyCode: 'AUD',
            transferPeerAccountId: savings.id,
          },
          {
            id: transferTargetLine!.id,
            accountId: savings.id,
            amountMinor: 6000,
            currencyCode: 'AUD',
            transferPeerAccountId: everyday.id,
          },
        ],
      });

      snapshot = await repository.getSnapshot();
      expect(getLineForTransaction(snapshot, expense.id)).toEqual(
        expect.objectContaining({ id: expenseLine.id, amountMinor: -3000, note: 'Still same line' }),
      );
      expect(getLineForTransaction(snapshot, income.id)).toEqual(
        expect.objectContaining({ id: incomeLine.id, amountMinor: 90000, note: 'Still same line' }),
      );
      expect(getLinesForTransaction(snapshot, transfer.id).map((line) => line.id)).toEqual(
        expect.arrayContaining([transferSourceLine!.id, transferTargetLine!.id]),
      );
    });
  });

  it('persists a split expense as one parent transaction with multiple lines', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday', openingBalanceMinor: 10000 });

      const splitExpense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Split shop',
        lines: [
          {
            accountId: everyday.id,
            amountMinor: -5000,
            categoryId: 'food',
            subcategoryId: 'groceries',
            note: 'Weekly food shop',
          },
          {
            accountId: everyday.id,
            amountMinor: -3000,
            categoryId: 'housing',
            subcategoryId: 'rent',
            note: 'Rent share',
          },
        ],
      });

      const snapshot = await repository.getSnapshot();
      const lines = getLinesForTransaction(snapshot, splitExpense.id);
      const entries = getTransactionDisplayEntries({
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        currencyCode: 'AUD',
      }).filter((entry) => entry.transaction.id === splitExpense.id);

      expect(snapshot.transactions.filter((transaction) => transaction.id === splitExpense.id)).toHaveLength(1);
      expect(lines).toHaveLength(2);
      expect(new Set(lines.map((line) => line.accountId))).toEqual(new Set([everyday.id]));
      expect(new Set(lines.map((line) => line.currencyCode))).toEqual(new Set(['AUD']));
      expect(lines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            amountMinor: -5000,
            categoryId: 'food',
            subcategoryId: 'groceries',
            note: 'Weekly food shop',
          }),
          expect.objectContaining({
            amountMinor: -3000,
            categoryId: 'housing',
            subcategoryId: 'rent',
            note: 'Rent share',
          }),
        ]),
      );
      expect(getBalanceByAccountId(snapshot)[everyday.id]).toBe(2000);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual(expect.objectContaining({ amountMinor: -8000 }));
      expect(entries[0].lines).toHaveLength(2);
      expect(
        getSpendingByCategory({
          transactions: snapshot.transactions,
          lines: snapshot.transactionLines,
          range: { startIso: '2026-05-01T00:00:00.000Z', endIso: '2026-06-01T00:00:00.000Z' },
          currencyCode: 'AUD',
        }),
      ).toEqual([
        { categoryId: 'food', currencyCode: 'AUD', amountMinor: 5000 },
        { categoryId: 'housing', currencyCode: 'AUD', amountMinor: 3000 },
      ]);
    });
  });

  it('persists a split income as one parent transaction with multiple lines', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday', openingBalanceMinor: 10000 });

      const splitIncome = await addTransaction(repository, {
        kind: 'income',
        title: 'Apple Pay',
        lines: [
          {
            accountId: everyday.id,
            amountMinor: 130000,
            categoryId: 'income',
            subcategoryId: 'salary',
            note: 'Base pay',
          },
          {
            accountId: everyday.id,
            amountMinor: 20000,
            categoryId: 'income',
            subcategoryId: 'bonus',
            note: 'Quarterly bonus',
          },
        ],
      });

      const snapshot = await repository.getSnapshot();
      const lines = getLinesForTransaction(snapshot, splitIncome.id);
      const entries = getTransactionDisplayEntries({
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        currencyCode: 'AUD',
      }).filter((entry) => entry.transaction.id === splitIncome.id);

      expect(snapshot.transactions.filter((transaction) => transaction.id === splitIncome.id)).toHaveLength(1);
      expect(lines).toHaveLength(2);
      expect(new Set(lines.map((line) => line.accountId))).toEqual(new Set([everyday.id]));
      expect(new Set(lines.map((line) => line.currencyCode))).toEqual(new Set(['AUD']));
      expect(lines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            amountMinor: 130000,
            categoryId: 'income',
            subcategoryId: 'salary',
            note: 'Base pay',
          }),
          expect.objectContaining({
            amountMinor: 20000,
            categoryId: 'income',
            subcategoryId: 'bonus',
            note: 'Quarterly bonus',
          }),
        ]),
      );
      expect(getBalanceByAccountId(snapshot)[everyday.id]).toBe(160000);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual(expect.objectContaining({ amountMinor: 150000 }));
      expect(entries[0].lines).toHaveLength(2);
      expect(
        getCashFlowSummary({
          transactions: snapshot.transactions,
          lines: snapshot.transactionLines,
          range: { startIso: '2026-05-01T00:00:00.000Z', endIso: '2026-06-01T00:00:00.000Z' },
          currencyCode: 'AUD',
        }).incomeMinor,
      ).toBe(150000);
    });
  });

  it('edits one-line income and expense transactions into splits without orphaning old lines', async () => {
    await withInitializedRepository(async ({ db, repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const expense = await addTransaction(repository, {
        kind: 'expense',
        title: 'One-line expense',
        lines: [{ accountId: everyday.id, amountMinor: -8000, categoryId: 'other', subcategoryId: 'miscellaneous' }],
      });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'One-line income',
        lines: [{ accountId: everyday.id, amountMinor: 150000, categoryId: 'income', subcategoryId: 'salary' }],
      });
      let snapshot = await repository.getSnapshot();
      const originalExpenseLine = getLineForTransaction(snapshot, expense.id);
      const originalIncomeLine = getLineForTransaction(snapshot, income.id);

      await repository.updateTransaction({
        id: expense.id,
        kind: 'expense',
        title: 'Split expense',
        datetime: '2026-05-18T12:00:00.000Z',
        lines: [
          {
            accountId: everyday.id,
            amountMinor: -5000,
            currencyCode: 'AUD',
            categoryId: 'food',
            subcategoryId: 'groceries',
            note: 'Food',
          },
          {
            accountId: everyday.id,
            amountMinor: -3000,
            currencyCode: 'AUD',
            categoryId: 'housing',
            subcategoryId: 'rent',
            note: 'Rent',
          },
        ],
      });
      await repository.updateTransaction({
        id: income.id,
        kind: 'income',
        title: 'Split income',
        datetime: '2026-05-18T13:00:00.000Z',
        lines: [
          {
            accountId: everyday.id,
            amountMinor: 130000,
            currencyCode: 'AUD',
            categoryId: 'income',
            subcategoryId: 'salary',
            note: 'Base pay',
          },
          {
            accountId: everyday.id,
            amountMinor: 20000,
            currencyCode: 'AUD',
            categoryId: 'income',
            subcategoryId: 'bonus',
            note: 'Bonus',
          },
        ],
      });

      snapshot = await repository.getSnapshot();
      const updatedExpenseGroceries = getLineBySubcategory(snapshot, expense.id, 'groceries');
      const updatedExpenseRent = getLineBySubcategory(snapshot, expense.id, 'rent');
      const updatedIncomeSalary = getLineBySubcategory(snapshot, income.id, 'salary');
      const updatedIncomeBonus = getLineBySubcategory(snapshot, income.id, 'bonus');

      expect(updatedExpenseGroceries.id).toBe(originalExpenseLine.id);
      expect(updatedExpenseRent.id).not.toBe(originalExpenseLine.id);
      expect(updatedIncomeSalary.id).toBe(originalIncomeLine.id);
      expect(updatedIncomeBonus.id).not.toBe(originalIncomeLine.id);
      expect(getLinesForTransaction(snapshot, expense.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ amountMinor: -5000, categoryId: 'food', subcategoryId: 'groceries' }),
          expect.objectContaining({ amountMinor: -3000, categoryId: 'housing', subcategoryId: 'rent' }),
        ]),
      );
      expect(getLinesForTransaction(snapshot, income.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ amountMinor: 130000, categoryId: 'income', subcategoryId: 'salary' }),
          expect.objectContaining({ amountMinor: 20000, categoryId: 'income', subcategoryId: 'bonus' }),
        ]),
      );
      expect(await getStoredTransactionLineCount(db, expense.id)).toBe(2);
      expect(await getStoredTransactionLineCount(db, income.id)).toBe(2);
      expect(getBalanceByAccountId(snapshot)[everyday.id]).toBe(142000);
    });
  });

  it('edits existing split transactions and reduces them back to one line', async () => {
    await withInitializedRepository(async ({ db, repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const expense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Split expense',
        lines: [
          { accountId: everyday.id, amountMinor: -5000, categoryId: 'food', subcategoryId: 'groceries' },
          { accountId: everyday.id, amountMinor: -3000, categoryId: 'housing', subcategoryId: 'rent' },
        ],
      });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'Split income',
        lines: [
          { accountId: everyday.id, amountMinor: 130000, categoryId: 'income', subcategoryId: 'salary' },
          { accountId: everyday.id, amountMinor: 20000, categoryId: 'income', subcategoryId: 'bonus' },
        ],
      });
      let snapshot = await repository.getSnapshot();
      const originalExpenseGroceries = getLineBySubcategory(snapshot, expense.id, 'groceries');
      const originalExpenseRent = getLineBySubcategory(snapshot, expense.id, 'rent');
      const originalIncomeSalary = getLineBySubcategory(snapshot, income.id, 'salary');
      const originalIncomeBonus = getLineBySubcategory(snapshot, income.id, 'bonus');

      await repository.updateTransaction({
        id: expense.id,
        kind: 'expense',
        title: 'Updated split expense',
        datetime: '2026-05-18T12:00:00.000Z',
        lines: [
          {
            id: originalExpenseGroceries.id,
            accountId: everyday.id,
            amountMinor: -6000,
            currencyCode: 'AUD',
            categoryId: 'food',
            subcategoryId: 'groceries',
            note: 'Updated food',
          },
          {
            id: originalExpenseRent.id,
            accountId: everyday.id,
            amountMinor: -1000,
            currencyCode: 'AUD',
            categoryId: 'transport',
            subcategoryId: 'fuel',
            note: 'Changed category',
          },
          {
            id: 'temporary-new-expense-line',
            accountId: everyday.id,
            amountMinor: -1000,
            currencyCode: 'AUD',
            categoryId: 'health',
            subcategoryId: 'doctor',
            note: 'New line',
          },
        ],
      });
      await repository.updateTransaction({
        id: income.id,
        kind: 'income',
        title: 'Updated split income',
        datetime: '2026-05-18T13:00:00.000Z',
        lines: [
          {
            id: originalIncomeSalary.id,
            accountId: everyday.id,
            amountMinor: 120000,
            currencyCode: 'AUD',
            categoryId: 'income',
            subcategoryId: 'salary',
            note: 'Updated salary',
          },
          {
            id: originalIncomeBonus.id,
            accountId: everyday.id,
            amountMinor: 20000,
            currencyCode: 'AUD',
            categoryId: 'income',
            subcategoryId: 'bonus',
            note: 'Still bonus',
          },
          {
            id: 'temporary-new-income-line',
            accountId: everyday.id,
            amountMinor: 10000,
            currencyCode: 'AUD',
            categoryId: 'income',
            subcategoryId: 'freelance',
            note: 'New income line',
          },
        ],
      });

      snapshot = await repository.getSnapshot();
      const updatedExpenseGroceries = getLineBySubcategory(snapshot, expense.id, 'groceries');
      const updatedExpenseFuel = getLineBySubcategory(snapshot, expense.id, 'fuel');
      const updatedExpenseDoctor = getLineBySubcategory(snapshot, expense.id, 'doctor');
      const updatedIncomeSalary = getLineBySubcategory(snapshot, income.id, 'salary');
      const updatedIncomeBonus = getLineBySubcategory(snapshot, income.id, 'bonus');
      const updatedIncomeFreelance = getLineBySubcategory(snapshot, income.id, 'freelance');

      expect(updatedExpenseGroceries).toEqual(expect.objectContaining({ id: originalExpenseGroceries.id, note: 'Updated food' }));
      expect(updatedExpenseFuel).toEqual(expect.objectContaining({ id: originalExpenseRent.id, note: 'Changed category' }));
      expect([originalExpenseGroceries.id, originalExpenseRent.id]).not.toContain(updatedExpenseDoctor.id);
      expect(updatedExpenseDoctor.id).not.toBe('temporary-new-expense-line');
      expect(updatedIncomeSalary).toEqual(expect.objectContaining({ id: originalIncomeSalary.id, note: 'Updated salary' }));
      expect(updatedIncomeBonus).toEqual(expect.objectContaining({ id: originalIncomeBonus.id, note: 'Still bonus' }));
      expect([originalIncomeSalary.id, originalIncomeBonus.id]).not.toContain(updatedIncomeFreelance.id);
      expect(updatedIncomeFreelance.id).not.toBe('temporary-new-income-line');
      expect(getLinesForTransaction(snapshot, expense.id)).toHaveLength(3);
      expect(getLinesForTransaction(snapshot, income.id)).toHaveLength(3);
      expect(await getStoredTransactionLineCount(db, expense.id)).toBe(3);
      expect(await getStoredTransactionLineCount(db, income.id)).toBe(3);

      await repository.updateTransaction({
        id: expense.id,
        kind: 'expense',
        title: 'Reduced expense',
        datetime: '2026-05-18T14:00:00.000Z',
        lines: [
          {
            id: updatedExpenseDoctor.id,
            accountId: everyday.id,
            amountMinor: -8000,
            currencyCode: 'AUD',
            categoryId: 'health',
            subcategoryId: 'doctor',
          },
        ],
      });
      await repository.updateTransaction({
        id: income.id,
        kind: 'income',
        title: 'Reduced income',
        datetime: '2026-05-18T15:00:00.000Z',
        lines: [
          {
            id: updatedIncomeFreelance.id,
            accountId: everyday.id,
            amountMinor: 150000,
            currencyCode: 'AUD',
            categoryId: 'income',
            subcategoryId: 'freelance',
          },
        ],
      });

      snapshot = await repository.getSnapshot();
      expect(getLinesForTransaction(snapshot, expense.id)).toEqual([
        expect.objectContaining({ id: updatedExpenseDoctor.id, amountMinor: -8000, categoryId: 'health', subcategoryId: 'doctor' }),
      ]);
      expect(getLinesForTransaction(snapshot, income.id)).toEqual([
        expect.objectContaining({ id: updatedIncomeFreelance.id, amountMinor: 150000, categoryId: 'income', subcategoryId: 'freelance' }),
      ]);
      expect(snapshot.transactionLines.some((line) => line.id === updatedExpenseGroceries.id)).toBe(false);
      expect(snapshot.transactionLines.some((line) => line.id === updatedExpenseFuel.id)).toBe(false);
      expect(snapshot.transactionLines.some((line) => line.id === updatedIncomeSalary.id)).toBe(false);
      expect(snapshot.transactionLines.some((line) => line.id === updatedIncomeBonus.id)).toBe(false);
      expect(await getStoredTransactionLineCount(db, expense.id)).toBe(1);
      expect(await getStoredTransactionLineCount(db, income.id)).toBe(1);
      expect(getBalanceByAccountId(snapshot)[everyday.id]).toBe(142000);
    });
  });

  it('deletes split transactions with all lines and updates balances', async () => {
    await withInitializedRepository(async ({ db, repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const expense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Split expense',
        lines: [
          { accountId: everyday.id, amountMinor: -5000, categoryId: 'food', subcategoryId: 'groceries' },
          { accountId: everyday.id, amountMinor: -3000, categoryId: 'housing', subcategoryId: 'rent' },
        ],
      });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'Split income',
        lines: [
          { accountId: everyday.id, amountMinor: 130000, categoryId: 'income', subcategoryId: 'salary' },
          { accountId: everyday.id, amountMinor: 20000, categoryId: 'income', subcategoryId: 'bonus' },
        ],
      });
      let snapshot = await repository.getSnapshot();
      const deletedLineIds = [
        ...getLinesForTransaction(snapshot, expense.id),
        ...getLinesForTransaction(snapshot, income.id),
      ].map((line) => line.id);

      await repository.deleteTransaction(expense.id);
      snapshot = await repository.getSnapshot();
      expect(snapshot.transactions.some((transaction) => transaction.id === expense.id)).toBe(false);
      expect(getLinesForTransaction(snapshot, expense.id)).toEqual([]);
      expect(await getStoredTransactionLineCount(db, expense.id)).toBe(0);
      expect(getBalanceByAccountId(snapshot)[everyday.id]).toBe(150000);

      await repository.deleteTransaction(income.id);
      snapshot = await repository.getSnapshot();
      expect(snapshot.transactions.some((transaction) => transaction.id === income.id)).toBe(false);
      expect(getLinesForTransaction(snapshot, income.id)).toEqual([]);
      expect(await getStoredTransactionLineCount(db, income.id)).toBe(0);
      for (const lineId of deletedLineIds) {
        expect(snapshot.transactionLines.some((line) => line.id === lineId)).toBe(false);
      }
      expect(getBalanceByAccountId(snapshot)[everyday.id]).toBe(0);
    });
  });

  it('keeps transfer persistence unsplit, uncategorized, and excluded from core stats', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday', openingBalanceMinor: 10000 });
      const savings = await addAccount(repository, { name: 'Savings', type: 'savings', openingBalanceMinor: 5000 });
      const transfer = await addTransaction(repository, {
        kind: 'transfer',
        title: 'Move to savings',
        lines: [
          { accountId: everyday.id, amountMinor: -5000, transferPeerAccountId: savings.id },
          { accountId: savings.id, amountMinor: 5000, transferPeerAccountId: everyday.id },
        ],
      });

      let snapshot = await repository.getSnapshot();
      expect(getLinesForTransaction(snapshot, transfer.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ amountMinor: -5000, categoryId: '', subcategoryId: '' }),
          expect.objectContaining({ amountMinor: 5000, categoryId: '', subcategoryId: '' }),
        ]),
      );
      expect(
        getCashFlowSummary({
          transactions: snapshot.transactions,
          lines: snapshot.transactionLines,
          range: { startIso: '2026-05-01T00:00:00.000Z', endIso: '2026-06-01T00:00:00.000Z' },
          currencyCode: 'AUD',
        }),
      ).toEqual({ currencyCode: 'AUD', incomeMinor: 0, expenseMinor: 0, netMinor: 0 });

      await expect(
        repository.addTransaction({
          kind: 'transfer',
          title: 'Invalid split transfer',
          datetime: '2026-05-18T12:00:00.000Z',
          lines: [
            { accountId: everyday.id, amountMinor: -5000, currencyCode: 'AUD', transferPeerAccountId: savings.id },
            { accountId: savings.id, amountMinor: 3000, currencyCode: 'AUD', transferPeerAccountId: everyday.id },
            { accountId: savings.id, amountMinor: 2000, currencyCode: 'AUD', transferPeerAccountId: everyday.id },
          ],
        }),
      ).rejects.toThrow('Transfers cannot be split.');
      await expect(
        repository.updateTransaction({
          id: transfer.id,
          kind: 'transfer',
          title: 'Categorized transfer',
          datetime: '2026-05-18T13:00:00.000Z',
          lines: [
            {
              accountId: everyday.id,
              amountMinor: -5000,
              currencyCode: 'AUD',
              transferPeerAccountId: savings.id,
              categoryId: 'food',
              subcategoryId: 'groceries',
            },
            { accountId: savings.id, amountMinor: 5000, currencyCode: 'AUD', transferPeerAccountId: everyday.id },
          ],
        }),
      ).rejects.toThrow('Transfers cannot use categories.');

      snapshot = await repository.getSnapshot();
      expect(getLinesForTransaction(snapshot, transfer.id)).toHaveLength(2);
    });
  });

  it('nets linked reimbursements proportionally against persisted split expenses', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const expense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Shared groceries',
        lines: [
          { accountId: everyday.id, amountMinor: -8000, categoryId: 'food', subcategoryId: 'groceries' },
          { accountId: everyday.id, amountMinor: -2000, categoryId: 'housing', subcategoryId: 'rent' },
        ],
      });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'Alex paid back',
        lines: [{ accountId: everyday.id, amountMinor: 5000, categoryId: 'income', subcategoryId: 'reimbursement' }],
      });
      const beforeBalances = getBalanceByAccountId(await repository.getSnapshot());

      await repository.addTransactionLink({
        sourceTransactionId: income.id,
        targetTransactionId: expense.id,
        linkType: 'reimbursement',
        amountMinor: 5000,
        currencyCode: 'AUD',
      });

      const snapshot = await repository.getSnapshot();
      expect(getBalanceByAccountId(snapshot)).toEqual(beforeBalances);
      expect(
        getSpendingByCategory({
          transactions: snapshot.transactions,
          lines: snapshot.transactionLines,
          transactionLinks: snapshot.transactionLinks,
          range: { startIso: '2026-05-01T00:00:00.000Z', endIso: '2026-06-01T00:00:00.000Z' },
          currencyCode: 'AUD',
        }),
      ).toEqual([
        { categoryId: 'food', currencyCode: 'AUD', amountMinor: 4000 },
        { categoryId: 'housing', currencyCode: 'AUD', amountMinor: 1000 },
      ]);
      expect(
        getCashFlowSummary({
          transactions: snapshot.transactions,
          lines: snapshot.transactionLines,
          transactionLinks: snapshot.transactionLinks,
          range: { startIso: '2026-05-01T00:00:00.000Z', endIso: '2026-06-01T00:00:00.000Z' },
          currencyCode: 'AUD',
        }),
      ).toEqual({ currencyCode: 'AUD', incomeMinor: 0, expenseMinor: 5000, netMinor: -5000 });
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
      expect(links[0]).toEqual(expect.objectContaining({ sourceLineId: null, targetLineId: null }));
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

  it('persists line-level transaction link references and allows multiple links from one source transaction', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'Split payback',
        lines: [
          { accountId: everyday.id, amountMinor: 3000, categoryId: 'income', subcategoryId: 'reimbursement' },
          { accountId: everyday.id, amountMinor: 2000, categoryId: 'income', subcategoryId: 'refund' },
        ],
      });
      const expense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Split expense target',
        lines: [
          { accountId: everyday.id, amountMinor: -3000, categoryId: 'food-dining', subcategoryId: 'restaurants' },
          { accountId: everyday.id, amountMinor: -2000, categoryId: 'food-dining', subcategoryId: 'groceries' },
        ],
      });
      const secondExpense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Second target',
        lines: [{ accountId: everyday.id, amountMinor: -2000, categoryId: 'transport', subcategoryId: 'fuel' }],
      });

      let snapshot = await repository.getSnapshot();
      const incomeLines = getLinesForTransaction(snapshot, income.id);
      const reimbursementLine = getLineBySubcategory(snapshot, income.id, 'reimbursement');
      const refundLine = getLineBySubcategory(snapshot, income.id, 'refund');
      const restaurantsLine = getLineBySubcategory(snapshot, expense.id, 'restaurants');
      const groceriesLine = getLineBySubcategory(snapshot, expense.id, 'groceries');
      const fuelLine = getLineBySubcategory(snapshot, secondExpense.id, 'fuel');

      await repository.addTransactionLink({
        sourceTransactionId: income.id,
        sourceLineId: reimbursementLine.id,
        targetTransactionId: expense.id,
        targetLineId: restaurantsLine.id,
        linkType: 'reimbursement',
        amountMinor: 3000,
        currencyCode: 'AUD',
      });
      await repository.addTransactionLink({
        sourceTransactionId: income.id,
        sourceLineId: refundLine.id,
        targetTransactionId: secondExpense.id,
        targetLineId: fuelLine.id,
        linkType: 'refund',
        amountMinor: 2000,
        currencyCode: 'AUD',
      });

      let links = await repository.getTransactionLinksForSourceTransaction(income.id);
      expect(links).toHaveLength(2);
      expect(links).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceLineId: reimbursementLine.id,
            targetLineId: restaurantsLine.id,
            amountMinor: 3000,
          }),
          expect.objectContaining({
            sourceLineId: refundLine.id,
            targetLineId: fuelLine.id,
            amountMinor: 2000,
          }),
        ]),
      );

      await repository.updateTransactionLink({
        id: links[0].id,
        sourceTransactionId: income.id,
        sourceLineId: reimbursementLine.id,
        targetTransactionId: expense.id,
        targetLineId: groceriesLine.id,
        linkType: 'shared_expense_contribution',
        amountMinor: 2000,
        currencyCode: 'AUD',
      });
      links = await repository.getTransactionLinksForTargetTransaction(expense.id);
      expect(links).toEqual([
        expect.objectContaining({
          linkType: 'shared_expense_contribution',
          sourceLineId: reimbursementLine.id,
          targetLineId: groceriesLine.id,
        }),
      ]);

      await repository.updateTransaction({
        id: expense.id,
        kind: 'expense',
        title: 'Reduced split expense target',
        datetime: '2026-05-18T12:00:00.000Z',
        lines: [
          {
            id: restaurantsLine.id,
            accountId: everyday.id,
            amountMinor: -5000,
            currencyCode: 'AUD',
            categoryId: 'food-dining',
            subcategoryId: 'restaurants',
          },
        ],
      });
      expect(await repository.getTransactionLinksForTargetTransaction(expense.id)).toEqual([]);
      expect(await repository.getTransactionLinksForSourceTransaction(income.id)).toHaveLength(1);

      await repository.updateTransaction({
        id: income.id,
        kind: 'income',
        title: 'Reduced split payback',
        datetime: '2026-05-18T13:00:00.000Z',
        lines: [
          {
            id: incomeLines[0].id,
            accountId: everyday.id,
            amountMinor: 5000,
            currencyCode: 'AUD',
            categoryId: 'income',
            subcategoryId: 'reimbursement',
          },
        ],
      });
      expect(await repository.getTransactionLinksForSourceTransaction(income.id)).toEqual([]);
    });
  });

  it('rejects line-level link allocations that exceed source or target capacity', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'Partial payback',
        lines: [{ accountId: everyday.id, amountMinor: 3000, categoryId: 'income', subcategoryId: 'reimbursement' }],
      });
      const expense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Small target',
        lines: [{ accountId: everyday.id, amountMinor: -2000, categoryId: 'food-dining', subcategoryId: 'restaurants' }],
      });
      const largeExpense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Large target',
        lines: [{ accountId: everyday.id, amountMinor: -5000, categoryId: 'housing', subcategoryId: 'rent' }],
      });
      const snapshot = await repository.getSnapshot();
      const sourceLine = getLineBySubcategory(snapshot, income.id, 'reimbursement');
      const smallTargetLine = getLineBySubcategory(snapshot, expense.id, 'restaurants');
      const largeTargetLine = getLineBySubcategory(snapshot, largeExpense.id, 'rent');

      await repository.addTransactionLink({
        sourceTransactionId: income.id,
        sourceLineId: sourceLine.id,
        targetTransactionId: expense.id,
        targetLineId: smallTargetLine.id,
        linkType: 'reimbursement',
        amountMinor: 1500,
        currencyCode: 'AUD',
      });

      await expect(
        repository.addTransactionLink({
          sourceTransactionId: income.id,
          sourceLineId: sourceLine.id,
          targetTransactionId: expense.id,
          targetLineId: smallTargetLine.id,
          linkType: 'refund',
          amountMinor: 600,
          currencyCode: 'AUD',
        }),
      ).rejects.toThrow('Linked amounts cannot exceed the target expense transaction.');

      await expect(
        repository.addTransactionLink({
          sourceTransactionId: income.id,
          sourceLineId: sourceLine.id,
          targetTransactionId: largeExpense.id,
          targetLineId: largeTargetLine.id,
          linkType: 'refund',
          amountMinor: 2000,
          currencyCode: 'AUD',
        }),
      ).rejects.toThrow('Linked amounts cannot exceed the source income transaction.');
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
          creditLimitMinor: null,
          iconName: 'business-outline',
          openingBalanceMinor: 12300,
          showOnDashboard: true,
        }),
      );
      expect(await getColumnNames(fixture.db, 'accounts')).toEqual(
        expect.arrayContaining(['credit_limit_minor', 'icon_name', 'theme_color', 'show_on_dashboard', 'sort_order']),
      );
      expect(await getColumnNames(fixture.db, 'transaction_links')).toEqual(
        expect.arrayContaining(['source_transaction_id', 'target_transaction_id', 'source_line_id', 'target_line_id', 'link_type']),
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('migrates legacy transaction links to nullable line references without the one-source unique constraint', async () => {
    const fixture = createFixture();
    try {
      await fixture.db.execAsync(`
        CREATE TABLE accounts (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          nickname TEXT NOT NULL DEFAULT '',
          type TEXT NOT NULL,
          currency_code TEXT NOT NULL,
          opening_balance_minor INTEGER NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          institution_name TEXT NOT NULL DEFAULT '',
          include_in_rainy_day INTEGER NOT NULL DEFAULT 0,
          theme_color TEXT NOT NULL DEFAULT '#1876A8',
          icon_name TEXT NOT NULL DEFAULT '',
          show_on_dashboard INTEGER NOT NULL DEFAULT 1,
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE transactions (
          id TEXT PRIMARY KEY NOT NULL,
          kind TEXT NOT NULL,
          title TEXT NOT NULL,
          datetime TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          labels_json TEXT NOT NULL DEFAULT '[]',
          group_id TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE transaction_lines (
          id TEXT PRIMARY KEY NOT NULL,
          transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
          account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          amount_minor INTEGER NOT NULL,
          currency_code TEXT NOT NULL,
          category_id TEXT NOT NULL DEFAULT '',
          subcategory_id TEXT NOT NULL DEFAULT '',
          external_party TEXT NOT NULL DEFAULT '',
          transfer_peer_account_id TEXT NOT NULL DEFAULT '',
          note TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL
        );

        CREATE TABLE transaction_links (
          id TEXT PRIMARY KEY NOT NULL,
          source_transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
          target_transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
          link_type TEXT NOT NULL,
          amount_minor INTEGER NOT NULL,
          currency_code TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          CHECK (source_transaction_id <> target_transaction_id),
          CHECK (link_type IN ('refund', 'reimbursement', 'shared_expense_contribution')),
          CHECK (amount_minor > 0),
          UNIQUE(source_transaction_id),
          UNIQUE(source_transaction_id, target_transaction_id, link_type, amount_minor, currency_code)
        );

        INSERT INTO accounts (
          id, name, nickname, type, currency_code, opening_balance_minor, notes, institution_name,
          include_in_rainy_day, theme_color, icon_name, show_on_dashboard, sort_order, is_archived, created_at, updated_at
        ) VALUES (
          'acct_1', 'Everyday', '', 'checking', 'AUD', 0, '', '', 0, '#1876A8', '', 1, 0, 0,
          '2026-05-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z'
        );

        INSERT INTO transactions (
          id, kind, title, datetime, notes, labels_json, group_id, created_at, updated_at
        ) VALUES
          ('income_1', 'income', 'Paid back', '2026-05-18T10:00:00.000Z', '', '[]', '', '2026-05-18T10:00:00.000Z', '2026-05-18T10:00:00.000Z'),
          ('expense_1', 'expense', 'Dinner', '2026-05-18T09:00:00.000Z', '', '[]', '', '2026-05-18T09:00:00.000Z', '2026-05-18T09:00:00.000Z'),
          ('expense_2', 'expense', 'Groceries', '2026-05-18T08:00:00.000Z', '', '[]', '', '2026-05-18T08:00:00.000Z', '2026-05-18T08:00:00.000Z');

        INSERT INTO transaction_lines (
          id, transaction_id, account_id, amount_minor, currency_code, category_id,
          subcategory_id, external_party, transfer_peer_account_id, note, created_at
        ) VALUES
          ('income_line_1', 'income_1', 'acct_1', 5000, 'AUD', 'income', 'reimbursement', '', '', '', '2026-05-18T10:00:00.000Z'),
          ('expense_line_1', 'expense_1', 'acct_1', -3000, 'AUD', 'food-dining', 'restaurants', '', '', '', '2026-05-18T09:00:00.000Z'),
          ('expense_line_2', 'expense_2', 'acct_1', -2000, 'AUD', 'food-dining', 'groceries', '', '', '', '2026-05-18T08:00:00.000Z');

        INSERT INTO transaction_links (
          id, source_transaction_id, target_transaction_id, link_type, amount_minor, currency_code, created_at, updated_at
        ) VALUES (
          'link_1', 'income_1', 'expense_1', 'reimbursement', 3000, 'AUD',
          '2026-05-18T11:00:00.000Z', '2026-05-18T11:00:00.000Z'
        );

        PRAGMA user_version = 4;
      `);

      await fixture.repository.initialize('AUD');

      let links = await fixture.repository.getTransactionLinks();
      expect(await getUserVersion(fixture.db)).toBe(SCHEMA_VERSION);
      expect(await getColumnNames(fixture.db, 'transaction_links')).toEqual(
        expect.arrayContaining(['source_line_id', 'target_line_id']),
      );
      expect(links).toEqual([
        expect.objectContaining({
          id: 'link_1',
          sourceTransactionId: 'income_1',
          targetTransactionId: 'expense_1',
          sourceLineId: null,
          targetLineId: null,
        }),
      ]);

      await fixture.repository.addTransactionLink({
        sourceTransactionId: 'income_1',
        targetTransactionId: 'expense_2',
        linkType: 'refund',
        amountMinor: 2000,
        currencyCode: 'AUD',
      });

      links = await fixture.repository.getTransactionLinksForSourceTransaction('income_1');
      expect(links).toHaveLength(2);
      expect(links.map((link) => link.targetTransactionId)).toEqual(expect.arrayContaining(['expense_1', 'expense_2']));
    } finally {
      fixture.cleanup();
    }
  });
});
