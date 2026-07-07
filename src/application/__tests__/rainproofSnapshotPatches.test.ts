import {
  getRollbackForDeleteTransaction,
  getRollbackForDeleteTransactionLink,
  getRollbackForEditTransaction,
  getRollbackForRecurringItemStateChange,
  getRollbackForTransactionLinkBatch,
  getRollbackForUpdateTransactionLink,
  patchSnapshotAfterRecurringItemStateChangeWithRollback,
  patchSnapshotAfterTransactionLinkBatchWithRollback,
  patchSnapshotAfterAddTransaction,
  patchSnapshotAfterAddTransactionLink,
  patchSnapshotAfterDeleteTransactionLinkWithRollback,
  patchSnapshotAfterDeleteTransaction,
  patchSnapshotAfterEditTransaction,
  patchSnapshotAfterUpdateTransactionLinkWithRollback,
  rollbackSnapshotAfterOptimisticAddTransactionLink,
  rollbackSnapshotAfterOptimisticDeleteTransactionLink,
  rollbackSnapshotAfterOptimisticDeleteTransaction,
  rollbackSnapshotAfterOptimisticEditTransaction,
  rollbackSnapshotAfterOptimisticRecurringItemStateChange,
  rollbackSnapshotAfterOptimisticTransactionLinkBatch,
  rollbackSnapshotAfterOptimisticUpdateTransactionLink,
  rollbackSnapshotAfterOptimisticAddTransaction,
} from '../rainproofSnapshotPatches';
import type {
  Account,
  AppSnapshot,
  NewTransactionInput,
  RecurringItem,
  Transaction,
  TransactionLink,
  TransactionLine,
  UpdateRecurringItemInput,
  UpdateTransactionInput,
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

describe('recurring item state snapshot patches', () => {
  it('patches and rolls back upcoming payment due state without touching ledger data', () => {
    const item = recurringItem();
    const snapshot = {
      ...createSnapshot(),
      recurringBills: [item],
      recurringItems: [item],
    };
    const rollback = getRollbackForRecurringItemStateChange(snapshot, item.id);
    const input = recurringUpdateInput(item, {
      nextDueDate: '2099-03-01',
    });

    const patched = patchSnapshotAfterRecurringItemStateChangeWithRollback(snapshot, input, rollback!);

    expect(patched?.recurringItems[0].nextDueDate).toBe('2099-03-01');
    expect(patched?.recurringBills[0].nextDueDate).toBe('2099-03-01');
    expect(patched?.transactions).toEqual(snapshot.transactions);
    expect(patched?.transactionLines).toEqual(snapshot.transactionLines);

    const optimisticItem = patched!.recurringItems[0];
    const rolledBack = rollbackSnapshotAfterOptimisticRecurringItemStateChange(patched!, rollback!, optimisticItem);

    expect(rolledBack?.recurringItems).toEqual(snapshot.recurringItems);
    expect(rolledBack?.recurringBills).toEqual(snapshot.recurringBills);
  });

  it('falls back when the recurring update changes non-state plan fields', () => {
    const item = recurringItem();
    const snapshot = {
      ...createSnapshot(),
      recurringBills: [item],
      recurringItems: [item],
    };
    const rollback = getRollbackForRecurringItemStateChange(snapshot, item.id);

    expect(
      patchSnapshotAfterRecurringItemStateChangeWithRollback(
        snapshot,
        recurringUpdateInput(item, { amountMinor: 2000, nextDueDate: '2099-03-01' }),
        rollback!,
      ),
    ).toBeNull();
  });
});

describe('patchSnapshotAfterEditTransaction', () => {
  it('patches normal expense and income edits without changing amount or currency unexpectedly', () => {
    const cases = [
      {
        kind: 'expense' as const,
        lines: [
          { accountId: 'aud-checking', amountMinor: -3000, currencyCode: 'AUD', categoryId: 'food', subcategoryId: 'groceries' },
        ],
      },
      {
        kind: 'income' as const,
        lines: [
          { accountId: 'aud-checking', amountMinor: 90000, currencyCode: 'AUD', categoryId: 'income', subcategoryId: 'salary' },
        ],
      },
    ];

    for (const testCase of cases) {
      const snapshot = createEditSnapshot(testCase.kind, [
        { accountId: 'aud-checking', amountMinor: testCase.kind === 'expense' ? -2500 : 80000, currencyCode: 'AUD' },
      ]);
      const existingLine = snapshot.transactionLines.find((line) => line.transactionId === 'txn-edit')!;
      const input = {
        id: 'txn-edit',
        kind: testCase.kind,
        title: `Edited ${testCase.kind}`,
        datetime: '2026-06-02T12:00:00.000Z',
        lines: [{ id: existingLine.id, ...testCase.lines[0] }],
      };
      const patch = createEditPatch(input, snapshot, input.lines);
      const patched = patchSnapshotAfterEditTransaction(snapshot, patch);

      expect(patched?.transactions.find((transaction) => transaction.id === 'txn-edit')).toEqual(
        expect.objectContaining({ title: `Edited ${testCase.kind}`, updatedAt: patch.transaction.updatedAt }),
      );
      expect(patched?.transactionLines.find((line) => line.id === existingLine.id)).toEqual(
        expect.objectContaining({
          amountMinor: testCase.lines[0].amountMinor,
          currencyCode: 'AUD',
        }),
      );
    }
  });

  it('patches same-currency transfer and cross-currency transfer edits exactly', () => {
    const cases = [
      [
        { accountId: 'aud-checking', amountMinor: -6000, currencyCode: 'AUD', transferPeerAccountId: 'aud-savings' },
        { accountId: 'aud-savings', amountMinor: 6000, currencyCode: 'AUD', transferPeerAccountId: 'aud-checking' },
      ],
      [
        { accountId: 'aud-checking', amountMinor: -170000, currencyCode: 'AUD', transferPeerAccountId: 'usd-wallet' },
        { accountId: 'usd-wallet', amountMinor: 110000, currencyCode: 'USD', transferPeerAccountId: 'aud-checking' },
      ],
    ];

    for (const lines of cases) {
      const snapshot = createEditSnapshot('transfer', [
        { accountId: 'aud-checking', amountMinor: -5000, currencyCode: 'AUD', transferPeerAccountId: 'aud-savings' },
        { accountId: 'aud-savings', amountMinor: 5000, currencyCode: 'AUD', transferPeerAccountId: 'aud-checking' },
      ]);
      const existingLines = snapshot.transactionLines.filter((line) => line.transactionId === 'txn-edit');
      const input = {
        id: 'txn-edit',
        kind: 'transfer' as const,
        title: 'Edited transfer',
        datetime: '2026-06-02T12:00:00.000Z',
        lines: lines.map((line, index) => ({ id: existingLines[index].id, ...line })),
      };
      const patched = patchSnapshotAfterEditTransaction(snapshot, createEditPatch(input, snapshot, input.lines));

      expect(patched?.transactionLines.filter((line) => line.transactionId === 'txn-edit')).toEqual(
        expect.arrayContaining(lines.map((line) => expect.objectContaining(line))),
      );
    }
  });

  it('patches split and mixed split edits while preserving kept line links', () => {
    const snapshot = createLinkedEditSnapshot('expense', [
      { accountId: 'aud-checking', amountMinor: -1000, currencyCode: 'AUD', categoryId: 'food', subcategoryId: 'groceries' },
      { accountId: 'aud-checking', amountMinor: -500, currencyCode: 'AUD', categoryId: 'bills', subcategoryId: 'electricity' },
    ]);
    const editLines = snapshot.transactionLines.filter((line) => line.transactionId === 'txn-edit');
    const input = {
      id: 'txn-edit',
      kind: 'expense' as const,
      title: 'Edited split',
      datetime: '2026-06-02T12:00:00.000Z',
      lines: [
        {
          id: editLines[0].id,
          accountId: 'aud-checking',
          amountMinor: 230000,
          currencyCode: 'AUD',
          categoryId: 'income',
          subcategoryId: 'salary',
        },
        {
          id: editLines[1].id,
          accountId: 'aud-checking',
          amountMinor: -60000,
          currencyCode: 'AUD',
          categoryId: 'tax',
          subcategoryId: 'income-tax',
        },
      ],
    };

    const patched = patchSnapshotAfterEditTransaction(snapshot, createEditPatch(input, snapshot, input.lines));

    expect(patched?.transactionLines.filter((line) => line.transactionId === 'txn-edit')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: editLines[0].id, amountMinor: 230000, categoryId: 'income' }),
        expect.objectContaining({ id: editLines[1].id, amountMinor: -60000, categoryId: 'tax' }),
      ]),
    );
    expect(patched?.transactionLinks.map((link) => link.id)).toEqual(['link-parent', 'link-line']);
  });

  it('removes links for split lines removed by an edit', () => {
    const snapshot = createLinkedEditSnapshot('expense', [
      { accountId: 'aud-checking', amountMinor: -1000, currencyCode: 'AUD', categoryId: 'food', subcategoryId: 'groceries' },
      { accountId: 'aud-checking', amountMinor: -500, currencyCode: 'AUD', categoryId: 'bills', subcategoryId: 'electricity' },
    ]);
    const editLines = snapshot.transactionLines.filter((line) => line.transactionId === 'txn-edit');
    const input = {
      id: 'txn-edit',
      kind: 'expense' as const,
      title: 'One-line edit',
      datetime: '2026-06-02T12:00:00.000Z',
      lines: [
        {
          id: editLines[1].id,
          accountId: 'aud-checking',
          amountMinor: -1500,
          currencyCode: 'AUD',
          categoryId: 'bills',
          subcategoryId: 'electricity',
        },
      ],
    };
    const patched = patchSnapshotAfterEditTransaction(snapshot, createEditPatch(input, snapshot, input.lines));

    expect(patched?.transactionLines.filter((line) => line.transactionId === 'txn-edit').map((line) => line.id)).toEqual([
      editLines[1].id,
    ]);
    expect(patched?.transactionLinks.map((link) => link.id)).toEqual(['link-parent']);
  });

  it('rolls back an optimistic edit exactly when still safe', () => {
    const snapshot = createLinkedEditSnapshot('expense', [
      { accountId: 'aud-checking', amountMinor: -1000, currencyCode: 'AUD', categoryId: 'food', subcategoryId: 'groceries' },
      { accountId: 'aud-checking', amountMinor: -500, currencyCode: 'AUD', categoryId: 'bills', subcategoryId: 'electricity' },
    ]);
    const rollback = getRollbackForEditTransaction(snapshot, 'txn-edit');
    const editLines = snapshot.transactionLines.filter((line) => line.transactionId === 'txn-edit');
    const input = {
      id: 'txn-edit',
      kind: 'expense' as const,
      title: 'Rolled back edit',
      datetime: '2026-06-02T12:00:00.000Z',
      lines: [
        {
          id: editLines[1].id,
          accountId: 'aud-checking',
          amountMinor: -1500,
          currencyCode: 'AUD',
          categoryId: 'bills',
          subcategoryId: 'electricity',
        },
      ],
    };
    const patch = createEditPatch(input, snapshot, input.lines);
    const patched = patchSnapshotAfterEditTransaction(snapshot, patch);
    const rolledBack = rollbackSnapshotAfterOptimisticEditTransaction(patched!, rollback!, patch);

    expect(rolledBack?.transactions).toEqual(snapshot.transactions);
    expect(rolledBack?.transactionLines).toEqual(snapshot.transactionLines);
    expect(rolledBack?.transactionLinks).toEqual(snapshot.transactionLinks);
  });

  it('falls back from edit rollback if the optimistic transaction changed again', () => {
    const snapshot = createEditSnapshot('expense', [
      { accountId: 'aud-checking', amountMinor: -1000, currencyCode: 'AUD', categoryId: 'food', subcategoryId: 'groceries' },
    ]);
    const rollback = getRollbackForEditTransaction(snapshot, 'txn-edit');
    const editLine = snapshot.transactionLines.find((line) => line.transactionId === 'txn-edit')!;
    const input = {
      id: 'txn-edit',
      kind: 'expense' as const,
      title: 'Edited expense',
      datetime: '2026-06-02T12:00:00.000Z',
      lines: [
        {
          id: editLine.id,
          accountId: 'aud-checking',
          amountMinor: -1500,
          currencyCode: 'AUD',
          categoryId: 'food',
          subcategoryId: 'groceries',
        },
      ],
    };
    const patch = createEditPatch(input, snapshot, input.lines);
    const patched = patchSnapshotAfterEditTransaction(snapshot, patch);

    expect(
      rollbackSnapshotAfterOptimisticEditTransaction({
        ...patched!,
        transactions: patched!.transactions.map((transaction) =>
          transaction.id === 'txn-edit' ? { ...transaction, title: 'Touched again' } : transaction),
      }, rollback!, patch),
    ).toBeNull();
  });
});

