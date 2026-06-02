import {
  compareTransactionsDescending,
  getAccountBalances,
  getAccountBalancesAt,
  getBalanceAfterDisplayEntries,
  getBudgetUsage,
  getCashFlowSummary,
  getRainyDayProgress,
  getSpendingByCategory,
  getTransactionDisplayEntries,
  groupBalancesByCurrency,
} from '../aggregates';
import type { Account, Budget, RainyDayFund, Transaction, TransactionLine, TransactionLink } from '../types';

const now = new Date(2026, 4, 15, 12).toISOString();
const range = {
  startIso: new Date(2026, 4, 1).toISOString(),
  endIso: new Date(2026, 5, 1).toISOString(),
};

const accounts: Account[] = [
  {
    id: 'acct_aud',
    name: 'Everyday',
    nickname: '',
    type: 'checking',
    currencyCode: 'AUD',
    openingBalanceMinor: 10000,
    themeColor: '#1876A8',
    iconName: 'business-outline',
    sortOrder: 0,
    notes: '',
    institutionName: '',
    includeInRainyDay: false,
    showOnDashboard: true,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'acct_usd',
    name: 'USD Cash',
    nickname: '',
    type: 'cash',
    currencyCode: 'USD',
    openingBalanceMinor: 5000,
    themeColor: '#B88A3D',
    iconName: 'cash-outline',
    sortOrder: 1,
    notes: '',
    institutionName: '',
    includeInRainyDay: false,
    showOnDashboard: true,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'acct_rainy',
    name: 'Rainy',
    nickname: '',
    type: 'savings',
    currencyCode: 'AUD',
    openingBalanceMinor: 20000,
    themeColor: '#5E9C92',
    iconName: 'umbrella-outline',
    sortOrder: 2,
    notes: '',
    institutionName: '',
    includeInRainyDay: true,
    showOnDashboard: true,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  },
];

const transactions: Transaction[] = [
  {
    id: 'txn_income',
    kind: 'income',
    title: 'Salary',
    datetime: now,
    notes: '',
    labels: [],
    groupId: '',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'txn_food',
    kind: 'expense',
    title: 'Groceries',
    datetime: now,
    notes: '',
    labels: [],
    groupId: '',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'txn_transfer',
    kind: 'transfer',
    title: 'Save',
    datetime: now,
    notes: '',
    labels: [],
    groupId: '',
    createdAt: now,
    updatedAt: now,
  },
];

const lines: TransactionLine[] = [
  {
    id: 'line_income',
    transactionId: 'txn_income',
    accountId: 'acct_aud',
    amountMinor: 25000,
    currencyCode: 'AUD',
    categoryId: 'income',
    subcategoryId: 'Salary',
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: now,
  },
  {
    id: 'line_food',
    transactionId: 'txn_food',
    accountId: 'acct_aud',
    amountMinor: -4200,
    currencyCode: 'AUD',
    categoryId: 'food',
    subcategoryId: 'Groceries',
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: now,
  },
  {
    id: 'line_transfer_out',
    transactionId: 'txn_transfer',
    accountId: 'acct_aud',
    amountMinor: -5000,
    currencyCode: 'AUD',
    categoryId: 'other',
    subcategoryId: 'Cash',
    externalParty: '',
    transferPeerAccountId: 'acct_rainy',
    note: '',
    createdAt: now,
  },
  {
    id: 'line_transfer_in',
    transactionId: 'txn_transfer',
    accountId: 'acct_rainy',
    amountMinor: 5000,
    currencyCode: 'AUD',
    categoryId: 'other',
    subcategoryId: 'Cash',
    externalParty: '',
    transferPeerAccountId: 'acct_aud',
    note: '',
    createdAt: now,
  },
];

