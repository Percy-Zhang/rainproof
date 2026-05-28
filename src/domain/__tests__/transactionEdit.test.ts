import {
  buildTransactionUpdateInput,
  createTransactionEditDraft,
  formatEditDateLabel,
  OUTSIDE_ACCOUNT_ID,
} from '../transactionEdit';
import type { Account, AppSnapshot, Transaction, TransactionLine } from '../types';

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

  it('blocks tracked account transfers across currencies until exchange rates exist', () => {
    const draft = createTransactionEditDraft(snapshot('expense', [line({})]), 'tx-1');

    expect(() =>
      buildTransactionUpdateInput(
        { ...draft, kind: 'transfer', amount: '15.00', accountId: 'a1', targetAccountId: 'usd' },
        accounts,
      ),
    ).toThrow('Transfers between different currencies need exchange rates.');
  });

  it('formats edit dates with month names', () => {
    expect(formatEditDateLabel('2026-05-26')).toBe('May 26, 2026');
  });
});
