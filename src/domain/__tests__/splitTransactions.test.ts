import {
  buildMixedSplitTransactionLines,
  buildSplitTransactionLines,
  isSplitTransaction,
  sumSplitTransactionLinesMinor,
  validateSplitTransactionLines,
} from '../splitTransactions';
import type { Transaction, TransactionLine } from '../types';

const expense: Transaction = transaction('expense');
const income: Transaction = transaction('income');
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
    expect(isSplitTransaction(expense, [line()])).toBe(false);
  });

  it('marks a multi-line expense as split', () => {
    expect(isSplitTransaction(expense, [line({ id: 'a' }), line({ id: 'b', amountMinor: -2500 })])).toBe(true);
  });

  it('marks a multi-line income as split', () => {
    expect(
      isSplitTransaction(income, [
        line({ id: 'salary', amountMinor: 3000, categoryId: 'income', subcategoryId: 'salary' }),
        line({ id: 'bonus', amountMinor: 2000, categoryId: 'income', subcategoryId: 'bonus' }),
      ]),
    ).toBe(true);
  });

  it('sums split lines using minor units for income and expense', () => {
    expect(sumSplitTransactionLinesMinor('expense', [line({ amountMinor: -1234 }), line({ amountMinor: -1 })])).toBe(1235);
    expect(sumSplitTransactionLinesMinor('income', [line({ amountMinor: 1234 }), line({ amountMinor: 1 })])).toBe(1235);
  });

  it('sums mixed split lines to the parent net movement', () => {
    expect(
      sumSplitTransactionLinesMinor('income', [
        line({ amountMinor: 230000, categoryId: 'income', subcategoryId: 'salary' }),
        line({ amountMinor: -60000, categoryId: 'tax', subcategoryId: 'withholding' }),
      ]),
    ).toBe(170000);
    expect(
      sumSplitTransactionLinesMinor('expense', [
        line({ amountMinor: 20000, categoryId: 'income', subcategoryId: 'refund' }),
        line({ amountMinor: -50000, categoryId: 'food', subcategoryId: 'groceries' }),
      ]),
    ).toBe(30000);
  });

  it('validates split totals exactly in minor units', () => {
    expect(() =>
      validateSplitTransactionLines({
        kind: 'expense',
        lines: [line({ id: 'a', amountMinor: -1200 }), line({ id: 'b', amountMinor: -3400 })],
        totalMinor: 4600,
      }),
    ).not.toThrow();
  });

  it('rejects mismatched split totals', () => {
    expect(() =>
      validateSplitTransactionLines({
        kind: 'expense',
        lines: [line({ id: 'a', amountMinor: -1200 }), line({ id: 'b', amountMinor: -3400 })],
        totalMinor: 4599,
      }),
    ).toThrow('Split line amounts must equal the transaction total.');
  });

  it('keeps standard split validation sign-specific by default', () => {
    expect(() =>
      validateSplitTransactionLines({
        kind: 'income',
        lines: [
          line({ id: 'salary', amountMinor: 230000, categoryId: 'income', subcategoryId: 'salary' }),
          line({ id: 'tax', amountMinor: -60000, categoryId: 'tax', subcategoryId: 'withholding' }),
        ],
        totalMinor: 170000,
      }),
    ).toThrow('Income split line amounts must be positive.');
  });

  it('validates mixed net-income split totals using signed line amounts', () => {
    expect(() =>
      validateSplitTransactionLines({
        kind: 'income',
        mode: 'mixed',
        lines: [
          line({ id: 'salary', amountMinor: 230000, categoryId: 'income', subcategoryId: 'salary' }),
          line({ id: 'tax', amountMinor: -60000, categoryId: 'tax', subcategoryId: 'withholding' }),
        ],
        totalMinor: 170000,
      }),
    ).not.toThrow();
  });

  it('validates mixed net-expense split totals using signed line amounts', () => {
    expect(() =>
      validateSplitTransactionLines({
        kind: 'expense',
        mode: 'mixed',
        lines: [
          line({ id: 'refund', amountMinor: 20000, categoryId: 'income', subcategoryId: 'refund' }),
          line({ id: 'spending', amountMinor: -50000, categoryId: 'food', subcategoryId: 'groceries' }),
        ],
        totalMinor: 30000,
      }),
    ).not.toThrow();
  });

  it('rejects mixed splits when signed lines do not net to the parent total', () => {
    expect(() =>
      validateSplitTransactionLines({
        kind: 'income',
        mode: 'mixed',
        lines: [
          line({ id: 'salary', amountMinor: 230000, categoryId: 'income', subcategoryId: 'salary' }),
          line({ id: 'tax', amountMinor: -60000, categoryId: 'tax', subcategoryId: 'withholding' }),
        ],
        totalMinor: 160000,
      }),
    ).toThrow('Mixed split lines must net to the transaction total.');
  });

  it('rejects zero mixed split line amounts', () => {
    expect(() =>
      validateSplitTransactionLines({
        kind: 'income',
        mode: 'mixed',
        lines: [
          line({ id: 'salary', amountMinor: 170000, categoryId: 'income', subcategoryId: 'salary' }),
          line({ id: 'tax', amountMinor: 0, categoryId: 'tax', subcategoryId: 'withholding' }),
        ],
        totalMinor: 170000,
      }),
    ).toThrow('Split line amounts must be greater than zero.');
  });

  it('rejects split lines across mixed accounts', () => {
    expect(() =>
      validateSplitTransactionLines({
        kind: 'expense',
        lines: [line({ id: 'a' }), line({ id: 'b', accountId: 'account-2' })],
      }),
    ).toThrow('Split lines must use the same account.');
  });

  it('rejects split lines across mixed currencies', () => {
    expect(() =>
      validateSplitTransactionLines({
        kind: 'expense',
        lines: [line({ id: 'a' }), line({ id: 'b', currencyCode: 'USD' })],
      }),
    ).toThrow('Split lines must use the same currency.');
  });

  it('rejects empty split line amounts', () => {
    expect(() =>
      validateSplitTransactionLines({
        kind: 'expense',
        lines: [line({ id: 'a' }), line({ id: 'b', amountMinor: 0 })],
      }),
    ).toThrow('Split line amounts must be greater than zero.');
  });

  it('rejects transfers as split transactions', () => {
    expect(() =>
      validateSplitTransactionLines({
        kind: transfer.kind,
        lines: [line({ id: 'a' }), line({ id: 'b' })],
      }),
    ).toThrow('Transfers cannot be split.');
  });

  it('rejects split lines without categories and subcategories', () => {
    expect(() =>
      validateSplitTransactionLines({
        kind: 'expense',
        lines: [line({ id: 'a' }), line({ id: 'b', categoryId: '', subcategoryId: '' })],
      }),
    ).toThrow('Choose a category and subcategory for every split line.');
  });

  it('builds signed expense transaction lines from draft split lines', () => {
    expect(
      buildSplitTransactionLines({
        kind: 'expense',
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

  it('builds signed income transaction lines from draft split lines', () => {
    expect(
      buildSplitTransactionLines({
        kind: 'income',
        accountId: 'account-1',
        currencyCode: 'aud',
        totalMinor: 3000,
        splitLines: [
          { amountMinor: 1000, categoryId: 'income', subcategoryId: 'salary', note: 'Salary' },
          { amountMinor: 2000, categoryId: 'income', subcategoryId: 'bonus' },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        accountId: 'account-1',
        amountMinor: 1000,
        currencyCode: 'AUD',
        categoryId: 'income',
        subcategoryId: 'salary',
        note: 'Salary',
      }),
      expect.objectContaining({
        amountMinor: 2000,
        categoryId: 'income',
        subcategoryId: 'bonus',
      }),
    ]);
  });

  it('builds signed mixed net-income transaction lines from draft split lines', () => {
    expect(
      buildMixedSplitTransactionLines({
        kind: 'income',
        accountId: 'account-1',
        currencyCode: 'aud',
        parentTitle: 'Pay',
        totalMinor: 170000,
        splitLines: [
          { kind: 'income', amountMinor: 230000, categoryId: 'income', subcategoryId: 'salary', note: 'Salary' },
          { kind: 'expense', amountMinor: 60000, categoryId: 'tax', subcategoryId: 'withholding' },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        amountMinor: 230000,
        categoryId: 'income',
        subcategoryId: 'salary',
        note: 'Salary',
      }),
      expect.objectContaining({
        amountMinor: -60000,
        categoryId: 'tax',
        subcategoryId: 'withholding',
        note: 'Pay',
      }),
    ]);
  });

  it('builds signed mixed net-expense transaction lines from draft split lines', () => {
    expect(
      buildMixedSplitTransactionLines({
        kind: 'expense',
        accountId: 'account-1',
        currencyCode: 'aud',
        totalMinor: 30000,
        splitLines: [
          { kind: 'income', amountMinor: 20000, categoryId: 'income', subcategoryId: 'refund' },
          { kind: 'expense', amountMinor: 50000, categoryId: 'food', subcategoryId: 'groceries' },
        ],
      }).map((builtLine) => builtLine.amountMinor),
    ).toEqual([20000, -50000]);
  });
});
