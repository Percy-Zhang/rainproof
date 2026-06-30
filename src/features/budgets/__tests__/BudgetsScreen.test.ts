import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { defaultCategories } from '../../../domain/categories';
import type { Account, AppSnapshot, Budget } from '../../../domain/types';
import { BudgetsScreen } from '../BudgetsScreen';

jest.mock('@expo/vector-icons', () => {
  return { Ionicons: 'Ionicons' };
});

jest.mock('../BudgetReorderList', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');

  type MockRow = { id: string };
  type MockRenderState = { dragging: boolean; reorderActive: boolean };

  return {
    BudgetReorderList: ({
      contentContainerStyle,
      emptyComponent,
      rows,
      renderRow,
    }: {
      contentContainerStyle?: StyleProp<ViewStyle>;
      emptyComponent: React.ReactNode;
      rows: MockRow[];
      renderRow: (row: MockRow, state: MockRenderState) => React.ReactNode;
    }) => React.createElement(
      View,
      { style: { flex: 1 }, testID: 'budgets-reorder-list' },
      React.createElement(
        View,
        { style: contentContainerStyle },
        rows.length
          ? rows.map((row) => React.createElement(
            View,
            { key: row.id },
            renderRow(row, { dragging: false, reorderActive: false }),
          ))
          : emptyComponent,
      ),
    ),
  };
});

jest.mock('../BudgetHistoryChart', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    BudgetHistoryChart: ({ variant }: { variant: 'bar' | 'line' }) => (
      React.createElement(Text, { testID: 'budget-history-chart' }, variant)
    ),
  };
});

describe('BudgetsScreen fixed controls', () => {
  it('keeps period controls outside the scroll list and preserves header actions', () => {
    const screen = renderBudgets();

    expect(screen.getByText('Budgets')).toBeTruthy();
    expect(screen.getByTestId('budget-period-previous')).toBeTruthy();
    expect(screen.getByTestId('budget-period-next')).toBeTruthy();
    expect(screen.getByTestId('budget-history-mode-current')).toBeTruthy();
    expect(screen.getByTestId('budget-history-mode-compare')).toBeTruthy();
    expect(screen.getByTestId('add-budget')).toBeTruthy();
    expect(screen.getByTestId('budgets-reorder-list').props.style).toEqual({ flex: 1 });
    expect(screen.queryByTestId('unexpected-list-header')).toBeNull();
  });

  it('switches expanded history from current line mode to compare bar mode', () => {
    const screen = renderBudgets();

    fireEvent.press(screen.getByTestId('budget-history-toggle-food'));
    expect(screen.getByTestId('budget-history-chart').props.children).toBe('line');

    fireEvent.press(screen.getByTestId('budget-history-mode-compare'));
    expect(screen.getByTestId('budget-history-chart').props.children).toBe('bar');
  });

  it('does not toggle history when the header touch moves like a scroll gesture', () => {
    const screen = renderBudgets();
    const toggle = screen.getByTestId('budget-history-toggle-food');

    fireEvent(toggle, 'pressIn', { nativeEvent: { pageY: 100 } });
    fireEvent(toggle, 'touchMove', { nativeEvent: { pageY: 112 } });
    fireEvent.press(toggle);

    expect(screen.queryByTestId('budget-history-chart')).toBeNull();
  });
});

function renderBudgets() {
  return render(React.createElement(BudgetsScreen, {
    snapshot: snapshot(),
    onAddBudget: jest.fn(),
    onEditBudget: jest.fn(),
    onUpdateBudgetOrder: jest.fn(async () => undefined),
  }));
}

function snapshot(): AppSnapshot {
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
    accounts: [account()],
    transactions: [],
    transactionLines: [],
    transactionLinks: [],
    budgets: [budget()],
    recurringItems: [],
    recurringBills: [],
    recurringTransactionHistory: [],
    transactionTemplates: [],
    rainyDayFund: {
      id: 'rainy-day',
      name: 'Rainy day fund',
      currencyCode: 'AUD',
      goalMinor: 0,
      linkedAccountIds: [],
      createdAt: now,
      updatedAt: now,
    },
  };
}

const now = '2026-06-16T00:00:00.000Z';

function account(): Account {
  return {
    id: 'checking',
    name: 'Everyday',
    nickname: '',
    type: 'checking',
    currencyCode: 'AUD',
    openingBalanceMinor: 0,
    creditLimitMinor: null,
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

function budget(): Budget {
  return {
    id: 'food',
    name: 'Food',
    amountMinor: 10000,
    currencyCode: 'AUD',
    period: 'monthly',
    scopeType: 'overall',
    categoryId: null,
    subcategoryId: null,
    scopeItems: [],
    sortOrder: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}
