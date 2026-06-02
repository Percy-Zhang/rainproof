import {
  getExpenseLinkTargetCandidates,
  getIncomeLinkTreatment,
  getIncomeLinkSourceCandidates,
  getTransactionLinkEditSummary,
  getTransactionLinkSourceAmount,
} from '../transactionLinking';
import type { Transaction, TransactionLine, TransactionLink } from '../types';

const now = new Date(2026, 4, 17, 12).toISOString();

const transactions: Transaction[] = [
  transaction('income', 'income', 'Refund'),
  transaction('expense-aud', 'expense', 'Groceries'),
  transaction('expense-usd', 'expense', 'Airport snack'),
  transaction('transfer', 'transfer', 'Move money'),
];

const lines: TransactionLine[] = [
  line('income-line', 'income', 2500, 'AUD', 'income', 'refund'),
  line('expense-aud-line', 'expense-aud', -4000, 'AUD', 'food', 'groceries'),
  line('expense-usd-line', 'expense-usd', -1800, 'USD', 'food', 'restaurants'),
  line('transfer-out', 'transfer', -1000, 'AUD', '', ''),
  line('transfer-in', 'transfer', 1000, 'AUD', '', ''),
];

function transaction(id: string, kind: Transaction['kind'], title: string): Transaction {
  return {
    id,
    kind,
    title,
    datetime: now,
    notes: '',
    labels: [],
    groupId: '',
    createdAt: now,
    updatedAt: now,
  };
}

function line(
  id: string,
  transactionId: string,
  amountMinor: number,
  currencyCode: string,
  categoryId: string,
  subcategoryId: string,
): TransactionLine {
  return {
    id,
    transactionId,
    accountId: 'acct-1',
    amountMinor,
    currencyCode,
    categoryId,
    subcategoryId,
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: now,
  };
}

