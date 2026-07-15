import {
  getAccountBalances,
  getCashFlowSummary,
  getSpendingByCategory,
  getTransactionDisplayEntries,
} from '../../domain/aggregates';
import { getBudgetUsageFromStatsReport } from '../../domain/budgets';
import { buildCrossCurrencyTransferLines } from '../../domain/crossCurrencyTransfers';
import { getStatsReport } from '../../domain/statsReports';
import {
  addAccount,
  addTransaction,
  getBalanceByAccountId,
  getLineBySubcategory,
  getLineForTransaction,
  getLinesForTransaction,
  getStoredTransactionLineCount,
  getTransactionByTitle,
  withInitializedRepository,
} from './repositoryTestUtils';
describe('SQLite finance repository transactions and links', () => {
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

  it('rolls back the parent transaction if a line insert fails', async () => {
    await withInitializedRepository(async ({ db, repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday', openingBalanceMinor: 10000 });
      const originalRunAsync = db.runAsync.bind(db);
      let forcedLineFailure = false;

      db.runAsync = async (source: string, ...params: unknown[]) => {
        if (!forcedLineFailure && source.includes('INSERT INTO transaction_lines')) {
          forcedLineFailure = true;
          throw new Error('Forced transaction line insert failure.');
        }

        return originalRunAsync(source, ...params);
      };

      try {
        await expect(
          repository.addTransaction({
            kind: 'expense',
            title: 'Rollback candidate',
            datetime: '2026-05-18T12:00:00.000Z',
            lines: [
              {
                accountId: everyday.id,
                amountMinor: -2500,
                currencyCode: 'AUD',
                categoryId: 'food-dining',
                subcategoryId: 'groceries',
              },
            ],
          }),
        ).rejects.toThrow('Forced transaction line insert failure.');
      } finally {
        db.runAsync = originalRunAsync;
      }

      const snapshot = await repository.getSnapshot();
      expect(snapshot.transactions.some((transaction) => transaction.title === 'Rollback candidate')).toBe(false);
      expect(snapshot.transactionLines.some((line) => line.accountId === everyday.id && line.amountMinor === -2500)).toBe(false);
    });
  });

  it('persists prepared Add Transaction records exactly', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday', openingBalanceMinor: 10000 });
      const input = {
        kind: 'expense' as const,
        title: 'Prepared expense',
        datetime: '2026-05-18T12:00:00.000Z',
        notes: 'Prepared note',
        labels: ['prepared'],
        groupId: 'home',
        lines: [
          {
            accountId: everyday.id,
            amountMinor: -2500,
            currencyCode: 'AUD' as const,
            categoryId: 'food-dining',
            subcategoryId: 'groceries',
            note: 'Prepared line',
          },
        ],
      };
      const prepared = repository.prepareAddTransaction(input);

      const persisted = await repository.addTransaction(input, prepared);
      const snapshot = await repository.getSnapshot();

      expect(persisted).toEqual(prepared);
      expect(snapshot.transactions).toEqual(expect.arrayContaining([prepared.transaction]));
      expect(snapshot.transactionLines).toEqual(expect.arrayContaining(prepared.lines));
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

  it('persists prepared edit records used by optimistic transaction updates', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const splitExpense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Prepared split edit',
        lines: [
          { accountId: everyday.id, amountMinor: -2500, categoryId: 'food-dining', subcategoryId: 'groceries' },
          { accountId: everyday.id, amountMinor: -1500, categoryId: 'housing', subcategoryId: 'rent' },
        ],
      });

      const snapshot = await repository.getSnapshot();
      const existingTransaction = snapshot.transactions.find((transaction) => transaction.id === splitExpense.id)!;
      const existingLines = getLinesForTransaction(snapshot, splitExpense.id);
      const input = {
        id: splitExpense.id,
        kind: 'expense' as const,
        title: 'Prepared split edit updated',
        datetime: '2026-05-19T12:00:00.000Z',
        lines: [
          {
            id: existingLines[1].id,
            accountId: everyday.id,
            amountMinor: -4000,
            currencyCode: 'AUD',
            categoryId: 'housing',
            subcategoryId: 'rent',
          },
        ],
      };
      const preparedRecords = repository.prepareUpdateTransaction(input, existingTransaction, existingLines);

      const persistedRecords = await repository.updateTransaction(input, preparedRecords);
      const nextSnapshot = await repository.getSnapshot();

      expect(persistedRecords).toEqual(preparedRecords);
      expect(getLinesForTransaction(nextSnapshot, splitExpense.id)).toEqual([
        expect.objectContaining({ id: existingLines[1].id, amountMinor: -4000, categoryId: 'housing' }),
      ]);
      expect(nextSnapshot.transactions.find((transaction) => transaction.id === splitExpense.id)).toEqual(
        expect.objectContaining({
          title: 'Prepared split edit updated',
          updatedAt: preparedRecords.transaction.updatedAt,
        }),
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
        repository.addTransaction({
          kind: 'transfer',
          title: 'Mismatched same-currency transfer',
          datetime: '2026-05-18T12:00:00.000Z',
          lines: [
            { accountId: everyday.id, amountMinor: -5000, currencyCode: 'AUD', transferPeerAccountId: savings.id },
            { accountId: savings.id, amountMinor: 4000, currencyCode: 'AUD', transferPeerAccountId: everyday.id },
          ],
        }),
      ).rejects.toThrow('Same-currency transfer amounts must match.');
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

  it('persists cross-currency transfers as sent and received amounts without counting them in stats or budgets', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, {
        name: 'AUD Everyday',
        openingBalanceMinor: 100000,
        currencyCode: 'AUD',
      });
      const usd = await addAccount(repository, {
        name: 'USD Wallet',
        openingBalanceMinor: 20000,
        currencyCode: 'USD',
      });
      await repository.addBudget({
        name: 'Overall AUD',
        amountMinor: 50000,
        currencyCode: 'AUD',
        period: 'monthly',
        scopeType: 'overall',
      });

      await repository.addTransaction({
        kind: 'transfer',
        title: 'Move to USD',
        datetime: '2026-05-18T12:00:00.000Z',
        lines: buildCrossCurrencyTransferLines({
          accounts: [everyday, usd],
          sourceAccountId: everyday.id,
          targetAccountId: usd.id,
          sourceAmountMinor: 15000,
          targetAmountMinor: 9750,
        }),
      });

      const snapshot = await repository.getSnapshot();
      const transfer = getTransactionByTitle(snapshot, 'Move to USD');
      const lines = getLinesForTransaction(snapshot, transfer.id);
      const report = getStatsReport({
        reportKind: 'expense',
        transactions: snapshot.transactions,
        transactionLines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        accounts: snapshot.accounts,
        categories: snapshot.categories,
        range: { startIso: '2026-05-01T00:00:00.000Z', endIso: '2026-06-01T00:00:00.000Z' },
        currencyCode: 'AUD',
      });

      expect(lines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            accountId: everyday.id,
            amountMinor: -15000,
            currencyCode: 'AUD',
            categoryId: '',
            subcategoryId: '',
            transferPeerAccountId: usd.id,
          }),
          expect.objectContaining({
            accountId: usd.id,
            amountMinor: 9750,
            currencyCode: 'USD',
            categoryId: '',
            subcategoryId: '',
            transferPeerAccountId: everyday.id,
          }),
        ]),
      );
      expect(getAccountBalances(snapshot.accounts, snapshot.transactionLines)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ account: expect.objectContaining({ id: everyday.id }), balanceMinor: 85000 }),
          expect.objectContaining({ account: expect.objectContaining({ id: usd.id }), balanceMinor: 29750 }),
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
      expect(
        getCashFlowSummary({
          transactions: snapshot.transactions,
          lines: snapshot.transactionLines,
          range: { startIso: '2026-05-01T00:00:00.000Z', endIso: '2026-06-01T00:00:00.000Z' },
          currencyCode: 'USD',
        }),
      ).toEqual({ currencyCode: 'USD', incomeMinor: 0, expenseMinor: 0, netMinor: 0 });
      expect(report.totalNetAmountMinor).toBe(0);
      expect(getBudgetUsageFromStatsReport({ budgets: snapshot.budgets, report })[0]).toEqual(
        expect.objectContaining({ spentMinor: 0, matchingLineIds: [] }),
      );
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

  it('persists prepared transaction link records exactly', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const expense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Prepared link expense',
        lines: [{ accountId: everyday.id, amountMinor: -6000, categoryId: 'food-dining', subcategoryId: 'restaurants' }],
      });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'Prepared link income',
        lines: [{ accountId: everyday.id, amountMinor: 3000, categoryId: 'income', subcategoryId: 'reimbursement' }],
      });
      const addInput = {
        sourceTransactionId: income.id,
        targetTransactionId: expense.id,
        linkType: 'reimbursement' as const,
        amountMinor: 3000,
        currencyCode: 'AUD' as const,
      };
      const preparedAdd = repository.prepareAddTransactionLink(addInput, await repository.getSnapshot());

      const persistedAdd = await repository.addTransactionLink(addInput, preparedAdd);
      expect(persistedAdd).toEqual(preparedAdd);
      expect(await repository.getTransactionLinks()).toEqual([preparedAdd]);

      const updateInput = {
        id: preparedAdd.id,
        sourceTransactionId: income.id,
        targetTransactionId: expense.id,
        linkType: 'refund' as const,
        amountMinor: 2000,
        currencyCode: 'AUD' as const,
      };
      const preparedUpdate = repository.prepareUpdateTransactionLink(
        updateInput,
        preparedAdd,
        await repository.getSnapshot(),
      );

      const persistedUpdate = await repository.updateTransactionLink(updateInput, preparedUpdate);
      expect(persistedUpdate).toEqual(preparedUpdate);
      expect(await repository.getTransactionLinks()).toEqual([preparedUpdate]);
    });
  });

  it('validates parent-level transaction links with targeted reads', async () => {
    await withInitializedRepository(async ({ db, repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const expense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Targeted link expense',
        lines: [{ accountId: everyday.id, amountMinor: -6000, categoryId: 'food-dining', subcategoryId: 'restaurants' }],
      });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'Targeted link income',
        lines: [{ accountId: everyday.id, amountMinor: 3000, categoryId: 'income', subcategoryId: 'reimbursement' }],
      });
      const originalGetAllAsync = db.getAllAsync.bind(db);
      const broadReads: string[] = [];

      db.getAllAsync = async (source: string, ...params: unknown[]) => {
        const normalizedSource = source.replace(/\s+/g, ' ').trim();
        if (
          normalizedSource === 'SELECT * FROM transactions' ||
          normalizedSource === 'SELECT * FROM transaction_lines' ||
          normalizedSource === 'SELECT * FROM transaction_links'
        ) {
          broadReads.push(normalizedSource);
          throw new Error(`Unexpected broad validation read: ${normalizedSource}`);
        }

        return originalGetAllAsync(source, ...params);
      };

      try {
        await repository.addTransactionLink({
          sourceTransactionId: income.id,
          targetTransactionId: expense.id,
          linkType: 'reimbursement',
          amountMinor: 3000,
          currencyCode: 'AUD',
        });
      } finally {
        db.getAllAsync = originalGetAllAsync;
      }

      expect(broadReads).toEqual([]);
      expect(await repository.getTransactionLinks()).toHaveLength(1);
    });
  });

  it('keeps targeted transaction link validation behavior for invalid lines and duplicates', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const expense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Targeted validation expense',
        lines: [{ accountId: everyday.id, amountMinor: -6000, categoryId: 'food-dining', subcategoryId: 'restaurants' }],
      });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'Targeted validation income',
        lines: [{ accountId: everyday.id, amountMinor: 3000, categoryId: 'income', subcategoryId: 'reimbursement' }],
      });
      const otherIncome = await addTransaction(repository, {
        kind: 'income',
        title: 'Other income line',
        lines: [{ accountId: everyday.id, amountMinor: 1000, categoryId: 'income', subcategoryId: 'refund' }],
      });
      const snapshot = await repository.getSnapshot();
      const otherIncomeLine = getLineForTransaction(snapshot, otherIncome.id);

      await expect(
        repository.addTransactionLink({
          sourceTransactionId: income.id,
          sourceLineId: otherIncomeLine.id,
          targetTransactionId: expense.id,
          linkType: 'reimbursement',
          amountMinor: 1000,
          currencyCode: 'AUD',
        }),
      ).rejects.toThrow('Source transaction line does not belong to the source transaction.');

      await repository.addTransactionLink({
        sourceTransactionId: income.id,
        targetTransactionId: expense.id,
        linkType: 'reimbursement',
        amountMinor: 1000,
        currencyCode: 'AUD',
      });

      await expect(
        repository.addTransactionLink({
          sourceTransactionId: income.id,
          targetTransactionId: expense.id,
          linkType: 'reimbursement',
          amountMinor: 1000,
          currencyCode: 'AUD',
        }),
      ).rejects.toThrow('This transaction link already exists.');
    });
  });

  it('updates a transaction and removes all invalidated links atomically', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'Multi-link income edit',
        lines: [{ accountId: everyday.id, amountMinor: 7000, categoryId: 'income', subcategoryId: 'reimbursement' }],
      });
      const firstExpense = await addTransaction(repository, {
        kind: 'expense',
        title: 'First linked expense',
        lines: [{ accountId: everyday.id, amountMinor: -3000, categoryId: 'food-dining', subcategoryId: 'restaurants' }],
      });
      const secondExpense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Second linked expense',
        lines: [{ accountId: everyday.id, amountMinor: -4000, categoryId: 'food-dining', subcategoryId: 'groceries' }],
      });
      const firstLink = await repository.addTransactionLink({
        sourceTransactionId: income.id,
        targetTransactionId: firstExpense.id,
        linkType: 'reimbursement',
        amountMinor: 3000,
        currencyCode: 'AUD',
      });
      const secondLink = await repository.addTransactionLink({
        sourceTransactionId: income.id,
        targetTransactionId: secondExpense.id,
        linkType: 'reimbursement',
        amountMinor: 4000,
        currencyCode: 'AUD',
      });

      await repository.updateTransaction({
        id: income.id,
        kind: 'expense',
        title: 'Converted expense',
        datetime: income.datetime,
        lines: [{
          accountId: everyday.id,
          amountMinor: -7000,
          currencyCode: 'AUD',
          categoryId: 'food-dining',
          subcategoryId: 'restaurants',
        }],
      }, undefined, {
        transactionLinkDeleteIds: [secondLink.id, firstLink.id],
      });

      const snapshot = await repository.getSnapshot();
      expect(snapshot.transactions.find((transaction) => transaction.id === income.id)?.kind).toBe('expense');
      expect(snapshot.transactionLinks).toEqual([]);
    });
  });

  it('rolls back a transaction edit when link reconciliation is stale', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'Stale reconciliation income',
        lines: [{ accountId: everyday.id, amountMinor: 3000, categoryId: 'income', subcategoryId: 'reimbursement' }],
      });
      const expense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Stale reconciliation expense',
        lines: [{ accountId: everyday.id, amountMinor: -3000, categoryId: 'food-dining', subcategoryId: 'restaurants' }],
      });
      const existingLink = await repository.addTransactionLink({
        sourceTransactionId: income.id,
        targetTransactionId: expense.id,
        linkType: 'reimbursement',
        amountMinor: 3000,
        currencyCode: 'AUD',
      });

      await expect(repository.updateTransaction({
        id: income.id,
        kind: 'expense',
        title: 'Should not persist',
        datetime: income.datetime,
        lines: [{
          accountId: everyday.id,
          amountMinor: -3000,
          currencyCode: 'AUD',
          categoryId: 'food-dining',
          subcategoryId: 'restaurants',
        }],
      }, undefined, {
        transactionLinkDeleteIds: [existingLink.id, 'missing-link'],
      })).rejects.toThrow('Transaction link reconciliation is stale.');

      const snapshot = await repository.getSnapshot();
      expect(snapshot.transactions.find((transaction) => transaction.id === income.id)).toEqual(
        expect.objectContaining({ kind: 'income', title: 'Stale reconciliation income' }),
      );
      expect(snapshot.transactionLinks).toEqual([existingLink]);
    });
  });

  it('persists a transaction edit and accepted link batch in one transaction', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'Income before link edit',
        lines: [{ accountId: everyday.id, amountMinor: 3000, categoryId: 'income', subcategoryId: 'reimbursement' }],
      });
      const expense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Expense link target',
        lines: [{ accountId: everyday.id, amountMinor: -3000, categoryId: 'food-dining', subcategoryId: 'restaurants' }],
      });
      const before = await repository.getSnapshot();
      const incomeLine = getLineForTransaction(before, income.id);
      const updateInput = {
        id: income.id,
        kind: 'income' as const,
        title: 'Income after link edit',
        datetime: income.datetime,
        lines: [{
          id: incomeLine.id,
          accountId: incomeLine.accountId,
          amountMinor: incomeLine.amountMinor,
          currencyCode: incomeLine.currencyCode,
          categoryId: incomeLine.categoryId,
          subcategoryId: incomeLine.subcategoryId,
        }],
      };
      const transactionLinkBatch = {
        deleteIds: [],
        toUpdate: [],
        toAdd: [{
          sourceTransactionId: income.id,
          targetTransactionId: expense.id,
          linkType: 'reimbursement' as const,
          amountMinor: 3000,
          currencyCode: 'AUD' as const,
        }],
      };
      const preparedUpdate = repository.prepareUpdateTransaction(updateInput, income, [incomeLine]);
      const preparedLinks = repository.prepareTransactionLinkBatch(transactionLinkBatch, before);

      await repository.updateTransaction(updateInput, preparedUpdate, {
        transactionLinkBatch,
        transactionLinkRecords: preparedLinks,
      });

      const after = await repository.getSnapshot();
      expect(after.transactions.find((transaction) => transaction.id === income.id)?.title).toBe('Income after link edit');
      expect(after.transactionLinks).toEqual(preparedLinks.addedLinks);
    });
  });

  it('rolls back the transaction edit when its accepted link batch fails', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'Atomic edit original',
        lines: [{ accountId: everyday.id, amountMinor: 3000, categoryId: 'income', subcategoryId: 'reimbursement' }],
      });
      const expense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Atomic edit target',
        lines: [{ accountId: everyday.id, amountMinor: -3000, categoryId: 'food-dining', subcategoryId: 'restaurants' }],
      });
      const before = await repository.getSnapshot();
      const incomeLine = getLineForTransaction(before, income.id);
      const duplicateInput = {
        sourceTransactionId: income.id,
        targetTransactionId: expense.id,
        linkType: 'reimbursement' as const,
        amountMinor: 1000,
        currencyCode: 'AUD' as const,
      };

      await expect(repository.updateTransaction({
        id: income.id,
        kind: 'income',
        title: 'Must roll back',
        datetime: income.datetime,
        lines: [{
          id: incomeLine.id,
          accountId: incomeLine.accountId,
          amountMinor: incomeLine.amountMinor,
          currencyCode: incomeLine.currencyCode,
          categoryId: incomeLine.categoryId,
          subcategoryId: incomeLine.subcategoryId,
        }],
      }, undefined, {
        transactionLinkBatch: {
          deleteIds: [],
          toUpdate: [],
          toAdd: [duplicateInput, duplicateInput],
        },
      })).rejects.toThrow('This transaction link already exists.');

      const after = await repository.getSnapshot();
      expect(after.transactions.find((transaction) => transaction.id === income.id)?.title).toBe('Atomic edit original');
      expect(after.transactionLinks).toEqual([]);
    });
  });

  it('saves transaction link batches atomically for allocation add update and delete plans', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'Batch allocation income',
        lines: [{ accountId: everyday.id, amountMinor: 7000, categoryId: 'income', subcategoryId: 'reimbursement' }],
      });
      const firstExpense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Batch first expense',
        lines: [{ accountId: everyday.id, amountMinor: -3000, categoryId: 'food-dining', subcategoryId: 'restaurants' }],
      });
      const secondExpense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Batch second expense',
        lines: [{ accountId: everyday.id, amountMinor: -2000, categoryId: 'food-dining', subcategoryId: 'groceries' }],
      });
      const thirdExpense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Batch third expense',
        lines: [{ accountId: everyday.id, amountMinor: -2000, categoryId: 'transport', subcategoryId: 'fuel' }],
      });

      const updateLink = await repository.addTransactionLink({
        sourceTransactionId: income.id,
        targetTransactionId: firstExpense.id,
        linkType: 'reimbursement',
        amountMinor: 3000,
        currencyCode: 'AUD',
      });
      await repository.addTransactionLink({
        sourceTransactionId: income.id,
        targetTransactionId: secondExpense.id,
        linkType: 'refund',
        amountMinor: 2000,
        currencyCode: 'AUD',
      });
      const deleteLink = (await repository.getTransactionLinks()).find((link) => link.targetTransactionId === secondExpense.id)!;

      const batch = {
        deleteIds: [deleteLink.id],
        toUpdate: [{
          id: updateLink.id,
          sourceTransactionId: income.id,
          targetTransactionId: firstExpense.id,
          linkType: 'shared_expense_contribution' as const,
          amountMinor: 2500,
          currencyCode: 'AUD' as const,
        }],
        toAdd: [{
          sourceTransactionId: income.id,
          targetTransactionId: thirdExpense.id,
          linkType: 'reimbursement' as const,
          amountMinor: 2000,
          currencyCode: 'AUD' as const,
        }],
      };
      const prepared = repository.prepareTransactionLinkBatch(batch, await repository.getSnapshot());

      const persisted = await repository.saveTransactionLinkBatch(batch, prepared);
      const links = await repository.getTransactionLinks();

      expect(persisted).toEqual(prepared);
      expect(links).toEqual(expect.arrayContaining([
        prepared.updatedLinks[0],
        prepared.addedLinks[0],
      ]));
      expect(links.some((link) => link.id === deleteLink.id)).toBe(false);
    });
  });

  it('saves split-line transaction link batches', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'Batch split income',
        lines: [
          { accountId: everyday.id, amountMinor: 3000, categoryId: 'income', subcategoryId: 'reimbursement' },
          { accountId: everyday.id, amountMinor: 2000, categoryId: 'income', subcategoryId: 'refund' },
        ],
      });
      const expense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Batch split expense',
        lines: [
          { accountId: everyday.id, amountMinor: -3000, categoryId: 'food-dining', subcategoryId: 'restaurants' },
          { accountId: everyday.id, amountMinor: -2000, categoryId: 'food-dining', subcategoryId: 'groceries' },
        ],
      });
      const snapshot = await repository.getSnapshot();
      const incomeLine = getLineBySubcategory(snapshot, income.id, 'reimbursement');
      const expenseLine = getLineBySubcategory(snapshot, expense.id, 'restaurants');

      await repository.saveTransactionLinkBatch({
        deleteIds: [],
        toUpdate: [],
        toAdd: [{
          sourceTransactionId: income.id,
          sourceLineId: incomeLine.id,
          targetTransactionId: expense.id,
          targetLineId: expenseLine.id,
          linkType: 'reimbursement',
          amountMinor: 3000,
          currencyCode: 'AUD',
        }],
      });

      expect(await repository.getTransactionLinks()).toEqual([
        expect.objectContaining({
          sourceLineId: incomeLine.id,
          targetLineId: expenseLine.id,
        }),
      ]);
    });
  });

  it('rejects conflicting transaction link batches without partial deletes', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      const income = await addTransaction(repository, {
        kind: 'income',
        title: 'Rejected batch income',
        lines: [{ accountId: everyday.id, amountMinor: 3000, categoryId: 'income', subcategoryId: 'reimbursement' }],
      });
      const expense = await addTransaction(repository, {
        kind: 'expense',
        title: 'Rejected batch expense',
        lines: [{ accountId: everyday.id, amountMinor: -3000, categoryId: 'food-dining', subcategoryId: 'restaurants' }],
      });
      const existingLink = await repository.addTransactionLink({
        sourceTransactionId: income.id,
        targetTransactionId: expense.id,
        linkType: 'reimbursement',
        amountMinor: 1000,
        currencyCode: 'AUD',
      });

      await expect(
        repository.saveTransactionLinkBatch({
          deleteIds: [existingLink.id],
          toUpdate: [],
          toAdd: [
            {
              sourceTransactionId: income.id,
              targetTransactionId: expense.id,
              linkType: 'refund',
              amountMinor: 1000,
              currencyCode: 'AUD',
            },
            {
              sourceTransactionId: income.id,
              targetTransactionId: expense.id,
              linkType: 'refund',
              amountMinor: 1000,
              currencyCode: 'AUD',
            },
          ],
        }),
      ).rejects.toThrow('This transaction link already exists.');

      expect(await repository.getTransactionLinks()).toEqual([existingLink]);
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

});

