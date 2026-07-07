import {
  addAccount,
  addTransaction,
  getBalanceByAccountId,
  getExpenseStatsAndBudgetSpent,
  recurringExpenseInput,
  recurringUpdateInput,
  withInitializedRepository,
} from './repositoryTestUtils';
describe('SQLite finance repository recurring and templates', () => {
  it('persists recurring items without creating ledger activity', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });

      await repository.addRecurringItem({
        name: 'Salary',
        kind: 'income',
        amountMinor: 320000,
        currencyCode: 'AUD',
        accountId: everyday.id,
        categoryId: 'income',
        subcategoryId: 'salary',
        note: 'Base pay',
        frequency: 'fortnightly',
        nextDueDate: '2026-05-29',
      });

      let snapshot = await repository.getSnapshot();
      const item = snapshot.recurringItems[0];
      expect(item).toEqual(
        expect.objectContaining({
          name: 'Salary',
          kind: 'income',
          amountMinor: 320000,
          currencyCode: 'AUD',
          accountId: everyday.id,
          categoryId: 'income',
          subcategoryId: 'salary',
          note: 'Base pay',
          frequency: 'fortnightly',
          nextDueDate: '2026-05-29',
          completedAt: null,
          isActive: true,
        }),
      );
      expect(snapshot.recurringBills).toEqual(snapshot.recurringItems);
      expect(snapshot.transactions).toEqual([]);
      expect(snapshot.transactionLines).toEqual([]);
      expect(getBalanceByAccountId(snapshot)).toEqual({ [everyday.id]: 0 });

      await repository.updateRecurringItem({
        id: item.id,
        name: 'Salary updated',
        kind: 'income',
        amountMinor: 330000,
        currencyCode: 'AUD',
        accountId: everyday.id,
        categoryId: 'income',
        subcategoryId: 'wages',
        note: 'Updated pay',
        frequency: 'monthly',
        nextDueDate: '2026-06-15',
      });

      snapshot = await repository.getSnapshot();
      expect(snapshot.recurringItems.find((candidate) => candidate.id === item.id)).toEqual(
        expect.objectContaining({
          name: 'Salary updated',
          amountMinor: 330000,
          subcategoryId: 'wages',
          frequency: 'monthly',
          nextDueDate: '2026-06-15',
          completedAt: null,
          isActive: true,
        }),
      );

      await repository.archiveRecurringItem(item.id);
      snapshot = await repository.getSnapshot();
      expect(snapshot.recurringItems.find((candidate) => candidate.id === item.id)?.isActive).toBe(false);

      await repository.deleteRecurringItem(item.id);
      expect((await repository.getSnapshot()).recurringItems).toEqual([]);
    });
  });

  it('persists and replaces split expense upcoming payment lines without creating ledger activity', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });

      await repository.addRecurringItem({
        name: 'Quarterly rates',
        kind: 'expense',
        amountMinor: 12000,
        currencyCode: 'AUD',
        accountId: everyday.id,
        categoryId: 'housing',
        subcategoryId: 'rent',
        frequency: 'monthly',
        nextDueDate: '2026-05-29',
        splitLines: [
          { amountMinor: 7000, categoryId: 'housing', subcategoryId: 'rent', note: 'Council' },
          { amountMinor: 5000, categoryId: 'food', subcategoryId: 'groceries', note: 'Water' },
        ],
      });

      let snapshot = await repository.getSnapshot();
      const item = snapshot.recurringItems[0];
      expect(item.splitLines.map(({ amountMinor, categoryId, subcategoryId, note, sortOrder }) => ({
        amountMinor,
        categoryId,
        subcategoryId,
        note,
        sortOrder,
      }))).toEqual([
        { amountMinor: 7000, categoryId: 'housing', subcategoryId: 'rent', note: 'Council', sortOrder: 0 },
        { amountMinor: 5000, categoryId: 'food', subcategoryId: 'groceries', note: 'Water', sortOrder: 1 },
      ]);
      expect(snapshot.transactions).toEqual([]);
      expect(snapshot.transactionLines).toEqual([]);
      expect(getBalanceByAccountId(snapshot)).toEqual({ [everyday.id]: 0 });

      await repository.updateRecurringItem({
        id: item.id,
        name: item.name,
        kind: 'expense',
        amountMinor: 12000,
        currencyCode: 'AUD',
        accountId: everyday.id,
        categoryId: 'housing',
        subcategoryId: 'rent',
        frequency: 'monthly',
        nextDueDate: '2026-06-29',
        completedAt: null,
        splitLines: [
          { amountMinor: 8000, categoryId: 'housing', subcategoryId: 'rent', note: 'Rates' },
          { amountMinor: 4000, categoryId: 'food', subcategoryId: 'groceries', note: 'Water' },
        ],
      });

      snapshot = await repository.getSnapshot();
      expect(snapshot.recurringItems[0].splitLines.map(({ amountMinor, note }) => ({ amountMinor, note }))).toEqual([
        { amountMinor: 8000, note: 'Rates' },
        { amountMinor: 4000, note: 'Water' },
      ]);
      expect(snapshot.transactions).toEqual([]);
    });
  });

  it('creates a split transaction from a split upcoming payment and advances only the plan', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      await repository.addRecurringItem({
        name: 'Rates',
        kind: 'expense',
        amountMinor: 12000,
        currencyCode: 'AUD',
        accountId: everyday.id,
        categoryId: 'housing',
        subcategoryId: 'rent',
        frequency: 'monthly',
        nextDueDate: '2026-05-10',
        splitLines: [
          { amountMinor: 7000, categoryId: 'housing', subcategoryId: 'rent', note: 'Council' },
          { amountMinor: 5000, categoryId: 'food', subcategoryId: 'groceries', note: 'Water' },
        ],
      });
      let snapshot = await repository.getSnapshot();
      const upcomingPayment = snapshot.recurringItems[0];
      const transactionInput = {
        kind: 'expense' as const,
        title: 'Rates',
        datetime: '2026-05-10T12:00:00.000Z',
        lines: [
          {
            accountId: everyday.id,
            amountMinor: -7000,
            currencyCode: 'AUD',
            categoryId: 'housing',
            subcategoryId: 'rent',
            note: 'Council',
          },
          {
            accountId: everyday.id,
            amountMinor: -5000,
            currencyCode: 'AUD',
            categoryId: 'food',
            subcategoryId: 'groceries',
            note: 'Water',
          },
        ],
      };
      const preparedRecords = repository.prepareAddTransaction(transactionInput);

      await repository.createUpcomingPaymentTransaction({
        recurringItemId: upcomingPayment.id,
        previousNextDueDate: upcomingPayment.nextDueDate,
        transactionInput,
        recurringItemInput: recurringUpdateInput(upcomingPayment, '2026-06-10'),
      }, preparedRecords);

      snapshot = await repository.getSnapshot();
      expect(snapshot.transactions.map((transaction) => transaction.title)).toEqual(['Rates']);
      expect(snapshot.transactions[0].id).toBe(preparedRecords.transaction.id);
      expect(snapshot.transactionLines.map((line) => line.id)).toEqual(preparedRecords.lines.map((line) => line.id));
      expect(snapshot.transactionLines.map(({ amountMinor, note }) => ({ amountMinor, note }))).toEqual([
        { amountMinor: -7000, note: 'Council' },
        { amountMinor: -5000, note: 'Water' },
      ]);
      expect(snapshot.recurringItems[0]).toEqual(expect.objectContaining({
        nextDueDate: '2026-06-10',
        completedAt: null,
      }));
      expect(snapshot.recurringItems[0].splitLines).toHaveLength(2);
      expect(getBalanceByAccountId(snapshot)[everyday.id]).toBe(-12000);
    });
  });

  it('creates a normal transaction from a one-time upcoming payment and completes only the plan', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      await repository.addRecurringItem({
        name: 'Vet bill',
        kind: 'expense',
        amountMinor: 10000,
        currencyCode: 'AUD',
        accountId: everyday.id,
        categoryId: 'housing',
        subcategoryId: 'rent',
        frequency: 'one_time',
        nextDueDate: '2026-05-10',
      });
      let snapshot = await repository.getSnapshot();
      const upcomingPayment = snapshot.recurringItems[0];
      expect(upcomingPayment.completedAt).toBeNull();
      expect(snapshot.transactions).toEqual([]);

      await repository.createUpcomingPaymentTransaction({
        recurringItemId: upcomingPayment.id,
        previousNextDueDate: upcomingPayment.nextDueDate,
        transactionInput: recurringExpenseInput(everyday.id, 'Vet bill', '2026-05-10'),
        recurringItemInput: {
          ...recurringUpdateInput(upcomingPayment, upcomingPayment.nextDueDate),
          completedAt: '2026-05-10T09:00:00.000Z',
        },
      });

      snapshot = await repository.getSnapshot();
      expect(snapshot.transactions.map((transaction) => transaction.title)).toEqual(['Vet bill']);
      expect(snapshot.recurringItems[0]).toEqual(
        expect.objectContaining({
          frequency: 'one_time',
          nextDueDate: '2026-05-10',
          completedAt: '2026-05-10T09:00:00.000Z',
        }),
      );
      expect(snapshot.recurringTransactionHistory).toEqual([]);
      expect(getBalanceByAccountId(snapshot)[everyday.id]).toBe(-10000);
    });
  });

  it('creates a normal transaction from a recurring upcoming payment and advances only the plan', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      await repository.addRecurringItem({
        name: 'Rent',
        kind: 'expense',
        amountMinor: 10000,
        currencyCode: 'AUD',
        accountId: everyday.id,
        categoryId: 'housing',
        subcategoryId: 'rent',
        frequency: 'monthly',
        nextDueDate: '2026-05-01',
      });
      let snapshot = await repository.getSnapshot();
      const upcomingPayment = snapshot.recurringItems[0];

      await repository.createUpcomingPaymentTransaction({
        recurringItemId: upcomingPayment.id,
        previousNextDueDate: upcomingPayment.nextDueDate,
        transactionInput: recurringExpenseInput(everyday.id, 'Rent May', '2026-05-01'),
        recurringItemInput: recurringUpdateInput(upcomingPayment, '2026-06-01'),
      });

      snapshot = await repository.getSnapshot();
      expect(snapshot.transactions.map((transaction) => transaction.title)).toEqual(['Rent May']);
      expect(snapshot.recurringItems[0]).toEqual(
        expect.objectContaining({
          frequency: 'monthly',
          nextDueDate: '2026-06-01',
          completedAt: null,
        }),
      );
      expect(snapshot.recurringTransactionHistory).toEqual([]);
      expect(getBalanceByAccountId(snapshot)[everyday.id]).toBe(-10000);
    });
  });

  it('undoes recurring-generated transactions newest-to-oldest without touching manual transactions', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      await repository.addRecurringItem({
        name: 'Rent',
        kind: 'expense',
        amountMinor: 10000,
        currencyCode: 'AUD',
        accountId: everyday.id,
        categoryId: 'housing',
        subcategoryId: 'rent',
        frequency: 'monthly',
        nextDueDate: '2026-05-01',
      });
      await repository.addBudget({
        name: 'Overall',
        amountMinor: 50000,
        currencyCode: 'AUD',
        period: 'monthly',
        scopeType: 'overall',
      });
      let snapshot = await repository.getSnapshot();
      const recurringItem = snapshot.recurringItems[0];

      await repository.createRecurringTransaction({
        recurringItemId: recurringItem.id,
        previousNextDueDate: '2026-05-01',
        transactionInput: recurringExpenseInput(everyday.id, 'Rent May', '2026-05-01'),
        recurringItemInput: recurringUpdateInput(recurringItem, '2026-06-01'),
      });
      await repository.createRecurringTransaction({
        recurringItemId: recurringItem.id,
        previousNextDueDate: '2026-06-01',
        transactionInput: recurringExpenseInput(everyday.id, 'Rent June', '2026-06-01'),
        recurringItemInput: recurringUpdateInput(recurringItem, '2026-07-01'),
      });
      await addTransaction(repository, {
        kind: 'expense',
        title: 'Manual coffee',
        lines: [{
          accountId: everyday.id,
          amountMinor: -500,
          categoryId: 'food',
          subcategoryId: 'coffee',
        }],
      });

      snapshot = await repository.getSnapshot();
      expect(snapshot.recurringItems[0].nextDueDate).toBe('2026-07-01');
      expect(snapshot.recurringTransactionHistory?.map((entry) => entry.sequence)).toEqual([2, 1]);
      expect(getBalanceByAccountId(snapshot)[everyday.id]).toBe(-20500);
      expect(getExpenseStatsAndBudgetSpent(snapshot)).toEqual({ stats: 20500, budget: 20500 });

      expect(await repository.undoLatestRecurringTransaction(recurringItem.id)).toBe(true);
      snapshot = await repository.getSnapshot();
      expect(snapshot.transactions.map((transaction) => transaction.title)).toEqual(
        expect.arrayContaining(['Rent May', 'Manual coffee']),
      );
      expect(snapshot.transactions.some((transaction) => transaction.title === 'Rent June')).toBe(false);
      expect(snapshot.recurringItems[0].nextDueDate).toBe('2026-06-01');
      expect(snapshot.recurringTransactionHistory).toHaveLength(1);
      expect(getBalanceByAccountId(snapshot)[everyday.id]).toBe(-10500);
      expect(getExpenseStatsAndBudgetSpent(snapshot)).toEqual({ stats: 10500, budget: 10500 });

      expect(await repository.undoLatestRecurringTransaction(recurringItem.id)).toBe(true);
      snapshot = await repository.getSnapshot();
      expect(snapshot.transactions.map((transaction) => transaction.title)).toEqual(['Manual coffee']);
      expect(snapshot.recurringItems[0].nextDueDate).toBe('2026-05-01');
      expect(snapshot.recurringTransactionHistory).toEqual([]);
      expect(getBalanceByAccountId(snapshot)[everyday.id]).toBe(-500);
      expect(getExpenseStatsAndBudgetSpent(snapshot)).toEqual({ stats: 500, budget: 500 });
      expect(await repository.undoLatestRecurringTransaction(recurringItem.id)).toBe(false);
    });
  });

  it('restores the prior due date when an undoable generated transaction is already missing', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      await repository.addRecurringItem({
        name: 'Salary',
        kind: 'income',
        amountMinor: 10000,
        currencyCode: 'AUD',
        accountId: everyday.id,
        categoryId: 'income',
        subcategoryId: 'salary',
        frequency: 'monthly',
        nextDueDate: '2026-05-15',
      });
      let snapshot = await repository.getSnapshot();
      const recurringItem = snapshot.recurringItems[0];

      await repository.createRecurringTransaction({
        recurringItemId: recurringItem.id,
        previousNextDueDate: '2026-05-15',
        transactionInput: {
          kind: 'income',
          title: 'Salary May',
          datetime: '2026-05-15T12:00:00.000Z',
          lines: [{
            accountId: everyday.id,
            amountMinor: 10000,
            currencyCode: 'AUD',
            categoryId: 'income',
            subcategoryId: 'salary',
          }],
        },
        recurringItemInput: {
          ...recurringUpdateInput(recurringItem, '2026-06-15'),
          kind: 'income',
          categoryId: 'income',
          subcategoryId: 'salary',
        },
      });

      snapshot = await repository.getSnapshot();
      const generatedTransactionId = snapshot.recurringTransactionHistory?.[0].transactionId;
      expect(generatedTransactionId).toBeTruthy();
      await repository.deleteTransaction(generatedTransactionId!);

      expect(await repository.undoLatestRecurringTransaction(recurringItem.id)).toBe(true);
      snapshot = await repository.getSnapshot();
      expect(snapshot.recurringItems[0].nextDueDate).toBe('2026-05-15');
      expect(snapshot.recurringTransactionHistory).toEqual([]);
      expect(snapshot.transactions).toEqual([]);
    });
  });

  it('does not undo a generated transaction after the recurring due date is manually changed', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });
      await repository.addRecurringItem({
        name: 'Rent',
        kind: 'expense',
        amountMinor: 10000,
        currencyCode: 'AUD',
        accountId: everyday.id,
        categoryId: 'housing',
        subcategoryId: 'rent',
        frequency: 'monthly',
        nextDueDate: '2026-05-01',
      });
      let snapshot = await repository.getSnapshot();
      const recurringItem = snapshot.recurringItems[0];

      await repository.createRecurringTransaction({
        recurringItemId: recurringItem.id,
        previousNextDueDate: '2026-05-01',
        transactionInput: recurringExpenseInput(everyday.id, 'Rent May', '2026-05-01'),
        recurringItemInput: recurringUpdateInput(recurringItem, '2026-06-01'),
      });
      await repository.updateRecurringItem(recurringUpdateInput(recurringItem, '2026-06-15'));

      await expect(repository.undoLatestRecurringTransaction(recurringItem.id)).rejects.toThrow(
        "Undo unavailable because this recurring item's due date was changed after the transaction was created.",
      );

      snapshot = await repository.getSnapshot();
      expect(snapshot.recurringItems[0].nextDueDate).toBe('2026-06-15');
      expect(snapshot.transactions.map((transaction) => transaction.title)).toContain('Rent May');
      expect(snapshot.recurringTransactionHistory).toHaveLength(1);
      expect(getBalanceByAccountId(snapshot)[everyday.id]).toBe(-10000);
    });
  });

  it('persists transaction templates without creating ledger activity', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });

      await repository.addTransactionTemplate({
        name: 'Coffee quick add',
        kind: 'expense',
        title: 'Coffee',
        accountId: everyday.id,
        amountMinor: 650,
        currencyCode: 'USD',
        categoryId: 'food-dining',
        subcategoryId: 'coffee',
        notes: 'Takeaway',
      });

      let snapshot = await repository.getSnapshot();
      const template = snapshot.transactionTemplates[0];
      expect(template).toEqual(
        expect.objectContaining({
          name: 'Coffee quick add',
          kind: 'expense',
          title: 'Coffee',
          accountId: everyday.id,
          amountMinor: 650,
          currencyCode: 'AUD',
          categoryId: 'food-dining',
          subcategoryId: 'coffee',
          notes: 'Takeaway',
          isActive: true,
        }),
      );
      expect(snapshot.transactions).toEqual([]);
      expect(snapshot.transactionLines).toEqual([]);
      expect(getBalanceByAccountId(snapshot)).toEqual({ [everyday.id]: 0 });

      await repository.updateTransactionTemplate({
        id: template.id,
        name: 'Coffee updated',
        kind: 'expense',
        title: 'Flat white',
        accountId: everyday.id,
        amountMinor: null,
        currencyCode: 'AUD',
        categoryId: null,
        subcategoryId: null,
        notes: 'Choose category later',
      });

      snapshot = await repository.getSnapshot();
      expect(snapshot.transactionTemplates.find((candidate) => candidate.id === template.id)).toEqual(
        expect.objectContaining({
          name: 'Coffee updated',
          title: 'Flat white',
          amountMinor: null,
          categoryId: null,
          subcategoryId: null,
          isActive: true,
        }),
      );

      await repository.archiveTransactionTemplate(template.id);
      snapshot = await repository.getSnapshot();
      expect(snapshot.transactionTemplates.find((candidate) => candidate.id === template.id)?.isActive).toBe(false);

      await repository.deleteTransactionTemplate(template.id);
      expect((await repository.getSnapshot()).transactionTemplates).toEqual([]);
    });
  });

  it('persists split transaction templates without creating ledger activity', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });

      await repository.addTransactionTemplate({
        name: 'Split groceries',
        kind: 'expense',
        title: 'Groceries',
        accountId: everyday.id,
        amountMinor: 3000,
        currencyCode: 'AUD',
        categoryId: null,
        subcategoryId: null,
        notes: '',
        splitLines: [
          { amountMinor: 1000, categoryId: 'food-dining', subcategoryId: 'groceries', note: '' },
          { amountMinor: 2000, categoryId: 'housing', subcategoryId: 'rent', note: 'Rent' },
        ],
      });

      let snapshot = await repository.getSnapshot();
      const template = snapshot.transactionTemplates[0];
      expect(template).toEqual(
        expect.objectContaining({
          name: 'Split groceries',
          kind: 'expense',
          amountMinor: 3000,
          categoryId: 'food-dining',
          subcategoryId: 'groceries',
          splitLines: [
            expect.objectContaining({
              amountMinor: 1000,
              categoryId: 'food-dining',
              subcategoryId: 'groceries',
              note: '',
              sortOrder: 0,
            }),
            expect.objectContaining({
              amountMinor: 2000,
              categoryId: 'housing',
              subcategoryId: 'rent',
              note: 'Rent',
              sortOrder: 1,
            }),
          ],
        }),
      );
      expect(snapshot.transactions).toEqual([]);
      expect(snapshot.transactionLines).toEqual([]);
      expect(getBalanceByAccountId(snapshot)).toEqual({ [everyday.id]: 0 });

      await repository.updateTransactionTemplate({
        id: template.id,
        name: 'Split pay',
        kind: 'income',
        title: 'Pay',
        accountId: everyday.id,
        amountMinor: 3000,
        currencyCode: 'AUD',
        categoryId: 'income',
        subcategoryId: 'salary',
        notes: '',
        splitLines: [
          { amountMinor: 2000, categoryId: 'income', subcategoryId: 'salary', note: '' },
          { amountMinor: 1000, categoryId: 'income', subcategoryId: 'bonus', note: 'Bonus' },
        ],
      });

      snapshot = await repository.getSnapshot();
      expect(snapshot.transactionTemplates.find((candidate) => candidate.id === template.id)).toEqual(
        expect.objectContaining({
          name: 'Split pay',
          kind: 'income',
          amountMinor: 3000,
          splitLines: [
            expect.objectContaining({ amountMinor: 2000, categoryId: 'income', subcategoryId: 'salary', note: '' }),
            expect.objectContaining({ amountMinor: 1000, categoryId: 'income', subcategoryId: 'bonus', note: 'Bonus' }),
          ],
        }),
      );
      expect(snapshot.transactions).toEqual([]);
      expect(snapshot.transactionLines).toEqual([]);
      expect(getBalanceByAccountId(snapshot)).toEqual({ [everyday.id]: 0 });
    });
  });

  it('persists and updates mixed split templates without creating ledger activity', async () => {
    await withInitializedRepository(async ({ repository }) => {
      const everyday = await addAccount(repository, { name: 'Everyday' });

      await repository.addTransactionTemplate({
        name: 'Net pay',
        kind: 'income',
        splitMode: 'mixed',
        title: 'Salary',
        accountId: everyday.id,
        amountMinor: 170000,
        currencyCode: 'AUD',
        categoryId: 'income',
        subcategoryId: 'salary',
        notes: '',
        splitLines: [
          {
            kind: 'income',
            amountMinor: 230000,
            categoryId: 'income',
            subcategoryId: 'salary',
            note: 'Salary',
          },
          {
            kind: 'expense',
            amountMinor: 60000,
            categoryId: 'tax',
            subcategoryId: 'withholding',
            note: 'Tax',
          },
        ],
      });

      let snapshot = await repository.getSnapshot();
      const template = snapshot.transactionTemplates[0];
      expect(template).toEqual(expect.objectContaining({
        name: 'Net pay',
        kind: 'income',
        amountMinor: 170000,
        splitLines: [
          expect.objectContaining({ kind: 'income', amountMinor: 230000, note: 'Salary' }),
          expect.objectContaining({ kind: 'expense', amountMinor: 60000, note: 'Tax' }),
        ],
      }));
      expect(snapshot.transactions).toEqual([]);
      expect(snapshot.transactionLines).toEqual([]);
      expect(getBalanceByAccountId(snapshot)).toEqual({ [everyday.id]: 0 });

      await repository.updateTransactionTemplate({
        id: template.id,
        name: 'Net expense',
        kind: 'expense',
        splitMode: 'mixed',
        title: 'Purchase',
        accountId: everyday.id,
        amountMinor: 30000,
        currencyCode: 'AUD',
        categoryId: 'food-dining',
        subcategoryId: 'groceries',
        notes: '',
        splitLines: [
          {
            kind: 'income',
            amountMinor: 20000,
            categoryId: 'income',
            subcategoryId: 'refund',
            note: 'Refund',
          },
          {
            kind: 'expense',
            amountMinor: 50000,
            categoryId: 'food-dining',
            subcategoryId: 'groceries',
            note: 'Purchase',
          },
        ],
      });

      snapshot = await repository.getSnapshot();
      expect(snapshot.transactionTemplates[0]).toEqual(expect.objectContaining({
        name: 'Net expense',
        kind: 'expense',
        amountMinor: 30000,
        splitLines: [
          expect.objectContaining({ kind: 'income', amountMinor: 20000, note: 'Refund' }),
          expect.objectContaining({ kind: 'expense', amountMinor: 50000, note: 'Purchase' }),
        ],
      }));
      expect(snapshot.transactions).toEqual([]);
      expect(snapshot.transactionLines).toEqual([]);
      expect(getBalanceByAccountId(snapshot)).toEqual({ [everyday.id]: 0 });
    });
  });

});

