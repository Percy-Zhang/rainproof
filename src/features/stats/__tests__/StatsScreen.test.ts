import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';

import { defaultCategories } from '../../../domain/categories';
import type { Account, AccountBalance, AppSnapshot, Transaction, TransactionLine } from '../../../domain/types';
import { StatsScreen } from '../StatsScreen';

jest.mock('@expo/vector-icons', () => {
  return { Ionicons: 'Ionicons' };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

describe('StatsScreen report kind switch', () => {
  it('defaults to Expenses and excludes income and transfers from the donut rows', () => {
    const screen = renderStatsScreen();

    expect(screen.getByTestId('stats-report-mode-expense').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('stats-match-row-food-line')).toBeTruthy();
    expect(screen.queryByTestId('stats-match-row-salary-line')).toBeNull();
    expect(screen.queryByTestId('stats-match-row-transfer-out')).toBeNull();
  });

  it('keeps the report switch in the spending card with the existing recent rows', () => {
    const screen = renderStatsScreen();
    const spendingCard = within(screen.getByTestId('spending-chart-card'));

    expect(spendingCard.getByTestId('stats-report-mode-row')).toBeTruthy();
    expect(spendingCard.getByTestId('stats-report-mode-expense')).toBeTruthy();
    expect(spendingCard.getByText('Recent matches')).toBeTruthy();
    expect(spendingCard.getByTestId('stats-match-row-food-line')).toBeTruthy();
  });

  it('switches the donut rows to Income and excludes expenses and transfers', () => {
    const screen = renderStatsScreen();

    fireEvent.press(screen.getByTestId('stats-report-mode-income'));

    expect(screen.getByTestId('stats-report-mode-income').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getAllByText('Income').length).toBeGreaterThan(0);
    expect(screen.getByText('Recent income')).toBeTruthy();
    expect(screen.getByTestId('stats-match-row-salary-line')).toBeTruthy();
    expect(screen.getByTestId('stats-match-row-bonus-line')).toBeTruthy();
    expect(screen.queryByTestId('stats-match-row-food-line')).toBeNull();
    expect(screen.queryByTestId('stats-match-row-transfer-in')).toBeNull();
  });

  it('clears the selected expense segment when switching to Income', () => {
    const screen = renderStatsScreen();

    expect(screen.getByTestId('selected-spending-trend-card')).toBeTruthy();

    fireEvent.press(screen.getByTestId('stats-report-mode-income'));

    expect(screen.queryByTestId('selected-spending-trend-card')).toBeNull();
    expect(screen.getByText('All income - $1,200.00')).toBeTruthy();
  });

  it('opens income drilldown routes when Income mode is active', () => {
    const onOpenStatsDrilldown = jest.fn();
    const screen = renderStatsScreen({ onOpenStatsDrilldown });

    fireEvent.press(screen.getByTestId('stats-report-mode-income'));
    fireEvent.press(screen.getByTestId('stats-donut-chart'), {
      nativeEvent: { locationX: 110, locationY: 10 },
    });
    fireEvent.press(screen.getByText('See all'));

    expect(onOpenStatsDrilldown).toHaveBeenCalledWith(expect.objectContaining({
      reportKind: 'income',
      categoryId: 'income',
      currencyCode: 'AUD',
    }));
  });
});

function renderStatsScreen({
  onOpenStatsDrilldown = jest.fn(),
}: {
  onOpenStatsDrilldown?: jest.Mock;
} = {}) {
  const accounts = [account('acct-a', 'Everyday', 'AUD'), account('acct-b', 'Savings', 'AUD')];

  return render(React.createElement(StatsScreen, {
    accountBalances: accounts.map((item) => ({ account: item, balanceMinor: 0 } satisfies AccountBalance)),
    snapshot: snapshot(accounts),
    onOpenStatsDrilldown,
  }));
}

function snapshot(accounts: Account[]): AppSnapshot {
  const recentDate = getRecentIsoDate();
  const transactions = [
    transaction('expense-food', 'expense', 'Groceries', recentDate),
    transaction('mixed-pay', 'income', 'Pay with deductions', recentDate),
    transaction('transfer', 'transfer', 'Move money', recentDate),
  ];
  const transactionLines = [
    line('food-line', 'expense-food', 'acct-a', -5000, 'food', 'groceries'),
    line('salary-line', 'mixed-pay', 'acct-a', 100000, 'income', 'salary'),
    line('bonus-line', 'mixed-pay', 'acct-a', 20000, 'income', 'bonus'),
    line('tax-line', 'mixed-pay', 'acct-a', -3000, 'tax', 'withholding'),
    line('transfer-out', 'transfer', 'acct-a', -25000, 'other', 'miscellaneous'),
    line('transfer-in', 'transfer', 'acct-b', 25000, 'other', 'miscellaneous'),
  ];

  return {
    defaultCurrencyCode: 'AUD',
    settings: {
      defaultCurrencyCode: 'AUD',
      defaultCurrencyMode: 'manual',
      multiCurrencyEnabled: false,
      enabledCurrencyCodes: ['AUD'],
      dashboardSelectedAccountIds: null,
    },
    categories: defaultCategories,
    accounts,
    transactions,
    transactionLines,
    transactionLinks: [],
    budgets: [],
    recurringItems: [],
    recurringBills: [],
    recurringTransactionHistory: [],
    transactionTemplates: [],
    rainyDayFund: {
      id: 'fund',
      name: 'Rainy day fund',
      currencyCode: 'AUD',
      goalMinor: 0,
      linkedAccountIds: [],
      createdAt: '',
      updatedAt: '',
    },
  };
}

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
    includeInRainyDay: true,
    themeColor: '#1876A8',
    iconName: 'business-outline',
    showOnDashboard: true,
    sortOrder: 0,
    isArchived: false,
    createdAt: '',
    updatedAt: '',
  };
}

function transaction(id: string, kind: Transaction['kind'], title: string, datetime: string): Transaction {
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

function line(
  id: string,
  transactionId: string,
  accountId: string,
  amountMinor: number,
  categoryId: string,
  subcategoryId: string,
): TransactionLine {
  return {
    id,
    transactionId,
    accountId,
    amountMinor,
    currencyCode: 'AUD',
    categoryId,
    subcategoryId,
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: '',
  };
}

function getRecentIsoDate(): string {
  const recent = new Date();
  recent.setDate(recent.getDate() - 2);
  recent.setHours(12, 0, 0, 0);
  return recent.toISOString();
}
