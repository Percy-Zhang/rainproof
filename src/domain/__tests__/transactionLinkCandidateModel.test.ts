import { defaultCategories } from '../categories';
import {
  DEFAULT_TRANSACTION_LINK_CANDIDATE_FILTER,
  deriveExpenseLinkTargetCandidateViews,
  deriveIncomeLinkSourceCandidateViews,
  getDefaultLinkAllocationAmountMinor,
  getLinkAllocationEditableMaximumMinor,
  getTransactionLinkCandidateStatusBuckets,
  getTransactionLinkSourceOptionViews,
  getTransactionLinkTargetScopeViews,
  getTransactionLinkTargetOptionViews,
  prepareIncomeLinkSourceCandidateViews,
} from '../transactionLinkCandidateModel';
import { getTransactionLinkAllocationStatus } from '../transactionLinkAllocationStatus';
import type { Account, Transaction, TransactionLine, TransactionLink, TransactionLinkBatchInput } from '../types';

describe('transaction link candidate model', () => {
  it('defaults to Open and combines authoritative status filters with draft changes', () => {
    expect(DEFAULT_TRANSACTION_LINK_CANDIDATE_FILTER).toBe('open');
    const snapshot = sourceCandidateSnapshot();
    const persistedLinks = [
      link({ id: 'partial-link', sourceTransactionId: 'income-partial', amountMinor: 4000 }),
      link({ id: 'settled-link', sourceTransactionId: 'income-settled', amountMinor: 3000 }),
    ];
    snapshot.transactionLinks = persistedLinks;

    const open = deriveSourceCandidates(snapshot, { filter: 'open' });
    expect(open.map((candidate) => candidate.transaction.id)).toEqual(
      expect.arrayContaining(['income-exact', 'income-close']),
    );
    expect(open.map((candidate) => candidate.transaction.id)).not.toContain('income-partial');
    expect(open.map((candidate) => candidate.transaction.id)).not.toContain('income-settled');

    expect(deriveSourceCandidates(snapshot, { filter: 'partial' }).map((candidate) => candidate.transaction.id))
      .toEqual(['income-partial']);
    expect(deriveSourceCandidates(snapshot, { filter: 'settled' }).map((candidate) => candidate.transaction.id))
      .toEqual(['income-settled']);
    expect(deriveSourceCandidates(snapshot, { filter: 'all' }).map((candidate) => candidate.transaction.id))
      .toEqual(expect.arrayContaining(['income-exact', 'income-close', 'income-partial', 'income-settled']));

    const draftChanges: TransactionLinkBatchInput = {
      deleteIds: ['settled-link'],
      toAdd: [{
        sourceTransactionId: 'income-exact',
        targetTransactionId: 'expense-current',
        linkType: 'reimbursement',
        amountMinor: 2000,
        currencyCode: 'AUD',
      }],
      toUpdate: [{
        id: 'partial-link',
        sourceTransactionId: 'income-partial',
        targetTransactionId: 'expense-current',
        linkType: 'reimbursement',
        amountMinor: 7000,
        currencyCode: 'AUD',
      }],
    };
    const draftCandidates = deriveSourceCandidates(snapshot, { filter: 'all', draftChanges });
    expect(draftCandidates.find((item) => item.transaction.id === 'income-exact')?.status.allocatedMinor).toBe(2000);
    expect(draftCandidates.find((item) => item.transaction.id === 'income-partial')?.status.remainingMinor).toBe(3000);
    expect(draftCandidates.find((item) => item.transaction.id === 'income-settled')?.status.status).toBe('unlinked');
  });

  it('composes search with exact Open and Partial filter semantics', () => {
    const snapshot = sourceCandidateSnapshot();
    snapshot.transactionLinks = [
      link({ id: 'partial-link', sourceTransactionId: 'income-partial', amountMinor: 4000 }),
    ];

    expect(deriveIncomeLinkSourceCandidateViews({
      snapshot,
      currencyCode: 'AUD',
      currentTransaction: snapshot.transactions.find((item) => item.id === 'expense-current')!,
      draftChanges: { toAdd: [], toUpdate: [], deleteIds: [] },
      filter: 'open',
      query: 'partial',
    })).toEqual([]);
    expect(deriveIncomeLinkSourceCandidateViews({
      snapshot,
      currencyCode: 'AUD',
      currentTransaction: snapshot.transactions.find((item) => item.id === 'expense-current')!,
      draftChanges: { toAdd: [], toUpdate: [], deleteIds: [] },
      filter: 'partial',
      query: 'partial',
    }).map((candidate) => candidate.transaction.id)).toEqual(['income-partial']);
  });

  it('precomputes stable status buckets and candidate icon identity', () => {
    const snapshot = sourceCandidateSnapshot();
    snapshot.transactionLinks = [
      link({ id: 'partial-link', sourceTransactionId: 'income-partial', amountMinor: 4000 }),
      link({ id: 'settled-link', sourceTransactionId: 'income-settled', amountMinor: 3000 }),
    ];
    const prepared = prepareIncomeLinkSourceCandidateViews({
      snapshot,
      currencyCode: 'AUD',
      currentTransaction: snapshot.transactions.find((item) => item.id === 'expense-current')!,
      draftChanges: { toAdd: [], toUpdate: [], deleteIds: [] },
    });
    const buckets = getTransactionLinkCandidateStatusBuckets(prepared);

    expect(buckets.partial.map((candidate) => candidate.transaction.id)).toEqual(['income-partial']);
    expect(buckets.partial[0].presentation.statusLabel).toBe('Linked $40.00 · Remaining $60.00');
    expect(buckets.settled.map((candidate) => candidate.transaction.id)).toEqual(['income-settled']);
    expect(buckets.open.map((candidate) => candidate.transaction.id)).not.toEqual(
      expect.arrayContaining(['income-partial', 'income-settled']),
    );
    expect(buckets.all).toEqual(prepared);
    expect(prepared[0]).toEqual(expect.objectContaining({
      iconCategoryId: expect.any(String),
      iconSubcategoryId: expect.any(String),
      presentation: {
        accountName: 'Everyday',
        amountLabel: '+$55.00',
        amountTone: 'positive',
        dateLabel: 'Jul 12',
        iconColor: expect.any(String),
        iconName: expect.any(String),
        parentLabel: 'Parent transaction',
        statusLabel: 'Remaining $55.00',
        title: 'Exact',
      },
    }));
  });

  it('sorts candidates with the same newest-first transaction ordering regardless of amount match', () => {
    const snapshot = sourceCandidateSnapshot();
    snapshot.transactions.push(transaction('income-exact-z', 'income', 'Exact Z', '2026-07-11T10:00:00.000Z'));
    snapshot.transactionLines.push(line('income-exact-z-line', 'income-exact-z', 5500));
    const first = deriveSourceCandidates(snapshot, { filter: 'open' });
    const second = deriveSourceCandidates({ ...snapshot, transactions: [...snapshot.transactions].reverse() }, { filter: 'open' });

    expect(first.map((item) => item.transaction.id)).toEqual([
      'income-exact',
      'income-exact-z',
      'income-close',
      'income-partial',
      'income-settled',
      'income-old',
    ]);
    expect(first.map((item) => item.transaction.id)).toEqual(second.map((item) => item.transaction.id));
  });

  it('uses Transactions created-time and id tie-breaks for equal datetimes', () => {
    const snapshot = sourceCandidateSnapshot();
    const datetime = '2026-07-14T10:00:00.000Z';
    snapshot.transactions.push(
      { ...transaction('income-tie-a', 'income', 'Tie A', datetime), createdAt: '2026-07-14T10:01:00.000Z' },
      { ...transaction('income-tie-b', 'income', 'Tie B', datetime), createdAt: '2026-07-14T10:02:00.000Z' },
      { ...transaction('income-tie-c', 'income', 'Tie C', datetime), createdAt: '2026-07-14T10:02:00.000Z' },
    );
    snapshot.transactionLines.push(
      line('income-tie-a-line', 'income-tie-a', 1000),
      line('income-tie-b-line', 'income-tie-b', 1000),
      line('income-tie-c-line', 'income-tie-c', 1000),
    );

    expect(deriveSourceCandidates(snapshot, { filter: 'open' }).slice(0, 3).map((item) => item.transaction.id))
      .toEqual(['income-tie-c', 'income-tie-b', 'income-tie-a']);
  });

  it('searches title, external party, amount, account, category, subcategory, note, and currency', () => {
    const snapshot = expenseCandidateSnapshot();
    const queries = [
      'friend dinner',
      'alice',
      '55.00',
      'holiday wallet',
      'food',
      'restaurants',
      'shared table',
      'aud',
    ];

    for (const query of queries) {
      expect(deriveTargetCandidates(snapshot, query).map((candidate) => candidate.transaction.id))
        .toContain('expense-search');
    }
  });

  it('does not match date text while retaining matching transaction text', () => {
    const snapshot = expenseCandidateSnapshot();
    snapshot.transactions.push(
      transaction('expense-june-date', 'expense', 'Groceries', '2026-06-12T10:00:00.000Z'),
      transaction('expense-jun-name', 'expense', 'Lunch with Jun', '2026-05-12T10:00:00.000Z'),
    );
    snapshot.transactionLines.push(
      line('expense-june-date-line', 'expense-june-date', -1200),
      line('expense-jun-name-line', 'expense-jun-name', -1800),
    );

    expect(deriveTargetCandidates(snapshot, 'Jun').map((candidate) => candidate.transaction.id))
      .toEqual(['expense-jun-name']);
    expect(deriveTargetCandidates(snapshot, '12 Jun')).toEqual([]);
  });

  it('keeps older results beyond twelve discoverable without an arbitrary domain cap', () => {
    const snapshot = expenseCandidateSnapshot();
    for (let index = 0; index < 16; index += 1) {
      const id = `expense-extra-${index}`;
      snapshot.transactions.push(transaction(id, 'expense', index === 15 ? 'Older special receipt' : `Expense ${index}`, `2026-06-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`));
      snapshot.transactionLines.push(line(`${id}-line`, id, -1000));
    }

    expect(deriveTargetCandidates(snapshot, 'older special').map((candidate) => candidate.transaction.id))
      .toEqual(['expense-extra-15']);
    expect(deriveTargetCandidates(snapshot, '').length).toBeGreaterThan(12);
  });

  it('keeps currencies isolated and excludes incompatible candidates from every filter', () => {
    const snapshot = expenseCandidateSnapshot();
    snapshot.transactions.push(transaction('expense-usd', 'expense', 'USD expense'));
    snapshot.transactionLines.push(line('expense-usd-line', 'expense-usd', -5500, { currencyCode: 'USD' }));

    expect(deriveExpenseCandidates(snapshot, { filter: 'open' }).map((item) => item.transaction.id))
      .not.toContain('expense-usd');
    expect(deriveExpenseCandidates(snapshot, { filter: 'all' }).map((item) => item.transaction.id))
      .not.toContain('expense-usd');
  });

  it('calculates defaults and editable replacement limits without double-spending draft capacity', () => {
    const lines = [line('income-line', 'income', 10000), line('expense-line', 'expense', -8000)];
    const persistedLinks = [link({ id: 'edit', sourceTransactionId: 'income', targetTransactionId: 'expense', amountMinor: 5000 })];
    const draftChanges: TransactionLinkBatchInput = {
      deleteIds: [],
      toAdd: [{ sourceTransactionId: 'income', targetTransactionId: 'expense-2', linkType: 'reimbursement', amountMinor: 2000, currencyCode: 'AUD' }],
      toUpdate: [{ id: 'edit', sourceTransactionId: 'income', targetTransactionId: 'expense', linkType: 'reimbursement', amountMinor: 4000, currencyCode: 'AUD' }],
    };
    const sourceStatus = getTransactionLinkAllocationStatus({
      transactionId: 'income', currencyCode: 'AUD', side: 'source', lines, persistedLinks, draftChanges,
    });
    const targetStatus = getTransactionLinkAllocationStatus({
      transactionId: 'expense', currencyCode: 'AUD', side: 'target', lines, persistedLinks, draftChanges,
    });

    expect(sourceStatus).toEqual(expect.objectContaining({ allocatedMinor: 6000, remainingMinor: 4000 }));
    expect(targetStatus).toEqual(expect.objectContaining({ allocatedMinor: 4000, remainingMinor: 4000 }));
    expect(getDefaultLinkAllocationAmountMinor(sourceStatus, targetStatus)).toBe(4000);
    expect(getLinkAllocationEditableMaximumMinor({ currentAmountMinor: 4000, sourceStatus, targetStatus })).toBe(8000);
  });

  it('keeps whole-scope and direct split-line target allocations distinct', () => {
    const expense = transaction('split-expense', 'expense', 'Split expense');
    const transactionLines = [
      line('food-line', 'split-expense', -6000),
      line('drinks-line', 'split-expense', -4000),
    ];
    const transactionLinks = [
      link({ id: 'whole', targetTransactionId: 'split-expense', targetLineId: null, amountMinor: 3000 }),
      link({ id: 'food', targetTransactionId: 'split-expense', targetLineId: 'food-line', amountMinor: 2000 }),
    ];
    const options = getTransactionLinkTargetOptionViews({
      transaction: expense,
      currencyCode: 'AUD',
      snapshot: { transactionLines, transactionLinks },
      draftChanges: { toAdd: [], toUpdate: [], deleteIds: [] },
    });

    expect(options.map((option) => option.targetLineId)).toEqual(['food-line', 'drinks-line']);
    const scopes = getTransactionLinkTargetScopeViews({
      transaction: expense,
      snapshot: { transactionLines, transactionLinks },
      draftChanges: { toAdd: [], toUpdate: [], deleteIds: [] },
    });
    expect(scopes.find((scope) => scope.targetLineId === null)).toEqual(
      expect.objectContaining({
        selectable: false,
        status: expect.objectContaining({ allocatedMinor: 5000, remainingMinor: 5000 }),
      }),
    );
    expect(options.find((option) => option.targetLineId === 'food-line')?.status).toEqual(
      expect.objectContaining({ directAllocatedMinor: 2000, wholeScopeAllocatedMinor: 3000, remainingMinor: 4000 }),
    );
    expect(options.find((option) => option.targetLineId === 'drinks-line')?.status).toEqual(
      expect.objectContaining({ directAllocatedMinor: 0, wholeScopeAllocatedMinor: 3000, remainingMinor: 4000 }),
    );
  });

  it('discovers a negative split line inside a net-positive parent and aggregates its status', () => {
    const snapshot = expenseCandidateSnapshot();
    snapshot.transactions.push(transaction('paycheck', 'income', 'Paycheck'));
    snapshot.transactionLines.push(
      line('salary-line', 'paycheck', 380000, { note: 'Salary' }),
      line('tax-line', 'paycheck', -80000, { note: 'Tax withheld' }),
    );

    const candidate = deriveExpenseCandidates(snapshot, { filter: 'open' })
      .find((item) => item.transaction.id === 'paycheck');

    expect(candidate).toEqual(expect.objectContaining({
      lineCount: 2,
      parentKind: 'mixed',
      selectable: false,
      signedAmountMinor: -80000,
      status: expect.objectContaining({ originalMinor: 80000, remainingMinor: 80000, status: 'unlinked' }),
    }));

    const options = getTransactionLinkTargetOptionViews({
      transaction: candidate!.transaction,
      currencyCode: 'AUD',
      snapshot,
      draftChanges: { toAdd: [], toUpdate: [], deleteIds: [] },
    });
    expect(options.map((option) => option.targetLineId)).toEqual(['tax-line']);
    expect(options[0]).toEqual(expect.objectContaining({ amountMinor: 80000, eligible: true }));

    snapshot.transactionLinks = [link({
      id: 'tax-allocation',
      sourceTransactionId: 'income-current',
      targetTransactionId: 'paycheck',
      targetLineId: 'tax-line',
      amountMinor: 50000,
    })];
    expect(deriveExpenseCandidates(snapshot, { filter: 'open' }).map((item) => item.transaction.id))
      .not.toContain('paycheck');
    expect(deriveExpenseCandidates(snapshot, { filter: 'partial' }).find((item) => item.transaction.id === 'paycheck'))
      .toEqual(expect.objectContaining({ status: expect.objectContaining({ remainingMinor: 30000 }) }));

    snapshot.transactionLinks = [{ ...snapshot.transactionLinks[0], amountMinor: 80000 }];
    expect(deriveExpenseCandidates(snapshot, { filter: 'partial' }).map((item) => item.transaction.id))
      .not.toContain('paycheck');
    expect(deriveExpenseCandidates(snapshot, { filter: 'settled' }).find((item) => item.transaction.id === 'paycheck'))
      .toEqual(expect.objectContaining({ status: expect.objectContaining({ remainingMinor: 0, status: 'settled' }) }));
    expect(deriveExpenseCandidates(snapshot, { filter: 'all' }).map((item) => item.transaction.id))
      .toContain('paycheck');
  });

  it('discovers a positive split line inside a net-negative parent', () => {
    const snapshot = sourceCandidateSnapshot();
    snapshot.transactions.push(transaction('mixed-expense', 'expense', 'Mixed expense'));
    snapshot.transactionLines.push(
      line('purchase-line', 'mixed-expense', -80000),
      line('refund-line', 'mixed-expense', 30000, { note: 'Refund portion' }),
    );

    const candidate = deriveSourceCandidates(snapshot, { filter: 'open' })
      .find((item) => item.transaction.id === 'mixed-expense');

    expect(candidate).toEqual(expect.objectContaining({
      lineCount: 2,
      parentKind: 'mixed',
      selectable: false,
      signedAmountMinor: 30000,
      status: expect.objectContaining({ originalMinor: 30000, remainingMinor: 30000 }),
    }));
    expect(getTransactionLinkSourceOptionViews({
      transaction: candidate!.transaction,
      currencyCode: 'AUD',
      snapshot,
      draftChanges: { toAdd: [], toUpdate: [], deleteIds: [] },
    }).map((option) => option.sourceLineId)).toEqual(['refund-line']);
  });

  it('keeps transfer parents out of scope-aware candidate discovery', () => {
    const snapshot = expenseCandidateSnapshot();
    snapshot.transactions.push(transaction('transfer-parent', 'transfer', 'Transfer'));
    snapshot.transactionLines.push(line('transfer-target', 'transfer-parent', -5500));

    expect(deriveExpenseCandidates(snapshot, { filter: 'all' }).map((item) => item.transaction.id))
      .not.toContain('transfer-parent');
  });
});