function makeTransaction(id: string, kind: Transaction['kind'], title = id): Transaction {
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

function makeLine({
  id,
  transactionId,
  amountMinor,
  categoryId,
  currencyCode = 'AUD',
  accountId = 'acct_aud',
}: {
  id: string;
  transactionId: string;
  amountMinor: number;
  categoryId: string;
  currencyCode?: string;
  accountId?: string;
}): TransactionLine {
  return {
    id,
    transactionId,
    accountId,
    amountMinor,
    currencyCode,
    categoryId,
    subcategoryId: categoryId,
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: now,
  };
}

function makeLink({
  id = 'link_1',
  sourceTransactionId = 'linked_income',
  targetTransactionId = 'linked_expense',
  sourceLineId = null,
  targetLineId = null,
  linkType = 'refund',
  amountMinor = 4000,
  currencyCode = 'AUD',
}: Partial<TransactionLink> = {}): TransactionLink {
  return {
    id,
    sourceTransactionId,
    targetTransactionId,
    sourceLineId,
    targetLineId,
    linkType,
    amountMinor,
    currencyCode,
    createdAt: now,
    updatedAt: now,
  };
}

describe('aggregates', () => {
  it('derives balances from opening balances and transaction lines', () => {
    const balances = getAccountBalances(accounts, lines);

    expect(balances.find((balance) => balance.account.id === 'acct_aud')?.balanceMinor).toBe(25800);
    expect(balances.find((balance) => balance.account.id === 'acct_rainy')?.balanceMinor).toBe(25000);
  });

  it('groups dashboard totals by currency instead of converting', () => {
    const totals = groupBalancesByCurrency(getAccountBalances(accounts, lines));

    expect(totals).toEqual([
      { currencyCode: 'AUD', amountMinor: 50800 },
      { currencyCode: 'USD', amountMinor: 5000 },
    ]);
  });

  it('tracks rainy day fund progress from linked same-currency accounts only', () => {
    const fund: RainyDayFund = {
      id: 'fund',
      name: 'Rainy day fund',
      currencyCode: 'AUD',
      goalMinor: 100000,
      linkedAccountIds: ['acct_rainy', 'acct_usd'],
      createdAt: now,
      updatedAt: now,
    };

    const progress = getRainyDayProgress(fund, getAccountBalances(accounts, lines));

    expect(progress.currentMinor).toBe(25000);
    expect(progress.percentage).toBe(25);
  });

  it('ignores missing and closed rainy day fund accounts safely', () => {
    const archivedAccounts = accounts.map((item) =>
      item.id === 'acct_rainy' ? { ...item, isArchived: true } : item,
    );
    const fund: RainyDayFund = {
      id: 'fund',
      name: 'Rainy day fund',
      currencyCode: 'AUD',
      goalMinor: 100000,
      linkedAccountIds: ['acct_missing', 'acct_rainy'],
      createdAt: now,
      updatedAt: now,
    };

    const progress = getRainyDayProgress(fund, getAccountBalances(archivedAccounts, lines));

    expect(progress.currentMinor).toBe(0);
    expect(progress.remainingMinor).toBe(100000);
  });

  it('calculates spending, budgets, and cash flow without counting transfers as spending', () => {
    const spending = getSpendingByCategory({
      transactions,
      lines,
      range,
      currencyCode: 'AUD',
    });
    const budgets: Budget[] = [
      {
        id: 'budget_food',
        name: 'Food budget',
        amountMinor: 10000,
        period: 'monthly',
        scopeType: 'category',
        categoryId: 'food',
        subcategoryId: null,
        currencyCode: 'AUD',
        sortOrder: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
    const budgetUsage = getBudgetUsage(budgets, spending);
    const cashFlow = getCashFlowSummary({
      transactions,
      lines,
      range,
      currencyCode: 'AUD',
    });

    expect(spending).toEqual([{ categoryId: 'food', currencyCode: 'AUD', amountMinor: 4200 }]);
    expect(budgetUsage[0].remainingMinor).toBe(5800);
    expect(cashFlow).toEqual({
      currencyCode: 'AUD',
      incomeMinor: 25000,
      expenseMinor: 4200,
      netMinor: 20800,
    });
  });

  it('calculates split expense category totals from transaction lines', () => {
    const splitTransactions = [makeTransaction('split_expense', 'expense')];
    const splitLines = [
      makeLine({
        id: 'split_food',
        transactionId: 'split_expense',
        amountMinor: -8000,
        categoryId: 'food',
      }),
      makeLine({
        id: 'split_housing',
        transactionId: 'split_expense',
        amountMinor: -2000,
        categoryId: 'housing',
      }),
    ];

    expect(
      getSpendingByCategory({
        transactions: splitTransactions,
        lines: splitLines,
        range,
        currencyCode: 'AUD',
      }),
    ).toEqual([
      { categoryId: 'food', currencyCode: 'AUD', amountMinor: 8000 },
      { categoryId: 'housing', currencyCode: 'AUD', amountMinor: 2000 },
    ]);
    expect(
      getCashFlowSummary({
        transactions: splitTransactions,
        lines: splitLines,
        range,
        currencyCode: 'AUD',
      }).expenseMinor,
    ).toBe(10000);
  });

  it('calculates split income totals from transaction lines', () => {
    const splitTransactions = [makeTransaction('split_income', 'income')];
    const splitLines = [
      makeLine({
        id: 'split_salary',
        transactionId: 'split_income',
        amountMinor: 8000,
        categoryId: 'income',
      }),
      makeLine({
        id: 'split_bonus',
        transactionId: 'split_income',
        amountMinor: 2000,
        categoryId: 'income',
      }),
    ];

    expect(
      getCashFlowSummary({
        transactions: splitTransactions,
        lines: splitLines,
        range,
        currencyCode: 'AUD',
      }).incomeMinor,
    ).toBe(10000);
  });

  it.each(['refund', 'reimbursement', 'shared_expense_contribution'] as const)(
    'excludes linked %s income and reduces linked spending',
    (linkType) => {
      const linkedTransactions = [
        makeTransaction('normal_income', 'income'),
        makeTransaction('linked_income', 'income'),
        makeTransaction('linked_expense', 'expense'),
      ];
      const linkedLines = [
        makeLine({
          id: 'normal_income_line',
          transactionId: 'normal_income',
          amountMinor: 2500,
          categoryId: 'income',
        }),
        makeLine({
          id: 'linked_income_line',
          transactionId: 'linked_income',
          amountMinor: 4000,
          categoryId: 'income',
        }),
        makeLine({
          id: 'linked_expense_line',
          transactionId: 'linked_expense',
          amountMinor: -10000,
          categoryId: 'food',
        }),
      ];
      const transactionLinks = [makeLink({ linkType })];

      expect(
        getSpendingByCategory({
          transactions: linkedTransactions,
          lines: linkedLines,
          transactionLinks,
          range,
          currencyCode: 'AUD',
        }),
      ).toEqual([{ categoryId: 'food', currencyCode: 'AUD', amountMinor: 6000 }]);
      expect(
        getCashFlowSummary({
          transactions: linkedTransactions,
          lines: linkedLines,
          transactionLinks,
          range,
          currencyCode: 'AUD',
        }),
      ).toEqual({
        currencyCode: 'AUD',
        incomeMinor: 2500,
        expenseMinor: 6000,
        netMinor: -3500,
      });
    },
  );

  it('reduces a fully linked expense to zero counted spending without hiding transactions', () => {
    const linkedTransactions = [
      makeTransaction('linked_income', 'income'),
      makeTransaction('linked_expense', 'expense'),
    ];
    const linkedLines = [
      makeLine({
        id: 'linked_income_line',
        transactionId: 'linked_income',
        amountMinor: 10000,
        categoryId: 'income',
      }),
      makeLine({
        id: 'linked_expense_line',
        transactionId: 'linked_expense',
        amountMinor: -10000,
        categoryId: 'food',
      }),
    ];
    const transactionLinks = [makeLink({ amountMinor: 10000 })];

    expect(
      getSpendingByCategory({
        transactions: linkedTransactions,
        lines: linkedLines,
        transactionLinks,
        range,
        currencyCode: 'AUD',
      }),
    ).toEqual([]);
    expect(
      getTransactionDisplayEntries({
        transactions: linkedTransactions,
        lines: linkedLines,
        currencyCode: 'AUD',
      }).map((entry) => entry.transaction.id),
    ).toEqual(['linked_income', 'linked_expense']);
  });

  it('clamps overpaid linked expense category spending at zero', () => {
    const linkedTransactions = [
      makeTransaction('linked_income', 'income'),
      makeTransaction('linked_expense', 'expense'),
    ];
    const linkedLines = [
      makeLine({
        id: 'linked_income_line',
        transactionId: 'linked_income',
        amountMinor: 12000,
        categoryId: 'income',
      }),
      makeLine({
        id: 'linked_expense_line',
        transactionId: 'linked_expense',
        amountMinor: -10000,
        categoryId: 'food',
      }),
    ];

    expect(
      getSpendingByCategory({
        transactions: linkedTransactions,
        lines: linkedLines,
        transactionLinks: [makeLink({ amountMinor: 12000 })],
        range,
        currencyCode: 'AUD',
      }),
    ).toEqual([]);
  });

  it('reduces split expense lines proportionally and deterministically', () => {
    const linkedTransactions = [
      makeTransaction('linked_income', 'income'),
      makeTransaction('linked_expense', 'expense'),
    ];
    const linkedLines = [
      makeLine({
        id: 'linked_income_line',
        transactionId: 'linked_income',
        amountMinor: 5000,
        categoryId: 'income',
      }),
      makeLine({
        id: 'split_food',
        transactionId: 'linked_expense',
        amountMinor: -8000,
        categoryId: 'food',
      }),
      makeLine({
        id: 'split_housing',
        transactionId: 'linked_expense',
        amountMinor: -2000,
        categoryId: 'housing',
      }),
    ];

    expect(
      getSpendingByCategory({
        transactions: linkedTransactions,
        lines: linkedLines,
        transactionLinks: [makeLink({ amountMinor: 5000 })],
        range,
        currencyCode: 'AUD',
      }),
    ).toEqual([
      { categoryId: 'food', currencyCode: 'AUD', amountMinor: 4000 },
      { categoryId: 'housing', currencyCode: 'AUD', amountMinor: 1000 },
    ]);
  });

  it('reduces only the selected target expense line for line-level target links', () => {
    const linkedTransactions = [
      makeTransaction('linked_income', 'income'),
      makeTransaction('linked_expense', 'expense'),
    ];
    const linkedLines = [
      makeLine({
        id: 'linked_income_line',
        transactionId: 'linked_income',
        amountMinor: 1000,
        categoryId: 'income',
      }),
      makeLine({
        id: 'split_food',
        transactionId: 'linked_expense',
        amountMinor: -8000,
        categoryId: 'food',
      }),
      makeLine({
        id: 'split_housing',
        transactionId: 'linked_expense',
        amountMinor: -2000,
        categoryId: 'housing',
      }),
    ];

    expect(
      getSpendingByCategory({
        transactions: linkedTransactions,
        lines: linkedLines,
        transactionLinks: [makeLink({ amountMinor: 1000, targetLineId: 'split_housing' })],
        range,
        currencyCode: 'AUD',
      }),
    ).toEqual([
      { categoryId: 'food', currencyCode: 'AUD', amountMinor: 8000 },
      { categoryId: 'housing', currencyCode: 'AUD', amountMinor: 1000 },
    ]);
  });

  it('excludes only the selected source income line amount for line-level source links', () => {
    const linkedTransactions = [
      makeTransaction('linked_income', 'income'),
      makeTransaction('linked_expense', 'expense'),
    ];
    const linkedLines = [
      makeLine({
        id: 'salary_line',
        transactionId: 'linked_income',
        amountMinor: 3000,
        categoryId: 'income',
      }),
      makeLine({
        id: 'bonus_line',
        transactionId: 'linked_income',
        amountMinor: 2000,
        categoryId: 'income',
      }),
      makeLine({
        id: 'linked_expense_line',
        transactionId: 'linked_expense',
        amountMinor: -5000,
        categoryId: 'food',
      }),
    ];

    expect(
      getCashFlowSummary({
        transactions: linkedTransactions,
        lines: linkedLines,
        transactionLinks: [makeLink({ amountMinor: 1500, sourceLineId: 'bonus_line' })],
        range,
        currencyCode: 'AUD',
      }),
    ).toEqual({
      currencyCode: 'AUD',
      incomeMinor: 3500,
      expenseMinor: 3500,
      netMinor: 0,
    });
  });

  it('excludes transaction-level source income proportionally when sourceLineId is null', () => {
    const linkedTransactions = [
      makeTransaction('linked_income', 'income'),
      makeTransaction('linked_expense', 'expense'),
    ];
    const linkedLines = [
      makeLine({
        id: 'salary_line',
        transactionId: 'linked_income',
        amountMinor: 3000,
        categoryId: 'income',
      }),
      makeLine({
        id: 'bonus_line',
        transactionId: 'linked_income',
        amountMinor: 2000,
        categoryId: 'income',
      }),
      makeLine({
        id: 'linked_expense_line',
        transactionId: 'linked_expense',
        amountMinor: -5000,
        categoryId: 'food',
      }),
    ];

    expect(
      getCashFlowSummary({
        transactions: linkedTransactions,
        lines: linkedLines,
        transactionLinks: [makeLink({ amountMinor: 2500 })],
        range,
        currencyCode: 'AUD',
      }).incomeMinor,
    ).toBe(2500);
  });

  it('supports multiple line-level links from one source transaction to multiple target lines', () => {
    const linkedTransactions = [
      makeTransaction('linked_income', 'income'),
      makeTransaction('linked_expense', 'expense'),
    ];
    const linkedLines = [
      makeLine({
        id: 'linked_income_line',
        transactionId: 'linked_income',
        amountMinor: 5000,
        categoryId: 'income',
      }),
      makeLine({
        id: 'split_food',
        transactionId: 'linked_expense',
        amountMinor: -3000,
        categoryId: 'food',
      }),
      makeLine({
        id: 'split_housing',
        transactionId: 'linked_expense',
        amountMinor: -2000,
        categoryId: 'housing',
      }),
    ];
    const transactionLinks = [
      makeLink({ id: 'link_1', amountMinor: 1000, targetLineId: 'split_food' }),
      makeLink({ id: 'link_2', amountMinor: 1500, targetLineId: 'split_housing' }),
    ];

    expect(
      getSpendingByCategory({
        transactions: linkedTransactions,
        lines: linkedLines,
        transactionLinks,
        range,
        currencyCode: 'AUD',
      }),
    ).toEqual([
      { categoryId: 'food', currencyCode: 'AUD', amountMinor: 2000 },
      { categoryId: 'housing', currencyCode: 'AUD', amountMinor: 500 },
    ]);
    expect(
      getCashFlowSummary({
        transactions: linkedTransactions,
        lines: linkedLines,
        transactionLinks,
        range,
        currencyCode: 'AUD',
      }).incomeMinor,
    ).toBe(2500);
  });

  it('supports multiple links to one target line while clamping counted spending', () => {
    const linkedTransactions = [
      makeTransaction('linked_income', 'income'),
      makeTransaction('second_income', 'income'),
      makeTransaction('linked_expense', 'expense'),
    ];
    const linkedLines = [
      makeLine({
        id: 'linked_income_line',
        transactionId: 'linked_income',
        amountMinor: 2000,
        categoryId: 'income',
      }),
      makeLine({
        id: 'second_income_line',
        transactionId: 'second_income',
        amountMinor: 2000,
        categoryId: 'income',
      }),
      makeLine({
        id: 'split_food',
        transactionId: 'linked_expense',
        amountMinor: -5000,
        categoryId: 'food',
      }),
    ];
    const transactionLinks = [
      makeLink({ id: 'link_1', amountMinor: 1000, targetLineId: 'split_food' }),
      makeLink({
        id: 'link_2',
        sourceTransactionId: 'second_income',
        amountMinor: 1500,
        targetLineId: 'split_food',
      }),
    ];

    expect(
      getSpendingByCategory({
        transactions: linkedTransactions,
        lines: linkedLines,
        transactionLinks,
        range,
        currencyCode: 'AUD',
      }),
    ).toEqual([{ categoryId: 'food', currencyCode: 'AUD', amountMinor: 2500 }]);
  });

  it('ignores mismatched link currencies safely', () => {
    const linkedTransactions = [
      makeTransaction('linked_income', 'income'),
      makeTransaction('linked_expense', 'expense'),
    ];
    const linkedLines = [
      makeLine({
        id: 'linked_income_line',
        transactionId: 'linked_income',
        amountMinor: 4000,
        categoryId: 'income',
        currencyCode: 'USD',
      }),
      makeLine({
        id: 'linked_expense_line',
        transactionId: 'linked_expense',
        amountMinor: -10000,
        categoryId: 'food',
      }),
    ];

    expect(
      getSpendingByCategory({
        transactions: linkedTransactions,
        lines: linkedLines,
        transactionLinks: [makeLink({ currencyCode: 'USD' })],
        range,
        currencyCode: 'AUD',
      }),
    ).toEqual([{ categoryId: 'food', currencyCode: 'AUD', amountMinor: 10000 }]);
  });

  it('does not let links affect ledger account balances', () => {
    const linkedLines = [
      makeLine({
        id: 'linked_income_line',
        transactionId: 'linked_income',
        amountMinor: 4000,
        categoryId: 'income',
      }),
      makeLine({
        id: 'linked_expense_line',
        transactionId: 'linked_expense',
        amountMinor: -10000,
        categoryId: 'food',
      }),
    ];

    expect(getAccountBalances(accounts, linkedLines).find((balance) => balance.account.id === 'acct_aud')?.balanceMinor).toBe(4000);
  });

  it('shows internal transfer sides as separate display entries instead of netting to zero', () => {
    const entries = getTransactionDisplayEntries({
      transactions,
      lines,
      currencyCode: 'AUD',
    }).filter((entry) => entry.transaction.kind === 'transfer');

    expect(entries.map((entry) => entry.amountMinor)).toEqual([-5000, 5000]);
  });

  it('shows split expenses as one display entry with all split lines', () => {
    const splitTransactions = [makeTransaction('split_expense', 'expense')];
    const splitLines = [
      makeLine({
        id: 'split_food',
        transactionId: 'split_expense',
        amountMinor: -8000,
        categoryId: 'food',
      }),
      makeLine({
        id: 'split_housing',
        transactionId: 'split_expense',
        amountMinor: -2000,
        categoryId: 'housing',
      }),
    ];

    const entries = getTransactionDisplayEntries({
      transactions: splitTransactions,
      lines: splitLines,
      currencyCode: 'AUD',
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        id: 'split_expense',
        amountMinor: -10000,
        accountId: 'acct_aud',
      }),
    );
    expect(entries[0].lines.map((line) => line.id)).toEqual(['split_food', 'split_housing']);
  });

  it('shows split income as one display entry with all split lines', () => {
    const splitTransactions = [makeTransaction('split_income', 'income')];
    const splitLines = [
      makeLine({
        id: 'split_salary',
        transactionId: 'split_income',
        amountMinor: 8000,
        categoryId: 'income',
      }),
      makeLine({
        id: 'split_bonus',
        transactionId: 'split_income',
        amountMinor: 2000,
        categoryId: 'income',
      }),
    ];

    const entries = getTransactionDisplayEntries({
      transactions: splitTransactions,
      lines: splitLines,
      currencyCode: 'AUD',
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        id: 'split_income',
        amountMinor: 10000,
        accountId: 'acct_aud',
      }),
    );
    expect(entries[0].lines.map((line) => line.id)).toEqual(['split_salary', 'split_bonus']);
  });

  it('filters transfer display entries by selected account', () => {
    const entries = getTransactionDisplayEntries({
      transactions,
      lines,
      currencyCode: 'AUD',
      accountIds: ['acct_rainy'],
    }).filter((entry) => entry.transaction.kind === 'transfer');

    expect(entries).toHaveLength(1);
    expect(entries[0].amountMinor).toBe(5000);
  });

  it('returns no display entries when an explicit empty account filter is provided', () => {
    const entries = getTransactionDisplayEntries({
      transactions,
      lines,
      accountIds: [],
    });

    expect(entries).toEqual([]);
  });

  it('calculates account balances after transaction display entries', () => {
    const balances = getBalanceAfterDisplayEntries({ accounts, transactions, lines });

    expect(balances.txn_income).toBe(35000);
    expect(balances.txn_food).toBe(30800);
    expect(balances['txn_transfer:line_transfer_out']).toBe(25800);
    expect(balances['txn_transfer:line_transfer_in']).toBe(25000);
  });

  it('calculates selected account balances before a group boundary', () => {
    const balances = getAccountBalancesAt({
      accounts,
      transactions,
      lines,
      beforeIso: new Date(2026, 4, 16).toISOString(),
      accountIds: ['acct_aud', 'acct_rainy'],
    });

    expect(balances.map((balance) => balance.balanceMinor)).toEqual([25800, 25000]);
  });

  it('sorts same-time transactions by created time then id descending', () => {
    const sameTime = new Date(2026, 4, 20, 10).toISOString();
    const sorted = [
      { ...transactions[0], id: 'txn_a', datetime: sameTime, createdAt: '2026-05-20T01:00:00.000Z' },
      { ...transactions[1], id: 'txn_c', datetime: sameTime, createdAt: '2026-05-20T02:00:00.000Z' },
      { ...transactions[2], id: 'txn_b', datetime: sameTime, createdAt: '2026-05-20T02:00:00.000Z' },
    ].sort(compareTransactionsDescending);

    expect(sorted.map((transaction) => transaction.id)).toEqual(['txn_c', 'txn_b', 'txn_a']);
  });
});
