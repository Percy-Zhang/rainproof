import { defaultCategories } from '../categories';
import { getInclusiveDateRange, parseDateTimeInput } from '../dates';
import {
  getStatsCashFlowWaterfall,
  type StatsCashFlowWaterfall,
} from '../statsCashFlowWaterfall';
import { getStatsReport } from '../statsReports';
import type { Account, Transaction, TransactionLine } from '../types';

describe('stats cash flow waterfall', () => {
  it('derives boundaries, mixed income and expenses, top categories, and exact reconciliation', () => {
    const accounts = [
      account('checking', 'AUD', 10000),
      account('savings', 'AUD', 5000),
      account('usd-wallet', 'USD', 2000),
    ];
    const transactions = [
      transaction('before-range', 'income', '2026-05-09'),
      transaction('start-income', 'income', '2026-05-10', '00:00'),
      transaction('mixed', 'income', '2026-05-12'),
      transaction('housing', 'expense', '2026-05-13'),
      transaction('food', 'expense', '2026-05-14'),
      transaction('shopping', 'expense', '2026-05-15'),
      transaction('transport', 'expense', '2026-05-16'),
      transaction('health', 'expense', '2026-05-17'),
      transaction('exclusive-end', 'income', '2026-05-21', '00:00'),
    ];
    const transactionLines = [
      line('before-line', 'before-range', 'checking', 1000, 'income'),
      line('start-line', 'start-income', 'checking', 3000, 'income'),
      line('mixed-income', 'mixed', 'checking', 2000, 'income'),
      line('mixed-expense', 'mixed', 'checking', -500, 'food'),
      line('housing-line', 'housing', 'checking', -2000, 'housing'),
      line('food-line', 'food', 'checking', -1000, 'food'),
      line('shopping-line', 'shopping', 'checking', -800, 'shopping'),
      line('transport-line', 'transport', 'checking', -600, 'transport'),
      line('health-line', 'health', 'checking', -400, 'health'),
      line('exclusive-line', 'exclusive-end', 'checking', 9999, 'income'),
    ];

    const waterfall = buildWaterfall({
      accounts,
      accountIds: ['checking', 'savings'],
      transactions,
      transactionLines,
    });

    expect(waterfall.startingBalanceMinor).toBe(16000);
    expect(waterfall.endingBalanceMinor).toBe(15700);
    expect(waterfall.steps.map((step) => [step.id, step.deltaMinor])).toEqual([
      ['start', 0],
      ['income', 5000],
      ['expense:housing', -2000],
      ['expense:food', -1500],
      ['expense:shopping', -800],
      ['expense:transport', -600],
      ['other-expenses', -400],
      ['end', 0],
    ]);
    expect(waterfall.steps.find((step) => step.id === 'income')).toEqual(expect.objectContaining({
      startBalanceMinor: 16000,
      endBalanceMinor: 21000,
    }));
    const otherExpenses = waterfall.steps.find((step) => step.id === 'other-expenses');
    expect(otherExpenses?.categoryId).toBeUndefined();
    expect(otherExpenses?.drilldownReportKind).toBeUndefined();
    expectReconciled(waterfall);
  });

  it('nets selected same-currency transfer pairs to zero', () => {
    const accounts = [account('checking', 'AUD', 1000), account('savings', 'AUD', 500)];
    const transactions = [transaction('transfer', 'transfer', '2026-05-12')];
    const transactionLines = [
      line('out', 'transfer', 'checking', -300, 'other', 'AUD', 'savings'),
      line('in', 'transfer', 'savings', 300, 'other', 'AUD', 'checking'),
    ];
    const waterfall = buildWaterfall({
      accounts,
      accountIds: ['checking', 'savings'],
      transactions,
      transactionLines,
    });

    expect(waterfall.startingBalanceMinor).toBe(1500);
    expect(waterfall.endingBalanceMinor).toBe(1500);
    expect(waterfall.steps.map((step) => step.id)).toEqual(['start', 'end']);
    expectReconciled(waterfall);
  });

  it.each([
    {
      label: 'selected to unselected',
      selectedAccountId: 'checking',
      expectedDeltaMinor: -300,
    },
    {
      label: 'unselected to selected',
      selectedAccountId: 'savings',
      expectedDeltaMinor: 300,
    },
  ])('uses the actual selected side for $label transfers', ({ selectedAccountId, expectedDeltaMinor }) => {
    const accounts = [account('checking', 'AUD', 1000), account('savings', 'AUD', 500)];
    const transactions = [transaction('transfer', 'transfer', '2026-05-12')];
    const transactionLines = [
      line('out', 'transfer', 'checking', -300, 'other', 'AUD', 'savings'),
      line('in', 'transfer', 'savings', 300, 'other', 'AUD', 'checking'),
    ];
    const waterfall = buildWaterfall({
      accounts,
      accountIds: [selectedAccountId],
      transactions,
      transactionLines,
    });

    expect(waterfall.steps.find((step) => step.id === 'transfers')?.deltaMinor).toBe(expectedDeltaMinor);
    expect(waterfall.endingBalanceMinor - waterfall.startingBalanceMinor).toBe(expectedDeltaMinor);
    expectReconciled(waterfall);
  });

  it('uses only the actual selected-currency side of a cross-currency transfer', () => {
    const accounts = [account('aud', 'AUD', 5000), account('usd', 'USD', 700)];
    const transactions = [transaction('cross-currency', 'transfer', '2026-05-12')];
    const transactionLines = [
      line('aud-out', 'cross-currency', 'aud', -1700, 'other', 'AUD', 'usd'),
      line('usd-in', 'cross-currency', 'usd', 1100, 'other', 'USD', 'aud'),
    ];
    const waterfall = buildWaterfall({
      accounts,
      accountIds: ['aud', 'usd'],
      currencyCode: 'USD',
      transactions,
      transactionLines,
    });

    expect(waterfall.eligibleAccountIds).toEqual(['usd']);
    expect(waterfall.steps.find((step) => step.id === 'transfers')?.deltaMinor).toBe(1100);
    expect(waterfall.startingBalanceMinor).toBe(700);
    expect(waterfall.endingBalanceMinor).toBe(1800);
    expectReconciled(waterfall);
  });

  it('keeps negative balances and zero-movement periods exact', () => {
    const negative = buildWaterfall({
      accounts: [account('checking', 'AUD', -200)],
      accountIds: ['checking'],
      transactions: [transaction('expense', 'expense', '2026-05-12')],
      transactionLines: [line('expense-line', 'expense', 'checking', -500, 'food')],
    });
    const unchanged = buildWaterfall({
      accounts: [account('checking', 'AUD', -200)],
      accountIds: ['checking'],
      transactions: [],
      transactionLines: [],
    });

    expect(negative.startingBalanceMinor).toBe(-200);
    expect(negative.endingBalanceMinor).toBe(-700);
    expectReconciled(negative);
    expect(unchanged.steps.map((step) => step.id)).toEqual(['start', 'end']);
    expect(unchanged.startingBalanceMinor).toBe(-200);
    expect(unchanged.endingBalanceMinor).toBe(-200);
    expectReconciled(unchanged);
  });

  it('filters inactive accounts and currency and handles no eligible accounts', () => {
    const accounts = [
      account('selected', 'AUD', 1000),
      account('other-account', 'AUD', 2000),
      account('usd', 'USD', 3000),
      account('archived', 'AUD', 4000, true),
    ];
    const transactions = [
      transaction('selected-income', 'income', '2026-05-12'),
      transaction('other-income', 'income', '2026-05-12'),
      transaction('usd-income', 'income', '2026-05-12'),
      transaction('archived-income', 'income', '2026-05-12'),
    ];
    const transactionLines = [
      line('selected-line', 'selected-income', 'selected', 100, 'income'),
      line('other-line', 'other-income', 'other-account', 200, 'income'),
      line('usd-line', 'usd-income', 'usd', 300, 'income', 'USD'),
      line('archived-line', 'archived-income', 'archived', 400, 'income'),
    ];
    const selected = buildWaterfall({
      accounts,
      accountIds: ['selected'],
      currencyCode: 'AUD',
      transactions,
      transactionLines,
    });
    const none = buildWaterfall({
      accounts,
      accountIds: ['selected'],
      currencyCode: 'NZD',
      transactions,
      transactionLines,
    });

    expect(selected.eligibleAccountIds).toEqual(['selected']);
    expect(selected.startingBalanceMinor).toBe(1000);
    expect(selected.steps.find((step) => step.id === 'income')?.deltaMinor).toBe(100);
    expectReconciled(selected);
    expect(none).toEqual(expect.objectContaining({
      eligibleAccountIds: [],
      startingBalanceMinor: 0,
      endingBalanceMinor: 0,
      steps: [],
    }));
  });

  it('adds a neutral residual when linked report semantics differ from raw ledger movement', () => {
    const accounts = [account('checking', 'AUD', 1000)];
    const transactions = [transaction('income', 'income', '2026-05-12')];
    const transactionLines = [line('income-line', 'income', 'checking', 500, 'income')];
    const reportInput = {
      transactions,
      transactionLines,
      transactionLinks: [],
      accounts,
      categories: defaultCategories,
      range,
      currencyCode: 'AUD',
      accountIds: ['checking'],
    };
    const rawIncomeReport = getStatsReport({ ...reportInput, reportKind: 'income' });
    const waterfall = getStatsCashFlowWaterfall({
      accounts,
      accountIds: ['checking'],
      currencyCode: 'AUD',
      expenseReport: getStatsReport({ ...reportInput, reportKind: 'expense' }),
      incomeReport: {
        ...rawIncomeReport,
        totalNetAmountMinor: 400,
        categoryRollups: rawIncomeReport.categoryRollups.map((rollup) => ({
          ...rollup,
          netAmountMinor: 400,
        })),
      },
      range,
      transactionLines,
      transactions,
    });

    expect(waterfall.steps.find((step) => step.id === 'income')?.deltaMinor).toBe(400);
    expect(waterfall.steps.find((step) => step.id === 'other-balance-movement')?.deltaMinor).toBe(100);
    expectReconciled(waterfall);
  });
});

