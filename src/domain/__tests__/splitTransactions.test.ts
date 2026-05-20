import {
  buildSplitExpenseTransactionLines,
  isSplitExpenseTransaction,
  sumSplitExpenseLinesMinor,
  validateSplitExpenseTransactionLines,
} from '../splitTransactions';
import type { Transaction, TransactionLine } from '../types';

const expense: Transaction = transaction('expense');
const transfer: Transaction = transaction('transfer');

function transaction(kind: Transaction['kind']): Transaction {
  return {
    id: `${kind}-1`,
    kind,
    title: kind,
    datetime: '2026-05-20T10:00:00.000Z',
    notes: '',
    labels: [],
    groupId: '',
    createdAt: '',
    updatedAt: '',
  };
}

function line(overrides: Partial<TransactionLine> = {}): TransactionLine {
  return {
    id: 'line-1',
    transactionId: 'expense-1',
    accountId: 'account-1',
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

describe('split transaction helpers', () => {
  it('does not mark a one-line expense as split', () => {
    expect(isSplitExpenseTransaction(expense, [line()])).toBe(false);
  });

  it('marks a multi-line expense as split', () => {
    expect(isSplitExpenseTransaction(expense, [line({ id: 'a' }), line({ id: 'b', amountMinor: -2500 })])).toBe(true);
  });

  it('sums split expense lines using minor units', () => {
    expect(sumSplitExpenseLinesMinor([line({ amountMinor: -1234 }), line({ amountMinor: -1 })])).toBe(1235);
  });

  it('validates split totals exactly in minor units', () => {
    expect(() =>
      validateSplitExpenseTransactionLines({
        kind: 'expense',
        lines: [line({ id: 'a', amountMinor: -1200 }), line({ id: 'b', amountMinor: -3400 })],
        totalMinor: 4600,
      }),
    ).not.toThrow();
  });

  it('rejects mismatched split totals', () => {
    expect(() =>
      validateSplitExpenseTransactionLines({
        kind: 'expense',
        lines: [line({ id: 'a', amountMinor: -1200 }), line({ id: 'b', amountMinor: -3400 })],
        totalMinor: 4599,
      }),
    ).toThrow('Split line amounts must equal the transaction total.');
  });

  it('rejects split lines across mixed accounts', () => {
    expect(() =>
      validateSplitExpenseTransactionLines({
        kind: 'expense',
        lines: [line({ id: 'a' }), line({ id: 'b', accountId: 'account-2' })],
      }),
    ).toThrow('Split expense lines must use the same account.');
  });

  it('rejects split lines across mixed currencies', () => {
    expect(() =>
      validateSplitExpenseTransactionLines({
        kind: 'expense',
        lines: [line({ id: 'a' }), line({ id: 'b', currencyCode: 'USD' })],
      }),
    ).toThrow('Split expense lines must use the same currency.');
  });

  it('rejects empty split line amounts', () => {
    expect(() =>
      validateSplitExpenseTransactionLines({
        kind: 'expense',
        lines: [line({ id: 'a' }), line({ id: 'b', amountMinor: 0 })],
      }),
    ).toThrow('Split expense line amounts must be negative.');
  });

  it('rejects transfers as split transactions', () => {
    expect(() =>
      validateSplitExpenseTransactionLines({
        kind: transfer.kind,
        lines: [line({ id: 'a' }), line({ id: 'b' })],
      }),
    ).toThrow('Only expense transactions can be split.');
  });

  it('rejects split lines without categories and subcategories', () => {
    expect(() =>
      validateSplitExpenseTransactionLines({
        kind: 'expense',
        lines: [line({ id: 'a' }), line({ id: 'b', categoryId: '', subcategoryId: '' })],
      }),
    ).toThrow('Choose a category and subcategory for every split line.');
  });

  it('builds signed expense transaction lines from draft split lines', () => {
    expect(
      buildSplitExpenseTransactionLines({
        accountId: 'account-1',
        currencyCode: 'aud',
        totalMinor: 3000,
        splitLines: [
          { amountMinor: 1000, categoryId: 'food', subcategoryId: 'groceries', note: 'Apples' },
          { amountMinor: 2000, categoryId: 'housing', subcategoryId: 'rent' },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        accountId: 'account-1',
        amountMinor: -1000,
        currencyCode: 'AUD',
        categoryId: 'food',
        subcategoryId: 'groceries',
        note: 'Apples',
      }),
      expect.objectContaining({
        amountMinor: -2000,
        categoryId: 'housing',
        subcategoryId: 'rent',
      }),
    ]);
  });
});
