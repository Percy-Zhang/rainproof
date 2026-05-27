import {
  calculateBudgetPercentUsed,
  calculateBudgetRemaining,
  getBudgetMonthlyRange,
  getBudgetScopeDetail,
  getBudgetScopeLabel,
  getBudgetStatus,
  getBudgetUsageDisplayRows,
  getBudgetUsageFromStatsReport,
  getDashboardBudgetSummaryData,
} from '../budgets';
import { getStatsReport } from '../statsReports';
import type { Account, Budget, Transaction, TransactionLine, TransactionLink } from '../types';

const now = '2026-05-15T12:00:00.000Z';
const mayRange = {
  startIso: '2026-05-01T00:00:00.000Z',
  endIso: '2026-06-01T00:00:00.000Z',
};

const accounts: Account[] = [
  makeAccount('checking', 'Everyday', 'checking', 'AUD', 100000),
  makeAccount('credit_card', 'Rewards card', 'credit_card', 'AUD', -20000),
  makeAccount('usd_cash', 'USD Cash', 'cash', 'USD', 0),
];

describe('budget helpers', () => {
  it('uses local calendar month boundaries', () => {
    expect(getBudgetMonthlyRange(new Date(2026, 4, 20, 9, 30))).toEqual({
      startIso: new Date(2026, 4, 1, 0, 0, 0, 0).toISOString(),
      endIso: new Date(2026, 5, 1, 0, 0, 0, 0).toISOString(),
    });
  });

  it('calculates overall, category, and subcategory usage from net expense report rows', () => {
    const splitExpense = makeTransaction('split_expense', 'expense', 'Split shop');
    const cardPurchase = makeTransaction('card_purchase', 'expense', 'Card purchase');
    const income = makeTransaction('salary', 'income', 'Salary');
    const transfer = makeTransaction('card_payment', 'transfer', 'Card payment');
    const olderExpense = makeTransaction('older_expense', 'expense', 'Older groceries', '2026-04-20T12:00:00.000Z');
    const usdExpense = makeTransaction('usd_expense', 'expense', 'USD lunch');
    const lines = [
      makeLine('split_food', splitExpense.id, 'checking', -5000, 'AUD', 'food', 'groceries', 'Weekly food'),
      makeLine('split_rent', splitExpense.id, 'checking', -3000, 'AUD', 'housing', 'rent', 'Rent share'),
      makeLine('card_restaurants', cardPurchase.id, 'credit_card', -4000, 'AUD', 'food', 'restaurants'),
      makeLine('salary_line', income.id, 'checking', 100000, 'AUD', 'income', 'salary'),
      makeLine('payment_out', transfer.id, 'checking', -2000, 'AUD', '', '', '', 'credit_card'),
      makeLine('payment_in', transfer.id, 'credit_card', 2000, 'AUD', '', '', '', 'checking'),
      makeLine('older_food', olderExpense.id, 'checking', -7000, 'AUD', 'food', 'groceries'),
      makeLine('usd_food', usdExpense.id, 'usd_cash', -9000, 'USD', 'food', 'groceries'),
    ];
    const report = getExpenseReport({
      transactions: [splitExpense, cardPurchase, income, transfer, olderExpense, usdExpense],
      lines,
    });

    const usages = getBudgetUsageFromStatsReport({
      budgets: [
        makeBudget('overall', 'Overall', 15000, 'overall'),
        makeBudget('food', 'Food', 10000, 'category', 'food'),
        makeBudget('restaurants', 'Restaurants', 5000, 'subcategory', 'food', 'restaurants'),
      ],
      report,
    });

    expect(usages).toEqual([
      expect.objectContaining({
        budget: expect.objectContaining({ id: 'overall' }),
        spentMinor: 12000,
        matchingLineIds: ['card_restaurants', 'split_food', 'split_rent'],
      }),
      expect.objectContaining({
        budget: expect.objectContaining({ id: 'food' }),
        spentMinor: 9000,
        matchingLineIds: ['card_restaurants', 'split_food'],
      }),
      expect.objectContaining({
        budget: expect.objectContaining({ id: 'restaurants' }),
        spentMinor: 4000,
        matchingLineIds: ['card_restaurants'],
      }),
    ]);
  });

  it('reduces only the targeted budget line for line-level links', () => {
    const source = makeTransaction('payback', 'income', 'Payback');
    const target = makeTransaction('split_expense', 'expense', 'Split expense');
    const lines = [
      makeLine('source_line', source.id, 'checking', 1000, 'AUD', 'income', 'reimbursement'),
      makeLine('target_food', target.id, 'checking', -5000, 'AUD', 'food', 'groceries'),
      makeLine('target_rent', target.id, 'checking', -3000, 'AUD', 'housing', 'rent'),
    ];
    const report = getExpenseReport({
      transactions: [source, target],
      lines,
      transactionLinks: [
        makeLink({
          sourceTransactionId: source.id,
          targetTransactionId: target.id,
          targetLineId: 'target_food',
          amountMinor: 1000,
        }),
      ],
    });

    const usages = getBudgetUsageFromStatsReport({
      budgets: [
        makeBudget('food', 'Food', 7000, 'category', 'food'),
        makeBudget('housing', 'Housing', 7000, 'category', 'housing'),
      ],
      report,
    });

    expect(usages).toEqual([
      expect.objectContaining({ budget: expect.objectContaining({ id: 'food' }), spentMinor: 4000 }),
      expect.objectContaining({ budget: expect.objectContaining({ id: 'housing' }), spentMinor: 3000 }),
    ]);
  });

  it('keeps transaction-level links proportional for split expense budgets', () => {
    const source = makeTransaction('payback', 'income', 'Payback');
    const target = makeTransaction('split_expense', 'expense', 'Split expense');
    const lines = [
      makeLine('source_line', source.id, 'checking', 4000, 'AUD', 'income', 'reimbursement'),
      makeLine('target_food', target.id, 'checking', -5000, 'AUD', 'food', 'groceries'),
      makeLine('target_rent', target.id, 'checking', -3000, 'AUD', 'housing', 'rent'),
    ];
    const report = getExpenseReport({
      transactions: [source, target],
      lines,
      transactionLinks: [
        makeLink({
          sourceTransactionId: source.id,
          targetTransactionId: target.id,
          amountMinor: 4000,
        }),
      ],
    });

    const usages = getBudgetUsageFromStatsReport({
      budgets: [
        makeBudget('overall', 'Overall', 10000, 'overall'),
        makeBudget('food', 'Food', 7000, 'category', 'food'),
        makeBudget('housing', 'Housing', 7000, 'category', 'housing'),
      ],
      report,
    });

    expect(usages).toEqual([
      expect.objectContaining({ budget: expect.objectContaining({ id: 'overall' }), spentMinor: 4000 }),
      expect.objectContaining({ budget: expect.objectContaining({ id: 'food' }), spentMinor: 2500 }),
      expect.objectContaining({ budget: expect.objectContaining({ id: 'housing' }), spentMinor: 1500 }),
    ]);
  });

  it('strictly filters budget usage by report currency', () => {
    const audExpense = makeTransaction('aud_expense', 'expense', 'AUD groceries');
    const usdExpense = makeTransaction('usd_expense', 'expense', 'USD groceries');
    const lines = [
      makeLine('aud_food', audExpense.id, 'checking', -5000, 'AUD', 'food', 'groceries'),
      makeLine('usd_food', usdExpense.id, 'usd_cash', -9000, 'USD', 'food', 'groceries'),
    ];
    const audReport = getExpenseReport({ transactions: [audExpense, usdExpense], lines, currencyCode: 'AUD' });

    expect(
      getBudgetUsageFromStatsReport({
        budgets: [
          makeBudget('aud_food', 'AUD food', 10000, 'category', 'food', null, 'AUD'),
          makeBudget('usd_food', 'USD food', 10000, 'category', 'food', null, 'USD'),
        ],
        report: audReport,
      }),
    ).toEqual([
      expect.objectContaining({ budget: expect.objectContaining({ id: 'aud_food' }), spentMinor: 5000 }),
    ]);
  });

  it('calculates remaining amount, percent used, status, and dashboard risk summary', () => {
    expect(calculateBudgetRemaining(10000, 12000)).toBe(-2000);
    expect(calculateBudgetPercentUsed(10000, 7900)).toBe(79);
    expect(getBudgetStatus(79)).toBe('under_budget');
    expect(getBudgetStatus(80)).toBe('near_limit');
    expect(getBudgetStatus(100)).toBe('over_budget');

    const usages = [
      makeUsage(makeBudget('under', 'Under', 10000, 'overall'), 2000),
      makeUsage(makeBudget('near', 'Near', 10000, 'overall', null, null, 'USD'), 9000),
      makeUsage(makeBudget('over', 'Over', 10000, 'overall', null, null, 'EUR'), 12000),
    ];

    expect(getDashboardBudgetSummaryData(usages, 2)).toEqual({
      activeBudgetCount: 3,
      overBudgetCount: 1,
      nearLimitCount: 1,
      highestRiskUsages: [usages[2], usages[1]],
    });
  });

  it('builds display labels and icon metadata for budget rows', () => {
    const categoryBudget = makeBudget('food', 'Food', 10000, 'category', 'food');
    const subcategoryBudget = makeBudget('groceries', 'Groceries', 10000, 'subcategory', 'food', 'groceries');
    const rows = getBudgetUsageDisplayRows([
      makeUsage(categoryBudget, 2000),
      makeUsage(subcategoryBudget, 3000),
    ]);

    expect(getBudgetScopeLabel(makeBudget('overall', 'Overall', 10000, 'overall'))).toBe('Overall monthly spending');
    expect(getBudgetScopeDetail(categoryBudget)).toBe('Category budget');
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'food',
        scopeLabel: 'Food & Dining',
        scopeDetail: 'Category budget',
        icon: 'restaurant-outline',
        color: '#C45A16',
      }),
      expect.objectContaining({
        id: 'groceries',
        scopeLabel: 'Groceries',
        scopeDetail: 'Food & Dining',
        icon: 'basket-outline',
        color: '#C45A16',
      }),
    ]);
  });
});