function link(overrides: Partial<TransactionLink> = {}): TransactionLink {
  return {
    id: 'link-1',
    sourceTransactionId: 'income',
    targetTransactionId: 'expense-aud',
    linkType: 'refund',
    amountMinor: 2500,
    currencyCode: 'AUD',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function formatTestMoney(amountMinor: number, currencyCode: string): string {
  return `${currencyCode} $${(amountMinor / 100).toFixed(2)}`;
}

describe('transaction linking helpers', () => {
  it('detects normal income and linked income treatments', () => {
    expect(getIncomeLinkTreatment('income', [])).toBe('normal');
    expect(getIncomeLinkTreatment('income', [link({ linkType: 'reimbursement' })])).toBe('reimbursement');
  });

  it('gets the positive income amount for link creation', () => {
    expect(getTransactionLinkSourceAmount('income', lines)).toEqual({
      amountMinor: 2500,
      currencyCode: 'AUD',
    });
  });

  it('returns expense targets only and marks currency mismatches disabled', () => {
    const candidates = getExpenseLinkTargetCandidates({
      sourceTransactionId: 'income',
      sourceCurrencyCode: 'AUD',
      transactions,
      lines,
      query: '',
    });

    expect(candidates.map((candidate) => candidate.transaction.id)).toEqual(['expense-usd', 'expense-aud']);
    expect(candidates.find((candidate) => candidate.transaction.id === 'expense-aud')?.eligible).toBe(true);
    expect(candidates.find((candidate) => candidate.transaction.id === 'expense-usd')).toEqual(
      expect.objectContaining({ eligible: false, disabledReason: 'Different currency' }),
    );
  });

  it('searches eligible expense targets by transaction title and category fields', () => {
    expect(
      getExpenseLinkTargetCandidates({
        sourceTransactionId: 'income',
        sourceCurrencyCode: 'AUD',
        transactions,
        lines,
        query: 'groc',
      }).map((candidate) => candidate.transaction.id),
    ).toEqual(['expense-aud']);

    expect(
      getExpenseLinkTargetCandidates({
        sourceTransactionId: 'income',
        sourceCurrencyCode: 'AUD',
        transactions,
        lines,
        query: 'restaurants',
      }).map((candidate) => candidate.transaction.id),
    ).toEqual(['expense-usd']);
  });

  it('marks already-linked parent expense targets in link selection data', () => {
    const candidates = getExpenseLinkTargetCandidates({
      sourceTransactionId: 'income',
      sourceCurrencyCode: 'AUD',
      transactions,
      lines,
      transactionLinks: [link({ targetLineId: null })],
      query: '',
    });

    expect(candidates.find((candidate) => candidate.transaction.id === 'expense-aud')?.isLinked).toBe(true);
    expect(candidates.find((candidate) => candidate.transaction.id === 'expense-usd')?.isLinked).toBe(false);
  });

  it('returns already-linked same-currency income sources as eligible for additional allocations', () => {
    const candidates = getIncomeLinkSourceCandidates({
      targetTransactionId: 'expense-aud',
      targetCurrencyCode: 'AUD',
      transactions,
      lines,
      transactionLinks: [link({ targetTransactionId: 'expense-usd' })],
      query: '',
    });

    expect(candidates.map((candidate) => candidate.transaction.id)).toEqual(['income']);
    expect(candidates[0]).toEqual(
      expect.objectContaining({ eligible: true, disabledReason: '' }),
    );
  });

  it('marks already-linked parent income sources in link selection data', () => {
    const candidates = getIncomeLinkSourceCandidates({
      targetTransactionId: 'expense-aud',
      targetCurrencyCode: 'AUD',
      transactions,
      lines,
      transactionLinks: [link({ sourceLineId: null })],
      query: '',
    });

    expect(candidates.find((candidate) => candidate.transaction.id === 'income')?.isLinked).toBe(true);
  });

  it('allows an unlinked same-currency income source for an expense', () => {
    const candidates = getIncomeLinkSourceCandidates({
      targetTransactionId: 'expense-aud',
      targetCurrencyCode: 'AUD',
      transactions,
      lines,
      transactionLinks: [],
      query: 'refund',
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        transaction: expect.objectContaining({ id: 'income' }),
        amountMinor: 2500,
        currencyCode: 'AUD',
        eligible: true,
      }),
    ]);
  });

  it('summarizes linked income with the target expense item and amount', () => {
    expect(
      getTransactionLinkEditSummary({
        transactionId: 'income',
        transactions,
        lines,
        transactionLinks: [link({ linkType: 'reimbursement' })],
        formatAmount: formatTestMoney,
      }),
    ).toEqual({
      linked: true,
      title: 'Paid back for: Groceries',
      detail: 'Linked amount: AUD $25.00',
      secondaryDetail: '',
    });
  });

  it('summarizes income linked to multiple expense allocations', () => {
    expect(
      getTransactionLinkEditSummary({
        transactionId: 'income',
        transactions,
        lines,
        transactionLinks: [
          link({ id: 'link-1', amountMinor: 1000, linkType: 'refund' }),
          link({ id: 'link-2', amountMinor: 1500, targetTransactionId: 'expense-usd', linkType: 'reimbursement' }),
        ],
        formatAmount: formatTestMoney,
      }),
    ).toEqual({
      linked: true,
      title: 'Linked to 2 expenses',
      detail: 'Linked amount: AUD $25.00',
      secondaryDetail: 'Refund: AUD $10.00 / Reimbursement: AUD $15.00',
    });
  });

  it('summarizes linked expense money received and counted amount', () => {
    expect(
      getTransactionLinkEditSummary({
        transactionId: 'expense-aud',
        transactions,
        lines,
        transactionLinks: [link({ amountMinor: 1500 })],
        formatAmount: formatTestMoney,
      }),
    ).toEqual({
      linked: true,
      title: 'Money received back: AUD $15.00',
      detail: 'Original: AUD $40.00 / Counted in stats: AUD $25.00',
      secondaryDetail: 'Refund: AUD $15.00',
    });
  });

  it('clamps linked expense counted amount at zero for full refunds and overpayments', () => {
    expect(
      getTransactionLinkEditSummary({
        transactionId: 'expense-aud',
        transactions,
        lines,
        transactionLinks: [link({ amountMinor: 5000 })],
        formatAmount: formatTestMoney,
      }).detail,
    ).toBe('Original: AUD $40.00 / Counted in stats: AUD $0.00');
  });
});
