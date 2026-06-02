import {
  createTransactionLinkAllocationDrafts,
  getAllocatedAmountMinor,
  getTransactionLinkAllocationChanges,
  getTransactionLinkSourceScopes,
  getTransactionLinkTargetOptions,
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

  it('builds whole-target and split-line target options', () => {
    const options = getTransactionLinkTargetOptions({
      transaction: transaction('expense-1', 'expense'),
      lines: [
        line({ id: 'food', transactionId: 'expense-1', amountMinor: -3000, categoryId: 'food', subcategoryId: 'groceries' }),
        line({ id: 'home', transactionId: 'expense-1', amountMinor: -2000, categoryId: 'housing', subcategoryId: 'rent' }),
      ],
      currencyCode: 'AUD',
    });

    expect(options).toEqual([
      expect.objectContaining({ targetLineId: null, amountMinor: 5000 }),
      expect.objectContaining({ targetLineId: 'food', amountMinor: 3000, subcategoryId: 'groceries' }),
      expect.objectContaining({ targetLineId: 'home', amountMinor: 2000, subcategoryId: 'rent' }),
    ]);
  });

  it('marks linked target options at the whole or split-line level', () => {
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
      [null, true],
      ['food', false],
      ['home', true],
    ]);
  });

  it('calculates selected-source allocated amount', () => {
    const allocations = [
      createTransactionLinkAllocationDrafts('income-1', [link({ sourceLineId: 'salary', amountMinor: 1200 })])[0],
      createTransactionLinkAllocationDrafts('income-1', [link({ id: 'link-2', sourceLineId: 'bonus', amountMinor: 500 })])[0],
    ];

    expect(getAllocatedAmountMinor(allocations, null)).toBe(1700);
    expect(getAllocatedAmountMinor(allocations, 'salary')).toBe(1200);
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
});
