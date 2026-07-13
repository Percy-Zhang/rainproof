import {
  getTransactionLineLinkAllocationStatus,
  getTransactionLinkAllocationStatus,
} from '../transactionLinkAllocationStatus';
import type {
  NewTransactionLinkInput,
  TransactionLine,
  TransactionLink,
  TransactionLinkBatchInput,
} from '../types';

describe('transaction link allocation status', () => {
  it('derives unlinked, partial, settled, and over-allocated whole source states', () => {
    expect(sourceStatus([])).toEqual(expect.objectContaining({
      originalMinor: 10000,
      allocatedMinor: 0,
      remainingMinor: 10000,
      status: 'unlinked',
    }));
    expect(sourceStatus([link({ amountMinor: 3000 })])).toEqual(expect.objectContaining({
      allocatedMinor: 3000,
      remainingMinor: 7000,
      linkCount: 1,
      status: 'partial',
    }));
    expect(sourceStatus([
      link({ id: 'a', amountMinor: 3000 }),
      link({ id: 'b', targetTransactionId: 'expense-2', amountMinor: 7000 }),
    ])).toEqual(expect.objectContaining({
      allocatedMinor: 10000,
      remainingMinor: 0,
      linkCount: 2,
      status: 'settled',
    }));
    expect(sourceStatus([link({ amountMinor: 11000 })])).toEqual(expect.objectContaining({
      remainingMinor: 0,
      overAllocatedMinor: 1000,
      parentOverAllocatedMinor: 1000,
      status: 'settled',
    }));
  });

  it('derives target remaining capacity from multiple incoming payments', () => {
    const status = targetStatus([
      link({ id: 'a', amountMinor: 2500 }),
      link({ id: 'b', sourceTransactionId: 'income-2', amountMinor: 3500 }),
    ]);

    expect(status).toEqual(expect.objectContaining({
      originalMinor: 10000,
      allocatedMinor: 6000,
      remainingMinor: 4000,
      linkCount: 2,
      status: 'partial',
    }));
  });

  it('derives unlinked, settled, and legacy over-allocated target states', () => {
    expect(targetStatus([])).toEqual(expect.objectContaining({
      originalMinor: 10000,
      allocatedMinor: 0,
      remainingMinor: 10000,
      status: 'unlinked',
    }));
    expect(targetStatus([link({ amountMinor: 10000 })])).toEqual(expect.objectContaining({
      allocatedMinor: 10000,
      remainingMinor: 0,
      status: 'settled',
    }));
    expect(targetStatus([link({ amountMinor: 12000 })])).toEqual(expect.objectContaining({
      allocatedMinor: 12000,
      remainingMinor: 0,
      parentOverAllocatedMinor: 2000,
      status: 'settled',
    }));
  });

  it('does not attribute whole-source links to either split line', () => {
    const links = [link({ id: 'whole', amountMinor: 3000, sourceLineId: null })];
    const food = sourceLineStatus('source-food', links);
    const drinks = sourceLineStatus('source-drinks', links);

    expect(food).toEqual(expect.objectContaining({
      originalMinor: 6000,
      allocatedMinor: 0,
      wholeScopeAllocatedMinor: 3000,
      parentAllocatedMinor: 3000,
      remainingMinor: 6000,
      linkCount: 0,
      status: 'unlinked',
    }));
    expect(drinks).toEqual(expect.objectContaining({
      originalMinor: 4000,
      allocatedMinor: 0,
      wholeScopeAllocatedMinor: 3000,
      remainingMinor: 4000,
      linkCount: 0,
    }));
  });

  it('tracks direct split-source allocations while enforcing parent capacity', () => {
    const status = sourceLineStatus('source-food', [
      link({ id: 'whole', amountMinor: 3000, sourceLineId: null }),
      link({ id: 'food', amountMinor: 2000, sourceLineId: 'source-food' }),
      link({ id: 'drinks', amountMinor: 4000, sourceLineId: 'source-drinks' }),
    ]);

    expect(status).toEqual(expect.objectContaining({
      directAllocatedMinor: 2000,
      directRemainingMinor: 4000,
      wholeScopeAllocatedMinor: 3000,
      otherLineAllocatedMinor: 4000,
      parentAllocatedMinor: 9000,
      parentRemainingMinor: 1000,
      remainingMinor: 1000,
      linkCount: 1,
      status: 'partial',
    }));
  });

  it('supports multiple direct allocations from one source split line', () => {
    const status = sourceLineStatus('source-food', [
      link({ id: 'a', amountMinor: 1500, sourceLineId: 'source-food' }),
      link({ id: 'b', targetTransactionId: 'expense-2', amountMinor: 2500, sourceLineId: 'source-food' }),
    ]);

    expect(status).toEqual(expect.objectContaining({
      allocatedMinor: 4000,
      remainingMinor: 2000,
      linkCount: 2,
      status: 'partial',
    }));
  });

  it('does not attribute whole-target payments to expense split lines', () => {
    const links = [link({ id: 'whole', amountMinor: 3000, targetLineId: null })];
    const status = targetLineStatus('target-food', links);

    expect(status).toEqual(expect.objectContaining({
      originalMinor: 6000,
      allocatedMinor: 0,
      wholeScopeAllocatedMinor: 3000,
      parentAllocatedMinor: 3000,
      remainingMinor: 6000,
      status: 'unlinked',
    }));
  });

  it('supports multiple direct payments to one target split line', () => {
    const status = targetLineStatus('target-food', [
      link({ id: 'a', amountMinor: 2000, targetLineId: 'target-food' }),
      link({ id: 'b', sourceTransactionId: 'income-2', amountMinor: 4000, targetLineId: 'target-food' }),
    ]);

    expect(status).toEqual(expect.objectContaining({
      allocatedMinor: 6000,
      remainingMinor: 0,
      linkCount: 2,
      status: 'settled',
    }));
  });

  it('applies persisted updates as replacements instead of double-counting them', () => {
    const draftChanges: TransactionLinkBatchInput = {
      deleteIds: [],
      toAdd: [linkInput({ targetTransactionId: 'expense-2', amountMinor: 2000 })],
      toUpdate: [{ id: 'persisted', ...linkInput({ amountMinor: 2000 }) }],
    };
    const status = sourceStatus([link({ id: 'persisted', amountMinor: 5000 })], draftChanges);

    expect(status).toEqual(expect.objectContaining({
      allocatedMinor: 4000,
      remainingMinor: 6000,
      linkCount: 2,
      invalidDraftChangeCount: 0,
    }));
  });

  it('applies draft deletions and multiple unsaved additions by stable identity', () => {
    const draftChanges: TransactionLinkBatchInput = {
      deleteIds: ['remove'],
      toAdd: [
        linkInput({ targetTransactionId: 'expense-2', amountMinor: 1000 }),
        linkInput({ targetTransactionId: 'expense-3', amountMinor: 1500 }),
      ],
      toUpdate: [],
    };
    const status = sourceStatus([
      link({ id: 'keep', amountMinor: 2000 }),
      link({ id: 'remove', targetTransactionId: 'expense-4', amountMinor: 3000 }),
    ], draftChanges);

    expect(status).toEqual(expect.objectContaining({
      allocatedMinor: 4500,
      remainingMinor: 5500,
      linkCount: 3,
    }));
  });

  it('keeps currencies separate without conversion', () => {
    const status = sourceStatus([
      link({ id: 'aud', amountMinor: 3000, currencyCode: 'AUD' }),
      link({ id: 'usd', amountMinor: 5000, currencyCode: 'USD' }),
    ]);

    expect(status).toEqual(expect.objectContaining({
      currencyCode: 'AUD',
      originalMinor: 10000,
      allocatedMinor: 3000,
      remainingMinor: 7000,
      linkCount: 1,
    }));
  });

  it('surfaces malformed relevant links without counting them as usable allocations', () => {
    const status = sourceStatus([
      link({ id: 'valid', amountMinor: 2000 }),
      link({ id: 'negative', amountMinor: -100 }),
      link({ id: 'missing-line', amountMinor: 500, sourceLineId: 'missing' }),
    ]);

    expect(status).toEqual(expect.objectContaining({
      allocatedMinor: 2000,
      remainingMinor: 8000,
      invalidLinkCount: 2,
    }));
  });
});

