import {
  getRollbackForDeleteTransaction,
  patchSnapshotAfterAddTransaction,
  patchSnapshotAfterDeleteTransaction,
  rollbackSnapshotAfterOptimisticDeleteTransaction,
  rollbackSnapshotAfterOptimisticAddTransaction,
} from '../rainproofSnapshotPatches';
import type {
  Account,
  AppSnapshot,
  NewTransactionInput,
  Transaction,
  TransactionLink,
  TransactionLine,
} from '../../domain/types';

describe('patchSnapshotAfterAddTransaction', () => {
  it('patches a normal expense without changing amount or currency', () => {
    const input = newTransactionInput('expense', [
      { accountId: 'aud-checking', amountMinor: -1234, currencyCode: 'AUD', categoryId: 'food', subcategoryId: 'groceries' },
    ]);
    const line = transactionLine('line-expense', input.lines[0], 'txn-expense');
    const patched = patchSnapshotAfterAddTransaction(createSnapshot(), {
      input,
      lines: [line],
      transaction: transaction('txn-expense', 'expense'),
    });

    expect(patched?.transactions.map((item) => item.id)).toEqual(['txn-expense', 'txn-existing']);
    expect(patched?.transactionLines).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'line-expense',
        amountMinor: -1234,
        currencyCode: 'AUD',
        categoryId: 'food',
        subcategoryId: 'groceries',
      }),
    ]));
  });

  it('patches a normal income without changing amount or currency', () => {
    const input = newTransactionInput('income', [
      { accountId: 'aud-checking', amountMinor: 250000, currencyCode: 'AUD', categoryId: 'income', subcategoryId: 'salary' },
    ]);
    const line = transactionLine('line-income', input.lines[0], 'txn-income');
    const patched = patchSnapshotAfterAddTransaction(createSnapshot(), {
      input,
      lines: [line],
      transaction: transaction('txn-income', 'income'),
    });

    expect(patched?.transactionLines).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'line-income',
        amountMinor: 250000,
        currencyCode: 'AUD',
      }),
    ]));
  });

  it('patches same-currency transfer lines exactly', () => {
    const input = newTransactionInput('transfer', [
      { accountId: 'aud-checking', amountMinor: -5000, currencyCode: 'AUD', transferPeerAccountId: 'aud-savings' },
      { accountId: 'aud-savings', amountMinor: 5000, currencyCode: 'AUD', transferPeerAccountId: 'aud-checking' },
    ]);
    const lines = input.lines.map((line, index) => transactionLine(`line-transfer-${index}`, line, 'txn-transfer'));
    const patched = patchSnapshotAfterAddTransaction(createSnapshot(), {
      input,
      lines,
      transaction: transaction('txn-transfer', 'transfer'),
    });

    expect(patched?.transactionLines).toEqual(expect.arrayContaining([
      expect.objectContaining({ amountMinor: -5000, currencyCode: 'AUD', transferPeerAccountId: 'aud-savings' }),
      expect.objectContaining({ amountMinor: 5000, currencyCode: 'AUD', transferPeerAccountId: 'aud-checking' }),
    ]));
  });

  it('patches cross-currency transfer sent and received lines exactly', () => {
    const input = newTransactionInput('transfer', [
      { accountId: 'aud-checking', amountMinor: -170000, currencyCode: 'AUD', transferPeerAccountId: 'usd-wallet' },
      { accountId: 'usd-wallet', amountMinor: 110000, currencyCode: 'USD', transferPeerAccountId: 'aud-checking' },
    ]);
    const lines = input.lines.map((line, index) => transactionLine(`line-cross-${index}`, line, 'txn-cross-transfer'));
    const patched = patchSnapshotAfterAddTransaction(createSnapshot(), {
      input,
      lines,
      transaction: transaction('txn-cross-transfer', 'transfer'),
    });

    expect(patched?.transactionLines).toEqual(expect.arrayContaining([
      expect.objectContaining({ amountMinor: -170000, currencyCode: 'AUD' }),
      expect.objectContaining({ amountMinor: 110000, currencyCode: 'USD' }),
    ]));
  });

  it('patches split transaction lines exactly', () => {
    const input = newTransactionInput('expense', [
      { accountId: 'aud-checking', amountMinor: -4000, currencyCode: 'AUD', categoryId: 'food', subcategoryId: 'groceries' },
      { accountId: 'aud-checking', amountMinor: -2500, currencyCode: 'AUD', categoryId: 'bills', subcategoryId: 'electricity' },
    ]);
    const lines = input.lines.map((line, index) => transactionLine(`line-split-${index}`, line, 'txn-split'));
    const patched = patchSnapshotAfterAddTransaction(createSnapshot(), {
      input,
      lines,
      transaction: transaction('txn-split', 'expense'),
    });

    expect(patched?.transactionLines).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'line-split-0', amountMinor: -4000, categoryId: 'food' }),
      expect.objectContaining({ id: 'line-split-1', amountMinor: -2500, categoryId: 'bills' }),
    ]));
  });

  it('patches updated Add Transaction defaults', () => {
    const input = newTransactionInput('expense', [
      { accountId: 'aud-checking', amountMinor: -1234, currencyCode: 'AUD', categoryId: 'food', subcategoryId: 'groceries' },
    ]);
    const patched = patchSnapshotAfterAddTransaction(createSnapshot(), {
      addTransactionDefaults: {
        lastManualAccountId: 'aud-checking',
        lastCategoryByKind: {
          expense: { categoryId: 'food', subcategoryId: 'groceries' },
        },
      },
      input,
      lines: [transactionLine('line-defaults', input.lines[0], 'txn-defaults')],
      transaction: transaction('txn-defaults', 'expense'),
    });

    expect(patched?.settings.addTransactionDefaults).toEqual({
      lastManualAccountId: 'aud-checking',
      lastCategoryByKind: {
        expense: { categoryId: 'food', subcategoryId: 'groceries' },
      },
    });
  });

  it('falls back when persisted line data does not match the input', () => {
    const input = newTransactionInput('expense', [
      { accountId: 'aud-checking', amountMinor: -1234, currencyCode: 'AUD', categoryId: 'food', subcategoryId: 'groceries' },
    ]);

    expect(
      patchSnapshotAfterAddTransaction(createSnapshot(), {
        input,
        lines: [transactionLine('line-mismatch', { ...input.lines[0], amountMinor: -9999 }, 'txn-mismatch')],
        transaction: transaction('txn-mismatch', 'expense'),
      }),
    ).toBeNull();
  });

  it('rolls back an optimistic transaction and restores previous defaults', () => {
    const input = newTransactionInput('expense', [
      { accountId: 'aud-checking', amountMinor: -1234, currencyCode: 'AUD', categoryId: 'food', subcategoryId: 'groceries' },
    ]);
    const line = transactionLine('line-optimistic', input.lines[0], 'txn-optimistic');
    const patched = patchSnapshotAfterAddTransaction(createSnapshot(), {
      addTransactionDefaults: {
        lastManualAccountId: 'aud-checking',
        lastCategoryByKind: {
          expense: { categoryId: 'food', subcategoryId: 'groceries' },
        },
      },
      input,
      lines: [line],
      transaction: transaction('txn-optimistic', 'expense'),
    });

    expect(patched).not.toBeNull();

    const rolledBack = rollbackSnapshotAfterOptimisticAddTransaction(patched!, {
      lineIds: [line.id],
      optimisticAddTransactionDefaults: {
        lastManualAccountId: 'aud-checking',
        lastCategoryByKind: {
          expense: { categoryId: 'food', subcategoryId: 'groceries' },
        },
      },
      previousAddTransactionDefaults: {
        lastManualAccountId: 'usd-wallet',
      },
      transactionId: 'txn-optimistic',
    });

    expect(rolledBack?.transactions.map((item) => item.id)).toEqual(['txn-existing']);
    expect(rolledBack?.transactionLines.map((item) => item.id)).toEqual(['line-existing']);
    expect(rolledBack?.settings.addTransactionDefaults).toEqual({ lastManualAccountId: 'usd-wallet' });
  });

  it('falls back from rollback when optimistic lines are no longer exact', () => {
    const input = newTransactionInput('expense', [
      { accountId: 'aud-checking', amountMinor: -1234, currencyCode: 'AUD', categoryId: 'food', subcategoryId: 'groceries' },
    ]);
    const line = transactionLine('line-optimistic', input.lines[0], 'txn-optimistic');
    const patched = patchSnapshotAfterAddTransaction(createSnapshot(), {
      input,
      lines: [line],
      transaction: transaction('txn-optimistic', 'expense'),
    });

    expect(patched).not.toBeNull();

    expect(
      rollbackSnapshotAfterOptimisticAddTransaction({
        ...patched!,
        transactionLines: patched!.transactionLines.filter((item) => item.id !== line.id),
      }, {
        lineIds: [line.id],
        transactionId: 'txn-optimistic',
      }),
    ).toBeNull();
  });

  it('does not clobber defaults changed after the optimistic patch', () => {
    const input = newTransactionInput('expense', [
      { accountId: 'aud-checking', amountMinor: -1234, currencyCode: 'AUD', categoryId: 'food', subcategoryId: 'groceries' },
    ]);
    const line = transactionLine('line-optimistic', input.lines[0], 'txn-optimistic');
    const patched = patchSnapshotAfterAddTransaction(createSnapshot(), {
      addTransactionDefaults: { lastManualAccountId: 'aud-checking' },
      input,
      lines: [line],
      transaction: transaction('txn-optimistic', 'expense'),
    });

    expect(patched).not.toBeNull();

    const changedAfterPatch = {
      ...patched!,
      settings: {
        ...patched!.settings,
        addTransactionDefaults: { lastManualAccountId: 'usd-wallet' },
      },
    };
    const rolledBack = rollbackSnapshotAfterOptimisticAddTransaction(changedAfterPatch, {
      lineIds: [line.id],
      optimisticAddTransactionDefaults: { lastManualAccountId: 'aud-checking' },
      previousAddTransactionDefaults: {},
      transactionId: 'txn-optimistic',
    });

    expect(rolledBack?.settings.addTransactionDefaults).toEqual({ lastManualAccountId: 'usd-wallet' });
  });
});

