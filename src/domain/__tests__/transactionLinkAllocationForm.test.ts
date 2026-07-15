import {
  createExpenseTransactionLinkAllocationDrafts,
  createTransactionLinkAllocationDrafts,
  getExpenseTransactionLinkAllocationChanges,
  getAllocatedAmountMinor,
  getTargetAllocatedAmountMinor,
  getTransactionLinkAllocationChanges,
  getTransactionLinkSourceScopes,
  getTransactionLinkSourceOptions,
  getTransactionLinkTargetOptions,
  getTransactionLinkTargetScopes,
  isValidTransactionLinkAllocationAmount,
} from '../transactionLinkAllocationForm';
import type { Transaction, TransactionLine, TransactionLink } from '../types';

function transaction(id: string, kind: Transaction['kind']): Transaction {
  return {
    id,
    kind,
    title: id,
    datetime: '2026-05-18T12:00:00.000Z',
    notes: '',
    labels: [],
    groupId: '',
    createdAt: '',
    updatedAt: '',
  };
}

function line(overrides: Partial<TransactionLine>): TransactionLine {
  return {
    id: 'line-1',
    transactionId: 'txn-1',
    accountId: 'acct-1',
    amountMinor: -1000,
    currencyCode: 'AUD',
    categoryId: 'food',
    subcategoryId: 'groceries',
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: '',
    ...overrides,
  };
}

