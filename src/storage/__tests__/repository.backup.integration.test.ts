import { buildRainproofBackup } from '../../domain/backupExport';
import {
  addAccount,
  addTransaction,
  withInitializedRepository,
} from './repositoryTestUtils';
describe('encrypted backup restore storage', () => {
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
});