function deriveSourceCandidates(
  snapshot: ReturnType<typeof sourceCandidateSnapshot>,
  overrides: { filter?: 'open' | 'partial' | 'settled' | 'all'; draftChanges?: TransactionLinkBatchInput } = {},
) {
  return deriveIncomeLinkSourceCandidateViews({
    snapshot,
    currencyCode: 'AUD',
    currentTransaction: snapshot.transactions.find((item) => item.id === 'expense-current')!,
    draftChanges: overrides.draftChanges ?? { toAdd: [], toUpdate: [], deleteIds: [] },
    filter: overrides.filter ?? 'open',
    query: '',
  });
}

function deriveExpenseCandidates(
  snapshot: ReturnType<typeof expenseCandidateSnapshot>,
  overrides: { filter?: 'open' | 'partial' | 'settled' | 'all'; query?: string } = {},
) {
  return deriveExpenseLinkTargetCandidateViews({
    snapshot,
    currencyCode: 'AUD',
    currentTransaction: snapshot.transactions.find((item) => item.id === 'income-current')!,
    draftChanges: { toAdd: [], toUpdate: [], deleteIds: [] },
    filter: overrides.filter ?? 'all',
    query: overrides.query ?? '',
  });
}

function deriveTargetCandidates(snapshot: ReturnType<typeof expenseCandidateSnapshot>, query: string) {
  return deriveExpenseCandidates(snapshot, { filter: 'all', query });
}

