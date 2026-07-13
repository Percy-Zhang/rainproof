import {
  buildTransactionUpdateInput,
  canBuildTransactionUpdateInput,
  createTransactionEditDraft,
  formatEditDateLabel,
  getEditableTransactionEditSplitLines,
  getTransactionEditDraftTotalMinor,
  getTransactionEditLinkSavePlan,
  OUTSIDE_ACCOUNT_ID,
} from '../transactionEdit';
import type { Account, AppSnapshot, Transaction, TransactionLine, TransactionLink } from '../types';

const accounts: Account[] = [
  account('a1', 'Everyday', 'AUD'),
  account('a2', 'Savings', 'AUD'),
  account('usd', 'USD Cash', 'USD'),
];

function account(id: string, name: string, currencyCode: string): Account {
  return {
    id,
    name,
    nickname: '',
    type: 'checking',
    currencyCode,
    openingBalanceMinor: 0,
    notes: '',
    institutionName: '',
    includeInRainyDay: false,
    themeColor: '#1876A8',
    iconName: 'business-outline',
    showOnDashboard: true,
    sortOrder: 0,
    isArchived: false,
    createdAt: '',
    updatedAt: '',
  };
}

function transaction(kind: Transaction['kind']): Transaction {
  return {
    id: 'tx-1',
    kind,
    title: 'Original',
    datetime: new Date(2026, 4, 26, 14, 35).toISOString(),
    notes: 'note',
    labels: ['shared'],
    groupId: 'Trip',
    createdAt: '',
    updatedAt: '',
  };
}

function line(overrides: Partial<TransactionLine>): TransactionLine {
  return {
    id: 'line-1',
    transactionId: 'tx-1',
    accountId: 'a1',
    amountMinor: -1200,
    currencyCode: 'AUD',
    categoryId: 'food',
    subcategoryId: 'Groceries',
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: '',
    ...overrides,
  };
}