describe('patchSnapshotAfterDeleteTransaction', () => {
  it('removes an expense transaction with its lines and parent/split links', () => {
    const snapshot = createLinkedDeleteSnapshot('expense', [
      {
        accountId: 'aud-checking',
        amountMinor: -1000,
        currencyCode: 'AUD',
        categoryId: 'food',
        subcategoryId: 'groceries',
      },
      {
        accountId: 'aud-checking',
        amountMinor: -500,
        currencyCode: 'AUD',
        categoryId: 'bills',
        subcategoryId: 'electricity',
      },
    ]);

    const patched = patchSnapshotAfterDeleteTransaction(snapshot, 'txn-delete');

    expect(patched?.transactions.some((transaction) => transaction.id === 'txn-delete')).toBe(false);
    expect(patched?.transactionLines.some((line) => line.transactionId === 'txn-delete')).toBe(false);
    expect(patched?.transactionLinks.map((link) => link.id)).toEqual([]);
    expect(patched?.transactions.some((transaction) => transaction.id === 'txn-source')).toBe(true);
  });

  it('removes income, same-currency transfer, cross-currency transfer, and mixed split shapes', () => {
    const cases = [
      createDeleteSnapshot('income', [
        { accountId: 'aud-checking', amountMinor: 1000, currencyCode: 'AUD', categoryId: 'income', subcategoryId: 'salary' },
      ]),
      createDeleteSnapshot('transfer', [
        { accountId: 'aud-checking', amountMinor: -1000, currencyCode: 'AUD', transferPeerAccountId: 'aud-savings' },
        { accountId: 'aud-savings', amountMinor: 1000, currencyCode: 'AUD', transferPeerAccountId: 'aud-checking' },
      ]),
      createDeleteSnapshot('transfer', [
        { accountId: 'aud-checking', amountMinor: -170000, currencyCode: 'AUD', transferPeerAccountId: 'usd-wallet' },
        { accountId: 'usd-wallet', amountMinor: 110000, currencyCode: 'USD', transferPeerAccountId: 'aud-checking' },
      ]),
      createDeleteSnapshot('expense', [
        { accountId: 'aud-checking', amountMinor: 230000, currencyCode: 'AUD', categoryId: 'income', subcategoryId: 'salary' },
        { accountId: 'aud-checking', amountMinor: -60000, currencyCode: 'AUD', categoryId: 'tax', subcategoryId: 'income-tax' },
      ]),
    ];

    for (const snapshot of cases) {
      const patched = patchSnapshotAfterDeleteTransaction(snapshot, 'txn-delete');

      expect(patched?.transactions.some((transaction) => transaction.id === 'txn-delete')).toBe(false);
      expect(patched?.transactionLines.some((line) => line.transactionId === 'txn-delete')).toBe(false);
    }
  });

  it('rolls back an optimistic delete exactly when the snapshot is still safe', () => {
    const snapshot = createLinkedDeleteSnapshot('expense', [
      {
        accountId: 'aud-checking',
        amountMinor: -1000,
        currencyCode: 'AUD',
        categoryId: 'food',
        subcategoryId: 'groceries',
      },
    ]);
    const rollback = getRollbackForDeleteTransaction(snapshot, 'txn-delete');

    expect(rollback).not.toBeNull();

    const patched = patchSnapshotAfterDeleteTransaction(snapshot, 'txn-delete');
    const rolledBack = rollbackSnapshotAfterOptimisticDeleteTransaction(patched!, rollback!);

    expect(rolledBack?.transactions).toEqual(snapshot.transactions);
    expect(rolledBack?.transactionLines).toEqual(snapshot.transactionLines);
    expect(rolledBack?.transactionLinks).toEqual(snapshot.transactionLinks);
  });

  it('falls back from delete rollback when a linked counterpart disappeared', () => {
    const snapshot = createLinkedDeleteSnapshot('expense', [
      {
        accountId: 'aud-checking',
        amountMinor: -1000,
        currencyCode: 'AUD',
        categoryId: 'food',
        subcategoryId: 'groceries',
      },
    ]);
    const rollback = getRollbackForDeleteTransaction(snapshot, 'txn-delete');
    const patched = patchSnapshotAfterDeleteTransaction(snapshot, 'txn-delete');

    expect(rollback).not.toBeNull();
    expect(patched).not.toBeNull();

    expect(
      rollbackSnapshotAfterOptimisticDeleteTransaction({
        ...patched!,
        transactions: patched!.transactions.filter((transaction) => transaction.id !== 'txn-source'),
      }, rollback!),
    ).toBeNull();
  });
});

