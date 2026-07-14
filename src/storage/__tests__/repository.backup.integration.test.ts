import { buildRainproofBackup } from '../../domain/backupExport';
import {
  addAccount,
  addTransaction,
  getColumnNames,
  withInitializedRepository,
} from './repositoryTestUtils';
describe('backup restore storage', () => {
  it('replaces app-owned data atomically while preserving ids and amounts', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const account = await addAccount(repository, {
        name: 'Backup account',
        openingBalanceMinor: 12345,
      });
      await addTransaction(repository, {
        kind: 'expense',
        title: 'Backup expense',
        lines: [{
          accountId: account.id,
          amountMinor: -987,
          categoryId: 'food',
          subcategoryId: 'groceries',
        }],
      });
      await repository.addRecurringItem({
        name: 'Split plan',
        kind: 'expense',
        amountMinor: 3000,
        currencyCode: 'AUD',
        accountId: account.id,
        categoryId: 'food',
        subcategoryId: 'groceries',
        frequency: 'monthly',
        nextDueDate: '2026-07-01',
        splitLines: [
          { amountMinor: 1000, categoryId: 'food', subcategoryId: 'groceries', note: 'One' },
          { amountMinor: 2000, categoryId: 'food', subcategoryId: 'coffee', note: 'Two' },
        ],
      });
      const original = await repository.getSnapshot();
      const backup = buildRainproofBackup(original, '2026-06-10T10:00:00.000Z');

      await addAccount(repository, { name: 'Created after backup' });
      await repository.restoreBackup(backup);

      const restored = await repository.getSnapshot();
      expect(restored.accounts.map(({ id, name, openingBalanceMinor }) => ({ id, name, openingBalanceMinor }))).toEqual(
        original.accounts.map(({ id, name, openingBalanceMinor }) => ({ id, name, openingBalanceMinor })),
      );
      expect(restored.transactions).toEqual(original.transactions);
      expect(restored.transactionLines).toEqual(original.transactionLines);
      expect(restored.recurringItems[0].splitLines.map(({ amountMinor, note }) => ({ amountMinor, note }))).toEqual([
        { amountMinor: 1000, note: 'One' },
        { amountMinor: 2000, note: 'Two' },
      ]);
      expect(restored.accounts.some((item) => item.name === 'Created after backup')).toBe(false);
    });
  });

  it('rolls back the complete restore if any restored record is invalid', async () => {
    await withInitializedRepository(async ({ repository }) => {
      await addAccount(repository, { name: 'Current account' });
      const before = await repository.getSnapshot();
      const backup = buildRainproofBackup(before, '2026-06-10T10:00:00.000Z');
      backup.data.rainyDayFund.linkedAccountIds = ['missing-account'];

      await expect(repository.restoreBackup(backup)).rejects.toThrow();
      expect(await repository.getSnapshot()).toEqual(before);
    });
  });

  it('rolls back cleared data when a database write fails during restore', async () => {
    await withInitializedRepository(async ({ db, repository }) => {
      await addAccount(repository, { name: 'Backup account' });
      const backup = buildRainproofBackup(
        await repository.getSnapshot(),
        '2026-06-10T10:00:00.000Z',
      );
      await addAccount(repository, { name: 'Current account' });
      const before = await repository.getSnapshot();
      const originalRunAsync = db.runAsync.bind(db);
      db.runAsync = async (source: string, ...params: unknown[]) => {
        if (source.includes('INSERT INTO accounts')) {
          throw new Error('Simulated restore write failure.');
        }
        return originalRunAsync(source, ...params);
      };

      await expect(repository.restoreBackup(backup)).rejects.toThrow('Simulated restore write failure');
      db.runAsync = originalRunAsync;

      expect(await repository.getSnapshot()).toEqual(before);
    });
  });

  it('repairs old recurring item schema before restoring one-time upcoming payments', async () => {
    await withInitializedRepository(async ({ db, repository }) => {
      const account = await addAccount(repository, { name: 'Everyday' });
      await repository.addRecurringItem({
        name: 'One-time bill',
        kind: 'expense',
        amountMinor: 4500,
        currencyCode: 'AUD',
        accountId: account.id,
        categoryId: 'housing',
        subcategoryId: 'rent',
        frequency: 'one_time',
        nextDueDate: '2026-08-15',
      });
      const backup = buildRainproofBackup(await repository.getSnapshot(), '2026-06-10T10:00:00.000Z');

      await db.execAsync(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE recurring_items;
        CREATE TABLE recurring_items (
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
        PRAGMA foreign_keys = ON;
      `);
      expect(await getColumnNames(db, 'recurring_items')).not.toContain('completed_at');

      await repository.restoreBackup(backup);

      expect(await getColumnNames(db, 'recurring_items')).toEqual(expect.arrayContaining(['completed_at']));
      const restored = await repository.getSnapshot();
      expect(restored.recurringItems).toEqual([
        expect.objectContaining({
          name: 'One-time bill',
          frequency: 'one_time',
          completedAt: null,
        }),
      ]);
    });
  });
});

