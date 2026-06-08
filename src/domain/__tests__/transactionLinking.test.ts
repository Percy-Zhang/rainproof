import {
  getExpenseLinkTargetCandidates,
  getIncomeLinkTreatment,
  getIncomeLinkSourceCandidates,
  getLinkedCounterpartDisplayLabelForEndpoint,
  getTransactionLinkCounterpartDisplayLabel,
  getTransactionLinkEndpointDisplay,
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
      title: 'Linked transaction',
      detail: 'Paid back for: Groceries / May 17',
      secondaryDetail: 'Linked amount: AUD $25.00',
    });
  });

  it('labels split-line linked endpoints with split item and parent context', () => {
    const splitExpenseLine = line(
      'expense-split-line',
      'expense-aud',
      -1800,
      'AUD',
      'food',
      'groceries',
    );

    expect(
      getTransactionLinkCounterpartDisplayLabel({
        link: link({ targetLineId: 'expense-split-line' }),
        endpoint: 'target',
        transactions,
        lines: [{ ...splitExpenseLine, note: 'Snacks' }],
      }),
    ).toBe('Snacks · Groceries / May 17');
  });

  it('uses split item title with subcategory metadata for linked endpoint display', () => {
    const splitExpenseLine = line(
      'expense-split-line',
      'expense-aud',
      -1800,
      'AUD',
      'food',
      'groceries',
    );

    expect(
      getTransactionLinkEndpointDisplay({
        transactionId: 'expense-aud',
        lineId: 'expense-split-line',
        transactions,
        lines: [{ ...splitExpenseLine, note: 'Snacks' }],
      }),
    ).toEqual({
      kind: 'split-line',
      title: 'Snacks',
      metadata: 'Groceries',
      dateLabel: 'May 17',
      context: 'Groceries / May 17',
      label: 'Snacks · Groceries / May 17',
    });
  });

  it('uses parent fallback for blank split-line linked endpoint labels', () => {
    expect(
      getTransactionLinkCounterpartDisplayLabel({
        link: link({ targetLineId: 'expense-aud-line' }),
        endpoint: 'target',
        transactions,
        lines,
      }),
    ).toBe('Groceries / May 17');
  });

  it('uses split category as the blank split-line title with parent context', () => {
    const splitIncomeLine = line('income-bonus-line', 'income', 500, 'AUD', 'income', 'bonus');

    expect(
      getTransactionLinkEndpointDisplay({
        transactionId: 'income',
        lineId: 'income-bonus-line',
        transactions,
        lines: [...lines, splitIncomeLine],
      }),
    ).toEqual({
      kind: 'split-line',
      title: 'Bonus',
      metadata: '',
      dateLabel: 'May 17',
      context: 'May 17',
      label: 'Bonus · Refund / May 17',
    });
  });

  it('returns structured parent linked endpoint display', () => {
    expect(
      getTransactionLinkEndpointDisplay({
        transactionId: 'expense-aud',
        lineId: null,
        transactions,
        lines,
      }),
    ).toEqual({
      kind: 'parent',
      title: 'Groceries',
      metadata: '',
      dateLabel: 'May 17',
      context: 'May 17',
      label: 'Groceries / May 17',
    });
  });

  it('does not fall back to the parent when a split-line link id cannot be resolved', () => {
    expect(
      getTransactionLinkCounterpartDisplayLabel({
        link: link({ targetLineId: 'missing-line' }),
        endpoint: 'target',
        transactions,
        lines,
      }),
    ).toBe('');
  });

  it('returns missing endpoint display without guessing when a split line cannot be resolved', () => {
    expect(
      getTransactionLinkEndpointDisplay({
        transactionId: 'expense-aud',
        lineId: 'missing-line',
        transactions,
        lines,
      }),
    ).toEqual({
      kind: 'missing',
      title: '',
      metadata: '',
      dateLabel: '',
      context: '',
      label: '',
    });
  });

  it('resolves linked-to labels from the current source or target endpoint', () => {
    expect(
      getLinkedCounterpartDisplayLabelForEndpoint({
        endpoint: 'source',
        transactionId: 'income',
        lineId: null,
        transactions,
        lines,
        transactionLinks: [link({ targetLineId: 'expense-aud-line' })],
      }),
    ).toBe('Groceries / May 17');
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
      title: 'Linked transaction',
      detail: 'Refund from: Refund / May 17 / Received back: AUD $15.00',
      secondaryDetail: 'Original: AUD $40.00 / Counted in stats: AUD $25.00',
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
      }).secondaryDetail,
    ).toBe('Original: AUD $40.00 / Counted in stats: AUD $0.00');
  });
});