describe('transaction link snapshot patches', () => {
  it('patches and rolls back a parent-level link create', () => {
    const snapshot = createLinkSnapshot();
    const link = transactionLink('link-new', 'txn-source', 'txn-existing');
    const patched = patchSnapshotAfterAddTransactionLink(snapshot, link);

    expect(patched?.transactionLinks).toEqual([link]);

    const rolledBack = rollbackSnapshotAfterOptimisticAddTransactionLink(patched!, link);
    expect(rolledBack?.transactionLinks).toEqual([]);
  });

  it('patches and rolls back a split-line link create without marking the parent identity', () => {
    const snapshot = createLinkSnapshot();
    const sourceLine = snapshot.transactionLines.find((line) => line.transactionId === 'txn-source')!;
    const targetLine = snapshot.transactionLines.find((line) => line.transactionId === 'txn-existing')!;
    const link = transactionLink('link-line-new', 'txn-source', 'txn-existing', sourceLine.id, targetLine.id);
    const patched = patchSnapshotAfterAddTransactionLink(snapshot, link);

    expect(patched?.transactionLinks[0]).toEqual(expect.objectContaining({
      sourceLineId: sourceLine.id,
      targetLineId: targetLine.id,
    }));

    const rolledBack = rollbackSnapshotAfterOptimisticAddTransactionLink(patched!, link);
    expect(rolledBack?.transactionLinks).toEqual([]);
  });

  it('patches and rolls back a link update when the current link is unchanged', () => {
    const existing = transactionLink('link-existing', 'txn-source', 'txn-existing');
    const snapshot = {
      ...createLinkSnapshot(),
      transactionLinks: [existing],
    };
    const rollback = getRollbackForUpdateTransactionLink(snapshot, existing.id);
    const updated = {
      ...existing,
      amountMinor: 500,
      linkType: 'refund' as const,
      updatedAt: '2026-06-02T12:00:00.000Z',
    };
    const patched = patchSnapshotAfterUpdateTransactionLinkWithRollback(snapshot, updated, rollback!);

    expect(patched?.transactionLinks).toEqual([updated]);

    const rolledBack = rollbackSnapshotAfterOptimisticUpdateTransactionLink(patched!, rollback!, updated);
    expect(rolledBack?.transactionLinks).toEqual([existing]);
  });

  it('patches and rolls back a link delete when counterpart records still exist', () => {
    const existing = transactionLink('link-existing', 'txn-source', 'txn-existing');
    const snapshot = {
      ...createLinkSnapshot(),
      transactionLinks: [existing],
    };
    const rollback = getRollbackForDeleteTransactionLink(snapshot, existing.id);
    const patched = patchSnapshotAfterDeleteTransactionLinkWithRollback(snapshot, rollback!);

    expect(patched?.transactionLinks).toEqual([]);

    const rolledBack = rollbackSnapshotAfterOptimisticDeleteTransactionLink(patched!, rollback!);
    expect(rolledBack?.transactionLinks).toEqual([existing]);
  });

  it('falls back from link rollback when optimistic state changed', () => {
    const existing = transactionLink('link-existing', 'txn-source', 'txn-existing');
    const snapshot = {
      ...createLinkSnapshot(),
      transactionLinks: [existing],
    };
    const rollback = getRollbackForUpdateTransactionLink(snapshot, existing.id);
    const updated = {
      ...existing,
      amountMinor: 500,
      updatedAt: '2026-06-02T12:00:00.000Z',
    };
    const patched = patchSnapshotAfterUpdateTransactionLinkWithRollback(snapshot, updated, rollback!);

    expect(
      rollbackSnapshotAfterOptimisticUpdateTransactionLink({
        ...patched!,
        transactionLinks: patched!.transactionLinks.map((link) => ({ ...link, amountMinor: 700 })),
      }, rollback!, updated),
    ).toBeNull();
  });
});