function createSnapshot(): AppSnapshot {
  return {
    defaultCurrencyCode: 'AUD',
    settings: {
      defaultCurrencyCode: 'AUD',
      defaultCurrencyMode: 'manual',
      multiCurrencyEnabled: true,
      enabledCurrencyCodes: ['AUD', 'USD'],
      dashboardSelectedAccountIds: null,
      dashboardCardSettings: [],
      addTransactionDefaults: {},
    },
    categories: [],
    accounts: [
      account('aud-checking', 'AUD'),
      account('aud-savings', 'AUD'),
      account('usd-wallet', 'USD'),
    ],
    transactions: [transaction('txn-existing', 'expense', '2026-05-01T12:00:00.000Z')],
    transactionLines: [transactionLine('line-existing', {
      accountId: 'aud-checking',
      amountMinor: -1000,
      currencyCode: 'AUD',
      categoryId: 'food',
      subcategoryId: 'groceries',
    }, 'txn-existing')],
    transactionLinks: [],
    budgets: [],
    recurringItems: [],
    recurringBills: [],
    recurringTransactionHistory: [],
    transactionTemplates: [],
    rainyDayFund: {
      id: 'fund',
      name: 'Rainy day',
      currencyCode: 'AUD',
      goalMinor: 0,
      linkedAccountIds: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  };
}

function createDeleteSnapshot(
  kind: Transaction['kind'],
  lines: NewTransactionInput['lines'],
): AppSnapshot {
  return {
    ...createSnapshot(),
    transactions: [transaction('txn-delete', kind), transaction('txn-existing', 'expense', '2026-05-01T12:00:00.000Z')],
    transactionLines: lines.map((line, index) => transactionLine(`line-delete-${index}`, line, 'txn-delete')),
  };
}

function createLinkedDeleteSnapshot(
  kind: Transaction['kind'],
  lines: NewTransactionInput['lines'],
): AppSnapshot {
  const baseSnapshot = createDeleteSnapshot(kind, lines);
  const sourceTransaction = transaction('txn-source', 'income');
  const sourceLine = transactionLine('line-source', {
    accountId: 'aud-checking',
    amountMinor: 1000,
    currencyCode: 'AUD',
    categoryId: 'income',
    subcategoryId: 'reimbursement',
  }, sourceTransaction.id);
  const firstDeleteLine = baseSnapshot.transactionLines.find((line) => line.transactionId === 'txn-delete');

  return {
    ...baseSnapshot,
    transactions: [sourceTransaction, ...baseSnapshot.transactions],
    transactionLines: [sourceLine, ...baseSnapshot.transactionLines],
    transactionLinks: [
      transactionLink('link-parent', sourceTransaction.id, 'txn-delete'),
      transactionLink('link-line', sourceTransaction.id, 'txn-delete', sourceLine.id, firstDeleteLine?.id ?? null),
    ],
  };
}

function account(id: string, currencyCode: string): Account {
  return {
    id,
    name: id,
    nickname: '',
    type: 'checking',
    currencyCode,
    openingBalanceMinor: 0,
    creditLimitMinor: null,
    notes: '',
    institutionName: '',
    includeInRainyDay: false,
    themeColor: '#1876A8',
    iconName: '',
    showOnDashboard: true,
    sortOrder: 0,
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function newTransactionInput(
  kind: NewTransactionInput['kind'],
  lines: NewTransactionInput['lines'],
): NewTransactionInput {
  return {
    kind,
    title: `New ${kind}`,
    datetime: '2026-06-01T12:00:00.000Z',
    lines,
  };
}

function transaction(
  id: string,
  kind: Transaction['kind'],
  datetime = '2026-06-01T12:00:00.000Z',
): Transaction {
  return {
    id,
    kind,
    title: `New ${kind}`,
    datetime,
    notes: '',
    labels: [],
    groupId: '',
    createdAt: datetime,
    updatedAt: datetime,
  };
}

function transactionLine(
  id: string,
  line: NewTransactionInput['lines'][number],
  transactionId = 'txn-new',
): TransactionLine {
  return {
    id,
    transactionId,
    accountId: line.accountId,
    amountMinor: line.amountMinor,
    currencyCode: line.currencyCode,
    categoryId: line.categoryId ?? '',
    subcategoryId: line.subcategoryId ?? '',
    externalParty: line.externalParty ?? '',
    transferPeerAccountId: line.transferPeerAccountId ?? '',
    note: line.note ?? '',
    createdAt: '2026-06-01T12:00:00.000Z',
  };
}

function transactionLink(
  id: string,
  sourceTransactionId: string,
  targetTransactionId: string,
  sourceLineId: string | null = null,
  targetLineId: string | null = null,
): TransactionLink {
  return {
    id,
    sourceTransactionId,
    targetTransactionId,
    sourceLineId,
    targetLineId,
    linkType: 'reimbursement',
    amountMinor: 1000,
    currencyCode: 'AUD',
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-01T12:00:00.000Z',
  };
}