const range = getInclusiveDateRange('2026-05-10', '2026-05-20');

function buildWaterfall({
  accounts,
  accountIds,
  currencyCode = 'AUD',
  transactions,
  transactionLines,
}: {
  accounts: Account[];
  accountIds: string[];
  currencyCode?: string;
  transactions: Transaction[];
  transactionLines: TransactionLine[];
}) {
  const reportInput = {
    transactions,
    transactionLines,
    transactionLinks: [],
    accounts,
    categories: defaultCategories,
    range,
    currencyCode,
    accountIds,
  };

  return getStatsCashFlowWaterfall({
    accounts,
    accountIds,
    currencyCode,
    expenseReport: getStatsReport({ ...reportInput, reportKind: 'expense' }),
    incomeReport: getStatsReport({ ...reportInput, reportKind: 'income' }),
    range,
    transactionLines,
    transactions,
  });
}

function expectReconciled(waterfall: StatsCashFlowWaterfall) {
  const movementTotalMinor = waterfall.steps
    .filter((step) => step.kind !== 'start' && step.kind !== 'end')
    .reduce((sum, step) => sum + step.deltaMinor, 0);

  expect(waterfall.startingBalanceMinor + movementTotalMinor).toBe(waterfall.endingBalanceMinor);
  expect(waterfall.steps.at(-1)?.endBalanceMinor).toBe(waterfall.endingBalanceMinor);
}

