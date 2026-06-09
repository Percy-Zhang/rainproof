import {
  buildMixedSplitLinesFromForm,
  buildSplitLinesFromForm,
  createSplitTransactionFormLine,
  getMixedSplitTransactionFormSummary,
  getMixedSplitTransactionValidationMessage,
  getSplitLineCategoryKind,
  getSplitTransactionFormSummary,
  getSplitTransactionValidationMessage,
  removeSplitTransactionFormLine,
  updateSplitTransactionFormLine,
} from '../splitTransactionForm';

describe('split transaction form helpers', () => {
  it('builds multiple expense lines when split totals match', () => {
    const lines = buildSplitLinesFromForm({
      kind: 'expense',
      accountId: 'a1',
      currencyCode: 'AUD',
      totalMinor: 3000,
      lines: [
        createSplitTransactionFormLine({
          id: 'food-line',
          amount: '10.00',
          categoryId: 'food',
          subcategoryId: 'groceries',
          note: 'Food',
        }),
        createSplitTransactionFormLine({
          id: 'home-line',
          amount: '20.00',
          categoryId: 'housing',
          subcategoryId: 'rent',
        }),
      ],
    });

    expect(lines).toEqual([
      expect.objectContaining({
        id: 'food-line',
        accountId: 'a1',
        amountMinor: -1000,
        currencyCode: 'AUD',
        categoryId: 'food',
        subcategoryId: 'groceries',
        note: 'Food',
      }),
      expect.objectContaining({
        id: 'home-line',
        accountId: 'a1',
        amountMinor: -2000,
        currencyCode: 'AUD',
        categoryId: 'housing',
        subcategoryId: 'rent',
      }),
    ]);
  });

  it('falls back to the parent item for blank split expense line notes', () => {
    const lines = buildSplitLinesFromForm({
      kind: 'expense',
      accountId: 'a1',
      currencyCode: 'AUD',
      parentTitle: 'Grocery run',
      totalMinor: 3000,
      lines: [
        createSplitTransactionFormLine({
          id: 'food-line',
          amount: '10.00',
          categoryId: 'food',
          subcategoryId: 'groceries',
        }),
        createSplitTransactionFormLine({
          id: 'home-line',
          amount: '20.00',
          categoryId: 'housing',
          subcategoryId: 'rent',
          note: '   ',
        }),
      ],
    });

    expect(lines).toEqual([
      expect.objectContaining({
        id: 'food-line',
        amountMinor: -1000,
        categoryId: 'food',
        subcategoryId: 'groceries',
        note: 'Grocery run',
      }),
      expect.objectContaining({
        id: 'home-line',
        amountMinor: -2000,
        categoryId: 'housing',
        subcategoryId: 'rent',
        note: 'Grocery run',
      }),
    ]);
  });

  it('preserves custom split line notes over the parent item', () => {
    const lines = buildSplitLinesFromForm({
      kind: 'expense',
      accountId: 'a1',
      currencyCode: 'AUD',
      parentTitle: 'Grocery run',
      totalMinor: 3000,
      lines: [
        createSplitTransactionFormLine({
          id: 'food-line',
          amount: '10.00',
          categoryId: 'food',
          subcategoryId: 'groceries',
          note: 'Fruit',
        }),
        createSplitTransactionFormLine({
          id: 'home-line',
          amount: '20.00',
          categoryId: 'housing',
          subcategoryId: 'rent',
          note: 'Cleaning',
        }),
      ],
    });

    expect(lines).toEqual([
      expect.objectContaining({
        note: 'Fruit',
      }),
      expect.objectContaining({
        note: 'Cleaning',
      }),
    ]);
  });

  it('keeps split line notes empty when the parent item is also empty', () => {
    const lines = buildSplitLinesFromForm({
      kind: 'expense',
      accountId: 'a1',
      currencyCode: 'AUD',
      parentTitle: '   ',
      totalMinor: 3000,
      lines: [
        createSplitTransactionFormLine({
          id: 'food-line',
          amount: '10.00',
          categoryId: 'food',
          subcategoryId: 'groceries',
        }),
        createSplitTransactionFormLine({
          id: 'home-line',
          amount: '20.00',
          categoryId: 'housing',
          subcategoryId: 'rent',
        }),
      ],
    });

    expect(lines).toEqual([
      expect.objectContaining({ note: '' }),
      expect.objectContaining({ note: '' }),
    ]);
  });

  it('builds multiple income lines when split totals match', () => {
    const lines = buildSplitLinesFromForm({
      kind: 'income',
      accountId: 'a1',
      currencyCode: 'AUD',
      totalMinor: 3000,
      lines: [
        createSplitTransactionFormLine({
          id: 'salary-line',
          amount: '10.00',
          categoryId: 'income',
          subcategoryId: 'salary',
          note: 'Salary',
        }),
        createSplitTransactionFormLine({
          id: 'bonus-line',
          amount: '20.00',
          categoryId: 'income',
          subcategoryId: 'bonus',
        }),
      ],
    });

    expect(lines).toEqual([
      expect.objectContaining({
        id: 'salary-line',
        accountId: 'a1',
        amountMinor: 1000,
        currencyCode: 'AUD',
        categoryId: 'income',
        subcategoryId: 'salary',
        note: 'Salary',
      }),
      expect.objectContaining({
        id: 'bonus-line',
        accountId: 'a1',
        amountMinor: 2000,
        currencyCode: 'AUD',
        categoryId: 'income',
        subcategoryId: 'bonus',
      }),
    ]);
  });

  it('builds mixed split lines from positive form amounts and line kind', () => {
    const lines = buildMixedSplitLinesFromForm({
      kind: 'income',
      accountId: 'a1',
      currencyCode: 'AUD',
      parentTitle: 'Pay',
      totalMinor: 170000,
      lines: [
        createSplitTransactionFormLine({
          id: 'salary-line',
          kind: 'income',
          amount: '2300.00',
          categoryId: 'income',
          subcategoryId: 'salary',
        }) as ReturnType<typeof createSplitTransactionFormLine> & { kind: 'income' },
        createSplitTransactionFormLine({
          id: 'tax-line',
          kind: 'expense',
          amount: '600.00',
          categoryId: 'tax',
          subcategoryId: 'withholding',
        }) as ReturnType<typeof createSplitTransactionFormLine> & { kind: 'expense' },
      ],
    });

    expect(lines).toEqual([
      expect.objectContaining({
        id: 'salary-line',
        amountMinor: 230000,
        categoryId: 'income',
        subcategoryId: 'salary',
        note: 'Pay',
      }),
      expect.objectContaining({
        id: 'tax-line',
        amountMinor: -60000,
        categoryId: 'tax',
        subcategoryId: 'withholding',
        note: 'Pay',
      }),
    ]);
  });

  it('summarizes mixed split income, expense, parent net, and difference', () => {
    const lines = [
      createSplitTransactionFormLine({
        id: 'salary-line',
        kind: 'income',
        amount: '2300.00',
        categoryId: 'income',
        subcategoryId: 'salary',
      }),
      createSplitTransactionFormLine({
        id: 'tax-line',
        kind: 'expense',
        amount: '600.00',
        categoryId: 'food',
        subcategoryId: 'groceries',
      }),
    ];

    expect(getMixedSplitTransactionFormSummary({ kind: 'income', totalMinor: 170000, lines })).toEqual({
      parentSignedMinor: 170000,
      incomeMinor: 230000,
      expenseMinor: 60000,
      signedLineTotalMinor: 170000,
      differenceMinor: 0,
      invalidLineCount: 0,
      hasIncome: true,
      hasExpense: true,
      isBalanced: true,
    });
    expect(getMixedSplitTransactionValidationMessage({ kind: 'income', totalMinor: 170000, lines })).toBe('');
    expect(getMixedSplitTransactionValidationMessage({ kind: 'income', totalMinor: 160000, lines })).toBe(
      'Mixed split lines must net to the transaction total.',
    );
  });

  it('uses the parent category kind for standard splits and the line kind for mixed splits', () => {
    const expenseLine = createSplitTransactionFormLine({
      id: 'tax-line',
      kind: 'expense',
      amount: '600.00',
      categoryId: 'food',
      subcategoryId: 'groceries',
    });

    expect(getSplitLineCategoryKind({
      line: expenseLine,
      parentKind: 'income',
      splitMode: 'standard',
    })).toBe('income');
    expect(getSplitLineCategoryKind({
      line: expenseLine,
      parentKind: 'income',
      splitMode: 'mixed',
    })).toBe('expense');
  });

  it('falls back to the parent item for blank split income line notes', () => {
    const lines = buildSplitLinesFromForm({
      kind: 'income',
      accountId: 'a1',
      currencyCode: 'AUD',
      parentTitle: 'Pay run',
      totalMinor: 3000,
      lines: [
        createSplitTransactionFormLine({
          id: 'salary-line',
          amount: '10.00',
          categoryId: 'income',
          subcategoryId: 'salary',
        }),
        createSplitTransactionFormLine({
          id: 'bonus-line',
          amount: '20.00',
          categoryId: 'income',
          subcategoryId: 'bonus',
          note: '  ',
        }),
      ],
    });

    expect(lines).toEqual([
      expect.objectContaining({
        amountMinor: 1000,
        categoryId: 'income',
        subcategoryId: 'salary',
        note: 'Pay run',
      }),
      expect.objectContaining({
        amountMinor: 2000,
        categoryId: 'income',
        subcategoryId: 'bonus',
        note: 'Pay run',
      }),
    ]);
  });

  it('validates split totals in minor units exactly', () => {
    const lines = [
      createSplitTransactionFormLine({ id: 'one', amount: '10.01', categoryId: 'food', subcategoryId: 'groceries' }),
      createSplitTransactionFormLine({ id: 'two', amount: '19.99', categoryId: 'transport', subcategoryId: 'fuel' }),
    ];

    expect(getSplitTransactionFormSummary(3000, lines)).toEqual({
      allocatedMinor: 3000,
      remainingMinor: 0,
      invalidLineCount: 0,
      isBalanced: true,
    });
    expect(getSplitTransactionValidationMessage(3000, lines)).toBe('');
    expect(getSplitTransactionValidationMessage(3001, lines)).toBe('Split line amounts must equal the transaction total.');
  });

  it('rejects empty split lines', () => {
    const lines = [
      createSplitTransactionFormLine({ id: 'one', amount: '10.00', categoryId: 'food', subcategoryId: 'groceries' }),
      createSplitTransactionFormLine({ id: 'two', categoryId: 'transport', subcategoryId: 'fuel' }),
    ];

    expect(getSplitTransactionFormSummary(1000, lines).invalidLineCount).toBe(1);
    expect(getSplitTransactionValidationMessage(1000, lines)).toBe('Enter an amount, category, and subcategory for every split line.');
  });

  it('updates and removes split lines immutably', () => {
    const lines = [
      createSplitTransactionFormLine({ id: 'one', amount: '10.00', categoryId: 'food', subcategoryId: 'groceries' }),
      createSplitTransactionFormLine({ id: 'two', amount: '20.00', categoryId: 'transport', subcategoryId: 'fuel' }),
    ];

    const updated = updateSplitTransactionFormLine(lines, 'two', { amount: '15.00' });
    const removed = removeSplitTransactionFormLine(updated, 'one');

    expect(lines[1].amount).toBe('20.00');
    expect(updated[1].amount).toBe('15.00');
    expect(removed).toEqual([
      expect.objectContaining({
        id: 'two',
        amount: '15.00',
      }),
    ]);
  });

  it('does not build unsupported one-line split expenses', () => {
    expect(() =>
      buildSplitLinesFromForm({
        kind: 'expense',
        accountId: 'a1',
        currencyCode: 'AUD',
        totalMinor: 1000,
        lines: [
          createSplitTransactionFormLine({
            id: 'one',
            amount: '10.00',
            categoryId: 'food',
            subcategoryId: 'groceries',
          }),
        ],
      }),
    ).toThrow('Add at least two split lines.');
  });
});
