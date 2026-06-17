import { withInitializedRepository } from './repositoryTestUtils';
describe('SQLite finance repository budgets', () => {
  it('persists monthly budgets and prevents duplicate active scopes', async () => {
    await withInitializedRepository(async ({ repository }) => {
      await repository.addBudget({
        name: 'Overall monthly',
        amountMinor: 150000,
        currencyCode: 'AUD',
        scopeType: 'overall',
      });
      await repository.addBudget({
        name: 'Groceries',
        amountMinor: 50000,
        currencyCode: 'AUD',
        scopeType: 'subcategory',
        categoryId: 'food',
        subcategoryId: 'groceries',
      });

      let budgets = (await repository.getSnapshot()).budgets;
      const overall = budgets.find((budget) => budget.scopeType === 'overall');
      const groceries = budgets.find(
        (budget) => budget.scopeType === 'include' && budget.scopeItems.some((item) => item.subcategoryId === 'groceries'),
      );

      expect(overall).toEqual(
        expect.objectContaining({
          name: 'Overall monthly',
          amountMinor: 150000,
          currencyCode: 'AUD',
          period: 'monthly',
          scopeType: 'overall',
          categoryId: null,
          subcategoryId: null,
          sortOrder: 0,
          isActive: true,
        }),
      );
      expect(groceries).toEqual(
        expect.objectContaining({
          name: 'Groceries',
          amountMinor: 50000,
          scopeType: 'include',
          categoryId: 'food',
          subcategoryId: 'groceries',
          scopeItems: [{ categoryId: 'food', subcategoryId: 'groceries' }],
          sortOrder: 1,
          isActive: true,
        }),
      );

      await expect(
        repository.addBudget({
          name: 'Duplicate overall',
          amountMinor: 200000,
          currencyCode: 'AUD',
          scopeType: 'overall',
        }),
      ).rejects.toThrow('An active budget already exists for this scope.');

      await repository.updateBudget({
        id: overall!.id,
        name: 'Overall monthly updated',
        amountMinor: 175000,
        currencyCode: 'AUD',
        scopeType: 'overall',
      });
      await repository.archiveBudget(groceries!.id);

      budgets = (await repository.getSnapshot()).budgets;
      expect(budgets.find((budget) => budget.id === overall!.id)).toEqual(
        expect.objectContaining({
          name: 'Overall monthly updated',
          amountMinor: 175000,
          isActive: true,
        }),
      );
      expect(budgets.find((budget) => budget.id === groceries!.id)?.isActive).toBe(false);

      await repository.addBudget({
        name: 'Groceries replacement',
        amountMinor: 60000,
        currencyCode: 'AUD',
        scopeType: 'subcategory',
        categoryId: 'food',
        subcategoryId: 'groceries',
      });
      expect((await repository.getSnapshot()).budgets.filter((budget) => budget.isActive)).toHaveLength(2);
    });
  });

  it('persists and updates calendar and rolling budget periods', async () => {
    await withInitializedRepository(async ({ repository }) => {
      await repository.addBudget({
        name: 'Weekly spending',
        amountMinor: 25000,
        currencyCode: 'AUD',
        period: 'weekly',
        scopeType: 'overall',
      });
      await repository.addBudget({
        name: 'Yearly spending',
        amountMinor: 300000,
        currencyCode: 'AUD',
        period: 'yearly',
        scopeType: 'overall',
      });
      await repository.addBudget({
        name: 'Rolling week',
        amountMinor: 30000,
        currencyCode: 'AUD',
        period: 'rolling_7',
        scopeType: 'overall',
      });
      await repository.addBudget({
        name: 'Rolling month',
        amountMinor: 100000,
        currencyCode: 'AUD',
        period: 'rolling_30',
        scopeType: 'overall',
      });
      await repository.addBudget({
        name: 'Rolling year',
        amountMinor: 1200000,
        currencyCode: 'AUD',
        period: 'rolling_365',
        scopeType: 'overall',
      });

      let budgets = (await repository.getSnapshot()).budgets;
      expect(budgets.map((budget) => budget.period)).toEqual([
        'weekly',
        'yearly',
        'rolling_7',
        'rolling_30',
        'rolling_365',
      ]);

      const weekly = budgets.find((budget) => budget.period === 'weekly')!;
      await repository.updateBudget({
        id: weekly.id,
        name: 'Monthly spending',
        amountMinor: 100000,
        currencyCode: 'AUD',
        period: 'monthly',
        scopeType: 'overall',
      });

      budgets = (await repository.getSnapshot()).budgets;
      expect(budgets.find((budget) => budget.id === weekly.id)).toEqual(
        expect.objectContaining({
          name: 'Monthly spending',
          amountMinor: 100000,
          period: 'monthly',
          sortOrder: 0,
        }),
      );
      expect(budgets.find((budget) => budget.period === 'yearly')?.sortOrder).toBe(1);
      expect(budgets.find((budget) => budget.period === 'rolling_7')?.sortOrder).toBe(2);
      expect(budgets.find((budget) => budget.period === 'rolling_30')?.sortOrder).toBe(3);
      expect(budgets.find((budget) => budget.period === 'rolling_365')?.sortOrder).toBe(4);
    });
  });

  it('persists multi-category budget scopes', async () => {
    await withInitializedRepository(async ({ repository }) => {
      await repository.addBudget({
        name: 'Food and fuel',
        amountMinor: 90000,
        currencyCode: 'AUD',
        scopeType: 'include',
        scopeItems: [
          { categoryId: 'food', subcategoryId: null },
          { categoryId: 'transport', subcategoryId: 'fuel' },
        ],
      });

      let budget = (await repository.getSnapshot()).budgets[0];
      expect(budget).toEqual(
        expect.objectContaining({
          name: 'Food and fuel',
          scopeType: 'include',
          categoryId: 'food',
          subcategoryId: null,
          scopeItems: [
            { categoryId: 'food', subcategoryId: null },
            { categoryId: 'transport', subcategoryId: 'fuel' },
          ],
        }),
      );

      await repository.updateBudget({
        id: budget.id,
        name: 'Everything but food',
        amountMinor: 120000,
        currencyCode: 'AUD',
        scopeType: 'exclude',
        scopeItems: [{ categoryId: 'food', subcategoryId: null }],
      });

      budget = (await repository.getSnapshot()).budgets[0];
      expect(budget).toEqual(
        expect.objectContaining({
          name: 'Everything but food',
          scopeType: 'exclude',
          categoryId: 'food',
          subcategoryId: null,
          scopeItems: [{ categoryId: 'food', subcategoryId: null }],
        }),
      );
    });
  });

  it('persists manual budget order and appends new budgets after the current order', async () => {
    await withInitializedRepository(async ({ repository }) => {
      await repository.addBudget({
        name: 'Overall',
        amountMinor: 150000,
        currencyCode: 'AUD',
        scopeType: 'overall',
      });
      await repository.addBudget({
        name: 'Food',
        amountMinor: 50000,
        currencyCode: 'AUD',
        scopeType: 'category',
        categoryId: 'food',
      });
      await repository.addBudget({
        name: 'Rent',
        amountMinor: 90000,
        currencyCode: 'AUD',
        scopeType: 'subcategory',
        categoryId: 'housing',
        subcategoryId: 'rent',
      });

      let budgets = (await repository.getSnapshot()).budgets.filter((budget) => budget.isActive);
      expect(budgets.map((budget) => budget.name)).toEqual(['Overall', 'Food', 'Rent']);
      expect(budgets.map((budget) => budget.sortOrder)).toEqual([0, 1, 2]);

      const [overall, food, rent] = budgets;
      await repository.updateBudgetOrder([rent.id, overall.id, food.id]);

      budgets = (await repository.getSnapshot()).budgets.filter((budget) => budget.isActive);
      expect(budgets.map((budget) => budget.name)).toEqual(['Rent', 'Overall', 'Food']);
      expect(budgets.map((budget) => budget.sortOrder)).toEqual([0, 1, 2]);

      await repository.archiveBudget(overall.id);
      await repository.addBudget({
        name: 'Transport',
        amountMinor: 30000,
        currencyCode: 'AUD',
        scopeType: 'category',
        categoryId: 'transport',
      });

      budgets = (await repository.getSnapshot()).budgets.filter((budget) => budget.isActive);
      expect(budgets.map((budget) => budget.name)).toEqual(['Rent', 'Food', 'Transport']);
    });
  });

});

