import {
  budgetPeriodOptions,
  calculateBudgetPercentUsed,
  calculateBudgetRemaining,
  formatBudgetPeriodRange,
  getBudgetCurrencyOptions,
  getBudgetHistoryForBudget,
  getBudgetMonthlyRange,
  getBudgetPeriodCurrentLabel,
  getBudgetPeriodOffsetLabel,
  getBudgetPeriodRange,
  getBudgetScopeDetail,
  getBudgetScopeLabel,
  getBudgetStatus,
  getBudgetUsageDisplayRows,
  getBudgetUsageFromStatsReport,
  getBudgetUsagesForPeriods,
  getDashboardBudgetSummaryData,
  sortBudgetUsageDisplayRowsByDisplayOrder,
  sortBudgetUsagesByDisplayOrder,
} from '../budgets';
import { getStatsReport } from '../statsReports';
import { defaultCategories } from '../categories';
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

  it('exposes only the supported calendar and rolling period options', () => {
    expect(budgetPeriodOptions.map((option) => option.value)).toEqual([
      'weekly',
      'monthly',
      'yearly',
      'rolling_7',
      'rolling_30',
      'rolling_365',
    ]);
    expect(budgetPeriodOptions.map((option) => option.label)).not.toContain('Quarterly');
    expect(budgetPeriodOptions.map((option) => option.label)).not.toContain('Rolling 90 days');
  });

  it('builds weekly, monthly, and yearly calendar windows', () => {
    const date = new Date(2026, 5, 10, 9, 30);

    expect(getBudgetPeriodRange('weekly', date)).toEqual({
      startIso: new Date(2026, 5, 8, 0, 0, 0, 0).toISOString(),
      endIso: new Date(2026, 5, 15, 0, 0, 0, 0).toISOString(),
    });
    expect(getBudgetPeriodRange('monthly', date)).toEqual({
      startIso: new Date(2026, 5, 1, 0, 0, 0, 0).toISOString(),
      endIso: new Date(2026, 6, 1, 0, 0, 0, 0).toISOString(),
    });
    expect(getBudgetPeriodRange('yearly', date)).toEqual({
      startIso: new Date(2026, 0, 1, 0, 0, 0, 0).toISOString(),
      endIso: new Date(2027, 0, 1, 0, 0, 0, 0).toISOString(),
    });
  });

  it('builds rolling 7, 30, and 365 day windows ending on the anchor date', () => {
    const date = new Date(2026, 5, 9, 9, 30);

    expect(getBudgetPeriodRange('rolling_7', date)).toEqual({
      startIso: new Date(2026, 5, 3, 0, 0, 0, 0).toISOString(),
      endIso: new Date(2026, 5, 10, 0, 0, 0, 0).toISOString(),
    });
    expect(getBudgetPeriodRange('rolling_30', date)).toEqual({
      startIso: new Date(2026, 4, 11, 0, 0, 0, 0).toISOString(),
      endIso: new Date(2026, 5, 10, 0, 0, 0, 0).toISOString(),
    });
    expect(getBudgetPeriodRange('rolling_365', date)).toEqual({
      startIso: new Date(2025, 5, 10, 0, 0, 0, 0).toISOString(),
      endIso: new Date(2026, 5, 10, 0, 0, 0, 0).toISOString(),
    });
  });

  it('navigates budget periods and formats clear labels', () => {
    const date = new Date(2026, 5, 10, 9, 30);
    const previousWeek = getBudgetPeriodRange('weekly', date, -1);
    const nextYear = getBudgetPeriodRange('yearly', date, 1);

    expect(previousWeek).toEqual({
      startIso: new Date(2026, 5, 1, 0, 0, 0, 0).toISOString(),
      endIso: new Date(2026, 5, 8, 0, 0, 0, 0).toISOString(),
    });
    expect(nextYear).toEqual({
      startIso: new Date(2027, 0, 1, 0, 0, 0, 0).toISOString(),
      endIso: new Date(2028, 0, 1, 0, 0, 0, 0).toISOString(),
    });
    expect(getBudgetPeriodCurrentLabel('weekly')).toBe('This week');
    expect(getBudgetPeriodCurrentLabel('monthly')).toBe('This month');
    expect(getBudgetPeriodCurrentLabel('yearly')).toBe('This year');
    expect(getBudgetPeriodOffsetLabel('monthly', -1)).toBe('Previous month');
    expect(getBudgetPeriodOffsetLabel('yearly', 2)).toBe('2 years ahead');
    expect(formatBudgetPeriodRange(previousWeek)).toBe('1-7 Jun 2026');
  });

  it('moves rolling period anchors one day per navigation step', () => {
    const date = new Date(2026, 5, 9, 9, 30);
    const previousRollingWindow = getBudgetPeriodRange('rolling_7', date, -1);
    const nextRollingWindow = getBudgetPeriodRange('rolling_30', date, 1);

    expect(previousRollingWindow).toEqual({
      startIso: new Date(2026, 5, 2, 0, 0, 0, 0).toISOString(),
      endIso: new Date(2026, 5, 9, 0, 0, 0, 0).toISOString(),
    });
    expect(nextRollingWindow).toEqual({
      startIso: new Date(2026, 4, 12, 0, 0, 0, 0).toISOString(),
      endIso: new Date(2026, 5, 11, 0, 0, 0, 0).toISOString(),
    });
    expect(getBudgetPeriodCurrentLabel('rolling_7')).toBe('Rolling 7 days');
    expect(getBudgetPeriodOffsetLabel('rolling_30', -1)).toBe('1 day back');
    expect(getBudgetPeriodOffsetLabel('rolling_365', 2)).toBe('2 days ahead');
    expect(formatBudgetPeriodRange(previousRollingWindow)).toBe('2-8 Jun 2026');
  });

  it('calculates current and previous usage using each budget calendar period', () => {
    const anchorDate = new Date(2026, 5, 10, 9, 30);
    const transactions = [
      makeTransaction('current_week', 'expense', 'Current week', '2026-06-09T12:00:00.000Z'),
      makeTransaction('previous_week', 'expense', 'Previous week', '2026-06-02T12:00:00.000Z'),
      makeTransaction('previous_month', 'expense', 'Previous month', '2026-05-20T12:00:00.000Z'),
    ];
    const lines = [
      makeLine('current_week_line', 'current_week', 'checking', -1000, 'AUD', 'food', 'groceries'),
      makeLine('previous_week_line', 'previous_week', 'checking', -2000, 'AUD', 'food', 'groceries'),
      makeLine('previous_month_line', 'previous_month', 'checking', -4000, 'AUD', 'food', 'groceries'),
    ];
    const budgets = [
      makeBudget('weekly', 'Weekly food', 10000, 'category', 'food', null, 'AUD', 0, undefined, 'weekly'),
      makeBudget('monthly', 'Monthly food', 20000, 'category', 'food'),
    ];

    const currentUsages = getBudgetUsagesForPeriods({
      accounts,
      anchorDate,
      budgets,
      categories: defaultCategories,
      transactionLines: lines,
      transactionLinks: [],
      transactions,
    });
    const previousUsages = getBudgetUsagesForPeriods({
      accounts,
      anchorDate,
      budgets,
      categories: defaultCategories,
      periodOffset: -1,
      transactionLines: lines,
      transactionLinks: [],
      transactions,
    });

    expect(currentUsages.map((usage) => [usage.budget.id, usage.spentMinor])).toEqual([
      ['weekly', 1000],
      ['monthly', 3000],
    ]);
    expect(previousUsages.map((usage) => [usage.budget.id, usage.spentMinor])).toEqual([
      ['weekly', 2000],
      ['monthly', 4000],
    ]);
  });

  it('calculates rolling usage by anchor date while preserving scopes and mixed split spending', () => {
    const anchorDate = new Date(2026, 5, 9, 9, 30);
    const currentFood = makeTransaction('current_food', 'expense', 'Current food', '2026-06-09T12:00:00.000Z');
    const mixedIncome = makeTransaction('mixed_income', 'income', 'Salary after tax', '2026-06-08T12:00:00.000Z');
    const transport = makeTransaction('transport', 'expense', 'Fuel', '2026-05-20T12:00:00.000Z');
    const outside = makeTransaction('outside', 'expense', 'Older groceries', '2026-05-10T12:00:00.000Z');
    const lines = [
      makeLine('current_food_line', currentFood.id, 'checking', -1000, 'AUD', 'food', 'groceries'),
      makeLine('mixed_income_line', mixedIncome.id, 'checking', 230000, 'AUD', 'income', 'salary'),
      makeLine('mixed_tax_line', mixedIncome.id, 'checking', -6000, 'AUD', 'food', 'groceries'),
      makeLine('transport_line', transport.id, 'checking', -2000, 'AUD', 'transport', 'fuel'),
      makeLine('outside_line', outside.id, 'checking', -4000, 'AUD', 'food', 'groceries'),
    ];
    const budgets = [
      makeBudget('rolling_food', 'Rolling food', 20000, 'include', 'food', null, 'AUD', 0, [
        { categoryId: 'food', subcategoryId: null },
      ], 'rolling_7'),
      makeBudget('rolling_not_food', 'Rolling non-food', 20000, 'exclude', 'food', null, 'AUD', 1, [
        { categoryId: 'food', subcategoryId: null },
      ], 'rolling_30'),
    ];

    const currentUsages = getBudgetUsagesForPeriods({
      accounts,
      anchorDate,
      budgets,
      categories: defaultCategories,
      transactionLines: lines,
      transactionLinks: [],
      transactions: [currentFood, mixedIncome, transport, outside],
    });
    const previousUsages = getBudgetUsagesForPeriods({
      accounts,
      anchorDate,
      budgets,
      categories: defaultCategories,
      periodOffset: -1,
      transactionLines: lines,
      transactionLinks: [],
      transactions: [currentFood, mixedIncome, transport, outside],
    });

    expect(currentUsages.map((usage) => [usage.budget.id, usage.spentMinor])).toEqual([
      ['rolling_food', 7000],
      ['rolling_not_food', 2000],
    ]);
    expect(previousUsages.map((usage) => [usage.budget.id, usage.spentMinor])).toEqual([
      ['rolling_food', 6000],
      ['rolling_not_food', 2000],
    ]);
  });

  it('builds compact weekly, monthly, and yearly history buckets ending at the selected period', () => {
    const anchorDate = new Date(2026, 5, 10, 9, 30);
    const baseInput = {
      accounts,
      anchorDate,
      categories: defaultCategories,
      pointCount: 3,
      transactionLines: [],
      transactionLinks: [],
      transactions: [],
    };

    const weekly = getBudgetHistoryForBudget({
      ...baseInput,
      budget: makeBudget('weekly_history', 'Weekly', 10000, 'overall', null, null, 'AUD', 0, undefined, 'weekly'),
    });
    const monthly = getBudgetHistoryForBudget({
      ...baseInput,
      budget: makeBudget('monthly_history', 'Monthly', 10000, 'overall'),
    });
    const yearly = getBudgetHistoryForBudget({
      ...baseInput,
      budget: makeBudget('yearly_history', 'Yearly', 10000, 'overall', null, null, 'AUD', 0, undefined, 'yearly'),
    });

    expect(weekly.map((point) => [point.offset, point.shortLabel, point.rangeLabel])).toEqual([
      [-2, '25 May', '25-31 May 2026'],
      [-1, '1 Jun', '1-7 Jun 2026'],
      [0, '8 Jun', '8-14 Jun 2026'],
    ]);
    expect(monthly.map((point) => [point.offset, point.shortLabel, point.rangeLabel])).toEqual([
      [-2, 'Apr', '1-30 Apr 2026'],
      [-1, 'May', '1-31 May 2026'],
      [0, 'Jun', '1-30 Jun 2026'],
    ]);
    expect(yearly.map((point) => [point.offset, point.shortLabel])).toEqual([
      [-2, '2024'],
      [-1, '2025'],
      [0, '2026'],
    ]);
  });

  it('builds rolling history snapshots by anchor day for all rolling periods', () => {
    const anchorDate = new Date(2026, 5, 9, 9, 30);
    const baseInput = {
      accounts,
      anchorDate,
      categories: defaultCategories,
      pointCount: 3,
      transactionLines: [],
      transactionLinks: [],
      transactions: [],
    };

    for (const period of ['rolling_7', 'rolling_30', 'rolling_365'] as const) {
      const history = getBudgetHistoryForBudget({
        ...baseInput,
        budget: makeBudget(period, period, 10000, 'overall', null, null, 'AUD', 0, undefined, period),
      });

      expect(history.map((point) => [point.offset, point.shortLabel])).toEqual([
        [-2, '7 Jun'],
        [-1, '8 Jun'],
        [0, '9 Jun'],
      ]);
      expect(new Date(history[2].range.endIso)).toEqual(new Date(2026, 5, 10));
    }

    const rolling365 = getBudgetHistoryForBudget({
      ...baseInput,
      budget: makeBudget('rolling_year', 'Rolling year', 10000, 'overall', null, null, 'AUD', 0, undefined, 'rolling_365'),
    });
    expect(new Date(rolling365[2].range.startIso)).toEqual(new Date(2025, 5, 10));
  });

  it('includes limit, remaining, over-budget, scope, and mixed-line data in budget history', () => {
    const april = makeTransaction('april', 'expense', 'April groceries', '2026-04-15T12:00:00.000Z');
    const mayMixed = makeTransaction('may_mixed', 'income', 'May pay after tax', '2026-05-15T12:00:00.000Z');
    const june = makeTransaction('june', 'expense', 'June groceries', '2026-06-05T12:00:00.000Z');
    const ignoredHousing = makeTransaction('housing', 'expense', 'June rent', '2026-06-06T12:00:00.000Z');
    const history = getBudgetHistoryForBudget({
      accounts,
      anchorDate: new Date(2026, 5, 10, 9, 30),
      budget: makeBudget('food_history', 'Food history', 10000, 'include', 'food', null, 'AUD', 0, [
        { categoryId: 'food', subcategoryId: null },
      ]),
      categories: defaultCategories,
      pointCount: 3,
      transactionLines: [
        makeLine('april_food', april.id, 'checking', -5000, 'AUD', 'food', 'groceries'),
        makeLine('may_income', mayMixed.id, 'checking', 23000, 'AUD', 'income', 'salary'),
        makeLine('may_food', mayMixed.id, 'checking', -12000, 'AUD', 'food', 'groceries'),
        makeLine('june_food', june.id, 'checking', -8000, 'AUD', 'food', 'groceries'),
        makeLine('june_housing', ignoredHousing.id, 'checking', -9000, 'AUD', 'housing', 'rent'),
      ],
      transactionLinks: [],
      transactions: [april, mayMixed, june, ignoredHousing],
    });

    expect(history.map((point) => ({
      limitMinor: point.limitMinor,
      percentageUsed: point.percentageUsed,
      remainingMinor: point.remainingMinor,
      spentMinor: point.spentMinor,
      status: point.status,
    }))).toEqual([
      {
        limitMinor: 10000,
        percentageUsed: 50,
        remainingMinor: 5000,
        spentMinor: 5000,
        status: 'under_budget',
      },
      {
        limitMinor: 10000,
        percentageUsed: 120,
        remainingMinor: -2000,
        spentMinor: 12000,
        status: 'over_budget',
      },
      {
        limitMinor: 10000,
        percentageUsed: 80,
        remainingMinor: 2000,
        spentMinor: 8000,
        status: 'near_limit',
      },
    ]);
  });

  it('uses today as the default anchor for current Dashboard rolling usage', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 5, 9, 12, 0));

    try {
      const firstIncluded = makeTransaction('first_included', 'expense', 'First included', '2026-06-03T12:00:00.000Z');
      const beforeWindow = makeTransaction('before_window', 'expense', 'Before window', '2026-06-02T12:00:00.000Z');
      const usages = getBudgetUsagesForPeriods({
        accounts,
        budgets: [
          makeBudget('rolling_week', 'Rolling week', 10000, 'overall', null, null, 'AUD', 0, undefined, 'rolling_7'),
        ],
        categories: defaultCategories,
        transactionLines: [
          makeLine('first_included_line', firstIncluded.id, 'checking', -1000, 'AUD', 'food', 'groceries'),
          makeLine('before_window_line', beforeWindow.id, 'checking', -5000, 'AUD', 'food', 'groceries'),
        ],
        transactionLinks: [],
        transactions: [firstIncluded, beforeWindow],
      });

      expect(usages).toEqual([
        expect.objectContaining({
          budget: expect.objectContaining({ id: 'rolling_week' }),
          matchingLineIds: ['first_included_line'],
          spentMinor: 1000,
        }),
      ]);
    } finally {
      jest.useRealTimers();
    }
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

  it('counts only negative mixed split lines in expense budget usage', () => {
    const mixedIncome = makeTransaction('mixed_income', 'income', 'Pay with tax');
    const lines = [
      makeLine('mixed_salary', mixedIncome.id, 'checking', 230000, 'AUD', 'income', 'salary'),
      makeLine('mixed_tax', mixedIncome.id, 'checking', -60000, 'AUD', 'food', 'groceries'),
    ];
    const report = getExpenseReport({
      transactions: [mixedIncome],
      lines,
    });

    const usages = getBudgetUsageFromStatsReport({
      budgets: [
        makeBudget('overall', 'Overall', 100000, 'overall'),
        makeBudget('food', 'Food', 100000, 'category', 'food'),
        makeBudget('income', 'Income', 100000, 'category', 'income'),
      ],
      report,
    });

    expect(usages).toEqual([
      expect.objectContaining({ budget: expect.objectContaining({ id: 'overall' }), spentMinor: 60000 }),
      expect.objectContaining({ budget: expect.objectContaining({ id: 'food' }), spentMinor: 60000 }),
      expect.objectContaining({ budget: expect.objectContaining({ id: 'income' }), spentMinor: 0 }),
    ]);
  });

  it('calculates include and exclude category scopes from expense report rows', () => {
    const splitExpense = makeTransaction('split_expense', 'expense', 'Split shop');
    const fuelExpense = makeTransaction('fuel_expense', 'expense', 'Fuel');
    const income = makeTransaction('salary', 'income', 'Salary');
    const transfer = makeTransaction('transfer', 'transfer', 'Transfer');
    const lines = [
      makeLine('split_groceries', splitExpense.id, 'checking', -5000, 'AUD', 'food', 'groceries'),
      makeLine('split_restaurants', splitExpense.id, 'checking', -3000, 'AUD', 'food', 'restaurants'),
      makeLine('split_rent', splitExpense.id, 'checking', -7000, 'AUD', 'housing', 'rent'),
      makeLine('fuel', fuelExpense.id, 'checking', -2000, 'AUD', 'transport', 'fuel'),
      makeLine('salary_line', income.id, 'checking', 100000, 'AUD', 'income', 'salary'),
      makeLine('transfer_out', transfer.id, 'checking', -2000, 'AUD', '', '', '', 'credit_card'),
      makeLine('transfer_in', transfer.id, 'credit_card', 2000, 'AUD', '', '', '', 'checking'),
    ];
    const report = getExpenseReport({
      transactions: [splitExpense, fuelExpense, income, transfer],
      lines,
    });

    const usages = getBudgetUsageFromStatsReport({
      budgets: [
        makeBudget('include_food', 'Food', 20000, 'include', 'food', null, 'AUD', 0, [
          { categoryId: 'food', subcategoryId: null },
        ]),
        makeBudget('include_groceries', 'Groceries', 10000, 'include', 'food', 'groceries', 'AUD', 0, [
          { categoryId: 'food', subcategoryId: 'groceries' },
        ]),
        makeBudget('include_many', 'Food and fuel', 25000, 'include', 'food', null, 'AUD', 0, [
          { categoryId: 'food', subcategoryId: null },
          { categoryId: 'transport', subcategoryId: 'fuel' },
        ]),
        makeBudget('exclude_food', 'Not food', 25000, 'exclude', 'food', null, 'AUD', 0, [
          { categoryId: 'food', subcategoryId: null },
        ]),
        makeBudget('exclude_groceries', 'Not groceries', 25000, 'exclude', 'food', 'groceries', 'AUD', 0, [
          { categoryId: 'food', subcategoryId: 'groceries' },
        ]),
      ],
      report,
    });

    expect(usages).toEqual([
      expect.objectContaining({
        budget: expect.objectContaining({ id: 'include_food' }),
        spentMinor: 8000,
        matchingLineIds: ['split_groceries', 'split_restaurants'],
      }),
      expect.objectContaining({
        budget: expect.objectContaining({ id: 'include_groceries' }),
        spentMinor: 5000,
        matchingLineIds: ['split_groceries'],
      }),
      expect.objectContaining({
        budget: expect.objectContaining({ id: 'include_many' }),
        spentMinor: 10000,
        matchingLineIds: ['fuel', 'split_groceries', 'split_restaurants'],
      }),
      expect.objectContaining({
        budget: expect.objectContaining({ id: 'exclude_food' }),
        spentMinor: 9000,
        matchingLineIds: ['fuel', 'split_rent'],
      }),
      expect.objectContaining({
        budget: expect.objectContaining({ id: 'exclude_groceries' }),
        spentMinor: 12000,
        matchingLineIds: ['fuel', 'split_restaurants', 'split_rent'],
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
      makeUsage(makeBudget('multi', 'Multi', 10000, 'include', 'food', null, 'AUD', 0, [
        { categoryId: 'food', subcategoryId: null },
        { categoryId: 'transport', subcategoryId: 'fuel' },
      ]), 4000),
      makeUsage(makeBudget('exclude', 'Exclude', 10000, 'exclude', 'food', null, 'AUD', 0, [
        { categoryId: 'food', subcategoryId: null },
      ]), 5000),
    ]);

    expect(getBudgetScopeLabel(makeBudget('overall', 'Overall', 10000, 'overall'))).toBe('Overall monthly spending');
    expect(
      getBudgetScopeLabel(
        makeBudget('rolling', 'Rolling', 10000, 'overall', null, null, 'AUD', 0, undefined, 'rolling_30'),
      ),
    ).toBe('Overall rolling 30-day spending');
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
      expect.objectContaining({
        id: 'multi',
        scopeLabel: 'Food & Dining + 1 more',
        scopeDetail: '2 selected categories',
        icon: 'restaurant-outline',
        color: '#C45A16',
      }),
      expect.objectContaining({
        id: 'exclude',
        scopeLabel: 'Excludes Food & Dining',
        scopeDetail: 'All spending except selected',
        icon: 'restaurant-outline',
        color: '#C45A16',
      }),
    ]);
  });

  it('sorts budget usages and display rows by manual budget order without changing calculations', () => {
    const usageA = makeUsage(makeBudget('a', 'A', 10000, 'overall', null, null, 'AUD', 2), 2000);
    const usageB = makeUsage(makeBudget('b', 'B', 10000, 'overall', null, null, 'AUD', 0), 9000);
    const usageC = makeUsage(makeBudget('c', 'C', 10000, 'overall', null, null, 'AUD', 1), 12000);

    expect(sortBudgetUsagesByDisplayOrder([usageA, usageB, usageC]).map((usage) => usage.budget.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
    expect(
      sortBudgetUsageDisplayRowsByDisplayOrder(getBudgetUsageDisplayRows([usageA, usageB, usageC])).map(
        (row) => ({ id: row.id, spentMinor: row.spentMinor, percentageUsed: row.percentageUsed }),
      ),
    ).toEqual([
      { id: 'b', spentMinor: 9000, percentageUsed: 90 },
      { id: 'c', spentMinor: 12000, percentageUsed: 120 },
      { id: 'a', spentMinor: 2000, percentageUsed: 20 },
    ]);
  });

  it('builds budget currency options from active account currencies', () => {
    const options = getBudgetCurrencyOptions({
      accounts: [
        makeAccount('aud_one', 'AUD one', 'checking', 'AUD', 0),
        makeAccount('usd', 'USD account', 'cash', 'USD', 0),
        makeAccount('aud_two', 'AUD two', 'savings', 'AUD', 0),
        { ...makeAccount('archived_jpy', 'Archived JPY', 'cash', 'JPY', 0), isArchived: true },
      ],
    });

    expect(options.map((option) => option.code)).toEqual(['AUD', 'USD']);
  });

  it('keeps an existing budget currency available when no active account uses it', () => {
    const options = getBudgetCurrencyOptions({
      accounts: [
        makeAccount('aud', 'AUD account', 'checking', 'AUD', 0),
        { ...makeAccount('archived_jpy', 'Archived JPY', 'cash', 'JPY', 0), isArchived: true },
      ],
      currentBudgetCurrencyCode: 'JPY',
    });

    expect(options.map((option) => option.code)).toEqual(['AUD', 'JPY']);
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
  sortOrder = 0,
  scopeItems?: Budget['scopeItems'],
  period: Budget['period'] = 'monthly',
): Budget {
  return {
    id,
    name,
    amountMinor,
    currencyCode,
    period,
    scopeType,
    categoryId,
    subcategoryId,
    scopeItems: scopeItems ?? getTestBudgetScopeItems(scopeType, categoryId, subcategoryId),
    sortOrder,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

function getTestBudgetScopeItems(
  scopeType: Budget['scopeType'],
  categoryId: string | null,
  subcategoryId: string | null,
): Budget['scopeItems'] {
  if (scopeType === 'overall' || !categoryId) {
    return [];
  }

  return [{
    categoryId,
    subcategoryId: scopeType === 'subcategory' ? subcategoryId : null,
  }];
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
