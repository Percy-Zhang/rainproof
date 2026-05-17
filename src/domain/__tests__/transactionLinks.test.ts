import { validateTransactionLinkInput } from '../transactionLinks';
import type { NewTransactionLinkInput, Transaction, TransactionLine, TransactionLink } from '../types';

const transactions: Transaction[] = [
  transaction('income-1', 'income'),
  transaction('income-2', 'income'),
  transaction('expense-1', 'expense'),
  transaction('expense-2', 'expense'),
  transaction('transfer-1', 'transfer'),
];

const lines: TransactionLine[] = [
  line('income-1', 5000, 'AUD'),
  line('income-2', 2500, 'AUD'),
  line('expense-1', -7000, 'AUD'),
  line('expense-2', -3000, 'AUD'),
  line('transfer-1', -1000, 'AUD'),
  line('transfer-1', 1000, 'AUD', 'acct-2'),
];

function transaction(id: string, kind: Transaction['kind']): Transaction {
  return {
    id,
    kind,
    title: id,
    datetime: '2026-05-17T00:00:00.000Z',
    notes: '',
    labels: [],
    groupId: '',
    createdAt: '',
    updatedAt: '',
  };
}

function line(
  transactionId: string,
  amountMinor: number,
  currencyCode: string,
  accountId = 'acct-1',
): TransactionLine {
  return {
    id: `${transactionId}-${accountId}-${amountMinor}`,
    transactionId,
    accountId,
    amountMinor,
    currencyCode,
    categoryId: amountMinor > 0 ? 'income' : 'food',
    subcategoryId: amountMinor > 0 ? 'refund' : 'restaurants',
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: '',
  };
}

function input(overrides: Partial<NewTransactionLinkInput> = {}): NewTransactionLinkInput {
  return {
    sourceTransactionId: 'income-1',
    targetTransactionId: 'expense-1',
    linkType: 'refund',
    amountMinor: 1500,
    currencyCode: 'AUD',
    ...overrides,
  };
}

function existingLink(overrides: Partial<TransactionLink> = {}): TransactionLink {
  return {
    id: 'link-1',
    sourceTransactionId: 'income-1',
    targetTransactionId: 'expense-1',
    linkType: 'refund',
    amountMinor: 1500,
    currencyCode: 'AUD',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('transaction link validation', () => {
  it.each(['refund', 'reimbursement', 'shared_expense_contribution'] as const)(
    'accepts a valid %s link',
    (linkType) => {
      expect(
        validateTransactionLinkInput({
          input: input({ linkType }),
          transactions,
          lines,
        }),
      ).toEqual(expect.objectContaining({ linkType, currencyCode: 'AUD' }));
    },
  );

  it('rejects missing source or target transactions', () => {
    expect(() =>
      validateTransactionLinkInput({
        input: input({ sourceTransactionId: 'missing' }),
        transactions,
        lines,
      }),
    ).toThrow('Source transaction not found.');

    expect(() =>
      validateTransactionLinkInput({
        input: input({ targetTransactionId: 'missing' }),
        transactions,
        lines,
      }),
    ).toThrow('Target transaction not found.');
  });

  it('rejects self links and non-positive amounts', () => {
    expect(() =>
      validateTransactionLinkInput({
        input: input({ targetTransactionId: 'income-1' }),
        transactions,
        lines,
      }),
    ).toThrow('A transaction cannot link to itself.');

    expect(() =>
      validateTransactionLinkInput({
        input: input({ amountMinor: 0 }),
        transactions,
        lines,
      }),
    ).toThrow('Link amount must be greater than zero.');
  });

  it('rejects transfers as source or target transactions', () => {
    expect(() =>
      validateTransactionLinkInput({
        input: input({ sourceTransactionId: 'transfer-1' }),
        transactions,
        lines,
      }),
    ).toThrow('Source transaction must be income.');

    expect(() =>
      validateTransactionLinkInput({
        input: input({ targetTransactionId: 'transfer-1' }),
        transactions,
        lines,
      }),
    ).toThrow('Target transaction must be expense.');
  });

  it('rejects currency mismatches', () => {
    expect(() =>
      validateTransactionLinkInput({
        input: input({ currencyCode: 'USD' }),
        transactions,
        lines,
      }),
    ).toThrow('Link currency must match the source income transaction.');
  });

  it('rejects duplicate identical links', () => {
    expect(() =>
      validateTransactionLinkInput({
        input: input(),
        transactions,
        lines,
        existingLinks: [existingLink()],
      }),
    ).toThrow('This transaction link already exists.');
  });

  it('prevents one source income transaction from linking to multiple expenses', () => {
    expect(() =>
      validateTransactionLinkInput({
        input: input({ targetTransactionId: 'expense-2' }),
        transactions,
        lines,
        existingLinks: [existingLink()],
      }),
    ).toThrow('This income transaction is already linked to another expense.');
  });

  it('allows multiple income source transactions to link to one target expense', () => {
    expect(() =>
      validateTransactionLinkInput({
        input: input({ sourceTransactionId: 'income-2' }),
        transactions,
        lines,
        existingLinks: [existingLink()],
      }),
    ).not.toThrow();
  });

  it('allows an update to keep its own source transaction', () => {
    expect(() =>
      validateTransactionLinkInput({
        input: input({ amountMinor: 2000 }),
        transactions,
        lines,
        existingLinks: [existingLink()],
        currentLinkId: 'link-1',
      }),
    ).not.toThrow();
  });
});