function link(overrides: Partial<TransactionLink> = {}): TransactionLink {
  return {
    id: 'link-1',
    sourceTransactionId: 'income-1',
    targetTransactionId: 'expense-1',
    sourceLineId: null,
    targetLineId: null,
    linkType: 'reimbursement',
    amountMinor: 1200,
    currencyCode: 'AUD',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('transaction link allocation form helpers', () => {
  it('loads existing transaction-level and line-level links into allocation drafts', () => {
    expect(
      createTransactionLinkAllocationDrafts('income-1', [
        link(),
        link({
          id: 'link-2',
          sourceLineId: 'income-line-2',
          targetLineId: 'expense-line-2',
          amountMinor: 3456,
        }),
        link({ id: 'other', sourceTransactionId: 'income-2' }),
      ]),
    ).toEqual([
      expect.objectContaining({
        existingLinkId: 'link-1',
        sourceLineId: null,
        targetLineId: null,
        amount: '12.00',
      }),
      expect.objectContaining({
        existingLinkId: 'link-2',
        sourceLineId: 'income-line-2',
        targetLineId: 'expense-line-2',
        amount: '34.56',
      }),
    ]);
  });

  it('loads existing target-side parent and split links into expense allocation drafts', () => {
    expect(
      createExpenseTransactionLinkAllocationDrafts('expense-1', [
        link(),
        link({
          id: 'link-2',
          sourceLineId: 'income-line-2',
          targetLineId: 'expense-line-2',
          amountMinor: 3456,
        }),
        link({ id: 'other', targetTransactionId: 'expense-2' }),
      ]),
    ).toEqual([
      expect.objectContaining({
        existingLinkId: 'link-1',
        sourceTransactionId: 'income-1',
        sourceLineId: null,
        targetLineId: null,
        amount: '12.00',
      }),
      expect.objectContaining({
        existingLinkId: 'link-2',
        sourceTransactionId: 'income-1',
        sourceLineId: 'income-line-2',
        targetLineId: 'expense-line-2',
        amount: '34.56',
      }),
    ]);
  });

  it('builds source scopes for whole income and split income lines', () => {
    const scopes = getTransactionLinkSourceScopes(transaction('income-1', 'income'), [
      line({ id: 'salary', transactionId: 'income-1', amountMinor: 3000, categoryId: 'income', subcategoryId: 'salary' }),
      line({ id: 'bonus', transactionId: 'income-1', amountMinor: 2000, categoryId: 'income', subcategoryId: 'bonus' }),
    ]);

    expect(scopes).toEqual([
      expect.objectContaining({ sourceLineId: null, amountMinor: 5000 }),
      expect.objectContaining({ sourceLineId: 'salary', amountMinor: 3000 }),
      expect.objectContaining({ sourceLineId: 'bonus', amountMinor: 2000 }),
    ]);
  });

  it('builds target scopes for whole expense and split expense lines', () => {
    const scopes = getTransactionLinkTargetScopes(transaction('expense-1', 'expense'), [
      line({ id: 'food', transactionId: 'expense-1', amountMinor: -3000, categoryId: 'food', subcategoryId: 'groceries' }),
      line({ id: 'home', transactionId: 'expense-1', amountMinor: -2000, categoryId: 'housing', subcategoryId: 'rent' }),
    ]);

    expect(scopes).toEqual([
      expect.objectContaining({ targetLineId: null, amountMinor: 5000, selectable: false }),
      expect.objectContaining({ targetLineId: 'food', amountMinor: 3000, selectable: true }),
      expect.objectContaining({ targetLineId: 'home', amountMinor: 2000, selectable: true }),
    ]);
  });

  it('marks linked source scopes at the whole or split-line level', () => {
    const scopes = getTransactionLinkSourceScopes(
      transaction('income-1', 'income'),
      [
        line({ id: 'salary', transactionId: 'income-1', amountMinor: 3000, categoryId: 'income', subcategoryId: 'salary' }),
        line({ id: 'bonus', transactionId: 'income-1', amountMinor: 2000, categoryId: 'income', subcategoryId: 'bonus' }),
      ],
      [
        link({ id: 'whole-link', sourceLineId: null }),
        link({ id: 'line-link', sourceLineId: 'bonus' }),
      ],
    );

    expect(scopes.map((scope) => [scope.sourceLineId, scope.isLinked])).toEqual([
      [null, true],
      ['salary', false],
      ['bonus', true],
    ]);
  });

  it('builds only split-line source options for new expense-side links', () => {
    const options = getTransactionLinkSourceOptions({
      transaction: transaction('income-1', 'income'),
      lines: [
        line({ id: 'salary', transactionId: 'income-1', amountMinor: 3000, categoryId: 'income', subcategoryId: 'salary' }),
        line({ id: 'bonus', transactionId: 'income-1', amountMinor: 2000, categoryId: 'income', subcategoryId: 'bonus' }),
      ],
      currencyCode: 'AUD',
    });

    expect(options).toEqual([
      expect.objectContaining({ sourceLineId: 'salary', amountMinor: 3000 }),
      expect.objectContaining({ sourceLineId: 'bonus', amountMinor: 2000 }),
    ]);
  });

  it('builds only split-line target options for new links', () => {
    const options = getTransactionLinkTargetOptions({
      transaction: transaction('expense-1', 'expense'),
      lines: [
        line({ id: 'food', transactionId: 'expense-1', amountMinor: -3000, categoryId: 'food', subcategoryId: 'groceries' }),
        line({ id: 'home', transactionId: 'expense-1', amountMinor: -2000, categoryId: 'housing', subcategoryId: 'rent' }),
      ],
      currencyCode: 'AUD',
    });

    expect(options).toEqual([
      expect.objectContaining({ targetLineId: 'food', amountMinor: 3000, subcategoryId: 'groceries' }),
      expect.objectContaining({ targetLineId: 'home', amountMinor: 2000, subcategoryId: 'rent' }),
    ]);
  });

  it('uses net amount for whole mixed endpoints while exposing opposite-kind child scopes', () => {
    const netIncome = transaction('net-income', 'income');
    const netIncomeLines = [
      line({ id: 'salary', transactionId: netIncome.id, amountMinor: 380000 }),
      line({ id: 'tax', transactionId: netIncome.id, amountMinor: -80000 }),
    ];
    expect(getTransactionLinkSourceOptions({
      transaction: netIncome,
      lines: netIncomeLines,
      currencyCode: 'AUD',
    }).map((option) => [option.sourceLineId, option.amountMinor])).toEqual([
      ['salary', 380000],
    ]);
    expect(getTransactionLinkTargetOptions({
      transaction: netIncome,
      lines: netIncomeLines,
      currencyCode: 'AUD',
    }).map((option) => [option.targetLineId, option.amountMinor])).toEqual([
      ['tax', 80000],
    ]);

    const netExpense = transaction('net-expense', 'expense');
    const netExpenseLines = [
      line({ id: 'purchase', transactionId: netExpense.id, amountMinor: -80000 }),
      line({ id: 'refund', transactionId: netExpense.id, amountMinor: 30000 }),
    ];
    expect(getTransactionLinkTargetOptions({
      transaction: netExpense,
      lines: netExpenseLines,
      currencyCode: 'AUD',
    }).map((option) => [option.targetLineId, option.amountMinor])).toEqual([
      ['purchase', 80000],
    ]);
    expect(getTransactionLinkSourceOptions({
      transaction: netExpense,
      lines: netExpenseLines,
      currencyCode: 'AUD',
    }).map((option) => [option.sourceLineId, option.amountMinor])).toEqual([
      ['refund', 30000],
    ]);
  });

  it('keeps historical whole links out of new options while marking linked split-line options', () => {
    const options = getTransactionLinkTargetOptions({
      transaction: transaction('expense-1', 'expense'),
      lines: [
        line({ id: 'food', transactionId: 'expense-1', amountMinor: -3000, categoryId: 'food', subcategoryId: 'groceries' }),
        line({ id: 'home', transactionId: 'expense-1', amountMinor: -2000, categoryId: 'housing', subcategoryId: 'rent' }),
      ],
      currencyCode: 'AUD',
      transactionLinks: [
        link({ id: 'whole-link', targetLineId: null }),
        link({ id: 'line-link', targetLineId: 'home' }),
      ],
    });

    expect(options.map((option) => [option.targetLineId, option.isLinked])).toEqual([
      ['food', false],
      ['home', true],
    ]);
  });

  it('keeps a normal one-line parent selectable as a whole endpoint', () => {
    expect(getTransactionLinkSourceOptions({
      transaction: transaction('income-1', 'income'),
      lines: [line({ id: 'income-line', transactionId: 'income-1', amountMinor: 5000 })],
      currencyCode: 'AUD',
    }).map((option) => option.sourceLineId)).toEqual([null]);
    expect(getTransactionLinkTargetOptions({
      transaction: transaction('expense-1', 'expense'),
      lines: [line({ id: 'expense-line', transactionId: 'expense-1', amountMinor: -5000 })],
      currencyCode: 'AUD',
    }).map((option) => option.targetLineId)).toEqual([null]);
  });

  it('calculates selected-source allocated amount', () => {
    const allocations = [
      createTransactionLinkAllocationDrafts('income-1', [link({ sourceLineId: 'salary', amountMinor: 1200 })])[0],
      createTransactionLinkAllocationDrafts('income-1', [link({ id: 'link-2', sourceLineId: 'bonus', amountMinor: 500 })])[0],
    ];

    expect(getAllocatedAmountMinor(allocations, null)).toBe(1700);
    expect(getAllocatedAmountMinor(allocations, 'salary')).toBe(1200);
  });

  it('calculates selected-target allocated amount', () => {
    const allocations = [
      createExpenseTransactionLinkAllocationDrafts('expense-1', [link({ targetLineId: 'food', amountMinor: 1200 })])[0],
      createExpenseTransactionLinkAllocationDrafts('expense-1', [link({ id: 'link-2', targetLineId: 'home', amountMinor: 500 })])[0],
    ];

    expect(getTargetAllocatedAmountMinor(allocations, null)).toBe(1700);
    expect(getTargetAllocatedAmountMinor(allocations, 'food')).toBe(1200);
  });

  it('creates add/update/delete changes without removing unrelated allocations', () => {
    const existingLinks = [
      link({ id: 'keep', targetTransactionId: 'expense-1' }),
      link({ id: 'remove', targetTransactionId: 'expense-2' }),
      link({ id: 'other', sourceTransactionId: 'income-2' }),
    ];

    const changes = getTransactionLinkAllocationChanges({
      sourceTransactionId: 'income-1',
      existingLinks,
      allocations: [
        {
          id: 'keep',
          existingLinkId: 'keep',
          sourceLineId: null,
          targetTransactionId: 'expense-1',
          targetLineId: 'expense-line-1',
          linkType: 'refund',
          amount: '20.00',
          currencyCode: 'AUD',
        },
        {
          id: 'new',
          sourceLineId: 'income-line-1',
          targetTransactionId: 'expense-3',
          targetLineId: null,
          linkType: 'reimbursement',
          amount: '5.00',
          currencyCode: 'AUD',
        },
      ],
    });

    expect(changes.deleteIds).toEqual(['remove']);
    expect(changes.toUpdate).toEqual([
      expect.objectContaining({ id: 'keep', targetLineId: 'expense-line-1', amountMinor: 2000 }),
    ]);
    expect(changes.toAdd).toEqual([
      expect.objectContaining({ sourceLineId: 'income-line-1', targetTransactionId: 'expense-3', amountMinor: 500 }),
    ]);
  });

  it('creates expense-side add/update/delete changes without removing unrelated allocations', () => {
    const existingLinks = [
      link({ id: 'keep', sourceTransactionId: 'income-1' }),
      link({ id: 'remove', sourceTransactionId: 'income-2' }),
      link({ id: 'other', targetTransactionId: 'expense-2' }),
    ];

    const changes = getExpenseTransactionLinkAllocationChanges({
      targetTransactionId: 'expense-1',
      existingLinks,
      allocations: [
        {
          id: 'keep',
          existingLinkId: 'keep',
          sourceTransactionId: 'income-1',
          sourceLineId: 'income-line-1',
          targetLineId: null,
          linkType: 'refund',
          amount: '20.00',
          currencyCode: 'AUD',
        },
        {
          id: 'new',
          sourceTransactionId: 'income-3',
          sourceLineId: null,
          targetLineId: 'expense-line-3',
          linkType: 'reimbursement',
          amount: '5.00',
          currencyCode: 'AUD',
        },
      ],
    });

    expect(changes.deleteIds).toEqual(['remove']);
    expect(changes.toUpdate).toEqual([
      expect.objectContaining({ id: 'keep', sourceLineId: 'income-line-1', amountMinor: 2000 }),
    ]);
    expect(changes.toAdd).toEqual([
      expect.objectContaining({ sourceTransactionId: 'income-3', targetLineId: 'expense-line-3', amountMinor: 500 }),
    ]);
  });

  it('does not emit updates for unchanged accepted allocations', () => {
    const existing = link({ amountMinor: 2000 });

    expect(getTransactionLinkAllocationChanges({
      sourceTransactionId: existing.sourceTransactionId,
      existingLinks: [existing],
      allocations: createTransactionLinkAllocationDrafts(existing.sourceTransactionId, [existing]),
    })).toEqual({ toAdd: [], toUpdate: [], deleteIds: [] });

    expect(getExpenseTransactionLinkAllocationChanges({
      targetTransactionId: existing.targetTransactionId,
      existingLinks: [existing],
      allocations: createExpenseTransactionLinkAllocationDrafts(existing.targetTransactionId, [existing]),
    })).toEqual({ toAdd: [], toUpdate: [], deleteIds: [] });
  });

  it('rejects zero and negative allocation drafts instead of converting them to positive values', () => {
    const allocation = {
      id: 'draft',
      sourceLineId: null,
      targetTransactionId: 'expense-1',
      targetLineId: null,
      linkType: 'reimbursement' as const,
      amount: '-5.00',
      currencyCode: 'AUD',
    };

    expect(isValidTransactionLinkAllocationAmount(allocation)).toBe(false);
    expect(() => getTransactionLinkAllocationChanges({
      sourceTransactionId: 'income-1',
      existingLinks: [],
      allocations: [allocation],
    })).toThrow('Link amount must be greater than zero.');
  });
});
