import {
  buildSplitExpenseLinesFromForm,
  createSplitExpenseFormLine,
  getSplitExpenseFormSummary,
  getSplitExpenseValidationMessage,
  removeSplitExpenseFormLine,
  updateSplitExpenseFormLine,
} from '../splitTransactionForm';

describe('split transaction form helpers', () => {
  it('builds multiple expense lines when split totals match', () => {
    const lines = buildSplitExpenseLinesFromForm({
      accountId: 'a1',
      currencyCode: 'AUD',
      totalMinor: 3000,
      lines: [
        createSplitExpenseFormLine({
          id: 'food-line',
          amount: '10.00',
          categoryId: 'food',
          subcategoryId: 'groceries',
          note: 'Food',
        }),
        createSplitExpenseFormLine({
          id: 'home-line',
          amount: '20.00',
          categoryId: 'housing',
          subcategoryId: 'rent',
        }),
      ],
    });

    expect(lines).toEqual([
      expect.objectContaining({
        accountId: 'a1',
        amountMinor: -1000,
        currencyCode: 'AUD',
        categoryId: 'food',
        subcategoryId: 'groceries',
        note: 'Food',
      }),
      expect.objectContaining({
        accountId: 'a1',
        amountMinor: -2000,
        currencyCode: 'AUD',
        categoryId: 'housing',
        subcategoryId: 'rent',
      }),
    ]);
  });

  it('validates split totals in minor units exactly', () => {
    const lines = [
      createSplitExpenseFormLine({ id: 'one', amount: '10.01', categoryId: 'food', subcategoryId: 'groceries' }),
      createSplitExpenseFormLine({ id: 'two', amount: '19.99', categoryId: 'transport', subcategoryId: 'fuel' }),
    ];

    expect(getSplitExpenseFormSummary(3000, lines)).toEqual({
      allocatedMinor: 3000,
      remainingMinor: 0,
      invalidLineCount: 0,
      isBalanced: true,
    });
    expect(getSplitExpenseValidationMessage(3000, lines)).toBe('');
    expect(getSplitExpenseValidationMessage(3001, lines)).toBe('Split line amounts must equal the transaction total.');
  });

  it('rejects empty split lines', () => {
    const lines = [
      createSplitExpenseFormLine({ id: 'one', amount: '10.00', categoryId: 'food', subcategoryId: 'groceries' }),
      createSplitExpenseFormLine({ id: 'two', categoryId: 'transport', subcategoryId: 'fuel' }),
    ];

    expect(getSplitExpenseFormSummary(1000, lines).invalidLineCount).toBe(1);
    expect(getSplitExpenseValidationMessage(1000, lines)).toBe('Enter an amount, category, and subcategory for every split line.');
  });

  it('updates and removes split lines immutably', () => {
    const lines = [
      createSplitExpenseFormLine({ id: 'one', amount: '10.00', categoryId: 'food', subcategoryId: 'groceries' }),
      createSplitExpenseFormLine({ id: 'two', amount: '20.00', categoryId: 'transport', subcategoryId: 'fuel' }),
    ];

    const updated = updateSplitExpenseFormLine(lines, 'two', { amount: '15.00' });
    const removed = removeSplitExpenseFormLine(updated, 'one');

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
      buildSplitExpenseLinesFromForm({
        accountId: 'a1',
        currencyCode: 'AUD',
        totalMinor: 1000,
        lines: [
          createSplitExpenseFormLine({
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