describe('transaction link batch snapshot patches', () => {
  it('patches and rolls back multiple allocation link adds as one batch', () => {
    const snapshot = createLinkSnapshot();
    const patch = {
      addedLinks: [
        transactionLink('link-add-1', 'txn-source', 'txn-existing'),
        transactionLink('link-add-2', 'txn-source', 'txn-extra-expense'),
      ],
      deletedLinkIds: [],
      updatedLinks: [],
    };
    const rollback = getRollbackForTransactionLinkBatch(snapshot, patch);
    const patched = patchSnapshotAfterTransactionLinkBatchWithRollback(snapshot, patch, rollback!);

    expect(patched?.transactionLinks.map((link) => link.id)).toEqual(['link-add-1', 'link-add-2']);

    const rolledBack = rollbackSnapshotAfterOptimisticTransactionLinkBatch(patched!, rollback!, patch);
    expect(rolledBack?.transactionLinks).toEqual([]);
  });

  it('patches and rolls back mixed allocation add update and delete changes', () => {
    const keepLink = transactionLink('link-keep', 'txn-source', 'txn-extra-expense');
    const updateLink = transactionLink('link-update', 'txn-source', 'txn-existing');
    const deleteLink = transactionLink('link-delete', 'txn-source', 'txn-delete');
    const snapshot = {
      ...createLinkSnapshot(),
      transactionLinks: [keepLink, updateLink, deleteLink],
    };
    const updatedLink = {
      ...updateLink,
      amountMinor: 500,
      linkType: 'refund' as const,
      updatedAt: '2026-06-02T12:00:00.000Z',
    };
    const patch = {
      addedLinks: [transactionLink('link-add', 'txn-source', 'txn-extra-expense')],
      deletedLinkIds: ['link-delete'],
      updatedLinks: [updatedLink],
    };
    const rollback = getRollbackForTransactionLinkBatch(snapshot, patch);
    const patched = patchSnapshotAfterTransactionLinkBatchWithRollback(snapshot, patch, rollback!);

    expect(patched?.transactionLinks).toEqual(expect.arrayContaining([keepLink, updatedLink, patch.addedLinks[0]]));
    expect(patched?.transactionLinks.some((link) => link.id === 'link-delete')).toBe(false);

    const rolledBack = rollbackSnapshotAfterOptimisticTransactionLinkBatch(patched!, rollback!, patch);
    expect(rolledBack?.transactionLinks).toEqual([keepLink, updateLink, deleteLink]);
  });

  it('patches split-line allocation links without changing their line identity', () => {
    const snapshot = createLinkSnapshot();
    const sourceLine = snapshot.transactionLines.find((line) => line.transactionId === 'txn-source')!;
    const targetLine = snapshot.transactionLines.find((line) => line.transactionId === 'txn-existing')!;
    const patch = {
      addedLinks: [transactionLink('link-split-add', 'txn-source', 'txn-existing', sourceLine.id, targetLine.id)],
      deletedLinkIds: [],
      updatedLinks: [],
    };
    const rollback = getRollbackForTransactionLinkBatch(snapshot, patch);
    const patched = patchSnapshotAfterTransactionLinkBatchWithRollback(snapshot, patch, rollback!);

    expect(patched?.transactionLinks[0]).toEqual(expect.objectContaining({
      sourceLineId: sourceLine.id,
      targetLineId: targetLine.id,
    }));
  });

  it('falls back from batch rollback when optimistic batch state changed', () => {
    const snapshot = createLinkSnapshot();
    const patch = {
      addedLinks: [transactionLink('link-add', 'txn-source', 'txn-existing')],
      deletedLinkIds: [],
      updatedLinks: [],
    };
    const rollback = getRollbackForTransactionLinkBatch(snapshot, patch);
    const patched = patchSnapshotAfterTransactionLinkBatchWithRollback(snapshot, patch, rollback!);

    expect(
      rollbackSnapshotAfterOptimisticTransactionLinkBatch({
        ...patched!,
        transactionLinks: patched!.transactionLinks.map((link) => ({ ...link, amountMinor: 700 })),
      }, rollback!, patch),
    ).toBeNull();
  });

  it('falls back from batch rollback when original linked items are no longer present', () => {
    const existing = transactionLink('link-update', 'txn-source', 'txn-existing');
    const snapshot = {
      ...createLinkSnapshot(),
      transactionLinks: [existing],
    };
    const patch = {
      addedLinks: [],
      deletedLinkIds: [],
      updatedLinks: [{ ...existing, amountMinor: 500 }],
    };
    const rollback = getRollbackForTransactionLinkBatch(snapshot, patch);
    const patched = patchSnapshotAfterTransactionLinkBatchWithRollback(snapshot, patch, rollback!);

    expect(
      rollbackSnapshotAfterOptimisticTransactionLinkBatch({
        ...patched!,
        transactions: patched!.transactions.filter((transaction) => transaction.id !== 'txn-existing'),
      }, rollback!, patch),
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

function createEditSnapshot(
  kind: Transaction['kind'],
  lines: NewTransactionInput['lines'],
): AppSnapshot {
  return {
    ...createSnapshot(),
    transactions: [transaction('txn-edit', kind), transaction('txn-existing', 'expense', '2026-05-01T12:00:00.000Z')],
    transactionLines: lines.map((line, index) => transactionLine(`line-edit-${index}`, line, 'txn-edit')),
  };
}

function createLinkedEditSnapshot(
  kind: Transaction['kind'],
  lines: NewTransactionInput['lines'],
): AppSnapshot {
  const baseSnapshot = createEditSnapshot(kind, lines);
  const sourceTransaction = transaction('txn-source', 'income');
  const sourceLine = transactionLine('line-source', {
    accountId: 'aud-checking',
    amountMinor: 1000,
    currencyCode: 'AUD',
    categoryId: 'income',
    subcategoryId: 'reimbursement',
  }, sourceTransaction.id);
  const firstEditLine = baseSnapshot.transactionLines.find((line) => line.transactionId === 'txn-edit');

  return {
    ...baseSnapshot,
    transactions: [sourceTransaction, ...baseSnapshot.transactions],
    transactionLines: [sourceLine, ...baseSnapshot.transactionLines],
    transactionLinks: [
      transactionLink('link-parent', sourceTransaction.id, 'txn-edit'),
      transactionLink('link-line', sourceTransaction.id, 'txn-edit', sourceLine.id, firstEditLine?.id ?? null),
    ],
  };
}

function createLinkSnapshot(): AppSnapshot {
  const baseSnapshot = createSnapshot();
  const sourceTransaction = transaction('txn-source', 'income');
  const extraExpenseTransaction = transaction('txn-extra-expense', 'expense');
  const deleteExpenseTransaction = transaction('txn-delete', 'expense');
  const sourceLine = transactionLine('line-source', {
    accountId: 'aud-checking',
    amountMinor: 1000,
    currencyCode: 'AUD',
    categoryId: 'income',
    subcategoryId: 'reimbursement',
  }, sourceTransaction.id);
  const extraExpenseLine = transactionLine('line-extra-expense', {
    accountId: 'aud-checking',
    amountMinor: -1000,
    currencyCode: 'AUD',
    categoryId: 'food',
    subcategoryId: 'restaurants',
  }, extraExpenseTransaction.id);
  const deleteExpenseLine = transactionLine('line-delete-expense', {
    accountId: 'aud-checking',
    amountMinor: -1000,
    currencyCode: 'AUD',
    categoryId: 'food',
    subcategoryId: 'groceries',
  }, deleteExpenseTransaction.id);

  return {
    ...baseSnapshot,
    transactions: [sourceTransaction, extraExpenseTransaction, deleteExpenseTransaction, ...baseSnapshot.transactions],
    transactionLines: [sourceLine, extraExpenseLine, deleteExpenseLine, ...baseSnapshot.transactionLines],
  };
}

function createEditPatch(
  input: UpdateTransactionInput,
  snapshot: AppSnapshot,
  inputLines: UpdateTransactionInput['lines'],
) {
  const existingTransaction = snapshot.transactions.find((transaction) => transaction.id === input.id)!;
  const existingLines = snapshot.transactionLines.filter((line) => line.transactionId === input.id);
  const existingLineIds = new Set(existingLines.map((line) => line.id));
  const usedExistingLineIds = new Set<string>();
  const updatedLineIds: string[] = [];
  const insertedLineIds: string[] = [];
  const patchLines = inputLines.map((line, index) => {
    const requestedLineId = line.id?.trim() ?? '';
    const lineId = requestedLineId && existingLineIds.has(requestedLineId) && !usedExistingLineIds.has(requestedLineId)
      ? requestedLineId
      : existingLines[index]?.id;

    if (lineId) {
      usedExistingLineIds.add(lineId);
      updatedLineIds.push(lineId);
      return transactionLine(lineId, line, input.id);
    }

    const insertedLineId = `line-edit-new-${index}`;
    insertedLineIds.push(insertedLineId);
    return transactionLine(insertedLineId, line, input.id);
  });

  return {
    input,
    insertedLineIds,
    lines: patchLines,
    removedLineIds: existingLines
      .filter((line) => !usedExistingLineIds.has(line.id))
      .map((line) => line.id),
    transaction: {
      ...existingTransaction,
      kind: input.kind,
      title: input.title,
      datetime: input.datetime,
      notes: input.notes ?? '',
      labels: input.labels ?? [],
      groupId: input.groupId ?? '',
      updatedAt: '2026-06-02T12:00:00.000Z',
    },
    updatedLineIds,
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

function recurringItem(overrides: Partial<RecurringItem> = {}): RecurringItem {
  return {
    id: 'upcoming-rent',
    name: 'Rent',
    kind: 'expense',
    amountMinor: 1000,
    currencyCode: 'AUD',
    accountId: 'aud-checking',
    categoryId: 'housing',
    subcategoryId: 'rent',
    note: '',
    frequency: 'monthly',
    nextDueDate: '2099-02-01',
    completedAt: null,
    splitLines: [],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function recurringUpdateInput(
  item: RecurringItem,
  overrides: Partial<UpdateRecurringItemInput> = {},
): UpdateRecurringItemInput {
  return {
    id: item.id,
    name: item.name,
    kind: item.kind,
    amountMinor: item.amountMinor,
    currencyCode: item.currencyCode,
    accountId: item.accountId,
    categoryId: item.categoryId,
    subcategoryId: item.subcategoryId,
    note: item.note,
    frequency: item.frequency,
    nextDueDate: item.nextDueDate,
    completedAt: item.completedAt,
    splitLines: [],
    isActive: item.isActive,
    ...overrides,
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
