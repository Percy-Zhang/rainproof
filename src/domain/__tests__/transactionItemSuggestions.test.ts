import {
  getFilteredTransactionItemNameSuggestions,
  getTransactionItemNameSuggestionValues,
} from '../transactionItemSuggestions';
import type { RecurringItem, Transaction, TransactionLine, TransactionTemplate } from '../types';

describe('transaction item-name suggestions', () => {
  it('deduplicates names, ignores blanks, and orders by frequency then recency', () => {
    const suggestions = getTransactionItemNameSuggestionValues({
      transactions: [
        transaction({ id: 'tx-1', title: 'Coffee', datetime: '2026-05-01T00:00:00.000Z' }),
        transaction({ id: 'tx-2', title: 'Groceries', datetime: '2026-05-20T00:00:00.000Z' }),
        transaction({ id: 'tx-3', title: ' coffee ', datetime: '2026-05-25T00:00:00.000Z' }),
        transaction({ id: 'tx-4', title: '   ', datetime: '2026-05-28T00:00:00.000Z' }),
      ],
    });

    expect(suggestions).toEqual(['Coffee', 'Groceries']);
  });

  it('includes transaction split-line notes as item suggestions', () => {
    const suggestions = getTransactionItemNameSuggestionValues({
      transactions: [transaction({ id: 'tx-1', title: 'Split shopping', datetime: '2026-05-20T00:00:00.000Z' })],
      transactionLines: [
        line({ transactionId: 'tx-1', note: 'Fruit and veg' }),
        line({ transactionId: 'tx-1', note: 'Bakery' }),
      ],
    });

    expect(suggestions).toEqual(['Bakery', 'Fruit and veg', 'Split shopping']);
  });

  it('includes active template item/name values and excludes archived templates', () => {
    const suggestions = getTransactionItemNameSuggestionValues({
      transactions: [],
      transactionTemplates: [
        template({ id: 'template-1', name: 'Coffee quick add', title: 'Coffee' }),
        template({ id: 'template-2', name: 'Archived lunch', title: 'Lunch', isActive: false }),
      ],
    });

    expect(suggestions).toEqual(['Coffee', 'Coffee quick add']);
  });

  it('includes active recurring item names and excludes inactive recurring items', () => {
    const suggestions = getTransactionItemNameSuggestionValues({
      transactions: [],
      recurringItems: [
        recurring({ id: 'recurring-1', name: 'Rent' }),
        recurring({ id: 'recurring-2', name: 'Old subscription', isActive: false }),
      ],
    });

    expect(suggestions).toEqual(['Rent']);
  });

  it('filters suggestions by typed text case-insensitively', () => {
    expect(
      getFilteredTransactionItemNameSuggestions(['Coffee', 'Groceries', 'Fuel'], 'co'),
    ).toEqual(['Coffee']);
    expect(
      getFilteredTransactionItemNameSuggestions(['Coffee', 'Groceries', 'Fuel'], 'F'),
    ).toEqual(['Coffee', 'Fuel']);
  });

  it('can exclude the current transaction/template/recurring record while editing', () => {
    const suggestions = getTransactionItemNameSuggestionValues({
      transactions: [
        transaction({ id: 'tx-current', title: 'Current transaction' }),
        transaction({ id: 'tx-other', title: 'Other transaction' }),
      ],
      transactionTemplates: [
        template({ id: 'template-current', name: 'Current template', title: 'Template title' }),
        template({ id: 'template-other', name: 'Other template', title: 'Other title' }),
      ],
      recurringItems: [
        recurring({ id: 'recurring-current', name: 'Current recurring' }),
        recurring({ id: 'recurring-other', name: 'Other recurring' }),
      ],
      excludeTransactionId: 'tx-current',
      excludeTemplateId: 'template-current',
      excludeRecurringItemId: 'recurring-current',
    });

    expect(suggestions).toEqual(expect.arrayContaining(['Other transaction', 'Other template', 'Other title', 'Other recurring']));
    expect(suggestions).not.toEqual(expect.arrayContaining(['Current transaction', 'Current template', 'Template title', 'Current recurring']));
  });

  it('keeps split-line suggestion filtering independent per query', () => {
    const values = ['Coffee', 'Groceries', 'Fuel'];

    expect(getFilteredTransactionItemNameSuggestions(values, 'co')).toEqual(['Coffee']);
    expect(getFilteredTransactionItemNameSuggestions(values, 'fu')).toEqual(['Fuel']);
  });
});

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    kind: 'expense',
    title: 'Groceries',
    datetime: '2026-05-01T00:00:00.000Z',
    notes: '',
    labels: [],
    groupId: '',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function line(overrides: Partial<TransactionLine>): TransactionLine {
  return {
    id: 'line-1',
    transactionId: 'tx-1',
    accountId: 'account-1',
    amountMinor: -1000,
    currencyCode: 'AUD',
    categoryId: 'food-dining',
    subcategoryId: 'groceries',
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function template(overrides: Partial<TransactionTemplate>): TransactionTemplate {
  return {
    id: 'template-1',
    name: 'Template',
    kind: 'expense',
    title: 'Template transaction',
    accountId: 'account-1',
    amountMinor: 1000,
    currencyCode: 'AUD',
    categoryId: 'food-dining',
    subcategoryId: 'groceries',
    notes: '',
    isActive: true,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function recurring(overrides: Partial<RecurringItem>): RecurringItem {
  return {
    id: 'recurring-1',
    name: 'Recurring item',
    kind: 'expense',
    amountMinor: 1000,
    currencyCode: 'AUD',
    accountId: 'account-1',
    categoryId: 'food-dining',
    subcategoryId: 'groceries',
    note: '',
    frequency: 'monthly',
    nextDueDate: '2026-05-28',
    isActive: true,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}
