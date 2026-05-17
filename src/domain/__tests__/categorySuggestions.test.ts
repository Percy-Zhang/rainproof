import { getCategorySuggestions } from '../categorySuggestions';
import type { Transaction, TransactionLine } from '../types';

function transaction(id: string, kind: Transaction['kind'], datetime: string, createdAt = datetime): Transaction {
  return {
    id,
    kind,
    title: '',
    datetime,
    notes: '',
    labels: [],
    groupId: '',
    createdAt,
    updatedAt: createdAt,
  };
}

function line(transactionId: string, categoryId: string, subcategoryId: string): TransactionLine {
  return {
    id: `${transactionId}-${categoryId}-${subcategoryId}`,
    transactionId,
    accountId: 'account-1',
    amountMinor: -100,
    currencyCode: 'AUD',
    categoryId,
    subcategoryId,
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: '',
  };
}

describe('category suggestions', () => {
  const transactions: Transaction[] = [
    transaction('tx-1', 'expense', '2026-05-20T10:00:00.000Z'),
    transaction('tx-2', 'expense', '2026-05-21T10:00:00.000Z'),
    transaction('tx-3', 'expense', '2026-05-22T10:00:00.000Z'),
    transaction('tx-4', 'income', '2026-05-23T10:00:00.000Z'),
    transaction('tx-5', 'transfer', '2026-05-24T10:00:00.000Z'),
    transaction('tx-6', 'expense', '2026-05-25T10:00:00.000Z'),
  ];

  const lines: TransactionLine[] = [
    line('tx-1', 'food', 'groceries'),
    line('tx-2', 'food', 'groceries'),
    line('tx-3', 'shopping', 'clothing'),
    line('tx-4', 'income', 'salary'),
    line('tx-5', '', ''),
    line('tx-6', 'health', ''),
  ];

  it('ranks frequent category pairs by usage count', () => {
    expect(getCategorySuggestions({ transactions, lines, kind: 'expense', mode: 'frequent' })).toEqual([
      { categoryId: 'food', subcategoryId: 'groceries' },
      { categoryId: 'health', subcategoryId: '' },
      { categoryId: 'shopping', subcategoryId: 'clothing' },
    ]);
  });

  it('returns distinct recent category pairs for the selected kind', () => {
    expect(getCategorySuggestions({ transactions, lines, kind: 'expense', mode: 'recent' })).toEqual([
      { categoryId: 'health', subcategoryId: '' },
      { categoryId: 'shopping', subcategoryId: 'clothing' },
      { categoryId: 'food', subcategoryId: 'groceries' },
    ]);
  });

  it('keeps income suggestions separate and excludes transfers', () => {
    expect(getCategorySuggestions({ transactions, lines, kind: 'income', mode: 'frequent' })).toEqual([
      { categoryId: 'income', subcategoryId: 'salary' },
    ]);
    expect(getCategorySuggestions({ transactions, lines, kind: 'transfer', mode: 'frequent' })).toEqual([]);
  });
});
