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
  line('income-1', 4000, 'AUD', 'acct-side-income'),
  line('income-1', -500, 'AUD', 'acct-adjustment'),
  line('income-2', 2500, 'AUD'),
  line('expense-1', -7000, 'AUD'),
  line('expense-1', -3000, 'AUD', 'acct-side-expense'),
  line('expense-1', 500, 'AUD', 'acct-refund'),
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
    sourceLineId: null,
    targetLineId: null,
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

  it('allows one source income transaction to link to multiple expenses', () => {
    expect(() =>
      validateTransactionLinkInput({
        input: input({ targetTransactionId: 'expense-2' }),
        transactions,
        lines,
        existingLinks: [existingLink()],
      }),
    ).not.toThrow();
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

  it('accepts line-level source and target references when they belong to the linked transactions', () => {
    expect(
      validateTransactionLinkInput({
        input: input({
          sourceLineId: 'income-1-acct-1-5000',
          targetLineId: 'expense-1-acct-1--7000',
        }),
        transactions,
        lines,
      }),
    ).toEqual(
      expect.objectContaining({
        sourceLineId: 'income-1-acct-1-5000',
        targetLineId: 'expense-1-acct-1--7000',
      }),
    );
  });

  it('rejects line-level references that do not belong to the linked transactions', () => {
    expect(() =>
      validateTransactionLinkInput({
        input: input({ sourceLineId: 'income-2-acct-1-2500' }),
        transactions,
        lines,
      }),
    ).toThrow('Source transaction line does not belong to the source transaction.');

    expect(() =>
      validateTransactionLinkInput({
        input: input({ targetLineId: 'expense-2-acct-1--3000' }),
        transactions,
        lines,
      }),
    ).toThrow('Target transaction line does not belong to the target transaction.');
  });

  it('rejects source and target line references with the wrong sign', () => {
    expect(() =>
      validateTransactionLinkInput({
        input: input({ sourceLineId: 'income-1-acct-adjustment--500' }),
        transactions,
        lines,
      }),
    ).toThrow('Source transaction line must be income.');

    expect(() =>
      validateTransactionLinkInput({
        input: input({ targetLineId: 'expense-1-acct-refund-500' }),
        transactions,
        lines,
      }),
    ).toThrow('Target transaction line must be expense.');
  });

  it('uses line IDs when checking duplicate identical links', () => {
    expect(() =>
      validateTransactionLinkInput({
        input: input({ targetLineId: 'expense-1-acct-1--7000' }),
        transactions,
        lines,
        existingLinks: [existingLink({ targetLineId: 'expense-2-acct-1--3000' })],
      }),
    ).not.toThrow();
  });

  it('rejects allocations above source transaction and source line amounts', () => {
    expect(() =>
      validateTransactionLinkInput({
        input: input({ amountMinor: 8000 }),
        transactions,
        lines,
        existingLinks: [existingLink({ amountMinor: 1500 })],
      }),
    ).toThrow('Linked amounts cannot exceed the source income transaction.');

    expect(() =>
      validateTransactionLinkInput({
        input: input({ sourceLineId: 'income-1-acct-1-5000', amountMinor: 1000 }),
        transactions,
        lines,
        existingLinks: [existingLink({ sourceLineId: 'income-1-acct-1-5000', amountMinor: 4500 })],
      }),
    ).toThrow('Linked amounts cannot exceed the source income line.');
  });

  it('rejects allocations above target transaction and target line amounts', () => {
    expect(() =>
      validateTransactionLinkInput({
        input: input({ amountMinor: 1500 }),
        transactions,
        lines,
        existingLinks: [existingLink({ sourceTransactionId: 'income-2', amountMinor: 9000 })],
      }),
    ).toThrow('Linked amounts cannot exceed the target expense transaction.');

    expect(() =>
      validateTransactionLinkInput({
        input: input({ targetLineId: 'expense-1-acct-1--7000', amountMinor: 1000 }),
        transactions,
        lines,
        existingLinks: [existingLink({ targetLineId: 'expense-1-acct-1--7000', amountMinor: 6500 })],
      }),
    ).toThrow('Linked amounts cannot exceed the target expense line.');
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