const lines: TransactionLine[] = [
  transactionLine({ id: 'source-food', transactionId: 'income-1', amountMinor: 6000 }),
  transactionLine({ id: 'source-drinks', transactionId: 'income-1', amountMinor: 4000 }),
  transactionLine({ id: 'target-food', transactionId: 'expense-1', amountMinor: -6000 }),
  transactionLine({ id: 'target-drinks', transactionId: 'expense-1', amountMinor: -4000 }),
  transactionLine({ id: 'source-second', transactionId: 'income-2', amountMinor: 10000 }),
  transactionLine({ id: 'target-second', transactionId: 'expense-2', amountMinor: -10000 }),
  transactionLine({ id: 'target-third', transactionId: 'expense-3', amountMinor: -10000 }),
  transactionLine({ id: 'target-fourth', transactionId: 'expense-4', amountMinor: -10000 }),
  transactionLine({ id: 'source-usd', transactionId: 'income-1', amountMinor: 5000, currencyCode: 'USD' }),
];

function sourceStatus(
  persistedLinks: TransactionLink[],
  draftChanges?: TransactionLinkBatchInput,
) {
  return getTransactionLinkAllocationStatus({
    transactionId: 'income-1',
    currencyCode: 'AUD',
    side: 'source',
    lines,
    persistedLinks,
    draftChanges,
  });
}

function targetStatus(persistedLinks: TransactionLink[]) {
  return getTransactionLinkAllocationStatus({
    transactionId: 'expense-1',
    currencyCode: 'AUD',
    side: 'target',
    lines,
    persistedLinks,
  });
}

function sourceLineStatus(lineId: string, persistedLinks: TransactionLink[]) {
  return getTransactionLineLinkAllocationStatus({
    transactionId: 'income-1',
    lineId,
    currencyCode: 'AUD',
    side: 'source',
    lines,
    persistedLinks,
  });
}

function targetLineStatus(lineId: string, persistedLinks: TransactionLink[]) {
  return getTransactionLineLinkAllocationStatus({
    transactionId: 'expense-1',
    lineId,
    currencyCode: 'AUD',
    side: 'target',
    lines,
    persistedLinks,
  });
}

function transactionLine(overrides: Partial<TransactionLine>): TransactionLine {
  return {
    id: 'line',
    transactionId: 'transaction',
    accountId: 'account',
    amountMinor: 0,
    currencyCode: 'AUD',
    categoryId: '',
    subcategoryId: '',
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: '',
    ...overrides,
  };
}

function link(overrides: Partial<TransactionLink> = {}): TransactionLink {
  return {
    id: 'link',
    sourceTransactionId: 'income-1',
    targetTransactionId: 'expense-1',
    sourceLineId: null,
    targetLineId: null,
    linkType: 'reimbursement',
    amountMinor: 1000,
    currencyCode: 'AUD',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function linkInput(overrides: Partial<NewTransactionLinkInput> = {}): NewTransactionLinkInput {
  return {
    sourceTransactionId: 'income-1',
    targetTransactionId: 'expense-1',
    sourceLineId: null,
    targetLineId: null,
    linkType: 'reimbursement',
    amountMinor: 1000,
    currencyCode: 'AUD',
    ...overrides,
  };
}