function getExpenseReport({
  transactions,
  lines,
  transactionLinks = [],
  currencyCode = 'AUD',
}: {
  transactions: Transaction[];
  lines: TransactionLine[];
  transactionLinks?: TransactionLink[];
  currencyCode?: string;
}) {
  return getStatsReport({
    reportKind: 'expense',
    transactions,
    transactionLines: lines,
    transactionLinks,
    accounts,
    range: mayRange,
    currencyCode,
  });
}

function makeBudget(
  id: string,
  name: string,
  amountMinor: number,
  scopeType: Budget['scopeType'],
  categoryId: string | null = null,
  subcategoryId: string | null = null,
  currencyCode = 'AUD',
): Budget {
  return {
    id,
    name,
    amountMinor,
    currencyCode,
    period: 'monthly',
    scopeType,
    categoryId,
    subcategoryId,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

function makeUsage(budget: Budget, spentMinor: number) {
  const percentageUsed = calculateBudgetPercentUsed(budget.amountMinor, spentMinor);
  return {
    budget,
    spentMinor,
    remainingMinor: calculateBudgetRemaining(budget.amountMinor, spentMinor),
    percentageUsed,
    status: getBudgetStatus(percentageUsed),
    matchingLineIds: [],
  };
}

function makeAccount(
  id: string,
  name: string,
  type: Account['type'],
  currencyCode: string,
  openingBalanceMinor: number,
): Account {
  return {
    id,
    name,
    nickname: '',
    type,
    currencyCode,
    openingBalanceMinor,
    creditLimitMinor: type === 'credit_card' ? 100000 : null,
    notes: '',
    institutionName: '',
    includeInRainyDay: false,
    themeColor: '#1876A8',
    iconName: 'business-outline',
    showOnDashboard: true,
    sortOrder: 0,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
}

function makeTransaction(
  id: string,
  kind: Transaction['kind'],
  title: string,
  datetime = now,
): Transaction {
  return {
    id,
    kind,
    title,
    datetime,
    notes: '',
    labels: [],
    groupId: '',
    createdAt: datetime,
    updatedAt: datetime,
  };
}

function makeLine(
  id: string,
  transactionId: string,
  accountId: string,
  amountMinor: number,
  currencyCode: string,
  categoryId: string,
  subcategoryId: string,
  note = '',
  transferPeerAccountId = '',
): TransactionLine {
  return {
    id,
    transactionId,
    accountId,
    amountMinor,
    currencyCode,
    categoryId,
    subcategoryId,
    externalParty: '',
    transferPeerAccountId,
    note,
    createdAt: now,
  };
}

function makeLink(input: {
  sourceTransactionId: string;
  targetTransactionId: string;
  amountMinor: number;
  sourceLineId?: string | null;
  targetLineId?: string | null;
}): TransactionLink {
  return {
    id: `link_${input.targetLineId ?? input.targetTransactionId}`,
    sourceTransactionId: input.sourceTransactionId,
    targetTransactionId: input.targetTransactionId,
    sourceLineId: input.sourceLineId ?? null,
    targetLineId: input.targetLineId ?? null,
    linkType: 'reimbursement',
    amountMinor: input.amountMinor,
    currencyCode: 'AUD',
    createdAt: now,
    updatedAt: now,
  };
}