function sourceCandidateSnapshot() {
  return {
    accounts: [account('account', 'Everyday')],
    categories: defaultCategories,
    transactions: [
      transaction('expense-current', 'expense', 'Current expense', '2026-07-12T10:00:00.000Z'),
      transaction('income-exact', 'income', 'Exact', '2026-07-12T09:00:00.000Z'),
      transaction('income-close', 'income', 'Close', '2026-07-10T10:00:00.000Z'),
      transaction('income-partial', 'income', 'Partial', '2026-07-09T10:00:00.000Z'),
      transaction('income-settled', 'income', 'Settled', '2026-07-08T10:00:00.000Z'),
      transaction('income-old', 'income', 'Old', '2026-01-01T10:00:00.000Z'),
    ],
    transactionLines: [
      line('expense-current-line', 'expense-current', -5500),
      line('income-exact-line', 'income-exact', 5500),
      line('income-close-line', 'income-close', 6000),
      line('income-partial-line', 'income-partial', 10000),
      line('income-settled-line', 'income-settled', 3000),
      line('income-old-line', 'income-old', 9000),
    ],
    transactionLinks: [] as TransactionLink[],
  };
}

function expenseCandidateSnapshot() {
  const searchLine = line('expense-search-line', 'expense-search', -5500, {
    accountId: 'holiday',
    categoryId: 'food-dining',
    subcategoryId: 'restaurants',
    externalParty: 'Alice',
    note: 'Shared table',
  });
  return {
    accounts: [account('account', 'Everyday'), account('holiday', 'Holiday Wallet')],
    categories: defaultCategories,
    transactions: [
      transaction('income-current', 'income', 'Current income', '2026-07-13T10:00:00.000Z'),
      transaction('expense-search', 'expense', 'Friend dinner', '2026-07-12T10:00:00.000Z'),
    ],
    transactionLines: [line('income-current-line', 'income-current', 10000), searchLine],
    transactionLinks: [] as TransactionLink[],
  };
}

