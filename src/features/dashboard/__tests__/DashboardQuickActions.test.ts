import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { DashboardScreen } from '../DashboardScreen';
import type { AppSnapshot, RainyDayProgress } from '../../../domain/types';

jest.mock('@expo/vector-icons', () => {
  return { Ionicons: 'Ionicons' };
});

describe('Dashboard quick actions', () => {
  it('opens and closes the add action menu from the main dashboard button', () => {
    const screen = renderDashboard();

    expect(screen.queryByTestId('dashboard-quick-action-menu')).toBeNull();

    fireEvent.press(screen.getByTestId('dashboard-add-transaction'));
    expect(screen.getByTestId('dashboard-quick-action-menu')).toBeTruthy();
    expect(screen.getByText('Add Transaction')).toBeTruthy();
    expect(screen.getByText('Use Template')).toBeTruthy();

    fireEvent.press(screen.getByTestId('dashboard-add-transaction'));
    expect(screen.queryByTestId('dashboard-quick-action-menu')).toBeNull();
  });

  it('uses the existing add transaction navigation target and closes the menu', () => {
    const onAddTransaction = jest.fn();
    const screen = renderDashboard({ onAddTransaction });

    fireEvent.press(screen.getByTestId('dashboard-add-transaction'));
    fireEvent.press(screen.getByTestId('dashboard-quick-action-add-transaction'));

    expect(onAddTransaction).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('dashboard-quick-action-menu')).toBeNull();
  });

  it('opens Templates from the Use Template action and closes the menu', () => {
    const onOpenTemplates = jest.fn();
    const screen = renderDashboard({ onOpenTemplates });

    fireEvent.press(screen.getByTestId('dashboard-add-transaction'));
    fireEvent.press(screen.getByTestId('dashboard-quick-action-use-template'));

    expect(onOpenTemplates).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('dashboard-quick-action-menu')).toBeNull();
  });
});

function renderDashboard(overrides: Partial<DashboardProps> = {}) {
  const props: DashboardProps = {
    snapshot: snapshot(),
    accountBalances: [],
    rainyDayProgress: rainyDayProgress(),
    onAddAccount: jest.fn(),
    onAddTransaction: jest.fn(),
    onOpenRainyDayFund: jest.fn(),
    onOpenTransactions: jest.fn(),
    onOpenTransaction: jest.fn(),
    onOpenAccount: jest.fn(),
    onOpenBudgets: jest.fn(),
    onOpenDashboardEdit: jest.fn(),
    onOpenRecurring: jest.fn(),
    onOpenTemplates: jest.fn(),
    onUpdateSelectedAccountIds: jest.fn(async () => undefined),
    ...overrides,
  };

  return render(React.createElement(DashboardScreen, props));
}

type DashboardProps = Parameters<typeof DashboardScreen>[0];

function snapshot(): AppSnapshot {
  const now = '2026-05-28T00:00:00.000Z';
  return {
    defaultCurrencyCode: 'AUD',
    settings: {
      defaultCurrencyCode: 'AUD',
      defaultCurrencyMode: 'auto',
      multiCurrencyEnabled: false,
      enabledCurrencyCodes: ['AUD'],
      dashboardSelectedAccountIds: null,
    },
    categories: [],
    accounts: [],
    transactions: [],
    transactionLines: [],
    transactionLinks: [],
    budgets: [],
    recurringItems: [],
    recurringBills: [],
    transactionTemplates: [],
    rainyDayFund: {
      id: 'fund',
      name: 'Rainy day fund',
      currencyCode: 'AUD',
      goalMinor: 100000,
      linkedAccountIds: [],
      createdAt: now,
      updatedAt: now,
    },
  };
}

function rainyDayProgress(): RainyDayProgress {
  return {
    fund: snapshot().rainyDayFund,
    currentMinor: 0,
    remainingMinor: 100000,
    percentage: 0,
  };
}