function account(
  id: string,
  currencyCode: string,
  openingBalanceMinor: number,
  isArchived = false,
): Account {
  return {
    id,
    name: id,
    nickname: '',
    type: 'checking',
    currencyCode,
    openingBalanceMinor,
    notes: '',
    institutionName: '',
    includeInRainyDay: false,
    themeColor: '#1876A8',
    iconName: 'business-outline',
    showOnDashboard: true,
    sortOrder: 0,
    isArchived,
    createdAt: '',
    updatedAt: '',
  };
}

function transaction(
  id: string,
  kind: Transaction['kind'],
  date: string,
  time = '12:00',
): Transaction {
  const datetime = parseDateTimeInput(date, time);
  return {
    id,
    kind,
    title: id,
    datetime,
    notes: '',
    labels: [],
    groupId: '',
    createdAt: datetime,
    updatedAt: datetime,
  };
}

function line(
  id: string,
  transactionId: string,
  accountId: string,
  amountMinor: number,
  categoryId: string,
  currencyCode = 'AUD',
  transferPeerAccountId = '',
): TransactionLine {
  return {
    id,
    transactionId,
    accountId,
    amountMinor,
    currencyCode,
    categoryId,
    subcategoryId: categoryId === 'income' ? 'salary' : categoryId === 'housing' ? 'rent' : 'groceries',
    externalParty: '',
    transferPeerAccountId,
    note: '',
    createdAt: '',
  };
}