function transaction(id: string, kind: Transaction['kind'], title: string, datetime = '2026-07-01T10:00:00.000Z'): Transaction {
  return { id, kind, title, datetime, notes: '', labels: [], groupId: '', createdAt: datetime, updatedAt: datetime };
}

function line(id: string, transactionId: string, amountMinor: number, overrides: Partial<TransactionLine> = {}): TransactionLine {
  return {
    id,
    transactionId,
    accountId: 'account',
    amountMinor,
    currencyCode: 'AUD',
    categoryId: amountMinor > 0 ? 'income' : 'food-dining',
    subcategoryId: amountMinor > 0 ? 'reimbursement' : 'restaurants',
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  };
}

function link(overrides: Partial<TransactionLink> = {}): TransactionLink {
  return {
    id: 'link',
    sourceTransactionId: 'income-exact',
    targetTransactionId: 'expense-current',
    sourceLineId: null,
    targetLineId: null,
    linkType: 'reimbursement',
    amountMinor: 1000,
    currencyCode: 'AUD',
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  };
}

function account(id: string, name: string): Account {
  return {
    id,
    name,
    nickname: '',
    type: 'checking',
    currencyCode: 'AUD',
    openingBalanceMinor: 0,
    notes: '',
    institutionName: '',
    includeInRainyDay: true,
    themeColor: '',
    iconName: '',
    showOnDashboard: true,
    sortOrder: 0,
    isArchived: false,
    createdAt: '',
    updatedAt: '',
  };
}