function link(overrides: Partial<TransactionLink>): TransactionLink {
  return {
    id: 'link-1',
    sourceTransactionId: 'tx-1',
    targetTransactionId: 'expense-1',
    sourceLineId: null,
    targetLineId: null,
    linkType: 'reimbursement',
    amountMinor: 1200,
    currencyCode: 'AUD',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function snapshot(kind: Transaction['kind'], lines: TransactionLine[]): AppSnapshot {
  return {
    defaultCurrencyCode: 'AUD',
    settings: {
      defaultCurrencyCode: 'AUD',
      defaultCurrencyMode: 'auto',
      multiCurrencyEnabled: false,
      enabledCurrencyCodes: ['AUD'],
      dashboardSelectedAccountIds: null,
    },
    accounts,
    transactions: [transaction(kind)],
    transactionLines: lines,
    transactionLinks: [],
    budgets: [],
    recurringItems: [],
    recurringBills: [],
    transactionTemplates: [],
    rainyDayFund: {
      id: 'fund',
      name: 'Rainy',
      currencyCode: 'AUD',
      goalMinor: 0,
      linkedAccountIds: [],
      createdAt: '',
      updatedAt: '',
    },
  };
}

describe('transaction edit helpers', () => {
  it('builds an edited expense line with new account/category/amount', () => {
    const draft = createTransactionEditDraft(snapshot('expense', [line({})]), 'tx-1');
    const input = buildTransactionUpdateInput(
      { ...draft, amount: '45.67', accountId: 'a2', categoryId: 'transport', subcategoryId: 'Fuel' },
      accounts,
    );

    expect(input.kind).toBe('expense');
    expect(input.lines).toEqual([
      expect.objectContaining({
        id: 'line-1',
        accountId: 'a2',
        amountMinor: -4567,
        categoryId: 'transport',
        subcategoryId: 'fuel',
      }),
    ]);
  });

  it('loads and preserves a multi-line split expense draft', () => {
    const draft = createTransactionEditDraft(
      snapshot('expense', [
        line({ id: 'food-line', amountMinor: -1200, categoryId: 'food', subcategoryId: 'groceries', note: 'Food' }),
        line({ id: 'home-line', amountMinor: -3400, categoryId: 'housing', subcategoryId: 'rent', note: 'Rent' }),
      ]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput(draft, accounts);

    expect(draft.amount).toBe('46.00');
    expect(draft.accountId).toBe('a1');
    expect(draft.splitLines).toEqual([
      {
        id: 'food-line',
        amount: '12.00',
        categoryId: 'food',
        subcategoryId: 'groceries',
        note: 'Food',
      },
      {
        id: 'home-line',
        amount: '34.00',
        categoryId: 'housing',
        subcategoryId: 'rent',
        note: 'Rent',
      },
    ]);
    expect(input.lines).toEqual([
      expect.objectContaining({
        id: 'food-line',
        accountId: 'a1',
        amountMinor: -1200,
        categoryId: 'food',
        subcategoryId: 'groceries',
        note: 'Food',
      }),
      expect.objectContaining({
        id: 'home-line',
        accountId: 'a1',
        amountMinor: -3400,
        categoryId: 'housing',
        subcategoryId: 'rent',
        note: 'Rent',
      }),
    ]);
  });

  it('falls back to the parent title for blank edited split expense line notes', () => {
    const draft = createTransactionEditDraft(
      snapshot('expense', [
        line({ id: 'food-line', amountMinor: -1200, categoryId: 'food', subcategoryId: 'groceries', note: '' }),
        line({ id: 'home-line', amountMinor: -3400, categoryId: 'housing', subcategoryId: 'rent', note: '   ' }),
      ]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput(draft, accounts);

    expect(input.lines).toEqual([
      expect.objectContaining({
        id: 'food-line',
        amountMinor: -1200,
        categoryId: 'food',
        subcategoryId: 'groceries',
        note: 'Original',
      }),
      expect.objectContaining({
        id: 'home-line',
        amountMinor: -3400,
        categoryId: 'housing',
        subcategoryId: 'rent',
        note: 'Original',
      }),
    ]);
  });

  it('rejects split expense drafts when the edited total no longer matches split lines', () => {
    const draft = createTransactionEditDraft(
      snapshot('expense', [
        line({ id: 'food-line', amountMinor: -1200, categoryId: 'food', subcategoryId: 'groceries' }),
        line({ id: 'home-line', amountMinor: -3400, categoryId: 'housing', subcategoryId: 'rent' }),
      ]),
      'tx-1',
    );

    expect(() => buildTransactionUpdateInput({ ...draft, amount: '45.99' }, accounts)).toThrow(
      'Split line amounts must equal the transaction total.',
    );
    expect(canBuildTransactionUpdateInput({ ...draft, amount: '45.99' }, accounts)).toBe(false);
  });

  it('collapses a split expense draft with one remaining line back to a normal expense', () => {
    const draft = createTransactionEditDraft(
      snapshot('expense', [
        line({ id: 'food-line', amountMinor: -1200, categoryId: 'food', subcategoryId: 'groceries' }),
        line({ id: 'home-line', amountMinor: -3400, categoryId: 'housing', subcategoryId: 'rent' }),
      ]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput(
      {
        ...draft,
        amount: '12.00',
        splitLines: [
          {
            id: 'food-line',
            amount: '12.00',
            categoryId: 'transport',
            subcategoryId: 'fuel',
            note: 'Fuel stop',
          },
        ],
      },
      accounts,
    );

    expect(input.lines).toEqual([
      expect.objectContaining({
        id: 'food-line',
        amountMinor: -1200,
        categoryId: 'transport',
        subcategoryId: 'fuel',
        note: 'Fuel stop',
      }),
    ]);
  });

  it('loads and preserves a multi-line split income draft', () => {
    const draft = createTransactionEditDraft(
      snapshot('income', [
        line({ id: 'salary-line', amountMinor: 1200, categoryId: 'income', subcategoryId: 'salary', note: 'Salary' }),
        line({ id: 'bonus-line', amountMinor: 3400, categoryId: 'income', subcategoryId: 'bonus', note: 'Bonus' }),
      ]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput(draft, accounts);

    expect(draft.amount).toBe('46.00');
    expect(draft.splitLines).toEqual([
      {
        id: 'salary-line',
        amount: '12.00',
        categoryId: 'income',
        subcategoryId: 'salary',
        note: 'Salary',
      },
      {
        id: 'bonus-line',
        amount: '34.00',
        categoryId: 'income',
        subcategoryId: 'bonus',
        note: 'Bonus',
      },
    ]);
    expect(input.lines).toEqual([
      expect.objectContaining({
        id: 'salary-line',
        amountMinor: 1200,
        categoryId: 'income',
        subcategoryId: 'salary',
        note: 'Salary',
      }),
      expect.objectContaining({
        id: 'bonus-line',
        amountMinor: 3400,
        categoryId: 'income',
        subcategoryId: 'bonus',
        note: 'Bonus',
      }),
    ]);
  });

  it('infers and preserves mixed split mode, line kinds, signs, and line ids', () => {
    const draft = createTransactionEditDraft(
      snapshot('income', [
        line({
          id: 'salary-line',
          amountMinor: 230000,
          categoryId: 'income',
          subcategoryId: 'salary',
          note: 'Salary',
        }),
        line({
          id: 'tax-line',
          amountMinor: -60000,
          categoryId: 'food',
          subcategoryId: 'groceries',
          note: 'Tax',
        }),
      ]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput(
      {
        ...draft,
        title: 'Renamed pay',
        splitLines: draft.splitLines?.map((splitLine) =>
          splitLine.id === 'tax-line' ? { ...splitLine, note: 'Renamed tax' } : splitLine,
        ),
      },
      accounts,
    );

    expect(draft.amount).toBe('1700.00');
    expect(draft.splitMode).toBe('mixed');
    expect(draft.splitLines).toEqual([
      expect.objectContaining({ id: 'salary-line', kind: 'income', amount: '2300.00' }),
      expect.objectContaining({ id: 'tax-line', kind: 'expense', amount: '600.00' }),
    ]);
    expect(input.lines).toEqual([
      expect.objectContaining({ id: 'salary-line', amountMinor: 230000, note: 'Salary' }),
      expect.objectContaining({ id: 'tax-line', amountMinor: -60000, note: 'Renamed tax' }),
    ]);
  });

  it('falls back to the parent title for blank edited split income line notes', () => {
    const draft = createTransactionEditDraft(
      snapshot('income', [
        line({ id: 'salary-line', amountMinor: 1200, categoryId: 'income', subcategoryId: 'salary', note: '' }),
        line({ id: 'bonus-line', amountMinor: 3400, categoryId: 'income', subcategoryId: 'bonus', note: '  ' }),
      ]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput(draft, accounts);

    expect(input.lines).toEqual([
      expect.objectContaining({
        id: 'salary-line',
        amountMinor: 1200,
        categoryId: 'income',
        subcategoryId: 'salary',
        note: 'Original',
      }),
      expect.objectContaining({
        id: 'bonus-line',
        amountMinor: 3400,
        categoryId: 'income',
        subcategoryId: 'bonus',
        note: 'Original',
      }),
    ]);
  });

  it('collapses a split income draft with one remaining line back to a normal income', () => {
    const draft = createTransactionEditDraft(
      snapshot('income', [
        line({ id: 'salary-line', amountMinor: 1200, categoryId: 'income', subcategoryId: 'salary' }),
        line({ id: 'bonus-line', amountMinor: 3400, categoryId: 'income', subcategoryId: 'bonus' }),
      ]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput(
      {
        ...draft,
        amount: '12.00',
        splitLines: [
          {
            id: 'salary-line',
            amount: '12.00',
            categoryId: 'income',
            subcategoryId: 'interest',
            note: 'Interest',
          },
        ],
      },
      accounts,
    );

    expect(input.lines).toEqual([
      expect.objectContaining({
        id: 'salary-line',
        amountMinor: 1200,
        categoryId: 'income',
        subcategoryId: 'interest',
        note: 'Interest',
      }),
    ]);
  });

  it('rejects split transfer drafts for v1', () => {
    expect(() =>
      createTransactionEditDraft(
        snapshot('transfer', [
          line({ id: 'source', accountId: 'a1', amountMinor: -5000, transferPeerAccountId: 'a2' }),
          line({ id: 'target', accountId: 'a2', amountMinor: 5000, transferPeerAccountId: 'a1' }),
          line({ id: 'extra', accountId: 'usd', amountMinor: 1000, transferPeerAccountId: 'a1' }),
        ]),
        'tx-1',
      ),
    ).toThrow('Split transfer editing is not supported.');
  });

  it('preserves and dedupes edited labels', () => {
    const draft = createTransactionEditDraft(snapshot('expense', [line({})]), 'tx-1');
    const input = buildTransactionUpdateInput(
      { ...draft, labels: ' shared, holiday, Shared, tax ' },
      accounts,
    );

    expect(input.labels).toEqual(['shared', 'holiday', 'tax']);
  });

  it('builds an edited income line with a positive amount', () => {
    const draft = createTransactionEditDraft(
      snapshot('income', [line({ amountMinor: 1200, categoryId: 'income', subcategoryId: 'Salary' })]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput({ ...draft, amount: '99.00', accountId: 'a2' }, accounts);

    expect(input.kind).toBe('income');
    expect(input.lines[0]).toEqual(expect.objectContaining({ accountId: 'a2', amountMinor: 9900 }));
  });

  it('converts an expense to income', () => {
    const draft = createTransactionEditDraft(snapshot('expense', [line({})]), 'tx-1');
    const input = buildTransactionUpdateInput(
      { ...draft, kind: 'income', amount: '12.34', categoryId: 'income', subcategoryId: 'Interest' },
      accounts,
    );

    expect(input.kind).toBe('income');
    expect(input.lines[0].amountMinor).toBe(1234);
  });

  it('converts income to an internal transfer', () => {
    const draft = createTransactionEditDraft(
      snapshot('income', [line({ amountMinor: 1200, categoryId: 'income', subcategoryId: 'Salary' })]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput(
      { ...draft, kind: 'transfer', amount: '20.00', accountId: 'a1', targetAccountId: 'a2' },
      accounts,
    );

    expect(input.lines).toEqual([
      expect.objectContaining({ accountId: 'a1', amountMinor: -2000, transferPeerAccountId: 'a2' }),
      expect.objectContaining({ accountId: 'a2', amountMinor: 2000, transferPeerAccountId: 'a1' }),
    ]);
    expect(input.lines[0]).not.toHaveProperty('categoryId');
    expect(input.lines[0]).not.toHaveProperty('subcategoryId');
  });

  it('edits transfer source destination and uses the same amount for both sides', () => {
    const draft = createTransactionEditDraft(
      snapshot('transfer', [
        line({ id: 'source', accountId: 'a1', amountMinor: -5000, transferPeerAccountId: 'a2' }),
        line({ id: 'target', accountId: 'a2', amountMinor: 5000, transferPeerAccountId: 'a1' }),
      ]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput(
      { ...draft, amount: '7.50', accountId: 'a2', targetAccountId: 'a1' },
      accounts,
    );

    expect(input.lines).toEqual([
      expect.objectContaining({ id: 'source', accountId: 'a2', amountMinor: -750, currencyCode: 'AUD' }),
      expect.objectContaining({ id: 'target', accountId: 'a1', amountMinor: 750, currencyCode: 'AUD' }),
    ]);
  });

  it('supports a transfer from outside my accounts into a tracked account', () => {
    const draft = createTransactionEditDraft(snapshot('expense', [line({})]), 'tx-1');
    const input = buildTransactionUpdateInput(
      { ...draft, kind: 'transfer', amount: '15.00', accountId: OUTSIDE_ACCOUNT_ID, targetAccountId: 'a2' },
      accounts,
    );

    expect(input.lines).toEqual([
      expect.objectContaining({ accountId: 'a2', amountMinor: 1500, externalParty: 'Outside my accounts' }),
    ]);
  });

  it('supports a transfer from a tracked account to outside my accounts', () => {
    const draft = createTransactionEditDraft(snapshot('expense', [line({})]), 'tx-1');
    const input = buildTransactionUpdateInput(
      { ...draft, kind: 'transfer', amount: '15.00', accountId: 'a1', targetAccountId: OUTSIDE_ACCOUNT_ID },
      accounts,
    );

    expect(input.lines).toEqual([
      expect.objectContaining({ accountId: 'a1', amountMinor: -1500, externalParty: 'Outside my accounts' }),
    ]);
  });

  it('blocks transfers where both sides are outside my accounts', () => {
    const draft = createTransactionEditDraft(snapshot('expense', [line({})]), 'tx-1');

    expect(() =>
      buildTransactionUpdateInput(
        { ...draft, kind: 'transfer', amount: '15.00', accountId: OUTSIDE_ACCOUNT_ID, targetAccountId: OUTSIDE_ACCOUNT_ID },
        accounts,
      ),
    ).toThrow('Choose at least one account inside Rainproof.');
  });

  it('builds tracked account transfers across currencies from sent and received amounts', () => {
    const draft = createTransactionEditDraft(
      snapshot('transfer', [
        line({ id: 'source', accountId: 'a1', amountMinor: -15000, currencyCode: 'AUD', transferPeerAccountId: 'usd' }),
        line({ id: 'target', accountId: 'usd', amountMinor: 9750, currencyCode: 'USD', transferPeerAccountId: 'a1' }),
      ]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput(
      { ...draft, amount: '200.00', targetAmount: '130.00' },
      accounts,
    );

    expect(draft.amount).toBe('150.00');
    expect(draft.targetAmount).toBe('97.50');
    expect(input.lines).toEqual([
      expect.objectContaining({
        id: 'source',
        accountId: 'a1',
        amountMinor: -20000,
        currencyCode: 'AUD',
        transferPeerAccountId: 'usd',
      }),
      expect.objectContaining({
        id: 'target',
        accountId: 'usd',
        amountMinor: 13000,
        currencyCode: 'USD',
        transferPeerAccountId: 'a1',
      }),
    ]);
  });

  it('requires a received amount when editing tracked cross-currency transfers', () => {
    const draft = createTransactionEditDraft(snapshot('expense', [line({})]), 'tx-1');

    expect(() =>
      buildTransactionUpdateInput(
        { ...draft, kind: 'transfer', amount: '15.00', accountId: 'a1', targetAccountId: 'usd', targetAmount: '' },
        accounts,
      ),
    ).toThrow('Received amount must be greater than zero.');
  });

  it('formats edit dates with month names', () => {
    expect(formatEditDateLabel('2026-05-26')).toBe('May 26, 2026');
  });

  it('creates editable split lines and totals from a normal transaction draft', () => {
    const draft = createTransactionEditDraft(snapshot('expense', [line({})]), 'tx-1');

    expect(getTransactionEditDraftTotalMinor(draft)).toBe(1200);
    expect(getEditableTransactionEditSplitLines(draft)).toEqual([
      expect.objectContaining({
        id: 'line-1',
        amount: '12.00',
        categoryId: 'food',
        subcategoryId: 'groceries',
      }),
      expect.objectContaining({
        id: 'tx-1-split-2',
        categoryId: 'food',
        subcategoryId: 'groceries',
      }),
    ]);
  });

  it('preserves source allocation identity and amount after editing an income transaction', () => {
    const draft = createTransactionEditDraft(
      snapshot('income', [line({ amountMinor: 1200, categoryId: 'income', subcategoryId: 'salary' })]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput({ ...draft, amount: '45.00' }, accounts);

    expect(getTransactionEditLinkSavePlan({
      input,
      transactionId: 'tx-1',
      transactionLinks: [link({ amountMinor: 1200 })],
    })).toEqual({ toAdd: [], toUpdate: [], deleteIds: [] });
  });

  it('preserves split-line source link identity after editing parent and split item names', () => {
    const draft = createTransactionEditDraft(
      snapshot('income', [
        line({ id: 'salary-line', amountMinor: 1200, categoryId: 'income', subcategoryId: 'salary', note: 'Salary' }),
        line({ id: 'bonus-line', amountMinor: 3400, categoryId: 'income', subcategoryId: 'bonus', note: 'Bonus' }),
      ]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput(
      {
        ...draft,
        title: 'Renamed parent',
        splitLines: draft.splitLines?.map((splitLine) =>
          splitLine.id === 'bonus-line' ? { ...splitLine, note: 'Renamed bonus' } : splitLine,
        ),
      },
      accounts,
    );

    expect(input.lines.find((inputLine) => inputLine.id === 'bonus-line')).toEqual(
      expect.objectContaining({
        id: 'bonus-line',
        note: 'Renamed bonus',
      }),
    );
    expect(getTransactionEditLinkSavePlan({
      input,
      transactionId: 'tx-1',
      transactionLinks: [
        link({
          sourceLineId: 'bonus-line',
          targetLineId: 'expense-line',
          amountMinor: 3400,
        }),
      ],
    })).toEqual({ toAdd: [], toUpdate: [], deleteIds: [] });
  });

  it('keeps parent-level source links parent-level after editing', () => {
    const draft = createTransactionEditDraft(
      snapshot('income', [line({ amountMinor: 1200, categoryId: 'income', subcategoryId: 'salary' })]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput({ ...draft, title: 'Renamed parent', amount: '45.00' }, accounts);

    expect(getTransactionEditLinkSavePlan({
      input,
      transactionId: 'tx-1',
      transactionLinks: [link({ sourceLineId: null, targetLineId: null })],
    })).toEqual({ toAdd: [], toUpdate: [], deleteIds: [] });
  });

  it('requires unlinking before an income transaction changes kind', () => {
    const input = buildTransactionUpdateInput(
      {
        ...createTransactionEditDraft(snapshot('expense', [line({})]), 'tx-1'),
        amount: '12.00',
      },
      accounts,
    );

    expect(() => getTransactionEditLinkSavePlan({
      input,
      transactionId: 'tx-1',
      transactionLinks: [link({})],
    })).toThrow('Unlink this transaction before changing its type.');
  });

  it('requires unlinking before an expense transaction changes kind', () => {
    const draft = createTransactionEditDraft(
      snapshot('income', [line({ amountMinor: 1200, categoryId: 'income', subcategoryId: 'salary' })]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput(draft, accounts);

    expect(() => getTransactionEditLinkSavePlan({
      input,
      transactionId: 'tx-1',
      transactionLinks: [link({ id: 'target-link', sourceTransactionId: 'income-2', targetTransactionId: 'tx-1' })],
    })).toThrow('Unlink this transaction before changing its type.');
  });

  it('preserves every source link when one income is allocated across multiple targets', () => {
    const draft = createTransactionEditDraft(
      snapshot('income', [line({ amountMinor: 10000, categoryId: 'income', subcategoryId: 'salary' })]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput({ ...draft, title: 'Renamed payment' }, accounts);
    const transactionLinks = [
      link({ id: 'link-c', targetTransactionId: 'expense-c', amountMinor: 2000 }),
      link({ id: 'link-a', targetTransactionId: 'expense-a', amountMinor: 3000 }),
      link({ id: 'link-b', targetTransactionId: 'expense-b', amountMinor: 4000 }),
    ];

    expect(getTransactionEditLinkSavePlan({ input, transactionId: 'tx-1', transactionLinks }))
      .toEqual({ toAdd: [], toUpdate: [], deleteIds: [] });
    expect(getTransactionEditLinkSavePlan({ input, transactionId: 'tx-1', transactionLinks: [...transactionLinks].reverse() }))
      .toEqual({ toAdd: [], toUpdate: [], deleteIds: [] });
  });

  it('preserves equal-amount source links as distinct records', () => {
    const draft = createTransactionEditDraft(
      snapshot('income', [line({ amountMinor: 5000, categoryId: 'income', subcategoryId: 'salary' })]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput(draft, accounts);

    expect(getTransactionEditLinkSavePlan({
      input,
      transactionId: 'tx-1',
      transactionLinks: [
        link({ id: 'equal-a', targetTransactionId: 'expense-a', amountMinor: 2000 }),
        link({ id: 'equal-b', targetTransactionId: 'expense-b', amountMinor: 2000 }),
      ],
    })).toEqual({ toAdd: [], toUpdate: [], deleteIds: [] });
  });

  it('requires unlinking before a linked source split line is removed', () => {
    const draft = createTransactionEditDraft(
      snapshot('income', [
        line({ id: 'keep-line', amountMinor: 6000, categoryId: 'income', subcategoryId: 'salary' }),
        line({ id: 'remove-line', amountMinor: 4000, categoryId: 'income', subcategoryId: 'bonus' }),
      ]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput({
      ...draft,
      amount: '60.00',
      splitLines: draft.splitLines?.filter((splitLine) => splitLine.id === 'keep-line'),
    }, accounts);

    expect(() => getTransactionEditLinkSavePlan({
      input,
      transactionId: 'tx-1',
      transactionLinks: [
        link({ id: 'keep-parent', amountMinor: 2000, sourceLineId: null }),
        link({ id: 'remove-direct', amountMinor: 3000, sourceLineId: 'remove-line' }),
      ],
    })).toThrow('Cannot remove or change a linked split line. Unlink it first.');
  });

  it('rejects reducing a linked source split line below its retained allocation', () => {
    const draft = createTransactionEditDraft(
      snapshot('income', [
        line({ id: 'linked-line', amountMinor: 6000, categoryId: 'income', subcategoryId: 'salary' }),
        line({ id: 'other-line', amountMinor: 4000, categoryId: 'income', subcategoryId: 'bonus' }),
      ]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput({
      ...draft,
      amount: '100.00',
      splitLines: draft.splitLines?.map((splitLine) =>
        splitLine.id === 'linked-line' ? { ...splitLine, amount: '30.00' } : { ...splitLine, amount: '70.00' }),
    }, accounts);

    expect(() => getTransactionEditLinkSavePlan({
      input,
      transactionId: 'tx-1',
      transactionLinks: [link({ sourceLineId: 'linked-line', amountMinor: 5000 })],
    })).toThrow('Cannot reduce this split line below its existing linked allocation.');
  });

  it('rejects changing the sign of a linked mixed-split line', () => {
    const input = {
      id: 'tx-1',
      kind: 'income' as const,
      title: 'Mixed income',
      datetime: '2026-05-17T00:00:00.000Z',
      lines: [
        { id: 'linked-line', accountId: 'acct-1', amountMinor: -3000, currencyCode: 'AUD', categoryId: 'food', subcategoryId: 'groceries' },
        { id: 'other-line', accountId: 'acct-1', amountMinor: 8000, currencyCode: 'AUD', categoryId: 'income', subcategoryId: 'salary' },
      ],
    };

    expect(() => getTransactionEditLinkSavePlan({
      input,
      transactionId: 'tx-1',
      transactionLinks: [link({ sourceLineId: 'linked-line', amountMinor: 2000 })],
    })).toThrow('Cannot remove or change a linked split line. Unlink it first.');
  });

  it('rejects a kind change regardless of source link order', () => {
    const input = buildTransactionUpdateInput(
      createTransactionEditDraft(snapshot('expense', [line({})]), 'tx-1'),
      accounts,
    );

    expect(() => getTransactionEditLinkSavePlan({
      input,
      transactionId: 'tx-1',
      transactionLinks: [
        link({ id: 'z-link' }),
        link({ id: 'a-link', targetTransactionId: 'expense-2' }),
      ],
    })).toThrow('Unlink this transaction before changing its type.');
  });

  it('rejects an edit that would leave multiple source allocations over capacity', () => {
    const draft = createTransactionEditDraft(
      snapshot('income', [line({ amountMinor: 10000, categoryId: 'income', subcategoryId: 'salary' })]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput({ ...draft, amount: '50.00' }, accounts);

    expect(() => getTransactionEditLinkSavePlan({
      input,
      transactionId: 'tx-1',
      transactionLinks: [
        link({ id: 'a', amountMinor: 3000 }),
        link({ id: 'b', targetTransactionId: 'expense-2', amountMinor: 4000 }),
      ],
    })).toThrow('Cannot reduce this transaction below its existing linked allocations.');
  });

  it('preserves multiple incoming target links when an expense edit keeps their scope valid', () => {
    const draft = createTransactionEditDraft(snapshot('expense', [line({ amountMinor: -10000 })]), 'tx-1');
    const input = buildTransactionUpdateInput({ ...draft, title: 'Renamed expense' }, accounts);

    expect(getTransactionEditLinkSavePlan({
      input,
      transactionId: 'tx-1',
      transactionLinks: [
        link({ id: 'payment-a', sourceTransactionId: 'income-a', targetTransactionId: 'tx-1', amountMinor: 3000 }),
        link({ id: 'payment-b', sourceTransactionId: 'income-b', targetTransactionId: 'tx-1', amountMinor: 4000 }),
      ],
    })).toEqual({ toAdd: [], toUpdate: [], deleteIds: [] });
  });

  it('requires unlinking before a linked target split line is removed', () => {
    const draft = createTransactionEditDraft(
      snapshot('expense', [
        line({ id: 'keep-line', amountMinor: -6000 }),
        line({ id: 'remove-line', amountMinor: -4000, categoryId: 'shopping', subcategoryId: 'clothing' }),
      ]),
      'tx-1',
    );
    const input = buildTransactionUpdateInput({
      ...draft,
      amount: '60.00',
      splitLines: draft.splitLines?.filter((splitLine) => splitLine.id === 'keep-line'),
    }, accounts);

    expect(() => getTransactionEditLinkSavePlan({
      input,
      transactionId: 'tx-1',
      transactionLinks: [
        link({ id: 'keep-parent', sourceTransactionId: 'income-a', targetTransactionId: 'tx-1', amountMinor: 2000 }),
        link({
          id: 'remove-direct',
          sourceTransactionId: 'income-b',
          targetTransactionId: 'tx-1',
          targetLineId: 'remove-line',
          amountMinor: 3000,
        }),
      ],
    })).toThrow('Cannot remove or change a linked split line. Unlink it first.');
  });

  it('rejects an expense edit that would leave incoming payments over target capacity', () => {
    const draft = createTransactionEditDraft(snapshot('expense', [line({ amountMinor: -10000 })]), 'tx-1');
    const input = buildTransactionUpdateInput({ ...draft, amount: '50.00' }, accounts);

    expect(() => getTransactionEditLinkSavePlan({
      input,
      transactionId: 'tx-1',
      transactionLinks: [
        link({ id: 'a', sourceTransactionId: 'income-a', targetTransactionId: 'tx-1', amountMinor: 3000 }),
        link({ id: 'b', sourceTransactionId: 'income-b', targetTransactionId: 'tx-1', amountMinor: 4000 }),
      ],
    })).toThrow('Cannot reduce this transaction below its existing linked allocations.');
  });
});
